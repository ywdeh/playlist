<script lang="ts">
	import '../app.css';
	import font from '@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2?url';
	import { navigating } from '$app/state';
	import PlayerBar from '#lib/components/player_bar.svelte';
	import ContextMenu from '#lib/components/context_menu.svelte';
	import Search from '#lib/components/search.svelte';
	import ArtistSkeleton from '#lib/components/artist_skeleton.svelte';
	import Footer from '#lib/components/footer.svelte';
	import { tint_root } from '#lib/tint.svelte';
	import { tooltips } from '#lib/tooltip.svelte';
	import { clip_fades } from '#lib/clip.svelte';
	import { artist_of, find_hero, morph, page_transitions } from '#lib/page_transition';

	/** fast loads swap straight to the page; slower ones show a placeholder first */
	const PLACEHOLDER_AFTER_MS = 150;

	let { children } = $props();
	tint_root();
	tooltips();
	clip_fades();
	page_transitions();

	const going = $derived(navigating.to ? artist_of(navigating.to.url) : null);
	let waiting = $state<{ artist: string; image: string | null } | null>(null);
	const placeholder = $derived(going && waiting?.artist === going ? waiting : null);

	$effect(() => {
		const artist = going;
		if (!artist) return void (waiting = null);
		const timer = setTimeout(() => {
			const image = find_hero(artist)?.querySelector('img')?.currentSrc || null;
			void morph(artist, () => {
				if (going !== artist) return;
				waiting = { artist, image };
				scrollTo(0, 0);
			});
		}, PLACEHOLDER_AFTER_MS);
		return () => clearTimeout(timer);
	});
</script>

<svelte:head>
	<link rel="preload" as="font" type="font/woff2" href={font} crossorigin="anonymous" />
</svelte:head>

<main>
	{#if placeholder}
		<ArtistSkeleton artist={placeholder.artist} image={placeholder.image} />
	{/if}
	<div class="page" class:hidden={!!placeholder}>
		{@render children()}
	</div>
	<Footer />
</main>

<PlayerBar />
<ContextMenu />
<Search />

<div class="edge top" aria-hidden="true"></div>
<div class="edge bottom" aria-hidden="true"></div>
<div class="grain" aria-hidden="true"></div>

<style>
	main {
		max-width: 1080px;
		margin: 0 auto;
		padding: calc(var(--gap-3xl) + env(safe-area-inset-top)) max(var(--gutter), env(safe-area-inset-right))
			calc(2 * var(--gap-3xl)) max(var(--gutter), env(safe-area-inset-left));
	}
	@media (max-width: 520px) {
		main {
			padding-top: calc(var(--gap-2xl) + env(safe-area-inset-top));
		}
	}
	.page {
		display: contents;
	}
	.page.hidden {
		display: none;
	}
	.edge {
		position: fixed;
		left: 0;
		right: 0;
		z-index: 15;
		height: 2.5rem;
		pointer-events: none;
		background: radial-gradient(75% 100% at 50% 100%, transparent 50%, color-mix(in srgb, var(--bg) 45%, transparent) 75%, var(--bg));
	}
	.top {
		top: 0;
	}
	.bottom {
		bottom: 0;
		rotate: 180deg;
	}
	.grain {
		position: fixed;
		inset: -128px;
		z-index: 100;
		pointer-events: none;
		background: url(/grain.png) repeat;
		opacity: var(--tone-grain);
		animation: grain 1s steps(1) infinite;
		will-change: translate;
	}
	@keyframes grain {
		0% { translate: 0 0; }
		12.5% { translate: -61px 37px; }
		25% { translate: 43px -89px; }
		37.5% { translate: -97px -23px; }
		50% { translate: 71px 59px; }
		62.5% { translate: -29px 101px; }
		75% { translate: 89px -47px; }
		87.5% { translate: -53px -71px; }
	}
	@media (prefers-reduced-motion: reduce) {
		.grain {
			animation: none;
		}
	}
	@media (pointer: coarse), (max-width: 720px) {
		.edge {
			display: none;
		}
	}
	@media print {
		.edge,
		.grain {
			display: none;
		}
	}
</style>
