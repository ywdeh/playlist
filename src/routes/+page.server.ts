import { load_live } from '#lib/server/spotify';
import { load_playlist } from '#lib/server/playlist';
import { FAVOURITE_PLAYLIST } from '#lib/site';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [live, playlist] = await Promise.all([load_live(), load_playlist(FAVOURITE_PLAYLIST)]);
	return { ...live, playlist };
};
