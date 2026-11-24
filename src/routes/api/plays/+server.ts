import { json } from '@sveltejs/kit';
import { describe, report, sync_all } from '#lib/server/spotify';
import type { RequestHandler } from './$types';

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
