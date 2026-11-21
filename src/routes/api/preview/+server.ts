import { json } from '@sveltejs/kit';
import { find_preview } from '#lib/server/previews';
import type { RequestHandler } from './$types';

const clean = (v: string | null) => (v ?? '').trim().slice(0, 200);

export const GET: RequestHandler = async ({ url }) => {
	const artist = clean(url.searchParams.get('artist'));
	const name = clean(url.searchParams.get('name'));
	if (!artist || !name) return json({ error: 'artist and name required' }, { status: 400 });
	const isrc = clean(url.searchParams.get('isrc')).replace(/[^A-Za-z0-9]/g, '') || undefined;

	try {
		const preview = await find_preview(name, artist, isrc);
		if (!preview) return json({ error: 'No preview for this song' }, { status: 404, headers: { 'cache-control': 'public, max-age=3600' } });
		return json(preview, { headers: { 'cache-control': 'public, max-age=300' } });
	} catch {
		return json({ error: 'Preview lookup failed' }, { status: 502 });
	}
};
