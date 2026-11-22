import { error, isHttpError } from '@sveltejs/kit';
import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } from '$app/env/private';
import { PERIODS, type Artist, type ArtistData, type Live, type LiveData, type Period, type Playlist, type Song, type Top } from '#lib/music';
import { norm, same_artist, song_key } from '#lib/match';
import { artist_songs } from './previews';
import { last, remember, shared_get, shared_put, stored } from './cache';

const API = 'https://api.spotify.com/v1';
const ACCOUNTS = 'https://accounts.spotify.com';

export const OWNER_SCOPES = 'user-top-read user-read-recently-played user-read-currently-playing user-library-read';

const SYNC_EVERY_S = 7200;
const NOW_TTL_S = 4;
const TOKEN_MARGIN_MS = 30_000;
const COOL_MIN_S = 5;
const COOL_MAX_S = 86400;
const COOL_READ_MS = 60_000;
const TOP_SONGS = 25;
const TOP_ARTISTS = 8;
const ENJOYED = 12;
const LEGACY_LIVE = 'live3';

export class SpotifyError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
	}
}

const cools = new Map<string, { until: number; read: number }>();
const endpoint = (path: string) => path.split('?')[0].replace(/\/\w{22}$/, '');

async function cooling(where: string) {
	const key = endpoint(where);
	const cool = cools.get(key) ?? { until: 0, read: 0 };
	if (Date.now() - cool.read > COOL_READ_MS) {
		cool.read = Date.now();
		cool.until = Math.max(cool.until, Number(await shared_get(`cool:${key}`)) || 0);
		cools.set(key, cool);
	}
	if (Date.now() < cool.until) throw new SpotifyError(429, 'Too many requests');
}

function cool_down(res: Response, where: string) {
	if (res.status !== 429) return;
	const key = endpoint(where);
	const wait = Math.min(Math.max(Number(res.headers.get('retry-after')) || COOL_MIN_S, COOL_MIN_S), COOL_MAX_S);
	console.error(`spotify rate limited on ${key}, retry after ${wait}s`);
	const until = Math.max(cools.get(key)?.until ?? 0, Date.now() + wait * 1000);
	cools.set(key, { until, read: Date.now() });
	shared_put(`cool:${key}`, String(until), wait);
}

async function grant(body: Record<string, string>) {
	if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) throw new SpotifyError(0, 'SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET is not set');
	await cooling('sign-in');
	const res = await fetch(`${ACCOUNTS}/api/token`, {
		method: 'POST',
		headers: {
			Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`,
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams(body)
	});
	cool_down(res, 'sign-in');
	const json = (await res.json().catch(() => null)) as any;
	if (!res.ok || !json?.access_token) throw new SpotifyError(res.status, json?.error_description ?? 'Spotify sign-in failed');
	return json as { access_token: string; refresh_token?: string; expires_in: number };
}

export const exchange_code = (code: string, redirect_uri: string) => grant({ grant_type: 'authorization_code', code, redirect_uri });

let token: { value: string; expires: number } | null = null;

async function access_token(): Promise<string> {
	if (token && token.expires > Date.now() + TOKEN_MARGIN_MS) return token.value;
	if (!SPOTIFY_REFRESH_TOKEN) throw new SpotifyError(0, 'SPOTIFY_REFRESH_TOKEN is not set');
	const json = await grant({ grant_type: 'refresh_token', refresh_token: SPOTIFY_REFRESH_TOKEN });
	token = { value: json.access_token, expires: Date.now() + json.expires_in * 1000 };
	return token.value;
}

async function request(path: string, retry = true): Promise<any> {
	await cooling(path);
	const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${await access_token()}` } });
	if (res.status === 401 && retry) {
		token = null;
		return request(path, false);
	}
	cool_down(res, path);
	if (res.status === 204) return null;
	const json = (await res.json().catch(() => null)) as any;
	if (!res.ok) throw new SpotifyError(res.status, json?.error?.message ?? `upstream ${res.status}`);
	return json;
}

const items = async (path: string): Promise<any[]> => (await request(path))?.items ?? [];

type Image = { url: string; width?: number | null };

function image(images: Image[] | undefined, min = 300) {
	if (!images?.length) return null;
	const fits = images.filter((i) => (i.width ?? 0) >= min).sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
	return (fits[0] ?? images[0]).url;
}

const slim_artist = (a: any) => ({ id: a.id, name: a.name, images: a.images, external_urls: a.external_urls });

const slim_track = (t: any) => ({
	id: t.id,
	name: t.name,
	type: t.type,
	is_local: t.is_local,
	duration_ms: t.duration_ms,
	external_urls: t.external_urls,
	external_ids: t.external_ids,
	album: { name: t.album?.name, images: t.album?.images },
	artists: (t.artists ?? []).map(slim_artist) as RawArtist[]
});

type Track = ReturnType<typeof slim_track>;
type RawArtist = ReturnType<typeof slim_artist>;

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

const to_artist = (a: RawArtist): Artist => ({ name: a.name, image: image(a.images, 320), spotify: a.external_urls?.spotify });

const songs = (tracks: any[]) => tracks.map(to_song).filter((s): s is Song => !!s);

interface Library {
	synced: number;
	top: Record<Period, { tracks: Track[]; artists: RawArtist[] }>;
	recent: { track: Track; played_at: string }[];
	saved: Track[];
}

async function sync(): Promise<Library> {
	const top = {} as Library['top'];
	for (const p of PERIODS) {
		const tracks = (await items(`/me/top/tracks?time_range=${p}&limit=50`)).map(slim_track);
		const artists = (await items(`/me/top/artists?time_range=${p}&limit=50`)).map(slim_artist);
		top[p] = { tracks, artists };
	}
	const recent = (await items('/me/player/recently-played?limit=50'))
		.filter((x) => x?.track?.id)
		.map((x) => ({ track: slim_track(x.track), played_at: x.played_at as string }));
	const saved = (await items('/me/tracks?limit=50')).filter((x) => x?.track?.id).map((x) => slim_track(x.track));
	return { synced: Date.now(), top, recent, saved };
}

const library = () => stored('library2', SYNC_EVERY_S, sync);

function all_tracks(lib: Library): Track[] {
	const seen = new Set<string>();
	const pool = [...PERIODS.flatMap((p) => lib.top[p].tracks), ...lib.recent.map((r) => r.track), ...lib.saved];
	return pool.filter((t) => !seen.has(t.id) && seen.add(t.id));
}

const all_artists = (lib: Library) => PERIODS.flatMap((p) => lib.top[p].artists);

function recently_enjoyed(lib: Library): Song[] {
	const ranks = new Map(lib.top.short_term.tracks.map((t, i) => [t.id, i]));
	const liked = new Set(lib.saved.map((t) => t.id));
	const plays = new Map<string, { track: Track; count: number; last: string }>();
	for (const { track, played_at } of lib.recent) {
		const seen = plays.get(track.id);
		if (seen) seen.count++;
		else plays.set(track.id, { track, count: 1, last: played_at });
	}
	const score = ({ track, count }: { track: Track; count: number }) => {
		const rank = ranks.get(track.id);
		return count + (liked.has(track.id) ? 2 : 0) + (rank === undefined ? 0 : 2 - rank / TOP_SONGS);
	};
	return [...plays.values()]
		.filter((p) => score(p) >= 2)
		.sort((a, b) => score(b) - score(a))
		.slice(0, ENJOYED)
		.sort((a, b) => b.last.localeCompare(a.last))
		.flatMap(({ track, last }) => {
			const song = to_song(track);
			return song ? [{ ...song, played: last }] : [];
		});
}

const top_of = (lib: Library, period: Period): Top => ({
	period,
	tracks: songs(lib.top[period].tracks).slice(0, TOP_SONGS),
	artists: lib.top[period].artists.slice(0, TOP_ARTISTS).map(to_artist)
});

const credited = (t: Track, artist: string) => t.artists.some((a) => norm(a.name) === norm(artist));

function find_artist(lib: Library, name: string): (Artist & { name: string }) | null {
	const want = norm(name);
	const top = all_artists(lib).find((a) => norm(a.name) === want);
	if (top) return to_artist(top);
	for (const t of all_tracks(lib)) {
		const a = t.artists.find((a) => norm(a.name) === want);
		if (a) return { name: a.name, image: null, spotify: a.external_urls?.spotify };
	}
	return null;
}

export async function owner_song(name: string, artist: string): Promise<Song | null> {
	const want = song_key({ name, artist });
	const hit = all_tracks(await library()).find((t) => song_key({ name: t.name, artist: t.artists[0]?.name ?? '' }) === want);
	return hit ? to_song(hit) : null;
}

export async function artist_image(name: string): Promise<string | null> {
	return find_artist(await library(), name)?.image ?? null;
}

export async function songs_by(artist: string, max = 3): Promise<string[]> {
	const lib = await library().catch(() => null);
	if (!lib) return [];
	return all_tracks(lib)
		.filter((t) => credited(t, artist))
		.slice(0, max)
		.map((t) => t.name);
}

async function read_now_playing(): Promise<Live | null> {
	const r = await request('/me/player/currently-playing');
	if (!r?.is_playing || r.currently_playing_type !== 'track') return null;
	const song = to_song(r.item);
	if (!song) return null;
	return { ...song, started: Date.now() - (r.progress_ms ?? 0), length: r.item.duration_ms ?? 0 };
}

export const get_now_playing = () => remember('spotify:now', NOW_TTL_S, read_now_playing);

export async function get_playlist(id: string): Promise<Playlist> {
	const p = await request(`/playlists/${encodeURIComponent(id)}`);
	const tracks = songs((p?.tracks?.items ?? p?.items?.items ?? []).map((x: any) => x.track ?? x.item)).filter(
		(s): s is Song & { spotify: string } => !!s.spotify
	);
	return {
		name: p?.name ?? 'playlist',
		image: image(p?.images, 300),
		url: p?.external_urls?.spotify ?? `https://open.spotify.com/playlist/${id}`,
		songs: tracks
	};
}

export async function load_live(): Promise<LiveData> {
	const now = get_now_playing().catch(() => null);
	try {
		const lib = await library();
		return {
			...top_of(lib, 'short_term'),
			enjoyed: recently_enjoyed(lib),
			updated: new Date(lib.synced).toISOString(),
			now: await now
		};
	} catch (e) {
		const old = await last<Omit<LiveData, 'now'>>(LEGACY_LIVE);
		if (!old) fail(e);
		return { ...old, now: await now };
	}
}

export async function load_top(period: Period): Promise<Top> {
	try {
		return top_of(await library(), period);
	} catch (e) {
		fail(e);
	}
}

export async function load_artist(name: string): Promise<ArtistData> {
	let lib: Library;
	try {
		lib = await library();
	} catch (e) {
		fail(e);
	}
	const found = find_artist(lib, name);
	const artist = found?.name ?? name;
	const yours = songs(all_tracks(lib).filter((t) => credited(t, artist)));
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
	if (isHttpError(e)) throw e;
	console.error(e);
	const { status, message } = describe(e);
	error(status, message);
}
