import type { Preview, QueueItem } from './player_types';

const key_of = (t: { name: string; artist: string }) => `${t.artist}\u0000${t.name}`.toLowerCase();

export type Repeat = 'off' | 'one';
const REPEATS: Repeat[] = ['off', 'one'];

class Player {
	queue = $state<QueueItem[]>([]);
	index = $state(-1);
	preview = $state<Preview | null>(null);
	playing = $state(false);
	loading = $state(false);
	time = $state(0);
	duration = $state(30);
	volume = $state(0.8);
	message = $state<string | null>(null);
	repeat = $state<Repeat>('off');

	#audio: HTMLAudioElement | null = null;
	#request = 0;

	get current(): QueueItem | null {
		return this.queue[this.index] ?? null;
	}

	is_current(t: { name: string; artist: string }) {
		const c = this.current;
		return !!c && key_of(c) === key_of(t);
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
			if (a.src) this.#skip('Couldn’t play that one, skipping');
		});
		this.#audio = a;
		this.#media_keys();
		return a;
	}

	play(list: QueueItem[], start = 0) {
		const target = list[start];
		if (target && this.is_current(target) && this.preview) {
			this.toggle();
			return;
		}
		this.queue = list.slice(0, 200);
		void this.#load(start, 1);
	}

	async play_collection(type: 'artist' | 'album', artist: string, album?: string) {
		this.loading = true;
		this.message = null;
		try {
			const params = new URLSearchParams({ type, artist, ...(album ? { album } : {}) });
			const res = await fetch(`/api/preview?${params}`);
			const list: QueueItem[] = res.ok ? await res.json() : [];
			if (!list.length) {
				this.loading = false;
				this.message = `Nothing to play for ${album ?? artist}`;
				return;
			}
			this.play(list, 0);
		} catch {
			this.loading = false;
			this.message = 'Couldn’t reach the music service';
		}
	}

	async #load(i: number, dir: 1 | -1, tries = 0): Promise<void> {
		const item = this.queue[i];
		if (!item) {
			this.loading = false;
			return;
		}
		const req = ++this.#request;
		this.index = i;
		this.loading = true;
		this.message = null;
		const audio = this.#el();
		audio.pause();

		let preview: Preview | null = null;
		try {
			const params = new URLSearchParams({ name: item.name, artist: item.artist });
			const res = await fetch(`/api/preview?${params}`);
			if (res.ok) preview = await res.json();
		} catch {}
		if (req !== this.#request) return;

		if (!preview) {
			if (tries < 5 && this.queue[i + dir]) return this.#load(i + dir, dir, tries + 1);
			this.loading = false;
			this.preview = null;
			this.message = `No preview available for “${item.name}”`;
			return;
		}

		this.preview = preview;
		this.time = 0;
		audio.src = preview.url;
		try {
			await audio.play();
		} catch {
		}
		if (req === this.#request) this.loading = false;
		this.#metadata();
	}

	#skip(msg: string) {
		this.message = msg;
		if (this.queue[this.index + 1]) void this.#load(this.index + 1, 1);
	}

	toggle() {
		const a = this.#audio;
		if (!a || !this.preview) return;
		if (a.paused) void a.play();
		else a.pause();
	}

	get has_next() {
		return !!this.queue[this.index + 1];
	}

	next() {
		if (this.queue[this.index + 1]) void this.#load(this.index + 1, 1);
		else this.#audio?.pause();
	}

	#ended() {
		const a = this.#audio;
		if (this.repeat === 'one' && a) {
			a.currentTime = 0;
			void a.play();
		} else this.next();
	}

	cycle_repeat() {
		this.repeat = REPEATS[(REPEATS.indexOf(this.repeat) + 1) % REPEATS.length];
	}

	prev() {
		if (this.time > 3 || !this.queue[this.index - 1]) {
			if (this.#audio) this.#audio.currentTime = 0;
			return;
		}
		void this.#load(this.index - 1, -1);
	}

	seek(fraction: number) {
		if (this.#audio && this.duration) this.#audio.currentTime = Math.max(0, Math.min(1, fraction)) * this.duration;
	}

	set_volume(v: number) {
		this.volume = v;
		if (this.#audio) this.#audio.volume = v;
	}

	close() {
		this.#request++;
		this.#audio?.pause();
		if (this.#audio) this.#audio.removeAttribute('src');
		this.queue = [];
		this.index = -1;
		this.preview = null;
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
		if (!('mediaSession' in navigator) || !this.preview) return;
		const p = this.preview;
		navigator.mediaSession.metadata = new MediaMetadata({
			title: p.name,
			artist: p.artist,
			album: p.album,
			artwork: p.cover ? [{ src: p.cover, sizes: '500x500' }] : []
		});
	}
}

export const player = new Player();
