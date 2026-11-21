import { error, redirect } from '@sveltejs/kit';
import { find_art } from '#lib/server/previews';
import { songs_by } from '#lib/server/lastfm';
import { LASTFM_USER } from '#lib/site';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, setHeaders }) => {
	const artist = (url.searchParams.get('artist') ?? '').trim().slice(0, 200);
	const name = (url.searchParams.get('name') ?? '').trim().slice(0, 200);
	if (!artist) error(400, 'artist required');

	const songs = name ? [] : await songs_by(LASTFM_USER, artist);
	const src = await find_art(name ? 'track' : 'artist', artist, name, songs);
	if (!src) {
		setHeaders({ 'cache-control': 'public, max-age=86400' });
		error(404, 'no image');
	}
	setHeaders({ 'cache-control': 'public, max-age=604800' });
	redirect(302, src, { external: true });
};
