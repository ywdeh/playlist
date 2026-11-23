<script lang="ts">
	import Cover from './cover.svelte';
	import Row from './row.svelte';
	import MoreList from './more_list.svelte';
	import Shelf from './shelf.svelte';
	import NowPlaying from './now_playing.svelte';
	import { PERIODS, PERIOD_LABELS, type LiveData, type Period, type Playlist, type Top } from '#lib/music';
	import { player } from '#lib/player.svelte';
	import { cover_url, page_tint, tint_on_hover } from '#lib/tint.svelte';
	import { link, out_link } from '#lib/link';
	import { CONTACT } from '#lib/site';
	import { artist_menu, artist_path, song_menu } from '#lib/menu.svelte';
	import { reveal } from '#lib/reveal';
	import { flip } from '#lib/flip.svelte';
	import { ago } from '#lib/format';
	import { invalidateAll } from '$app/navigation';
	import { clock, every, STATS_EVERY_MS } from '#lib/live.svelte';

	let {
		data,
		title,
		intro = [],
		playlist = null
	}: { data: LiveData; title: string; intro?: string[]; playlist?: Playlist | null } = $props();

	const pinned = $derived(playlist?.songs ?? []);
	const song_key = (s: { artist: string; name: string }) => `${s.artist}\u0000${s.name}`.toLowerCase();
	const pinned_keys = $derived(new Set(pinned.map(song_key)));
	const shift = $derived(Math.min(pinned.length, 10));

	let picked = $state<Top | null>(null);
	let pending = $state<Period | null>(null);
	const top = $derived<Top>(picked ?? data);
	const ranked = $derived(top.tracks.filter((t) => !pinned_keys.has(song_key(t))));
	const queue = $derived([...ranked, ...pinned]);

	const best = $derived(top.tracks[0]);
	const backdrop = $derived(best ? cover_url(best.image, best.artist, best.name) : null);
	page_tint(() => backdrop);

	const shown = $derived(pending ?? top.period);
	const loaded = new Map<Period, Top>();
	let request = 0;

	async function fetch_top(p: Period): Promise<Top> {
		const res = await fetch(`/api/top?period=${p}`);
		if (!res.ok) throw new Error(res.statusText);
		const next = (await res.json()) as Top;
		loaded.set(p, next);
		return next;
	}

	async function pick(p: Period) {
		if (p === shown) return;
		const id = ++request;
		pending = p;
		try {
			const next = loaded.get(p) ?? (await fetch_top(p));
			if (id === request) picked = next;
		} catch {
		} finally {
			if (id === request) pending = null;
		}
	}

	every(STATS_EVERY_MS, async () => {
		loaded.clear();
		await invalidateAll();
		const p = picked?.period;
		if (p) picked = await fetch_top(p).catch(() => picked);
	});
</script>

<div class="glow" aria-hidden="true"></div>

<div class="title cascade" style:--i={0}>
	<h1>
		<span class="site press" aria-label="{title}, open {CONTACT.site.label}" {@attach out_link(CONTACT.site.href)}
			>{title}</span
		>
	</h1>
	<button type="button" class="updated tip_anchor" aria-label="About this page" aria-describedby="about_page">
		<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 11v5M12 8h.01" /></svg>
		<span class="tip end wide below" role="tooltip" id="about_page">
			<strong>updated {ago(data.updated, clock.now)}</strong>
			<span>straight from my spotify, with previews from deezer and itunes</span>
			<span>if gets too outdated, my spotify subscription must've died. rip</span>
		</span>
	</button>
</div>

{#if intro.length}
	<p class="intro cascade" style:--i={0.5}>
		{#each intro as line, i (i)}{#if i}<br />{/if}{line}{/each}
	</p>
{/if}

<div class="cascade" style:--i={1}><NowPlaying initial={data.now} /></div>

<nav class="periods cascade" style:--i={2} aria-label="Time range">
	{#each PERIODS as p (p)}
		<button class="pill press" aria-pressed={shown === p} onclick={() => pick(p)}>{PERIOD_LABELS[p]}</button>
	{/each}
</nav>

{#key top.period}
	<section class="block first" {@attach reveal}>
		<h2 class="cascade" style:--i={3}>top songs</h2>
		{#if queue.length}
			{#if ranked.length}
				<MoreList total={ranked.length} order={13}>
					<ol class="list" {@attach flip(() => ranked)}>
						{#each ranked as t, i (t.artist + t.name)}
							<Row song={t} rank={i + 1} order={4 + Math.min(i, 9)} onplay={() => player.play(queue, i)} />
						{/each}
					</ol>
				</MoreList>
			{/if}
			{#if pinned.length}
				<ul class="list favourites">
					{#each pinned as s, i (s.spotify)}
						<Row song={s} pinned order={14 + i} onplay={() => player.play(queue, ranked.length + i)} />
					{/each}
				</ul>
			{/if}
		{:else}
			<p class="empty">nothing played in this time yet</p>
		{/if}
	</section>

	{#if top.artists.length}
		<Shelf title="top artists" order={15 + shift}>
			{#each top.artists as a (a.name)}
				<div
					class="item artist press"
					role="link"
					tabindex="0"
					{@attach link(() => artist_path(a.name))}
					{@attach tint_on_hover(() => a.image ?? cover_url(null, a.name))}
					{@attach artist_menu(() => ({ artist: a.name, spotify: a.spotify }))}
				>
					<Cover src={a.image} artist={a.name} round />
					<span class="label ellipsis">{a.name}</span>
				</div>
			{/each}
		</Shelf>
	{/if}
{/key}

{#if data.enjoyed.length}
	<section class="block cascade" style:--i={16 + shift} {@attach reveal}>
		<h2>recently enjoyed</h2>
		<MoreList total={data.enjoyed.length} order={27 + shift}>
			<ul class="list" {@attach flip(() => data.enjoyed)}>
				{#each data.enjoyed as s, i (s.artist + s.name)}
					<Row song={s} order={17 + shift + Math.min(i, 9)} onplay={() => player.play(data.enjoyed, i)} />
				{/each}
			</ul>
		</MoreList>
	</section>
{/if}

<style>
	.glow {
		position: absolute;
		inset: 0 0 auto;
		z-index: -1;
		height: min(100svh, 820px);
		pointer-events: none;
		background: var(--mist);
		opacity: 0.025;
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n' x='0' y='0' width='100%25' height='100%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' result='f'/%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.45' numOctaves='2' seed='3'/%3E%3CfeComposite in2='f' operator='arithmetic' k2='.6' k3='.4'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2.6 0 0 0 -.8' result='m'/%3E%3CfeComposite in='SourceGraphic' in2='m' operator='arithmetic' k2='4.3' k3='3.6' k4='-3.6'/%3E%3C/filter%3E%3CradialGradient id='g' cx='.5' cy='1' r='1.1'%3E%3Cstop offset='.5' stop-color='%23fff' stop-opacity='0'/%3E%3Cstop offset='.575' stop-color='%23fff' stop-opacity='.15'/%3E%3Cstop offset='.7' stop-color='%23fff' stop-opacity='.45'/%3E%3Cstop offset='.85' stop-color='%23fff' stop-opacity='.8'/%3E%3Cstop offset='1' stop-color='%23fff' stop-opacity='1'/%3E%3C/radialGradient%3E%3Crect width='100%25' height='100%25' fill='url(%23g)' filter='url(%23n)'/%3E%3C/svg%3E") 0 0 / 100% 100%;
	}
	@media (max-width: 520px) {
		.glow {
			height: 70svh;
		}
	}
	.title {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--gap-lg);
		margin: clamp(24px, 10svh, 120px) 0 clamp(40px, 5svh, 56px);
	}
	h1 {
		line-height: 1;
	}
	.site {
		cursor: pointer;
		--press-scale: 0.98;
	}
	.intro {
		max-width: 34em;
		margin: calc(-1 * var(--gap-lg)) 0 clamp(44px, 7svh, 88px);
		color: var(--muted);
		font-size: var(--fs-md);
		line-height: 1.6;
		text-wrap: pretty;
	}
	@media (max-width: 520px) {
		.intro {
			margin: calc(-1 * var(--gap-md)) 0 clamp(32px, 5svh, 56px);
		}
	}
	.updated {
		flex: none;
		display: grid;
		place-items: center;
		width: var(--control-sm);
		height: var(--control-sm);
		border-radius: var(--r-pill);
		color: var(--muted);
		cursor: default;
	}
	.updated strong {
		font-weight: var(--fw-strong);
		font-size: var(--fs-sm);
	}
	.updated svg {
		width: var(--icon);
		height: var(--icon);
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.updated svg :global(*) {
		stroke-width: var(--stroke);
		vector-effect: non-scaling-stroke;
	}
	h2 {
		margin: 0 0 var(--gap-xl);
	}
	.block {
		margin-top: var(--section-gap);
	}
	.block.first {
		margin-top: var(--gap-3xl);
	}
	.periods {
		display: flex;
		gap: var(--gap-md);
		margin: clamp(50px, 8svh, 104px) calc(-1 * var(--gap-sm)) calc(-1 * var(--gap-sm));
		padding: var(--gap-sm);
		overflow-x: auto;
		scrollbar-width: none;
	}
	@media (max-width: 520px) {
		.periods {
			gap: var(--gap-sm);
			margin-top: clamp(34px, 6svh, 64px);
		}
		.periods button {
			flex: 1 1 0;
			min-width: 0;
			height: var(--control-md);
			padding: 0 var(--gap-sm);
		}
		.title {
			margin: clamp(8px, 6svh, 64px) 0 var(--gap-2xl);
		}
	}
	.list {
		list-style: none;
		display: grid;
		gap: var(--gap-sm);
		margin: 0 calc(-1 * var(--inset));
		padding: 0;
	}
	.favourites {
		margin-top: var(--gap-3xl);
	}
	.empty {
		color: var(--muted);
	}
	.item {
		display: grid;
		align-content: start;
		gap: var(--gap-xs);
		min-width: 0;
		--press-scale: 0.95;
	}
	.artist {
		text-align: center;
		text-decoration: none;
	}
	.item :global(.art) {
		width: 100%;
		margin-bottom: var(--gap-md);
	}
	.label {
		font-weight: var(--fw-name);
		font-size: var(--fs-md);
		line-height: 26px;
	}
</style>
