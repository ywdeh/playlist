import { error, json } from '@sveltejs/kit';
import { is_period } from '#lib/music';
import { load_insights } from '#lib/server/insights';
import { describe, report } from '#lib/server/spotify';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, setHeaders }) => {
	const period = url.searchParams.get('period');
	if (!is_period(period)) error(400, 'that time range doesn’t exist');
	try {
		const insights = await load_insights(period);
		// while it's still being written the page asks again every few seconds, so that answer mustn't be kept
		setHeaders({ 'cache-control': insights.ready ? 'public, max-age=300' : 'no-store' });
		return json(insights);
	} catch (e) {
		report('insights', e);
		const { status, message } = describe(e);
		error(status, message);
	}
};
