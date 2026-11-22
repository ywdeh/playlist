import type { Playlist } from '#lib/music';
import { remember, stored } from './cache';
import { with_info } from './previews';
import { get_playlist } from './spotify';

const REFRESH_S = 7200;
const EMBED_S = 15 * 60;

const biggest = (images: { url: string; maxWidth?: number }[] = []) =>
	[...images].sort((a, b) => (b.maxWidth ?? 0) - (a.maxWidth ?? 0))[0]?.url ?? null;

async function read_embed(id: string): Promise<Playlist> {
	const res = await fetch(`https://open.spotify.com/embed/playlist/${id}`, {
		headers: { 'User-Agent': 'Mozilla/5.0 (compatible; music-stats-site/1.0)' }
	});
	if (!res.ok) throw new Error(`playlist ${res.status}`);
	const html = await res.text();
	const raw = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
	const entity = raw ? JSON.parse(raw)?.props?.pageProps?.state?.data?.entity : null;
	if (!entity?.trackList) throw new Error('playlist: page changed');

	const songs = (entity.trackList as any[])
		.filter((t) => t.entityType === 'track' && t.title)
		.map((t) => {
			const track_id = String(t.uri).split(':').pop();
			return {
				name: String(t.title),
				artist: String(t.subtitle ?? '').split(/,\s*/)[0],
				image: null,
				duration: t.duration ? Math.round(t.duration / 1000) : null,
				spotify: `https://open.spotify.com/track/${track_id}`
			};
		});

	return {
		name: String(entity.name ?? 'playlist'),
		image: biggest(entity.visualIdentity?.image ?? entity.coverArt?.sources),
		url: `https://open.spotify.com/playlist/${id}`,
		songs
	};
}

async function from_embed(id: string): Promise<Playlist> {
	const playlist = await remember(`embed:${id}`, EMBED_S, () => read_embed(id));
	const [songs] = await with_info([playlist.songs]);
	return { ...playlist, songs: songs.map((s, i) => ({ ...s, duration: playlist.songs[i].duration ?? s.duration })) };
}

async function fetch_playlist(id: string): Promise<Playlist> {
	const playlist = await get_playlist(id).catch(() => null);
	return playlist?.songs.length ? playlist : from_embed(id);
}

export const load_playlist = (id: string): Promise<Playlist | null> =>
	stored(`playlist:${id}`, REFRESH_S, () => fetch_playlist(id)).catch(() => null);
