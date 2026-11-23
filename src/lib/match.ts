export interface Named {
	name: string;
	artist: string;
}

export const norm = (s: string) =>
	s
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/\(.*?\)|\[.*?\]|- .*(remaster|version|edit|mix).*$/g, '')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();

export const song_key = (s: Named) => `${norm(s.artist)}:${norm(s.name)}`;

function score(want: Named, got: Named) {
	const a = norm(want.artist);
	const b = norm(got.artist);
	const n = norm(want.name);
	const m = norm(got.name);
	let s = 0;
	if (a === b) s += 4;
	else if (a && b && (a.includes(b) || b.includes(a))) s += 2;
	if (n === m) s += 4;
	else if (n && m && (n.includes(m) || m.includes(n))) s += 2;
	if (want.name.trim().toLowerCase() === got.name.trim().toLowerCase()) s += 1;
	const variant = /\b(demo|live|remix|instrumental|karaoke|acoustic|sped up|slowed|cover)\b/i;
	if (variant.test(got.name) && !variant.test(want.name)) s -= 2;
	return s;
}

const JOINS = /\s*(?:,|&|\+|\/|;|\bfeat\.?|\bft\.?|\bfeaturing\b|\bwith\b|\bx\b|\band\b|\bvs\.?)\s*/i;

export function same_artist(want: string, got: string) {
	const w = norm(want);
	if (!w) return false;
	return norm(got) === w || got.split(JOINS).some((part) => norm(part) === w);
}

export function same_title(want: string, got: string) {
	const n = norm(want);
	const m = norm(got);
	if (!n || !m) return false;
	if (n === m) return true;
	const [short, long] = n.length < m.length ? [n, m] : [m, n];
	return long.includes(short) && short.length / long.length >= 0.6;
}

export function best<T>(items: T[], want: Named, pick: (t: T) => Named): T | null {
	let top: T | null = null;
	let top_score = -Infinity;
	for (const item of items) {
		const got = pick(item);
		if (!same_artist(want.artist, got.artist) || !same_title(want.name, got.name)) continue;
		const s = score(want, got);
		if (s > top_score) {
			top = item;
			top_score = s;
		}
	}
	return top;
}
