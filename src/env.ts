import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => value?.trim() || undefined;

export const variables = defineEnvVars({
	SPOTIFY_CLIENT_ID: {
		description: 'Client ID of the Spotify app (developer.spotify.com/dashboard).',
		public: true,
		schema: optional
	},
	SPOTIFY_CLIENT_SECRET: {
		description: 'Client secret of the Spotify app. Locally in .dev.vars; in production `wrangler secret put`.',
		schema: optional
	},
	SPOTIFY_REFRESH_TOKEN: {
		description: 'Refresh token for the owner account, from /connect while running locally.',
		schema: optional
	}
});
