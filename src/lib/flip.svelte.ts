import { EASE_CSS, T_MOVE } from './motion';

const SLIDE = { duration: T_MOVE, easing: EASE_CSS };

export function flip(items: () => unknown) {
	return (list: HTMLElement) => {
		let before = new Map<Element, number>();
		$effect.pre(() => {
			items();
			before = new Map([...list.children].map((child) => [child, child.getBoundingClientRect().top]));
		});
		$effect(() => {
			items();
			for (const child of list.children) {
				const top = before.get(child);
				const shift = top === undefined ? 0 : top - child.getBoundingClientRect().top;
				if (Math.abs(shift) > 1) child.animate([{ translate: `0 ${shift}px` }, { translate: '0 0' }], SLIDE);
			}
		});
	};
}
