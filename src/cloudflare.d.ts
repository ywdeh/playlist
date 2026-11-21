declare module 'cloudflare:workers' {
	interface Store {
		get(key: string, type: 'json'): Promise<unknown>;
		put(key: string, value: string): Promise<void>;
	}
	export const env: { SNAPSHOTS?: Store };
	export function waitUntil(promise: Promise<unknown>): void;
}
