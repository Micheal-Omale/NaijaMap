// The Versus page's model: two sides (a state, a people who ruled themselves,
// or several together), each at a chosen moment of its history, and a guess at
// who would likely win. Pure functions, shared by the build and the browser.
//
// The guess weighs four things the data holds, all sourced: the land each side
// held (from the drawn territory), the arms it fielded at that date (data/forces),
// how its rule was organised, and where the fighting happens: horses die in the
// forest, war canoes rule the creeks, and defenders fight behind their walls.
// It is a what-if. The page always sets it beside what actually happened.

import type { Confidence, Evidence, History, PolityView, SocietyView, SourceView } from './types';

export type Terrain = 'sahel' | 'savanna' | 'river' | 'forest' | 'delta';
export type ArmKind = 'cavalry' | 'archers' | 'firearms' | 'canoes' | 'standing' | 'walls' | 'allies' | 'ritual' | 'militia';
export type WarResult = 'won' | 'lost' | 'held' | 'stalemate';

export interface ArmView extends Evidence {
	kind: ArmKind;
	level: number;
	from?: number;
	to?: number;
	text: string;
}

export interface RecordView extends Evidence {
	year: number;
	yearLabel?: string;
	against: string;
	polity?: string;
	result: WarResult;
	text: string;
	event?: string;
}

/** How one state (or self-governing people) made war. Built from data/forces. */
export interface ForcesView {
	id: string;
	of: 'polity' | 'society';
	status: string;
	terrain: Terrain;
	summary: Evidence & { text: string };
	arms: ArmView[];
	record: RecordView[];
	sources: SourceView[];
	reviewNotes: string[];
}

/** /data/versus.json */
export interface VersusData {
	forces: ForcesView[];
	/** Each society's lands in km², in the order of its `lands`. */
	societyKm2: Record<string, number[]>;
	/** A small base map: Nigeria's rings, its neighbours' land, and the great rivers. */
	map: { nigeria: [number, number][][]; land: [number, number][][]; rivers: [number, number][][] };
}

// ---- Geometry

const R = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

/** Area of one ring in km² (spherical, unsigned). */
export function ringKm2(ring: number[][]): number {
	let sum = 0;
	for (let i = 0; i < ring.length; i++) {
		const [x1, y1] = ring[i];
		const [x2, y2] = ring[(i + 1) % ring.length];
		sum += rad(x2 - x1) * (2 + Math.sin(rad(y1)) + Math.sin(rad(y2)));
	}
	return Math.abs((sum * R * R) / 2);
}

/** Area of a Polygon or MultiPolygon in km², holes taken out. */
export function geometryKm2(g: GeoJSON.Geometry | null): number {
	if (!g) return 0;
	const poly = (rings: number[][][]) => rings.reduce((s, r, i) => s + (i === 0 ? ringKm2(r) : -ringKm2(r)), 0);
	if (g.type === 'Polygon') return poly(g.coordinates);
	if (g.type === 'MultiPolygon') return g.coordinates.reduce((s, p) => s + poly(p), 0);
	return 0;
}

// ---- Sides

export type Phase = 'founding' | 'peak' | 'low' | 'end';
export type When = Phase | number;

/** A member: a polity id, or `society:<id>`. A people: `people:<group id>`, standing for all its states and societies. */
export interface SideSpec {
	members: string[];
	when: When;
}

export const PHASES: Phase[] = ['founding', 'peak', 'low', 'end'];

/** `oyo,egba~1830` or `people:yoruba~peak` or `aro` (at its height). */
export function parseSide(raw: string | null): SideSpec | null {
	if (!raw) return null;
	const [list, at] = raw.split('~');
	const members = list
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	if (!members.length) return null;
	const n = Number(at);
	const when: When = at && Number.isInteger(n) ? n : PHASES.includes(at as Phase) ? (at as Phase) : 'peak';
	return { members, when };
}

export function formatSide(s: SideSpec): string {
	return `${s.members.join(',')}${s.when === 'peak' ? '' : `~${s.when}`}`;
}

/** What the model needs about each polity and society, gathered once from the loaded data. */
export interface Index {
	polities: Map<string, PolityView>;
	societies: Map<string, SocietyView>;
	forces: Map<string, ForcesView>;
	/** `<polity>|<snapshot index>` → km² of each layer. */
	km2: Map<string, { core: number; influence: number }>;
	societyKm2: Record<string, number[]>;
	/** Peoples with more than one state or society: the "whole people, united" sides. */
	peoples: { id: string; name: string; members: string[] }[];
}

export function buildIndex(history: History, data: VersusData): Index {
	const km2 = new Map<string, { core: number; influence: number }>();
	for (const f of history.shapes.features) {
		const p = f.properties as { key: string; layer: string };
		if (p.layer !== 'core' && p.layer !== 'influence') continue;
		const e = km2.get(p.key) ?? { core: 0, influence: 0 };
		e[p.layer] += geometryKm2(f.geometry);
		km2.set(p.key, e);
	}
	const byPeople = new Map<string, { name: string; members: string[] }>();
	const add = (id: string, name: string, member: string) => {
		const e = byPeople.get(id) ?? { name, members: [] };
		e.members.push(member);
		byPeople.set(id, e);
	};
	for (const p of history.polities) for (const g of p.peoples) add(g.id, g.name, p.id);
	for (const s of history.societies) for (const g of s.groups) add(g.id, g.name, `society:${s.id}`);
	return {
		polities: new Map(history.polities.map((p) => [p.id, p])),
		societies: new Map(history.societies.map((s) => [s.id, s])),
		forces: new Map(data.forces.map((f) => [f.of === 'society' ? `society:${f.id}` : f.id, f])),
		km2,
		societyKm2: data.societyKm2,
		peoples: [...byPeople.entries()]
			.filter(([, v]) => v.members.length > 1)
			.map(([id, v]) => ({ id, ...v }))
			.sort((a, b) => b.members.length - a.members.length || a.name.localeCompare(b.name)),
	};
}

/** The concrete members a spec stands for (a people expands to all its states and societies). */
export function expand(ix: Index, members: string[]): string[] {
	const out: string[] = [];
	for (const m of members) {
		if (m.startsWith('people:')) out.push(...(ix.peoples.find((p) => p.id === m.slice(7))?.members ?? []));
		else if (ix.polities.has(m) || (m.startsWith('society:') && ix.societies.has(m.slice(8)))) out.push(m);
	}
	return [...new Set(out)];
}

export function memberName(ix: Index, m: string): string {
	if (m.startsWith('people:')) {
		const p = ix.peoples.find((x) => x.id === m.slice(7));
		return p ? p.name : m;
	}
	if (m.startsWith('society:')) return ix.societies.get(m.slice(8))?.name ?? m;
	return ix.polities.get(m)?.name ?? m;
}

export function memberColor(ix: Index, m: string): string {
	return ix.polities.get(m)?.color ?? '#6b5a45';
}

/** The span a member was on the map. */
export function spanOf(ix: Index, m: string): { from: number; to: number } | null {
	const p = ix.polities.get(m);
	if (p) return { from: p.span.from, to: p.span.to };
	const s = ix.societies.get(m.slice(8));
	return s ? { from: s.span.from, to: s.span.to } : null;
}

/** The years a side can be shown at: each snapshot of its states, and each change in its societies' lands. */
export function stopsOf(ix: Index, members: string[]): number[] {
	const years = new Set<number>();
	for (const m of members) {
		const p = ix.polities.get(m);
		if (p) for (const s of p.snapshots) years.add(s.year);
		const so = ix.societies.get(m.slice(8));
		if (so) for (const l of so.lands) years.add(l.from);
	}
	return [...years].sort((a, b) => a - b);
}

export interface MemberAt {
	id: string;
	name: string;
	kind: 'polity' | 'society';
	color: string;
	/** The snapshot shown, for a polity. */
	snapshot?: number;
	title?: string;
	yearLabel?: string;
	capital?: { name: string; point: [number, number] };
	coreKm2: number;
	influenceKm2: number;
	tribute: number;
	/** Land as a share of the member's own largest, for the phase multiplier. */
	ofBest: number;
	/** True when the year falls after the member's own height. */
	pastPeak: boolean;
	org: number;
	orgLabel: string;
	forces?: ForcesView;
}

const ORG: Record<string, number> = {
	empire: 1.15,
	caliphate: 1.2,
	kingdom: 1,
	confederacy: 0.9,
	'city-state': 0.95,
	network: 0.75,
	kingdoms: 0.8,
	chiefdoms: 0.7,
	assemblies: 0.65,
	elders: 0.6,
	villages: 0.6,
};

function snapshotIndexAt(p: PolityView, y: number): number {
	if (y < p.span.from || y > p.span.to) return -1;
	let i = 0;
	for (const [j, s] of p.snapshots.entries()) if (s.year <= y) i = j;
	return i;
}

function polityKm2(ix: Index, p: PolityView, i: number): { core: number; influence: number } {
	return ix.km2.get(`${p.id}|${i}`) ?? { core: 0, influence: 0 };
}

/** One member as it stood in year `y`, or null if it was not on the map then. */
export function memberAt(ix: Index, m: string, y: number): MemberAt | null {
	const p = ix.polities.get(m);
	if (p) {
		const i = snapshotIndexAt(p, y);
		if (i < 0) return null;
		const s = p.snapshots[i];
		const area = polityKm2(ix, p, i);
		const best = Math.max(...p.snapshots.map((_, j) => reachKm2(polityKm2(ix, p, j), p.kind === 'network')), 1);
		return {
			id: m,
			name: p.name,
			kind: 'polity',
			color: p.color,
			snapshot: i,
			title: s.title,
			yearLabel: s.yearLabel ?? String(s.year),
			capital: s.capital,
			coreKm2: area.core,
			influenceKm2: area.influence,
			tribute: s.links.filter((l) => l.kind === 'tribute').length,
			ofBest: reachKm2(area, p.kind === 'network') / best,
			pastPeak: s.year > p.peak,
			org: ORG[p.kind] ?? 1,
			orgLabel: p.kind,
			forces: ix.forces.get(m),
		};
	}
	const so = ix.societies.get(m.slice(8));
	if (!so || y < so.span.from || y > so.span.to) return null;
	const km = ix.societyKm2[so.id] ?? [];
	const land = so.lands.reduce((sum, l, i) => (l.from <= y && y <= l.to ? sum + (km[i] ?? 0) : sum), 0);
	return {
		id: m,
		name: so.name,
		kind: 'society',
		color: '#6b5a45',
		coreKm2: land,
		influenceKm2: 0,
		tribute: 0,
		ofBest: 1,
		pastPeak: false,
		org: ORG[so.rule] ?? 0.6,
		orgLabel: so.rule,
		forces: ix.forces.get(m),
	};
}

/** Land that counts as reach: ruled land, and a third of the looser kind. A ritual or trade network's land counts for less. */
function reachKm2(a: { core: number; influence: number }, network = false): number {
	const k = a.core + 0.35 * a.influence;
	return network ? 0.6 * k : k;
}

/** The year a phase stands for. */
export function resolveYear(ix: Index, members: string[], when: When): number | null {
	const stops = stopsOf(ix, members);
	if (!stops.length) return null;
	if (typeof when === 'number') return when;
	if (members.length === 1 && ix.polities.has(members[0])) {
		const p = ix.polities.get(members[0])!;
		const i = when === 'founding' ? 0 : when === 'end' ? p.snapshots.length - 1 : when === 'peak' ? snapshotIndexAt(p, p.peak) : lowIndex(ix, p);
		return p.snapshots[Math.max(0, i)].year;
	}
	if (when === 'founding') return stops[0];
	const total = (y: number) => members.reduce((s, m) => s + sideReach(memberAt(ix, m, y)), 0);
	// The end: the last year every member that will ever overlap was still standing.
	if (when === 'end') {
		const lastAll = Math.min(...members.map((m) => spanOf(ix, m)?.to ?? Infinity));
		return [...stops].reverse().find((y) => y <= lastAll) ?? stops[stops.length - 1];
	}
	const scored = stops.map((y) => ({ y, v: total(y) }));
	if (when === 'peak') return scored.reduce((b, s) => (s.v > b.v ? s : b)).y;
	const rest = scored.length > 1 ? scored.slice(1) : scored;
	return rest.reduce((b, s) => (s.v < b.v ? s : b)).y;
}

function sideReach(m: MemberAt | null): number {
	if (!m) return 0;
	return reachKm2({ core: m.coreKm2, influence: m.influenceKm2 }, m.orgLabel === 'network');
}

/** A polity's low point: its smallest land after its founding. */
function lowIndex(ix: Index, p: PolityView): number {
	if (p.snapshots.length === 1) return 0;
	let best = 1;
	let v = Infinity;
	for (let i = 1; i < p.snapshots.length; i++) {
		const r = reachKm2(polityKm2(ix, p, i), p.kind === 'network');
		if (r < v) {
			v = r;
			best = i;
		}
	}
	return best;
}

/** Which phase a single polity's year is, for the label ("at its height"). */
export function phaseOf(ix: Index, members: string[], year: number): Phase | null {
	for (const ph of PHASES) if (resolveYear(ix, members, ph) === year) return ph;
	return null;
}

// ---- The guess

/** How much each arm counts on each ground (1 = full). */
const FIT: Record<ArmKind, Record<Terrain, number>> = {
	cavalry: { sahel: 1.2, savanna: 1, river: 0.6, forest: 0.3, delta: 0.05 },
	archers: { sahel: 1, savanna: 1, river: 0.9, forest: 0.85, delta: 0.6 },
	firearms: { sahel: 1, savanna: 1, river: 1, forest: 1, delta: 1 },
	canoes: { sahel: 0, savanna: 0.15, river: 1, forest: 0.35, delta: 1.3 },
	standing: { sahel: 1, savanna: 1, river: 1, forest: 1, delta: 0.9 },
	walls: { sahel: 1, savanna: 1, river: 1, forest: 1, delta: 1 },
	allies: { sahel: 0.9, savanna: 0.9, river: 0.9, forest: 0.9, delta: 0.9 },
	ritual: { sahel: 0.35, savanna: 0.35, river: 0.35, forest: 0.35, delta: 0.35 },
	militia: { sahel: 0.8, savanna: 0.8, river: 0.8, forest: 0.8, delta: 0.8 },
};

/** An army away from its own kind of ground: horse armies suffered most in the forest and the creeks. */
function strangeGround(home: Terrain, ground: Terrain): number {
	if (home === ground) return 1;
	const open = home === 'sahel' || home === 'savanna';
	if (open && (ground === 'forest' || ground === 'delta')) return 0.75;
	if (home === 'delta' && ground !== 'river') return 0.8;
	if (home === 'forest' && ground === 'delta') return 0.85;
	return 0.9;
}

/** Guns mattered more as they improved: matchlocks, then flintlocks, then breech-loaders. */
function gunAge(y: number): number {
	return y < 1600 ? 0.8 : y < 1800 ? 1 : y < 1860 ? 1.2 : 1.5;
}

export type Role = 'attacker' | 'defender' | 'neutral';

export interface ArmScore {
	kind: ArmKind;
	level: number;
	fit: number;
	value: number;
	/** Whose arm it is (the strongest member's, for a coalition). */
	member: string;
	arm: ArmView;
}

export interface SideScore {
	year: number;
	members: MemberAt[];
	/** Members named but not on the map in this year. */
	absent: string[];
	terrain: Terrain;
	reachKm2: number;
	arms: ArmScore[];
	armsTotal: number;
	org: number;
	phase: number;
	unity: number;
	home: number;
	/** Defending with no single capital to take: kingless peoples and networks were slow to conquer. */
	scattered: number;
	/** Fighting away from its own kind of ground. */
	strange: number;
	/** The march from home, for an attacker (1 when at home). */
	march: number;
	/** Where the side's power sat: its lead state's capital, or its people's lands. */
	seat: [number, number] | null;
	power: number;
}

function societySeat(ix: Index, m: string, y: number): [number, number] | null {
	const s = ix.societies.get(m.slice(8));
	return s?.lands.find((l) => l.from <= y && y <= l.to)?.label ?? s?.lands[0]?.label ?? null;
}

/** Great-circle distance in km. */
export function km(a: [number, number], b: [number, number]): number {
	const h = Math.sin(rad(b[1] - a[1]) / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(rad(b[0] - a[0]) / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}

/** An army far from home was weaker: supplies, fodder and men ran short. Up to 40% weaker at 800 km and beyond. */
function marchFactor(from: [number, number] | null, to: [number, number] | null): number {
	if (!from || !to) return 1;
	return 1 - Math.min(0.4, km(from, to) / 2000);
}

/** The arms a member fielded in year `y`: the strongest entry of each kind in force then. */
export function armsAt(f: ForcesView | undefined, y: number): ArmView[] {
	if (!f) return [];
	const best = new Map<ArmKind, ArmView>();
	for (const a of f.arms) {
		if ((a.from !== undefined && y < a.from) || (a.to !== undefined && y > a.to)) continue;
		const was = best.get(a.kind);
		if (!was || a.level > was.level) best.set(a.kind, a);
	}
	return [...best.values()];
}

function roleFactor(kind: ArmKind, role: Role): number {
	if (kind === 'walls') return role === 'defender' ? 1 : 0.15;
	if (kind === 'militia') return role === 'defender' ? 1.25 : 0.45;
	if (kind === 'ritual') return role === 'defender' ? 1 : 0.5;
	return 1;
}

/** Scores one side, in one year, fighting on one ground in one role. */
export function scoreSide(ix: Index, members: string[], year: number, field: Terrain | null, role: Role): SideScore {
	const at = members.map((m) => ({ m, v: memberAt(ix, m, year) }));
	const present = at.filter((x) => x.v).map((x) => x.v!);
	const absent = at.filter((x) => !x.v).map((x) => x.m);
	// The side's home ground: its largest member's.
	const lead = [...present].sort((a, b) => sideReach(b) - sideReach(a))[0];
	const terrain: Terrain = lead?.forces?.terrain ?? 'savanna';
	const ground = field ?? terrain;

	// Each kind of arm: the strongest member's in full, others' adding a third.
	const byKind = new Map<ArmKind, ArmScore[]>();
	for (const m of present) {
		for (const arm of armsAt(m.forces, year)) {
			const fit = FIT[arm.kind][ground] * roleFactor(arm.kind, role) * (arm.kind === 'firearms' ? gunAge(year) : 1);
			const s: ArmScore = { kind: arm.kind, level: arm.level, fit, value: arm.level * fit, member: m.id, arm };
			byKind.set(arm.kind, [...(byKind.get(arm.kind) ?? []), s]);
		}
	}
	const arms: ArmScore[] = [];
	let armsTotal = 0;
	for (const list of byKind.values()) {
		list.sort((a, b) => b.value - a.value);
		arms.push(list[0]);
		armsTotal += list[0].value + 0.35 * list.slice(1).reduce((s, x) => s + x.value, 0);
	}
	arms.sort((a, b) => b.value - a.value);

	const reach = present.reduce((s, m) => s + sideReach(m), 0);
	const tribute = Math.min(5, present.reduce((s, m) => s + m.tribute, 0));
	const weight = (m: MemberAt) => Math.max(sideReach(m), 1);
	const totalW = present.reduce((s, m) => s + weight(m), 0) || 1;
	const org = present.reduce((s, m) => s + m.org * weight(m), 0) / totalW || 0.6;
	// Past its height a state is weaker in proportion to the land it has lost.
	const phase = present.reduce((s, m) => s + (m.pastPeak ? 0.8 + 0.2 * Math.min(1, m.ofBest) : 1) * weight(m), 0) / totalW || 1;
	const unity = Math.max(0.7, 1 - 0.07 * (present.length - 1));
	const home = role === 'defender' ? 1.12 : 1;
	const scattered = role === 'defender' && lead && (lead.kind === 'society' || lead.orgLabel === 'network') ? 1.25 : 1;
	const strange = role !== 'defender' ? strangeGround(terrain, ground) : 1;
	const reachScore = Math.log10(1 + reach / 500);
	const seat = lead?.capital?.point ?? (lead?.kind === 'society' ? societySeat(ix, lead.id, year) : null);
	const power = present.length ? (1 + armsTotal) * (0.6 + reachScore + 0.08 * tribute) * org * phase * unity * home * scattered * strange : 0;
	return { year, members: present, absent, terrain, reachKm2: reach, arms, armsTotal, org, phase, unity, home, scattered, strange, march: 1, seat, power };
}

export interface Bout {
	/** Where they fight, and who is at home. */
	field: Terrain;
	attacker: 'a' | 'b' | null;
	a: SideScore;
	b: SideScore;
	/** Chance side A wins, 0–1. */
	pA: number;
}

const odds = (a: number, b: number) => (a + b > 0 ? a ** 1.3 / (a ** 1.3 + b ** 1.3) : 0.5);

/** The guess: both ways round on each other's land, or once on a chosen ground. */
export function judge(ix: Index, a: { members: string[]; year: number }, b: { members: string[]; year: number }, field: Terrain | null): { bouts: Bout[]; pA: number } {
	if (field) {
		const sa = scoreSide(ix, a.members, a.year, field, 'neutral');
		const sb = scoreSide(ix, b.members, b.year, field, 'neutral');
		return { bouts: [{ field, attacker: null, a: sa, b: sb, pA: odds(sa.power, sb.power) }], pA: odds(sa.power, sb.power) };
	}
	const homeA = scoreSide(ix, a.members, a.year, null, 'neutral').terrain;
	const homeB = scoreSide(ix, b.members, b.year, null, 'neutral').terrain;
	const marched = (s: SideScore, to: SideScore): SideScore => {
		const march = marchFactor(s.seat, to.seat);
		return { ...s, march, power: s.power * march };
	};
	const aInvadesB = scoreSide(ix, b.members, b.year, homeB, 'defender');
	const bInvadesA = scoreSide(ix, a.members, a.year, homeA, 'defender');
	const aInvades = { field: homeB, attacker: 'a' as const, a: marched(scoreSide(ix, a.members, a.year, homeB, 'attacker'), aInvadesB), b: aInvadesB };
	const bInvades = { field: homeA, attacker: 'b' as const, a: bInvadesA, b: marched(scoreSide(ix, b.members, b.year, homeA, 'attacker'), bInvadesA) };
	const bouts: Bout[] = [aInvades, bInvades].map((x) => ({ ...x, pA: odds(x.a.power, x.b.power) }));
	return { bouts, pA: (bouts[0].pA + bouts[1].pA) / 2 };
}

/** The wars the two sides actually fought against each other, from either side's record. */
export function metInHistory(ix: Index, a: string[], b: string[]): { from: string; record: RecordView; forces: ForcesView }[] {
	const out: { from: string; record: RecordView; forces: ForcesView }[] = [];
	const seen = new Set<string>();
	const scan = (mine: string[], theirs: string[]) => {
		for (const m of mine) {
			const f = ix.forces.get(m);
			for (const r of f?.record ?? []) {
				if (!r.polity || !theirs.includes(r.polity)) continue;
				// One telling per war: the same year, the same pair, the same winner (Igala lost is Benin held).
				const winner = r.result === 'won' || r.result === 'held' ? m : r.result === 'lost' ? r.polity : '';
				const key = [r.year, ...[m, r.polity].sort(), winner].join('|');
				if (seen.has(key)) continue;
				seen.add(key);
				out.push({ from: m, record: r, forces: f! });
			}
		}
	};
	scan(a, b);
	scan(b, a);
	return out.sort((x, y) => x.record.year - y.record.year);
}

export function verdictBand(p: number): 'clear' | 'edge' | 'even' {
	const d = Math.abs(p - 0.5);
	return d >= 0.2 ? 'clear' : d >= 0.07 ? 'edge' : 'even';
}

export function confidenceRank(c: Confidence): number {
	return c === 'high' ? 2 : c === 'medium' ? 1 : 0;
}
