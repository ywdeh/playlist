import { error, isHttpError } from '@sveltejs/kit';
import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } from '$app/env/private';
import type { Artist, ArtistData, Live, LiveData, Period, Playlist, Song, Top } from '#lib/music';
import { norm, same_artist, song_key } from '#lib/match';
import { artist_songs } from './previews';
import { stored } from './snapshot';

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

const COOL_MIN_S = 5;
const COOL_MAX_S = 3600;
let cool_until = 0;

function cool_down(res: Response, where: string) {
	if (res.status !== 429) return;
	const wait = Number(res.headers.get('retry-after')) || COOL_MIN_S;
	console.error(`spotify rate limited on ${where}, retry after ${wait}s`);
	cool_until = Date.now() + Math.min(Math.max(wait, COOL_MIN_S), COOL_MAX_S) * 1000;
}

const basic = () => `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`;

async function grant(body: Record<string, string>) {
	if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) throw new SpotifyError(0, 'SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET is not set');
	const res = await fetch(`${ACCOUNTS}/api/token`, {
		method: 'POST',
		headers: { Authorization: basic(), 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(body)
	});
	cool_down(res, 'sign-in');
	const json = (await res.json().catch(() => null)) as any;
	if (!res.ok || !json?.access_token) throw new SpotifyError(res.status, json?.error_description ?? 'Spotify sign-in failed');
	return json as { access_token: string; refresh_token?: string; expires_in: number };
}

export const exchange_code = (code: string, redirect_uri: string) =>
	grant({ grant_type: 'authorization_code', code, redirect_uri });

let token: { value: string; expires: number } | null = null;

async function access_token(): Promise<string> {
	if (token && token.expires > Date.now() + 30_000) return token.value;
	if (!SPOTIFY_REFRESH_TOKEN) throw new SpotifyError(0, 'SPOTIFY_REFRESH_TOKEN is not set');
	const json = await grant({ grant_type: 'refresh_token', refresh_token: SPOTIFY_REFRESH_TOKEN });
	token = { value: json.access_token, expires: Date.now() + json.expires_in * 1000 };
	return token.value;
}

const TTL = {
	now: 4,
	recent: 60,
	saved: 300,
	month: 600,
	top: 3600,
	artist: 86400,
	playlist: 900
} as const;

const period_ttl = (period: Period) => (period === 'short_term' ? TTL.month : TTL.top);

type Entry = { at: number; value: any };

const memory = new Map<string, Entry & { expires: number }>();

async function fetch_api(path: string, retry = true): Promise<any> {
	if (Date.now() < cool_until) throw new SpotifyError(429, 'Too many requests');
	const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${await access_token()}` } });
	if (res.status === 401 && retry) {
		token = null;
		return fetch_api(path, false);
	}
	cool_down(res, path);
	if (res.status === 204) return null;
	const json = (await res.json().catch(() => null)) as any;
	if (!res.ok) throw new SpotifyError(res.status, json?.error?.message ?? `upstream ${res.status}`);
	return json;
}

async function cached_entry(path: string, ttl_seconds: number): Promise<Entry> {
	const key = `https://spotify.cache/v2${path}`;
	const hit = memory.get(key);
	if (hit && hit.expires > Date.now()) return hit;
	const edge = (globalThis as { caches?: { default?: Cache } }).caches?.default;
	const kept = edge ? await edge.match(key).catch(() => undefined) : undefined;
	const entry: Entry = kept
		? await kept.json()
		: await fetch_api(path).then(
				(value) => ({ at: Date.now(), value }),
				(e) => {
					if (hit) return hit;
					throw e;
				}
			);
	if (entry === hit) return hit;
	memory.delete(key);
	memory.set(key, { ...entry, expires: entry.at + ttl_seconds * 1000 });
	if (memory.size > 500) memory.delete(memory.keys().next().value!);
	if (edge && !kept) {
		await edge
			.put(key, new Response(JSON.stringify(entry), { headers: { 'Cache-Control': `max-age=${ttl_seconds}` } }))
			.catch(() => {});
	}
	return entry;
}

const call = async (path: string, ttl_seconds: number) => (await cached_entry(path, ttl_seconds)).value;

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
		artist_spotify: t.artists?.[0]?.external_urls?.spotify,
		isrc: t.external_ids?.isrc
	};
}

const to_artist = (a: any): Artist => ({ name: a.name, image: image(a.images, 320), spotify: a.external_urls?.spotify });

const songs = (items: any[] | undefined, pick: (x: any) => any = (x) => x) =>
	(items ?? []).map((x) => to_song(pick(x))).filter((s): s is Song => !!s);

type Source = readonly [path: string, ttl: number];

const source = {
	tracks: (p: Period): Source => [`/me/top/tracks?time_range=${p}&limit=50`, period_ttl(p)],
	artists: (p: Period): Source => [`/me/top/artists?time_range=${p}&limit=50`, period_ttl(p)],
	recent: (): Source => ['/me/player/recently-played?limit=50', TTL.recent],
	saved: (limit: number): Source => [`/me/tracks?limit=${limit}`, TTL.saved]
};

const read = (s: Source) => cached_entry(...s);
const items = async (s: Source): Promise<any[]> => (await read(s)).value?.items ?? [];

const top_songs = (r: any) => songs(r?.items).slice(0, 25);
const TOP_ARTISTS = 8;
const top_artists = (r: any) => (r?.items ?? []).slice(0, TOP_ARTISTS).map(to_artist);

const ENJOYED = 12;

function recently_enjoyed(recent: any, month: any, saved: any[]): Song[] {
	const ranks = new Map<string, number>((month?.items ?? []).map((t: any, i: number) => [t.id, i]));
	const liked = new Set(saved.map((x) => x?.track?.id).filter(Boolean));
	const plays = new Map<string, { track: any; count: number; last: string }>();
	for (const { track, played_at } of recent?.items ?? []) {
		if (!track?.id) continue;
		const seen = plays.get(track.id);
		if (seen) seen.count++;
		else plays.set(track.id, { track, count: 1, last: played_at });
	}
	const score = ({ track, count }: { track: any; count: number }) => {
		const rank = ranks.get(track.id);
		return count + (liked.has(track.id) ? 2 : 0) + (rank === undefined ? 0 : 2 - rank / 25);
	};
	return [...plays.values()]
		.map((p) => ({ ...p, score: score(p) }))
		.filter((p) => p.score >= 2)
		.sort((a, b) => b.score - a.score)
		.slice(0, ENJOYED)
		.sort((a, b) => b.last.localeCompare(a.last))
		.flatMap(({ track, last }) => {
			const song = to_song(track);
			return song ? [{ ...song, played: last }] : [];
		});
}

async function get_top(period: Period): Promise<Top> {
	const [tracks, artists] = await Promise.all([read(source.tracks(period)), read(source.artists(period))]);
	return { period, tracks: top_songs(tracks.value), artists: top_artists(artists.value) };
}

async function get_live(): Promise<Omit<LiveData, 'now'>> {
	const [tracks, artists, recent, saved] = await Promise.all([
		read(source.tracks('short_term')),
		read(source.artists('short_term')),
		read(source.recent()),
		read(source.saved(50))
	]);
	return {
		period: 'short_term',
		tracks: top_songs(tracks.value),
		artists: top_artists(artists.value),
		enjoyed: recently_enjoyed(recent.value, tracks.value, saved.value?.items ?? []),
		updated: new Date(Math.min(tracks.at, artists.at, recent.at, saved.at)).toISOString()
	};
}

let playing: { at: number; value: Live | null } | null = null;

async function read_now_playing(): Promise<Live | null> {
	const r = await fetch_api('/me/player/currently-playing');
	if (!r?.is_playing || r.currently_playing_type !== 'track') return null;
	const song = to_song(r.item);
	if (!song) return null;
	return { ...song, started: Date.now() - (r.progress_ms ?? 0), length: r.item.duration_ms ?? 0 };
}

const NOW_KEY = 'https://spotify.cache/now';

async function shared_now_playing(): Promise<Live | null> {
	const edge = (globalThis as { caches?: { default?: Cache } }).caches?.default;
	const kept = edge ? await edge.match(NOW_KEY).catch(() => undefined) : undefined;
	if (kept) return kept.json();
	const value = await read_now_playing();
	if (edge) {
		const body = new Response(JSON.stringify(value), { headers: { 'Cache-Control': `max-age=${TTL.now}` } });
		await edge.put(NOW_KEY, body).catch(() => {});
	}
	return value;
}

export async function get_now_playing(): Promise<Live | null> {
	if (playing && Date.now() - playing.at <= TTL.now * 1000) return playing.value;
	const value = await shared_now_playing();
	playing = { at: Date.now(), value };
	return value;
}

const PERIOD_ORDER = ['long_term', 'medium_term', 'short_term'] as const;

async function owner_tracks(): Promise<any[]> {
	const lists = await Promise.all([
		...PERIOD_ORDER.map((p) => items(source.tracks(p))),
		items(source.recent())
			.then((list) => list.map((x) => x.track))
			.catch(() => []),
		items(source.saved(50))
			.then((list) => list.map((x) => x.track))
			.catch(() => [])
	]);
	const seen = new Set<string>();
	return lists.flat().filter((t) => t?.id && !seen.has(t.id) && seen.add(t.id));
}

async function owner_artists(): Promise<any[]> {
	return (await Promise.all(PERIOD_ORDER.map((p) => items(source.artists(p))))).flat();
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
		const full = await call(`/artists/${a.id}`, TTL.artist).catch(() => null);
		return { id: a.id, name: a.name, image: image(full?.images, 320), spotify: a.external_urls?.spotify };
	}
	return null;
}

export async function artist_image(name: string): Promise<string | null> {
	return (await find_artist(name).catch(() => null))?.image ?? null;
}

export async function owner_song(name: string, artist: string): Promise<Song | null> {
	const pool = await owner_tracks();
	const want = song_key({ name, artist });
	const hit = pool.find((t) => song_key({ name: t.name, artist: t.artists?.[0]?.name ?? '' }) === want);
	return hit ? to_song(hit) : null;
}

export async function get_playlist(id: string): Promise<Playlist> {
	const p = await call(`/playlists/${encodeURIComponent(id)}`, TTL.playlist);
	const tracks = songs(p?.tracks?.items ?? p?.items?.items, (x) => x.track ?? x.item).filter(
		(s): s is Song & { spotify: string } => !!s.spotify
	);
	return {
		name: p?.name ?? 'playlist',
		image: image(p?.images, 300),
		url: p?.external_urls?.spotify ?? `https://open.spotify.com/playlist/${id}`,
		songs: tracks
	};
}

const REFRESH = { live: 600, top: 3600, artist: 21600 } as const;

async function from_store<T>(key: string, max_age_s: number, load: () => Promise<T>): Promise<T> {
	try {
		return await stored(key, max_age_s, load);
	} catch (e) {
		if (isHttpError(e)) throw e;
		fail(e);
	}
}

export async function load_live(): Promise<LiveData> {
	const now = get_now_playing().catch(() => null);
	const live = await from_store('live3', REFRESH.live, get_live);
	return { ...live, now: await now };
}

export const load_top = (period: Period): Promise<Top> => from_store(`top:${period}`, REFRESH.top, () => get_top(period));

export const load_artist = (name: string): Promise<ArtistData> =>
	from_store(`artist:${norm(name)}`, REFRESH.artist, () => read_artist(name));

async function read_artist(name: string): Promise<ArtistData> {
	const [found, pool] = await Promise.all([find_artist(name), owner_tracks()]);
	const artist = found?.name ?? name;
	const yours = songs(pool.filter((t) => credited(t, artist)));
	const popular = await artist_songs(artist, yours.slice(0, 3).map((s) => s.name)).catch(() => []);
	if (!found && !yours.length && !popular.length) error(404, "we couldn't find that artist");
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
}

export function describe(e: unknown): { status: number; message: string } {
	if (e instanceof SpotifyError) {
		if (e.status === 0) return { status: 500, message: e.message };
		if (e.status === 429) return { status: 503, message: 'too many requests right now, try again in a minute' };
		if (e.status === 403) return { status: 503, message: 'spotify refused access, check the app’s users in the spotify dashboard' };
		if (e.status === 400 || e.status === 401) return { status: 503, message: 'spotify needs to be connected again' };
		return { status: 502, message: 'spotify had a hiccup, try again shortly' };
	}
	return { status: 500, message: 'something went wrong' };
}

function fail(e: unknown): never {
	console.error(e);
	const { status, message } = describe(e);
	error(status, message);
}
