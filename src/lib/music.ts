export const PERIODS = ['short_term', 'medium_term', 'long_term'] as const;
export type Period = (typeof PERIODS)[number];

export const DEFAULT_PERIOD: Period = 'short_term';

export const PERIOD_LABELS: Record<Period, string> = {
	short_term: 'month',
	medium_term: '6 months',
	long_term: 'year'
};

export const is_period = (p: string | null): p is Period => PERIODS.includes(p as Period);

export interface Song {
	name: string;
	artist: string;
	credits?: string;
	image: string | null;
	album?: string | null;
	duration?: number | null;
	spotify?: string;
	artist_spotify?: string;
	isrc?: string;
	played?: string;
	plays?: number;
}

export interface Live extends Song {
	started: number;
	length: number;
}

export interface Artist {
	name: string;
	image: string | null;
	spotify?: string;
}

export interface Top {
	period: Period;
	tracks: Song[];
	artists: Artist[];
}

export interface LiveData extends Top {
	updated: string;
	now: Live | null;
	enjoyed: Song[];
}

export interface ArtistData {
	artist: string;
	image: string | null;
	spotify?: string;
	yours: Song[];
	popular: Song[];
}

export interface Playlist {
	name: string;
	image: string | null;
	url: string;
	songs: (Song & { spotify: string })[];
}
