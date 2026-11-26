import { env, waitUntil } from 'cloudflare:workers';
import { PERIODS, type Insights, type Period } from '#lib/music';
import { best, norm } from '#lib/match';
import { peek, save, shared_drop, shared_get, shared_put } from './cache';
import { top_tracks, type Track } from './spotify';
import { THEMES, THEME_ABOUT, read_lyrics, type LyricFacts } from './themes';

const USER_AGENT = 'music-stats-site/1.0';
/** bump when the word lists change, so every song is read again */
const LYRICS_KEY = 'lyrics2';
const DAY_MS = 86_400_000;
const RETRY_MISSING_MS = 14 * DAY_MS;
const FILL_LOCK = 'lock:insights';
const FILL_LOCK_S = 60;
const FILL_BUDGET_MS = 20_000;
const BUSY_WAIT_MS = 2_000;
/** a feeling has to come up at least this often in a song's lyrics to count as a hint */
const MIN_MATCHES = 2;

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
/** bump when the prompt changes, so every paragraph is written again */
const SUMMARY_KEY = (p: Period) => `summary3:${p}`;
const SUMMARY_LOCK = (p: Period) => `lock:summary:${p}`;
const SONGS_FOR_AI = 25;
/** once written, a paragraph stays at least this long even if the top songs shift */
const REWRITE_AFTER_MS = 6 * 3_600_000;
const MAX_CHARS = 360;

type SongEntry = { at: number } & ({ kind: 'lyrics'; facts: LyricFacts } | { kind: 'instrumental' } | { kind: 'missing' });
type Songs = Record<string, SongEntry>;

class Busy extends Error {}

async function get_json(url: string): Promise<any> {
	const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
	if (res.status === 503 || res.status === 429) throw new Busy(`lrclib ${res.status}`);
	if (!res.ok) throw new Error(`lrclib ${res.status}`);
	return res.json();
}

const primary = (t: Track) => t.artists[0]?.name ?? '';

async function find_lyrics(t: Track): Promise<SongEntry> {
	const at = Date.now();
	const artist = primary(t);
	const seconds = (t.duration_ms ?? 0) / 1000;
	const pick = (list: any[]) => {
		const usable = (Array.isArray(list) ? list : []).filter((x) => x?.plainLyrics || x?.instrumental);
		const timed = usable.filter((x) => !seconds || !x.duration || Math.abs(x.duration - seconds) < 8);
		return best(timed.length ? timed : usable, { name: t.name, artist }, (x: any) => ({ name: x.trackName ?? '', artist: x.artistName ?? '' }));
	};
	const enc = encodeURIComponent;
	let hit = pick(await get_json(`https://lrclib.net/api/search?track_name=${enc(t.name)}&artist_name=${enc(artist)}`));
	if (!hit) hit = pick(await get_json(`https://lrclib.net/api/search?q=${enc(`${artist} ${norm(t.name)}`)}`));
	if (!hit) return { at, kind: 'missing' };
	if (hit.instrumental || !hit.plainLyrics) return { at, kind: 'instrumental' };
	return { at, kind: 'lyrics', facts: read_lyrics(hit.plainLyrics) };
}

/** top tracks of every time range, interleaved by rank so the best songs are read first */
function queue_of(tops: Record<Period, Track[]>): Track[] {
	const seen = new Set<string>();
	const out: Track[] = [];
	const longest = Math.max(...PERIODS.map((p) => tops[p].length));
	for (let i = 0; i < longest; i++)
		for (const p of PERIODS) {
			const t = tops[p][i];
			if (t?.id && !seen.has(t.id)) seen.add(t.id) && out.push(t);
		}
	return out;
}

const due = (s: SongEntry | undefined) => !s || (s.kind !== 'lyrics' && Date.now() - s.at > RETRY_MISSING_MS);

let filling = false;

/**
 * Reads lyrics for top songs that haven't been read yet, until the time runs out.
 * Only the counts are kept, never the lyrics, and each song is looked up once.
 */
export async function fill_insights(budget_ms = FILL_BUDGET_MS) {
	if (filling || (await shared_get(FILL_LOCK))) return { busy: true };
	filling = true;
	shared_put(FILL_LOCK, '1', FILL_LOCK_S);
	try {
		const deadline = Date.now() + Math.min(budget_ms, (FILL_LOCK_S - 5) * 1000);
		const [tops, kept] = await Promise.all([top_tracks(), peek<Songs>(LYRICS_KEY)]);
		const queue = queue_of(tops);
		const songs: Songs = Object.fromEntries(queue.filter((t) => kept?.[t.id]).map((t) => [t.id, kept![t.id]]));
		let read = 0;
		let busy_once = false;
		for (const t of queue) {
			if (Date.now() > deadline) break;
			if (!due(songs[t.id])) continue;
			try {
				songs[t.id] = await find_lyrics(t);
				read++;
			} catch (e) {
				if (!(e instanceof Busy)) console.error(`lyrics for ${t.name}:`, e instanceof Error ? e.message : e);
				else if (busy_once) break;
				else {
					busy_once = true;
					await new Promise((r) => setTimeout(r, BUSY_WAIT_MS));
				}
			}
		}
		await save(LYRICS_KEY, songs);
		return { read, left: queue.filter((t) => due(songs[t.id])).length };
	} finally {
		filling = false;
		await shared_drop(FILL_LOCK);
	}
}

type Summary = { at: number; songs: string; text: string };

const WHEN: Record<Period, { range: string; start: string }> = {
	short_term: { range: 'the past month', start: 'lately' },
	medium_term: { range: 'the past 6 months', start: 'for the past few months' },
	long_term: { range: 'the past year', start: 'this year' }
};

const STYLE = `you write a short note for the top of my personal music page, in my own voice.
- one or two sentences, under 45 words, all lowercase, first person, plain and warm, like texting a close friend.
- most of my music is sad, so never just say "sad": be specific about what kind of sad it is and what the songs keep coming back to, in your own fresh words.
- gentle wording. no blunt words like "breakup", "things ending" or "depression".
- no song titles or artist names, no genres lists, no emojis, no quotes, no exclamation marks, no clichés like "soundtrack of my life" or "rollercoaster".
- only describe what the songs and hints support. if unsure, stay general rather than invent.
- don't open with "i've been listening to"; get to the feeling straight away.
- reply with the note only.`;

function hints(entry: SongEntry | undefined): string {
	if (entry?.kind === 'instrumental') return 'instrumental';
	if (entry?.kind !== 'lyrics' || entry.facts.lang !== 'en') return '';
	const { themes } = entry.facts;
	return THEMES.map((t, k) => ({ t, n: themes[k] }))
		.filter(({ t, n }) => t !== 'hurt' && n >= MIN_MATCHES)
		.sort((a, b) => b.n - a.n)
		.slice(0, 2)
		.map(({ t }) => THEME_ABOUT[t])
		.join(', ');
}

/**
 * The songs for one time range, marked with what sets the range apart:
 * for the shorter ranges, songs that aren't among the year's favourites; for the year, the ones still played lately.
 */
function prompt(period: Period, tops: Record<Period, Track[]>, songs: Songs, others: string[]) {
	const tracks = tops[period].slice(0, SONGS_FOR_AI);
	const year = new Set(tops.long_term.map((t) => t.id));
	const lately = new Set(tops.short_term.slice(0, SONGS_FOR_AI).map((t) => t.id));
	const mark = (t: Track) =>
		period === 'long_term' ? (lately.has(t.id) ? 'still on repeat lately' : '') : year.has(t.id) ? '' : `new, not one of my yearly favourites`;
	const lines = tracks.map((t, i) => {
		const notes = [hints(songs[t.id]) && `lyrics lean toward ${hints(songs[t.id])}`, mark(t)].filter(Boolean).join('; ');
		return `${i + 1}. ${t.name} by ${t.artists.map((a) => a.name).join(', ')}${notes ? ` (${notes})` : ''}`;
	});
	const focus =
		period === 'long_term'
			? 'this note is about the whole year: what has stayed with me the longest.'
			: `this note is about ${WHEN[period].range} only: focus on what's different from the rest of my year, especially the songs marked new.`;
	const avoid = others.length
		? `\n\nnotes already written for my other time ranges, so say something clearly different and don't reuse their words:\n${others.map((o) => `- ${o}`).join('\n')}`
		: '';
	return `my most played songs of ${WHEN[period].range}, most played first:\n${lines.join('\n')}\n\n${focus}${avoid}\n\nstart the note with "${WHEN[period].start}".`;
}

/** the paragraph ends without a full stop, like the rest of the site's text */
const no_end_dot = (text: string) => text.replace(/\.+$/, '');

/** keeps only a clean sentence or two; anything odd and the paragraph is left out */
function tidy(raw: string | undefined): string | null {
	const text = (raw ?? '')
		.replace(/^["'“”\s]+|["'“”\s]+$/g, '')
		.replace(/\s+/g, ' ')
		.toLowerCase()
		.trim();
	const sentences = text.match(/[^.!?]+[.!?]+/g) ?? (text ? [text] : []);
	const kept = sentences.slice(0, 2).join(' ').replace(/!/g, '.').trim();
	return kept && kept.length <= MAX_CHARS ? no_end_dot(kept) : null;
}

const top_set = (tracks: Track[]) => tracks.map((t) => t.id).sort().join(',');

async function write_summary(period: Period, tops: Record<Period, Track[]>, songs: Songs) {
	if (!env.AI || (await shared_get(SUMMARY_LOCK(period)))) return;
	shared_put(SUMMARY_LOCK(period), '1', 60);
	try {
		const others = (await Promise.all(PERIODS.filter((p) => p !== period).map((p) => peek<Summary>(SUMMARY_KEY(p)))))
			.map((s) => s?.text)
			.filter((t): t is string => !!t);
		const out = await env.AI.run(MODEL, {
			messages: [
				{ role: 'system', content: STYLE },
				{ role: 'user', content: prompt(period, tops, songs, others) }
			],
			max_tokens: 120,
			temperature: 0.8
		});
		const text = tidy(out?.response);
		const tracks = tops[period].slice(0, SONGS_FOR_AI);
		if (text) await save<Summary>(SUMMARY_KEY(period), { at: Date.now(), songs: top_set(tracks), text });
	} finally {
		await shared_drop(SUMMARY_LOCK(period));
	}
}

/**
 * The paragraph for a time range, written by the AI from my top songs and what their lyrics lean toward.
 * It's written in the background and kept; until there is one, or when the AI can't be reached, there's no paragraph.
 */
export async function load_insights(period: Period): Promise<Insights> {
	const [tops, kept, summary] = await Promise.all([top_tracks(), peek<Songs>(LYRICS_KEY), peek<Summary>(SUMMARY_KEY(period))]);
	const songs = kept ?? {};
	const tracks = tops[period].slice(0, SONGS_FOR_AI);

	if (queue_of(tops).some((t) => due(songs[t.id])))
		waitUntil(fill_insights().catch((e) => console.error('filling insights:', e instanceof Error ? e.message : e)));

	// wait for the lyrics of these songs before writing, so the hints are all there
	const lyrics_read = tracks.every((t) => !due(songs[t.id]));
	const changed = !summary || (summary.songs !== top_set(tracks) && Date.now() - summary.at > REWRITE_AFTER_MS);
	if (lyrics_read && changed && tracks.length)
		waitUntil(write_summary(period, tops, songs).catch((e) => console.error(`writing ${period} insight:`, e instanceof Error ? e.message : e)));

	return { period, ready: !!summary, text: summary ? no_end_dot(summary.text) : null };
}
