<script lang="ts">
	import type { Insights, Period } from '#lib/music';
	import { fold } from '#lib/fold';

	/** while the paragraph is still being written, ask again this often; after the last try it's hidden */
	const RETRY_MS = 3_000;
	const TRIES = 15;
	/** "summarizing…" stays at least this long, so it's read before the words take its place */
	const MIN_THINK_MS = 1_400;
	const PLACEHOLDER = 'summarizing…';

	let { period }: { period: Period } = $props();

	const loaded = new Map<Period, string>();
	let phase = $state<'thinking' | 'ready' | 'none'>('thinking');
	let text = $state<string | null>(null);
	const words = $derived(text?.split(' ') ?? []);

	$effect(() => {
		const p = period;
		let gone = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let tries = 0;
		const since = performance.now();

		// another time range's words must never stand in for this one's
		text = null;
		phase = 'thinking';

		const show = (next: string) => {
			timer = setTimeout(
				() => {
					text = next;
					phase = 'ready';
				},
				Math.max(0, MIN_THINK_MS - (performance.now() - since))
			);
		};
		const load = async () => {
			tries++;
			try {
				const res = await fetch(`/api/insights?period=${p}`);
				const next = res.ok ? ((await res.json()) as Insights) : null;
				if (gone) return;
				if (next?.ready && next.text) {
					loaded.set(p, next.text);
					return show(next.text);
				}
			} catch {}
			if (gone) return;
			if (tries < TRIES) timer = setTimeout(load, RETRY_MS);
			else phase = 'none';
		};

		const hit = loaded.get(p);
		if (hit) show(hit);
		else void load();
		return () => {
			gone = true;
			clearTimeout(timer);
		};
	});
</script>

<div class="fold" {@attach fold}>
	<div>
		{#if phase !== 'none'}
			<p class="insight cascade" aria-live="polite">
				<span class="sr">{phase === 'ready' ? text : PLACEHOLDER}</span>
				{#if phase === 'ready'}
					<!-- "summarizing…" leaves the way the words arrive, in the same spot as the first word, so it reads as being replaced -->
					<span class="leaving" aria-hidden="true">{PLACEHOLDER}</span>
					<span aria-hidden="true">
						{#each words as word, i (i)}{i ? ' ' : ''}<span class="word" style:--w={i}>{word}</span>{/each}
					</span>				{:else}
					<span class="thinking" aria-hidden="true">{PLACEHOLDER}</span>
				{/if}
			</p>
		{/if}
	</div>
</div>

<style>
	.fold {
		transition: height var(--t-move) var(--ease);
	}
	/* keeps the paragraph's gap inside, so the gap folds in and out with it */
	.fold > div {
		display: flow-root;
	}
	.insight {
		position: relative;
		margin-top: var(--gap-lg);
		/* room for three lines from the start, so "summarizing…" and most summaries take the same space */
		min-height: 3lh;
	}
	/* the same shine as the loading placeholders (.shimmer in app.css), drawn on the letters:
	   white with the page's tint, which follows the cover art */
	.thinking,
	.leaving {
		color: transparent;
		background-color: var(--muted);
		background-image: linear-gradient(
			100deg,
			transparent 30%,
			color-mix(in oklab, var(--text), var(--mist) calc(var(--tone-line) * 100%)) 50%,
			transparent 70%
		);
		background-size: 200% 100%;
		background-repeat: no-repeat;
		background-clip: text;
		-webkit-background-clip: text;
		animation: shimmer 1.6s var(--ease-ui) infinite;
	}
	.leaving {
		position: absolute;
		top: 0;
		left: 0;
		pointer-events: none;
		animation:
			shimmer 1.6s var(--ease-ui) infinite,
			leave var(--t-reveal) var(--ease) forwards;
	}
	@keyframes leave {
		to {
			opacity: 0;
			filter: blur(6px);
		}
	}
	.word {
		display: inline-block;
		animation: appear var(--t-reveal) var(--ease) backwards;
		animation-delay: calc(var(--w) * 60ms);
	}
	@keyframes appear {
		from {
			opacity: 0;
			filter: blur(6px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.word {
			animation-delay: 0ms;
		}
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
