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
	x = $state(0);
	y = $state(0);
	items = $state.raw<MenuItem[]>([]);
	spotify = $state.raw<SpotifyItem[]>([]);
	copy = $state<string | null>(null);
}
export const menu = new Menu();

export function close_menu() {
	menu.open = false;
}

const HOLD_MS = 450;
const HOLD_SLOP = 10;

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

		const show = (x: number, y: number) => {
			const { items, spotify, copy } = build();
			menu.items = items;
			menu.spotify = spotify;
			menu.copy = copy;
			menu.x = x;
			menu.y = y;
			menu.id++;
			menu.open = true;
		};

		const on_context = (e: MouseEvent) => {
			e.preventDefault();
			if (Date.now() - held_at < 1000) return;
			show(e.clientX, e.clientY);
		};

		const cancel = () => {
			clearTimeout(timer);
			removeEventListener('pointermove', move, true);
			removeEventListener('pointerup', cancel, true);
			removeEventListener('pointercancel', cancel, true);
			removeEventListener('scroll', cancel, true);
		};
		const move = (e: PointerEvent) => {
			if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > HOLD_SLOP) cancel();
		};
		const down = (e: PointerEvent) => {
			if (e.pointerType === 'mouse' && e.button !== 0) return;
			cancel();
			start = { x: e.clientX, y: e.clientY };
			addEventListener('pointermove', move, true);
			addEventListener('pointerup', cancel, true);
			addEventListener('pointercancel', cancel, true);
			addEventListener('scroll', cancel, true);
			timer = setTimeout(() => {
				cancel();
				held_at = Date.now();
				if (e.pointerType === 'touch') navigator.vibrate?.(8);
				show(start.x, start.y);
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
		el.style.setProperty('-webkit-user-select', 'none');
		el.style.setProperty('user-select', 'none');
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

export function song_menu(song: () => { name: string; artist: string; play: () => void; spotify?: string }) {
	return context_menu(() => {
		const { name, artist, play, spotify } = song();
		const items: MenuItem[] = [{ label: 'play', run: play }];
		if (!on_artist_page(artist)) items.push({ label: 'go to artist', run: () => goto(artist_path(artist)) });
		return {
			items,
			spotify: [
				{ label: 'open in spotify', search_label: 'search on spotify', artist, name, url: spotify },
				{ label: 'open artist in spotify', search_label: 'search artist on spotify', artist }
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

export interface SpotifyTarget {
	url: string;
	exact: boolean;
}

const links = new Map<string, Promise<SpotifyTarget>>();

const spotify_search = (artist: string, name?: string): SpotifyTarget => ({
	url: name
		? `https://open.spotify.com/search/${encodeURIComponent(`${name} ${artist}`)}`
		: `https://open.spotify.com/search/${encodeURIComponent(artist)}/artists`,
	exact: false
});

export function spotify_link(q: { artist: string; name?: string; url?: string }): Promise<SpotifyTarget> {
	if (q.url) return Promise.resolve({ url: q.url, exact: true });
	const key = `${q.artist}\u0000${q.name ?? ''}`.toLowerCase();
	let p = links.get(key);
	if (!p) {
		const params = new URLSearchParams(q.name ? { artist: q.artist, name: q.name } : { artist: q.artist });
		p = fetch(`/api/spotify?${params}`)
			.then((r) => (r.ok ? r.json() : { url: null }))
			.then((j: { url: string | null }) => (j.url ? { url: j.url, exact: true } : spotify_search(q.artist, q.name)))
			.catch(() => {
				links.delete(key);
				return spotify_search(q.artist, q.name);
			});
		links.set(key, p);
	}
	return p;
}
