import { cover_tint, known_tint } from './cover_tint';

const HOVER_IN_MS = 180;
const HOVER_OUT_MS = 360;
const MIST = ['--mist', '--mist-target'];

const sources = $state<{
	hover: string | null;
	song: string | null | undefined;
	playing: boolean;
	live: string | null;
	page: string | null;
}>({
	hover: null,
	song: null,
	playing: false,
	live: null,
	page: null
});

function layer(key: 'live' | 'page') {
	return (picture: () => string | null) => {
		$effect.pre(() => {
			const p = picture();
			sources[key] = p;
			return () => {
				if (sources[key] === p) sources[key] = null;
			};
		});
	};
}

export const page_tint = layer('page');
export const live_tint = layer('live');

export function playing_tint(picture: () => string | null | undefined, playing: () => boolean) {
	$effect.pre(() => {
		sources.song = picture();
		sources.playing = playing();
		return () => {
			sources.song = null;
			sources.playing = false;
		};
	});
}

let painted: string | null = null;
let fade_ms = 0;
let fading: ReturnType<typeof setTimeout> | undefined;

function paint(colour: string | null) {
	const root = document.documentElement;
	if (colour !== painted) {
		painted = colour;
		const ready = root.classList.contains('ready');
		if (!ready) root.style.transition = 'none';
		for (const name of MIST) {
			if (colour) root.style.setProperty(name, colour);
			else root.style.removeProperty(name);
		}
		if (ready) {
			root.classList.add('tinting');
			clearTimeout(fading);
			fading = setTimeout(() => root.classList.remove('tinting'), fade_ms);
		} else {
			getComputedStyle(root).getPropertyValue('--mist');
			root.style.removeProperty('transition');
		}
	}
	(window as { tint_done?: () => void }).tint_done?.();
}

export function tint_root() {
	$effect(() => {
		fade_ms = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--t-tint')) * 1000 || 0;
	});
	$effect(() => {
		const { hover, song, playing, live, page } = sources;
		if (!hover && song === undefined) return;
		const src = hover ?? (playing ? song : null) ?? live ?? page ?? song;
		const apply = (colour: string | null) => {
			if (colour || !hover) paint(colour);
		};
		if (!src) return paint(null);
		const known = known_tint(src);
		if (known !== undefined) return apply(known);
		let current = true;
		cover_tint(src).then((colour) => current && apply(colour));
		return () => {
			current = false;
		};
	});
}

let pointed: HTMLElement | null = null;
const covers = new WeakMap<HTMLElement, () => string | null>();
let last_move = 0;
let resting: ReturnType<typeof setTimeout> | undefined;

const rest_ms = () => (pointed ? HOVER_IN_MS : HOVER_OUT_MS);

function rest() {
	const left = rest_ms() - (performance.now() - last_move);
	if (left > 0) return void (resting = setTimeout(rest, left));
	resting = undefined;
	sources.hover = pointed ? (covers.get(pointed)?.() ?? null) : null;
}

function moved() {
	last_move = performance.now();
	resting ??= setTimeout(rest, rest_ms());
}

function point(el: HTMLElement | null) {
	pointed = el;
	clearTimeout(resting);
	resting = undefined;
	moved();
}

let watching = false;

function watch() {
	if (watching || typeof window === 'undefined') return;
	watching = true;
	const mouse = (e: PointerEvent) => e.pointerType === 'mouse' && moved();
	addEventListener('pointermove', mouse, { passive: true });
	addEventListener('scroll', moved, { capture: true, passive: true });
}

export function tint_on_hover(cover: () => string | null) {
	return (el: HTMLElement) => {
		watch();
		covers.set(el, cover);
		const enter = (e: PointerEvent) => e.pointerType === 'mouse' && point(el);
		const leave = (e: PointerEvent) => e.pointerType === 'mouse' && pointed === el && point(null);
		el.addEventListener('pointerenter', enter);
		el.addEventListener('pointerleave', leave);
		return () => {
			el.removeEventListener('pointerenter', enter);
			el.removeEventListener('pointerleave', leave);
			if (pointed === el) point(null);
		};
	};
}

export const cover_url = (image: string | null, artist: string, name?: string) =>
	image ?? `/api/art?${new URLSearchParams(name ? { artist, name } : { artist, v: '3' })}`;
