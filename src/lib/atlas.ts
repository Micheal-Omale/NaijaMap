// The default atlas view: every LGA coloured by its main group, a hue per
// language family and a shade per group, plus a label point per group.
// Built at build time into /data/atlas.json from the visible groups.

import lgaIndex from '../data/lgas.json';
import type { GroupView, Presence } from './types';

const point = new Map(lgaIndex.map((l) => [l.id, l.point as [number, number]]));

/** Base hue (degrees) per language family. Neighbouring families get far apart hues. */
const FAMILY_HUE: Record<string, number> = {
	Chadic: 24,
	Yoruboid: 152,
	Igboid: 336,
	'Ebira-Nupoid': 208,
	Edoid: 50,
	Idomoid: 178,
	'Lower Cross': 284,
	Ijoid: 228,
	'Atlantic (Fula)': 78,
	Saharan: 2,
	Tivoid: 104,
	Plateau: 266,
	Jukunoid: 246,
	Kainji: 192,
	Adamawa: 312,
	Ogonoid: 350,
	Ekoid: 128,
	'Arabic (Semitic)': 40,
};

function hue(family: string): number {
	if (family in FAMILY_HUE) return FAMILY_HUE[family];
	let h = 0;
	for (const ch of family) h = (h * 31 + ch.charCodeAt(0)) % 360;
	return h;
}

function hsl(h: number, s: number, l: number): string {
	const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
	const f = (n: number) => {
		const k = (n + h / 30) % 12;
		const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
		return Math.round(c * 255).toString(16).padStart(2, '0');
	};
	return `#${f(0)}${f(8)}${f(4)}`;
}

export interface AtlasGroup {
	id: string;
	name: string;
	family: string;
	color: string;
	/** Where the group's name is written: the middle of its homeland. */
	label: [number, number] | null;
	/** LGAs where this group is the main group. */
	lgas: number;
}

export interface AtlasFamily {
	name: string;
	color: string;
	groups: string[];
}

export interface Atlas {
	/**
	 * LGA id → its main group, whether another group also has a large share
	 * (mixed: drawn hatched), or, when no single group leads, the groups that
	 * share it equally (shared: drawn in stripes of their colours).
	 */
	lgas: Record<string, { group: string; mixed: boolean; shared?: string[] }>;
	groups: AtlasGroup[];
	families: AtlasFamily[];
}

const RANK: Record<Presence, number> = { core: 0, significant: 1, minority: 2 };
const CONF: Record<string, number> = { high: 0, medium: 1, disputed: 2 };

export function buildAtlas(groups: GroupView[]): Atlas {
	// Every claim per LGA.
	const claims = new Map<string, { group: GroupView; presence: Presence; confidence: string }[]>();
	for (const g of groups) {
		for (const a of g.areas) {
			const list = claims.get(a.lga) ?? [];
			list.push({ group: g, presence: a.presence, confidence: a.confidence });
			claims.set(a.lga, list);
		}
	}

	// The main group: the strongest presence, then the surest claim, then the group
	// with the smaller footprint (the local people over the widespread one).
	const lgas: Atlas['lgas'] = {};
	for (const [lga, list] of claims) {
		const ranked = list
			.filter((c) => c.presence !== 'minority')
			.sort(
				(a, b) =>
					RANK[a.presence] - RANK[b.presence] ||
					CONF[a.confidence] - CONF[b.confidence] ||
					a.group.areas.length - b.group.areas.length,
			);
		if (ranked.length === 0) continue;
		const cores = ranked.filter((c) => c.presence === 'core');
		// No single homeland group: several homeland claims, or only shared claims.
		const equals = cores.length >= 2 ? cores : cores.length === 0 && ranked.length >= 2 ? ranked : [];
		if (equals.length >= 2) {
			const shared = equals.slice(0, 3).map((c) => c.group.id);
			lgas[lga] = { group: shared[0], mixed: false, shared };
		} else {
			lgas[lga] = { group: ranked[0].group.id, mixed: ranked.length > 1 };
		}
	}

	// Colours: shades within each family, the largest group darkest.
	const dominantCount = new Map<string, number>();
	// Count only LGAs a group leads on its own; shared LGAs belong to no one group.
	for (const { group, shared } of Object.values(lgas)) if (!shared) dominantCount.set(group, (dominantCount.get(group) ?? 0) + 1);
	const byFamily = new Map<string, GroupView[]>();
	for (const g of groups) {
		const f = g.language.family.name;
		byFamily.set(f, [...(byFamily.get(f) ?? []), g]);
	}
	const color = new Map<string, string>();
	const families: AtlasFamily[] = [];
	for (const [family, list] of byFamily) {
		list.sort((a, b) => (dominantCount.get(b.id) ?? 0) - (dominantCount.get(a.id) ?? 0) || a.name.localeCompare(b.name));
		const h = hue(family);
		// One hue per family: groups differ in lightness (and a little in saturation),
		// so a family never drifts into a neighbouring family's colour.
		list.forEach((g, i) => {
			const t = list.length === 1 ? 0.35 : i / (list.length - 1);
			color.set(g.id, hsl(h, 70 - 18 * t, 38 + 34 * t));
		});
		families.push({ name: family, color: hsl(h, 62, 48), groups: list.map((g) => g.id) });
	}
	families.sort((a, b) => b.groups.length - a.groups.length || a.name.localeCompare(b.name));

	// Label inside the group's own land: at the LGA it leads that is nearest the
	// middle of the others. An average point can fall between two clusters (for
	// example Okene and Koton Karfe) on someone else's LGA.
	const atlasGroups: AtlasGroup[] = groups.map((g) => {
		const own = Object.entries(lgas).filter(([, v]) => v.group === g.id && !v.shared).map(([id]) => point.get(id)!);
		const pts = own.length ? own : g.areas.filter((a) => a.presence === 'core').map((a) => point.get(a.lga)!);
		let label: [number, number] | null = null;
		let best = Infinity;
		for (const p of pts) {
			const d = pts.reduce((s, q) => s + (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2, 0);
			if (d < best) {
				best = d;
				label = p;
			}
		}
		return { id: g.id, name: g.name, family: g.language.family.name, color: color.get(g.id)!, label, lgas: dominantCount.get(g.id) ?? 0 };
	});

	return { lgas, groups: atlasGroups, families };
}
