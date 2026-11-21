import { json } from '@sveltejs/kit';
import { describe, get_now_playing } from '#lib/server/lastfm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	if (!/^[A-Za-z][\w-]{1,14}$/.test(params.user)) return json({ error: 'bad user' }, { status: 400 });
	try {
		return json(await get_now_playing(params.user), { headers: { 'cache-control': 'public, max-age=15' } });
	} catch (e) {
		const { status, message } = describe(e);
		return json({ error: message }, { status });
	}
};
