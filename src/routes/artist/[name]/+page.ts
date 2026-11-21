import { browser } from '$app/env';
import { tint_ready } from '#lib/cover_tint';
import { cover_url } from '#lib/tint.svelte';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ data }) => {
	if (browser) await tint_ready(data.image ?? cover_url(null, data.artist));
	return data;
};
