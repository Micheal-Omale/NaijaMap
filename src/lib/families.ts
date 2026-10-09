// Language families and their wider branches (Igboid, Yoruboid, Defoid, Benue-Congo,
// Chadic…), built from each people's lineage, so a visitor can search "Igboid" and
// see every Igboid people at once. No Astro imports: the map app uses it.

import type { AreaView, CommunityView, GroupView, Presence } from './types';

export interface LanguageGroup {
	/** `family:<name>`, the id the map app and the web address use. */
	id: string;
	name: string;
	/** From the widest branch down to this one: Atlantic-Congo › … › Igboid. */
	lineage: string[];
	/** Peoples in it, largest first (most LGAs). */
	groups: GroupView[];
	searchAliases: string[];
}

export const FAMILY_PREFIX = 'family:';

export const familyId = (name: string) => `${FAMILY_PREFIX}${name}`;

export function languageGroups(groups: GroupView[]): LanguageGroup[] {
	const byName = new Map<string, LanguageGroup>();
	for (const g of groups) {
		const { lineage, name: own } = g.language.family;
		const path = lineage.includes(own) ? lineage : [...lineage, own];
		for (const [i, name] of path.entries()) {
			const entry = byName.get(name) ?? { id: familyId(name), name, lineage: path.slice(0, i + 1), groups: [], searchAliases: [`${name} languages`] };
			entry.groups.push(g);
			byName.set(name, entry);
		}
	}
	for (const f of byName.values()) f.groups.sort((a, b) => b.areas.length - a.areas.length || a.name.localeCompare(b.name));
	return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const RANK: Record<Presence, number> = { core: 0, significant: 1, minority: 2 };

/**
 * One map highlight for a whole language group: every LGA any of its peoples lives
 * in, at the strongest presence any of them has there, and all their communities.
 */
export function familyHighlight(f: LanguageGroup): { areas: AreaView[]; communities: CommunityView[] } {
	const areas = new Map<string, AreaView>();
	for (const g of f.groups) {
		for (const a of g.areas) {
			const had = areas.get(a.lga);
			if (!had || RANK[a.presence] < RANK[had.presence]) areas.set(a.lga, a);
		}
	}
	const seen = new Set<string>();
	const communities: CommunityView[] = [];
	for (const g of f.groups) {
		for (const c of g.communities) {
			const key = `${c.lga}|${c.name}`;
			if (seen.has(key)) continue;
			seen.add(key);
			communities.push(c);
		}
	}
	return { areas: [...areas.values()], communities };
}
