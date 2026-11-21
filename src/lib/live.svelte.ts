import { createSubscriber } from 'svelte/reactivity';

export const NOW_EVERY_MS = 5_000;
export const STATS_EVERY_MS = 2 * 60_000;

const subscribe = createSubscriber((update) => {
	const id = setInterval(update, 1000);
	return () => clearInterval(id);
});

export const clock = {
	get now() {
		subscribe();
		return Date.now();
	}
};

export function every(ms: number, run: () => unknown) {
	$effect(() => {
		let last = Date.now();
		const tick = () => {
			if (document.hidden) return;
			last = Date.now();
			run();
		};
		const back = () => {
			if (Date.now() - last >= ms) tick();
		};
		const id = setInterval(tick, ms);
		document.addEventListener('visibilitychange', back);
		return () => {
			clearInterval(id);
			document.removeEventListener('visibilitychange', back);
		};
	});
}
