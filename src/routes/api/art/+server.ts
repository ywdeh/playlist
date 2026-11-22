import { error, redirect } from '@sveltejs/kit';
import { artist_image, owner_song } from '#lib/server/spotify';
import type { RequestHandler } from './$types';

const find = async (artist: string, name: string) => (name ? (await owner_song(name, artist))?.image : await artist_image(artist));

export const GET: RequestHandler = async ({ url, setHeaders }) => {
	const artist = (url.searchParams.get('artist') ?? '').trim().slice(0, 200);
	const name = (url.searchParams.get('name') ?? '').trim().slice(0, 200);
	if (!artist) error(400, 'artist required');

	const src = await find(artist, name).catch(() => undefined);
	if (src === undefined) {
		setHeaders({ 'cache-control': 'no-store' });
		error(503, 'try again');
	}
	if (!src) {
		setHeaders({ 'cache-control': 'public, max-age=3600' });
		error(404, 'no image');
	}
	setHeaders({ 'cache-control': 'public, max-age=604800' });
	redirect(302, src, { external: true });
};
