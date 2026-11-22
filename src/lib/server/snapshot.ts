import { env, waitUntil } from 'cloudflare:workers';

const REREAD_MS = 30_000;
const RETRY_MS = 60_000;

type Stored<T> = { at: number; value: T };

const memory = new Map<string, Stored<unknown> & { read: number }>();
const tried = new Map<string, number>();

function kv() {
	try {
		return env.SNAPSHOTS;
	} catch {
		return undefined;
	}
}

const KV_MIN_TTL_S = 60;

export async function shared_get(key: string): Promise<string | null> {
	return (await kv()?.get(`shared:${key}`).catch(() => null)) ?? null;
}

export function shared_put(key: string, value: string, ttl_s: number) {
	const store = kv();
	if (!store) return;
	waitUntil(store.put(`shared:${key}`, value, { expirationTtl: Math.max(KV_MIN_TTL_S, Math.ceil(ttl_s)) }).catch(() => {}));
}

async function read<T>(key: string): Promise<Stored<T> | null> {
	const hit = memory.get(key);
	if (hit && Date.now() - hit.read < REREAD_MS) return hit as Stored<T>;
	const found = ((await kv()?.get(`stored:${key}`, 'json').catch(() => null)) ?? null) as Stored<T> | null;
	if (found) memory.set(key, { ...found, read: Date.now() });
	return found ?? (hit as Stored<T> | undefined) ?? null;
}

async function load<T>(key: string, fetch: () => Promise<T>): Promise<T> {
	tried.set(key, Date.now());
	const value = await fetch();
	const entry = { at: Date.now(), value };
	memory.set(key, { ...entry, read: Date.now() });
	await kv()?.put(`stored:${key}`, JSON.stringify(entry)).catch(() => {});
	return value;
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
