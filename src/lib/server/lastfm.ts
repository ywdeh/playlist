import { error, isHttpError } from '@sveltejs/kit';
import { LASTFM_API_KEY } from '$app/env/private';
import {
	type ArtistData,
	type LfmArtist,
	type LfmNew,
	type LfmPeriod,
	type LfmScrobble,
	type LfmTrack,
	type LfmUser,
	type LiveData,
	type Song
} from '#lib/lastfm';
import { artist_songs, with_info } from './previews';

const API = 'https://ws.audioscrobbler.com/2.0/';
const PLACEHOLDER = '2a96cbd8b46e442fc41c2b86b821562f';

export class LastfmError extends Error {
	constructor(
		public code: number,
		message: string
	) {
		super(message);
	}
}

const memory = new Map<string, { expires: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

async function call<T = any>(method: string, params: Record<string, string>, ttl_seconds: number): Promise<T> {
	if (!LASTFM_API_KEY) throw new LastfmError(0, 'LASTFM_API_KEY is not set');
	const query = new URLSearchParams({ method, ...params, format: 'json' });
	const key = `https://lastfm.cache/${query}`;

	const hit = memory.get(key);
	if (hit && hit.expires > Date.now()) return hit.value as T;
	const pending = inflight.get(key);
	if (pending) return pending as Promise<T>;

	const promise = (async () => {
		const edge = (globalThis as { caches?: { default?: Cache } }).caches?.default;
		const cached = edge ? await edge.match(key).catch(() => undefined) : undefined;
		if (cached) {
			const value = await cached.json();
			memory.set(key, { expires: Date.now() + ttl_seconds * 1000, value });
			return value as T;
		}

		query.set('api_key', LASTFM_API_KEY!);
		const res = await fetch(`${API}?${query}`, { headers: { 'User-Agent': 'music-stats-site/1.0' } });
		const json = (await res.json().catch(() => null)) as any;
		if (!json) throw new LastfmError(res.status, `upstream ${res.status}`);
		if (json.error) throw new LastfmError(json.error, json.message ?? 'upstream error');

		memory.set(key, { expires: Date.now() + ttl_seconds * 1000, value: json });
		if (memory.size > 500) memory.delete(memory.keys().next().value!);
		if (edge) {
			await edge
				.put(key, new Response(JSON.stringify(json), { headers: { 'Cache-Control': `max-age=${ttl_seconds}` } }))
				.catch(() => {});
		}
		return json as T;
	})().finally(() => inflight.delete(key));

	inflight.set(key, promise);
	return promise;
}

function image(images: { size: string; '#text': string }[] | undefined) {
	const pick = images?.find((i) => i.size === 'extralarge')?.['#text'] || images?.[images.length - 1]?.['#text'];
	return pick && !pick.includes(PLACEHOLDER) ? pick : null;
}

const list = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const int = (v: unknown) => Number.parseInt(String(v ?? 0), 10) || 0;
const key_of = (artist: string, name: string) => `${artist}\u0000${name}`.toLowerCase();

function to_scrobble(x: any): LfmScrobble {
	const now_playing = x['@attr']?.nowplaying === 'true';
	return {
		name: x.name,
		artist: x.artist?.name ?? x.artist?.['#text'] ?? '',
		album: x.album?.['#text'] ?? '',
		image: image(x.image),
		at: now_playing || !x.date?.uts ? null : new Date(int(x.date.uts) * 1000).toISOString(),
		now_playing
	};
}

async function first_play(user: string, plays: Promise<number>): Promise<string | null> {
	try {
		const n = await plays;
		if (!n) return null;
		const r = await call('user.getrecenttracks', { user, limit: '1', page: String(n) }, 86400);
		const oldest = list<any>(r.recenttracks?.track)
			.filter((x) => x.date?.uts)
			.at(-1);
		return oldest ? new Date(int(oldest.date.uts) * 1000).toISOString() : null;
	} catch {
		return null;
	}
}

async function get_user(user: string): Promise<LfmUser> {
	const { user: u } = await call('user.getinfo', { user }, 600);
	return { name: u.name, image: image(u.image), tracks: int(u.track_count), plays: int(u.playcount) };
}

async function get_top(user: string, period: LfmPeriod) {
	const ttl = period === '7day' ? 600 : 1800;
	const [t, a] = await Promise.all([
		call('user.gettoptracks', { user, period, limit: '25' }, ttl),
		call('user.gettopartists', { user, period, limit: '20' }, ttl)
	]);
	return {
		tracks: list<any>(t.toptracks?.track).map(
			(x): LfmTrack => ({ name: x.name, artist: x.artist?.name ?? '', image: image(x.image), plays: int(x.playcount) })
		),
		artists: list<any>(a.topartists?.artist).map((x): LfmArtist => ({ name: x.name, plays: int(x.playcount) }))
	};
}

function latest_per_song(plays: LfmScrobble[], max = 16) {
	const seen = new Set<string>();
	const out: LfmScrobble[] = [];
	for (const p of plays) {
		const k = key_of(p.artist, p.name);
		if (seen.has(k)) continue;
		seen.add(k);
		out.push(p);
		if (out.length === max) break;
	}
	return out;
}

async function get_recent_and_new(user: string, total_tracks: Promise<number>, days = 30) {
	const from = String(Math.floor(Date.now() / 1000 / 300) * 300 - days * 86400);
	const window = new Map<string, { name: string; artist: string; image: string | null; count: number; first: number }>();
	const recent_page = (page: number) =>
		call('user.getrecenttracks', { user, from, limit: '200', page: String(page), extended: '1' }, 300);
	const overall_p = call('user.gettoptracks', { user, period: 'overall', limit: '1000' }, 3600);
	overall_p.catch(() => {});

	const first = await recent_page(1);
	const page_count = Math.min(6, int(first.recenttracks?.['@attr']?.totalPages));
	const rest = await Promise.all(Array.from({ length: Math.max(0, page_count - 1) }, (_, i) => recent_page(i + 2)));
	let recent = latest_per_song(list<any>(first.recenttracks?.track).map(to_scrobble));

	for (const r of [first, ...rest]) {
		const items = list<any>(r.recenttracks?.track);
		for (const x of items) {
			if (!x.date?.uts) continue;
			const s = to_scrobble(x);
			const k = key_of(s.artist, s.name);
			const ts = int(x.date.uts);
			const w = window.get(k);
			if (w) {
				w.count++;
				w.first = Math.min(w.first, ts);
				w.image ??= s.image;
			} else window.set(k, { name: s.name, artist: s.artist, image: s.image, count: 1, first: ts });
		}
	}

	if (!recent.length) {
		const r = await call('user.getrecenttracks', { user, limit: '100', extended: '1' }, 120);
		recent = latest_per_song(list<any>(r.recenttracks?.track).map(to_scrobble));
	}

	const [overall, total] = await Promise.all([overall_p, total_tracks]);
	const all_time = new Map<string, number>();
	for (const x of list<any>(overall.toptracks?.track)) all_time.set(key_of(x.artist?.name ?? '', x.name), int(x.playcount));

	const fresh: LfmNew[] = [...window.entries()]
		.filter(([k, w]) => {
			const plays = all_time.get(k);
			if (plays === undefined) return total <= 1000;
			return plays <= w.count;
		})
		.sort((a, b) => b[1].first - a[1].first)
		.slice(0, 12)
		.map(([, w]) => ({ name: w.name, artist: w.artist, image: w.image, first_played: new Date(w.first * 1000).toISOString() }));

	return { recent, fresh };
}

export async function load_live(user: string): Promise<LiveData> {
	const period: LfmPeriod = '7day';
	try {
		const profile_p = get_user(user);
		const [profile, top, activity, since] = await Promise.all([
			profile_p,
			get_top(user, period),
			get_recent_and_new(
				user,
				profile_p.then((p) => p.tracks)
			),
			first_play(user, profile_p.then((p) => p.plays))
		]);
		const [tracks, recent, fresh] = await with_info([top.tracks, activity.recent, activity.fresh]);
		return {
			user: profile.name,
			updated: new Date().toISOString(),
			since,
			period,
			artists: top.artists,
			tracks,
			recent: recent.map((r) => ({ ...r, album: r.album ?? '' })),
			fresh
		};
	} catch (e) {
		const { status, message } = describe(e);
		error(status, message);
	}
}

export async function load_top(user: string, period: LfmPeriod) {
	try {
		const [profile, top] = await Promise.all([get_user(user), get_top(user, period)]);
		const [tracks] = await with_info([top.tracks]);
		return { user: profile.name, period, artists: top.artists, tracks };
	} catch (e) {
		const { status, message } = describe(e);
		error(status, message);
	}
}

export async function songs_by(user: string, artist: string, max = 3): Promise<string[]> {
	try {
		const overall = await call('user.gettoptracks', { user, period: 'overall', limit: '1000' }, 3600);
		const want = artist.toLowerCase();
		return list<any>(overall.toptracks?.track)
			.filter((x) => (x.artist?.name ?? '').toLowerCase() === want)
			.slice(0, max)
			.map((x) => x.name as string);
	} catch {
		return [];
	}
}

export async function load_artist(user: string, artist: string): Promise<ArtistData> {
	try {
		const profile = await get_user(user);
		const want = artist.toLowerCase();
		const overall = await call('user.gettoptracks', { user: profile.name, period: 'overall', limit: '1000' }, 3600);
		const yours: Song[] = list<any>(overall.toptracks?.track)
			.filter((x) => (x.artist?.name ?? '').toLowerCase() === want)
			.map((x) => ({ name: x.name, artist: x.artist?.name ?? artist, image: image(x.image) }));
		const popular = await artist_songs(artist, yours.slice(0, 3).map((s) => s.name)).catch(() => []);
		if (!yours.length && !popular.length) error(404, "We couldn't find that artist.");
		const mine = new Set(yours.map((s) => key_of(s.artist, s.name)));
		return {
			user: profile.name,
			artist: yours[0]?.artist ?? popular[0]?.artist ?? artist,
			yours: (await with_info([yours]))[0],
			popular: popular.filter((s) => !mine.has(key_of(s.artist, s.name))).map((s) => ({ ...s, image: s.image ?? null }))
		};
	} catch (e) {
		if (isHttpError(e)) throw e;
		const { status, message } = describe(e);
		error(status, message);
	}
}

export async function get_now_playing(user: string): Promise<LfmScrobble | null> {
	const r = await call('user.getrecenttracks', { user, limit: '1', extended: '1' }, 20);
	const first = list<any>(r.recenttracks?.track)[0];
	return first ? to_scrobble(first) : null;
}

export function describe(e: unknown): { status: number; message: string } {
	if (e instanceof LastfmError) {
		if (e.code === 6) return { status: 404, message: "We couldn't find that user." };
		if (e.code === 17) return { status: 403, message: 'This listening history is private.' };
		if (e.code === 29) return { status: 503, message: 'Too many requests right now. Try again in a minute.' };
		if (e.code === 0) return { status: 500, message: e.message };
		return { status: 502, message: 'The music service had a hiccup. Try again shortly.' };
	}
	return { status: 500, message: 'Something went wrong.' };
}
