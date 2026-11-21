import { json } from '@sveltejs/kit';
import { album_songs, artist_songs, find_preview } from '#lib/server/previews';
import { songs_by } from '#lib/server/lastfm';
import { LASTFM_USER } from '#lib/site';
import type { RequestHandler } from './$types';

const clean = (v: string | null) => (v ?? '').trim().slice(0, 200);

export const GET: RequestHandler = async ({ url }) => {
	const type = url.searchParams.get('type');
	const artist = clean(url.searchParams.get('artist'));
	if (!artist) return json({ error: 'artist required' }, { status: 400 });

	try {
		if (type === 'artist') {
			return json(await artist_songs(artist, await songs_by(LASTFM_USER, artist)), { headers: { 'cache-control': 'public, max-age=3600' } });
		}
		if (type === 'album') {
			const album = clean(url.searchParams.get('album'));
			if (!album) return json({ error: 'album required' }, { status: 400 });
			return json(await album_songs(album, artist), { headers: { 'cache-control': 'public, max-age=3600' } });
		}
		const name = clean(url.searchParams.get('name'));
		if (!name) return json({ error: 'name required' }, { status: 400 });
		const preview = await find_preview(name, artist);
		if (!preview) return json({ error: 'No preview for this song' }, { status: 404 });
		return json(preview, { headers: { 'cache-control': 'public, max-age=300' } });
	} catch {
		return json({ error: 'Preview lookup failed' }, { status: 502 });
	}
};
