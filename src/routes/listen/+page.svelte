<script lang="ts">
	import { onMount } from 'svelte';

	let done = $state(false);

	onMount(() => {
		const params = new URLSearchParams(location.search);
		const channel = new BroadcastChannel('spotify_auth');
		channel.postMessage({ code: params.get('code'), state: params.get('state'), error: params.get('error') });
		channel.close();
		done = true;
		window.close();
	});
</script>

<svelte:head><title>Spotify</title></svelte:head>

<p>{done ? 'All set. You can close this window.' : 'Connecting'}</p>

<style>
	p {
		margin-top: 30vh;
		text-align: center;
		color: var(--muted);
	}
</style>
