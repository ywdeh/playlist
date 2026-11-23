import { error, isHttpError } from '@sveltejs/kit';
import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } from '$app/env/private';
import { DEFAULT_PERIOD, PERIODS, type Artist, type ArtistData, type Live, type LiveData, type Period, type Playlist, type Song, type Top, type Listens, LISTEN_DAYS } from '#lib/music';
import { norm, same_artist, song_key } from '#lib/match';
import { FAVOURITE_PLAYLIST } from '#lib/site';
import { artist_songs } from './previews';
import { Loading, peek, remember, shared_get, shared_put, stored } from './cache';

const API = 'https://api.spotify.com/v1';
const ACCOUNTS = 'https://accounts.spotify.com';

export const OWNER_SCOPES = 'user-top-read user-read-recently-played user-read-currently-playing user-library-read';

// Just under the cron's 30-minute interval, so every cron run finds the data stale and refreshes it.
const SYNC_EVERY_S = 1500;
const NOW_TTL_S = 4;
const TOKEN_MARGIN_MS = 30_000;
const COOL_MIN_S = 5;
const COOL_MAX_S = 86400;
const COOL_READ_MS = 60_000;
const TOP_SONGS = 24;
const TOP_ARTISTS = 8;
const RECENT = 16;
const PLAYS_KEY = 'plays1';
const PLAYS_KEEP_DAYS = 30;
const DAY_MS = 86_400_000;

export class SpotifyError extends Error {
	constructor(
		public status: number,
		message: string,
		public until = 0
	) {
		super(message);
	}
}

const UNREACHABLE = -1;
const unreachable = (): never => {
	throw new SpotifyError(UNREACHABLE, 'unreachable');
};

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
	if (Date.now() < cool.until) throw new SpotifyError(429, 'Too many requests', cool.until);
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
	}).catch(unreachable);
	cool_down(res, 'sign-in');
	const json = (await res.json().catch(() => null)) as any;
	if (!res.ok || !json?.access_token) throw new SpotifyError(res.status, json?.error_description ?? 'Spotify sign-in failed', cools.get('sign-in')?.until);
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
	const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${await access_token()}` } }).catch(unreachable);
	if (res.status === 401 && retry) {
		token = null;
		return request(path, false);
	}
	cool_down(res, path);
	if (res.status === 204) return null;
	const json = (await res.json().catch(() => null)) as any;
	if (!res.ok) throw new SpotifyError(res.status, json?.error?.message ?? `upstream ${res.status}`, cools.get(endpoint(path))?.until);
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

// Spotify only ever returns the last 50 plays, so we keep our own log and merge into it on every sync.
interface PlayLog {
	plays: [id: string, at: number][];
	tracks: Record<string, Track>;
}

async function log_plays(): Promise<PlayLog> {
	const [prev, recent] = await Promise.all([peek<PlayLog>(PLAYS_KEY), items('/me/player/recently-played?limit=50')]);
	const tracks = { ...prev?.tracks };
	const plays = [...(prev?.plays ?? [])];
	const seen = new Set(plays.map(([id, at]) => `${id}@${at}`));
	for (const x of recent) {
		const at = Date.parse(x?.played_at);
		if (!x?.track?.id || !at || seen.has(`${x.track.id}@${at}`)) continue;
		seen.add(`${x.track.id}@${at}`);
		plays.push([x.track.id, at]);
		tracks[x.track.id] = slim_track(x.track);
	}
	const since = Date.now() - PLAYS_KEEP_DAYS * DAY_MS;
	const kept = plays.filter(([, at]) => at >= since).sort((a, b) => a[1] - b[1]);
	const used = new Set(kept.map(([id]) => id));
	return { plays: kept, tracks: Object.fromEntries(Object.entries(tracks).filter(([id]) => used.has(id))) };
}

export const play_log = () => stored(PLAYS_KEY, SYNC_EVERY_S, log_plays);

// Called by the cron every 30 minutes: starts a refresh of anything older than SYNC_EVERY_S.
export async function sync_all() {
	const [lib, log] = await Promise.all([library(), play_log(), favourites().catch(() => null)]);
	return { library: new Date(lib.synced).toISOString(), plays: log.plays.length };
}

// The latest plays, newest first, each song once (at its latest play).
function recently_listened(log: PlayLog): Song[] {
	const seen = new Set<string>();
	const out: Song[] = [];
	for (let i = log.plays.length - 1; i >= 0 && out.length < RECENT; i--) {
		const [id, at] = log.plays[i];
		const song = to_song(log.tracks[id]);
		if (!song || seen.has(song_key(song))) continue;
		seen.add(song_key(song));
		out.push({ ...song, played: new Date(at).toISOString() });
	}
	return out;
}

// Every play from the last LISTEN_DAYS days (plus one, to reach back to the viewer's midnight) as
// [played at, track length]. The page splits them into days by the viewer's own clock, since the
// server doesn't know their time zone. Track length is an estimate: Spotify only logs plays past
// ~30s and doesn't say how much was heard.
function listens(log: PlayLog): Listens {
	const since = Date.now() - (LISTEN_DAYS + 1) * DAY_MS;
	return {
		from: log.plays[0]?.[1] ?? Date.now(),
		plays: log.plays.filter(([, at]) => at >= since).map(([id, at]) => [at, Math.round((log.tracks[id]?.duration_ms ?? 0) / 1000)])
	};
}

const top_of = (lib: Library, period: Period): Top => ({
	period,
	tracks: songs(lib.top[period].tracks).slice(0, TOP_SONGS),
	artists: lib.top[period].artists.slice(0, TOP_ARTISTS).map(to_artist)
});

interface Pool {
	tracks: Track[];
	artists: RawArtist[];
}

interface RawPlaylist {
	name: string;
	images: Image[];
	url: string;
	tracks: Track[];
}

async function read_playlist(id: string): Promise<RawPlaylist> {
	const p = await request(`/playlists/${encodeURIComponent(id)}`);
	const raw: any[] = (p?.tracks?.items ?? p?.items?.items ?? []).map((x: any) => x.track ?? x.item);
	return {
		name: p?.name ?? 'playlist',
		images: p?.images ?? [],
		url: p?.external_urls?.spotify ?? `https://open.spotify.com/playlist/${id}`,
		tracks: raw.filter((t) => t?.id && t.type === 'track' && !t.is_local).map(slim_track)
	};
}

const favourites = () => stored(`playlist3:${FAVOURITE_PLAYLIST}`, SYNC_EVERY_S, () => read_playlist(FAVOURITE_PLAYLIST));

export async function load_playlist(): Promise<Playlist> {
	const p = await favourites();
	return { name: p.name, image: image(p.images, 300), url: p.url, songs: songs(p.tracks).filter((s): s is Song & { spotify: string } => !!s.spotify) };
}

async function pool(): Promise<Pool> {
	const [lib, playlist, log] = await Promise.all([library(), favourites().catch(() => null), play_log().catch(() => null)]);
	const seen = new Set<string>();
	const tracks = [...all_tracks(lib), ...(playlist?.tracks ?? []), ...Object.values(log?.tracks ?? {})].filter((t) => !seen.has(t.id) && seen.add(t.id));
	return { tracks, artists: all_artists(lib) };
}
const credited = (t: Track, artist: string) => t.artists.some((a) => norm(a.name) === norm(artist));

function find_artist({ tracks, artists }: Pool, name: string): (Artist & { name: string }) | null {
	const want = norm(name);
	const top = artists.find((a) => norm(a.name) === want);
	if (top) return to_artist(top);
	for (const t of tracks) {
		const a = t.artists.find((a) => norm(a.name) === want);
		if (a) return { name: a.name, image: null, spotify: a.external_urls?.spotify };
	}
	return null;
}

export async function owner_song(name: string, artist: string): Promise<Song | null> {
	const want = song_key({ name, artist });
	const hit = (await pool()).tracks.find((t) => song_key({ name: t.name, artist: t.artists[0]?.name ?? '' }) === want);
	return hit ? to_song(hit) : null;
}

export async function artist_image(name: string): Promise<string | null> {
	return find_artist(await pool(), name)?.image ?? null;
}

async function read_now_playing(): Promise<Live | null> {
	const r = await request('/me/player/currently-playing');
	if (!r?.is_playing || r.currently_playing_type !== 'track') return null;
	const song = to_song(r.item);
	if (!song) return null;
	return { ...song, started: Date.now() - (r.progress_ms ?? 0), length: r.item.duration_ms ?? 0 };
}

export const get_now_playing = () => remember('spotify:now', NOW_TTL_S, read_now_playing);

export async function load_live(): Promise<LiveData> {
	const now = get_now_playing().catch(() => null);
	const log = play_log().catch((e) => {
		report('play log', e);
		return null;
	});
	try {
		const lib = await library();
		const plays = await log;
		return {
			...top_of(lib, DEFAULT_PERIOD),
			recent: plays ? recently_listened(plays) : [],
			listens: plays?.plays.length ? listens(plays) : null,
			updated: new Date(lib.synced).toISOString(),
			now: await now
		};
	} catch (e) {
		fail(e);
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
	let known: Pool;
	try {
		known = await pool();
	} catch (e) {
		fail(e);
	}
	const found = find_artist(known, name);
	if (!found) error(404, 'that artist isn’t in my music');
	const artist = found.name;
	// Only songs from the favourite playlist count as "mine"; other listening is left to the popular list.
	const playlist = await favourites().catch(() => null);
	const yours = songs((playlist?.tracks ?? []).filter((t) => credited(t, artist)));
	// Any song I've played helps Deezer find the right artist, playlist or not.
	const seeds = known.tracks.filter((t) => credited(t, artist)).slice(0, 3).map((t) => t.name);
	const popular = await artist_songs(artist, seeds).catch(() => []);
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

function wait_text(until: number) {
	const minutes = Math.ceil((until - Date.now()) / 60_000);
	if (minutes <= 1) return 'in a minute';
	if (minutes < 60) return `in about ${minutes} minutes`;
	const hours = Math.round(minutes / 60);
	return `in about ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

export function describe(e: unknown): { status: number; message: string } {
	if (e instanceof Loading) return { status: 503, message: 'my music is still loading from spotify, try again in a moment' };
	if (e instanceof SpotifyError) {
		if (e.status === UNREACHABLE) return { status: 502, message: 'couldn’t reach spotify' };
		if (e.status === 0) return { status: 500, message: 'spotify isn’t set up on the server yet' };
		if (e.status === 429) return { status: 503, message: `spotify is limiting requests right now, back ${wait_text(e.until)}` };
		if (e.status === 403) return { status: 503, message: 'spotify refused access to my account' };
		if (e.status === 400 || e.status === 401) return { status: 503, message: 'spotify needs to be connected again' };
		if (e.status === 404) return { status: 502, message: 'spotify couldn’t find that' };
		if (e.status >= 500) return { status: 502, message: 'spotify is having trouble right now' };
		return { status: 502, message: `spotify answered with an error (${e.status})` };
	}
	return { status: 500, message: `the server hit a problem: ${e instanceof Error ? e.message.toLowerCase() : 'unknown'}` };
}
export function report(where: string, e: unknown) {
	if (e instanceof Loading || (e instanceof SpotifyError && e.status === 429)) return;
	const detail = e instanceof SpotifyError ? `spotify ${e.status} ${e.message}` : e instanceof Error ? e.message : String(e);
	console.error(`${where}: ${detail}`);
}

function fail(e: unknown): never {
	if (isHttpError(e)) throw e;
	report('loading page', e);
	const { status, message } = describe(e);
	error(status, message);
}
