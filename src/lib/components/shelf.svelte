<script lang="ts">
	import { ease, T_MOVE, T_OUT } from '#lib/motion';
	import type { Snippet } from 'svelte';
	import { reveal } from '#lib/reveal';
	import { HOLD_SLOP, menu } from '#lib/menu.svelte';

	let { title, order = 0, children }: { title: string; order?: number; children: Snippet } = $props();

	let scroller: HTMLDivElement;
	let at_start = $state(true);
	let at_end = $state(true);

	let frame = 0;
	let animating = false;
	let dragging = false;

	let measuring = 0;
	function measure() {
		if (measuring) return;
		measuring = requestAnimationFrame(() => {
			measuring = 0;
			at_start = scroller.scrollLeft <= 2;
			at_end = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 2;
		});
	}

	const free = (on: boolean) => scroller.classList.toggle('free', on);

	function stop() {
		cancelAnimationFrame(frame);
		animating = false;
		if (!dragging && !holding) free(false);
	}
	let holding = false;

	function stops() {
		const pad = parseFloat(getComputedStyle(scroller).paddingLeft) || 0;
		const max = scroller.scrollWidth - scroller.clientWidth;
		const list = [...scroller.children].map((c) => Math.min(max, Math.max(0, (c as HTMLElement).offsetLeft - pad)));
		return [...new Set([...list, max])];
	}

	function nearest(x: number) {
		return stops().reduce((best, s) => (Math.abs(s - x) < Math.abs(best - x) ? s : best), 0);
	}

	function glide_to(target: number, duration: number) {
		cancelAnimationFrame(frame);
		free(true);
		const from = scroller.scrollLeft;
		if (Math.abs(target - from) < 1) return stop();
		let start = -1;
		let written = from;
		animating = true;
		const step = (now: number) => {
			if (Math.abs(scroller.scrollLeft - written) > 2) return stop();
			if (start < 0) start = now;
			const t = Math.min(1, Math.max(0, (now - start) / duration));
			scroller.scrollLeft = from + (target - from) * ease(t);
			written = scroller.scrollLeft;
			if (t < 1) frame = requestAnimationFrame(step);
			else stop();
		};
		frame = requestAnimationFrame(step);
	}

	function page(dir: 1 | -1) {
		const target = nearest(scroller.scrollLeft + dir * scroller.clientWidth * 0.8);
		glide_to(target, T_MOVE);
	}

	function drag(el: HTMLDivElement) {
		let start_x = 0;
		let start_left = 0;
		let down = false;
		let moved = false;
		let velocity = 0;
		let last_x = 0;
		let last_t = 0;

		const on_down = (e: PointerEvent) => {
			if (e.pointerType !== 'mouse' || e.button !== 0) return;
			cancelAnimationFrame(frame);
			animating = false;
			free(true);
			down = holding = true;
			moved = false;
			velocity = 0;
			start_x = last_x = e.clientX;
			last_t = e.timeStamp;
			start_left = el.scrollLeft;
		};
		const on_move = (e: PointerEvent) => {
			if (!down || menu.held) return;
			const dx = e.clientX - start_x;
			if (!moved && Math.abs(dx) > HOLD_SLOP) {
				moved = dragging = true;
				free(true);
				el.setPointerCapture(e.pointerId);
				el.classList.add('dragging');
			}
			if (!moved) return;
			el.scrollLeft = start_left - dx;
			const dt = e.timeStamp - last_t;
			if (dt > 0) {
				velocity = 0.8 * ((last_x - e.clientX) / dt) + 0.2 * velocity;
				last_x = e.clientX;
				last_t = e.timeStamp;
			}
		};
		const on_up = (e: PointerEvent) => {
			if (!down) return;
			down = dragging = holding = false;
			el.classList.remove('dragging');
			if (!moved) return glide_to(nearest(el.scrollLeft), T_OUT);
			const v = e.timeStamp - last_t > 80 ? 0 : velocity;
			const target = nearest(el.scrollLeft + v * 220);
			const dist = Math.abs(target - el.scrollLeft);
			const duration = Math.abs(v) > 0.05 ? (3 * dist) / Math.abs(v) : 380;
			glide_to(target, Math.min(900, Math.max(320, duration)));
		};
		const on_click = (e: MouseEvent) => {
			if (moved) {
				e.preventDefault();
				e.stopPropagation();
				moved = false;
			}
		};

		el.addEventListener('pointerdown', on_down);
		el.addEventListener('pointermove', on_move);
		el.addEventListener('pointerup', on_up);
		el.addEventListener('pointercancel', on_up);
		el.addEventListener('click', on_click, true);
		el.addEventListener('wheel', stop, { passive: true });
		el.addEventListener('touchstart', stop, { passive: true });

		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => {
			stop();
			el.removeEventListener('pointerdown', on_down);
			el.removeEventListener('pointermove', on_move);
			el.removeEventListener('pointerup', on_up);
			el.removeEventListener('pointercancel', on_up);
			el.removeEventListener('click', on_click, true);
			el.removeEventListener('wheel', stop);
			el.removeEventListener('touchstart', stop);

			ro.disconnect();
			cancelAnimationFrame(measuring);
		};
	}
</script>

<section class="cascade" style:--i={order} {@attach reveal}>
	<header>
		<h2>{title}</h2>
		{#if !(at_start && at_end)}
			<div class="arrows">
				<button class="arrow press" onclick={() => page(-1)} disabled={at_start} aria-label="Scroll back">
					<svg viewBox="0 0 24 24"><path d="M14 7l-5 5 5 5" /></svg>
				</button>
				<button class="arrow press" onclick={() => page(1)} disabled={at_end} aria-label="Scroll forward">
					<svg viewBox="0 0 24 24"><path d="M10 7l5 5-5 5" /></svg>
				</button>
			</div>
		{/if}
	</header>
	<div class="shelf" class:start={at_start} class:end={at_end} bind:this={scroller} onscroll={measure} {@attach drag}>
		{@render children()}
	</div>
</section>

<style>
	section {
		margin-top: var(--section-gap);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 26px;
	}
	.arrows {
		display: none;
		gap: 8px;
	}
	@media (hover: hover) and (pointer: fine) {
		.arrows {
			display: flex;
		}
	}
	.arrow {
		display: grid;
		place-items: center;
		width: 42px;
		height: 42px;
		border-radius: 50%;
		background: var(--surface);
		--press-scale: 0.9;
	}
	.arrow:hover:not(:disabled) {
		box-shadow: inset 0 0 0 999px var(--wash);
	}
	.arrow:disabled:active {
		scale: none;
	}
	.arrow:disabled {
		opacity: var(--tone-off);
		cursor: default;
	}
	.arrow svg {
		width: 24px;
		height: 24px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2px;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.shelf {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: clamp(150px, 22vw, 196px);
		gap: 28px;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		position: relative;
		scrollbar-width: none;
		margin: -8px calc(-1 * var(--gutter)) -8px;
		padding: 8px var(--gutter) 14px;
		cursor: grab;
		--fade-start: var(--gutter);
		--fade-end: var(--gutter);
		mask-image: linear-gradient(
			to right,
			#0000,
			#0001 calc(var(--fade-start) * 0.3),
			#0005 calc(var(--fade-start) * 0.55),
			#000b calc(var(--fade-start) * 0.8),
			#000 var(--fade-start),
			#000 calc(100% - var(--fade-end)),
			#000b calc(100% - var(--fade-end) * 0.8),
			#0005 calc(100% - var(--fade-end) * 0.55),
			#0001 calc(100% - var(--fade-end) * 0.3),
			#0000
		);
		transition:
			--fade-start var(--t-move) var(--ease),
			--fade-end var(--t-move) var(--ease);		scroll-snap-type: x mandatory;
		scroll-padding-inline: var(--gutter);
	}
	.shelf > :global(*) {
		scroll-snap-align: start;
	}
	.shelf.start {
		--fade-start: 0px;
	}
	.shelf.end {
		--fade-end: 0px;
	}
	.shelf:global(.free) {
		scroll-snap-type: none;
	}
	@media (max-width: 520px) {
		.shelf {
			grid-auto-columns: 38vw;
			gap: 16px;
		}
	}
	.shelf::-webkit-scrollbar {
		display: none;
	}
	.shelf:global(.dragging) {
		cursor: grabbing;
	}
	.shelf:global(.dragging) :global(.press) {
		--press-scale: 1;
	}
</style>
