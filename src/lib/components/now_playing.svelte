<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import Cover from './cover.svelte';
	import type { LfmScrobble } from '#lib/lastfm';
	import { player } from '#lib/player.svelte';
	import { cover_url, tint_on_hover } from '#lib/hover_tint.svelte';
	import { song_menu } from '#lib/menu.svelte';

	let { user, initial }: { user: string; initial: LfmScrobble | null } = $props();

	let latest = $state<LfmScrobble | null | undefined>(undefined);
	const shown = $derived(latest === undefined ? initial : latest);
	const track = $derived(shown?.now_playing ? shown : null);

	onMount(() => {
		const tick = async () => {
			if (document.hidden) return;
			try {
				const res = await fetch(`/api/now/${encodeURIComponent(user)}`);
				if (res.ok) latest = await res.json();
			} catch {}
		};
		const id = setInterval(tick, 20_000);
		document.addEventListener('visibilitychange', tick);
		return () => {
			clearInterval(id);
			document.removeEventListener('visibilitychange', tick);
		};
	});
</script>

{#if track}
	<section transition:fade={{ duration: 400 }}>
		{#key track.artist + track.name}
			<button
				class="now press"
				onclick={() => player.play([{ name: track.name, artist: track.artist, image: track.image }], 0)}
				{@attach tint_on_hover(() => cover_url(track.image, track.artist, track.name))}
				{@attach song_menu(() => ({
					name: track.name,
					artist: track.artist,
					play: () => player.play([{ name: track.name, artist: track.artist, image: track.image }], 0)
				}))}
			>
				<Cover src={track.image} artist={track.artist} name={track.name} />
				<div class="text">
					<span class="label"><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>Playing now</span>
					<strong class="title">{track.name}</strong>
					<span class="artist ellipsis">{track.artist}</span>
				</div>
			</button>
		{/key}
	</section>
{/if}

<style>
	.now {
		display: flex;
		align-items: center;
		gap: 24px;
		width: calc(100% + 28px);
		margin: 0 -14px;
		padding: 14px;
		border-radius: 22px;
		--press-scale: 0.985;
		animation: appear 0.5s var(--ease);
	}
	@media (hover: hover) {
		.now:hover {
			background: var(--wash);
		}
	}
	.now :global(.art) {
		flex: none;
		width: 112px;
		--art-r: 14px;
	}
	.text {
		display: grid;
		gap: 4px;
		min-width: 0;
	}
	.label {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 2px;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--accent);
	}
	.title {
		font-size: 1.5rem;
		font-weight: 650;
		letter-spacing: -0.02em;
		line-height: 1.2;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.artist {
		color: var(--muted);
	}
	.eq {
		display: inline-flex;
		align-items: flex-end;
		gap: 2px;
		height: 12px;
	}
	.eq i {
		width: 3px;
		border-radius: 2px;
		background: var(--accent);
		animation: eq 0.9s var(--ease) infinite;
	}
	.eq i:nth-child(2) {
		animation-delay: -0.3s;
	}
	.eq i:nth-child(3) {
		animation-delay: -0.6s;
	}
	@keyframes eq {
		0%,
		100% {
			height: 3px;
		}
		50% {
			height: 12px;
		}
	}
	@keyframes appear {
		from {
			opacity: 0;
		}
	}
	@media (max-width: 520px) {
		.now {
			gap: 18px;
		}
		.now :global(.art) {
			width: 88px;
		}
		.title {
			font-size: 1.25rem;
		}
	}
</style>
