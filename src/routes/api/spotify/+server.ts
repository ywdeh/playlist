import { error, json } from '@sveltejs/kit';
import { find_spotify } from '#lib/server/previews';
import { artist_link, owner_song, songs_by } from '#lib/server/spotify';
import type { RequestHandler } from './$types';

const owner_link = async (artist: string, name?: string) =>
	name ? ((await owner_song(name, artist))?.spotify ?? null) : artist_link(artist);

export const GET: RequestHandler = async ({ url, setHeaders }) => {
	const artist = url.searchParams.get('artist')?.slice(0, 200);
	const name = url.searchParams.get('name')?.slice(0, 200) || undefined;
	if (!artist) error(400, 'Missing artist.');
	let failed = false;
	let link = await owner_link(artist, name).catch(() => ((failed = true), null));
	if (!link) {
		const songs = name ? [] : await songs_by(artist);
		link = await find_spotify(artist, name, songs).catch(() => ((failed = true), null));
	}
	setHeaders({ 'cache-control': `public, max-age=${failed ? 60 : link ? 604800 : 3600}` });
	return json({ url: link });
};
