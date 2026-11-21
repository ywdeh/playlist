<script lang="ts">
	import { CONTACT } from '#lib/site';
	import { out_link } from '#lib/link';
	import { reveal } from '#lib/reveal';

	const COPIED_MS = 1400;
	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout>;

	function copy() {
		navigator.clipboard.writeText(CONTACT.email).catch(() => {});
		copied = true;
		clearTimeout(timer);
		timer = setTimeout(() => (copied = false), COPIED_MS);
	}

	$effect(() => () => clearTimeout(timer));
</script>

<footer {@attach reveal}>
	<h2>{CONTACT.question}</h2>
	<div class="ways">
		<button class="way press" class:copied onclick={copy} aria-label="Copy email {CONTACT.email}">
			<span class="email">{CONTACT.email}</span>
			<span class="done" aria-hidden="true">copied</span>
		</button>
		<span class="way press" {@attach out_link(CONTACT.site.href)}>{CONTACT.site.label}</span>
	</div>
</footer>

<style>
	footer {
		margin-top: var(--section-gap);
	}
	h2 {
		margin: 0 0 12px;
	}
	.ways {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 16px;
	}
	.way {
		color: var(--muted);
		font-weight: var(--fw-ui);
		--press-scale: 0.97;
		cursor: pointer;
	}
	button.way {
		display: inline-grid;
	}
	button.way > * {
		grid-area: 1 / 1;
	}
	.email,
	.done {
		transition:
			opacity var(--t-out) var(--ease),
			filter var(--t-out) var(--ease),
			translate var(--t-out) var(--ease);
	}
	.done {
		justify-self: center;
		color: var(--accent);
		opacity: 0;
		translate: 0 6px;
	}
	.copied .email {
		opacity: var(--tone-off);
		filter: blur(4px);
	}
	.copied .done {
		opacity: 1;
		translate: 0 0;
	}
	@media (hover: hover) {
		.way:hover {
			color: var(--accent);
		}
	}
</style>
