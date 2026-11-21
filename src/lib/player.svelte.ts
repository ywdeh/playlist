import type { Preview, QueueItem } from './player_types';
import { song_key } from './match';
import { playable } from './playable.svelte';

export type Repeat = 'off' | 'one';
const REPEATS: Repeat[] = ['off', 'one'];
const MAX_SKIPS = 5;
const DEFAULT_VOLUME = 0.4;

class Player {
	queue = $state<QueueItem[]>([]);
	index = $state(-1);
	track = $state<Preview | null>(null);
	playing = $state(false);
	loading = $state(false);
	time = $state(0);
	duration = $state(30);
	volume = $state(DEFAULT_VOLUME);
	message = $state<string | null>(null);
	repeat = $state<Repeat>('off');

	#audio: HTMLAudioElement | null = null;
	#request = 0;
	#retried = false;
	#unmuted = DEFAULT_VOLUME;

	get current(): QueueItem | null {
		return this.queue[this.index] ?? null;
	}

	is_current(t: { name: string; artist: string }) {
		const c = this.current;
		return !!c && song_key(c) === song_key(t);
	}

	#el() {
		if (this.#audio) return this.#audio;
		const a = new Audio();
		a.preload = 'auto';
		a.volume = this.volume;
		a.addEventListener('timeupdate', () => (this.time = a.currentTime));
		a.addEventListener('durationchange', () => (this.duration = Number.isFinite(a.duration) ? a.duration : 30));
		a.addEventListener('play', () => (this.playing = true));
		a.addEventListener('pause', () => (this.playing = false));
		a.addEventListener('ended', () => this.#ended());
		a.addEventListener('error', () => {
			if (a.getAttribute('src')) this.#audio_failed();
		});
		this.#audio = a;
		this.#media_keys();
		return a;
	}

	play(list: QueueItem[], start = 0) {
		const target = list[start];
		if (target && this.is_current(target) && this.track) {
			this.toggle();
			return;
		}
		this.queue = list.slice(0, 200);
		void this.#load(start, 1);
	}

	async #preview(item: QueueItem, req: number): Promise<boolean | 'failed'> {
		let found;
		try {
			found = await playable.preview(item, true);
		} catch {
			found = await playable.preview(item, true).catch(() => 'failed' as const);
		}
		if (req !== this.#request) return true;
		if (found === 'failed') return 'failed';
		if (!found) return false;
		this.track = found;
		this.time = 0;
		this.duration = 30;
		this.#retried = false;
		const audio = this.#el();
		audio.src = found.url;
		try {
			await audio.play();
		} catch {}
		if (req === this.#request) this.loading = false;
		this.#metadata();
		return true;
	}

	async #load(i: number, dir: 1 | -1, skips = 0): Promise<void> {
		const item = this.queue[i];
		if (!item) {
			this.loading = false;
			return;
		}
		const req = ++this.#request;
		this.index = i;
		this.loading = true;
		this.message = null;
		this.#audio?.pause();

		const result = await this.#preview(item, req);
		if (result === true || req !== this.#request) return;

		const next = this.#next_playable(i, dir);
		if (next !== null && skips < MAX_SKIPS) return this.#load(next, dir, skips + 1);
		this.loading = false;
		this.track = null;
		this.message = result === 'failed' ? 'couldn’t reach the music service' : `“${item.name}” isn’t available to play`;
	}

	#next_playable(from: number, dir: 1 | -1) {
		for (let j = from + dir; this.queue[j]; j += dir) {
			if (playable.state(this.queue[j]) !== 'no') return j;
		}
		return null;
	}

	#audio_failed() {
		const item = this.current;
		if (!item) return;
		if (!this.#retried) {
			this.#retried = true;
			playable.forget(item);
			const req = ++this.#request;
			void playable
				.preview(item, true)
				.then((found) => {
					if (req !== this.#request || !found || !this.#audio) return;
					this.#audio.src = found.url;
					void this.#audio.play().catch(() => {});
				})
				.catch(() => {});
			return;
		}
		this.message = 'couldn’t play that one, skipping';
		if (this.has_next) void this.#load(this.index + 1, 1);
	}

	toggle() {
		const a = this.#audio;
		if (!a || !this.track) return;
		if (a.paused) void a.play();
		else a.pause();
	}

	get has_next() {
		return !!this.queue[this.index + 1];
	}

	next() {
		if (this.has_next) void this.#load(this.index + 1, 1);
		else this.#audio?.pause();
	}

	#ended() {
		if (this.repeat === 'one') {
			this.seek(0);
			void this.#audio?.play();
		} else this.next();
	}

	cycle_repeat() {
		this.repeat = REPEATS[(REPEATS.indexOf(this.repeat) + 1) % REPEATS.length];
	}

	prev() {
		if (this.time > 3 || !this.queue[this.index - 1]) {
			this.seek(0);
			return;
		}
		void this.#load(this.index - 1, -1);
	}

	seek(fraction: number) {
		if (this.#audio && this.duration) this.#audio.currentTime = Math.max(0, Math.min(1, fraction)) * this.duration;
	}

	toggle_mute() {
		if (this.volume > 0) {
			this.#unmuted = this.volume;
			this.set_volume(0);
		} else this.set_volume(this.#unmuted);
	}

	set_volume(v: number) {
		v = Math.max(0, Math.min(1, v));
		if (v > 0) this.#unmuted = v;
		this.volume = v;
		if (this.#audio) this.#audio.volume = v;
	}

	close() {
		this.#request++;
		this.#audio?.pause();
		this.#audio?.removeAttribute('src');
		this.queue = [];
		this.index = -1;
		this.track = null;
		this.playing = false;
		this.loading = false;
		this.message = null;
	}

	#media_keys() {
		if (!('mediaSession' in navigator)) return;
		navigator.mediaSession.setActionHandler('play', () => this.toggle());
		navigator.mediaSession.setActionHandler('pause', () => this.toggle());
		navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
		navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
	}

	#metadata() {
		if (!('mediaSession' in navigator) || !this.track) return;
		const t = this.track;
		navigator.mediaSession.metadata = new MediaMetadata({
			title: t.name,
			artist: t.artist,
			album: t.album,
			artwork: t.cover ? [{ src: t.cover, sizes: '500x500' }] : []
		});
	}
}

export const player = new Player();
