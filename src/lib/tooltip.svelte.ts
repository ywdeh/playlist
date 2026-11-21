const EDGE = 8;
const PRESS_MS = 1600;

function place(anchor: Element) {
	const tip = anchor.querySelector<HTMLElement>(':scope > .tip');
	if (!tip) return;
	tip.style.setProperty('--nudge', '0px');
	tip.classList.remove('flip');
	const r = tip.getBoundingClientRect();
	const shift = r.left < EDGE ? EDGE - r.left : r.right > innerWidth - EDGE ? innerWidth - EDGE - r.right : 0;
	tip.style.setProperty('--nudge', `${Math.round(shift)}px`);
	if (r.top < EDGE) tip.classList.add('flip');
}

export function tooltips() {
	$effect(() => {
		let pressed: Element | null = null;
		let timer: ReturnType<typeof setTimeout>;

		const release = () => {
			clearTimeout(timer);
			pressed?.classList.remove('tip_show');
			pressed = null;
		};
		const enter = (e: Event) => {
			const anchor = (e.target as Element).closest?.('.tip_anchor');
			if (anchor) place(anchor);
		};
		const press = (e: PointerEvent) => {
			const anchor = (e.target as Element).closest?.('.tip_anchor');
			if (anchor === pressed) return;
			release();
			if (!anchor || e.pointerType === 'mouse') return;
			place(anchor);
			anchor.classList.add('tip_show');
			pressed = anchor;
			timer = setTimeout(release, PRESS_MS);
		};

		document.addEventListener('pointerover', enter);
		document.addEventListener('focusin', enter);
		document.addEventListener('pointerdown', press);
		addEventListener('scroll', release, { passive: true });
		return () => {
			release();
			document.removeEventListener('pointerover', enter);
			document.removeEventListener('focusin', enter);
			document.removeEventListener('pointerdown', press);
			removeEventListener('scroll', release);
		};
	});
}
