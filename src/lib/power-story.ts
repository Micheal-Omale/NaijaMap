// A period of politics told as a story, like a kingdom's: a prologue, the
// centre (who ruled the country), each region or zone in turn, the coalitions,
// the coups, the elections, and an epilogue leading to the next period. Shared by
// the map app, which moves the map, and the story view, which tells it.

import type { EraView } from './types';

export type PowerChapter =
	| { kind: 'cover' }
	| { kind: 'centre' }
	| { kind: 'unit'; id: string }
	| { kind: 'coalition'; id: string }
	| { kind: 'coup'; id: string }
	| { kind: 'results' }
	| { kind: 'end' };

export function powerChaptersOf(era: EraView): PowerChapter[] {
	return [
		{ kind: 'cover' },
		{ kind: 'centre' },
		...era.units.map((u) => ({ kind: 'unit' as const, id: u.id })),
		...era.coalitions.map((c) => ({ kind: 'coalition' as const, id: c.id })),
		// Coups in the order they happened.
		...[...era.coups].sort((a, b) => a.year - b.year).map((c) => ({ kind: 'coup' as const, id: c.id })),
		...(era.results.length ? [{ kind: 'results' as const }] : []),
		{ kind: 'end' },
	];
}

/** The year a chapter belongs to, for the counter in the lower bar. */
export function powerChapterYear(era: EraView, c: PowerChapter): number {
	if (c.kind === 'coup') return era.coups.find((x) => x.id === c.id)?.year ?? era.from;
	if (c.kind === 'coalition') return era.coalitions.find((x) => x.id === c.id)?.from ?? era.from;
	if (c.kind === 'results') return Math.max(era.from, ...era.results.map((r) => r.year));
	if (c.kind === 'end') return era.to ?? new Date().getFullYear();
	return era.from;
}
