export const LFM_PERIODS = ['7day', '1month', '12month', 'overall'] as const;
export type LfmPeriod = (typeof LFM_PERIODS)[number];

export const LFM_PERIOD_LABELS: Record<LfmPeriod, string> = {
	'7day': 'Week',
	'1month': 'Month',
	'12month': 'Year',
	overall: 'All time'
};

export const is_period = (p: string | null): p is LfmPeriod => LFM_PERIODS.includes(p as LfmPeriod);

export interface LfmUser {
	name: string;
	image: string | null;
	tracks: number;
	plays: number;
}

export interface SongDetails {
	album?: string | null;
	duration?: number | null;
}

export interface LfmTrack extends SongDetails {
	name: string;
	artist: string;
	image: string | null;
	plays: number;
}

export interface LfmArtist {
	name: string;
	plays: number;
}

export interface LfmScrobble extends Omit<SongDetails, 'album'> {
	name: string;
	artist: string;
	album: string;
	image: string | null;
	at: string | null;
	now_playing: boolean;
}

export interface LfmNew extends SongDetails {
	name: string;
	artist: string;
	image: string | null;
	first_played: string;
}

export interface Song extends SongDetails {
	name: string;
	artist: string;
	image: string | null;
}

export interface ArtistData {
	user: string;
	artist: string;
	yours: Song[];
	popular: Song[];
}

export interface PlaylistSong extends SongDetails {
	name: string;
	artist: string;
	image: string | null;
	spotify: string;
}

export interface Playlist {
	name: string;
	image: string | null;
	url: string;
	songs: PlaylistSong[];
}

export interface LiveData {
	user: string;
	updated: string;
	since: string | null;
	period: LfmPeriod;
	tracks: LfmTrack[];
	artists: LfmArtist[];
	recent: LfmScrobble[];
	fresh: LfmNew[];
}
