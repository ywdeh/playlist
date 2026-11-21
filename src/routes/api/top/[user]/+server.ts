import { error, json } from '@sveltejs/kit';
import { is_period } from '#lib/lastfm';
import { load_top } from '#lib/server/lastfm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, setHeaders }) => {
	if (!/^[A-Za-z][\w-]{1,14}$/.test(params.user)) error(404, "We couldn't find that user.");
	const period = url.searchParams.get('period');
	if (!is_period(period)) error(400, 'Unknown time range.');
	const top = await load_top(params.user, period);
	setHeaders({ 'cache-control': 'public, max-age=300' });
	return json(top);
};
