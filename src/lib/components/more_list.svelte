<script lang="ts">
	import type { Snippet } from 'svelte';
	import { T_MOVE } from '#lib/motion';

	let {
		total,
		visible = 8,
		order = 0,
		children
	}: { total: number; visible?: number; order?: number; children: Snippet } = $props();

	const PEEK = 0.6;
	const SLIDE_MS = T_MOVE;

	let extra = $state(0);
	const shown = $derived(Math.min(visible + extra, total));
	let cut = $state<number | null>(null);
	let fade = $state<number | null>(null);
	const folds = $derived(total > visible);
	const open = $derived(shown >= total);
	const label = $derived(open ? 'show less' : shown > visible ? 'show even more' : 'show more');

	function measure(box: HTMLElement) {
		const items = box.querySelectorAll<HTMLElement>('li');
		const peek = open ? undefined : items[shown];
		const last = items[shown - 1];
		cut = peek ? peek.offsetTop + peek.offsetHeight * PEEK : box.scrollHeight;
		fade = peek && last ? cut - (last.offsetTop + last.offsetHeight) + 8 : null;
		items.forEach((li, i) => (li.inert = folds && i >= shown));
	}

	function watch(box: HTMLElement) {
		void shown;
		void total;
		measure(box);
		const resize = new ResizeObserver(() => measure(box));
		for (const child of box.children) resize.observe(child);
		return () => resize.disconnect();
	}

	function hold_in_place(el: HTMLElement) {
		const at = el.getBoundingClientRect().top;
		const until = performance.now() + SLIDE_MS + 100;
		const step = () => {
			const drift = el.getBoundingClientRect().top - at;
			if (drift) window.scrollBy({ top: drift, behavior: 'instant' });
			if (performance.now() < until) requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	}

	// Step by `visible`, but don't leave a tiny last step (e.g. 24 → 25): a remainder under half a step joins this one.
	function more() {
		const next = shown + visible;
		extra = total - next < visible / 2 ? total - visible : extra + visible;
	}

	function toggle(e: MouseEvent) {
		if (!open) return more();
		hold_in_place(e.currentTarget as HTMLElement);
		extra = 0;
	}
</script>

<div class="more_list" style:--fade-to={fade !== null ? `${fade}px` : null}>
	<div
		class="fold"
		class:folds
		class:open
		style:--slide="{SLIDE_MS}ms"
		style:max-height={folds && cut !== null ? `${cut}px` : null}
		{@attach watch}
	>
		{@render children()}
	</div>
	{#if folds && !open}
		<button class="zone" tabindex="-1" aria-hidden="true" onclick={more}></button>
	{/if}
	{#if folds}
		<button class="more pill press cascade" style:--i={order} onclick={toggle} aria-expanded={open}>
			{#key label}<span class="label">{label}</span>{/key}
		</button>
	{/if}
</div>

<style>
	.fold {
		position: relative;
		margin: -6px -20px;
		padding: 6px 20px;
	}
	.folds {
		--fade: var(--fade-to, 70px);
		max-height: calc(8 * 96px + 0.6 * 88px + 6px);
		overflow: clip;
		mask-image: linear-gradient(to bottom, #000 calc(100% - var(--fade)), transparent);
		transition:
			max-height var(--slide) var(--ease),
			--fade var(--slide) var(--ease);
	}
	.more_list {
		position: relative;
	}
	.zone {
		position: absolute;
		left: -20px;
		right: -20px;
		bottom: 0;
		height: calc(var(--fade-to, 70px) + 70px);
	}
	.more_list:has(.zone:hover) .more {
		box-shadow: inset 0 0 0 999px var(--wash);
	}
	.more_list:has(.zone:active) .more {
		scale: var(--press-scale);
	}
	.folds.open {
		--fade: 0px;
	}
	@media (max-width: 720px) {
		.folds {
			max-height: calc(8 * 80px + 0.6 * 72px + 6px);
		}
	}
	.more {
		position: relative;
		margin-top: var(--gap-xl);
	}
	.label {
		animation: swap var(--t-out) var(--ease);
	}
	@keyframes swap {
		from {
			opacity: 0;
		}
	}
</style>
