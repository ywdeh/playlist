import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter(),
			prerender: { entries: [] }
		})
	],
	server: {
		host: '127.0.0.1',
		port: 5173,
		strictPort: true
	}
});
