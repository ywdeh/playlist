<script lang="ts">
	import Cover from './cover.svelte';
	import Row from './row.svelte';
	import type { ArtistData } from '#lib/music';
	import { player } from '#lib/player.svelte';
	import { cover_url, page_tint, tint_on_hover } from '#lib/tint.svelte';
	import { link } from '#lib/link';
	import { artist_menu } from '#lib/menu.svelte';
	import { reveal } from '#lib/reveal';

	let { data, back, who }: { data: ArtistData; back: string; who: string } = $props();

	const photo = $derived(data.image ?? cover_url(null, data.artist));
	page_tint(() => photo);

	const all = $derived([...data.yours, ...data.popular]);
	const from_here = $derived(all.some((s) => player.is_current(s)));
	const show_pause = $derived(from_here && player.playing);

	function play_all() {
		if (from_here) player.toggle();
		else player.play(all, 0);
	}
</script>

<div class="cascade" style:--i={0}>
	<div class="back press" role="link" tabindex="0" {@attach link(() => back)} aria-label="Back">
		<svg viewBox="0 0 24 24"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6z" /></svg>
	</div>
</div>

<header>
	<div
		class="identity"
		{@attach tint_on_hover(() => photo)}
		{@attach artist_menu(() => ({ artist: data.artist, spotify: data.spotify }))}
	>
		<div class="photo cascade" style:--i={1}>
			<Cover src={data.image} artist={data.artist} round />
		</div>
		<h1 class="cascade" style:--i={2}>{data.artist}</h1>
	</div>
	{#if all.length}
		<button class="play press cascade" style:--i={3} onclick={play_all} aria-label={show_pause ? 'Pause' : 'Play'}>
			{#if show_pause}
				<svg viewBox="0 0 24 24"><path d="M5 3h5v18H5zm9 0h5v18h-5z" /></svg>
			{:else}
				<svg viewBox="0 0 24 24"><path d="M7 3v18l14-9z" /></svg>
			{/if}
		</button>
	{/if}
</header>

{#if data.yours.length}
	<section {@attach reveal}>
		<h2 class="cascade" style:--i={4}>{who}'s songs</h2>
		<ul class="list">
			{#each data.yours as s, i (s.artist + s.name)}
				<Row
					song={s}
					order={5 + i}
					onplay={() => player.play(all, i)}
				/>
			{/each}
		</ul>
	</section>
{/if}

{#if data.popular.length}
	<section {@attach reveal}>
		<h2 class="cascade" style:--i={6 + data.yours.length}>popular</h2>
		<ul class="list">
			{#each data.popular as s, i (s.artist + s.name)}
				<Row
					song={s}
					order={7 + data.yours.length + i}
					onplay={() => player.play(all, data.yours.length + i)}
				/>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.back {
		display: grid;
		place-items: center;
		width: 46px;
		height: 46px;
		border-radius: 50%;
		--press-scale: 0.9;
		background: var(--surface);
		color: var(--text);
	}
	.back:hover {
		box-shadow: inset 0 0 0 999px var(--wash);
	}
	.back svg {
		width: 24px;
		height: 24px;
		fill: currentColor;
	}
	header {
		display: grid;
		justify-items: center;
		gap: 22px;
		margin: 24px 0 8px;
		text-align: center;
	}
	.identity {
		display: grid;
		justify-items: center;
		gap: 22px;
		user-select: none;
		-webkit-user-select: none;
	}
	.photo {
		width: clamp(180px, 40vw, 260px);
	}
	.photo :global(.art) {
		width: 100%;
	}
	h1 {
		overflow-wrap: anywhere;
	}
	.play {
		display: grid;
		place-items: center;
		width: 64px;
		height: 64px;
		border-radius: 50%;
		--press-scale: 0.9;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.play svg {
		width: 24px;
		height: 24px;
		fill: currentColor;
	}
	section {
		margin-top: 64px;
	}
	section ~ section {
		margin-top: var(--section-gap);
	}
	h2 {
		margin: 0 0 26px;
	}
	.list {
		list-style: none;
		display: grid;
		gap: 8px;
		margin: 0 -14px;
		padding: 0;
	}
</style>
