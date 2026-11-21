export function length(seconds: number) {
	const s = Math.round(seconds);
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function ago(iso: string | null, now = Date.now()) {
	if (!iso) return 'never';
	const diff = now - new Date(iso).getTime();
	if (diff < 60_000) return 'just now';
	if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
	if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
	const days = Math.floor(diff / 86_400_000);
	if (days < 30) return `${days}d ago`;
	if (days < 365) return `${Math.floor(days / 30)}mo ago`;
	return `${(days / 365).toFixed(1).replace(/\.0$/, '')}y ago`;
}
