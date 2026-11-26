/** the key went to a text field, where letters and arrows belong to the typing */
export function typing(e: KeyboardEvent) {
	const t = e.target as HTMLElement | null;
	return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}

/** the focused element already does something with this key: a button or link presses, a slider moves */
export function claimed(e: KeyboardEvent) {
	const t = e.target as HTMLElement | null;
	if (!t || t === document.body) return false;
	if (e.key === ' ' || e.key === 'Enter') return !!t.closest('button, a, [role="link"], [role="button"], [role="menuitem"]');
	if (e.key.startsWith('Arrow')) return !!t.closest('[role="slider"], [role="menu"]');
	return false;
}
