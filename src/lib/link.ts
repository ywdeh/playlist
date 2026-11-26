import { goto, preloadData } from '$app/navigation';

export function out_link(url: string) {
	return (el: HTMLElement) => {
		el.setAttribute('role', 'link');
		el.tabIndex = 0;
		const open = () => {
			if (url.startsWith('mailto:')) location.href = url;
			else window.open(url, '_blank', 'noopener,noreferrer');
		};
		const click = (e: MouseEvent) => {
			if (e.defaultPrevented) return;
			e.preventDefault();
			open();
		};
		const middle = (e: MouseEvent) => {
			if (e.button === 1) (e.preventDefault(), open());
		};
		const key = (e: KeyboardEvent) => {
			if (e.key === 'Enter') open();
		};
		el.addEventListener('click', click);
		el.addEventListener('auxclick', middle);
		el.addEventListener('keydown', key);
		return () => {
			el.removeEventListener('click', click);
			el.removeEventListener('auxclick', middle);
			el.removeEventListener('keydown', key);
		};
	};
}

export function link(href: () => string) {
	return (el: HTMLElement) => {
		el.setAttribute('role', 'link');
		el.tabIndex = 0;

		const open = (new_tab: boolean) => {
			if (new_tab) window.open(href(), '_blank', 'noopener');
			else goto(href());
		};
		const click = (e: MouseEvent) => {
			if (e.defaultPrevented) return;
			e.preventDefault();
			open(e.ctrlKey || e.metaKey || e.shiftKey);
		};
		const middle = (e: MouseEvent) => {
			if (e.button !== 1) return;
			e.preventDefault();
			open(true);
		};
		const key = (e: KeyboardEvent) => {
			if (e.key === 'Enter' && !e.defaultPrevented) open(e.ctrlKey || e.metaKey);
		};
		const preload = () => preloadData(href()).catch(() => {});

		el.addEventListener('click', click);
		el.addEventListener('auxclick', middle);
		el.addEventListener('keydown', key);
		el.addEventListener('pointerenter', preload);
		el.addEventListener('focus', preload);
		return () => {
			el.removeEventListener('click', click);
			el.removeEventListener('auxclick', middle);
			el.removeEventListener('keydown', key);
			el.removeEventListener('pointerenter', preload);
			el.removeEventListener('focus', preload);
		};
	};
}
