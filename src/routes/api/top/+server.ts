import { error, json } from '@sveltejs/kit';
import { is_period } from '#lib/music';
import { load_top } from '#lib/server/spotify';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, setHeaders }) => {
	const period = url.searchParams.get('period');
	if (!is_period(period)) error(400, 'Unknown time range.');
	const top = await load_top(period);
	setHeaders({ 'cache-control': 'public, max-age=300' });
	return json(top);
};
