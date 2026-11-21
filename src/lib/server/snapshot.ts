import { env, waitUntil } from 'cloudflare:workers';

const REREAD_MS = 30_000;
const RETRY_MS = 60_000;

type Stored<T> = { at: number; value: T };

const memory = new Map<string, Stored<unknown> & { read: number }>();
const loading = new Map<string, Promise<unknown>>();
const tried = new Map<string, number>();

function kv() {
	try {
		return env.SNAPSHOTS;
	} catch {
		return undefined;
	}
}

async function read<T>(key: string): Promise<Stored<T> | null> {
	const hit = memory.get(key);
	if (hit && Date.now() - hit.read < REREAD_MS) return hit as Stored<T>;
	const found = ((await kv()?.get(`stored:${key}`, 'json').catch(() => null)) ?? null) as Stored<T> | null;
	if (found) memory.set(key, { ...found, read: Date.now() });
	return found ?? (hit as Stored<T> | undefined) ?? null;
}

function load<T>(key: string, fetch: () => Promise<T>): Promise<T> {
	const running = loading.get(key);
	if (running) return running as Promise<T>;
	tried.set(key, Date.now());
	const p = fetch()
		.then(async (value) => {
			const entry = { at: Date.now(), value };
			memory.set(key, { ...entry, read: Date.now() });
			await kv()?.put(`stored:${key}`, JSON.stringify(entry)).catch(() => {});
			return value;
		})
		.finally(() => loading.delete(key));
	loading.set(key, p);
	return p;
}

export async function stored<T>(key: string, max_age_s: number, fetch: () => Promise<T>): Promise<T> {
	const last = await read<T>(key);
	if (!last) {
		const legacy = kv()?.get(`snapshot:${key}`, 'json').catch(() => null) as Promise<T | null> | undefined;
		return load(key, fetch).catch(async (e) => {
			const old = await legacy;
			if (old == null) throw e;
			return old;
		});
	}
	const stale = Date.now() - last.at > max_age_s * 1000;
	if (stale && Date.now() - (tried.get(key) ?? 0) > RETRY_MS) {
		waitUntil(load(key, fetch).catch((e) => console.error(`refreshing ${key}:`, e instanceof Error ? e.message : e)));
	}
	return last.value;
}
