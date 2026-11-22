declare module 'cloudflare:workers' {
	interface Store {
		get(key: string, type: 'json'): Promise<unknown>;
		get(key: string): Promise<string | null>;
		put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
	}
	export const env: { SNAPSHOTS?: Store };
	export function waitUntil(promise: Promise<unknown>): void;
}
