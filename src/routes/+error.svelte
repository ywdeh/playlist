<script lang="ts">
	import { page } from '$app/state';
	import { link } from '#lib/link';
</script>

<div class="notice">
	<h1>{page.status === 404 ? 'Not found' : 'Oops'}</h1>
	<p>{page.error?.message}</p>
	<div class="home press" role="link" tabindex="0" {@attach link(() => '/')}>Go home</div>
</div>

<style>
	.notice {
		display: grid;
		justify-items: start;
		gap: 14px;
		padding-top: 12vh;
	}
	h1 {
		font-size: 2.6rem;
		font-weight: 600;
		letter-spacing: -0.025em;
	}
	p {
		color: var(--muted);
		font-size: 1.1rem;
	}
	.home {
		margin-top: 8px;
		padding: 12px 22px;
		border-radius: 999px;
		--press-scale: 0.94;
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 700;
		text-decoration: none;
	}
</style>
