import { env, waitUntil } from 'cloudflare:workers';

const SAVE_EVERY_MS = 15 * 60_000;
const saved_at = new Map<string, number>();

function store() {
	try {
		return env.SNAPSHOTS;
	} catch {
		return undefined;
	}
}

function save(key: string, value: unknown) {
	const kv = store();
	const last = saved_at.get(key) ?? 0;
	if (!kv || Date.now() - last < SAVE_EVERY_MS) return;
	saved_at.set(key, Date.now());
	waitUntil(kv.put(`snapshot:${key}`, JSON.stringify(value)).catch(() => saved_at.delete(key)));
}

async function read<T>(key: string): Promise<T | null> {
	const kv = store();
	if (!kv) return null;
	return ((await kv.get(`snapshot:${key}`, 'json').catch(() => null)) as T | null) ?? null;
}

export async function with_snapshot<T>(key: string, load: () => Promise<T>, falls_back: (e: unknown) => boolean): Promise<T> {
	try {
		const value = await load();
		save(key, value);
		return value;
	} catch (e) {
		if (!falls_back(e)) throw e;
		const last = await read<T>(key);
		if (last === null) throw e;
		console.error(`serving snapshot ${key}:`, e instanceof Error ? e.message : e);
		return last;
	}
}
