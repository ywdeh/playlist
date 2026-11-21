<script lang="ts">
	import Home from '#lib/components/home.svelte';

	let { data } = $props();
</script>

<svelte:head><title>{data.user}</title></svelte:head>

<Home {data} title={data.user} base="/u/{encodeURIComponent(data.user)}" />
