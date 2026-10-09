// The map's sound: an ensemble of West African instruments playing together without
// stopping, synthesised in the browser (no audio files to fetch or license), and
// short cues for moments.
//
// It moves in 12/8, the long-short swing of West African drumming, and the talking
// drum leads. Around it:
//
//   bell        the iron bell's timeline, the pattern every player listens to
//   shekere     beads on a gourd, keeping the pulse
//   udu, drum   the clay pot drum's bloop and a big skin drum underneath
//   answer      a second, lower talking drum, holding a pattern for the lead to talk over
//   lead        the talking drum: phrases in the rise and fall of speech, rolls,
//               and a call at the end of every section that brings the next one in
//   flute       a wooden flute singing melodies over the drums, then resting
//   balafon     a quiet repeating figure on the wooden xylophone
//   gong        a big iron gong on the first beat of a section
//   kakaki      the long royal trumpets, now and then, from far off
//   voices      a few voices answering the drums, now and then
//   pad         a warm hum underneath, breathing slowly
//
// The music runs in sections of eight bars: the whole ensemble, the drum's solo,
// the flute's song, or a lighter passage. The players never stop; the sections only
// change who leads. Each instrument stands somewhere in a courtyard, left or right,
// near or far, in one reverberant space.
//
// Sound is on unless the visitor has turned it off. Browsers start audio only on a
// gesture, so it begins on the first tap, click or key, and the choice is remembered.
// Each start opens with a brief gust of wind; the first time, the talking drum calls
// alone for two bars and the ensemble comes in on the gong. Each view sets a scene,
// which brings instruments forward or back.

export type Scene = 'today' | 'then' | 'story' | 'film' | 'power';
export type Cue = 'open' | 'close' | 'chapter' | 'tap' | 'mode';

type Layer = 'pad' | 'bell' | 'shaker' | 'bass' | 'answer' | 'lead' | 'flute' | 'balafon' | 'gong' | 'kakaki' | 'voices';
type Layers = Record<Layer, number>;

/** How present each instrument is in each view: 0 is silent, 1 its full part. */
const SCENES: Record<Scene, Layers> = {
	// Peoples today: lighter, the flute and balafon to the fore.
	today: { pad: 0.8, bell: 0.35, shaker: 0.4, bass: 0.55, answer: 0.4, lead: 0.6, flute: 1, balafon: 0.8, gong: 0.5, kakaki: 0, voices: 0 },
	// Kingdoms: the court's music.
	then: { pad: 0.85, bell: 0.6, shaker: 0.65, bass: 0.8, answer: 0.7, lead: 0.9, flute: 0.85, balafon: 0.6, gong: 0.7, kakaki: 0.45, voices: 0.25 },
	// A story: the drums tell it.
	story: { pad: 1, bell: 0.65, shaker: 0.8, bass: 0.9, answer: 0.85, lead: 1, flute: 0.75, balafon: 0.5, gong: 0.8, kakaki: 0.5, voices: 0.4 },
	// The main timeline playing: the fullest the ensemble gets.
	film: { pad: 1, bell: 0.75, shaker: 0.9, bass: 1, answer: 0.9, lead: 1, flute: 0.85, balafon: 0.6, gong: 0.9, kakaki: 0.6, voices: 0.45 },
	// Politics: low and watchful, the drums to the fore.
	power: { pad: 0.9, bell: 0.45, shaker: 0.35, bass: 0.7, answer: 0.6, lead: 0.85, flute: 0.5, balafon: 0.3, gong: 0.8, kakaki: 0.5, voices: 0.15 },
};

type Section = 'full' | 'drum' | 'flute' | 'light';

/** What each kind of section asks: how likely the lead drum and the flute are to play each bar, how hard the bass and bell play, and how often the section comes. */
const SECTIONS: Record<Section, { lead: number; flute: number; bass: number; bell: number; weight: number }> = {
	full: { lead: 0.8, flute: 0.55, bass: 1, bell: 1, weight: 3 },
	drum: { lead: 1, flute: 0, bass: 1, bell: 1, weight: 2 },
	flute: { lead: 0.45, flute: 0.95, bass: 0.8, bell: 0.75, weight: 2 },
	light: { lead: 0.55, flute: 0.5, bass: 0.5, bell: 0.55, weight: 1.2 },
};

/** The mix, tunable here and nowhere else. */
const MIX = {
	level: 0.42,
	/** Fade in on the first start, and on later starts. */
	welcomeFade: 2,
	fade: 0.6,
	/** A courtyard: walls close by, then a dark tail. */
	hall: { seconds: 3.4, preDelay: 0.02, wet: 0.4 },
	/** The flute's and the gong's echo, in time with the music: three pulses each way, each repeat darker. */
	echo: { pulses: 3, feedback: 0.28, tone: 2200 },
	pad: { cutoff: 520, breathe: 200, level: 0.24 },
	/** The wind at each start: how loud, how long it holds (first start, later starts), and how long it takes to fall away. */
	air: { level: 0.05, hold: { first: 3, again: 1.5 }, fall: 2.5 },
	/** Each instrument's level against the others. */
	gain: { bell: 1, shaker: 7, bass: 0.8, answer: 0.6, lead: 1, flute: 0.46, balafon: 0.6, gong: 0.9, kakaki: 1, voices: 0.7 },
};

const KEY = 'niajmap.sound';
/** Dotted crotchets a minute: the beat a dancer steps to. */
const BPM = 92;
/** One pulse of the twelve in a bar. */
const PULSE = 60 / BPM / 3;
const BAR = 12;
const SECTION_BARS = 8;
const LOOKAHEAD = 0.15;

// A minor pentatonic on A: the balafon's and the flute's notes.
const ROOT = 220;
const PENTA = [0, 3, 5, 7, 10];
const note = (degree: number) => {
	const octave = Math.floor(degree / PENTA.length);
	const step = PENTA[((degree % PENTA.length) + PENTA.length) % PENTA.length];
	return ROOT * 2 ** octave * 2 ** (step / 12);
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
const cents = (ratio: number) => 1200 * Math.log2(ratio);
/** A player is never exactly on the grid. */
const human = (t: number) => t + rand(-0.006, 0.006);

// ---- The parts.

/** The bell's timeline: the standard West African pattern over twelve pulses. The first stroke is the low mouth. */
const BELL = [0, 2, 4, 5, 7, 9, 11];

/** The udu's part: [pulse, pitch, strength, how often it plays]. */
const UDU: [number, number, number, number][] = [
	[0, 66, 1, 1],
	[4, 92, 0.6, 0.7],
	[7, 78, 0.8, 1],
	[10, 66, 0.5, 0.5],
];

/** The answering drum's pattern, lower than the lead: [pulse, tone, glide]. */
const ANSWER: [number, Tone, number][] = [
	[3, 'M', 1],
	[5, 'L', 1.2],
	[9, 'M', 1],
	[11, 'L', 0.9],
];

/** The balafon's two figures, as scale degrees on each pulse. They swap every four bars. */
const FIGURES: Record<number, number>[] = [
	{ 0: 0, 2: 2, 3: 3, 5: 2, 6: 1, 8: 3, 9: 4, 11: 3 },
	{ 0: 3, 1: 2, 3: 0, 5: 1, 6: 2, 8: 0, 9: 1, 11: 2 },
];

/** The talking drum's three tones, as Yoruba and other tonal languages have them: low, mid, high. */
type Tone = 'L' | 'M' | 'H';
const TONES: Record<Tone, number> = { L: 118, M: 150, H: 192 };

/** One stroke: [pulse (halves are rolls), tone, glide after the strike (1 is level), strength]. */
type Stroke = [number, Tone, number, number];

/** The lead's phrases, in the rhythm and rise and fall of speech. A phrase longer than twelve pulses runs over two bars. */
const PHRASES: Stroke[][] = [
	[[0, 'M', 1, 1], [2, 'H', 1, 0.8], [3, 'M', 0.85, 0.9], [6, 'L', 1.2, 1], [8, 'M', 1, 0.7], [9, 'H', 0.8, 0.9]],
	[[0, 'H', 1.15, 1], [1.5, 'H', 1, 0.6], [3, 'M', 1, 0.8], [4, 'M', 1, 0.6], [6, 'L', 0.9, 1], [9, 'M', 1.25, 0.9], [10.5, 'H', 0.85, 0.8]],
	[
		[0, 'L', 1.3, 1], [2, 'M', 1, 0.7], [3, 'H', 1, 0.9], [5, 'M', 0.85, 0.8], [6, 'M', 1, 0.8], [7, 'H', 1, 0.7], [9, 'L', 1.35, 1],
		[12, 'H', 0.75, 1], [14, 'M', 1, 0.7], [15, 'M', 1, 0.7], [18, 'L', 1.2, 0.9], [21, 'M', 1, 0.7], [22, 'H', 0.8, 0.9],
	],
	[[0, 'M', 1, 0.9], [0.5, 'M', 1, 0.5], [1, 'M', 1, 0.55], [1.5, 'M', 1.1, 0.6], [2, 'H', 1, 0.9], [3, 'H', 0.7, 1], [6, 'L', 1.4, 1], [9, 'M', 1, 0.8], [10, 'H', 1, 0.8], [11, 'H', 0.85, 0.9]],
	[[0, 'L', 1.45, 1], [4, 'H', 0.7, 0.9], [6, 'M', 1, 0.7], [7, 'M', 1.25, 0.8], [9, 'L', 1, 1]],
	[
		[0, 'H', 1, 0.9], [1, 'H', 1, 0.6], [2, 'M', 1, 0.8], [3, 'H', 1.2, 1], [6, 'M', 1, 0.7], [8, 'M', 0.8, 0.8], [9, 'L', 1, 0.9],
		[12, 'L', 1, 0.9], [13, 'L', 1, 0.6], [14, 'M', 1, 0.8], [15, 'L', 1.3, 1], [18, 'M', 1, 0.7], [20, 'H', 0.85, 0.8], [21, 'L', 0.8, 1],
	],
	[[0, 'M', 1, 1], [1, 'L', 1, 0.7], [3, 'M', 1.2, 0.9], [4.5, 'H', 1, 0.6], [5, 'H', 1, 0.7], [6, 'H', 0.75, 1], [9, 'L', 1.3, 0.9], [11, 'M', 1, 0.6]],
];

/** The call at the end of a section: a roll that climbs and brings the next section in. */
const CALL: Stroke[] = [
	[0, 'M', 1, 0.8], [3, 'H', 1, 0.8],
	[6, 'M', 1, 0.5], [6.5, 'M', 1, 0.55], [7, 'M', 1, 0.6], [7.5, 'M', 1.05, 0.65],
	[8, 'H', 1, 0.7], [8.5, 'H', 1, 0.75], [9, 'H', 1, 0.8], [9.5, 'H', 1.05, 0.85],
	[10, 'H', 1, 0.9], [10.5, 'H', 1.1, 0.95], [11, 'H', 1.3, 1],
];

/** The lead's opening announcement, two bars alone before the ensemble comes in. */
const ANNOUNCE: Stroke[] = [[0, 'L', 1.45, 1], [3, 'H', 0.7, 0.9], [6, 'M', 1, 0.7], [7, 'M', 1.25, 0.8], [9, 'L', 1, 1], ...CALL.map(([p, tone, glide, v]): Stroke => [p + 12, tone, glide, v])];

/** One flute note: [pulse, scale degree, length in pulses]. */
type FluteNote = [number, number, number];

/** The flute's melodies, two bars each. The last ones settle home and often answer the others. */
const MELODIES: FluteNote[][] = [
	[[0, 9, 5], [6, 8, 2], [9, 7, 3], [12, 6, 6], [18, 5, 6]],
	[[0, 5, 3], [3, 6, 3], [6, 8, 6], [12, 7, 3], [15, 6, 3], [18, 5, 6]],
	[[0, 8, 9], [9, 9, 3], [12, 10, 6], [18, 8, 6]],
	[[0, 7, 2], [2, 8, 1], [3, 9, 9], [12, 8, 3], [15, 7, 3], [18, 6, 6]],
	[[0, 10, 6], [6, 9, 3], [9, 8, 3], [12, 7, 3], [15, 8, 3], [18, 5, 6]],
	[[0, 6, 3], [3, 5, 3], [6, 4, 6], [12, 5, 12]],
	[[0, 8, 3], [3, 7, 3], [6, 6, 3], [9, 7, 3], [12, 5, 12]],
];
const ANSWERS = [5, 6];

// ---- State.

/** The context in the speakers, once built. */
let live: AudioContext | null = null;
/** The context instruments play into: the live one, or an offline one while rendering. */
let ac: BaseAudioContext;
let master: GainNode;
let hall: GainNode;
let echo: GainNode;
let noise: AudioBuffer;
let padGain: GainNode;
let airGain: GainNode;
let places: Record<'lead' | 'answer' | 'bass' | 'shaker' | 'bell' | 'balafon' | 'flute' | 'gong' | 'kakaki' | 'voices' | 'near', AudioNode>;
let enabled = readPref();
let welcomed = false;
let scene: Scene = 'today';
let layers: Layers = { ...SCENES.today };
let timer = 0;
let nextTime = 0;
let pulse = 0;
let section: Section = 'full';
let leadUntil = 0;
let fluteUntil = 0;
let lastPhrase = -1;
let lastMelody = -1;
let lastKakaki = -99;
let figure = 0;
/** The lead drum's pitch drifts a little from section to section, as the player tightens the cords. */
let voice = 1;
const listeners = new Set<() => void>();

function readPref(): boolean {
	try {
		return localStorage.getItem(KEY) !== 'off';
	} catch {
		return true;
	}
}

function writePref(on: boolean): void {
	try {
		localStorage.setItem(KEY, on ? 'on' : 'off');
	} catch {}
}

// ---- The room.

/** A courtyard made of noise: a few early returns off the walls, then a tail that darkens as it dies. */
function courtyard(c: BaseAudioContext): AudioBuffer {
	const { seconds, preDelay } = MIX.hall;
	const rate = c.sampleRate;
	const len = Math.round(rate * seconds);
	const gap = Math.round(rate * preDelay);
	const ir = c.createBuffer(2, len, rate);
	for (let ch = 0; ch < 2; ch++) {
		const d = ir.getChannelData(ch);
		let low = 0;
		for (let i = gap; i < len; i++) {
			const t = (i - gap) / (len - gap);
			// The filter closes as the tail goes on: bright at first, then warm.
			low += (0.55 - 0.5 * Math.sqrt(t)) * (Math.random() * 2 - 1 - low);
			const swell = Math.min(1, (i - gap) / (rate * 0.04));
			d[i] = low * swell * (1 - t) ** 2.6;
		}
		for (const [ms, g] of [
			[23, 0.45],
			[47, 0.32],
			[71, 0.22],
		] as const) {
			const at = Math.round((rate * (ms + ch * 7)) / 1000);
			let tap = 0;
			for (let j = 0; j < 180; j++) {
				tap += 0.35 * (Math.random() * 2 - 1 - tap);
				d[at + j] += g * tap * (1 - j / 180);
			}
		}
	}
	return ir;
}

/** Where a sound stands: `pan` from -1 (left) to 1 (right), `far` from 0 (beside you) to 1 (across the land). */
type Place = { pan: number; far: number };

/**
 * A place in the courtyard for an instrument to stand. Far away is quieter and
 * darker, and heard more as reverberation; `echoSend` sends it to the echo too.
 * Returns the place's input.
 */
function spot({ pan, far }: Place, echoSend = 0): AudioNode {
	const c = ac;
	const input = c.createGain();
	const air = c.createBiquadFilter();
	air.type = 'lowpass';
	air.frequency.value = 900 * 2 ** (4 * (1 - far));
	air.Q.value = 0;
	const p = c.createStereoPanner();
	p.pan.value = pan;
	const level = 1 / (1 + 2.5 * far);
	const dry = c.createGain();
	dry.gain.value = level * (1 - 0.85 * far);
	const wet = c.createGain();
	wet.gain.value = level * (0.15 + 0.55 * far);
	input.connect(air).connect(p);
	p.connect(dry).connect(master);
	p.connect(wet).connect(hall);
	if (echoSend) {
		const e = c.createGain();
		e.gain.value = level * echoSend;
		p.connect(e).connect(echo);
	}
	return input;
}

/** Builds the graph into a context: instruments → their places → courtyard and echo → tone → glue → limiter → speakers, with the pad and the wind. */
function graph(c: BaseAudioContext): void {
	ac = c;

	// The output: a little warmth low, a little air taken off the top, gentle glue, then a safety limit.
	const warm = c.createBiquadFilter();
	warm.type = 'lowshelf';
	warm.frequency.value = 200;
	warm.gain.value = 2;
	const soft = c.createBiquadFilter();
	soft.type = 'highshelf';
	soft.frequency.value = 7000;
	soft.gain.value = -3;
	const glue = c.createDynamicsCompressor();
	glue.threshold.value = -22;
	glue.knee.value = 18;
	glue.ratio.value = 2.5;
	glue.attack.value = 0.02;
	glue.release.value = 0.3;
	const limit = c.createDynamicsCompressor();
	limit.threshold.value = -3;
	limit.knee.value = 0;
	limit.ratio.value = 20;
	limit.attack.value = 0.002;
	limit.release.value = 0.1;
	master = c.createGain();
	master.gain.value = 0;
	master.connect(warm).connect(soft).connect(glue).connect(limit).connect(c.destination);

	const room = c.createConvolver();
	room.buffer = courtyard(c);
	hall = c.createGain();
	hall.gain.value = MIX.hall.wet;
	hall.connect(room).connect(master);

	// The echo: two taps crossing left and right in time with the music, each repeat a little darker.
	echo = c.createGain();
	const left = c.createDelay(2);
	const right = c.createDelay(2);
	left.delayTime.value = PULSE * MIX.echo.pulses;
	right.delayTime.value = PULSE * MIX.echo.pulses;
	const tone = c.createBiquadFilter();
	tone.type = 'lowpass';
	tone.frequency.value = MIX.echo.tone;
	const fb = c.createGain();
	fb.gain.value = MIX.echo.feedback;
	const merge = c.createChannelMerger(2);
	echo.connect(tone).connect(left);
	left.connect(right);
	right.connect(fb).connect(left);
	left.connect(merge, 0, 0);
	right.connect(merge, 0, 1);
	const returns = c.createGain();
	returns.gain.value = 0.5;
	merge.connect(returns);
	returns.connect(master);
	returns.connect(hall);

	noise = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
	const n = noise.getChannelData(0);
	for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;

	// Where everyone stands: the lead drum in front, the flute to its left, the rest around them.
	places = {
		lead: spot({ pan: -0.12, far: 0.12 }),
		answer: spot({ pan: 0.42, far: 0.3 }),
		bass: spot({ pan: 0.05, far: 0.2 }),
		shaker: spot({ pan: 0.35, far: 0.25 }),
		bell: spot({ pan: -0.38, far: 0.3 }),
		balafon: spot({ pan: 0.25, far: 0.3 }, 0.1),
		flute: spot({ pan: -0.32, far: 0.25 }, 0.2),
		gong: spot({ pan: 0.15, far: 0.5 }, 0.25),
		kakaki: spot({ pan: -0.5, far: 0.85 }, 0.3),
		voices: spot({ pan: 0.55, far: 0.6 }, 0.15),
		near: spot({ pan: 0, far: 0.05 }),
	};

	// The pad: A and E in three octaves, soft triangles and sines a few cents apart, so they shimmer,
	// under a filter that breathes.
	padGain = c.createGain();
	padGain.gain.value = 0;
	const padTone = c.createBiquadFilter();
	padTone.type = 'lowpass';
	padTone.frequency.value = MIX.pad.cutoff;
	padTone.Q.value = 0.5;
	const breathe = c.createOscillator();
	const breatheDepth = c.createGain();
	breathe.frequency.value = 0.06;
	breatheDepth.gain.value = MIX.pad.breathe;
	breathe.connect(breatheDepth).connect(padTone.frequency);
	breathe.start();
	const spread = c.createChannelMerger(2);
	for (const [f, detune, type, gain, ch] of [
		[55, -6, 'triangle', 0.05, 0],
		[55, 6, 'triangle', 0.05, 1],
		[82.41, -3, 'sine', 0.04, 0],
		[110, 4, 'triangle', 0.03, 1],
		[164.81, -5, 'sine', 0.018, 0],
		[220, 7, 'sine', 0.012, 1],
	] as const) {
		const o = c.createOscillator();
		o.type = type;
		o.frequency.value = f;
		o.detune.value = detune;
		const g = c.createGain();
		g.gain.value = gain;
		o.connect(g).connect(spread, 0, ch);
		o.start();
	}
	spread.connect(padTone).connect(padGain);
	padGain.connect(master);
	padGain.connect(hall);

	// The wind: two bands of noise, one each side, each gusting through grass and trees. It blows only as the
	// sound starts; see gust().
	airGain = c.createGain();
	airGain.gain.value = 0;
	for (const [centre, rate, pan, offset] of [
		[650, 0.37, -0.6, 0],
		[1300, 0.53, 0.6, 2.1],
	] as const) {
		const src = c.createBufferSource();
		src.buffer = noise;
		src.loop = true;
		const band = c.createBiquadFilter();
		band.type = 'bandpass';
		band.frequency.value = centre;
		band.Q.value = 0.5;
		const sweep = c.createOscillator();
		const sweepDepth = c.createGain();
		sweep.frequency.value = rate;
		sweepDepth.gain.value = centre * 0.5;
		sweep.connect(sweepDepth).connect(band.frequency);
		const p = c.createStereoPanner();
		p.pan.value = pan;
		src.connect(band).connect(p).connect(airGain);
		src.start(0, offset);
		sweep.start();
	}
	airGain.connect(master);
	airGain.connect(hall);
}

/** Builds the live context on first use. */
function build(): AudioContext | null {
	if (live) return live;
	const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!AC) return null;
	live = new AC();
	graph(live);
	document.addEventListener('visibilitychange', () => {
		if (!live) return;
		if (document.hidden) void live.suspend();
		else if (enabled) void live.resume();
	});
	return live;
}

// ---- Instruments. Each plays one note at `t` into `out`, a place in the courtyard.

/** A gain that opens at `t`, peaks after `attack` and dies away over `decay`. */
function env(out: AudioNode, t: number, peak: number, attack: number, decay: number): GainNode {
	const g = ac.createGain();
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
	g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
	g.connect(out);
	return g;
}

function osc(type: OscillatorType, freq: number, t: number, stop: number): OscillatorNode {
	const o = ac.createOscillator();
	o.type = type;
	o.frequency.setValueAtTime(freq, t);
	o.start(t);
	o.stop(stop);
	return o;
}

/** Noise from `t` for `dur` seconds, starting somewhere different each time. */
function hiss(t: number, dur: number): AudioBufferSourceNode {
	const s = ac.createBufferSource();
	s.buffer = noise;
	s.loop = true;
	s.start(t, Math.random() * noise.duration);
	s.stop(t + dur);
	return s;
}

function filter(type: BiquadFilterType, freq: number, q = 1): BiquadFilterNode {
	const f = ac.createBiquadFilter();
	f.type = type;
	f.frequency.value = freq;
	f.Q.value = q;
	return f;
}

/** A big skin drum struck once: a deep note that sags as it dies, the skin's higher rings, and the palm's thud. */
function skinDrum(t: number, out: AudioNode, pitch: number, vel: number): void {
	const o = osc('sine', pitch * 1.5, t, t + 1.6);
	o.frequency.exponentialRampToValueAtTime(pitch, t + 0.06);
	o.frequency.exponentialRampToValueAtTime(pitch * 0.94, t + 1.2);
	o.connect(env(out, t, 0.6 * vel, 0.006, 1.3));
	for (const [mult, gain, decay] of [
		[1.59, 0.2, 0.45],
		[2.14, 0.08, 0.25],
	] as const) {
		osc('sine', pitch * mult, t, t + decay + 0.1).connect(env(out, t, gain * vel, 0.004, decay));
	}
	hiss(t, 0.1).connect(filter('lowpass', 700)).connect(env(out, t, 0.35 * vel, 0.002, 0.07));
}

/** The udu, the clay pot drum: air pushed through its side hole, a falling bloop with a hollow breath. */
function udu(t: number, out: AudioNode, pitch: number, vel: number): void {
	const o = osc('sine', pitch * 1.7, t, t + 0.8);
	o.frequency.exponentialRampToValueAtTime(pitch, t + 0.09);
	o.frequency.exponentialRampToValueAtTime(pitch * 0.96, t + 0.7);
	o.connect(filter('lowpass', 520, 0)).connect(env(out, t, 0.75 * vel, 0.012, 0.65));
	hiss(t, 0.12).connect(filter('bandpass', pitch * 3, 4)).connect(env(out, t, 0.4 * vel, 0.01, 0.08));
}

/** Iron struck once: the partials, inharmonic, each a pair a fraction apart so the metal beats as it rings. `ring` shortens it from a gong's to a bell's. */
function iron(t: number, out: AudioNode, freq: number, vel: number, ring = 1): void {
	for (const [mult, gain, decay] of [
		[1, 0.3, 3.6],
		[2.32, 0.13, 2.2],
		[4.25, 0.06, 1.1],
		[6.63, 0.03, 0.5],
	] as const) {
		// A short-ringing bell has no time to beat, so it needs only one tone per partial.
		const beats = ring < 0.5 ? [0] : [-0.35, 0.35];
		for (const beat of beats) {
			const o = osc('sine', freq * mult + beat * mult, t, t + decay * ring + 0.1);
			o.connect(env(out, t, (gain * vel * 1.3) / beats.length, 0.002, decay * ring));
		}
	}
	hiss(t, 0.03).connect(filter('bandpass', freq * 5, 1.5)).connect(env(out, t, 0.2 * vel, 0.001, 0.025));
}

/**
 * The talking drum: the curved stick's slap, then the membrane, whose pitch the
 * player's arm squeezes up or lets fall as it rings (`glide` is where it ends up).
 * With `jingle`, the little bells strung round the head shiver too.
 */
function talkingDrum(t: number, out: AudioNode, pitch: number, glide: number, vel: number, jingle = false): void {
	for (const [mult, gain, decay] of [
		[1, 0.8, 0.38],
		[1.5, 0.18, 0.18],
		[2.02, 0.06, 0.09],
	] as const) {
		const o = osc('sine', pitch * mult, t, t + decay + 0.1);
		if (glide !== 1) {
			o.frequency.setValueAtTime(pitch * mult, t + 0.02);
			o.frequency.exponentialRampToValueAtTime(pitch * mult * glide, t + 0.17);
		}
		o.connect(env(out, t, gain * vel, 0.003, decay));
	}
	hiss(t, 0.05).connect(filter('bandpass', 1700, 1.2)).connect(env(out, t, 0.3 * vel, 0.001, 0.03));
	if (jingle) {
		for (let i = 0; i < 3; i++) {
			const at = t + rand(0, 0.02);
			osc('sine', rand(4200, 6200), at, at + 0.15).connect(env(out, at, 0.012 * vel, 0.001, 0.12));
		}
	}
}

/** The balafon: a struck wooden bar with its mallet's knock, the tuned overtone fading fastest. */
function balafon(t: number, out: AudioNode, freq: number, vel: number): void {
	for (const [mult, gain, decay] of [
		[1, 0.42, 0.8],
		[4, 0.1, 0.18],
		[9.2, 0.02, 0.05],
	] as const) {
		osc('sine', freq * mult, t, t + decay + 0.05).connect(env(out, t, gain * vel, 0.003, decay));
	}
	hiss(t, 0.03).connect(filter('bandpass', freq * 6, 2)).connect(env(out, t, 0.12 * vel, 0.001, 0.02));
}

/**
 * A wooden flute: a soft, nearly pure note that scoops up to pitch, wavers once it
 * settles, perhaps falls away at the end (`fall` is the ratio it falls to), and
 * carries the player's breath, loudest as the note speaks.
 */
function flute(t: number, out: AudioNode, freq: number, dur: number, vel: number, fall = 1): void {
	const c = ac;
	const end = t + dur;
	const attack = Math.min(0.12, dur * 0.3);
	const release = Math.min(0.25, dur * 0.35);
	const f = freq * 2 ** (rand(-8, 8) / 1200);
	const body = c.createGain();
	body.gain.setValueAtTime(0, t);
	body.gain.linearRampToValueAtTime(vel, t + attack);
	body.gain.linearRampToValueAtTime(vel * 0.82, end - release);
	body.gain.linearRampToValueAtTime(0, end);
	body.connect(out);
	const vib = osc('sine', rand(4.6, 5.6), t, end + 0.05);
	const depth = c.createGain();
	depth.gain.setValueAtTime(0, t + Math.min(0.35, dur * 0.4));
	depth.gain.linearRampToValueAtTime(14, t + Math.min(0.8, dur * 0.7));
	vib.connect(depth);
	for (const [mult, gain] of [
		[1, 0.5],
		[2, 0.07],
		[3, 0.04],
	] as const) {
		const o = osc('sine', f * mult, t, end + 0.05);
		o.detune.setValueAtTime(-60, t);
		o.detune.linearRampToValueAtTime(0, t + Math.min(0.12, dur * 0.3));
		if (fall !== 1) {
			o.detune.setValueAtTime(0, end - release);
			o.detune.linearRampToValueAtTime(cents(fall), end);
		}
		depth.connect(o.detune);
		const g = c.createGain();
		g.gain.value = gain;
		o.connect(g).connect(body);
	}
	const tuned = c.createGain();
	tuned.gain.value = 3;
	hiss(t, dur).connect(filter('bandpass', f, 12)).connect(tuned).connect(body);
	const breath = c.createGain();
	breath.gain.setValueAtTime(0, t);
	breath.gain.linearRampToValueAtTime(0.28, t + Math.min(0.05, attack));
	breath.gain.linearRampToValueAtTime(0.06, t + Math.min(0.3, dur));
	hiss(t, dur).connect(filter('bandpass', 2200, 0.8)).connect(breath).connect(body);
}

/** The mouth's resonances for each vowel, in Hz: an open "a", "o", "u", and "e". */
const VOWELS = {
	a: [730, 1090, 2440],
	o: [570, 840, 2410],
	u: [300, 870, 2240],
	e: [530, 1840, 2480],
} as const;
type Vowel = keyof typeof VOWELS;

/**
 * Voices on one wordless syllable: each a buzzing throat shaped by the mouth's
 * resonances, gliding from one vowel to the next, and falling in pitch at the end
 * (`fall` is the ratio it falls to). A group never quite agrees on time or pitch.
 */
function voices(t: number, out: AudioNode, freq: number, dur: number, from: Vowel, to: Vowel, n: number, vel: number, female = false, fall = 0.94): void {
	const c = ac;
	const end = t + dur;
	const throat = c.createGain();
	throat.gain.value = 1 / Math.sqrt(n);
	for (let i = 0; i < n; i++) {
		const s = t + (n > 1 ? rand(0, 0.06) : 0);
		const o = osc('sawtooth', freq * 2 ** (rand(-12, 12) / 1200), s, end + 0.15);
		o.detune.setValueAtTime(-40, s);
		o.detune.linearRampToValueAtTime(0, s + 0.1);
		o.detune.setValueAtTime(0, end - 0.2);
		o.detune.linearRampToValueAtTime(cents(fall), end);
		const vib = osc('sine', rand(4.5, 5.8), s, end + 0.15);
		const depth = c.createGain();
		depth.gain.value = rand(8, 14);
		vib.connect(depth).connect(o.detune);
		o.connect(throat);
	}
	const aspirate = c.createGain();
	aspirate.gain.value = 0.06;
	hiss(t, dur + 0.15).connect(filter('highpass', 1500)).connect(aspirate).connect(throat);
	const soft = filter('lowpass', 2600, 0);
	throat.connect(soft);
	const mouth = c.createGain();
	mouth.gain.setValueAtTime(0, t);
	mouth.gain.linearRampToValueAtTime(1.4 * vel, t + 0.12);
	mouth.gain.linearRampToValueAtTime(1.2 * vel, end - 0.2);
	mouth.gain.linearRampToValueAtTime(0, end + 0.1);
	mouth.connect(out);
	const scale = female ? 1.17 : 1;
	VOWELS[from].forEach((hz, k) => {
		const f = filter('bandpass', hz * scale, [9, 11, 14][k]);
		f.frequency.setValueAtTime(hz * scale, t);
		f.frequency.linearRampToValueAtTime(VOWELS[to][k] * scale, t + dur * 0.6);
		const g = c.createGain();
		g.gain.value = [1, 0.45, 0.2][k];
		soft.connect(f).connect(g).connect(mouth);
	});
}

/**
 * The kakaki: long metal trumpets, played in pairs. The note is lipped up to
 * pitch, brightens as the players push, rasps, and drops away at the end (`drop`
 * is the ratio it drops to).
 */
function kakaki(t: number, out: AudioNode, freq: number, dur: number, vel: number, drop = 0.94): void {
	const c = ac;
	const end = t + dur;
	const bell = filter('lowpass', freq * 1.5, 2);
	bell.frequency.setValueAtTime(freq * 1.5, t);
	bell.frequency.exponentialRampToValueAtTime(freq * 9, t + Math.min(0.6, dur * 0.4));
	bell.frequency.setValueAtTime(freq * 9, end - 0.3);
	bell.frequency.exponentialRampToValueAtTime(freq * 2, end + 0.1);
	const amp = c.createGain();
	amp.gain.setValueAtTime(0.0001, t);
	amp.gain.exponentialRampToValueAtTime(0.7 * vel, t + 0.25);
	amp.gain.linearRampToValueAtTime(0.6 * vel, end - 0.3);
	amp.gain.exponentialRampToValueAtTime(0.0001, end + 0.15);
	const rasp = c.createGain();
	rasp.gain.value = 1;
	const raspLfo = osc('sine', rand(24, 31), t, end + 0.2);
	const raspDepth = c.createGain();
	raspDepth.gain.value = 0.15;
	raspLfo.connect(raspDepth).connect(rasp.gain);
	for (const detune of [-7, 6]) {
		const o = osc('sawtooth', freq, t, end + 0.2);
		o.detune.setValueAtTime(detune - 180, t);
		o.detune.linearRampToValueAtTime(detune, t + 0.22);
		o.detune.setValueAtTime(detune, end - 0.3);
		o.detune.linearRampToValueAtTime(detune + cents(drop), end + 0.1);
		const g = c.createGain();
		g.gain.value = 0.5;
		o.connect(g).connect(bell);
	}
	bell.connect(rasp).connect(amp).connect(out);
}

/** The shekere: beads on a gourd, a brush of high noise. */
function shekere(t: number, out: AudioNode, vel: number, long = false): void {
	const shape = filter('peaking', 7500);
	shape.gain.value = 3;
	hiss(t, 0.2)
		.connect(filter('highpass', 4800))
		.connect(shape)
		.connect(env(out, t, 0.09 * vel, long ? 0.035 : 0.005, long ? 0.14 : 0.05));
}

// ---- Playing. A phrase or a melody is scheduled whole when it starts, so its timing is exact.

function playStrokes(t: number, strokes: Stroke[], vel: number): void {
	for (const [at, tone, glide, v] of strokes) {
		// A soft stroke is sometimes left out, so no phrase is ever played quite the same.
		if (v < 0.8 && Math.random() < 0.08) continue;
		talkingDrum(human(t + at * PULSE), places.lead, TONES[tone] * voice, glide, vel * v * rand(0.9, 1.05), true);
	}
}

function playMelody(t: number, melody: FluteNote[], vel: number): void {
	const shift = pick([0, 0, 0, 0, 1, -1]);
	melody.forEach(([at, degree, len], i) => {
		const d = Math.max(3, Math.min(11, degree + shift));
		const start = human(t + at * PULSE);
		const dur = len * PULSE - 0.03;
		const final = i === melody.length - 1;
		// A grace note from above on some long notes.
		if (len >= 3 && i > 0 && Math.random() < 0.25) flute(start - 0.07, places.flute, note(d + 1), 0.1, vel * 0.7);
		flute(start, places.flute, note(d), dur, vel * rand(0.9, 1), final && len >= 6 ? 2 ** (-1.5 / 12) : 1);
	});
}

function chooseSection(): Section {
	const options = (Object.keys(SECTIONS) as Section[]).filter((s) => s !== section);
	let r = Math.random() * options.reduce((sum, s) => sum + SECTIONS[s].weight, 0);
	for (const s of options) {
		r -= SECTIONS[s].weight;
		if (r <= 0) return s;
	}
	return 'full';
}

/** The start of a bar: sections change, the gong or the kakaki marks them, and the lead and the flute decide what to play. */
function onBar(t: number, bar: number): void {
	const l = layers;
	const g = MIX.gain;
	const sb = bar % SECTION_BARS;
	if (sb === 0) {
		if (bar > 0) section = chooseSection();
		voice = rand(0.95, 1.06);
		if (l.kakaki > 0.01 && bar - lastKakaki >= 16 && Math.random() < l.kakaki * 0.4) {
			lastKakaki = bar;
			const v = l.kakaki * g.kakaki;
			kakaki(t, places.kakaki, 220, 8 * PULSE, v);
			kakaki(t + 9 * PULSE, places.kakaki, 220, 2 * PULSE, v * 0.9);
			kakaki(t + 12 * PULSE, places.kakaki, 164.81, 10 * PULSE, v, 0.8);
		} else if (l.gong > 0.01 && Math.random() < 0.4 + l.gong * 0.5) {
			iron(human(t), places.gong, pick([110, 123.5]), l.gong * g.gong);
		}
		if (l.voices > 0.01 && Math.random() < l.voices * 0.35) {
			// A few voices answer the drums, on the beats, men and women an octave apart.
			const v = l.voices * g.voices;
			for (const [p, f, len, from, to] of [
				[6, 110, 2.6, 'e', 'a'],
				[9, 98, 2.6, 'a', 'o'],
				[12, 110, 5.6, 'a', 'o'],
			] as const) {
				voices(t + p * PULSE, places.voices, f, len * PULSE, from, to, 4, v);
				voices(t + p * PULSE, places.voices, f * 2, len * PULSE, from, to, 3, v * 0.5, true);
			}
		}
	}
	if (bar % 4 === 0) figure = (figure + 1) % FIGURES.length;

	// The lead: a call at the end of every section, and between, phrases with a bar's breath now and then.
	if (l.lead > 0.01) {
		const vel = l.lead * g.lead;
		if (sb === SECTION_BARS - 1 && section !== 'light') {
			playStrokes(t, CALL, vel);
			leadUntil = bar + 1;
		} else if (bar >= leadUntil) {
			if (Math.random() < SECTIONS[section].lead) {
				const fits = PHRASES.map((_, i) => i).filter((i) => i !== lastPhrase && sb + Math.ceil(PHRASES[i][PHRASES[i].length - 1][0] / BAR + 0.01) < SECTION_BARS);
				const i = pick(fits.length ? fits : [0]);
				lastPhrase = i;
				const strokes = PHRASES[i];
				playStrokes(t, strokes, vel);
				leadUntil = bar + (strokes[strokes.length - 1][0] >= BAR ? 2 : 1);
			} else leadUntil = bar + 1;
		}
	}

	// The flute: a melody of two bars, often answered by one that settles home, then a rest.
	if (l.flute > 0.01 && bar >= fluteUntil && sb % 2 === 0) {
		if (Math.random() < SECTIONS[section].flute) {
			const vel = l.flute * g.flute;
			const options = MELODIES.map((_, i) => i).filter((i) => i !== lastMelody && !ANSWERS.includes(i));
			const i = pick(options);
			lastMelody = i;
			playMelody(t, MELODIES[i], vel);
			let bars = 2;
			if (Math.random() < 0.55) {
				playMelody(t + 2 * BAR * PULSE, MELODIES[pick(ANSWERS)], vel);
				bars = 4;
			}
			fluteUntil = bar + bars + pick([0, 2, 2, 4]);
		} else fluteUntil = bar + 2;
	}
}

/** One pulse of the twelve: the bell, the shekere, the bass, the answering drum and the balafon keep the music going. */
function playPulse(t: number, i: number): void {
	const l = layers;
	const g = MIX.gain;
	const s = SECTIONS[section];
	const p = i % BAR;
	const bar = Math.floor(i / BAR);
	if (p === 0) onBar(t, bar);
	if (l.bell > 0.01 && BELL.includes(p)) iron(human(t), places.bell, p === 0 ? 440 : 659, l.bell * g.bell * s.bell * (p === 0 ? 0.9 : 0.6) * rand(0.85, 1), 0.12);
	if (l.shaker > 0.01) shekere(human(t), places.shaker, l.shaker * g.shaker * (p % 3 === 0 ? 1 : 0.5) * rand(0.8, 1.1), p === 2 || p === 8);
	if (l.bass > 0.01) {
		for (const [at, pitch, v, often] of UDU) if (at === p && Math.random() < often) udu(human(t), places.bass, pitch, l.bass * g.bass * s.bass * v);
		if (p === 0 && bar % 4 === 0) skinDrum(t, places.bass, 52, l.bass * g.bass * s.bass * 0.5);
	}
	if (l.answer > 0.01) {
		for (const [at, tone, glide] of ANSWER) if (at === p) talkingDrum(human(t), places.answer, TONES[tone] * 0.75, glide, l.answer * g.answer * rand(0.8, 1));
	}
	if (l.balafon > 0.01) {
		const degree = FIGURES[figure][p];
		if (degree !== undefined) balafon(human(t), places.balafon, note(degree), l.balafon * g.balafon * rand(0.75, 1));
		// Now and then a note the figure doesn't have, an octave up.
		else if (Math.random() < 0.06) balafon(human(t), places.balafon, note(pick([5, 6, 7])), l.balafon * g.balafon * 0.6);
	}
}

/** Plays every pulse that falls before `until`. */
function advance(until: number): void {
	while (nextTime < until) {
		playPulse(nextTime, pulse);
		nextTime += PULSE;
		pulse++;
	}
}

function tick(): void {
	if (live) advance(live.currentTime + LOOKAHEAD);
}

/** Starts the ensemble at `at`, on the first beat of a section. */
function startLoop(at: number): void {
	nextTime = at;
	pulse = 0;
	section = 'full';
	leadUntil = 0;
	fluteUntil = 2;
	if (live && !timer) timer = window.setInterval(tick, 30);
}

function stopLoop(): void {
	clearInterval(timer);
	timer = 0;
}

/** A brief gust of wind as the sound starts, falling away as the music comes in. */
function gust(t: number, hold: number): void {
	const { level, fall } = MIX.air;
	airGain.gain.cancelScheduledValues(t);
	airGain.gain.setValueAtTime(0, t);
	airGain.gain.linearRampToValueAtTime(level, t + 0.8);
	airGain.gain.setValueAtTime(level, t + hold);
	airGain.gain.linearRampToValueAtTime(0, t + hold + fall);
}

/** The first start: a gust, the talking drum calling alone for two bars, and the ensemble in on the gong. Returns when the ensemble comes in. */
function opening(t: number): number {
	gust(t, MIX.air.hold.first);
	const start = t + 0.6;
	playStrokes(start, ANNOUNCE, MIX.gain.lead);
	const down = start + 2 * BAR * PULSE;
	iron(down, places.gong, 110, MIX.gain.gong);
	return down;
}

function applyScene(fade = 2.5): void {
	layers = { ...SCENES[scene] };
	if (!live) return;
	const now = live.currentTime;
	padGain.gain.cancelScheduledValues(now);
	padGain.gain.setTargetAtTime(layers.pad * MIX.pad.level, now, fade / 3);
}

/** Starts the music. The first time a visit hears it, the talking drum calls it in. */
function begin(c: AudioContext): void {
	const first = !welcomed;
	welcomed = true;
	applyScene(first ? MIX.welcomeFade : MIX.fade);
	master.gain.cancelScheduledValues(c.currentTime);
	master.gain.setTargetAtTime(MIX.level, c.currentTime, first ? MIX.welcomeFade / 3 : MIX.fade);
	const t = c.currentTime + 0.1;
	if (first) startLoop(opening(t));
	else {
		gust(t, MIX.air.hold.again);
		startLoop(t + 0.3);
	}
}

// ---- Public.

export function soundEnabled(): boolean {
	return enabled;
}

export function subscribeSound(fn: () => void): () => void {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

/** Turns sound on or off. Call it from a click: browsers start audio only on a gesture. */
export function setSound(on: boolean): void {
	enabled = on;
	writePref(on);
	listeners.forEach((fn) => fn());
	if (on) {
		const c = build();
		if (!c) return;
		void c.resume().then(() => {
			begin(c);
			cue('mode');
		});
	} else if (live) {
		const c = live;
		master.gain.cancelScheduledValues(c.currentTime);
		master.gain.setTargetAtTime(0, c.currentTime, 0.25);
		window.setTimeout(() => {
			if (enabled) return;
			stopLoop();
			void c.suspend();
		}, 1200);
	}
}

/** The view changed: instruments come forward or step back to that view's mix. */
export function setScene(next: Scene): void {
	if (next === scene) return;
	scene = next;
	if (enabled) applyScene();
}

/** A short sound for one moment, close by. Silent while sound is off. */
export function cue(name: Cue): void {
	if (!enabled || !live || live.state !== 'running') return;
	const t = live.currentTime + 0.02;
	const out = places.near;
	switch (name) {
		case 'open':
			// A story begins: the big drum sounds, the talking drum calls up.
			skinDrum(t, out, 58, 0.9);
			talkingDrum(t + 0.25, out, 140, 1.3, 0.5);
			talkingDrum(t + 0.42, out, 180, 1.25, 0.45);
			talkingDrum(t + 0.66, out, 230, 0.8, 0.5);
			break;
		case 'close':
			// The drum lets the pitch fall.
			talkingDrum(t, out, 220, 0.62, 0.5);
			udu(t + 0.2, out, 64, 0.7);
			break;
		case 'chapter':
			// The ogene's two mouths, high then low, as a town crier's bell.
			iron(t, out, 660, 0.7, 0.35);
			iron(t + 0.22, out, 495, 0.6, 0.35);
			break;
		case 'tap':
			balafon(t, out, note(7), 0.6);
			break;
		case 'mode':
			balafon(t, out, note(5), 0.55);
			balafon(t + 0.11, out, note(7), 0.62);
			balafon(t + 0.22, out, note(9), 0.5);
			break;
	}
}

/**
 * Sound follows the visitor in: unless they turned it off, it starts with the first
 * tap, click or key (browsers will not start audio before a gesture), and it starts
 * at once where the browser already allows it.
 */
export function resumeOnGesture(): () => void {
	const EVENTS = ['pointerdown', 'touchend', 'click', 'keydown'] as const;
	const off = () => {
		for (const e of EVENTS) window.removeEventListener(e, on, true);
	};
	const on = () => {
		if (!enabled) return off();
		const c = build();
		if (!c) return off();
		void c.resume().then(() => {
			if (c.state !== 'running') return;
			off();
			begin(c);
		});
	};
	if (!enabled) return off;
	for (const e of EVENTS) window.addEventListener(e, on, true);
	// Some browsers let a returning visitor's audio start without a gesture.
	const c = build();
	if (c) {
		void c.resume().then(() => {
			if (c.state === 'running' && enabled && !welcomed) {
				off();
				begin(c);
			}
		});
	}
	return off;
}

/**
 * Renders the music into an offline context, to hear it outside the map (for
 * example as a WAV while tuning the mix): the opening, then `view`'s scene plays
 * on. Not used by the map; don't call it while the live sound plays.
 */
export function renderSoundscape(c: OfflineAudioContext, view: Scene = 'then'): Promise<AudioBuffer> {
	graph(c);
	layers = { ...SCENES[view] };
	padGain.gain.setTargetAtTime(layers.pad * MIX.pad.level, 0, MIX.welcomeFade / 3);
	master.gain.setTargetAtTime(MIX.level, 0, MIX.welcomeFade / 3);
	startLoop(opening(0.1));
	// Scheduled a second at a time, as it is live, rather than all at once.
	const end = c.length / c.sampleRate;
	advance(2);
	for (let at = 1; at < end - 1; at++) {
		void c.suspend(at).then(() => {
			advance(Math.min(at + 2, end));
			void c.resume();
		});
	}
	return c.startRendering();
}
