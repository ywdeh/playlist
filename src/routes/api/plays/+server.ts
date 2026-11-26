import { json } from '@sveltejs/kit';
import { describe, report, sync_all } from '#lib/server/spotify';
import { fill_insights } from '#lib/server/insights';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	try {
		const synced = await sync_all();
		const insights = await fill_insights().catch((e) => {
			report('insights', e);
			return null;
		});
		return json({ ...synced, insights });
	} catch (e) {
		report('sync', e);
		const { status, message } = describe(e);
		return json({ error: message }, { status });
	}
};
