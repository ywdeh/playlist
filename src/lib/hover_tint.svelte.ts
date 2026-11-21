let src = $state<string | null>(null);
let page = $state<string | null>(null);

export const hover_tint = {
	get src() {
		return src;
	},
	get page() {
		return page;
	}
};

export function page_tint(picture: () => string | null) {
	$effect(() => {
		const p = picture();
		page = p;
		return () => {
			if (page === p) page = null;
		};
	});
}

const REST = 120;

let current: HTMLElement | null = null;
const covers = new WeakMap<HTMLElement, () => string | null>();
let rest_timer: ReturnType<typeof setTimeout> | undefined;

function settle() {
	src = current ? (covers.get(current)?.() ?? null) : null;
}

function moved() {
	clearTimeout(rest_timer);
	rest_timer = setTimeout(settle, REST);
}

function watch() {
	if (typeof window === 'undefined' || watch.on) return;
	watch.on = true;
	addEventListener(
		'pointermove',
		(e) => {
			if (e.pointerType === 'mouse') moved();
		},
		{ passive: true }
	);
	addEventListener('scroll', moved, { capture: true, passive: true });
}
watch.on = false;

export function tint_on_hover(cover: () => string | null) {
	return (el: HTMLElement) => {
		watch();
		covers.set(el, cover);
		const enter = (e: PointerEvent) => {
			if (e.pointerType !== 'mouse') return;
			current = el;
			moved();
		};
		const leave = (e: PointerEvent) => {
			if (e.pointerType !== 'mouse') return;
			if (current === el) current = null;
			moved();
		};
		el.addEventListener('pointerenter', enter);
		el.addEventListener('pointerleave', leave);
		return () => {
			el.removeEventListener('pointerenter', enter);
			el.removeEventListener('pointerleave', leave);
			if (current === el) {
				current = null;
				moved();
			}
		};
	};
}
export const cover_url = (image: string | null, artist: string, name?: string) =>
	image ?? `/api/art?${new URLSearchParams(name ? { artist, name } : { artist, v: '3' })}`;
