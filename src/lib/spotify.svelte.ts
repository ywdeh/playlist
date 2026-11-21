import { SPOTIFY_CLIENT_ID } from '$app/env/public';
import { best } from './match';
import type { QueueItem } from './player_types';

const ACCOUNTS = 'https://accounts.spotify.com';
const API = 'https://api.spotify.com/v1';
const SCOPES = 'streaming user-read-email user-read-private user-modify-playback-state';
const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';

export interface SdkTrack {
	uri: string;
	name: string;
	artists: { name: string }[];
	album: { name: string; images: { url: string; width?: number }[] };
}

export interface SdkState {
	paused: boolean;
	position: number;
	duration: number;
	track_window: { current_track: SdkTrack | null };
}

interface SdkPlayer {
	connect(): Promise<boolean>;
	disconnect(): void;
	addListener(event: string, cb: (data: any) => void): void;
	togglePlay(): Promise<void>;
	pause(): Promise<void>;
	resume(): Promise<void>;
	seek(ms: number): Promise<void>;
	setVolume(v: number): Promise<void>;
	activateElement(): Promise<void>;
}

declare global {
	interface Window {
		onSpotifyWebPlaybackSDKReady?: () => void;
		Spotify?: { Player: new (options: { name: string; getOAuthToken: (cb: (t: string) => void) => void; volume: number }) => SdkPlayer };
	}
}

const random = (bytes: number) => base64url(crypto.getRandomValues(new Uint8Array(bytes)));

function base64url(bytes: Uint8Array) {
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

async function challenge_for(verifier: string) {
	const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
	return base64url(new Uint8Array(hash));
}

function load_sdk(): Promise<void> {
	if (window.Spotify) return Promise.resolve();
	return new Promise((resolve, reject) => {
		window.onSpotifyWebPlaybackSDKReady = () => resolve();
		const script = document.createElement('script');
		script.src = SDK_URL;
		script.async = true;
		script.onerror = () => reject(new Error('Couldn’t load the Spotify player'));
		document.head.append(script);
	});
}

function wait_for_code(state: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const channel = new BroadcastChannel('spotify_auth');
		const stop = () => {
			channel.close();
			clearTimeout(timer);
		};
		const timer = setTimeout(() => {
			stop();
			reject(new Error('Sign-in timed out'));
		}, 5 * 60_000);
		channel.onmessage = (e: MessageEvent<{ code: string | null; state: string | null; error: string | null }>) => {
			if (e.data.state !== state) return;
			stop();
			if (e.data.code) resolve(e.data.code);
			else reject(new Error(e.data.error === 'access_denied' ? 'Sign-in was cancelled' : 'Sign-in failed'));
		};
	});
}

class Spotify {
	status = $state<'off' | 'connecting' | 'ready'>('off');
	error = $state<string | null>(null);

	#token: { value: string; refresh: string; expires: number } | null = null;
	#refreshing: Promise<string> | null = null;
	#device: string | null = null;
	#sdk: SdkPlayer | null = null;
	#uris = new Map<string, Promise<string | null>>();
	#listeners: ((state: SdkState | null) => void)[] = [];

	get ready() {
		return this.status === 'ready';
	}

	get supported() {
		return !!SPOTIFY_CLIENT_ID && typeof window !== 'undefined' && !matchMedia('(pointer: coarse)').matches;
	}

	on_state(cb: (state: SdkState | null) => void) {
		this.#listeners.push(cb);
	}

	async connect(volume: number) {
		if (this.status !== 'off' || !SPOTIFY_CLIENT_ID) return;
		this.error = null;
		const verifier = random(48);
		const state = random(16);
		const redirect_uri = `${location.origin}/listen`;
		const popup = window.open('about:blank', 'spotify_auth', 'width=480,height=720');
		if (!popup) {
			this.error = 'Allow pop-ups to sign in to Spotify';
			return;
		}
		this.status = 'connecting';
		try {
			const params = new URLSearchParams({
				client_id: SPOTIFY_CLIENT_ID,
				response_type: 'code',
				redirect_uri,
				scope: SCOPES,
				state,
				code_challenge_method: 'S256',
				code_challenge: await challenge_for(verifier)
			});
			popup.location.href = `${ACCOUNTS}/authorize?${params}`;
			const code = await wait_for_code(state);
			await this.#grant({ grant_type: 'authorization_code', code, redirect_uri, code_verifier: verifier });
			await this.#start(volume);
			this.status = 'ready';
		} catch (e) {
			this.#reset();
			this.error = e instanceof Error ? e.message : 'Couldn’t connect to Spotify';
		}
	}

	#reset() {
		this.#sdk = null;
		this.#device = null;
		this.#token = null;
		this.status = 'off';
	}

	async #grant(body: Record<string, string>) {
		const res = await fetch(`${ACCOUNTS}/api/token`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID!, ...body })
		});
		const json = await res.json().catch(() => null);
		if (!res.ok || !json?.access_token) throw new Error('Spotify sign-in failed');
		this.#token = {
			value: json.access_token,
			refresh: json.refresh_token ?? this.#token?.refresh ?? '',
			expires: Date.now() + json.expires_in * 1000
		};
		return json.access_token as string;
	}

	#access(): Promise<string> {
		const t = this.#token;
		if (!t) return Promise.reject(new Error('Not signed in'));
		if (t.expires > Date.now() + 60_000) return Promise.resolve(t.value);
		this.#refreshing ??= this.#grant({ grant_type: 'refresh_token', refresh_token: t.refresh }).finally(
			() => (this.#refreshing = null)
		);
		return this.#refreshing;
	}

	async #start(volume: number) {
		await load_sdk();
		const sdk = new window.Spotify!.Player({
			name: document.title || 'Music',
			getOAuthToken: (cb) => void this.#access().then(cb),
			volume
		});
		const device = new Promise<string>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('Spotify player didn’t start')), 15_000);
			sdk.addListener('ready', ({ device_id }) => {
				clearTimeout(timer);
				this.#device = device_id;
				resolve(device_id);
			});
			sdk.addListener('account_error', () => {
				clearTimeout(timer);
				reject(new Error('Full songs need Spotify Premium'));
			});
			sdk.addListener('initialization_error', ({ message }) => {
				clearTimeout(timer);
				reject(new Error(message || 'This browser can’t play full songs'));
			});
			sdk.addListener('authentication_error', () => {
				clearTimeout(timer);
				reject(new Error('Spotify sign-in failed'));
			});
		});
		sdk.addListener('not_ready', () => (this.#device = null));
		sdk.addListener('ready', ({ device_id }) => (this.#device = device_id));
		sdk.addListener('player_state_changed', (state: SdkState | null) => {
			for (const cb of this.#listeners) cb(state);
		});
		this.#sdk = sdk;
		if (!(await sdk.connect())) throw new Error('Spotify player didn’t start');
		await device;
	}

	async #api(path: string, init: RequestInit = {}) {
		const res = await fetch(`${API}${path}`, {
			...init,
			headers: { Authorization: `Bearer ${await this.#access()}`, 'Content-Type': 'application/json', ...init.headers }
		});
		if (res.status === 204 || res.status === 202) return null;
		const json = await res.json().catch(() => null);
		if (!res.ok) throw new Error(json?.error?.message ?? `Spotify ${res.status}`);
		return json;
	}

	find(item: QueueItem): Promise<string | null> {
		if (item.uri) return Promise.resolve(item.uri);
		const key = `${item.artist}\u0000${item.name}`.toLowerCase();
		let found = this.#uris.get(key);
		if (!found) {
			const q = `track:${item.name.replace(/"/g, '')} artist:${item.artist.replace(/"/g, '')}`;
			found = this.#api(`/search?type=track&limit=10&q=${encodeURIComponent(q)}`)
				.then((r) => {
					const hit = best<SdkTrack>(r?.tracks?.items ?? [], item, (t) => ({
						name: t.name,
						artist: t.artists.map((a) => a.name).join(', ')
					}));
					return hit?.uri ?? null;
				})
				.catch(() => {
					this.#uris.delete(key);
					return null;
				});
			this.#uris.set(key, found);
		}
		return found;
	}

	activate() {
		void this.#sdk?.activateElement();
	}

	async play(uri: string) {
		if (!this.#device) throw new Error('Spotify player isn’t ready');
		await this.#api(`/me/player/play?device_id=${encodeURIComponent(this.#device)}`, {
			method: 'PUT',
			body: JSON.stringify({ uris: [uri] })
		});
	}

	toggle = () => this.#sdk?.togglePlay();
	pause = () => this.#sdk?.pause();
	resume = () => this.#sdk?.resume();
	seek = (seconds: number) => this.#sdk?.seek(Math.round(seconds * 1000));
	set_volume = (v: number) => this.#sdk?.setVolume(v);
}

export const spotify = new Spotify();
