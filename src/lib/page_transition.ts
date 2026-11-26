import { onNavigate } from '$app/navigation';
import { tick } from 'svelte';

/** the view-transition-name an artist photo gets while it moves between pages */
const HERO = 'hero';
const ARTIST_PATH = /^\/artist\/([^/]+)\/?$/;

export function artist_of(url: URL | null | undefined) {
	const m = url?.pathname.match(ARTIST_PATH);
	if (!m) return null;
	try {
		return decodeURIComponent(m[1]);
	} catch {
		return null;
	}
}

function in_view(el: Element) {
	const r = el.getBoundingClientRect();
	return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
}

/** the closest sideways-scrolling box around el, like the top artists shelf */
function side_scroller(el: HTMLElement) {
	for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
		if (/auto|scroll/.test(getComputedStyle(p).overflowX) && p.scrollWidth > p.clientWidth) return p;
	}
	return null;
}

/** scrolls el's shelf, without animation, so el sits at the shelf's start rather than under its edge fade */
function bring_into_shelf(el: HTMLElement) {
	const shelf = side_scroller(el);
	if (!shelf) return;
	const box = shelf.getBoundingClientRect();
	const r = el.getBoundingClientRect();
	const style = getComputedStyle(shelf);
	const start = box.left + (parseFloat(style.paddingLeft) || 0);
	const end = box.right - (parseFloat(style.paddingRight) || 0);
	if (r.left >= start - 1 && r.right <= end + 1) return;
	shelf.scrollLeft += r.left - start;
}

/**
 * An on-screen photo of this artist, marked with data-hero.
 * With `scroll`, a photo off to the side of its shelf is scrolled into place first.
 */
export function find_hero(artist: string | null, scroll = false) {
	if (!artist) return null;
	const want = artist.toLowerCase();
	for (const el of document.querySelectorAll<HTMLElement>('[data-hero]')) {
		if (el.dataset.hero?.toLowerCase() !== want) continue;
		if (scroll) {
			const r = el.getBoundingClientRect();
			if (r.width && r.bottom > 0 && r.top < innerHeight) bring_into_shelf(el);
		}
		if (in_view(el)) return el;
	}
	return null;
}

function name(el: HTMLElement | null, on: boolean) {
	if (el) el.style.viewTransitionName = on ? HERO : '';
}

function can_morph() {
	return 'startViewTransition' in document && !matchMedia('(prefers-reduced-motion: reduce)').matches;
}

let running: ViewTransition | null = null;

/**
 * Skips the new page's staggered entrance: under a crossfade it would leave the page
 * mostly blank and fill in afterwards. The crossfade and the moving photo are the entrance.
 */
function show_settled() {
	for (const el of document.querySelectorAll('.cascade')) {
		for (const a of el.getAnimations()) {
			if (a instanceof CSSAnimation && a.animationName === 'cascade_in') a.finish();
		}
	}
	// sections below the fold were hidden while the page was built at the top;
	// once the scroll position is restored, the ones on screen show without fading
	for (const el of document.querySelectorAll<HTMLElement>('.reveal_wait')) {
		const r = el.getBoundingClientRect();
		if (r.bottom <= 0 || r.top >= innerHeight) continue;
		el.style.transition = 'none';
		el.classList.remove('reveal_wait');
		void el.offsetHeight;
		el.style.transition = '';
	}
}

/**
 * Runs `update` inside a view transition. The page crossfades, and if this
 * artist's photo is on screen before and after, it flies from one spot to the other.
 */
export function morph(artist: string | null, update: () => unknown): Promise<void> {
	if (!can_morph()) return Promise.resolve(update()).then(() => {});
	running?.skipTransition();
	const root = document.documentElement;
	const from = find_hero(artist);
	let to: HTMLElement | null = null;
	name(from, true);
	// the crossfade blends the old page's colours into the new ones, so the tint can switch at once
	root.classList.add('morphing');
	const vt = document.startViewTransition(async () => {
		await update();
		await tick();
		// sveltekit restores the scroll position just after the page updates; the photo is found from there
		await new Promise((r) => setTimeout(r));
		show_settled();
		name(from, false);
		to = find_hero(artist, true);
		name(to, true);
	});
	running = vt;
	vt.ready.catch(() => {});
	vt.finished
		.catch(() => {})
		.finally(() => {
			name(from, false);
			name(to, false);
			if (running === vt) {
				running = null;
				root.classList.remove('morphing');
			}
		});
	return vt.updateCallbackDone.catch(() => {});
}

export function page_transitions() {
	onNavigate((nav) => {
		if (!can_morph() || !nav.to || nav.from?.url.pathname === nav.to.url.pathname) return;
		const artist = artist_of(nav.to.url) ?? artist_of(nav.from?.url);
		return new Promise<void>((resolve) => {
			void morph(artist, async () => {
				resolve();
				await nav.complete;
			});
		});
	});
}
