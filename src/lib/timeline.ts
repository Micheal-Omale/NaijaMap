// Time on the history view: which snapshot of each polity shows in a year, the
// events the timeline steps through, and the slider's uneven scale. Shared by
// the map app and the map, so no Astro imports here.

import type { EventView, History, PolityView, SnapshotView, SocietyView, TownView } from './types';

export const FIRST_YEAR = 1000;
export const LAST_YEAR = 1970;
/** The "Today" stop at the end of the timeline: the old states' surviving seats. */
export const TODAY = 2026;
/** The history view opens at the start of the timeline, so the story is told from the beginning. */
export const DEFAULT_YEAR = FIRST_YEAR;
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

/** Events on the map in `year`: from their year to their `until`. Newest first. */
export function eventsOn(history: History, year: number): EventView[] {
	if (year >= TODAY) return [];
	return history.events.filter((e) => e.year <= year && year <= e.until).sort((a, b) => b.year - a.year);
}

/** Events that begin in `year`, for the caption and the playback narration. */
export function eventsStarting(history: History, year: number): EventView[] {
	return history.events.filter((e) => e.year === year);
}

/**
 * Feature keys drawn in `year`: `<polity>|<snapshot>` for each polity, `<key>|war` for a
 * war line in its first years, `ev|<event>` for each event on the map, and
 * `soc:<society>|<land>` for each self-governing people's name, and `town:<town>|<span>`
 * for each town. The Today stop draws
 * each polity's seat.
 */
export function keysAt(history: History, year: number): Set<string> {
	if (year >= TODAY) return new Set([...history.polities.filter((p) => p.today.seat).map((p) => `today|${p.id}`), ...history.thrones.filter((t) => t.until === undefined).map((t) => `throne:${t.id}`)]);
	const keys = new Set<string>();
	for (const a of activeAt(history, year)) {
		const key = `${a.polity.id}|${a.index}`;
		keys.add(key);
		if (year - a.snapshot.year <= WAR_YEARS) keys.add(`${key}|war`);
	}
	for (const e of eventsOn(history, year)) keys.add(`ev|${e.id}`);
	for (const s of history.societies) for (const [i, l] of s.lands.entries()) if (l.from <= year && year <= l.to) keys.add(`soc:${s.id}|${i}`);
	for (const t of history.thrones) if (t.year <= year && year <= (t.until ?? LAST_YEAR)) keys.add(`throne:${t.id}`);
	for (const t of history.towns) for (const [i, w] of townSpans(t).entries()) if (w.from <= year && year <= w.to) keys.add(`town:${t.id}|${i}`);
	return keys;
}

/**
 * A town's life on the map, cut at each change of overlord: from its founding to
 * the end of the timeline, each stretch with the state it was under (if any).
 */
export function townSpans(t: TownView): { from: number; to: number; under?: TownView['under'][number] }[] {
	const cuts = new Set<number>([t.founded.year]);
	for (const u of t.under) {
		if (u.from > t.founded.year) cuts.add(u.from);
		if (u.to + 1 <= LAST_YEAR) cuts.add(u.to + 1);
	}
	const starts = [...cuts].filter((y) => y >= t.founded.year && y <= LAST_YEAR).sort((a, b) => a - b);
	return starts.map((from, i) => {
		const to = (starts[i + 1] ?? LAST_YEAR + 1) - 1;
		return { from, to, under: t.under.find((u) => u.from <= from && from <= u.to) };
	});
}

/** Peoples who governed themselves in `year`, with the places their names are written. */
export function societiesAt(history: History, year: number): SocietyView[] {
	if (year >= TODAY) return [];
	return history.societies.filter((s) => s.lands.some((l) => l.from <= year && year <= l.to));
}

/** Every year in which some snapshot or event begins, in order: the stops for play and step. */
export function eventYears(history: History): number[] {
	const years = new Set<number>();
	for (const p of history.polities) for (const s of p.snapshots) years.add(s.year);
	for (const e of history.events) years.add(e.year);
	return [...years].sort((a, b) => a - b);
}

/** Snapshots that begin in `year`, for the caption. */
export function eventsAt(history: History, year: number): Active[] {
	return activeAt(history, year).filter((a) => a.snapshot.year === year);
}

// The slider is uneven: few sources survive before 1400, and most snapshots fall
// after it, so 1000–1400 gets a short stretch of track and 1400–1914 the most.
// 1914–1970 (colonial resistance, independence, the civil war) gets a short
// stretch of its own. The last stretch is the Today stop.
const SCALE = [
	{ pos: 0, year: FIRST_YEAR },
	{ pos: 160, year: 1400 },
	{ pos: 880, year: 1914 },
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
