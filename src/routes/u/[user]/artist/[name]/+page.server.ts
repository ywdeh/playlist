import { error } from '@sveltejs/kit';
import { load_artist } from '#lib/server/lastfm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	if (!/^[A-Za-z][\w-]{1,14}$/.test(params.user)) error(404, "We couldn't find that user.");
	const name = params.name.trim();
	if (!name || name.length > 200) error(404, "We couldn't find that artist.");
	return load_artist(params.user, name);
};
