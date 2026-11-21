import { error, redirect } from '@sveltejs/kit';
import { find_art, find_preview } from '#lib/server/previews';
import { artist_image, owner_song, songs_by } from '#lib/server/spotify';
import type { RequestHandler } from './$types';

async function find(artist: string, name: string) {
	if (name) {
		const own = await owner_song(name, artist).catch(() => null);
		if (own?.image) return own.image;
		const preview = await find_preview(name, artist).catch(() => null);
		return preview?.cover ?? (await find_art('track', artist, name));
	}
	return (await artist_image(artist)) ?? (await find_art('artist', artist, '', await songs_by(artist)));
}

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
