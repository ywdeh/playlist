import { error } from '@sveltejs/kit';
import { load_artist } from '#lib/server/lastfm';
import { LASTFM_USER } from '#lib/site';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const name = params.name.trim();
	if (!name || name.length > 200) error(404, "We couldn't find that artist.");
	return load_artist(LASTFM_USER, name);
};
