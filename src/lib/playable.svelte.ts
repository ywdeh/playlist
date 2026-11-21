import { SvelteMap } from 'svelte/reactivity';
import type { Preview, QueueItem } from './player_types';
import { song_key } from './match';

type Found = Preview | null;

const MAX_RUNNING = 2;

class Playable {
	#found = new SvelteMap<string, boolean>();
	#lookups = new Map<string, Promise<Found>>();
	#waiting: (() => void)[] = [];
	#running = 0;

	state(song: QueueItem): 'yes' | 'no' | undefined {
		const found = this.#found.get(song_key(song));
		if (found === undefined) return undefined;
		return found ? 'yes' : 'no';
	}

	async #slot() {
		if (this.#running >= MAX_RUNNING) await new Promise<void>((r) => this.#waiting.push(r));
		this.#running++;
	}

	#release() {
		this.#running--;
		this.#waiting.shift()?.();
	}

	preview(song: QueueItem, urgent = false): Promise<Found> {
		const key = song_key(song);
		const running = this.#lookups.get(key);
		if (running) return running;
		const lookup = (async () => {
			if (!urgent) await this.#slot();
			try {
				const params = new URLSearchParams({ name: song.name, artist: song.artist, ...(song.isrc ? { isrc: song.isrc } : {}) });
				const res = await fetch(`/api/preview?${params}`);
				if (res.status === 404) {
					this.#found.set(key, false);
					return null;
				}
				if (!res.ok) throw new Error(`preview ${res.status}`);
				const found = (await res.json()) as Preview;
				this.#found.set(key, true);
				return found;
			} finally {
				if (!urgent) this.#release();
			}
		})();
		this.#lookups.set(key, lookup);
		lookup.catch(() => this.#lookups.delete(key));
		return lookup;
	}

	forget(song: QueueItem) {
		this.#lookups.delete(song_key(song));
	}

	watch(song: () => QueueItem) {
		return (el: HTMLElement) => {
			const seen = new IntersectionObserver(
				(entries) => {
					if (!entries.some((e) => e.isIntersecting)) return;
					seen.disconnect();
					const s = song();
					if (this.state(s) === undefined) this.preview(s).catch(() => {});
				},
				{ rootMargin: '200px' }
			);
			seen.observe(el);
			return () => seen.disconnect();
		};
	}
}

export const playable = new Playable();
