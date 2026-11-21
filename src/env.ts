import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	LASTFM_API_KEY: {
		description: 'Last.fm API key (last.fm/api/account/create). Locally in .dev.vars; in production `wrangler secret put`.',
		schema: (value) => value || undefined
	}
});
