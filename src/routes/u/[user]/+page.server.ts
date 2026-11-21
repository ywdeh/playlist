import { error } from '@sveltejs/kit';
import { load_live } from '#lib/server/lastfm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	if (!/^[A-Za-z][\w-]{1,14}$/.test(params.user)) error(404, "We couldn't find that user.");
	return load_live(params.user);
};
