<script lang="ts">
	import Cover from '#lib/components/cover.svelte';
	import Eq from '#lib/components/eq.svelte';

	const COLOURS = [
		['--bg', 'page'],
		['--surface', 'cards, pills, menus'],
		['--surface-2', 'empty covers'],
		['--text', 'main text'],
		['--muted', 'secondary text'],
		['--accent', 'tint, active, filled'],
		['--accent-ink', 'text on accent'],
		['--wash', 'hover'],
		['--tint', 'focus, tracks'],
		['--line', 'scrollbar'],
		['--shadow', 'floating shadow']
	];
	const TONES = ['--tone-full', '--tone-line', '--tone-tint', '--tone-wash', '--tone-text', '--tone-grain', '--tone-off'];
	const SIZES = [
		['--fs-display', 'page titles'],
		['--fs-xl', 'section titles, now playing'],
		['--fs-lg', 'song names, intro'],
		['--fs-md', 'body'],
		['--fs-sm', 'artists, pills, menus'],
		['--fs-xs', 'times, tooltips']
	];
	const WEIGHTS = [
		['--fw-ui', 'ui text'],
		['--fw-name', 'song and artist names'],
		['--fw-strong', 'pills, labels, ranks'],
		['--fw-heading', 'section titles']
	];
	const RADII = [
		['--r-sm', 'covers, menu items, tooltips, focus'],
		['--r-md', 'menus, big tooltips, now playing cover'],
		['--r-lg', 'rows, player, now playing card'],
		['--r-pill', 'pills, round buttons, artists']
	];
	const LINES = [
		['--bar', 'progress, scrollbar'],
		['--stroke', 'icons, separators, spinner']
	];
	const LAYOUT = [
		['--gutter', 'page sides'],
		['--section-gap', 'between sections'],
		['--inset', 'row padding and hover bleed']
	];
	const DURATIONS = [
		['--t-in', 'hover in, press'],
		['--t-out', 'hover out, fades, colour, progress'],
		['--t-move', 'moves, covers, cascade, player in'],
		['--t-reveal', 'scroll reveal']
	];
	const EASES = [
		['--ease', 'default motion, colour'],
		['--ease-ui', 'hover and press'],
		['--ease-in', 'leaving']
	];
	const GAPS = [
		['--gap-2xs', 'lines inside a row, player rows'],
		['--gap-xs', 'artist card label, player tools'],
		['--gap-sm', 'list rows, menu padding, arrows'],
		['--gap-md', 'pills, player controls, seek, inset'],
		['--gap-lg', 'title bar, player info, shelf on phone'],
		['--gap-xl', 'row parts, big tooltip sides'],
		['--gap-2xl', 'section titles, shelf cards, artist header'],
		['--gap-3xl', 'player columns'],
		['--gap-4xl', 'page top, first section on home'],
		['--gap-5xl', 'first section on artist page']
	];
	const CONTROLS = [
		['--control-lg', 'pill, player play, back'],
		['--control-md', 'menu item, pill on phone'],
		['--control-sm', 'icon button, shelf arrow, info'],
		['--icon', 'icon glyph']
	];
	const HEIGHTS = [
		[88, 'song row', '72 on phone'],
		[64, 'big play'],
		[32, 'speaker'],
		[12, 'seek knob']
	];
	const COVERS = [
		[48, 'player on phone'],
		[72, 'player, rows'],
		[112, 'now playing'],
		[196, 'artist card']
	];
	const MENU = ['play', 'go to artist', 'open in spotify', 'open artist in spotify'];

	const art = (a: string, b: string) =>
		`data:image/svg+xml,${encodeURIComponent(
			`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/></svg>`
		)}`;
	const ART = [art('#3b5b7a', '#c9d6e3'), art('#6b3b5a', '#e3b8c9'), art('#3b6b4f', '#c9e3cf')];

	let values = $state<Record<string, string>>({});
	let copied = $state(false);

	$effect(() => {
		const style = getComputedStyle(document.documentElement);
		const names = [...COLOURS, ...SIZES, ...WEIGHTS, ...RADII, ...LINES, ...LAYOUT, ...DURATIONS, ...EASES, ...GAPS, ...CONTROLS].map(([n]) => n);
		values = Object.fromEntries([...names, ...TONES].map((n) => [n, style.getPropertyValue(n).trim()]));
	});

	const value = (name: string) => values[name] ?? '';
</script>

<svelte:head>
	<title>design map</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#snippet play_icon()}<svg viewBox="0 0 24 24" class="solid"><path d="M9 6.8v10.4l8.1-5.2z" /></svg>{/snippet}
{#snippet next_icon()}<svg viewBox="0 0 24 24" class="solid"><path d="M17 7v10M7 7.9v8.2l5.8-4.1z" /></svg>{/snippet}
{#snippet repeat_icon()}<svg viewBox="0 0 24 24" class="stroke"><path d="M4 11V9.5A3.5 3.5 0 0 1 7.5 6H18m-3-3 3 3-3 3M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H6m3 3-3-3 3-3" /></svg>{/snippet}
{#snippet arrow_icon()}<svg viewBox="0 0 24 24" class="stroke"><path d="M10 7l5 5-5 5" /></svg>{/snippet}
{#snippet back_icon()}<svg viewBox="0 0 24 24" class="stroke"><path d="M14 7l-5 5 5 5" /></svg>{/snippet}
{#snippet info_icon()}<svg viewBox="0 0 24 24" class="stroke"><circle cx="12" cy="12" r="8" /><path d="M12 11v5M12 8h.01" /></svg>{/snippet}

<h1 class="cascade">design map</h1>
<p class="intro muted cascade" style:--i={1}>every shared token and reusable piece of the site, in every state.</p>

<section>
	<h2>colours</h2>
	<div class="swatches">
		{#each COLOURS as [name, use] (name)}
			<div class="swatch">
				<span class="chip" style:background="var({name})"></span>
				<span class="token">{name}</span>
				<span class="note">{use}</span>
			</div>
		{/each}
	</div>
	<h3>tones</h3>
	<p class="lead">how strongly the tint shows in each role</p>
	<div class="specs">
		{#each TONES as name (name)}
			<div class="spec">
				<span class="token">{name}</span>
				<span class="meter"><span style:width="calc(var({name}) * 100%)"></span></span>
				<span class="value">{value(name)}</span>
			</div>
		{/each}
	</div>
</section>

<section>
	<h2>type</h2>
	<p class="lead">outfit variable, 18px base, 1.35 line height</p>
	<div class="specs">
		{#each SIZES as [name, use] (name)}
			<div class="type_row">
				<span class="sample ellipsis" style:font-size="var({name})">Star Odyssey</span>
				<span class="token">{name}</span>
				<span class="value">{value(name)}</span>
				<span class="note">{use}</span>
			</div>
		{/each}
	</div>
	<h3>weights</h3>
	<div class="specs">
		{#each WEIGHTS as [name, use] (name)}
			<div class="type_row">
				<span class="sample" style:font-weight="var({name})">WHERE YOU BELONG</span>
				<span class="token">{name}</span>
				<span class="value">{value(name)}</span>
				<span class="note">{use}</span>
			</div>
		{/each}
	</div>
	<h3>headings</h3>
	<div class="stack">
		<span class="h1_sample">h1 display</span>
		<h2 class="flat">h2 section title</h2>
		<span class="muted">muted text</span>
		<span class="ellipsis fade_demo" data-clipped>a very long song name that runs out of room and fades away at the end</span>
	</div>
</section>

<section>
	<h2>spacing</h2>
	<div class="specs">
		{#each LAYOUT as [name, use] (name)}
			<div class="spec">
				<span class="token">{name}</span>
				<span class="ruler" style:width="var({name})"></span>
				<span class="value">{value(name)}</span>
				<span class="note">{use}</span>
			</div>
		{/each}
	</div>
	<h3>gaps</h3>
	<div class="specs">
		{#each GAPS as [name, use] (name)}
			<div class="spec">
				<span class="token">{name}</span>
				<span class="ruler" style:width="var({name})"></span>
				<span class="value">{value(name)}</span>
				<span class="note">{use}</span>
			</div>
		{/each}
	</div>
	<h3>controls</h3>
	<div class="specs">
		{#each CONTROLS as [name, use] (name)}
			<div class="spec">
				<span class="token">{name}</span>
				<span class="ruler tall" style:height="var({name})" style:width="var({name})"></span>
				<span class="value">{value(name)}</span>
				<span class="note">{use}</span>
			</div>
		{/each}
	</div>
	<h3>other heights</h3>
	<div class="specs">
		{#each HEIGHTS as [px, use, phone] (use)}
			<div class="spec">
				<span class="token">{px}px</span>
				<span class="ruler tall" style:height="{px}px" style:width="{px}px"></span>
				<span class="note">{use}{phone ? `, ${phone}` : ''}</span>
			</div>
		{/each}
	</div>
</section>

<section>
	<h2>shape</h2>
	<div class="swatches">
		{#each RADII as [name, use] (name)}
			<div class="swatch">
				<span class="chip shape" style:border-radius="var({name})"></span>
				<span class="token">{name}</span>
				<span class="note">{value(name)}, {use}</span>
			</div>
		{/each}
	</div>
	<h3>lines</h3>
	<div class="specs">
		{#each LINES as [name, use] (name)}
			<div class="spec">
				<span class="token">{name}</span>
				<span class="line" style:height="var({name})" style:border-radius="var({name})"></span>
				<span class="value">{value(name)}</span>
				<span class="note">{use}</span>
			</div>
		{/each}
	</div>
	<h3>surfaces</h3>
	<div class="surfaces">
		<div class="surface flat_card">surface</div>
		<div class="surface floating">floating, with shadow</div>
		<div class="surface glass">player glass</div>
	</div>
</section>

<section>
	<h2>motion</h2>
	<p class="lead">hover a row to play it</p>
	<div class="specs">
		{#each DURATIONS as [name, use] (name)}
			<div class="motion_row" style:--d="var({name})" style:--e="var(--ease)">
				<span class="token">{name}</span>
				<span class="track"><span class="dot"></span></span>
				<span class="value">{value(name)}</span>
				<span class="note">{use}</span>
			</div>
		{/each}
		{#each EASES as [name, use] (name)}
			<div class="motion_row" style:--d="var(--t-reveal)" style:--e="var({name})">
				<span class="token">{name}</span>
				<span class="track"><span class="dot"></span></span>
				<span class="value ellipsis">{value(name)}</span>
				<span class="note">{use}</span>
			</div>
		{/each}
	</div>
	<h3>entrances</h3>
	<div class="states">
		<div class="state">
			<span class="pill demo_cascade">cascade</span>
			<span class="note">fade up 12px, 40ms apart</span>
		</div>
		<div class="state">
			<span class="pill demo_swap">swap</span>
			<span class="note">fade up 6px</span>
		</div>
		<div class="state">
			<span class="pill demo_reveal">reveal</span>
			<span class="note">fade up 24px on scroll</span>
		</div>
	</div>
</section>

<section>
	<h2>pills</h2>
	<div class="states">
		<div class="state"><span class="pill">month</span><span class="note">default</span></div>
		<div class="state"><span class="pill is_hover">month</span><span class="note">hover</span></div>
		<div class="state"><span class="pill is_focus">month</span><span class="note">focus</span></div>
		<div class="state"><span class="pill is_press">month</span><span class="note">pressed</span></div>
		<div class="state"><span class="pill" aria-pressed="true">month</span><span class="note">selected</span></div>
		<div class="state"><button class="pill press">try me</button><span class="note">live</span></div>
	</div>
</section>

<section>
	<h2>icon buttons</h2>

	<h3>player icon, 40px</h3>
	<div class="states">
		<div class="state"><span class="icon">{@render next_icon()}</span><span class="note">default</span></div>
		<div class="state"><span class="icon wash">{@render next_icon()}</span><span class="note">hover</span></div>
		<div class="state"><span class="icon is_press">{@render next_icon()}</span><span class="note">pressed</span></div>
		<div class="state"><span class="icon off">{@render next_icon()}</span><span class="note">disabled</span></div>
	</div>
	<h3>side icon, 40px</h3>
	<div class="states">
		<div class="state"><span class="icon side">{@render repeat_icon()}</span><span class="note">default</span></div>
		<div class="state"><span class="icon side lit">{@render repeat_icon()}</span><span class="note">hover</span></div>
		<div class="state"><span class="icon on">{@render repeat_icon()}</span><span class="note">on</span></div>
	</div>
	<h3>filled play</h3>
	<div class="states">
		<div class="state"><span class="icon main">{@render play_icon()}</span><span class="note">player, 48px</span></div>
		<div class="state"><span class="icon main is_press">{@render play_icon()}</span><span class="note">pressed</span></div>
		<div class="state"><span class="icon main big">{@render play_icon()}</span><span class="note">artist page, 64px</span></div>
		<div class="state"><span class="icon main"><span class="spin"></span></span><span class="note">loading</span></div>
	</div>
	<h3>surface circles</h3>
	<div class="states">
		<div class="state"><span class="icon raised arrow">{@render arrow_icon()}</span><span class="note">arrow, 40px</span></div>
		<div class="state"><span class="icon raised arrow wash_raised">{@render arrow_icon()}</span><span class="note">hover</span></div>
		<div class="state"><span class="icon raised arrow off">{@render arrow_icon()}</span><span class="note">disabled</span></div>
		<div class="state"><span class="icon raised back">{@render back_icon()}</span><span class="note">back, 48px</span></div>
		<div class="state"><span class="icon side">{@render info_icon()}</span><span class="note">info, 40px</span></div>
	</div>
</section>

<section>
	<h2>text links</h2>
	<div class="states">
		<div class="state"><span class="way">hello@hedwy.art</span><span class="note">default</span></div>
		<div class="state"><span class="way hot">hello@hedwy.art</span><span class="note">hover</span></div>
		<div class="state">
			<span class="way copied"><span class="gone">hello@hedwy.art</span><span class="done">copied</span></span>
			<span class="note">copied</span>
		</div>
		<div class="state"><span class="title_link">Star Odyssey</span><span class="note">player title hover</span></div>
	</div>
</section>

<section>
	<h2>tooltips</h2>
	<div class="tips">
		<span class="tip_anchor tip_show anchor_dot">
			<span class="tip" role="tooltip">one of my favourites</span>
		</span>
		<span class="tip_anchor tip_show anchor_dot">
			<span class="tip wide below" role="tooltip">
				<strong>updated 5m ago</strong>
				<span>straight from my spotify</span>
			</span>
		</span>
		<span class="tip_anchor anchor_dot live_tip" role="button" tabindex="0">
			{@render info_icon()}
			<span class="tip" role="tooltip">hover or focus me</span>
		</span>
	</div>
</section>

<section>
	<h2>covers</h2>
	<div class="states">
		{#each COVERS as [px, use], i (px)}
			<div class="state">
				<span class="cover_box" style:width="{px}px"><Cover src={ART[i % ART.length]} /></span>
				<span class="note">{px}px, {use}</span>
			</div>
		{/each}
	</div>
	<div class="states">
		<div class="state">
			<span class="cover_box" style:width="120px"><Cover src={ART[1]} round /></span>
			<span class="note">round, artists</span>
		</div>
		<div class="state">
			<span class="cover_box" style:width="120px"><Cover src={null} /></span>
			<span class="note">empty or loading</span>
		</div>
	</div>
	<h3>playing</h3>
	<div class="states">
		<div class="state"><span class="eq_box"><Eq size={13} /></span><span class="note">13px label</span></div>
		<div class="state"><span class="eq_box"><Eq size={16} /></span><span class="note">16px row</span></div>
	</div>
</section>

<section>
	<h2>song rows</h2>
	{#snippet row(state: string, label: string, rank: string, name: string, artist: string, end: string, cover: number)}
		<div class="state wide_state">
			<div class="row {state}">
				<span class="rank">
					{#if rank === 'heart'}
						<svg viewBox="0 0 24 24"><path d="M12 20.3 10.9 19.3C6 14.9 2.9 12.1 2.9 8.6 2.9 5.9 5 3.8 7.7 3.8c1.6 0 3.2.8 4.3 2 1.1-1.2 2.7-2 4.3-2 2.7 0 4.8 2.1 4.8 4.8 0 3.5-3.1 6.3-8 10.7z" /></svg>
					{:else}{rank}{/if}
				</span>
				<span class="row_art"><Cover src={ART[cover]} /></span>
				<span class="text">
					<span class="name ellipsis">{name}</span>
					<span class="artist ellipsis">{artist}</span>
				</span>
				<span class="album ellipsis">{name}</span>
				<span class="end">{#if end === 'eq'}<Eq size={16} />{:else}{end}{/if}</span>
			</div>
			<span class="note">{label}</span>
		</div>
	{/snippet}
	<div class="rows">
		{@render row('', 'default', '1', 'Star Odyssey', 'HOYO-MiX', '3:14', 0)}
		{@render row('hover', 'hover', '2', 'WHERE YOU BELONG', 'Matt Hansen', '2:58', 1)}
		{@render row('hover is_press_row', 'pressed', '3', 'UNETHICAL', 'tobias', '3:14', 2)}
		{@render row('active', 'playing', '4', 'The Long Way', 'Ben Kessler', 'eq', 0)}
		{@render row('unplayable', 'not playable', '5', 'garden green eyes', 'Orange Oak', '2:41', 1)}
		{@render row('', 'favourite', 'heart', 'too good to be true', 'Rozei', '3:02', 2)}
		{@render row('', 'recently enjoyed', '', 'her', 'JVKE', '2h ago', 0)}
	</div>
</section>

<section>
	<h2>now playing</h2>
	<div class="now">
		<span class="now_art"><Cover src={ART[0]} /></span>
		<div class="now_text">
			<span class="now_label"><Eq size={13} />i'm listening to</span>
			<strong class="now_title ellipsis">The Long Way</strong>
			<span class="muted ellipsis">Ben Kessler</span>
			<span class="seek">
				<span class="time">2:44</span>
				<span class="bar"><span class="fill" style:width="72%"></span></span>
				<span class="time">3:24</span>
			</span>
		</div>
	</div>
</section>

<section>
	<h2>sliders</h2>
	<div class="states">
		<div class="state wide_state">
			<span class="slider"><span class="fill" style:width="40%"></span></span>
			<span class="note">resting</span>
		</div>
		<div class="state wide_state">
			<span class="slider"><span class="fill" style:width="40%"></span><span class="knob" style:left="40%"></span></span>
			<span class="note">hover, focus, dragging</span>
		</div>
		<div class="state">
			<span class="slider short"><span class="fill" style:width="70%"></span></span>
			<span class="note">volume, 84px</span>
		</div>
	</div>
</section>

<section>
	<h2>menu</h2>
	<div class="menu_demo">
		{#each MENU as label, i (label)}
			<span class="menu_item" class:armed={i === 1}>{label}{#if i === 1}<span class="note inline">hover, armed</span>{/if}</span>
			{#if i === 1}<span class="menu_gap"></span>{/if}
		{/each}
		<span class="menu_gap"></span>
		<span class="menu_item copied_item">copied</span>
	</div>
</section>

<section>
	<h2>focus</h2>
	<div class="states">
		<div class="state"><button class="pill press">tab to me</button><span class="note">keyboard focus fills with tint</span></div>
		<div class="state"><span class="focus_demo">focused link</span><span class="note">forced</span></div>
	</div>
</section>

<section>
	<h2>texture</h2>
	<div class="states">
		<div class="state"><span class="grain_demo"></span><span class="note">grain, moves every second</span></div>
		<div class="state"><span class="fade_box"></span><span class="note">shelf edge fade</span></div>
	</div>
</section>

<style>
	h1 {
		margin: clamp(24px, 10svh, 120px) 0 var(--gap-2xl);
	}
	.intro {
		margin-bottom: var(--gap-3xl);
		font-size: var(--fs-lg);
	}
	section {
		margin-top: var(--section-gap);
	}
	h2 {
		margin: 0 0 var(--gap-2xl);
	}
	.flat {
		margin: 0;
	}
	h3 {
		margin: var(--gap-4xl) 0 var(--gap-lg);
		font-size: var(--fs-md);
		font-weight: var(--fw-strong);
		color: var(--muted);
	}
	.lead {
		margin: calc(-1 * var(--gap-md)) 0 var(--gap-2xl);
		color: var(--muted);
		font-size: var(--fs-sm);
	}
	.token {
		font-size: var(--fs-sm);
		font-weight: var(--fw-strong);
		font-variant-numeric: tabular-nums;
	}
	.value {
		color: var(--muted);
		font-size: var(--fs-xs);
		font-variant-numeric: tabular-nums;
	}
	.note {
		color: var(--muted);
		font-size: var(--fs-xs);
	}
	.note.inline {
		margin-left: auto;
	}

	.swatches {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: var(--gap-2xl) var(--gap-xl);
	}
	.swatch {
		display: grid;
		gap: var(--gap-xs);
	}
	.chip {
		height: 72px;
		margin-bottom: var(--gap-sm);
		border-radius: var(--r-md);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text) 8%, transparent);
	}
	.chip.shape {
		width: 72px;
		background: var(--surface-2);
		box-shadow: none;
	}

	.specs {
		display: grid;
		gap: var(--gap-md);
	}
	.spec,
	.type_row,
	.motion_row {
		display: grid;
		grid-template-columns: 9em minmax(0, 1fr) 6em minmax(0, 1.2fr);
		align-items: center;
		gap: var(--gap-xl);
	}
	.spec:not(:has(.value)) {
		grid-template-columns: 9em minmax(0, 1fr) minmax(0, 1.2fr);
	}
	.type_row {
		grid-template-columns: minmax(0, 1.6fr) 9em 5em minmax(0, 1fr);
	}
	.meter,
	.track {
		height: var(--bar);
		border-radius: var(--bar);
		background: var(--surface-2);
	}
	.meter > span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--mist);
	}
	.ruler {
		justify-self: start;
		height: 10px;
		max-width: 100%;
		border-radius: var(--bar);
		background: var(--accent);
	}
	.ruler.tall {
		border-radius: var(--r-sm);
		background: var(--tint);
	}
	.line {
		justify-self: start;
		width: 100%;
		background: var(--accent);
	}
	.stack {
		display: grid;
		gap: var(--gap-lg);
	}
	.h1_sample {
		font-size: var(--fs-display);
		font-weight: var(--fw-strong);
		letter-spacing: -0.025em;
		line-height: 1.05;
	}
	.fade_demo {
		max-width: 360px;
		font-size: var(--fs-lg);
		font-weight: var(--fw-name);
	}
	.sample {
		font-weight: var(--fw-name);
		line-height: 1.2;
	}

	.surfaces {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--gap-xl);
	}
	.surface {
		display: grid;
		place-items: center;
		height: 110px;
		border-radius: var(--r-lg);
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	.flat_card {
		background: var(--surface);
	}
	.floating {
		background: var(--surface);
		box-shadow: 0 18px 50px var(--shadow);
	}
	.glass {
		background: color-mix(in srgb, var(--surface) 92%, transparent);
		backdrop-filter: blur(24px);
		box-shadow: 0 18px 50px var(--shadow);
	}

	.motion_row .track {
		position: relative;
	}
	.dot {
		position: absolute;
		top: 50%;
		left: 0;
		width: 12px;
		height: 12px;
		margin-top: -6px;
		border-radius: var(--r-pill);
		background: var(--accent);
		transition: left var(--d) var(--e);
	}
	@media (hover: hover) {
		.motion_row:hover .dot {
			left: calc(100% - 12px);
		}
	}
	.demo_cascade {
		animation: cascade_in var(--t-move) var(--ease) infinite alternate;
	}
	.demo_swap {
		animation: swap_in var(--t-out) var(--ease) infinite alternate;
	}
	.demo_reveal {
		animation: reveal_in var(--t-reveal) var(--ease) infinite alternate;
	}
	@keyframes reveal_in {
		from {
			opacity: 0;
			translate: 0 24px;
		}
	}

	.states {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--gap-2xl) var(--gap-3xl);
		margin-bottom: var(--gap-2xl);
	}
	.state {
		display: grid;
		justify-items: start;
		gap: var(--gap-sm);
	}
	.wide_state {
		justify-items: stretch;
		width: 100%;
	}
	.is_hover {
		box-shadow: inset 0 0 0 999px var(--wash);
	}
	.is_focus {
		box-shadow: inset 0 0 0 999px var(--tint);
	}
	.is_press {
		scale: var(--press-scale, 0.9);
	}
	.pill.is_press {
		--press-scale: 0.94;
	}

	.icon {
		display: grid;
		place-items: center;
		width: var(--control-sm);
		height: var(--control-sm);
		border-radius: var(--r-pill);
		color: var(--text);
		--press-scale: 0.9;
	}
	.icon :global(svg) {
		width: var(--icon);
		height: var(--icon);
	}
	.solid {
		fill: currentColor;
		stroke: currentColor;
		stroke-width: var(--stroke);
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.stroke,
	.live_tip :global(svg) {
		fill: none;
		stroke: currentColor;
		stroke-width: var(--stroke);
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.wash {
		background: var(--wash);
	}
	.off {
		opacity: var(--tone-off);
	}
	.side {
		color: var(--muted);
	}
	.side.lit {
		color: var(--text);
	}
	.on {
		background: var(--accent);
		color: var(--accent-ink);
	}
	.main {
		width: var(--control-lg);
		height: var(--control-lg);
		background: var(--accent);
		color: var(--accent-ink);
	}
	.main.big {
		width: 64px;
		height: 64px;
	}
	.raised {
		background: var(--surface);
	}
	.arrow {
		width: var(--control-sm);
		height: var(--control-sm);
	}
	.back {
		width: var(--control-lg);
		height: var(--control-lg);
	}
	.wash_raised {
		box-shadow: inset 0 0 0 999px var(--wash);
	}
	.spin {
		width: 18px;
		height: 18px;
		border: var(--stroke) solid currentColor;
		border-right-color: transparent;
		border-radius: var(--r-pill);
		animation: spin 0.7s linear infinite;
	}
	@keyframes spin {
		to {
			rotate: 360deg;
		}
	}

	.way {
		color: var(--muted);
		font-weight: var(--fw-ui);
	}
	.way.hot,
	.title_link {
		color: var(--accent);
	}
	.title_link {
		font-size: var(--fs-lg);
		font-weight: var(--fw-name);
	}
	.way.copied {
		display: inline-grid;
	}
	.way.copied > * {
		grid-area: 1 / 1;
	}
	.gone {
		opacity: var(--tone-off);
		filter: blur(4px);
	}
	.done {
		justify-self: center;
		color: var(--accent);
	}

	.tips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 64px 180px;
		padding: 60px 0 60px 80px;
	}
	.anchor_dot {
		display: grid;
		place-items: center;
		width: var(--icon);
		height: var(--icon);
		border-radius: var(--r-pill);
		background: var(--surface-2);
	}
	.live_tip {
		width: var(--control-sm);
		height: var(--control-sm);
		background: none;
		color: var(--muted);
	}
	.live_tip :global(svg) {
		width: var(--icon);
		height: var(--icon);
	}

	.cover_box {
		display: block;
	}
	.cover_box :global(.art) {
		width: 100%;
	}
	.eq_box {
		display: grid;
		place-items: center;
		width: var(--control-sm);
		height: var(--control-sm);
	}

	.rows {
		display: grid;
		gap: var(--gap-2xl);
		margin: 0 calc(-1 * var(--inset));
	}
	.rows .note {
		padding-left: var(--inset);
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--gap-xl);
		height: 88px;
		padding: var(--gap-md) var(--inset);
		border-radius: var(--r-lg);
	}
	.row.hover {
		background: var(--wash);
	}
	.row.is_press_row {
		scale: 0.985;
	}
	.row.unplayable > * {
		opacity: var(--tone-off);
	}
	.rank {
		display: grid;
		place-items: center;
		flex: none;
		width: 1.4em;
		color: var(--muted);
		font-weight: var(--fw-strong);
		font-variant-numeric: tabular-nums;
	}
	.rank svg {
		width: 16px;
		height: 16px;
		fill: none;
		stroke: currentColor;
		stroke-width: var(--stroke);
		stroke-linejoin: round;
	}
	.row_art {
		height: 100%;
	}
	.row_art :global(.art) {
		height: 100%;
		width: auto;
	}
	.text {
		display: grid;
		flex: 1.4 1 0;
		gap: var(--gap-2xs);
		min-width: 0;
	}
	.name {
		font-size: var(--fs-lg);
		font-weight: var(--fw-name);
	}
	.active .name {
		color: var(--accent);
	}
	.artist,
	.album,
	.end {
		color: var(--muted);
		font-size: var(--fs-sm);
	}
	.album {
		flex: 1 1 0;
		min-width: 0;
	}
	.end {
		display: flex;
		justify-content: flex-end;
		flex: none;
		width: 5.2em;
		font-variant-numeric: tabular-nums;
	}
	@media (max-width: 720px) {
		.row {
			gap: var(--gap-md);
			height: 72px;
			padding: var(--gap-sm) var(--inset);
		}
		.album {
			display: none;
		}
		.name {
			font-size: var(--fs-md);
		}
	}

	.now {
		display: flex;
		align-items: center;
		gap: var(--gap-2xl);
	}
	.now_art {
		flex: none;
		width: 112px;
	}
	.now_art :global(.art) {
		width: 100%;
		--art-r: var(--r-md);
	}
	.now_text {
		flex: 1;
		display: grid;
		gap: var(--gap-xs);
		min-width: 0;
	}
	.now_label {
		display: inline-flex;
		align-items: center;
		gap: var(--gap-sm);
		margin-bottom: var(--gap-2xs);
		color: var(--accent);
		font-size: var(--fs-sm);
		font-weight: var(--fw-strong);
	}
	.now_title {
		font-size: var(--fs-xl);
		font-weight: var(--fw-name);
		letter-spacing: -0.02em;
		line-height: 1.3;
	}
	.seek {
		display: flex;
		align-items: center;
		gap: var(--gap-md);
		margin-top: var(--gap-md);
	}
	.time {
		min-width: 2.6em;
		color: var(--muted);
		font-size: var(--fs-xs);
		font-variant-numeric: tabular-nums;
	}
	.time:last-child {
		text-align: right;
	}
	.bar,
	.slider {
		position: relative;
		flex: 1;
		height: var(--bar);
		border-radius: var(--bar);
		background: var(--tint);
	}
	.slider {
		display: block;
		width: 100%;
		max-width: 480px;
	}
	.slider.short {
		width: 84px;
	}
	.bar .fill,
	.slider .fill {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--accent);
	}
	.knob {
		position: absolute;
		top: 50%;
		width: 12px;
		height: 12px;
		margin: -6px 0 0 -6px;
		border-radius: var(--r-pill);
		background: var(--accent);
		box-shadow: 0 2px 8px var(--shadow);
	}

	.menu_demo {
		display: grid;
		width: 300px;
		padding: var(--gap-sm);
		border-radius: var(--r-md);
		background: var(--surface);
		box-shadow: 0 18px 50px var(--shadow);
	}
	.menu_item {
		display: flex;
		align-items: center;
		height: var(--control-md);
		padding: 0 var(--inset);
		border-radius: var(--r-sm);
		font-size: var(--fs-sm);
		font-weight: var(--fw-ui);
	}
	.menu_item.armed {
		background: var(--wash);
	}
	.copied_item {
		color: var(--accent);
		background: var(--wash);
	}
	.menu_gap {
		height: var(--stroke);
		margin: var(--gap-sm) var(--gap-md);
		border-radius: var(--stroke);
		background: var(--wash);
	}

	.focus_demo {
		padding: var(--gap-sm) var(--gap-md);
		border-radius: var(--r-sm);
		box-shadow: inset 0 0 0 999px var(--tint);
	}
	.grain_demo,
	.fade_box {
		width: 200px;
		height: 110px;
		border-radius: var(--r-lg);
		background: var(--surface);
	}
	.grain_demo {
		background: url(/grain.png) repeat, var(--surface);
		background-blend-mode: soft-light;
	}
	.fade_box {
		background: var(--accent);
		mask-image: linear-gradient(to right, #0000, #000 30%, #000 70%, #0000);
	}
</style>
