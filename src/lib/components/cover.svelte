<script lang="ts">
	import { warm_tint } from '#lib/cover_tint';

	let {
		src,
		artist,
		name,
		round = false
	}: { src: string | null; artist?: string; name?: string; round?: boolean } = $props();

	const url = $derived(
		src ?? (artist ? `/api/art?${new URLSearchParams(name ? { artist, name } : { artist, v: '3' })}` : null)
	);
	let loaded = $state(false);
	let failed = $state(false);

	$effect(() => {
		void url;
		loaded = false;
		failed = false;
	});

	function show() {
		loaded = true;
		if (url) warm_tint(url);
	}
</script>

<span class="art" class:round role="presentation" oncontextmenu={(e) => e.preventDefault()}>
	{#if url && !failed}
		<img
			src={url}
			alt=""
			loading="lazy"
			draggable="false"
			decoding="async"
			class:loaded
			onload={show}
			onerror={() => (failed = true)}
			{@attach (img: HTMLImageElement) => {
				if (img.complete && img.naturalWidth) show();
			}}
		/>
	{/if}
</span>

<style>
	.art {
		display: block;
		position: relative;
		flex: none;
		overflow: hidden;
		--art-r: var(--r-sm);
		border-radius: var(--art-r);
		background: var(--surface-2);
		aspect-ratio: 1;
	}
	.round {
		--art-r: var(--r-pill);
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0;
		transition: opacity var(--t-move) var(--ease);
	}
	img.loaded {
		opacity: 1;
	}
</style>
