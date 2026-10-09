// A polity's story: a prologue (the polity at its height), one chapter per
// snapshot, and an epilogue (what remains today). Shared by the map app, which
// moves the map, and the story view, which tells it.

import { TODAY } from './timeline';
import type { PolityView } from './types';

export type Chapter = { kind: 'cover' } | { kind: 'snapshot'; index: number } | { kind: 'today' };

export function chaptersOf(p: PolityView): Chapter[] {
	return [{ kind: 'cover' }, ...p.snapshots.map((_, index) => ({ kind: 'snapshot' as const, index })), { kind: 'today' }];
}

function peakIndex(p: PolityView): number {
	return p.snapshots.reduce((best, s, i) => (s.year <= p.peak ? i : best), 0);
}

/** The year a chapter shows on the map: the prologue shows the polity at its height. */
export function chapterYear(p: PolityView, c: Chapter): number {
	if (c.kind === 'today') return TODAY;
	if (c.kind === 'snapshot') return p.snapshots[c.index].year;
	return p.snapshots[peakIndex(p)].year;
}

/** The snapshot whose frontier a chapter draws, if it has ruled land. */
export function chapterFrontier(p: PolityView, c: Chapter): number | null {
	const index = c.kind === 'snapshot' ? c.index : c.kind === 'cover' ? peakIndex(p) : -1;
	return index >= 0 && p.snapshots[index].core ? index : null;
}
