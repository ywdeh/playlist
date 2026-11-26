<script lang="ts">
	import type { Insights, Period } from '#lib/music';

	/** while the paragraph is still being written, ask again this often, a few times; after that it stays hidden */
	const RETRY_MS = 30_000;
	const TRIES = 6;

	let { period, order = 0 }: { period: Period; order?: number } = $props();

	const loaded = new Map<Period, string>();
	let text = $state<string | null>(null);

	$effect(() => {
		const p = period;
		const hit = loaded.get(p);
		if (hit) return void (text = hit);
		let gone = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let tries = 0;
		const load = async () => {
			tries++;
			try {
				const res = await fetch(`/api/insights?period=${p}`);
				const next = res.ok ? ((await res.json()) as Insights) : null;
				if (gone) return;
				if (next?.ready && next.text) {
					loaded.set(p, next.text);
					text = next.text;
				} else if (tries < TRIES) timer = setTimeout(load, RETRY_MS);
			} catch {}
		};
		void load();
		return () => {
			gone = true;
			clearTimeout(timer);
		};
	});
</script>

{#if text}
	{#key text}
		<p class="insight cascade" style:--i={order}>
			{text}
			<span class="tag tip_anchor" tabindex="0" aria-describedby="insight_ai"
				>(ai summarized)<span class="tip wide" role="tooltip" id="insight_ai"
					>summarized by ai from my top songs and what their lyrics are about</span
				></span
			>
		</p>
	{/key}
{/if}

<style>
	.insight {
		max-width: 34em;
		margin-top: var(--gap-2xl);
		color: var(--muted);
		font-size: var(--fs-md);
		line-height: 1.6;
		text-wrap: pretty;
	}
	.tag {
		margin-left: 0.25em;
		font-size: var(--fs-xs);
		color: color-mix(in srgb, var(--muted) 70%, transparent);
		white-space: nowrap;
		cursor: default;
	}</style>
