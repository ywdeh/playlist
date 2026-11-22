import { error, redirect } from '@sveltejs/kit';
import { dev } from '$app/env';
import { SPOTIFY_CLIENT_ID } from '$app/env/private';
import { OWNER_SCOPES } from '#lib/server/spotify';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url, cookies }) => {
	if (!dev) error(404, 'this page doesn’t exist');
	if (!SPOTIFY_CLIENT_ID) error(500, 'spotify isn’t set up on the server yet');
	const state = crypto.randomUUID();
	cookies.set('connect_state', state, { path: '/connect', httpOnly: true, sameSite: 'lax', maxAge: 600 });
	const params = new URLSearchParams({
		client_id: SPOTIFY_CLIENT_ID,
		response_type: 'code',
		redirect_uri: `${url.origin}/connect/callback`,
		scope: OWNER_SCOPES,
		state
	});
	redirect(302, `https://accounts.spotify.com/authorize?${params}`, { external: true });
};
