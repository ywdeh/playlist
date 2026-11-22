import { load_live, load_playlist, report } from '#lib/server/spotify';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [live, playlist] = await Promise.all([
		load_live(),
		load_playlist().catch((e) => {
			report('favourites', e);
			return null;
		})
	]);
	return { ...live, playlist };
};