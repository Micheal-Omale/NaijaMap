import { Easing } from 'remotion';

export const FPS = 30;
export const W = 1080;
export const H = 1920;
/** Everything after the partition of Borno runs this much later, so its card can be read. */
export const SHIFT = 39; // half a bar: the cuts after it land on the bar's second beat

// The score's grid: 12/8 at 92 BPM. A pulse is an eighth note; a bar is twelve.
export const PULSE = (60 / 92 / 3) * FPS; // 6.52 frames
export const BAR = 12 * PULSE; // 78.26 frames
export const bar = (n: number) => Math.round(n * BAR);
export const pulse = (n: number) => Math.round(n * PULSE);

/** The score render starts 0.1 s of silence and 0.6 s of wind before the drum's first stroke. */
export const SCORE_OFFSET = Math.round(0.7 * FPS);

// The drum's announcement (src/lib/sound.ts ANNOUNCE), in film frames from its first stroke.
// Its last bar is a roll that quickens into the gong: the drain cuts on those strokes.
export const ROLL = [18, 18.5, 19, 19.5, 20, 20.5, 21, 21.5, 22, 22.5, 23].map(pulse);
export const GONG = bar(2); // 157
export const MUSIC_STOP = 745;
export const MUSIC_BACK = bar(11); // 861, in the score's own time

// After the cut on Borno: film frames.
export const T_TODAY = 783 + SHIFT;
export const T_BRIDGE = bar(12) + SHIFT;
export const T_LANG = bar(15) + SHIFT;
export const T_END = bar(20) + SHIFT;
export const END_LEN = 150;
export const TOTAL_FRAMES = T_END + END_LEN; // 1754: 58.5 s

export const SAFE = { top: 220, bottom: 380, right: 120, left: 72 } as const;

export const C = {
	parchment: '#ece1c8',
	surface: '#f7efdc',
	ink: '#2b2118',
	muted: '#5f5141',
	sienna: '#8a3f1c',
	scarlet: '#c8102e',
	black: '#110c08',
	atlas: '#f4f2ed',
} as const;

export const SERIF = "'Palatino Linotype', 'Book Antiqua', Palatino, 'Iowan Old Style', serif";

// The library's ease vocabulary (inspiration/PATTERNS.md §3).
export const EASE = {
	out: Easing.bezier(0.215, 0.61, 0.355, 1), // power3.out: entrances
	in: Easing.bezier(0.55, 0.085, 0.68, 0.53), // power2.in: exits, three times faster
	inOut: Easing.bezier(0.455, 0.03, 0.515, 0.955), // power2.inOut: swaps, dissolves
	hop: Easing.bezier(0.9, 0, 0.1, 1), // hard in, hard out: structural moves
	expo: Easing.bezier(0.16, 1, 0.3, 1), // sharp settles
} as const;

/**
 * The interaction recordings (docs/promo/capture-recordings.mjs) and the second each key
 * moment lands in them, from rec/markers.json. A tap lands about 0.12 s after its mark.
 */
export const REC = {
	// The site clears the map after the kingdom tap and draws the kingdom in later; both read off the frames.
	R1: { select: 3.83, tapKingdom: 10.21, sheetGone: 10.45, kingdomDrawing: 12.75 },
	R2: { tap: 1, fading: 1.85, oyoRising: 2.25 },
	R3: { tap: 1 },
	R4: { suggest: 3.53, select: 4.98, igboid: 11.51, hausa: 17.54, end: 18.65 },
} as const;
