import { cover_tint, known_tint } from './cover_tint';

const HOVER_IN_MS = 150;
const HOVER_OUT_MS = 400;

let hover = $state<string | null>(null);
let playing = $state<string | null | undefined>(null);
let page = $state<string | null>(null);
let live = $state<string | null>(null);

function layer(set: (p: string | null) => void, get: () => string | null) {
	return (picture: () => string | null) => {
		$effect(() => {
			const p = picture();
			set(p);
			return () => {
				if (get() === p) set(null);
			};
		});
	};
}

export const page_tint = layer(
	(p) => (page = p),
	() => page
);
export const live_tint = layer(
	(p) => (live = p),
	() => live
);

export function playing_tint(picture: () => string | null | undefined) {
	$effect(() => {
		playing = picture();
		return () => (playing = null);
	});
}

let painted: string | null = null;

function paint(colour: string | null) {
	if (colour === painted) return;
	painted = colour;
	const root = document.documentElement;
	if (colour) root.style.setProperty('--mist', colour);
	else root.style.removeProperty('--mist');
}

export function tint_root() {
	$effect(() => {
		const hovered = hover;
		const base = playing === undefined ? undefined : (playing ?? page ?? live);
		const src = hovered ?? base;
		if (src === undefined) return;
		if (src === null) return paint(null);
		const settle = (colour: string | null) => {
			if (colour || !hovered) paint(colour);
		};
		const known = known_tint(src);
		if (known !== undefined) return settle(known);
		let current = true;
		cover_tint(src).then((colour) => current && settle(colour));
		return () => {
			current = false;
		};
	});
}

let pointed: HTMLElement | null = null;
const covers = new WeakMap<HTMLElement, () => string | null>();
let rest_timer: ReturnType<typeof setTimeout> | undefined;

function moved() {
	clearTimeout(rest_timer);
	rest_timer = setTimeout(
		() => (hover = pointed ? (covers.get(pointed)?.() ?? null) : null),
		pointed ? HOVER_IN_MS : HOVER_OUT_MS
	);
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
			pointed = el;
			moved();
		};
		const leave = (e: PointerEvent) => {
			if (e.pointerType !== 'mouse') return;
			if (pointed === el) pointed = null;
			moved();
		};
		el.addEventListener('pointerenter', enter);
		el.addEventListener('pointerleave', leave);
		return () => {
			el.removeEventListener('pointerenter', enter);
			el.removeEventListener('pointerleave', leave);
			if (pointed === el) {
				pointed = null;
				moved();
			}
		};
	};
}

export const cover_url = (image: string | null, artist: string, name?: string) =>
	image ?? `/api/art?${new URLSearchParams(name ? { artist, name } : { artist, v: '3' })}`;
