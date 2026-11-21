<script lang="ts">
	let { size = 16, label }: { size?: number; label?: string } = $props();
</script>

<svg
	class="eq"
	viewBox="0 0 15 {size}"
	width="15"
	height={size}
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
>
	{#each [0, 4, 8, 12] as x, i}
		<rect {x} y="0" width="3" height={size} rx="1.5" style:--i={i} />
	{/each}
</svg>

<style>
	.eq {
		display: block;
		flex: none;
		overflow: visible;
		fill: var(--accent);
	}
	rect {
		transform-box: fill-box;
		transform-origin: bottom;
		animation-timing-function: ease-in-out;
		animation-iteration-count: infinite;
		animation-direction: alternate;
	}
	rect:nth-child(1) {
		animation-name: one;
		animation-duration: 0.74s;
	}
	rect:nth-child(2) {
		animation-name: two;
		animation-duration: 0.92s;
		animation-delay: -0.4s;
	}
	rect:nth-child(3) {
		animation-name: three;
		animation-duration: 0.66s;
		animation-delay: -0.2s;
	}
	rect:nth-child(4) {
		animation-name: four;
		animation-duration: 1.04s;
		animation-delay: -0.6s;
	}
	@keyframes one {
		0% { transform: scaleY(0.3); }
		40% { transform: scaleY(0.9); }
		70% { transform: scaleY(0.5); }
		100% { transform: scaleY(1); }
	}
	@keyframes two {
		0% { transform: scaleY(1); }
		35% { transform: scaleY(0.35); }
		65% { transform: scaleY(0.75); }
		100% { transform: scaleY(0.25); }
	}
	@keyframes three {
		0% { transform: scaleY(0.5); }
		50% { transform: scaleY(1); }
		100% { transform: scaleY(0.3); }
	}
	@keyframes four {
		0% { transform: scaleY(0.25); }
		30% { transform: scaleY(0.6); }
		60% { transform: scaleY(0.35); }
		100% { transform: scaleY(0.85); }
	}
	@media (prefers-reduced-motion: reduce) {
		rect {
			animation: none;
			transform: scaleY(0.6);
		}
	}
</style>
