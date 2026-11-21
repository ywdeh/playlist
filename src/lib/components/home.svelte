<script lang="ts">
	import { tick } from 'svelte';
	import Cover from './cover.svelte';
	import Row from './row.svelte';
	import Shelf from './shelf.svelte';
	import NowPlaying from './now_playing.svelte';
	import { LFM_PERIODS, LFM_PERIOD_LABELS, type LfmArtist, type LfmPeriod, type LfmTrack, type LiveData, type Playlist } from '#lib/lastfm';
	import { player } from '#lib/player.svelte';
	import { cover_url, tint_on_hover } from '#lib/hover_tint.svelte';
	import { link } from '#lib/link';
	import { artist_menu, song_menu } from '#lib/menu.svelte';
	import { reveal } from '#lib/reveal';
	import { ago, length } from '#lib/format';

	let {
		data,
		title,
		base = '',
		intro = [],
		playlist = null
	}: { data: LiveData; title: string; base?: string; intro?: string[]; playlist?: Playlist | null } = $props();

	const pinned = $derived(playlist?.songs ?? []);
	const song_key = (s: { artist: string; name: string }) => `${s.artist}\u0000${s.name}`.toLowerCase();
	const pinned_keys = $derived(new Set(pinned.map(song_key)));
	const shift = $derived(Math.min(pinned.length, 10));
	let now = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(id);
	});

	const since = (iso: string) =>
		new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

	let show_all = $state(false);
	const now_item = $derived(data.recent[0]?.now_playing ? data.recent[0] : null);
	const recent = $derived(data.recent.filter((r) => !r.now_playing).slice(0, 15));

	type Top = { user: string; period: LfmPeriod; tracks: LfmTrack[]; artists: LfmArtist[] };
	let picked = $state<Top | null>(null);
	let pending = $state<LfmPeriod | null>(null);
	const top = $derived<Top>(picked && picked.user === data.user ? picked : data);
	const ranked = $derived(top.tracks.filter((t) => !pinned_keys.has(song_key(t))));
	const songs = $derived(show_all ? ranked : ranked.slice(0, 10));
	const queue = $derived([...pinned, ...ranked]);
	const shown = $derived(pending ?? top.period);
	const loaded = new Map<string, Top>();
	let request = 0;

	async function toggle_all(e: MouseEvent) {
		const button = e.currentTarget as HTMLElement;
		const before = button.getBoundingClientRect().top;
		show_all = !show_all;
		if (show_all) return;
		await tick();
		window.scrollBy({ top: button.getBoundingClientRect().top - before, behavior: 'instant' });
	}

	async function pick(p: LfmPeriod) {
		if (p === shown) return;
		const id = ++request;
		const key = `${data.user}:${p}`;
		pending = p;
		try {
			let next = loaded.get(key);
			if (!next) {
				const res = await fetch(`/api/top/${encodeURIComponent(data.user)}?period=${p}`);
				if (!res.ok) throw new Error();
				next = (await res.json()) as Top;
				loaded.set(key, next);
			}
			if (id !== request) return;
			show_all = false;
			picked = next;
		} catch {
		} finally {
			if (id === request) pending = null;
		}
	}
</script>

<div class="title cascade" style:--i={0}>
	<h1>{title}</h1>
	<button type="button" class="updated tip_anchor" aria-label="About this page" aria-describedby="about_page">
		<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6v.1" /></svg>
		<span class="tip end wide below" role="tooltip" id="about_page">
			<strong>Updated {ago(data.updated, now)}</strong>
			{#if data.since}<span>Counting plays since {since(data.since)}</span>{/if}
			<span>Plays from Last.fm,{#if playlist}&nbsp;favourites from Spotify,{/if} covers and details from Deezer.</span>
			<span>If something looks off, they're likely still catching up.</span>
		</span>
	</button>
</div>

{#if intro.length}
	<p class="intro cascade" style:--i={0.5}>
		{#each intro as line, i (i)}{#if i}<br />{/if}{line}{/each}
	</p>
{/if}

<div class="cascade" style:--i={1}><NowPlaying user={data.user} initial={now_item} /></div>

<nav class="periods cascade" style:--i={2} aria-label="Time range">
	{#each LFM_PERIODS as p (p)}
		<button class="press" aria-pressed={shown === p} onclick={() => pick(p)}>{LFM_PERIOD_LABELS[p]}</button>
	{/each}
</nav>

{#key top.period}
	<section class="block first" {@attach reveal}>
		<h2 class="cascade" style:--i={3}>Top songs</h2>
		{#if queue.length}
			<ol class="list">
				{#each pinned as s, i (s.spotify)}
					<Row
						name={s.name}
						artist={s.artist}
						image={s.image}
						album={s.album}
						duration={s.duration}
						spotify={s.spotify}
						pinned
						order={4 + i}
						onplay={() => player.play(queue, i)}
					/>
				{/each}
				{#each songs as t, i (t.artist + t.name)}
					<Row
						name={t.name}
						artist={t.artist}
						image={t.image}
						album={t.album}
						duration={t.duration}
						rank={i + 1}
						order={4 + shift + (i % 10)}
						onplay={() => player.play(queue, pinned.length + i)}
					/>
				{/each}
			</ol>
			{#if ranked.length > 10}
				<button class="more press cascade" style:--i={14 + shift} onclick={toggle_all}>{show_all ? 'Show less' : 'Show more'}</button>
			{/if}
		{:else}
			<p class="empty">Nothing played in this time yet.</p>
		{/if}
	</section>

	{#if top.artists.length}
		<Shelf title="Top artists" order={15 + shift}>
			{#each top.artists as a (a.name)}
				<div
					class="item artist press"
					role="link"
					tabindex="0"
					{@attach link(() => `${base}/artist/${encodeURIComponent(a.name)}`)}
					{@attach tint_on_hover(() => cover_url(null, a.name))}
					{@attach artist_menu(() => a.name)}
				>
					<Cover src={null} artist={a.name} round />
					<span class="label ellipsis">{a.name}</span>
				</div>
			{/each}
		</Shelf>
	{/if}
{/key}

{#if data.fresh.length}
	<Shelf title="New" order={16 + shift}>
		{#each data.fresh as s, i (s.artist + s.name)}
			<button class="item tile press" class:active={player.is_current(s)} onclick={() => player.play(data.fresh, i)}
					{@attach tint_on_hover(() => cover_url(s.image, s.artist, s.name))}
					{@attach song_menu(() => ({ name: s.name, artist: s.artist, play: () => player.play(data.fresh, i) }))}
				>
				<Cover src={s.image} artist={s.artist} name={s.name} />
				<span class="label ellipsis">{s.name}</span>
				<span class="sub">
					<span class="ellipsis">{s.artist}</span>
					{#if s.duration}<span class="length">{length(s.duration)}</span>{/if}
				</span>
			</button>
		{/each}
	</Shelf>
{/if}

{#if recent.length}
	<section class="block cascade" style:--i={17 + shift} {@attach reveal}>
		<h2>Recently played</h2>
		<ul class="list">
			{#each recent as r, i (r.at + r.name)}
				<Row
					name={r.name}
					artist={r.artist}
					image={r.image}
					album={r.album}
					duration={r.duration}
					order={18 + shift + i}
					meta={r.at ? ago(r.at) : undefined}
					onplay={() => player.play(recent, i)}
				/>
			{/each}
		</ul>
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
		font-size: clamp(2.6rem, 10vw, 3.8rem);
		font-weight: 600;
		letter-spacing: -0.025em;
		line-height: 1;
	}
	.intro {
		max-width: 34em;
		margin: -16px 0 44px;
		color: var(--muted);
		font-size: 1.05rem;
		line-height: 1.6;
		text-wrap: pretty;
	}
	@media (max-width: 520px) {
		.intro {
			margin: -12px 0 32px;
			font-size: 1rem;
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
		font-weight: 600;
		font-size: 1.05em;
	}
	.updated svg {
		width: 22px;
		height: 22px;
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
		font-size: 1.5rem;
		font-weight: 650;
		letter-spacing: -0.02em;
		line-height: 1.2;
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
	.periods button,
	.more {
		display: inline-grid;
		place-items: center;
		flex: none;
		height: 48px;
		padding: 0 24px;
		border-radius: 999px;
		--press-scale: 0.94;
		background: var(--surface);
		font-weight: 600;
		font-size: 0.95rem;
		text-decoration: none;
	}
	.periods button:hover:not([aria-pressed='true']),
	.more:hover {
		box-shadow: inset 0 0 0 999px var(--wash);
	}
	.periods button[aria-pressed='true'] {
		background: var(--accent);
		color: var(--accent-ink);
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
			font-size: 0.88rem;
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
	.more {
		margin-top: 22px;
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
		--art-r: 16px;
	}
	.label {
		font-weight: 600;
		font-size: 1.04em;
		line-height: 26px;
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
		font-size: 0.9em;
		line-height: 22px;
	}
</style>
