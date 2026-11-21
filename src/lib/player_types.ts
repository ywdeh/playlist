export interface QueueItem {
	name: string;
	artist: string;
	image?: string | null;
}

export interface Preview {
	url: string;
	name: string;
	artist: string;
	album: string;
	cover: string | null;
}
