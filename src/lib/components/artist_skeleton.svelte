<script lang="ts">
	import Cover from './cover.svelte';

	let { artist, image = null }: { artist: string; image?: string | null } = $props();

	const ROWS = 6;
</script>

<div class="skeleton" aria-busy="true" aria-label="Loading {artist}">
	<div class="top">
		<span class="circle back"></span>
		<span class="circle small"></span>
	</div>

	<header>
		<div class="photo"><Cover src={image} {artist} round hero={artist} /></div>
		<h1>{artist}</h1>
		<span class="circle play shimmer"></span>
	</header>

	<section>
		<span class="heading shimmer"></span>
		<ul>
			{#each { length: ROWS }, i (i)}
				<li style:--i={i}>
					<span class="cover shimmer"></span>
					<span class="lines">
						<span class="line shimmer"></span>
						<span class="line short shimmer"></span>
					</span>
				</li>
			{/each}
		</ul>
	</section>
</div>

<style>
	.skeleton {
		animation: swap_in var(--t-out) var(--ease) backwards;
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.circle {
		display: block;
		border-radius: var(--r-pill);
		background-color: var(--surface);
	}
	.back {
		width: var(--control-lg);
		height: var(--control-lg);
	}
	.small {
		width: var(--control-sm);
		height: var(--control-sm);
		background-color: transparent;
	}
	header {
		display: grid;
		justify-items: center;
		gap: var(--gap-xl);
		margin: var(--gap-xl) 0 var(--gap-sm);
		text-align: center;
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
		width: 64px;
		height: 64px;
	}
	section {
		margin-top: var(--gap-4xl);
	}
	.heading {
		display: block;
		width: 9em;
		height: 1.5rem;
		margin-bottom: var(--gap-xl);
		border-radius: var(--r-sm);
	}
	ul {
		list-style: none;
		display: grid;
		gap: var(--gap-sm);
		margin: 0;
		padding: 0;
	}
	li {
		display: flex;
		align-items: center;
		gap: var(--gap-xl);
		height: 88px;
		padding: var(--gap-md) 0;
		opacity: calc(1 - var(--i) * 0.14);
	}
	.cover {
		height: 100%;
		aspect-ratio: 1;
		border-radius: var(--r-sm);
	}
	.lines {
		display: grid;
		gap: var(--gap-sm);
		flex: 1;
	}
	.line {
		height: 0.9rem;
		width: min(16em, 60%);
		border-radius: var(--r-pill);
	}
	.line.short {
		width: min(9em, 35%);
		height: 0.75rem;
	}
	@media (max-width: 720px) {
		li {
			gap: var(--gap-md);
			height: 72px;
			padding: var(--gap-sm) 0;
		}
	}
</style>
