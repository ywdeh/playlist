<script lang="ts">
	import { fade, fly, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Cover from './cover.svelte';
	import { player } from '#lib/player.svelte';
	import { cover_tint, known_tint } from '#lib/cover_tint';
	import { hover_tint, tint_on_hover } from '#lib/hover_tint.svelte';
	import { length } from '#lib/format';
	import { link } from '#lib/link';
	import { artist_path, song_menu } from '#lib/menu.svelte';
	import type { Repeat } from '#lib/player.svelte';
	import { spotify } from '#lib/spotify.svelte';

	const REPEAT_LABEL: Record<Repeat, string> = { off: 'Repeat this song', one: 'Repeating this song' };
	const song_item = () => {
		const c = player.current;
		return { name: c?.name ?? shown_name, artist: c?.artist ?? shown_artist, play: () => player.toggle() };
	};

	const shown_name = $derived(player.current?.name ?? player.track?.name ?? '');
	const shown_artist = $derived(player.current?.artist ?? player.track?.artist ?? '');

	async function full_songs() {
		await spotify.connect(player.volume);
		if (spotify.error) player.message = spotify.error;
		else player.upgrade();
	}
	const cover = $derived(player.current?.image ?? player.track?.cover ?? null);
	const pct = $derived(player.duration ? (player.time / player.duration) * 100 : 0);

	const shown_cover = $derived(!player.loading && player.track ? cover : undefined);
	const tint_src = $derived.by(() => {
		if (!player.current) return null;
		if (shown_cover === undefined) return undefined;
		const { name, artist } = player.current;
		return shown_cover ?? `/api/art?${new URLSearchParams({ artist, name })}`;
	});
	$effect(() => {
		const src = hover_tint.src ?? (tint_src === null ? hover_tint.page : tint_src);
		if (src === undefined) return;
		const root = document.documentElement;
		const apply = (c: string | null) => {
			if (c) root.style.setProperty('--mist', c);
			else root.style.removeProperty('--mist');
		};
		if (!src) return apply(null);
		const known = known_tint(src);
		if (known !== undefined) return apply(known);
		let live = true;
		cover_tint(src).then((c) => live && apply(c));
		return () => {
			live = false;
		};
	});

	let scrub = $state<number | null>(null);
	const shown_pct = $derived(scrub !== null ? scrub * 100 : pct);
	const shown_time = $derived(scrub !== null ? scrub * player.duration : player.time);

	const at = (e: PointerEvent, el: HTMLElement) => {
		const r = el.getBoundingClientRect();
		return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
	};
	function scrub_start(e: PointerEvent) {
		if (e.button !== 0 || !player.duration) return;
		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);
		scrub = at(e, el);
	}
	function scrub_move(e: PointerEvent) {
		if (scrub !== null) scrub = at(e, e.currentTarget as HTMLElement);
	}
	function scrub_end(e: PointerEvent) {
		if (scrub === null) return;
		const to = at(e, e.currentTarget as HTMLElement);
		scrub = null;
		player.seek(to);
	}
	function scrub_cancel() {
		scrub = null;
	}
	function seek_key(e: KeyboardEvent) {
		if (e.key === 'ArrowRight') player.seek((player.time + 5) / player.duration);
		if (e.key === 'ArrowLeft') player.seek((player.time - 5) / player.duration);
	}
</script>

{#if player.current || player.message}
	<div class="dock" transition:fly={{ y: 100, duration: 450 }}>
		<div class="player" role="region" aria-label="Player">
			{#key cover}
				<span
					class="cover press"
					in:fade={{ duration: 300 }}
					aria-label="Go to {shown_artist}"
					{@attach link(() => artist_path(shown_artist))}
					{@attach tint_on_hover(() => cover)}
					{@attach song_menu(() => song_item())}
				><Cover src={cover} /></span>
			{/key}
			<div class="body">
				<div class="row">
					<div class="text" {@attach song_menu(() => song_item())}>
						<span class="title ellipsis" {@attach link(() => artist_path(shown_artist))}>{shown_name}</span>
						{#if player.message}
							<span class="sub ellipsis">{player.message}</span>
						{:else if player.loading}
							<span class="sub ellipsis">Loading</span>
						{:else}
							<span class="sub artist ellipsis" {@attach link(() => artist_path(shown_artist))}>{player.current?.credits ?? shown_artist}</span>
						{/if}
					</div>
					<div class="controls">
						<button class="icon press prev" onclick={() => player.prev()} aria-label="Previous" disabled={!player.current}>
							<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></svg>
						</button>
						<button class="icon main press" onclick={() => player.toggle()} aria-label={player.playing ? 'Pause' : 'Play'} disabled={!player.track}>
							{#if player.loading}
								<span class="spin" aria-hidden="true"></span>
							{:else if player.playing}
								<svg viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zm6.5 0H17v14h-3.5z" /></svg>
							{:else}
								<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" /></svg>
							{/if}
						</button>
						<button class="icon press" onclick={() => player.next()} aria-label="Next" disabled={!player.has_next}>
							<svg viewBox="0 0 24 24"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" /></svg>
						</button>
						<button
							class="icon press repeat tip_anchor"
							class:on={player.repeat !== 'off'}
							onclick={() => player.cycle_repeat()}
							aria-label={REPEAT_LABEL[player.repeat]}
							aria-pressed={player.repeat !== 'off'}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<path class="line" d="M4 11V9.5A3.5 3.5 0 0 1 7.5 6H18m-3-3 3 3-3 3M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H6m3 3-3-3 3-3" />
							</svg>
							<span class="tip" role="tooltip">{REPEAT_LABEL[player.repeat]}</span>
						</button>
						{#if spotify.supported && !spotify.ready}
							<button
								class="full press tip_anchor"
								onclick={full_songs}
								disabled={spotify.status === 'connecting'}
								aria-describedby="full_songs_tip"
							>
								{spotify.status === 'connecting' ? 'Connecting' : 'Full songs'}
								<span class="tip" role="tooltip" id="full_songs_tip">Sign in with Spotify Premium</span>
							</button>
						{/if}
						<button class="icon press close" onclick={() => player.close()} aria-label="Close player">
							<svg viewBox="0 0 24 24"><path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6z" /></svg>
						</button>
					</div>
				</div>
				<div class="seek">
					<span class="time">{length(Math.floor(shown_time))}</span>
					<div
						class="progress"
						class:scrubbing={scrub !== null}
						role="slider"
						tabindex="0"
						aria-label="Seek"
						aria-valuemin={0}
						aria-valuemax={Math.round(player.duration)}
						aria-valuenow={Math.round(shown_time)}
						onpointerdown={scrub_start}
						onpointermove={scrub_move}
						onpointerup={scrub_end}
						onpointercancel={scrub_cancel}
						onlostpointercapture={scrub_cancel}
						onkeydown={seek_key}
					>
						<span class="fill" style:scale="{shown_pct / 100} 1"></span>
						<span class="head" style:translate="{shown_pct}% 0"><span class="knob"></span></span>
					</div>
					<span class="time">{player.duration ? length(player.duration) : '0:00'}</span>
				</div>
			</div>
		</div>
	</div>
	<div class="spacer" aria-hidden="true" transition:slide={{ duration: 450, easing: cubicOut }}></div>
{/if}

<style>
	.dock {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 20;
		padding: 0 12px max(12px, env(safe-area-inset-bottom));
		pointer-events: none;
	}
	.player {
		pointer-events: auto;
		display: flex;
		align-items: center;
		gap: 18px;
		max-width: calc(1080px - 2 * var(--gutter) + 28px);
		margin: 0 auto;
		padding: 12px 16px 12px 12px;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--surface) 92%, transparent);
		backdrop-filter: blur(24px);
		box-shadow: 0 18px 50px rgb(0 0 0 / 0.45);
	}
	.spacer {
		height: 120px;
	}
	.cover {
		display: block;
		flex: none;
		width: 72px;
	}
	.cover :global(.art) {
		--art-r: 12px;
	}
	.body {
		display: grid;
		flex: 1;
		min-width: 0;
		gap: 6px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 16px;
		min-width: 0;
	}
	.text {
		display: flex;
		align-items: baseline;
		flex: 1;
		min-width: 0;
		gap: 12px;
	}
	.text > * {
		flex: 0 1 auto;
		min-width: 0;
	}
	.text > .sub {
		flex-shrink: 2;
		min-width: 4em;
	}
	.title {
		justify-self: start;
		max-width: 100%;
		font-weight: 600;
		font-size: 1.04em;
		line-height: 1.3;
	}
	.sub {
		justify-self: start;
		max-width: 100%;
		color: var(--muted);
		font-size: 0.9em;
	}
	.title,
	.artist {
		transition: color var(--t-out) var(--ease-ui);
	}
	@media (hover: hover) {
		.title:hover {
			color: var(--accent);
			transition-duration: var(--t-in);
		}
		.artist:hover {
			color: var(--text);
			transition-duration: var(--t-in);
		}
	}
	.cover {
		cursor: pointer;
		--press-scale: 0.94;
	}
	.icon.repeat svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 2px;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.icon.repeat.on {
		background: var(--accent);
		color: var(--accent-ink);
	}
	.controls {
		display: flex;
		align-items: center;
		gap: 4px;
		flex: none;
	}
	.icon {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		--press-scale: 0.9;
		color: var(--text);
	}
	@media (hover: hover) {
		.icon:hover:not(:disabled):not(.main):not(.on) {
			background: var(--wash);
		}
	}
	.icon:disabled:active {
		scale: none;
	}
	.icon:disabled {
		opacity: 0.3;
		cursor: default;
	}
	.icon svg {
		width: 22px;
		height: 22px;
		fill: currentColor;
	}
	.icon.main {
		width: 46px;
		height: 46px;
		margin: 0 4px;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.full {
		flex: none;
		height: 36px;
		margin: 0 4px;
		padding: 0 16px;
		border-radius: 999px;
		--press-scale: 0.94;
		background: var(--tint);
		font-weight: 600;
		font-size: 0.85rem;
		white-space: nowrap;
	}
	@media (hover: hover) {
		.full:hover:not(:disabled) {
			box-shadow: inset 0 0 0 999px var(--wash);
		}
	}
	.full:disabled {
		color: var(--muted);
		cursor: default;
	}
	.close svg {
		width: 18px;
		height: 18px;
	}
	.seek {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.time {
		flex: none;
		min-width: 2.6em;
		color: var(--muted);
		font-size: 0.8rem;
		font-variant-numeric: tabular-nums;
	}
	.time:last-child {
		text-align: right;
	}
	.progress {
		position: relative;
		flex: 1;
		height: 4px;
		border-radius: 4px;
		background: var(--tint);
		cursor: pointer;
	}
	.progress::before {
		content: '';
		position: absolute;
		inset: -10px 0;
	}
	.fill {
		position: absolute;
		inset: 0;
		border-radius: 4px;
		background: var(--accent);
		transform-origin: left;
		transition: scale 0.25s linear;
	}
	.head {
		position: absolute;
		inset: 0;
		pointer-events: none;
		transition: translate 0.25s linear;
	}
	.knob {
		position: absolute;
		left: 0;
		top: 50%;
		width: 12px;
		height: 12px;
		margin: -6px 0 0 -6px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.4);
		scale: 0;
		transition: scale var(--t-out) var(--ease-ui);
	}
	.progress:hover .knob,
	.progress:focus-visible .knob,
	.scrubbing .knob {
		scale: 1;
		transition-duration: var(--t-in);
	}
	.scrubbing .fill,
	.scrubbing .head {
		transition: none;
	}
	.progress {
		touch-action: none;
	}
	.spin {
		width: 18px;
		height: 18px;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (max-width: 520px) {
		.player {
			gap: 12px;
			padding: 10px 12px 10px 10px;
		}
		.cover {
			width: 60px;
		}
		.row {
			gap: 8px;
		}
		.close,
		.prev {
			display: none;
		}
		.icon.main {
			margin: 0;
		}
	}
</style>
