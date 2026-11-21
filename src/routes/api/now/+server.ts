import { json } from '@sveltejs/kit';
import { describe, get_now_playing } from '#lib/server/spotify';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		return json(await get_now_playing(), { headers: { 'cache-control': 'public, max-age=15' } });
	} catch (e) {
		const { status, message } = describe(e);
		return json({ error: message }, { status });
	}
};
