import { T_MOVE } from './motion';

/**
 * Eases a box's height to its content's, so what's below folds open or shut instead of jumping,
 * the same way the "show more" lists do. The box needs one child holding the content.
 */
export function fold(box: HTMLElement) {
	const inner = box.firstElementChild as HTMLElement | null;
	if (!inner) return;
	let last = -1;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const resize = new ResizeObserver(() => {
		const h = inner.offsetHeight;
		if (h === last) return;
		// clipped only while it moves, so tooltips inside can still reach past it
		if (last >= 0) {
			box.style.overflow = 'clip';
			clearTimeout(timer);
			timer = setTimeout(() => (box.style.overflow = ''), T_MOVE + 50);
		}
		last = h;
		box.style.height = `${h}px`;
	});
	resize.observe(inner);
	return () => {
		resize.disconnect();
		clearTimeout(timer);
	};
}
