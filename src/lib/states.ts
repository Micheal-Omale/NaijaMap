// The peoples of each state, LGA by LGA, for the state reading pages. Built from the same
// published group data as the people pages, so a state page never shows a draft.

import lgaIndex from '../data/lgas.json';
import { getGroupViews } from './groups';
import type { Presence } from './types';

export interface StatePeople {
	id: string;
	name: string;
	/** LGAs of this state where the people is the majority, a large share, or a smaller presence. */
	core: number;
	significant: number;
	minority: number;
}

export interface StateView {
	id: string;
	name: string;
	lgas: { id: string; name: string; peoples: { id: string; name: string; presence: Presence }[] }[];
	/** Every people mapped in the state, most LGAs as the majority first. */
	peoples: StatePeople[];
	/** The peoples who are the majority in the most LGAs: the state's main peoples. */
	main: StatePeople[];
}

const ORDER: Presence[] = ['core', 'significant', 'minority'];

export async function getStateViews(): Promise<StateView[]> {
	const groups = await getGroupViews();
	const states = new Map<string, { name: string; lgas: StateView['lgas'] }>();
	const lgaRow = new Map<string, StateView['lgas'][number]>();
	for (const l of lgaIndex) {
		if (!states.has(l.stateId)) states.set(l.stateId, { name: l.state, lgas: [] });
		const row = { id: l.id, name: l.name, peoples: [] };
		states.get(l.stateId)!.lgas.push(row);
		lgaRow.set(l.id, row);
	}
	for (const g of groups) {
		for (const a of g.areas) lgaRow.get(a.lga)?.peoples.push({ id: g.id, name: g.name, presence: a.presence });
	}

	return [...states].map(([id, s]) => {
		const tally = new Map<string, StatePeople>();
		for (const lga of s.lgas) {
			lga.peoples.sort((a, b) => ORDER.indexOf(a.presence) - ORDER.indexOf(b.presence) || a.name.localeCompare(b.name));
			for (const p of lga.peoples) {
				const t = tally.get(p.id) ?? { id: p.id, name: p.name, core: 0, significant: 0, minority: 0 };
				t[p.presence]++;
				tally.set(p.id, t);
			}
		}
		const peoples = [...tally.values()].sort(
			(a, b) => b.core - a.core || b.significant - a.significant || b.minority - a.minority || a.name.localeCompare(b.name),
		);
		const cored = peoples.filter((p) => p.core > 0);
		const main = (cored.length ? cored : peoples.filter((p) => p.significant > 0)).slice(0, 5);
		s.lgas.sort((a, b) => a.name.localeCompare(b.name));
		return { id, name: s.name, lgas: s.lgas, peoples, main };
	});
}
