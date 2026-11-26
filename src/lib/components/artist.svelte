<script lang="ts">
	import Cover from './cover.svelte';
	import Row from './row.svelte';
	import MoreList from './more_list.svelte';
	import type { ArtistData, Song } from '#lib/music';
	import { player } from '#lib/player.svelte';
	import { cover_url, page_tint, tint_on_hover } from '#lib/tint.svelte';
	import { link } from '#lib/link';
	import { artist_menu } from '#lib/menu.svelte';
	import { reveal } from '#lib/reveal';
	import { catalog } from '#lib/catalog.svelte';
	import { afterNavigate, goto, preloadData } from '$app/navigation';
	import { typing } from '#lib/keys';
	import { search } from '#lib/catalog.svelte';
	import { menu } from '#lib/menu.svelte';
	import SearchButton from './search_button.svelte';

	let { data, back, who }: { data: ArtistData; back: string; who: string } = $props();

	const photo = $derived(data.image ?? cover_url(null, data.artist));
	page_tint(() => photo);

	/** waits until this page's own images and previews have had their turn */
	const BACK_PRELOAD_MS = 1500;

	/** came here from the back page inside the site: going back restores its scroll spot */
	let came_from_back = false;
	afterNavigate(({ from }) => {
		came_from_back = from?.url.pathname === back;
		// going back is the likely next step: load that page's data while this one is read,
		// so Esc or a quick click on back starts the transition without waiting on the network
		clearTimeout(ahead);
		ahead = setTimeout(() => preloadData(back).catch(() => {}), BACK_PRELOAD_MS);
	});
	let ahead: ReturnType<typeof setTimeout> | undefined;
	$effect(() => () => clearTimeout(ahead));
	function go_back(e: MouseEvent | KeyboardEvent) {
		const plain = e instanceof MouseEvent ? e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey : e.key === 'Enter' && !e.ctrlKey && !e.metaKey;
		if (!plain || !came_from_back) return;
		e.preventDefault();
		history.back();
	}

	/** Esc leaves the page, like the back button; search and menus use Esc first to close themselves */
	function escape(e: KeyboardEvent) {
		if (e.key !== 'Escape' || e.defaultPrevented || typing(e) || search.open || menu.open) return;
		e.preventDefault();
		if (came_from_back) history.back();
		else void goto(back);
	}

	/** spotify sometimes lists the same song twice (two releases); each list shows it once */
	const once = (songs: Song[]) => [...new Map(songs.map((s) => [s.artist + s.name, s])).values()];
	const yours = $derived(once(data.yours));
	const popular = $derived(once(data.popular));
	const all = $derived([...yours, ...popular]);
	$effect.pre(() => {
		catalog.add(all, [{ name: data.artist, image: data.image, spotify: data.spotify }]);
	});
	const from_here = $derived(all.some((s) => player.is_current(s)));
	const show_pause = $derived(from_here && player.playing);

	function play_all() {
		if (from_here) player.toggle();
		else player.play(all, 0);
	}
</script>

<svelte:window onkeydown={escape} />

<div class="top cascade" style:--i={0}>
	<div
		class="back press"
		role="link"
		tabindex="0"
		onclickcapture={go_back}
		onkeydowncapture={go_back}
		{@attach link(() => back)}
		aria-label="Back"
		aria-keyshortcuts="Escape"
	>
		<svg viewBox="0 0 24 24"><path d="M14 7l-5 5 5 5" /></svg>
	</div>
	<SearchButton />
</div>

<header>
	<div
		class="identity"
		{@attach tint_on_hover(() => photo)}
		{@attach artist_menu(() => ({ artist: data.artist, spotify: data.spotify }))}
	>
		<div class="photo cascade" style:--i={1}>
			<Cover src={data.image} artist={data.artist} round hero={data.artist} />
		</div>
		<h1 class="cascade" style:--i={2}>{data.artist}</h1>
	</div>
	{#if all.length}
		<button class="play press cascade" style:--i={3} onclick={play_all} aria-label={show_pause ? 'Pause' : 'Play'}>
			{#if show_pause}
				<svg viewBox="0 0 24 24"><path d="M6 4h3v16H6zm9 0h3v16h-3z" /></svg>
			{:else}
				<svg viewBox="0 0 24 24"><path d="M8 4.8v14.4l11.1-7.2z" /></svg>
			{/if}
		</button>
	{/if}
</header>

{#if yours.length}
	<section {@attach reveal}>
		<h2 class="cascade" style:--i={4}>{who}'s songs</h2>
		<ul class="list">
			{#each yours as s, i (s.artist + s.name)}
				<Row
					song={s}
					order={5 + i}
					onplay={() => player.play(all, i)}
				/>
			{/each}
		</ul>
	</section>
{/if}

{#if popular.length}
	<section {@attach reveal}>
		<h2 class="cascade" style:--i={6 + yours.length}>popular</h2>
		<MoreList total={popular.length} order={7 + yours.length + Math.min(popular.length, 8)}>
			<ul class="list">
				{#each popular as s, i (s.artist + s.name)}
					<Row
						song={s}
						order={7 + yours.length + Math.min(i, 8)}
						onplay={() => player.play(all, yours.length + i)}
					/>
				{/each}
			</ul>
		</MoreList>
	</section>
{/if}

<style>
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.back {
		display: grid;
		place-items: center;
		width: var(--control-lg);
		height: var(--control-lg);
		border-radius: var(--r-pill);
		--press-scale: 0.9;
		background: var(--surface);
		color: var(--text);
	}
	.back:hover {
		box-shadow: inset 0 0 0 999px var(--wash);
	}
	.back svg {
		width: var(--icon);
		height: var(--icon);
		fill: none;
		stroke: currentColor;
		stroke-width: var(--stroke);
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	header {
		display: grid;
		justify-items: center;
		gap: var(--gap-xl);
		margin: var(--gap-xl) 0 var(--gap-sm);
		text-align: center;
	}
	.identity {
		display: grid;
		justify-items: center;
		gap: var(--gap-xl);
	}
	.photo {
		width: clamp(180px, 40vw, 260px);
	}
	.photo :global(.art) {
		width: 100%;
	}
	h1 {
		overflow-wrap: anywhere;
	}
	.play {
		display: grid;
		place-items: center;
		width: 64px;
		height: 64px;
		border-radius: var(--r-pill);
		--press-scale: 0.9;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.play svg {
		width: var(--icon);
		height: var(--icon);
		fill: currentColor;
		stroke: currentColor;
		stroke-width: var(--stroke);
		stroke-linejoin: round;
	}
	section {
		margin-top: var(--gap-4xl);
	}
	section ~ section {
		margin-top: var(--section-gap);
	}
	h2 {
		margin: 0 0 var(--gap-xl);
	}
	.list {
		list-style: none;
		display: grid;
		gap: var(--gap-sm);
		margin: 0 calc(-1 * var(--inset));
		padding: 0;
	}
</style>
