<script lang="ts">
	import { fly } from 'svelte/transition';
	import { beforeNavigate, goto } from '$app/navigation';
	import { typing } from '#lib/keys';
	import { ease_in, settle, T_MOVE, T_OUT } from '#lib/motion';
	import Cover from './cover.svelte';
	import Eq from './eq.svelte';
	import { catalog, search } from '#lib/catalog.svelte';
	import { player } from '#lib/player.svelte';
	import { artist_menu, artist_path, close_menu, song_menu } from '#lib/menu.svelte';
	import type { Artist, Song } from '#lib/music';
	import { length } from '#lib/format';

	let query = $state('');
	let active = $state(0);
	let input = $state<HTMLInputElement>();
	let list = $state<HTMLElement>();
	let returned_to: HTMLElement | null = null;

	const found = $derived.by(() => {
		void catalog.size;
		return catalog.search(query);
	});
	type Hit = { kind: 'artist'; artist: Artist } | { kind: 'song'; song: Song; at: number };
	const hits = $derived<Hit[]>([
		...found.artists.map((artist) => ({ kind: 'artist' as const, artist })),
		...found.songs.map((song, at) => ({ kind: 'song' as const, song, at }))
	]);

	$effect(() => {
		void query;
		active = 0;
	});

	$effect(() => {
		if (!search.open) return;
		returned_to = document.activeElement as HTMLElement | null;
		input?.focus();
		input?.select();
		// blocks page scrolling without hiding the scrollbar, which would shift the page sideways
		const hold = (e: Event) => {
			if (!(e.target as Element | null)?.closest?.('.results')) e.preventDefault();
		};
		const opts = { capture: true, passive: false };
		addEventListener('wheel', hold, opts);
		addEventListener('touchmove', hold, opts);
		return () => {
			removeEventListener('wheel', hold, opts);
			removeEventListener('touchmove', hold, opts);
			returned_to?.focus?.({ preventScroll: true });
		};
	});

	beforeNavigate(() => {
		search.open = false;
	});

	/** fades the backdrop's dim and blur themselves: fading its opacity drops the blur until the fade ends */
	function veil(_: Element, { duration }: { duration: number }) {
		return {
			duration,
			css: (t: number) => `background-color: color-mix(in srgb, var(--bg) ${(t * 70).toFixed(1)}%, transparent); backdrop-filter: blur(${(t * 6).toFixed(2)}px);`
		};
	}

	function window_keys(e: KeyboardEvent) {
		if (e.defaultPrevented) return;
		const combo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
		if (combo || (e.key === '/' && !search.open && !typing(e) && !e.ctrlKey && !e.metaKey && !e.altKey)) {
			e.preventDefault();
			close_menu();
			search.open = combo ? !search.open : true;
		}
	}

	function keys(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			if (query) query = '';
			else search.open = false;
			return;
		}
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			if (!hits.length) return;
			active = (active + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length;
			list?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
			return;
		}
		if (e.key === 'Enter' && hits[active]) {
			e.preventDefault();
			pick(hits[active]);
		}
	}

	function pick(hit: Hit) {
		if (hit.kind === 'artist') {
			search.open = false;
			void goto(artist_path(hit.artist.name));
		} else {
			player.play(found.songs, hit.at);
		}
	}
</script>

<svelte:window onkeydown={window_keys} />

{#if search.open}
	<div class="backdrop" transition:veil={{ duration: T_OUT }} onpointerdown={() => (search.open = false)} aria-hidden="true"></div>
	<div
		class="panel"
		role="dialog"
		aria-modal="true"
		aria-label="Search"
		tabindex="-1"
		onkeydown={keys}
		in:fly={{ y: -48, duration: T_MOVE, easing: settle }}
		out:fly={{ y: -32, duration: T_OUT, easing: ease_in }}
	>
		<label class="field">
			<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m15.5 15.5 4 4" /></svg>
			<input
				bind:this={input}
				bind:value={query}
				type="search"
				placeholder="songs and artists"
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
				enterkeyhint="go"
				role="combobox"
				aria-expanded={hits.length > 0}
				aria-controls="search_results"
				aria-activedescendant={hits.length ? `search_hit_${active}` : undefined}
			/>
			<button type="button" class="close press" onclick={() => (search.open = false)} aria-label="Close search">
				<kbd>esc</kbd>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg>
			</button>
		</label>

		{#if hits.length}
			<ul class="results" id="search_results" role="listbox" bind:this={list}>
				{#each hits as hit, i (hit.kind === 'artist' ? `a:${hit.artist.name}` : `s:${hit.song.artist}:${hit.song.name}`)}
					{#if hit.kind === 'artist'}
						<!-- svelte-ignore a11y_click_events_have_key_events (the search field handles the keys) -->
						<li
							id="search_hit_{i}"
							data-i={i}
							class="hit press"
							class:active={i === active}
							role="option"
							aria-selected={i === active}
							onpointermove={() => (active = i)}
							onclick={() => pick(hit)}
							{@attach artist_menu(() => ({ artist: hit.artist.name, spotify: hit.artist.spotify }))}
						>
							<Cover src={hit.artist.image} artist={hit.artist.name} round />
							<span class="text">
								<span class="name ellipsis">{hit.artist.name}</span>
								<span class="sub">artist</span>
							</span>
						</li>
					{:else}
						{@const s = hit.song}
						<!-- svelte-ignore a11y_click_events_have_key_events (the search field handles the keys) -->
						<li
							id="search_hit_{i}"
							data-i={i}
							class="hit press"
							class:active={i === active}
							class:current={player.is_current(s)}
							role="option"
							aria-selected={i === active}
							onpointermove={() => (active = i)}
							onclick={() => pick(hit)}
							{@attach song_menu(() => ({
								name: s.name,
								artist: s.artist,
								play: () => pick(hit),
								spotify: s.spotify,
								artist_spotify: s.artist_spotify
							}))}
						>
							<Cover src={s.image} artist={s.artist} name={s.name} />
							<span class="text">
								<span class="name ellipsis">{s.name}</span>
								<span class="sub ellipsis">{s.credits ?? s.artist}</span>
							</span>
							{#if player.is_current(s) && player.playing}
								<Eq size={16} label="Playing" />
							{:else if s.duration}
								<span class="len">{length(s.duration)}</span>
							{/if}
						</li>
					{/if}
				{/each}
			</ul>
		{:else if query.trim()}
			<p class="note">nothing here matches “{query.trim()}”<br /><span>search only covers what’s been on the pages you’ve opened</span></p>
		{:else}
			<p class="note">find a song or artist from these pages<br /><span>↑ ↓ to move, enter to play or open</span></p>
		{/if}
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 80;
		background: color-mix(in srgb, var(--bg) 70%, transparent);
		backdrop-filter: blur(6px);
	}
	.panel {
		position: fixed;
		z-index: 81;
		top: max(12svh, env(safe-area-inset-top));
		left: 50%;
		translate: -50% 0;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		width: min(560px, calc(100vw - 2 * var(--gap-md)));
		max-height: min(640px, 76svh);
		padding: var(--gap-sm);
		border-radius: var(--r-lg);
		background: var(--surface);
		box-shadow: 0 24px 70px var(--shadow);
	}
	.panel:focus {
		outline: none;
	}
	.field {
		display: flex;
		align-items: center;
		gap: var(--gap-md);
		height: 56px;
		padding: 0 var(--gap-sm) 0 var(--gap-md);
		border-radius: var(--r-md);
		background: var(--wash);
		color: var(--muted);
	}
	.field > svg,
	.close svg {
		flex: none;
		width: var(--icon);
		height: var(--icon);
		fill: none;
		stroke: currentColor;
		stroke-width: var(--stroke);
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	input {
		flex: 1;
		min-width: 0;
		height: 100%;
		border: 0;
		background: none;
		color: var(--text);
		font: inherit;
		font-size: var(--fs-md);
		outline: none;
	}
	input::placeholder {
		color: var(--muted);
	}
	input::-webkit-search-cancel-button {
		display: none;
	}
	.close {
		display: flex;
		align-items: center;
		height: var(--control-sm);
		padding: 0 var(--gap-sm);
		border-radius: var(--r-pill);
		color: var(--muted);
	}
	.close svg {
		display: none;
	}
	kbd {
		padding: 2px 8px;
		border-radius: 6px;
		background: var(--wash);
		font: inherit;
		font-size: var(--fs-xs);
	}
	@media (pointer: coarse) {
		kbd {
			display: none;
		}
		.close svg {
			display: block;
		}
	}
	@media (hover: hover) {
		.close:hover {
			color: var(--text);
		}
	}
	.results {
		list-style: none;
		display: grid;
		align-content: start;
		gap: 2px;
		margin: var(--gap-sm) 0 0;
		padding: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.hit {
		display: flex;
		align-items: center;
		gap: var(--gap-md);
		height: 64px;
		padding: var(--gap-sm);
		border-radius: var(--r-md);
		cursor: pointer;
		--press-scale: 0.985;
	}
	.hit.active {
		background: var(--wash);
	}
	.hit :global(.art) {
		height: 100%;
		width: auto;
	}
	.text {
		display: grid;
		flex: 1;
		min-width: 0;
		gap: 2px;
	}
	.name {
		font-weight: var(--fw-name);
	}
	.current .name {
		color: var(--accent);
	}
	.sub {
		color: var(--muted);
		font-size: var(--fs-sm);
	}
	.hit :global(.eq) {
		margin-right: var(--gap-sm);
	}
	.len {
		flex: none;
		margin-right: var(--gap-sm);
		color: var(--muted);
		font-size: var(--fs-sm);
		font-variant-numeric: tabular-nums;
	}
	.note {
		padding: var(--gap-xl) var(--gap-md) var(--gap-lg);
		color: var(--text);
		font-size: var(--fs-sm);
		line-height: 1.6;
		text-align: center;
	}
	.note span {
		color: var(--muted);
	}
	@media (max-width: 520px) {
		.panel {
			top: max(var(--gap-md), env(safe-area-inset-top));
			max-height: calc(100svh - 2 * var(--gap-md));
		}
	}
</style>
