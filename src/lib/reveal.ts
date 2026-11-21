export function reveal(el: HTMLElement) {
	if (typeof IntersectionObserver === 'undefined') return;
	if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

	if (el.getBoundingClientRect().top < innerHeight) return;
	el.classList.remove('cascade');
	el.classList.add('reveal', 'reveal_wait');

	const observer = new IntersectionObserver(
		(entries) => {
			if (!entries.some((e) => e.isIntersecting)) return;
			el.classList.remove('reveal_wait');
			observer.disconnect();
		},
		{ rootMargin: '0px 0px -8% 0px' }
	);
	observer.observe(el);
	return () => observer.disconnect();
}
