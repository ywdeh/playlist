import type { Loaded, QueueItem } from './player_types';
import { song_key } from './match';
import { playable } from './playable.svelte';
import { spotify, type SdkState } from './spotify.svelte';

export type Repeat = 'off' | 'one';
const REPEATS: Repeat[] = ['off', 'one'];
const MAX_SKIPS = 5;

class Player {
	queue = $state<QueueItem[]>([]);
	index = $state(-1);
	track = $state<Loaded | null>(null);
	playing = $state(false);
	loading = $state(false);
	time = $state(0);
	duration = $state(30);
	volume = $state(0.8);
	message = $state<string | null>(null);
	repeat = $state<Repeat>('off');

	#audio: HTMLAudioElement | null = null;
	#request = 0;
	#retried = false;
	#sdk_at = { position: 0, stamp: 0 };
	#clock: ReturnType<typeof setInterval> | undefined;

	constructor() {
		spotify.on_state((s) => this.#sdk_state(s));
	}

	get current(): QueueItem | null {
		return this.queue[this.index] ?? null;
	}

	get full() {
		return !!this.track?.full;
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
		a.addEventListener('timeupdate', () => !this.full && (this.time = a.currentTime));
		a.addEventListener('durationchange', () => !this.full && (this.duration = Number.isFinite(a.duration) ? a.duration : 30));
		a.addEventListener('play', () => (this.playing = true));
		a.addEventListener('pause', () => !this.full && (this.playing = false));
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
		if (spotify.ready) spotify.activate();
		this.queue = list.slice(0, 200);
		void this.#load(start, 1);
	}

	upgrade() {
		if (spotify.ready && this.current && !this.full) void this.#load(this.index, 1);
	}

	async #full(item: QueueItem, req: number): Promise<boolean> {
		if (!spotify.ready) return false;
		const uri = await spotify.find(item);
		if (!uri || req !== this.#request) return false;
		this.#audio?.pause();
		this.track = { name: item.name, artist: item.artist, album: item.album ?? '', cover: item.image ?? null, full: true };
		this.time = 0;
		this.duration = item.duration ?? 0;
		try {
			await spotify.play(uri);
		} catch {
			if (req === this.#request) this.track = null;
			return false;
		}
		if (req !== this.#request) return true;
		this.loading = false;
		this.#metadata();
		return true;
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
		void spotify.pause();
		this.track = { ...found, full: false };
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

		if (await this.#full(item, req)) return;
		if (req !== this.#request) return;
		const result = await this.#preview(item, req);
		if (result === true || req !== this.#request) return;

		const next = this.#next_playable(i, dir);
		if (next !== null && skips < MAX_SKIPS) return this.#load(next, dir, skips + 1);
		this.loading = false;
		this.track = null;
		this.message = result === 'failed' ? 'Couldn’t reach the music service' : `“${item.name}” isn’t available to play`;
	}

	#next_playable(from: number, dir: 1 | -1) {
		for (let j = from + dir; this.queue[j]; j += dir) {
			if (playable.state(this.queue[j]) !== 'no') return j;
		}
		return null;
	}

	#audio_failed() {
		const item = this.current;
		if (!item || this.full) return;
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
		this.message = 'Couldn’t play that one, skipping';
		if (this.has_next) void this.#load(this.index + 1, 1);
	}

	#sdk_state(s: SdkState | null) {
		if (!this.full) return;
		if (!s) {
			this.playing = false;
			this.#tick(false);
			return;
		}
		const ended = s.paused && s.position === 0 && this.playing && this.time > this.duration - 3;
		this.duration = s.duration / 1000;
		this.#sdk_at = { position: s.position / 1000, stamp: performance.now() };
		this.time = this.#sdk_at.position;
		this.playing = !s.paused;
		const t = s.track_window.current_track;
		if (t && this.track) {
			const cover = [...t.album.images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url;
			this.track = { ...this.track, album: t.album.name, cover: cover ?? this.track.cover };
		}
		this.#tick(this.playing);
		if (ended) this.#ended();
	}

	#tick(on: boolean) {
		clearInterval(this.#clock);
		if (!on) return;
		this.#clock = setInterval(() => {
			this.time = Math.min(this.duration, this.#sdk_at.position + (performance.now() - this.#sdk_at.stamp) / 1000);
		}, 250);
	}

	toggle() {
		if (!this.track) return;
		if (this.full) {
			void spotify.toggle();
			return;
		}
		const a = this.#audio;
		if (!a) return;
		if (a.paused) void a.play();
		else a.pause();
	}

	get has_next() {
		return !!this.queue[this.index + 1];
	}

	next() {
		if (this.has_next) void this.#load(this.index + 1, 1);
		else if (this.full) void spotify.pause();
		else this.#audio?.pause();
	}

	#ended() {
		if (this.repeat === 'one') {
			this.seek(0);
			if (this.full) void spotify.resume();
			else void this.#audio?.play();
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
		const to = Math.max(0, Math.min(1, fraction)) * this.duration;
		if (this.full) {
			this.#sdk_at = { position: to, stamp: performance.now() };
			this.time = to;
			void spotify.seek(to);
		} else if (this.#audio && this.duration) this.#audio.currentTime = to;
	}

	set_volume(v: number) {
		this.volume = v;
		if (this.#audio) this.#audio.volume = v;
		void spotify.set_volume(v);
	}

	close() {
		this.#request++;
		this.#audio?.pause();
		this.#audio?.removeAttribute('src');
		if (this.full) void spotify.pause();
		this.#tick(false);
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
