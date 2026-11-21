import { best, norm, same_title } from '#lib/match';
import type { Preview, QueueItem } from '#lib/player_types';

const memory = new Map<string, { expires: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

function cached<T>(key: string, ttl_seconds: number, load: () => Promise<T>): Promise<T> {
	const hit = memory.get(key);
	if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value as T);
	const running = inflight.get(key);
	if (running) return running as Promise<T>;
	const p = load()
		.then((value) => {
			memory.set(key, { expires: Date.now() + ttl_seconds * 1000, value });
			if (memory.size > 2000) memory.delete(memory.keys().next().value!);
			return value;
		})
		.finally(() => inflight.delete(key));
	inflight.set(key, p);
	return p;
}

let deezer_next = 0;
async function deezer_slot() {
	const now = Date.now();
	const at = Math.max(now, deezer_next);
	deezer_next = at + 110;
	if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

async function get_json(url: string, user_agent = 'music-stats-site/1.0'): Promise<any> {
	const host = new URL(url).host;
	if (host === 'api.deezer.com') await deezer_slot();
	const res = await fetch(url, { headers: { 'User-Agent': user_agent, Accept: 'application/json', 'Accept-Language': 'en' } });
	if (!res.ok) throw new Error(`${host} ${res.status}`);
	const json = await res.json();
	if (host === 'api.deezer.com' && json?.error) throw new Error(`deezer ${json.error.code ?? 'error'}`);
	return json;
}

const from_deezer = (t: any): Preview => ({
	url: t.preview,
	name: t.title,
	artist: t.artist?.name ?? '',
	album: t.album?.title ?? '',
	cover: t.album?.cover_big ?? t.album?.cover_medium ?? null
});

async function deezer_song(name: string, artist: string): Promise<Preview | null> {
	const q = encodeURIComponent(`${artist} ${name}`);
	const json = await get_json(`https://api.deezer.com/search?q=${q}&limit=10`);
	const hit = best((json.data ?? []).filter((t: any) => t.preview), { name, artist }, (t: any) => ({
		name: t.title,
		artist: t.artist?.name ?? ''
	}));
	return hit ? from_deezer(hit) : null;
}

async function itunes_song(name: string, artist: string): Promise<Preview | null> {
	const q = encodeURIComponent(`${artist} ${name}`);
	const json = await get_json(`https://itunes.apple.com/search?term=${q}&entity=song&limit=10`);
	const hit = best((json.results ?? []).filter((t: any) => t.previewUrl), { name, artist }, (t: any) => ({
		name: t.trackName,
		artist: t.artistName
	}));
	return hit
		? {
				url: hit.previewUrl,
				name: hit.trackName,
				artist: hit.artistName,
				album: hit.collectionName ?? '',
				cover: hit.artworkUrl100?.replace('100x100bb', '500x500bb') ?? null
			}
		: null;
}

async function deezer_isrc(isrc: string): Promise<Preview | null> {
	const t = await get_json(`https://api.deezer.com/track/isrc:${encodeURIComponent(isrc)}`).catch((e: Error) => {
		if (e.message === 'deezer 800') return null;
		throw e;
	});
	return t?.preview ? from_deezer(t) : null;
}

async function deezer_exact(name: string, artist: string): Promise<Preview | null> {
	const q = encodeURIComponent(`artist:"${artist.replace(/"/g, '')}" track:"${norm(name)}"`);
	const json = await get_json(`https://api.deezer.com/search?q=${q}&limit=10`);
	const hit = best((json.data ?? []).filter((t: any) => t.preview), { name, artist }, (t: any) => ({
		name: t.title,
		artist: t.artist?.name ?? ''
	}));
	return hit ? from_deezer(hit) : null;
}

export function find_preview(name: string, artist: string, isrc?: string): Promise<Preview | null> {
	const key = `song:${norm(artist)}:${norm(name)}`;
	return cached(key, 600, async () => {
		const attempts = [
			...(isrc ? [() => deezer_isrc(isrc)] : []),
			() => deezer_song(name, artist),
			() => deezer_exact(name, artist),
			() => itunes_song(name, artist)
		];
		let failed = false;
		for (const attempt of attempts) {
			try {
				const found = await attempt();
				if (found) return found;
			} catch {
				failed = true;
			}
		}
		if (failed) throw new Error('preview lookup failed');
		return null;
	});
}

export interface SongInfo {
	album: string | null;
	duration: number | null;
}

export async function edge_cached<T>(key: string, ttl_seconds: number, load: () => Promise<T>): Promise<T> {
	return cached(key, ttl_seconds, async () => {
		const edge = (globalThis as { caches?: { default?: Cache } }).caches?.default;
		const url = `https://songs.cache/${encodeURIComponent(key)}`;
		const hit = edge ? await edge.match(url).catch(() => undefined) : undefined;
		if (hit) return (await hit.json()) as T;
		const value = await load();
		if (edge) {
			await edge
				.put(url, new Response(JSON.stringify(value), { headers: { 'Cache-Control': `max-age=${ttl_seconds}` } }))
				.catch(() => {});
		}
		return value;
	});
}

export function find_info(name: string, artist: string): Promise<SongInfo> {
	return  edge_cached(`info2:${norm(artist)}:${norm(name)}`, 7 * 86400, async () => {
		let failed = 0;
		try {
			const json = await get_json(`https://api.deezer.com/search?q=${encodeURIComponent(`${artist} ${name}`)}&limit=10`);
			const hit = best(json.data ?? [], { name, artist }, (t: any) => ({ name: t.title, artist: t.artist?.name ?? '' }));
			if (hit) return { album: hit.album?.title || null, duration: hit.duration || null };
		} catch {
			failed++;
		}
		try {
			const q = encodeURIComponent(`${artist} ${name}`);
			const json = await get_json(`https://itunes.apple.com/search?term=${q}&entity=song&limit=10`);
			const hit = best(json.results ?? [], { name, artist }, (t: any) => ({ name: t.trackName, artist: t.artistName }));
			if (hit) return { album: hit.collectionName || null, duration: hit.trackTimeMillis ? Math.round(hit.trackTimeMillis / 1000) : null };
		} catch {
			failed++;
		}
		if (failed) throw new Error('song details unavailable');
		return { album: null, duration: null };
	});
}

const no_info: SongInfo = { album: null, duration: null };

export async function with_info<L extends { name: string; artist: string; album?: string | null }[][]>(
	lists: [...L],
	budget = 2500
): Promise<{ [K in keyof L]: (L[K][number] & SongInfo)[] }> {
	const found = new Map<string, SongInfo>();
	const keys = new Map<string, { name: string; artist: string }>();
	for (const list of lists) for (const s of list) keys.set(`${norm(s.artist)}:${norm(s.name)}`, s);

	const queue = [...keys];
	const worker = async () => {
		for (let job = queue.shift(); job; job = queue.shift()) {
			const [key, s] = job;
			found.set(key, await find_info(s.name, s.artist).catch(() => no_info));
		}
	};
	await Promise.race([Promise.all(Array.from({ length: 6 }, worker)), new Promise((r) => setTimeout(r, budget))]);
	queue.length = 0;

	return lists.map((list) =>
		list.map((s) => {
			const info = found.get(`${norm(s.artist)}:${norm(s.name)}`) ?? no_info;
			return { ...s, album: s.album || info.album, duration: info.duration };
		})
	) as { [K in keyof L]: (L[K][number] & SongInfo)[] };
}

const WIKI = 'https://www.wikidata.org/w/api.php';
const AGENT = 'ListeningShelf/1.0 ( personal music site )';

async function wikidata_id(
	label: string,
	property: 'P1902' | 'P2207',
	fits: (description: string) => boolean,
	unique = false
) {
	const search = await get_json(
		`${WIKI}?action=wbsearchentities&search=${encodeURIComponent(label)}&language=en&type=item&limit=10&format=json`,
		AGENT
	);
	const want = norm(label);
	const items = (search.search ?? []).filter(
		(i: any) => (norm(i.label ?? '') === want || norm(i.match?.text ?? '') === want) && fits(i.description ?? '')
	);
	if (!items.length) return null;
	const ids = items.map((i: any) => i.id).join('|');
	const full = await get_json(`${WIKI}?action=wbgetentities&ids=${ids}&props=claims&format=json`, AGENT);
	const found = new Set<string>();
	for (const i of items) {
		const id = full.entities?.[i.id]?.claims?.[property]?.[0]?.mainsnak?.datavalue?.value;
		if (typeof id === 'string') {
			if (!unique) return id;
			found.add(id);
		}
	}
	return found.size === 1 ? [...found][0] : null;
}

let musicbrainz_queue = Promise.resolve();
function musicbrainz(url: string): Promise<any> {
	const run = musicbrainz_queue.then(() => get_json(url, AGENT));
	musicbrainz_queue = run.then(
		() => new Promise((r) => setTimeout(r, 1100)),
		() => new Promise((r) => setTimeout(r, 1100))
	);
	return run;
}

const quoted = (s: string) => `"${s.replace(/["\\]/g, '')}"`;

async function musicbrainz_artist_by_songs(artist: string, songs: string[]): Promise<string | null> {
	for (const song of songs.slice(0, 2)) {
		const query = encodeURIComponent(`recording:${quoted(song)} AND artist:${quoted(artist)}`);
		const search = await musicbrainz(`https://musicbrainz.org/ws/2/recording?query=${query}&fmt=json&limit=10`);
		for (const rec of search.recordings ?? []) {
			if (!same_title(song, rec.title ?? '')) continue;
			const credit = (rec['artist-credit'] ?? []).find((c: any) => norm(c.artist?.name ?? c.name ?? '') === norm(artist));
			if (credit?.artist?.id) return credit.artist.id as string;
		}
	}
	return null;
}

async function musicbrainz_artist_by_name(artist: string): Promise<string | null> {
	const query = encodeURIComponent(`artist:${quoted(artist)}`);
	const search = await musicbrainz(`https://musicbrainz.org/ws/2/artist?query=${query}&fmt=json&limit=10`);
	const exact = (search.artists ?? []).filter((a: any) => norm(a.name) === norm(artist) && (a.score ?? 0) >= 90);
	return exact.length === 1 ? exact[0].id : null;
}

async function musicbrainz_spotify(id: string): Promise<string | null> {
	const full = await musicbrainz(`https://musicbrainz.org/ws/2/artist/${id}?inc=url-rels&fmt=json`);
	const link = (full.relations ?? [])
		.map((r: any) => r.url?.resource as string | undefined)
		.find((u: string | undefined) => u && /^https:\/\/open\.spotify\.com\/artist\//.test(u));
	return link ?? null;
}

async function spotify_artist(artist: string, songs: string[]): Promise<string | null> {
	if (songs.length) {
		const id = await musicbrainz_artist_by_songs(artist, songs);
		const link = id ? await musicbrainz_spotify(id) : null;
		if (link) return link;
	}
	const namesakes = await deezer_namesakes(artist).catch(() => []);
	if (namesakes.length > 1) return null;
	const id = await wikidata_id(artist, 'P1902', () => true, true).catch(() => null);
	if (id) return `https://open.spotify.com/artist/${id}`;
	const mb = await musicbrainz_artist_by_name(artist);
	return mb ? musicbrainz_spotify(mb) : null;
}

async function spotify_song(name: string, artist: string): Promise<string | null> {
	const by = norm(artist);
	const id = await wikidata_id(name, 'P2207', (d) => norm(d).includes(by));
	return id ? `https://open.spotify.com/track/${id}` : null;
}

export function find_spotify(artist: string, name?: string, songs: string[] = []): Promise<string | null> {
	const key = name ? `spotify:${norm(artist)}:${norm(name)}` : `spotify2:${norm(artist)}:`;
	return edge_cached(key, 7 * 86400, () => (name ? spotify_song(name, artist) : spotify_artist(artist, songs)));
}

async function deezer_namesakes(name: string): Promise<any[]> {
	const json = await get_json(`https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=25`);
	return ((json.data ?? []) as any[])
		.filter((a) => norm(a.name) === norm(name))
		.sort((a, b) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0));
}

async function deezer_artist(name: string, songs: string[] = []): Promise<any | null> {
	for (const song of songs.slice(0, 3)) {
		try {
			const json = await get_json(`https://api.deezer.com/search?q=${encodeURIComponent(`${name} ${song}`)}&limit=10`);
			const hits = ((json.data ?? []) as any[]).filter((t) => norm(t.artist?.name ?? '') === norm(name));
			const hit = best(hits, { name: song, artist: name }, (t: any) => ({ name: t.title, artist: t.artist?.name ?? '' }));
			if (hit?.artist?.id) return hit.artist;
		} catch {}
	}
	return (await deezer_namesakes(name))[0] ?? null;
}

export function find_art(type: 'track' | 'artist', artist: string, name = '', songs: string[] = []): Promise<string | null> {
	if (type === 'artist') {
		return edge_cached(`art3:artist:${norm(artist)}`, 7 * 86400, async () => {
			const hit = await deezer_artist(artist, songs);
			const pic: string | undefined = hit?.picture_xl ?? hit?.picture_big;
			return pic && !pic.includes('/artist//') ? pic : null;
		});
	}
	return edge_cached(`art4:${type}:${norm(artist)}:${norm(name)}`, 7 * 86400, async () => {
		let failed = false;
		try {
			const json = await get_json(`https://api.deezer.com/search?q=${encodeURIComponent(`${artist} ${name}`)}&limit=10`);
			const hit = best(json.data ?? [], { name, artist }, (t: any) => ({ name: t.title, artist: t.artist?.name ?? '' }));
			if (hit?.album?.cover_big) return hit.album.cover_big as string;
		} catch {
			failed = true;
		}
		try {
			const p = await itunes_song(name, artist);
			if (p?.cover) return p.cover;
		} catch {
			failed = true;
		}
		if (failed) throw new Error('cover lookup failed');
		return null;
	});
}

export function artist_songs(artist: string, songs: string[] = []): Promise<(QueueItem & SongInfo)[]> {
	return cached(`artist2:${norm(artist)}`, 6 * 3600, async () => {
		const match = await deezer_artist(artist, songs);
		if (!match) return [];
		const top = await get_json(`https://api.deezer.com/artist/${match.id}/top?limit=25`);
		return ((top.data ?? []) as any[])
			.filter((t) => t.artist?.id === match.id)
			.slice(0, 15)
			.map((t) => ({
				name: t.title,
				artist: t.artist?.name ?? artist,
				image: t.album?.cover_medium ?? null,
				album: (t.album?.title as string) || null,
				duration: (t.duration as number) || null
			}));
	});
}
