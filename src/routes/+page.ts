import { browser } from '$app/env';
import { tint_ready } from '#lib/cover_tint';
import { cover_url } from '#lib/tint.svelte';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ data }) => {
	const now = data.now;
	if (browser && now) await tint_ready(cover_url(now.image, now.artist, now.name));
	return data;
};
