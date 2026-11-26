<script lang="ts">
	import Artist from '#lib/components/artist.svelte';
	import { OWNER_NAME } from '#lib/site';

	let { data } = $props();
</script>

<svelte:head><title>hedwy's music ({data.artist})</title></svelte:head>

<Artist {data} back="/" who={OWNER_NAME} />
