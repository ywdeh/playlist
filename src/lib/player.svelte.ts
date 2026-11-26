import type { Preview, QueueItem } from './player_types';
import { song_key } from './match';
import { playable } from './playable.svelte';

export type Repeat = 'off' | 'one';
const REPEATS: Repeat[] = ['off', 'one'];
const MAX_SKIPS = 5;
const MAX_QUEUE = 200;
const DEFAULT_VOLUME = 0.4;

/** how early the next song starts loading, so the handover has no gap */
const WARM_S = 12;

class Player {
	queue = $state.raw<QueueItem[]>([]);
	index = $state(-1);
	track = $state<Preview | null>(null);
	playing = $state(false);
	loading = $state(false);
	time = $state(0);
	duration = $state(30);
	volume = $state(DEFAULT_VOLUME);
	message = $state<string | null>(null);
	repeat = $state<Repeat>('off');
	shuffle = $state(false);

	/** the active element: its events drive the player state */
	#audio: HTMLAudioElement | null = null;
	/** the other element, loading the next song */
	#spare: HTMLAudioElement | null = null;
	#warm: { key: string; found: Preview | null } | null = null;
	#ordered: QueueItem[] = [];
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

	#make() {
		const a = new Audio();
		a.preload = 'auto';
		const live = () => a === this.#audio;
		a.addEventListener('timeupdate', () => {
			if (!live()) return;
			this.time = a.currentTime;
			this.#tick();
		});
		a.addEventListener('durationchange', () => {
			if (live()) this.duration = Number.isFinite(a.duration) ? a.duration : 30;
		});
		a.addEventListener('play', () => live() && (this.playing = true));
		a.addEventListener('pause', () => live() && (this.playing = false));
		a.addEventListener('ended', () => live() && this.#ended());
		a.addEventListener('error', () => {
			if (live() && a.getAttribute('src')) this.#audio_failed();
		});
		return a;
	}

	#el() {
		if (this.#audio) return this.#audio;
		this.#audio = this.#make();
		this.#audio.volume = this.volume;
		this.#media_keys();
		return this.#audio;
	}

	play(list: QueueItem[], start = 0) {
		const target = list[start];
		if (target && this.is_current(target) && this.track) {
			this.toggle();
			return;
		}
		this.#ordered = list.slice(0, MAX_QUEUE);
		if (this.shuffle) {
			this.queue = shuffled(this.#ordered, start);
			void this.#load(0, 1);
		} else {
			this.queue = this.#ordered;
			void this.#load(start, 1);
		}
	}

	toggle_shuffle() {
		this.shuffle = !this.shuffle;
		if (!this.queue.length) return;
		const at = this.#ordered.indexOf(this.current!);
		if (this.shuffle) {
			this.queue = shuffled(this.#ordered, at);
			this.index = at < 0 ? -1 : 0;
		} else {
			this.queue = this.#ordered;
			this.index = at;
		}
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
		audio.volume = this.volume;
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

	/** near the end of a song: load the next one, so it can start the moment this one ends */
	#tick() {
		if (this.repeat !== 'off' || this.loading || !this.track || !this.playing) return;
		const left = this.duration - this.time;
		if (left > WARM_S) return;
		const i = this.#next_playable(this.index, 1);
		if (i === null) return;
		const item = this.queue[i];
		const key = song_key(item);
		if (this.#warm?.key !== key) this.#prepare(item, key);
	}

	/** a song played to its end: start the next one, already loaded if it could be */
	#hand_over() {
		const i = this.#next_playable(this.index, 1);
		const found = i !== null && this.#warm?.key === song_key(this.queue[i]) ? this.#warm.found : null;
		const from = this.#audio;
		const to = this.#spare;
		if (i === null || !found || !from || !to) return this.next();
		this.#warm = null;
		this.#request++;
		this.#audio = to;
		this.#spare = from;
		this.index = i;
		this.track = found;
		this.time = 0;
		this.duration = Number.isFinite(to.duration) ? to.duration : 30;
		this.message = null;
		this.#retried = false;
		to.volume = this.volume;
		void to.play().catch(() => {});
		this.#metadata();
		from.removeAttribute('src');
	}

	#prepare(item: QueueItem, key: string) {
		const warm: { key: string; found: Preview | null } = { key, found: null };
		this.#warm = warm;
		playable
			.preview(item, true)
			.then((found) => {
				if (this.#warm !== warm || !found) return;
				warm.found = found;
				this.#spare ??= this.#make();
				this.#spare.src = found.url;
			})
			.catch(() => {});
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
		} else this.#hand_over();
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
		this.#warm = null;
		this.#audio?.pause();
		this.#audio?.removeAttribute('src');
		this.#spare?.removeAttribute('src');
		this.queue = [];
		this.#ordered = [];
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

/** the song at `first` leads, the rest follow in random order */
function shuffled<T>(list: T[], first: number): T[] {
	const rest = list.filter((_, i) => i !== first);
	for (let i = rest.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[rest[i], rest[j]] = [rest[j], rest[i]];
	}
	return list[first] ? [list[first], ...rest] : rest;
}

export const player = new Player();
