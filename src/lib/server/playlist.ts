import type { Playlist } from '#lib/lastfm';
import { edge_cached, with_info } from './previews';

const biggest = (images: { url: string; maxWidth?: number }[] = []) =>
	[...images].sort((a, b) => (b.maxWidth ?? 0) - (a.maxWidth ?? 0))[0]?.url ?? null;

async function read(id: string): Promise<Playlist> {
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
		.map((t) => ({
			name: String(t.title),
			artist: String(t.subtitle ?? '').split(/,\s*/)[0],
			image: null,
			duration: t.duration ? Math.round(t.duration / 1000) : null,
			spotify: `https://open.spotify.com/track/${String(t.uri).split(':').pop()}`
		}));

	return {
		name: String(entity.name ?? 'Playlist'),
		image: biggest(entity.visualIdentity?.image ?? entity.coverArt?.sources),
		url: `https://open.spotify.com/playlist/${id}`,
		songs
	};
}

export async function load_playlist(id: string): Promise<Playlist | null> {
	try {
		const playlist = await edge_cached(`playlist:${id}`, 15 * 60, () => read(id));
		const [songs] = await with_info([playlist.songs]);
		return {
			...playlist,
			songs: songs.map((s, i) => ({ ...s, duration: playlist.songs[i].duration ?? s.duration }))
		};
	} catch {
		return null;
	}
}
