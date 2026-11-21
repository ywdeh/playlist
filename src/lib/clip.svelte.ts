const SELECTOR = '.ellipsis';

export function clip_fades() {
	$effect(() => {
		const check = (el: Element) => el.toggleAttribute('data-clipped', el.scrollWidth > el.clientWidth + 1);
		const sizes = new ResizeObserver((entries) => {
			for (const e of entries) check(e.target);
		});
		const each = (node: Node, fn: (el: Element) => void) => {
			if (!(node instanceof Element)) return;
			if (node.matches(SELECTOR)) fn(node);
			for (const el of node.querySelectorAll(SELECTOR)) fn(el);
		};
		const owner = (node: Node) => (node instanceof Element ? node : node.parentElement)?.closest(SELECTOR);
		const changes = new MutationObserver((records) => {
			for (const r of records) {
				for (const n of r.addedNodes) each(n, (el) => sizes.observe(el));
				for (const n of r.removedNodes) each(n, (el) => sizes.unobserve(el));
				const el = owner(r.target);
				if (el) check(el);
			}
		});
		each(document.body, (el) => sizes.observe(el));
		changes.observe(document.body, { subtree: true, childList: true, characterData: true });
		document.fonts.ready.then(() => document.querySelectorAll(SELECTOR).forEach(check));
		return () => {
			sizes.disconnect();
			changes.disconnect();
		};
	});
}
