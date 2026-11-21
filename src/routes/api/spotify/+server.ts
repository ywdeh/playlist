import { error, json } from '@sveltejs/kit';
import { find_spotify } from '#lib/server/previews';
import { artist_link, owner_song, songs_by } from '#lib/server/spotify';
import type { RequestHandler } from './$types';

async function find(artist: string, name?: string) {
	if (name) return (await owner_song(name, artist))?.spotify ?? (await find_spotify(artist, name));
	return (await artist_link(artist)) ?? (await find_spotify(artist, undefined, await songs_by(artist)));
}

export const GET: RequestHandler = async ({ url, setHeaders }) => {
	const artist = url.searchParams.get('artist')?.slice(0, 200);
	const name = url.searchParams.get('name')?.slice(0, 200) || undefined;
	if (!artist) error(400, 'Missing artist.');
	let link: string | null = null;
	let failed = false;
	try {
		link = await find(artist, name);
	} catch {
		failed = true;
	}
	setHeaders({ 'cache-control': `public, max-age=${failed ? 60 : link ? 604800 : 3600}` });
	return json({ url: link });
};
