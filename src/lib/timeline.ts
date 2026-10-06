// Time on the history view: which snapshot of each polity shows in a year, the
// events the timeline steps through, and the slider's uneven scale. Shared by
// the map app and the map, so no Astro imports here.

import type { History, PolityView, SnapshotView } from './types';

export const FIRST_YEAR = 1000;
export const LAST_YEAR = 1914;
/** The "Today" stop at the end of the timeline: the old states' surviving seats. */
export const TODAY = 2026;
export const DEFAULT_YEAR = 1600;
/** A war is drawn for this many years after its snapshot begins; tribute and trade last the whole snapshot. */
export const WAR_YEARS = 25;

/** The snapshot of `p` showing in `year`, or -1 when the polity is not on the map. */
export function snapshotAt(p: PolityView, year: number): number {
	if (year < p.span.from || year > p.span.to) return -1;
	let at = -1;
	for (const [i, s] of p.snapshots.entries()) if (s.year <= year) at = i;
	return at;
}

export interface Active {
	polity: PolityView;
	index: number;
	snapshot: SnapshotView;
}

export function activeAt(history: History, year: number): Active[] {
	if (year >= TODAY) return [];
	const out: Active[] = [];
	for (const polity of history.polities) {
		const index = snapshotAt(polity, year);
		if (index >= 0) out.push({ polity, index, snapshot: polity.snapshots[index] });
	}
	return out;
}

/** Feature keys (`<polity>|<snapshot>`) drawn in `year`; the Today stop draws each polity's seat. */
export function keysAt(history: History, year: number): Set<string> {
	if (year >= TODAY) return new Set(history.polities.filter((p) => p.today.seat).map((p) => `today|${p.id}`));
	const keys = new Set<string>();
	for (const a of activeAt(history, year)) {
		const key = `${a.polity.id}|${a.index}`;
		keys.add(key);
		if (year - a.snapshot.year <= WAR_YEARS) keys.add(`${key}|war`);
	}
	return keys;
}

/** Every year in which some snapshot begins, in order: the stops for play and step. */
export function eventYears(history: History): number[] {
	const years = new Set<number>();
	for (const p of history.polities) for (const s of p.snapshots) years.add(s.year);
	return [...years].sort((a, b) => a - b);
}

/** Snapshots that begin in `year`, for the caption. */
export function eventsAt(history: History, year: number): Active[] {
	return activeAt(history, year).filter((a) => a.snapshot.year === year);
}

// The slider is uneven: few sources survive before 1400, and most snapshots fall
// after it, so 1000–1400 gets a short stretch of track and 1400–1914 the rest.
// The last stretch is the Today stop.
const SCALE = [
	{ pos: 0, year: FIRST_YEAR },
	{ pos: 160, year: 1400 },
	{ pos: 940, year: LAST_YEAR },
];
export const SLIDER_MAX = 1000;
const TODAY_POS = 975;

export function yearToPos(year: number): number {
	if (year >= TODAY) return SLIDER_MAX;
	for (let i = 1; i < SCALE.length; i++) {
		const a = SCALE[i - 1];
		const b = SCALE[i];
		if (year <= b.year) return a.pos + ((Math.max(year, a.year) - a.year) / (b.year - a.year)) * (b.pos - a.pos);
	}
	return SCALE[SCALE.length - 1].pos;
}

export function posToYear(pos: number): number {
	if (pos >= TODAY_POS) return TODAY;
	for (let i = 1; i < SCALE.length; i++) {
		const a = SCALE[i - 1];
		const b = SCALE[i];
		if (pos <= b.pos) return Math.round(a.year + ((pos - a.pos) / (b.pos - a.pos)) * (b.year - a.year));
	}
	return LAST_YEAR;
}

export function parseYear(value: string | null): number | null {
	if (value === 'today') return TODAY;
	const n = Number(value);
	return Number.isInteger(n) && n >= FIRST_YEAR && n <= LAST_YEAR ? n : null;
}

export function formatYearParam(year: number): string {
	return year >= TODAY ? 'today' : String(year);
}
