import { error, isHttpError } from '@sveltejs/kit';
import { SPOTIFY_CLIENT_ID } from '$app/env/public';
import { SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } from '$app/env/private';
import type { Artist, ArtistData, LiveData, Period, Played, Playlist, Song, Top } from '#lib/music';
import { norm, same_artist, song_key } from '#lib/match';
import { artist_songs } from './previews';

const API = 'https://api.spotify.com/v1';
const ACCOUNTS = 'https://accounts.spotify.com';

export const OWNER_SCOPES = 'user-top-read user-read-recently-played user-read-currently-playing user-library-read';

export class SpotifyError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
	}
}

const basic = () => `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`;

async function grant(body: Record<string, string>) {
	if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) throw new SpotifyError(0, 'SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET is not set');
	const res = await fetch(`${ACCOUNTS}/api/token`, {
		method: 'POST',
		headers: { Authorization: basic(), 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(body)
	});
	const json = (await res.json().catch(() => null)) as any;
	if (!res.ok || !json?.access_token) throw new SpotifyError(res.status, json?.error_description ?? 'Spotify sign-in failed');
	return json as { access_token: string; refresh_token?: string; expires_in: number };
}

export const exchange_code = (code: string, redirect_uri: string) =>
	grant({ grant_type: 'authorization_code', code, redirect_uri });

let token: { value: string; expires: number } | null = null;
let pending_token: Promise<string> | null = null;

function access_token(): Promise<string> {
	if (token && token.expires > Date.now() + 30_000) return Promise.resolve(token.value);
	pending_token ??= (async () => {
		if (!SPOTIFY_REFRESH_TOKEN) throw new SpotifyError(0, 'SPOTIFY_REFRESH_TOKEN is not set');
		const json = await grant({ grant_type: 'refresh_token', refresh_token: SPOTIFY_REFRESH_TOKEN });
		token = { value: json.access_token, expires: Date.now() + json.expires_in * 1000 };
		return token.value;
	})().finally(() => (pending_token = null));
	return pending_token;
}

const memory = new Map<string, { expires: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

async function fetch_api(path: string, retry = true): Promise<any> {
	const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${await access_token()}` } });
	if (res.status === 401 && retry) {
		token = null;
		return fetch_api(path, false);
	}
	if (res.status === 204) return null;
	const json = (await res.json().catch(() => null)) as any;
	if (!res.ok) throw new SpotifyError(res.status, json?.error?.message ?? `upstream ${res.status}`);
	return json;
}

function call(path: string, ttl_seconds: number): Promise<any> {
	const key = `https://spotify.cache${path}`;
	const hit = memory.get(key);
	if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value);
	const running = inflight.get(key);
	if (running) return running;

	const promise = (async () => {
		const edge = (globalThis as { caches?: { default?: Cache } }).caches?.default;
		const cached = edge ? await edge.match(key).catch(() => undefined) : undefined;
		const value = cached ? await cached.json() : await fetch_api(path);
		memory.set(key, { expires: Date.now() + ttl_seconds * 1000, value });
		if (memory.size > 500) memory.delete(memory.keys().next().value!);
		if (edge && !cached) {
			await edge
				.put(key, new Response(JSON.stringify(value), { headers: { 'Cache-Control': `max-age=${ttl_seconds}` } }))
				.catch(() => {});
		}
		return value;
	})().finally(() => inflight.delete(key));

	inflight.set(key, promise);
	return promise;
}

type Image = { url: string; width?: number | null };

function image(images: Image[] | undefined, min = 300) {
	if (!images?.length) return null;
	const fits = images.filter((i) => (i.width ?? 0) >= min).sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
	return (fits[0] ?? images[0]).url;
}

function to_song(t: any): Song | null {
	if (!t?.name || t.is_local || t.type !== 'track') return null;
	const names: string[] = (t.artists ?? []).map((a: any) => a.name).filter(Boolean);
	return {
		name: t.name,
		artist: names[0] ?? '',
		...(names.length > 1 ? { credits: names.join(', ') } : {}),
		image: image(t.album?.images),
		album: t.album?.name || null,
		duration: t.duration_ms ? Math.round(t.duration_ms / 1000) : null,
		spotify: t.external_urls?.spotify,
		uri: t.uri,
		isrc: t.external_ids?.isrc
	};
}

const to_artist = (a: any): Artist => ({ name: a.name, image: image(a.images, 320), spotify: a.external_urls?.spotify });

const songs = (items: any[] | undefined, pick: (x: any) => any = (x) => x) =>
	(items ?? []).map((x) => to_song(pick(x))).filter((s): s is Song => !!s);

async function raw_tracks(period: Period, limit = 50): Promise<any[]> {
	const r = await call(`/me/top/tracks?time_range=${period}&limit=${limit}`, period === 'short_term' ? 900 : 3600);
	return r?.items ?? [];
}

async function get_top(period: Period): Promise<Top> {
	const ttl = period === 'short_term' ? 900 : 3600;
	const [tracks, artists] = await Promise.all([raw_tracks(period), call(`/me/top/artists?time_range=${period}&limit=20`, ttl)]);
	return {
		period,
		tracks: songs(tracks).slice(0, 25),
		artists: (artists?.items ?? []).map(to_artist)
	};
}

async function get_recent(): Promise<Played[]> {
	const r = await call('/me/player/recently-played?limit=50', 120);
	const seen = new Set<string>();
	const out: Played[] = [];
	for (const item of r?.items ?? []) {
		const song = to_song(item.track);
		if (!song) continue;
		const key = song_key(song);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({ ...song, at: item.played_at });
		if (out.length === 16) break;
	}
	return out;
}

async function get_saved(): Promise<Song[]> {
	const r = await call('/me/tracks?limit=12', 600);
	return songs(r?.items, (x) => x.track);
}

export async function get_now_playing(): Promise<Song | null> {
	const r = await call('/me/player/currently-playing', 15);
	if (!r?.is_playing || r.currently_playing_type !== 'track') return null;
	return to_song(r.item);
}

async function owner_tracks(): Promise<any[]> {
	const lists = await Promise.all([
		...(['long_term', 'medium_term', 'short_term'] as const).map((p) => raw_tracks(p).catch(() => [])),
		call('/me/player/recently-played?limit=50', 120)
			.then((r) => (r?.items ?? []).map((x: any) => x.track))
			.catch(() => []),
		call('/me/tracks?limit=50', 600)
			.then((r) => (r?.items ?? []).map((x: any) => x.track))
			.catch(() => [])
	]);
	const seen = new Set<string>();
	return lists.flat().filter((t) => t?.id && !seen.has(t.id) && seen.add(t.id));
}

async function owner_artists(): Promise<any[]> {
	const lists = await Promise.all(
		(['long_term', 'medium_term', 'short_term'] as const).map((p) =>
			call(`/me/top/artists?time_range=${p}&limit=50`, 3600)
				.then((r) => r?.items ?? [])
				.catch(() => [])
		)
	);
	return lists.flat();
}

const credited = (t: any, artist: string) => (t.artists ?? []).some((a: any) => norm(a.name) === norm(artist));

export async function songs_by(artist: string, max = 3): Promise<string[]> {
	try {
		return (await owner_tracks())
			.filter((t) => credited(t, artist))
			.slice(0, max)
			.map((t) => t.name as string);
	} catch {
		return [];
	}
}

async function find_artist(name: string): Promise<{ id: string; name: string; image: string | null; spotify?: string } | null> {
	const want = norm(name);
	const top = (await owner_artists()).find((a) => norm(a.name) === want);
	if (top) return { id: top.id, ...to_artist(top) };
	for (const t of await owner_tracks()) {
		const a = (t.artists ?? []).find((a: any) => norm(a.name) === want);
		if (!a?.id) continue;
		const full = await call(`/artists/${a.id}`, 86400).catch(() => null);
		return { id: a.id, name: a.name, image: image(full?.images, 320), spotify: a.external_urls?.spotify };
	}
	return null;
}

export async function artist_image(name: string): Promise<string | null> {
	return (await find_artist(name).catch(() => null))?.image ?? null;
}

export async function artist_link(name: string): Promise<string | null> {
	return (await find_artist(name).catch(() => null))?.spotify ?? null;
}

export async function owner_song(name: string, artist: string): Promise<Song | null> {
	const pool = await owner_tracks().catch(() => []);
	const want = song_key({ name, artist });
	const hit = pool.find((t) => song_key({ name: t.name, artist: t.artists?.[0]?.name ?? '' }) === want);
	return hit ? to_song(hit) : null;
}

export async function get_playlist(id: string): Promise<Playlist> {
	const p = await call(`/playlists/${encodeURIComponent(id)}`, 900);
	const tracks = songs(p?.tracks?.items ?? p?.items?.items, (x) => x.track ?? x.item).filter(
		(s): s is Song & { spotify: string } => !!s.spotify
	);
	return {
		name: p?.name ?? 'Playlist',
		image: image(p?.images, 300),
		url: p?.external_urls?.spotify ?? `https://open.spotify.com/playlist/${id}`,
		songs: tracks
	};
}

export async function load_live(): Promise<LiveData> {
	try {
		const [top, recent, fresh, now] = await Promise.all([
			get_top('short_term'),
			get_recent(),
			get_saved().catch(() => []),
			get_now_playing().catch(() => null)
		]);
		return { ...top, updated: new Date().toISOString(), recent, fresh, now };
	} catch (e) {
		fail(e);
	}
}

export async function load_top(period: Period): Promise<Top> {
	try {
		return await get_top(period);
	} catch (e) {
		fail(e);
	}
}

export async function load_artist(name: string): Promise<ArtistData> {
	try {
		const [found, pool] = await Promise.all([find_artist(name), owner_tracks()]);
		const artist = found?.name ?? name;
		const yours = songs(pool.filter((t) => credited(t, artist)));
		const popular = await artist_songs(artist, yours.slice(0, 3).map((s) => s.name)).catch(() => []);
		if (!found && !yours.length && !popular.length) error(404, "We couldn't find that artist.");
		const mine = new Set(yours.map(song_key));
		return {
			artist,
			image: found?.image ?? null,
			spotify: found?.spotify,
			yours,
			popular: popular
				.filter((s) => !mine.has(song_key(s)) && same_artist(artist, s.artist))
				.map((s) => ({ ...s, image: s.image ?? null }))
		};
	} catch (e) {
		if (isHttpError(e)) throw e;
		fail(e);
	}
}

export function describe(e: unknown): { status: number; message: string } {
	if (e instanceof SpotifyError) {
		if (e.status === 0) return { status: 500, message: e.message };
		if (e.status === 429) return { status: 503, message: 'Too many requests right now. Try again in a minute.' };
		if (e.status === 403) return { status: 503, message: 'Spotify refused access. Check the app’s users in the Spotify dashboard.' };
		if (e.status === 400 || e.status === 401) return { status: 503, message: 'Spotify needs to be connected again.' };
		return { status: 502, message: 'Spotify had a hiccup. Try again shortly.' };
	}
	return { status: 500, message: 'Something went wrong.' };
}

function fail(e: unknown): never {
	console.error(e);
	const { status, message } = describe(e);
	error(status, message);
}
