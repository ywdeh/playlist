<script lang="ts">
	import { search } from '#lib/catalog.svelte';
</script>

<button type="button" class="search press tip_anchor" aria-label="Search" aria-keyshortcuts="/ Control+K" onclick={() => (search.open = true)}>
	<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m15.5 15.5 4 4" /></svg>
	<span class="tip end" role="tooltip">search <kbd>/</kbd></span>
</button>

<style>
	.search {
		flex: none;
		display: grid;
		place-items: center;
		width: var(--control-sm);
		height: var(--control-sm);
		border-radius: var(--r-pill);
		color: var(--muted);
		--press-scale: 0.9;
	}
	@media (hover: hover) {
		.search:hover {
			color: var(--text);
			background: var(--wash);
		}
	}
	svg {
		width: var(--icon);
		height: var(--icon);
		fill: none;
		stroke: currentColor;
		stroke-width: var(--stroke);
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
