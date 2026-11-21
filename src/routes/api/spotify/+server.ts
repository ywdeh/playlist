import { error, json } from '@sveltejs/kit';
import { find_spotify } from '#lib/server/previews';
import { songs_by } from '#lib/server/lastfm';
import { LASTFM_USER } from '#lib/site';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, setHeaders }) => {
	const artist = url.searchParams.get('artist')?.slice(0, 200);
	const name = url.searchParams.get('name')?.slice(0, 200) || undefined;
	if (!artist) error(400, 'Missing artist.');
	let link: string | null = null;
	let failed = false;
	try {
		link = await find_spotify(artist, name, name ? [] : await songs_by(LASTFM_USER, artist));
	} catch {
		failed = true;
	}
	setHeaders({ 'cache-control': `public, max-age=${failed ? 60 : link ? 604800 : 3600}` });
	return json({ url: link });
};
