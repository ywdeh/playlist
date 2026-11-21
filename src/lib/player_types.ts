export interface QueueItem {
	name: string;
	artist: string;
	credits?: string;
	image?: string | null;
	album?: string | null;
	isrc?: string;
}

export interface Preview {
	url: string;
	name: string;
	artist: string;
	album: string;
	cover: string | null;
}
