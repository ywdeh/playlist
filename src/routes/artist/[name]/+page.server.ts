import { error } from '@sveltejs/kit';
import { load_artist } from '#lib/server/spotify';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const name = params.name.trim();
	if (!name || name.length > 200) error(404, 'that artist isn’t in my music');
	return load_artist(name);
};
