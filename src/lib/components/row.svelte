<script lang="ts">
	import Cover from './cover.svelte';
	import { player } from '#lib/player.svelte';
	import { cover_url, tint_on_hover } from '#lib/hover_tint.svelte';
	import { song_menu } from '#lib/menu.svelte';
	import { length } from '#lib/format';

	let {
		name,
		artist,
		image,
		album,
		duration,
		rank,
		pinned = false,
		meta,
		order = 0,
		spotify,
		onplay
	}: {
		name: string;
		artist: string;
		image: string | null;
		album?: string | null;
		duration?: number | null;
		rank?: number;
		pinned?: boolean;
		meta?: string;
		order?: number;
		spotify?: string;
		onplay: () => void;
	} = $props();

	const active = $derived(player.is_current({ name, artist }));
	const end = $derived(meta ?? (duration ? length(duration) : ''));
</script>

<li class="cascade" style:--i={order}>
	<button class="row press" class:active onclick={onplay} {@attach tint_on_hover(() => cover_url(image, artist, name))}
		{@attach song_menu(() => ({ name, artist, play: onplay, spotify }))}
	>
		{#if pinned}
			<span class="rank heart tip_anchor" aria-label="One of my favourites">
				<svg viewBox="0 0 24 24" aria-hidden="true"
					><path d="M12 20.3 10.9 19.3C6 14.9 2.9 12.1 2.9 8.6 2.9 5.9 5 3.8 7.7 3.8c1.6 0 3.2.8 4.3 2 1.1-1.2 2.7-2 4.3-2 2.7 0 4.8 2.1 4.8 4.8 0 3.5-3.1 6.3-8 10.7z" /></svg
				>
				<span class="tip" role="tooltip">One of my favourites</span>
			</span>
		{:else if rank !== undefined}
			<span class="rank">{rank}</span>
		{/if}
		<Cover src={image} {artist} {name} />
		<span class="text">
			<span class="name ellipsis">{name}</span>
			<span class="artist ellipsis">{artist}</span>
		</span>
		<span class="album ellipsis">{album ?? ''}</span>
		<span class="end">
			{#if active && player.playing}
				<span class="eq" aria-label="Playing"><i></i><i></i><i></i></span>
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
		border-radius: 18px;
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
	.rank {
		width: 1.4em;
		text-align: center;
		font-weight: 600;
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
		font-size: 1.08em;
		font-weight: 600;
	}
	.active .name {
		color: var(--accent);
	}
	.artist {
		color: var(--muted);
		font-size: 0.92em;
	}
	.album {
		flex: 1 1 0;
		min-width: 0;
		color: var(--muted);
		font-size: 0.92em;
	}
	.end {
		flex: none;
		width: 5.2em;
		display: flex;
		justify-content: flex-end;
		color: var(--muted);
		font-size: 0.9em;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.eq {
		display: inline-flex;
		align-items: flex-end;
		gap: 3px;
		height: 16px;
		margin-right: 4px;
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
			height: 4px;
		}
		50% {
			height: 16px;
		}
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
			font-size: 1em;
		}
	}
</style>
