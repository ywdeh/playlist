<script lang="ts">
	import '../app.css';
	import font from '@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2?url';
	import PlayerBar from '#lib/components/player_bar.svelte';
	import ContextMenu from '#lib/components/context_menu.svelte';
	import Footer from '#lib/components/footer.svelte';

	import { page } from '$app/state';

	let { children } = $props();
	const bare = $derived(page.route.id === '/listen');
</script>

<svelte:head>
	<link rel="preload" as="font" type="font/woff2" href={font} crossorigin="anonymous" />
</svelte:head>

<main>
	{@render children()}
	{#if !bare}<Footer />{/if}
</main>

{#if !bare}
	<PlayerBar />
	<ContextMenu />
{/if}

<div class="grain" aria-hidden="true"></div>

<style>
	main {
		max-width: 1080px;
		margin: 0 auto;
		padding: 48px var(--gutter) 96px;
	}
	@media (max-width: 520px) {
		main {
			padding-top: 32px;
		}
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
	@media print {
		.grain {
			display: none;
		}
	}
</style>
