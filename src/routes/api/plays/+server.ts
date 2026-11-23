import { json } from '@sveltejs/kit';
import { describe, play_log, report } from '#lib/server/spotify';
import type { RequestHandler } from './$types';

// Hit every 30 minutes by the cron Worker in /cron. Safe to call often: the log only
// asks Spotify for new plays once it is older than PLAYS_EVERY_S.
export const GET: RequestHandler = async ({ setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	try {
		const log = await play_log();
		return json({ plays: log.plays.length, last: log.plays.at(-1)?.[1] ?? null });
	} catch (e) {
		report('play log', e);
		const { status, message } = describe(e);
		return json({ error: message }, { status });
	}
};
