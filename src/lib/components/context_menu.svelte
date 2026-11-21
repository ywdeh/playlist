<script lang="ts">
	import { fly } from 'svelte/transition';
	import { ease, T_IN } from '#lib/motion';
	import { close_menu, menu, open_spotify } from '#lib/menu.svelte';

	let el = $state<HTMLElement>();
	let pos = $state({ x: 0, y: 0 });

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
		addEventListener('scroll', scrolled, true);
		addEventListener('wheel', close_menu, { passive: true });
		document.addEventListener('visibilitychange', close_menu);
		return () => {
			removeEventListener('scroll', scrolled, true);
			removeEventListener('wheel', close_menu);
			document.removeEventListener('visibilitychange', close_menu);
		};
	});

	const scrolled = () => !menu.held && close_menu();

	const ENABLED = '[role="menuitem"]:not(:disabled, [aria-disabled="true"])';
	let armed: HTMLElement | null = null;

	function arm(next: HTMLElement | null) {
		if (next === armed) return;
		armed?.removeAttribute('data-armed');
		next?.setAttribute('data-armed', '');
		armed = next;
	}

	$effect(() => {
		if (!menu.open || !menu.held) return;
		const aim = (x: number, y: number) => {
			const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>(ENABLED);
			arm(hit && el?.contains(hit) ? hit : null);
		};
		const release = () => {
			const pick = armed;
			arm(null);
			menu.held = false;
			if (pick) pick.click();
			else close_menu();
		};
		const touch_move = (e: TouchEvent) => e.preventDefault();
		const touch_end = (e: TouchEvent) => {
			e.preventDefault();
			menu.held = false;
		};
		const mouse_move = (e: PointerEvent) => e.pointerType === 'mouse' && aim(e.clientX, e.clientY);
		const mouse_up = (e: PointerEvent) => {
			if (e.pointerType !== 'mouse') return;
			release();
			addEventListener('click', swallow, { capture: true, once: true });
			setTimeout(() => removeEventListener('click', swallow, true));
		};
		addEventListener('touchmove', touch_move, { capture: true, passive: false });
		addEventListener('touchend', touch_end, { capture: true, passive: false });
		addEventListener('touchcancel', touch_end, { capture: true, passive: false });
		addEventListener('pointermove', mouse_move, true);
		addEventListener('pointerup', mouse_up, true);
		return () => {
			removeEventListener('touchmove', touch_move, true);
			removeEventListener('touchend', touch_end, true);
			removeEventListener('touchcancel', touch_end, true);
			removeEventListener('pointermove', mouse_move, true);
			removeEventListener('pointerup', mouse_up, true);
			arm(null);
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
		const buttons = [...el.querySelectorAll<HTMLElement>(ENABLED)];
		const i = buttons.indexOf(document.activeElement as HTMLElement);
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
				<button class="item" role="menuitem" onclick={() => run(item.run)}>{item.label}</button>
			{/each}
			{#if menu.items.length && menu.spotify.length}<div class="gap" role="separator"></div>{/if}
			{#each menu.spotify as item (item.label)}
				<button class="item" role="menuitem" onclick={() => run(() => open_spotify(item))}>
					{item.url ? item.label : item.search_label}
				</button>
			{/each}
			{#if menu.copy}
				<div class="gap" role="separator"></div>
				<button class="item copy" role="menuitem" class:copied onclick={copy}>
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
	.item {
		display: flex;
		align-items: center;
		height: 44px;
		padding: 0 14px;
		border-radius: calc(var(--r-md) - 6px);
		font-size: var(--fs-sm);
		font-weight: var(--fw-ui);
		transition:
			background-color var(--t-in) var(--ease-ui),
			color var(--t-out) var(--ease-ui);
	}
	.item:hover,
	.item:focus-visible,
	.menu :global(.item[data-armed]) {
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
	}</style>
