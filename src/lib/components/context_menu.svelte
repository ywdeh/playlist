<script lang="ts">
	import { fly } from 'svelte/transition';
	import { ease, T_IN } from '#lib/motion';
	import { close_menu, menu, spotify_link, type SpotifyTarget } from '#lib/menu.svelte';

	let el = $state<HTMLElement>();
	let pos = $state({ x: 0, y: 0 });
	let found = $state<(SpotifyTarget | undefined)[]>([]);

	$effect(() => {
		const items = menu.spotify;
		void menu.id;
		found = items.map(() => undefined);
		if (!menu.open) return;
		let live = true;
		items.forEach((q, i) =>
			spotify_link(q).then((url) => {
				if (live) found[i] = url;
			})
		);
		return () => {
			live = false;
		};
	});

	$effect(() => {
		void menu.id;
		if (!menu.open || !el) return;
		const r = el.getBoundingClientRect();
		const x = menu.x + r.width > innerWidth - 8 ? Math.max(8, menu.x - r.width) : menu.x;
		const y = menu.y + r.height > innerHeight - 8 ? Math.max(8, menu.y - r.height) : menu.y;
		pos = { x, y };
		el.focus({ preventScroll: true });
	});

	$effect(() => {
		if (!menu.open) return;
		addEventListener('scroll', close_menu, true);
		addEventListener('wheel', close_menu, { passive: true });
		document.addEventListener('visibilitychange', close_menu);
		return () => {
			removeEventListener('scroll', close_menu, true);
			removeEventListener('wheel', close_menu);
			document.removeEventListener('visibilitychange', close_menu);
		};
	});

	function run(fn: () => void) {
		close_menu();
		fn();
	}

	const COPIED_MS = 650;
	let copied = $state(false);

	$effect(() => {
		void menu.id;
		copied = false;
	});

	async function copy() {
		if (!menu.copy) return;
		await navigator.clipboard.writeText(menu.copy).catch(() => {});
		copied = true;
		const id = menu.id;
		setTimeout(() => menu.id === id && close_menu(), COPIED_MS);
	}

	function swallow(e: Event) {
		e.preventDefault();
		e.stopPropagation();
	}

	function outside(e: PointerEvent) {
		if (!menu.open || !el || el.contains(e.target as Node)) return;
		close_menu();
		if (e.button !== 0) return;
		addEventListener('click', swallow, { capture: true, once: true });
		addEventListener('pointerdown', () => removeEventListener('click', swallow, true), { capture: true, once: true });
	}

	function keys(e: KeyboardEvent) {
		if (!menu.open || !el) return;
		if (e.key === 'Escape' || e.key === 'Tab') {
			e.preventDefault();
			return close_menu();
		}
		if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
		e.preventDefault();
		const buttons = [...el.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
		const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
		const next = e.key === 'ArrowDown' ? i + 1 : i - 1;
		buttons[(next + buttons.length) % buttons.length]?.focus();
	}
</script>

<svelte:window onpointerdown={outside} onkeydown={keys} onresize={close_menu} onblur={close_menu} />

{#if menu.open}
	{#key menu.id}
		<div
			class="menu"
			role="menu"
			tabindex="-1"
			bind:this={el}
			transition:fly|global={{ y: -4, duration: T_IN, easing: ease }}
			style:left="{pos.x}px"
			style:top="{pos.y}px"
			oncontextmenu={(e) => e.preventDefault()}
		>
			{#each menu.items as item (item.label)}
				<button role="menuitem" onclick={() => run(item.run)}>{item.label}</button>
			{/each}
			{#if menu.items.length && menu.spotify.length}<div class="gap" role="separator"></div>{/if}
			{#each menu.spotify as item, i (item.label)}
				{@const to = found[i]}
				<button
					role="menuitem"
					class:looking={!to}
					disabled={!to}
					onclick={() => to && run(() => window.open(to.url, '_blank', 'noopener'))}
				>
					{to && !to.exact ? item.search_label : item.label}
				</button>
			{/each}
			{#if menu.copy}
				<div class="gap" role="separator"></div>
				<button role="menuitem" class="copy" class:copied onclick={copy}>
					{#key copied}
						<span class="swap">{copied ? 'copied' : 'copy name'}</span>
					{/key}
				</button>
			{/if}
		</div>
	{/key}
{/if}

<style>
	.menu {
		position: fixed;
		z-index: 90;
		display: grid;
		min-width: 248px;
		padding: 6px;
		border-radius: var(--r-md);
		background: var(--surface);
		box-shadow: 0 18px 50px var(--shadow);
	}
	.menu:focus {
		outline: none;
	}
	button {
		height: 44px;
		padding: 0 14px;
		border-radius: calc(var(--r-md) - 6px);
		font-size: var(--fs-sm);
		font-weight: var(--fw-ui);
		transition:
			background-color var(--t-in) var(--ease-ui),
			color var(--t-out) var(--ease-ui);
	}
	button:hover:not(:disabled),
	button:focus-visible {
		background: var(--wash);
		outline: none;
	}
	.gap {
		height: var(--rule);
		margin: 6px 10px;
		border-radius: var(--rule);
		background: var(--wash);
	}
	.copy.copied {
		color: var(--accent);
		background: var(--wash);
	}
	.swap {
		display: inline-block;
	}
	.copied .swap {
		animation: swap_in var(--t-out) var(--ease);
	}
	button.looking {
		color: var(--muted);
		opacity: var(--tone-off);
		cursor: default;
	}
</style>
