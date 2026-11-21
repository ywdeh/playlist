<script lang="ts">
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
		return () => removeEventListener('scroll', close_menu, true);
	});

	function run(fn: () => void) {
		close_menu();
		fn();
	}

	function outside(e: PointerEvent) {
		if (menu.open && el && !el.contains(e.target as Node)) close_menu();
	}

	function keys(e: KeyboardEvent) {
		if (!menu.open || !el) return;
		if (e.key === 'Escape') return close_menu();
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
			style:left="{pos.x}px"
			style:top="{pos.y}px"
			oncontextmenu={(e) => e.preventDefault()}
		>
			{#each menu.items as item (item.label)}
				<button role="menuitem" onclick={() => run(item.run)}>{item.label}</button>
			{/each}
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
		border-radius: 16px;
		background: var(--surface);
		box-shadow: 0 18px 50px rgb(0 0 0 / 0.5);
		animation: menu_in 0.2s var(--ease-ui);
	}
	.menu:focus {
		outline: none;
	}
	@keyframes menu_in {
		from {
			opacity: 0;
			translate: 0 -4px;
		}
	}
	button {
		height: 44px;
		padding: 0 14px;
		border-radius: 10px;
		font-size: 0.92rem;
		font-weight: 500;
		transition:
			background-color var(--t-in) var(--ease-ui),
			color var(--t-out) var(--ease-ui);
	}
	button:hover:not(:disabled),
	button:focus-visible {
		background: var(--wash);
		outline: none;
	}
	button.looking {
		color: var(--muted);
		opacity: 0.6;
		cursor: default;
	}
</style>
