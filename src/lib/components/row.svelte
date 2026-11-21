<script lang="ts">
	import Cover from './cover.svelte';
	import Eq from './eq.svelte';
	import { player } from '#lib/player.svelte';
	import { cover_url, tint_on_hover } from '#lib/tint.svelte';
	import { song_menu } from '#lib/menu.svelte';
	import { ago, length } from '#lib/format';
	import { clock } from '#lib/live.svelte';
	import { playable } from '#lib/playable.svelte';
	import type { Song } from '#lib/music';

	let {
		song,
		rank,
		pinned = false,
		order = 0,
		onplay
	}: {
		song: Song;
		rank?: number;
		pinned?: boolean;
		order?: number;
		onplay: () => void;
	} = $props();

	const { name, artist, image, album, duration, played } = $derived(song);
	const active = $derived(player.is_current(song));
	const muted = $derived(playable.state(song) === 'no');
	const end = $derived(played ? ago(played, clock.now) : duration ? length(duration) : '');
</script>

<li class="cascade" style:--i={order}>
	<button
		class="row press"
		class:active
		class:muted
		onclick={() => !muted && onplay()}
		aria-disabled={muted}
		title={muted ? 'not available to play' : undefined}
		{@attach playable.watch(() => song)}
		{@attach tint_on_hover(() => cover_url(image, artist, name))}
		{@attach song_menu(() => ({ name, artist, play: onplay, spotify: song.spotify, artist_spotify: song.artist_spotify }))}
	>
		{#if pinned}
			<span class="rank heart tip_anchor" aria-label="One of my favourites">
				<svg viewBox="0 0 24 24" aria-hidden="true"
					><path d="M12 20.3 10.9 19.3C6 14.9 2.9 12.1 2.9 8.6 2.9 5.9 5 3.8 7.7 3.8c1.6 0 3.2.8 4.3 2 1.1-1.2 2.7-2 4.3-2 2.7 0 4.8 2.1 4.8 4.8 0 3.5-3.1 6.3-8 10.7z" /></svg
				>
				<span class="tip" role="tooltip">one of my favourites</span>
			</span>
		{:else if rank !== undefined}
			<span class="rank">{rank}</span>
		{/if}
		<Cover src={image} {artist} {name} />
		<span class="text">
			<span class="name ellipsis">{name}</span>
			<span class="artist ellipsis">{song.credits ?? artist}</span>
		</span>
		<span class="album ellipsis">{album ?? ''}</span>
		<span class="end">
			{#if active && player.playing}
				<Eq size={16} label="Playing" />
			{:else}
				<span>{end}</span>
			{/if}
		</span>
	</button>
</li>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: 20px;
		width: 100%;
		height: 88px;
		padding: 12px 14px;
		border-radius: var(--r-lg);
		--press-scale: 0.985;
	}
	@media (hover: hover) {
		.row:hover {
			background: var(--wash);
		}
	}
	.row :global(.art) {
		height: 100%;
		width: auto;
	}
	.row > * {
		transition: opacity var(--t-move) var(--ease);
	}
	.muted > * {
		opacity: var(--tone-off);
	}
	.muted {
		cursor: default;
	}
	.rank {
		width: 1.4em;
		text-align: center;
		font-weight: var(--fw-strong);
		color: var(--muted);
		flex: none;
		font-variant-numeric: tabular-nums;
	}
	.heart {
		display: grid;
		place-items: center;
	}
	.heart svg {
		width: 16px;
		height: 16px;
		fill: none;
		stroke: currentColor;
		stroke-linejoin: round;
	}
	.heart path {
		stroke-width: 2px;
		vector-effect: non-scaling-stroke;
	}
	.text {
		display: grid;
		min-width: 0;
		flex: 1.4 1 0;
		gap: 2px;
	}
	.name {
		font-size: var(--fs-lg);
		font-weight: var(--fw-name);
	}
	.active .name {
		color: var(--accent);
	}
	.artist {
		color: var(--muted);
		font-size: var(--fs-sm);
	}
	.album {
		flex: 1 1 0;
		min-width: 0;
		color: var(--muted);
		font-size: var(--fs-sm);
	}
	.end {
		flex: none;
		width: 5.2em;
		display: flex;
		justify-content: flex-end;
		color: var(--muted);
		font-size: var(--fs-sm);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.end :global(.eq) {
		margin-right: 4px;
	}

	@media (max-width: 720px) {
		.row {
			gap: 14px;
			height: 72px;
			padding: 10px 12px;
		}
		.album {
			display: none;
		}
		.end {
			width: auto;
			min-width: 2.6em;
		}
		.name {
			font-size: var(--fs-md);
		}
	}
</style>
