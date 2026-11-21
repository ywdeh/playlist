import { goto } from '$app/navigation';
import { page } from '$app/state';

export interface SpotifyItem {
	label: string;
	search_label: string;
	artist: string;
	name?: string;
	url?: string;
}

export interface MenuItem {
	label: string;
	run: () => void;
}

class Menu {
	id = $state(0);
	open = $state(false);
	held = $state(false);
	x = $state(0);
	y = $state(0);
	items = $state.raw<MenuItem[]>([]);
	spotify = $state.raw<SpotifyItem[]>([]);
	copy = $state<string | null>(null);
}
export const menu = new Menu();

export function close_menu() {
	menu.open = false;
	menu.held = false;
}

const HOLD_MS = 450;
export const HOLD_SLOP = 10;

interface MenuParts {
	items: MenuItem[];
	spotify: SpotifyItem[];
	copy: string;
}

export function context_menu(build: () => MenuParts) {
	return (el: HTMLElement) => {
		let held_at = 0;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let start = { x: 0, y: 0 };

		const show = (x: number, y: number, held = false) => {
			const { items, spotify, copy } = build();
			menu.items = items;
			menu.spotify = spotify;
			menu.copy = copy;
			menu.x = x;
			menu.y = y;
			menu.id++;
			menu.held = held;
			menu.open = true;
		};

		const on_context = (e: MouseEvent) => {
			e.preventDefault();
			if (Date.now() - held_at < 1000) return;
			show(e.clientX, e.clientY);
		};

		const strayed = (x: number, y: number) => Math.hypot(x - start.x, y - start.y) > HOLD_SLOP;
		const move = (e: PointerEvent) => strayed(e.clientX, e.clientY) && cancel();
		const touch_move = (e: TouchEvent) => {
			const t = e.touches[0];
			if (t && strayed(t.clientX, t.clientY)) cancel();
		};
		const cancel = () => {
			clearTimeout(timer);
			removeEventListener('pointermove', move, true);
			removeEventListener('pointerup', cancel, true);
			removeEventListener('pointercancel', cancel, true);
			removeEventListener('scroll', cancel, true);
			removeEventListener('touchmove', touch_move, true);
			removeEventListener('touchend', cancel, true);
			removeEventListener('touchcancel', cancel, true);
		};
		const down = (e: PointerEvent) => {
			if (e.pointerType === 'mouse' && e.button !== 0) return;
			cancel();
			start = { x: e.clientX, y: e.clientY };
			if (e.pointerType !== 'touch') {
				addEventListener('pointermove', move, true);
				addEventListener('pointerup', cancel, true);
				addEventListener('pointercancel', cancel, true);
				addEventListener('scroll', cancel, true);
			} else {
				addEventListener('touchmove', touch_move, { capture: true, passive: true });
				addEventListener('touchend', cancel, true);
				addEventListener('touchcancel', cancel, true);
			}
			timer = setTimeout(() => {
				cancel();
				held_at = Date.now();
				if (e.pointerType === 'touch') navigator.vibrate?.(8);
				show(start.x, start.y, true);
			}, HOLD_MS);
		};
		const click = (e: MouseEvent) => {
			if (Date.now() - held_at < 1000) {
				e.preventDefault();
				e.stopImmediatePropagation();
			}
		};

		el.addEventListener('contextmenu', on_context);
		el.addEventListener('pointerdown', down);
		el.addEventListener('click', click, true);
		el.style.setProperty('-webkit-touch-callout', 'none');
		return () => {
			cancel();
			el.removeEventListener('contextmenu', on_context);
			el.removeEventListener('pointerdown', down);
			el.removeEventListener('click', click, true);
		};
	};
}

export const artist_path = (artist: string) => `/artist/${encodeURIComponent(artist)}`;
const on_artist_page = (artist: string) => decodeURIComponent(page.url.pathname) === `/artist/${artist}`;

export interface MenuSong {
	name: string;
	artist: string;
	play: () => void;
	spotify?: string;
	artist_spotify?: string;
}

export function song_menu(song: () => MenuSong) {
	return context_menu(() => {
		const { name, artist, play, spotify, artist_spotify } = song();
		const items: MenuItem[] = [{ label: 'play', run: play }];
		if (!on_artist_page(artist)) items.push({ label: 'go to artist', run: () => goto(artist_path(artist)) });
		return {
			items,
			spotify: [
				{ label: 'open in spotify', search_label: 'search on spotify', artist, name, url: spotify },
				{ label: 'open artist in spotify', search_label: 'search artist on spotify', artist, url: artist_spotify }
			],
			copy: `${name} by ${artist}`
		};
	});
}

export function artist_menu(target: () => { artist: string; spotify?: string }) {
	return context_menu(() => {
		const { artist, spotify } = target();
		const items: MenuItem[] = on_artist_page(artist) ? [] : [{ label: 'open artist', run: () => goto(artist_path(artist)) }];
		return { items, spotify: [{ label: 'open in spotify', search_label: 'search on spotify', artist, url: spotify }], copy: artist };
	});
}

const APP_WAIT_MS = 1500;

function open_app(app: string, web: string) {
	const fallback = setTimeout(() => !document.hidden && (location.href = web), APP_WAIT_MS);
	const left = () => document.hidden && clearTimeout(fallback);
	document.addEventListener('visibilitychange', left, { once: true });
	addEventListener('pagehide', () => clearTimeout(fallback), { once: true });
	location.href = app;
}

const SPOTIFY_PAGE = /^https:\/\/open\.spotify\.com\/(track|artist|album|playlist)\/(\w+)/;

export function open_spotify({ artist, name, url }: SpotifyItem) {
	const query = encodeURIComponent(name ? `${name} ${artist}` : artist);
	const web = url ?? `https://open.spotify.com/search/${query}${name ? '' : '/artists'}`;
	if (!matchMedia('(pointer: coarse)').matches) return void window.open(web, '_blank', 'noopener');
	const page = url?.match(SPOTIFY_PAGE);
	open_app(page ? `spotify:${page[1]}:${page[2]}` : `spotify:search:${query}`, web);
}
