const MIST_L = 0.77;
const MAX_C = 0.075;
const MIN_C = 0.015;

const SIZE = 32;

const cache = new Map<string, Promise<string | null>>();
const done = new Map<string, string | null>();

export function cover_tint(src: string): Promise<string | null> {
	let p = cache.get(src);
	if (!p) {
		p = compute(src).then(
			(c) => (done.set(src, c), c),
			() => {
				cache.delete(src);
				return null;
			}
		);
		cache.set(src, p);
	}
	return p;
}

export const known_tint = (src: string) => done.get(src);

export function tint_ready(src: string, ms = 800) {
	if (done.has(src)) return Promise.resolve(done.get(src)!);
	let timer: ReturnType<typeof setTimeout> | undefined;
	const late = new Promise<null>((r) => (timer = setTimeout(() => r(null), ms)));
	return Promise.race([cover_tint(src), late]).finally(() => clearTimeout(timer));
}

const waiting: string[] = [];
let warming = false;
const can_hover = () => typeof matchMedia !== 'undefined' && matchMedia('(hover: hover)').matches;
const idle = (fn: () => void) =>
	'requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 200);

export function warm_tint(src: string) {
	if (cache.has(src) || waiting.includes(src) || !can_hover()) return;
	waiting.push(src);
	if (!warming) next();
}

function next() {
	const src = waiting.shift();
	if (!src) return void (warming = false);
	warming = true;
	idle(() => cover_tint(src).finally(next));
}

let context: CanvasRenderingContext2D | null | undefined;
function sampler() {
	if (context !== undefined) return context;
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = SIZE;
	return (context = canvas.getContext('2d', { willReadFrequently: true }));
}

async function compute(src: string): Promise<string | null> {
	const res = await fetch(src, { mode: 'cors' });
	if (!res.ok) return null;
	const img = await createImageBitmap(await res.blob(), { resizeWidth: SIZE, resizeHeight: SIZE, resizeQuality: 'low' });
	const ctx = sampler();
	if (!ctx) {
		img.close();
		return null;
	}
	ctx.clearRect(0, 0, SIZE, SIZE);
	ctx.drawImage(img, 0, 0, SIZE, SIZE);
	img.close();
	const px = ctx.getImageData(0, 0, SIZE, SIZE).data;

	const BINS = 24;
	const votes = new Float64Array(BINS);
	const sum_a = new Float64Array(BINS);
	const sum_b = new Float64Array(BINS);
	const count = new Float64Array(BINS);
	const area = new Float64Array(BINS);
	let grey_a = 0;
	let grey_b = 0;
	const n = px.length / 4;
	for (let i = 0; i < px.length; i += 4) {
		const [L, a, b] = linear_to_oklab(LINEAR[px[i]], LINEAR[px[i + 1]], LINEAR[px[i + 2]]);
		grey_a += a;
		grey_b += b;
		if (L < 0.12 || L > 0.97) continue;
		const c = Math.hypot(a, b);
		if (c < 0.01) continue;
		const bin = Math.floor(((Math.atan2(b, a) / (2 * Math.PI) + 1) % 1) * BINS) % BINS;
		votes[bin] += c;
		count[bin]++;
		sum_a[bin] += a;
		sum_b[bin] += b;
		if (c > 0.03) area[bin]++;
	}

	let best = -1;
	let best_votes = 0;
	for (let i = 0; i < BINS; i++) {
		const v = votes[(i + BINS - 1) % BINS] + votes[i] + votes[(i + 1) % BINS];
		if (v > best_votes) ((best = i), (best_votes = v));
	}

	let h: number;
	let C: number;
	if (best < 0 || best_votes / n < MIN_C * 0.5) {
		h = Math.atan2(grey_b, grey_a);
		C = Math.min(Math.hypot(grey_a / n, grey_b / n), 0.012);
	} else {
		const group = [(best + BINS - 1) % BINS, best, (best + 1) % BINS];
		const a = group.reduce((s, i) => s + sum_a[i], 0);
		const b = group.reduce((s, i) => s + sum_b[i], 0);
		h = Math.atan2(b, a);
		const strength = best_votes / group.reduce((s, i) => s + count[i], 0);
		const coverage = group.reduce((s, i) => s + area[i], 0) / n;
		C = Math.min(MAX_C, Math.max(MIN_C, strength * 1.2 * Math.sqrt(Math.min(1, coverage / 0.3))));
	}

	for (let i = 0; i < 20; i++) {
		const rgb = oklab_to_linear(MIST_L, C * Math.cos(h), C * Math.sin(h));
		if (rgb.every((v) => v >= -0.0005 && v <= 1.0005)) {
			const [R, G, B] = rgb.map((v) => Math.round(from_linear(Math.min(1, Math.max(0, v))) * 255));
			return `rgb(${R} ${G} ${B})`;
		}
		C *= 0.85;
	}
	return null;
}

const to_linear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const LINEAR = Float64Array.from({ length: 256 }, (_, i) => to_linear(i / 255));
const from_linear = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

function linear_to_oklab(r: number, g: number, b: number) {
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
	];
}

function oklab_to_linear(L: number, a: number, b: number) {
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
	];
}
