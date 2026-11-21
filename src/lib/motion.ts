export const T_IN = 200;
export const T_OUT = 340;
export const T_MOVE = 500;
export const T_ENTER = 600;

function bezier(x1: number, y1: number, x2: number, y2: number) {
	const curve = (t: number, p1: number, p2: number) => 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3;
	const slope = (t: number, p1: number, p2: number) =>
		3 * (1 - t) ** 2 * p1 + 6 * (1 - t) * t * (p2 - p1) + 3 * t ** 2 * (1 - p2);
	return (x: number) => {
		if (x <= 0) return 0;
		if (x >= 1) return 1;
		let t = x;
		for (let i = 0; i < 8; i++) {
			const s = slope(t, x1, x2);
			if (Math.abs(s) < 1e-6) break;
			t = Math.min(1, Math.max(0, t - (curve(t, x1, x2) - x) / s));
		}
		return curve(t, y1, y2);
	};
}

export const EASE_CSS = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
export const ease = bezier(0.2, 0.8, 0.2, 1);
export const ease_in = bezier(0.5, 0, 0.75, 0);
export const settle = (t: number) => 1 + 1.6 * (t - 1) ** 3 + 0.6 * (t - 1) ** 2;
