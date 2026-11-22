import { error, text } from '@sveltejs/kit';
import { dev } from '$app/env';
import { exchange_code } from '#lib/server/spotify';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	if (!dev) error(404, 'this page doesn’t exist');
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	if (!code || !state || state !== cookies.get('connect_state')) error(400, url.searchParams.get('error') ?? 'spotify sign-in was cancelled');
	cookies.delete('connect_state', { path: '/connect' });
	const tokens = await exchange_code(code, `${url.origin}/connect/callback`);
	if (!tokens.refresh_token) error(502, 'spotify didn’t send a refresh token, try connecting again');
	return text(`Add this line to .dev.vars, then restart the dev server:\n\nSPOTIFY_REFRESH_TOKEN=${tokens.refresh_token}\n`, {
		headers: { 'cache-control': 'no-store' }
	});
};
