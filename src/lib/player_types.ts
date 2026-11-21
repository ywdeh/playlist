export interface QueueItem {
	name: string;
	artist: string;
	credits?: string;
	image?: string | null;
	album?: string | null;
	duration?: number | null;
	uri?: string;
	isrc?: string;
}

export interface Preview {
	url: string;
	name: string;
	artist: string;
	album: string;
	cover: string | null;
}

export interface Loaded {
	name: string;
	artist: string;
	album: string;
	cover: string | null;
	full: boolean;
}
