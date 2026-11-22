import { best, norm } from '#lib/match';
import type { Preview, QueueItem } from '#lib/player_types';
import { remember } from './cache';

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
	return remember(key, 600, async () => {
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

export function artist_songs(artist: string, songs: string[] = []): Promise<(QueueItem & SongInfo)[]> {
	return remember(`artist2:${norm(artist)}`, 6 * 3600, async () => {
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
