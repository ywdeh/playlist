import { env, waitUntil } from 'cloudflare:workers';

const MEMORY_MAX = 2000;
const KV_MIN_TTL_S = 60;
const REREAD_MS = 30_000;
const RETRY_MS = 60_000;
const LOCK_S = 60;

type Kept<T> = { at: number; value: T };

function kv() {
	try {
		return env.SNAPSHOTS;
	} catch {
		return undefined;
	}
}

const edge = () => (globalThis as { caches?: { default?: Cache } }).caches?.default;
const edge_url = (key: string) => `https://cache.playlist/${encodeURIComponent(key)}`;

const memory = new Map<string, { expires: number; value: unknown }>();

function keep(key: string, value: unknown, ttl_s: number) {
	memory.delete(key);
	memory.set(key, { expires: Date.now() + ttl_s * 1000, value });
	if (memory.size > MEMORY_MAX) memory.delete(memory.keys().next().value!);
}

export async function remember<T>(key: string, ttl_s: number, load: () => Promise<T>): Promise<T> {
	const hit = memory.get(key);
	if (hit && hit.expires > Date.now()) return hit.value as T;
	const cache = edge();
	const kept = await cache?.match(edge_url(key)).catch(() => undefined);
	if (kept) {
		const value = (await kept.json()) as T;
		keep(key, value, ttl_s);
		return value;
	}
	const value = await load();
	keep(key, value, ttl_s);
	const body = new Response(JSON.stringify(value), { headers: { 'Cache-Control': `max-age=${ttl_s}` } });
	await cache?.put(edge_url(key), body).catch(() => {});
	return value;
}

export async function shared_get(key: string): Promise<string | null> {
	return (await kv()?.get(`shared:${key}`).catch(() => null)) ?? null;
}

export function shared_put(key: string, value: string, ttl_s: number) {
	const store = kv();
	if (!store) return;
	waitUntil(store.put(`shared:${key}`, value, { expirationTtl: Math.max(KV_MIN_TTL_S, Math.ceil(ttl_s)) }).catch(() => {}));
}

export class Loading extends Error {}

const kept = new Map<string, Kept<unknown> & { read: number }>();
const tried = new Map<string, number>();
const failed = new Map<string, { at: number; error: unknown }>();

async function read_kept<T>(key: string): Promise<Kept<T> | null> {
	const hit = kept.get(key);
	if (hit && Date.now() - hit.read < REREAD_MS) return hit as Kept<T>;
	const found = ((await kv()?.get(`stored:${key}`, 'json').catch(() => null)) ?? null) as Kept<T> | null;
	if (found) kept.set(key, { ...found, read: Date.now() });
	return found ?? (hit as Kept<T> | undefined) ?? null;
}

async function refresh<T>(key: string, load: () => Promise<T>): Promise<T> {
	tried.set(key, Date.now());
	try {
		const value = await load();
		const entry = { at: Date.now(), value };
		kept.set(key, { ...entry, read: Date.now() });
		failed.delete(key);
		await kv()?.put(`stored:${key}`, JSON.stringify(entry)).catch(() => {});
		return value;
	} catch (e) {
		failed.set(key, { at: Date.now(), error: e });
		throw e;
	} finally {
		await kv()?.delete(`shared:lock:${key}`).catch(() => {});
	}
}

async function locked(key: string) {
	if (await shared_get(`lock:${key}`)) return true;
	shared_put(`lock:${key}`, '1', LOCK_S);
	return false;
}

async function claim(key: string) {
	if (Date.now() - (tried.get(key) ?? 0) < RETRY_MS) return false;
	tried.set(key, Date.now());
	return !(await locked(key));
}

export async function stored<T>(key: string, max_age_s: number, load: () => Promise<T>): Promise<T> {
	const entry = await read_kept<T>(key);
	if (!entry) {
		const last_failure = failed.get(key);
		if (last_failure && Date.now() - last_failure.at < RETRY_MS) throw last_failure.error;
		if (await locked(key)) throw new Loading(`${key} is loading`);
		return refresh(key, load);
	}
	if (Date.now() - entry.at > max_age_s * 1000 && (await claim(key))) {
		waitUntil(refresh(key, load).catch((e) => console.error(`refreshing ${key}:`, e instanceof Error ? e.message : e)));
	}
	return entry.value;
}
