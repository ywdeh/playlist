declare module 'cloudflare:workers' {
	interface Store {
		get(key: string, type: 'json'): Promise<unknown>;
		get(key: string): Promise<string | null>;
		put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
		delete(key: string): Promise<void>;
	}
	interface Ai {
		run(model: string, input: { messages: { role: 'system' | 'user'; content: string }[]; max_tokens?: number; temperature?: number }): Promise<{ response?: string }>;
	}
	export const env: { SNAPSHOTS?: Store; AI?: Ai };
	export function waitUntil(promise: Promise<unknown>): void;
}
