<script lang="ts">
	import { CONTACT } from '#lib/site';
	import { out_link } from '#lib/link';
	import { reveal } from '#lib/reveal';
</script>

<footer {@attach reveal}>
	<h2>{CONTACT.question}</h2>
	<div class="ways">
		<span class="way press" {@attach out_link(`mailto:${CONTACT.email}`)}>{CONTACT.email}</span>
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
	@media (hover: hover) {
		.way:hover {
			color: var(--accent);
		}
	}
</style>
