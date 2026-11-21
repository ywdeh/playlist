<script lang="ts">
	import Home from '#lib/components/home.svelte';
	import { OWNER_INTRO, OWNER_NAME } from '#lib/site';

	let { data } = $props();
</script>

<svelte:head>
	<title>{OWNER_NAME}</title>
	<meta name="description" content={OWNER_INTRO.join(' ')} />
</svelte:head>

<Home {data} title={OWNER_NAME} intro={OWNER_INTRO} playlist={data.playlist} />
