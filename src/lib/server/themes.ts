/**
 * Word lists that sort lyrics into feelings. Lyrics are only counted here, never kept or shown.
 * Each entry is a regex fragment matched at a word start; a trailing `*` lets the word run on
 * (so `remember*` also finds "remembering"). Lines are de-duplicated first, so a chorus counts once.
 */

export const THEMES = [
	'longing',
	'heartbreak',
	'nostalgia',
	'loneliness',
	'self_doubt',
	'struggle',
	'hurt',
	'grief',
	'anger',
	'love',
	'hope'
] as const;
export type Theme = (typeof THEMES)[number];

export const WARM: ReadonlySet<Theme> = new Set(['love', 'hope']);

/** how a theme reads in a sentence: "mostly about …" */
export const THEME_ABOUT: Record<Theme, string> = {
	longing: 'missing someone',
	heartbreak: 'love that didn’t last',
	nostalgia: 'looking back',
	loneliness: 'being alone',
	self_doubt: 'not feeling good enough',
	struggle: 'not being okay',
	hurt: 'hurting',
	grief: 'losing someone for good',
	anger: 'being hurt and angry',
	love: 'being in love',
	hope: 'getting through it'
};

const EN: Record<Theme, string[]> = {
	longing: [
		"miss(ing|ed)? (you|her|him|us)", 'i miss', 'wish (you|she|he) (were|was) (here|mine)', 'come back', 'coming back',
		'still (love|want|need|think)*', 'think(ing)? (about|of) (you|her|him)', "can'?t forget", 'without you', 'where are you',
		'want (you|her|him) back', 'if only', 'wait(ing)? for (you|her|him)', 'pick up the phone', 'text me back', 'far away',
		'come home', 'by my side', 'one more (time|night|day)', 'i need you', 'on my mind', 'still yours', 'were still here'
	],
	heartbreak: [
		'broke (my|your) heart', 'broken heart*', 'heartbr(eak|oken)*', 'good ?bye', 'let (you|me|her|him) go', 'letting (you|me|her|him) go',
		'walk(ed|ing)? away', 'walked out', '(you|she|he) left', 'left me', 'leave me', 'leaving me', 'moved? on', 'moving on',
		'some(one|body) new', 'break ?up', 'broke up', "(it'?s|we'?re) over", 'lost you', 'losing you', 'fell out of love',
		'fall(ing)? out of love', "(you )?(don'?t|didn'?t) love me", 'cheat*', 'drift(ed|ing)? apart', 'not mine( anymore)?',
		'with someone else', "(you'?re|she'?s|he'?s) gone", 'end(ed)? it'
	],
	nostalgia: [
		'remember*', 'used to', 'back then', 'back when', 'years ago', 'those days', 'old times', 'younger', 'when we were (young|kids)',
		'childhood', 'photo(graph)?s?', 'pictures?', 'memor(y|ies)', 'yesterday', 'summers?', 'nostalgi*', 'the past', 'grew up',
		'growing up', 'hometown', 'old (house|room|street|town|friends)', 'seventeen', 'sixteen', 'eighteen', 'the good old'
	],
	loneliness: [
		'alone', 'lonely', 'loneliness', 'lonesome', 'by myself', 'on my own', 'nobody', 'no one', 'empty (room|bed|house|chair|space|seat)',
		'isolat*', 'solitude', 'silence', 'no friends', 'left out', 'no one (cares|knows)', 'invisible', 'all on my own'
	],
	self_doubt: [
		'not (good )?enough', "i'?m sorry", 'my fault', 'to blame', 'hate myself', 'worthless', 'useless', "(i'?m )?a mess", 'failure',
		'i fail*', 'mistakes?', 'ruin(ed)? (it|everything)', 'insecur*', "what'?s wrong with me", 'not worth', 'ashamed', 'shame',
		'regret*', 'blame me', 'too much for', 'never be (enough|good)', 'who i am', 'disappoint*', 'deserve*'
	],
	struggle: [
		'tired', 'exhaust*', "can'?t sleep", 'sleepless', 'insomnia', 'anxi*', 'depress*', 'drown*', "can'?t breathe",
		'fall(ing)? apart', 'fell apart', 'breaking down', 'broke down', 'numb', 'hollow', 'scared', 'afraid', 'fears?',
		'darkness', 'demons?', 'in my head', 'therapy', 'pills', 'suffocat*', 'sinking', 'losing my mind', 'go(ing)? crazy',
		'overthink*', 'stuck', 'barely (holding|breathing|sleeping|alive)', "i'?m not (ok|okay|fine)", 'fall(ing)? to pieces'
	],
	hurt: ['hurts?', 'hurting', 'pain(ful)?', 'tears?', 'cry*', 'cried', 'bleed*', 'scars?', 'wounds?', 'ache*', 'aching', 'sad(ness)?', 'sorrow'],
	grief: [
		'funeral', 'graves?', 'heaven', 'angels?', 'died', 'dying', 'dead', 'death', 'rest in peace', 'passed away', 'too soon', 'ghosts?',
		'mourn*', 'grie(f|ve|ving)*', 'last breath', 'up above', 'in the sky', 'six feet', 'never coming back', 'gone forever'
	],
	anger: [
		'hate (you|it|this|that|her|him)', 'liars?', 'lies', 'lied', 'lying', 'fuck*', 'damn', 'angry', 'anger', 'rage', 'mad at', 'revenge',
		'never again', 'how could you', 'selfish', 'fake', 'toxic', 'used me', 'played me', 'karma', 'bitter*', 'screw (you|it)'
	],
	love: [
		'i love you', 'in love', 'darling', 'kiss(es|ed|ing)?', 'hold(ing)? (you|me) (close|tight)', 'in your arms', 'in my arms',
		'my everything', 'adore', 'marry', 'wedding', 'danc(e|ing) with you', 'my love', 'lover', 'you make me', 'feel(s)? like home',
		'lucky', 'the way you (smile|laugh|look)', 'fall(ing)? for you', 'fell for you'
	],
	hope: [
		"(it'?ll|it will|gonna|we'?ll|i'?ll) be (ok|okay|alright|fine)", 'better days', 'get(ting|s)? better', 'heal(s|ed|ing)?', 'hope(s|d|ful)?',
		'hoping', 'sunshine', 'sunrise', 'keep going', 'hold(ing)? on', 'brave', 'stronger', 'smil(e|es|ed|ing)', 'laugh(s|ed|ing)?',
		'happy', 'happiness', 'start (again|over)', 'new beginning', 'made it through', 'grateful'
	]
};

const L = '\\p{L}';
function compile(list: string[]): RegExp {
	const parts = list.map((p) => (p.endsWith('*') ? `${p.slice(0, -1)}[${L}']*` : `${p}(?![${L}])`));
	return new RegExp(`(?<![${L}])(?:${parts.join('|')})`, 'gu');
}

const PATTERNS = THEMES.map((t) => compile(EN[t]));

const ADDRESSED = /(?<![\p{L}'])(you|your|yours|you're|ya)(?![\p{L}])/u;
const SELF = /(?<![\p{L}'])(i|me|my|myself|i'm|i've|i'll|i'd|mine)(?![\p{L}])/u;

const EN_COMMON = new Set(['the', 'and', 'you', 'i', 'to', 'a', 'me', 'my', 'it', 'in', 'of', 'is', 'that', "i'm", 'we', 'your', 'be', 'on', 'for', 'but', 'so', 'all', 'just', 'know', 'like', 'love', "don't", 'when']);

/** only English lyrics are read for feelings; anything else is counted as another language */
export type Lang = 'en' | 'other';

export interface LyricFacts {
	lang: Lang;
	/** unique words read */
	words: number;
	/** matches per theme, in THEMES order (empty when the language has no word list) */
	themes: number[];
	/** lines sung to a "you" vs about "i" */
	you: number;
	me: number;
}

function lang_of(text: string, words: string[]): Lang {
	const letters = text.match(/\p{L}/gu)?.length ?? 0;
	const latin = text.match(/\p{Script=Latin}/gu)?.length ?? 0;
	if (!letters || latin / letters < 0.8) return 'other';
	const common = words.filter((w) => EN_COMMON.has(w)).length;
	return words.length && common / words.length > 0.12 ? 'en' : 'other';
}

const count = (re: RegExp, text: string) => text.match(re)?.length ?? 0;

export function read_lyrics(lyrics: string): LyricFacts {
	const lines = [
		...new Set(
			lyrics
				.toLowerCase()
				.replace(/[’‘`]/g, "'")
				.split('\n')
				.map((l) => l.replace(/\[.*?\]|\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim())
				.filter(Boolean)
		)
	];
	const text = lines.join('\n');
	const words = text.match(/[\p{L}']+/gu) ?? [];
	const lang = lang_of(text, words);
	if (lang === 'other') return { lang, words: words.length, themes: [], you: 0, me: 0 };
	return {
		lang,
		words: words.length,
		themes: PATTERNS.map((re) => count(re, text)),
		you: lines.filter((l) => ADDRESSED.test(l)).length,
		me: lines.filter((l) => SELF.test(l)).length
	};
}
