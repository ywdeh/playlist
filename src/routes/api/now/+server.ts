import { json } from '@sveltejs/kit';
import { describe, get_now_playing, SpotifyError } from '#lib/server/spotify';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		return json(await get_now_playing(), { headers: { 'cache-control': 'no-store' } });
	} catch (e) {
		if (!(e instanceof SpotifyError && e.status === 429)) console.error('now playing:', e instanceof Error ? e.message : e);
		const { status, message } = describe(e);
		return json({ error: message }, { status });
	}
};
