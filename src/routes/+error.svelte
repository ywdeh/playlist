<script lang="ts">
	import { page } from '$app/state';
	import { link } from '#lib/link';
</script>

<div class="notice">
	<h1>{page.status === 404 ? 'not found' : 'oops'}</h1>
	<p>{page.error?.message}</p>
	<div class="home pill press" role="link" tabindex="0" {@attach link(() => '/')}>go home</div>
</div>

<style>
	.notice {
		display: grid;
		justify-items: start;
		gap: var(--gap-md);
		padding-top: 12vh;
	}
	p {
		color: var(--muted);
		font-size: var(--fs-lg);
	}
	.home {
		margin-top: var(--gap-sm);
		background: var(--accent);
		color: var(--accent-ink);
	}
</style>
