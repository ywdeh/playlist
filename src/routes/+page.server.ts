import { load_live } from '#lib/server/lastfm';
import { load_playlist } from '#lib/server/playlist';
import { FAVOURITE_PLAYLIST, LASTFM_USER } from '#lib/site';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [live, playlist] = await Promise.all([load_live(LASTFM_USER), load_playlist(FAVOURITE_PLAYLIST)]);
	return { ...live, playlist };
};
