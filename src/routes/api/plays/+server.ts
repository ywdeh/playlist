import { json } from '@sveltejs/kit';
import { describe, report, sync_all } from '#lib/server/spotify';
import type { RequestHandler } from './$types';

// Hit every 30 minutes by the cron Worker in /cron (the path stays /api/plays so the deployed cron keeps working).
// Refreshes top songs, the favourites playlist and the play log. Safe to call often: each one only
// asks Spotify again once it is older than SYNC_EVERY_S.
export const GET: RequestHandler = async ({ setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	try {
		return json(await sync_all());
	} catch (e) {
		report('sync', e);
		const { status, message } = describe(e);
		return json({ error: message }, { status });
	}
};
