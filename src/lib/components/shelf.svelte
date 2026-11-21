<script lang="ts">
	import type { Snippet } from 'svelte';
	import { reveal } from '#lib/reveal';

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
			scroller.scrollLeft = from + (target - from) * (1 - Math.pow(1 - t, 3));
			written = scroller.scrollLeft;
			if (t < 1) frame = requestAnimationFrame(step);
			else stop();
		};
		frame = requestAnimationFrame(step);
	}

	function page(dir: 1 | -1) {
		const target = nearest(scroller.scrollLeft + dir * scroller.clientWidth * 0.8);
		glide_to(target, 520);
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
			if (!down) return;
			const dx = e.clientX - start_x;
			if (!moved && Math.abs(dx) > 6) {
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
			if (!moved) return glide_to(nearest(el.scrollLeft), 300);
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
					<svg viewBox="0 0 24 24"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6z" /></svg>
				</button>
				<button class="arrow press" onclick={() => page(1)} disabled={at_end} aria-label="Scroll forward">
					<svg viewBox="0 0 24 24"><path d="M8.6 16.6 10 18l6-6-6-6-1.4 1.4 4.6 4.6z" /></svg>
				</button>
			</div>
		{/if}
	</header>
	<div class="shelf" bind:this={scroller} onscroll={measure} {@attach drag}>
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
	h2 {
		font-size: 1.5rem;
		font-weight: 650;
		letter-spacing: -0.02em;
		line-height: 1.2;
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
		opacity: 0.35;
		cursor: default;
	}
	.arrow svg {
		width: 22px;
		height: 22px;
		fill: currentColor;
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
		mask-image: linear-gradient(
			to right,
			transparent,
			#000 var(--gutter),
			#000 calc(100% - var(--gutter)),
			transparent
		);
		scroll-snap-type: x mandatory;
		scroll-padding-inline: var(--gutter);
	}
	.shelf > :global(*) {
		scroll-snap-align: start;
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
		user-select: none;
	}
	.shelf:global(.dragging) :global(.press) {
		--press-scale: 1;
	}
</style>
