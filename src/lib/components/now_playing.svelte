<script lang="ts">
	import { fade } from 'svelte/transition';
	import { EASE_CSS, T_IN, T_MOVE, T_OUT } from '#lib/motion';
	import Cover from './cover.svelte';
	import Eq from './eq.svelte';
	import type { Live } from '#lib/music';
	import { player } from '#lib/player.svelte';
	import { cover_url, live_tint, tint_on_hover } from '#lib/tint.svelte';
	import { song_menu } from '#lib/menu.svelte';
	import { length } from '#lib/format';
	import { clock } from '#lib/live.svelte';

	let { initial }: { initial: Live | null } = $props();

	let track = $derived(initial);
	live_tint(() => (track ? cover_url(track.image, track.artist, track.name) : null));

	const PLAYING_MS = 15_000;
	const IDLE_MS = 30_000;
	const SOON_MS = 2_000;
	const END_SLACK_MS = 1_500;
	const END_GRACE_MS = 6_000;

	let checked = $state(0);

	function wait_for(t: Live | null) {
		if (!t?.length) return t ? PLAYING_MS : IDLE_MS;
		const left = t.started + t.length + END_SLACK_MS - Date.now();
		if (left > 0) return Math.max(Math.min(left, PLAYING_MS), SOON_MS);
		return left > -END_GRACE_MS ? SOON_MS : PLAYING_MS;
	}

	async function check() {
		const res = await fetch('/api/now').catch(() => null);
		if (res?.ok) track = await res.json();
		checked++;
	}

	$effect(() => {
		void checked;
		let due = false;
		const timer = setTimeout(() => (document.hidden ? (due = true) : check()), wait_for(track));
		const back = () => !document.hidden && due && check();
		document.addEventListener('visibilitychange', back);
		return () => {
			clearTimeout(timer);
			document.removeEventListener('visibilitychange', back);
		};
	});

	let anchor = 0;
	const started = $derived.by(() => {
		const at = track?.started ?? 0;
		if (Math.abs(at - anchor) > 2000) anchor = at;
		return anchor;
	});

	const elapsed = $derived(track?.length ? Math.min(Math.max(clock.now - started, 0), track.length) : 0);

	const GLIDE_MS = T_MOVE;
	let shown: { el: HTMLElement; done: number } | null = null;

	const clip = (done: number) => `inset(0 ${(1 - done) * 100}% 0 0 round var(--bar))`;
	const read_done = (el: HTMLElement) => 1 - parseFloat(getComputedStyle(el).clipPath.split(' ')[1] ?? '100') / 100;

	function progress(el: HTMLElement) {
		const length = track?.length ?? 0;
		if (!length || !started) return;
		const left = Math.max(length - (Date.now() - started), 0);
		const done = 1 - left / length;
		const glide = Math.min(GLIDE_MS / Math.max(left, 1), 1);
		const from = shown?.el === el ? shown.done : done;
		const motion = el.animate(
			[
				{ clipPath: clip(from), easing: EASE_CSS },
				{ clipPath: clip(Math.min(done + GLIDE_MS / length, 1)), offset: glide, easing: 'linear' },
				{ clipPath: clip(1) }
			],
			{ duration: left, fill: 'forwards' }
		);
		return () => {
			shown = { el, done: read_done(el) };
			motion.cancel();
		};
	}
</script>

{#if track}
	{@const song = track}
	<section transition:fade={{ duration: T_MOVE }}>
		{#key song.artist + song.name}
			<button
				class="now press"
				in:fade={{ duration: T_MOVE, delay: T_IN }}
				out:fade={{ duration: T_OUT }}
				onclick={() => player.play([song], 0)}
				{@attach tint_on_hover(() => cover_url(song.image, song.artist, song.name))}
				{@attach song_menu(() => ({
					name: song.name,
					artist: song.artist,
					spotify: song.spotify,
					artist_spotify: song.artist_spotify,
					play: () => player.play([song], 0)
				}))}
			>
				<Cover src={song.image} artist={song.artist} name={song.name} />
				<div class="text">
					<span class="label"><Eq size={13} />i'm listening to</span>
					<strong class="title ellipsis">{song.name}</strong>
					<span class="artist ellipsis">{song.credits ?? song.artist}</span>
					{#if song.length}
						<span class="seek" aria-hidden="true">
							<span class="time">{length(elapsed / 1000)}</span>
							<span class="bar"><span class="fill" {@attach progress}></span></span>
							<span class="time">{length(song.length / 1000)}</span>
						</span>
					{/if}
				</div>
			</button>
		{/key}
	</section>
{/if}

<style>
	section {
		display: grid;
	}
	.now {
		grid-area: 1 / 1;
		display: flex;
		align-items: center;
		gap: 24px;
		width: calc(100% + 28px);
		margin: 0 -14px;
		padding: 14px;
		border-radius: var(--r-lg);
		--press-scale: 0.985;
	}
	@media (hover: hover) {
		.now:hover {
			background: var(--wash);
		}
	}
	.now :global(.art) {
		flex: none;
		width: 112px;
		--art-r: var(--r-md);
	}
	.text {
		flex: 1;
		display: grid;
		gap: 4px;
		min-width: 0;
	}
	.label {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 2px;
		font-size: var(--fs-sm);
		font-weight: var(--fw-strong);
		color: var(--accent);
	}
	.title {
		font-size: var(--fs-xl);
		font-weight: var(--fw-name);
		letter-spacing: -0.02em;
		line-height: 1.3;
	}
	.artist {
		color: var(--muted);
	}
	.seek {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-top: 10px;
	}
	.time {
		min-width: 2.6em;
		color: var(--muted);
		font-size: var(--fs-xs);
		font-variant-numeric: tabular-nums;
	}
	.time:last-child {
		text-align: right;
	}
	.bar {
		flex: 1;
		height: var(--bar);
		border-radius: var(--bar);
		background: var(--tint);
	}
	.fill {
		display: block;
		height: 100%;
		background: var(--accent);
		clip-path: inset(0 100% 0 0 round var(--bar));
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
