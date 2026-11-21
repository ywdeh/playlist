<script lang="ts">
	import Artist from '#lib/components/artist.svelte';

	let { data } = $props();
</script>

<svelte:head><title>{data.artist}</title></svelte:head>

<Artist {data} back="/u/{encodeURIComponent(data.user)}" who={data.user} />
