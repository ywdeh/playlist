<script lang="ts">
	import Cover from './cover.svelte';
	import Row from './row.svelte';
	import MoreList from './more_list.svelte';
	import Shelf from './shelf.svelte';
	import NowPlaying from './now_playing.svelte';
	import { PERIODS, PERIOD_LABELS, type LiveData, type Period, type Playlist, type Top } from '#lib/music';
	import { player } from '#lib/player.svelte';
	import { playable } from '#lib/playable.svelte';
	import { cover_url, tint_on_hover } from '#lib/tint.svelte';
	import { link } from '#lib/link';
	import { artist_menu, artist_path, song_menu } from '#lib/menu.svelte';
	import { reveal } from '#lib/reveal';
	import { flip } from '#lib/flip.svelte';
	import { ago, length } from '#lib/format';
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
	const recent = $derived(data.recent.slice(0, 24));

	let picked = $state<Top | null>(null);
	let pending = $state<Period | null>(null);
	const top = $derived<Top>(picked ?? data);
	const ranked = $derived(top.tracks.filter((t) => !pinned_keys.has(song_key(t))));
	const queue = $derived([...ranked, ...pinned]);

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

<div class="title cascade" style:--i={0}>
	<h1>{title}</h1>
	<button type="button" class="updated tip_anchor" aria-label="About this page" aria-describedby="about_page">
		<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 11v5M12 8h.01" /></svg>
		<span class="tip end wide below" role="tooltip" id="about_page">
			<strong>updated {ago(data.updated, clock.now)}</strong>
			<span>straight from my spotify, with previews from deezer and itunes</span>
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

{#if data.fresh.length}
	<Shelf title="new" order={16 + shift}>
		{#each data.fresh as s, i (s.artist + s.name)}
			<button
					class="item tile press"
					class:active={player.is_current(s)}
					class:muted={playable.state(s) === 'no'}
					onclick={() => playable.state(s) !== 'no' && player.play(data.fresh, i)}
					{@attach playable.watch(() => s)}
					{@attach tint_on_hover(() => cover_url(s.image, s.artist, s.name))}
					{@attach song_menu(() => ({ name: s.name, artist: s.artist, spotify: s.spotify, play: () => player.play(data.fresh, i) }))}
				>
				<Cover src={s.image} artist={s.artist} name={s.name} />
				<span class="label ellipsis">{s.name}</span>
				<span class="sub">
					<span class="ellipsis">{s.credits ?? s.artist}</span>
					{#if s.duration}<span class="length">{length(s.duration)}</span>{/if}
				</span>
			</button>
		{/each}
	</Shelf>
{/if}

{#if recent.length}
	<section class="block cascade" style:--i={17 + shift} {@attach reveal}>
		<h2>recently played</h2>
		<MoreList total={recent.length} order={27 + shift}>
			<ul class="list" {@attach flip(() => recent)}>
				{#each recent as r, i (r.at + r.name)}
					<Row song={r} order={18 + shift + Math.min(i, 9)} meta={ago(r.at, clock.now)} onplay={() => player.play(recent, i)} />
				{/each}
			</ul>
		</MoreList>
	</section>
{/if}

<style>
	.title {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin: 24px 0 40px;
	}
	h1 {
		line-height: 1;
	}
	.intro {
		max-width: 34em;
		margin: -16px 0 44px;
		color: var(--muted);
		font-size: var(--fs-lg);
		line-height: 1.6;
		text-wrap: pretty;
	}
	@media (max-width: 520px) {
		.intro {
			margin: -12px 0 32px;
			font-size: var(--fs-md);
		}
	}
	.updated {
		flex: none;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		color: var(--muted);
		cursor: default;
	}
	.updated strong {
		font-weight: var(--fw-strong);
		font-size: var(--fs-sm);
	}
	.updated svg {
		width: 24px;
		height: 24px;
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.updated svg :global(*) {
		stroke-width: 2px;
		vector-effect: non-scaling-stroke;
	}
	h2 {
		margin: 0 0 26px;
	}
	.block {
		margin-top: var(--section-gap);
	}
	.block.first {
		margin-top: 56px;
	}
	.periods {
		display: flex;
		gap: 12px;
		margin: 50px -6px -6px;
		padding: 6px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	@media (max-width: 520px) {
		.periods {
			gap: 8px;
			margin-top: 34px;
		}
		.periods button {
			flex: 1 1 0;
			min-width: 0;
			height: 44px;
			padding: 0 8px;
		}
		.title {
			margin: 8px 0 32px;
		}
	}
	.list {
		list-style: none;
		display: grid;
		gap: 8px;
		margin: 0 -14px;
		padding: 0;
	}
	.favourites {
		margin-top: 48px;
	}
	.empty {
		color: var(--muted);
	}
	.item {
		display: grid;
		align-content: start;
		gap: 4px;
		min-width: 0;
		--press-scale: 0.95;
	}
	.artist {
		text-align: center;
		text-decoration: none;
	}
	.item :global(.art) {
		width: 100%;
		margin-bottom: 12px;
	}
	.tile :global(.art) {
		--art-r: var(--r-md);
	}
	.label {
		font-weight: var(--fw-strong);
		font-size: var(--fs-lg);
		line-height: 26px;
	}
	.tile > * {
		transition: opacity var(--t-move) var(--ease);
	}
	.tile.muted > * {
		opacity: var(--tone-off);
	}
	.tile.active .label {
		color: var(--accent);
	}
	.length {
		flex: none;
		font-variant-numeric: tabular-nums;
	}
	.sub {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		min-width: 0;
		color: var(--muted);
		font-size: var(--fs-sm);
		line-height: 22px;
	}
</style>
