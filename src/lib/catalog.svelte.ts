import type { Artist, Song } from './music';
import { norm, song_key } from './match';

const MAX_ARTISTS = 4;
const MAX_SONGS = 30;

interface Entry<T> {
	item: T;
	name: string;
	words: string;
}

/**
 * Every song and artist the pages have loaded so far, for search.
 * Nothing is fetched for it: it only knows what has already been shown.
 */
class Catalog {
	#songs = new Map<string, Entry<Song>>();
	#artists = new Map<string, Entry<Artist>>();
	size = $state(0);

	add(songs: Song[] = [], artists: Artist[] = []) {
		for (const s of songs) {
			const key = song_key(s);
			const had = this.#songs.get(key);
			if (!had)
				this.#songs.set(key, { item: s, name: norm(s.name), words: norm(`${s.name} ${s.credits ?? s.artist} ${s.album ?? ''}`) });
			else if (!had.item.duration && s.duration) had.item = { ...had.item, duration: s.duration };
			this.#artist({ name: s.artist, image: null, spotify: s.artist_spotify });
		}
		for (const a of artists) this.#artist(a);
		this.size = this.#songs.size + this.#artists.size;
	}

	#artist(a: Artist) {
		const key = norm(a.name);
		if (!key) return;
		const had = this.#artists.get(key);
		if (had && (had.item.image || !a.image)) return;
		this.#artists.set(key, { item: { ...had?.item, ...a, spotify: a.spotify ?? had?.item.spotify }, name: key, words: key });
	}

	search(query: string): { artists: Artist[]; songs: Song[] } {
		const q = norm(query);
		if (!q) return { artists: [], songs: [] };
		const words = q.split(' ');
		return {
			artists: ranked(this.#artists, q, words).slice(0, MAX_ARTISTS),
			songs: ranked(this.#songs, q, words).slice(0, MAX_SONGS)
		};
	}
}

/** all words must match; names that start with the query come first, then word starts */
function ranked<T>(entries: Map<string, Entry<T>>, q: string, words: string[]): T[] {
	const hits: { item: T; score: number; order: number }[] = [];
	let order = 0;
	for (const e of entries.values()) {
		order++;
		if (!words.every((w) => e.words.includes(w))) continue;
		const score = e.name.startsWith(q) ? 0 : ` ${e.name}`.includes(` ${q}`) ? 1 : e.name.includes(q) ? 2 : 3;
		hits.push({ item: e.item, score, order });
	}
	return hits.sort((a, b) => a.score - b.score || a.order - b.order).map((h) => h.item);
}

export const catalog = new Catalog();

export const search = $state({ open: false });
