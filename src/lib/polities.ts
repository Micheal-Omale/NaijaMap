// The history (Then) view: every visible polity with its snapshots, and the
// territory of each snapshot dissolved into one shape per layer. Built at build
// time into /data/history.json.
//
// Territory inside Nigeria is listed by today's LGAs and states, so it is drawn
// to the nearest LGA. Land outside Nigeria comes from rough rings, clipped at the
// border so the two never overlap.

import { readFile } from 'node:fs/promises';
import { getCollection, type CollectionEntry } from 'astro:content';
import lgaIndex from '../data/lgas.json';
import { getGroupViews, isVisible, makeCiter } from './groups';
import { COLONIAL_INK, isForeign } from './ink';
import { LAST_YEAR } from './timeline';
import type { Confidence, EventView, History, PolityView, SnapshotView, SocietyView, ThroneView, TownView } from './types';

/** Each polity's ink on the old map. Neighbours that overlap in time get far apart inks. */
const INK: Record<string, string> = {
	'kanem-bornu': '#9c5a2c',
	sokoto: '#2f6b4f',
	kano: '#b07a2a',
	katsina: '#7d5aa6',
	zazzau: '#b0473a',
	gobir: '#5b7b9a',
	kebbi: '#8a6d3b',
	zamfara: '#a85d7c',
	daura: '#6c8a3a',
	kwararafa: '#8c3d3d',
	nupe: '#2a7a7a',
	igala: '#c9822a',
	borgu: '#6a7f4f',
	oyo: '#2e5c8a',
	ife: '#a07c2c',
	ijebu: '#6b4f8a',
	egba: '#4f8a6b',
	ibadan: '#9a3b5c',
	ekitiparapo: '#5f7f8f',
	lagos: '#c0603a',
	benin: '#8e2f3c',
	warri: '#4a6fa5',
	nri: '#7a5c99',
	aro: '#b5532f',
	bonny: '#2d7f8f',
	kalabari: '#8f6d2d',
	nembe: '#5c7f3d',
	opobo: '#a33f5a',
	'old-calabar': '#3f5fa0',
};

/** Peoples and powers on the map without a polity of their own (the Portuguese, the Akpa). */
const NEUTRAL_INK = '#5c4a38';
/** The parts of a partitioned kingdom, each hatched in its own direction and tint. */
const PIECE_INK = ['#8a3b2a', '#2f5a85', '#5d7a2c', '#86622a', '#6a3f86', '#2f7a72'];

const lgasByState = new Map<string, string[]>();
for (const l of lgaIndex) lgasByState.set(l.stateId, [...(lgasByState.get(l.stateId) ?? []), l.id]);

type Polity = CollectionEntry<'polities'>['data'];
type Extent = NonNullable<Polity['snapshots'][number]['core']>;

export function lgasOf(extent: Extent): string[] {
	const set = new Set<string>();
	for (const s of extent.states) for (const id of lgasByState.get(s) ?? []) set.add(id);
	for (const id of extent.lgas) set.add(id as string);
	for (const id of extent.except) set.delete(id as string);
	return [...set];
}

type Layer = 'core' | 'influence' | 'campaign' | 'piece';
type Shape = { key: string; p: string; s: number; layer: Layer; conf: Confidence; lgas: string[]; beyond: [number, number][][] };

/**
 * Rounds the corners of a rough ring (Chaikin's method), so outlines drawn from
 * a handful of points read as hand-drawn frontiers rather than survey lines.
 */
function smooth(ring: [number, number][], rounds = 3): [number, number][] {
	let pts = ring;
	for (let r = 0; r < rounds; r++) {
		const next: [number, number][] = [];
		for (let i = 0; i < pts.length; i++) {
			const a = pts[i];
			const b = pts[(i + 1) % pts.length];
			next.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
		}
		pts = next;
	}
	return pts.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);
}

/** One dissolved shape per snapshot layer, or per piece of a partition. */
const shapeKey = (sh: Shape) => (sh.layer === 'piece' ? `${sh.key}|piece|${sh.s}` : `${sh.key}|${sh.layer}`);

/** Dissolves every snapshot layer at once with mapshaper. */
async function dissolve(shapes: Shape[]): Promise<GeoJSON.FeatureCollection> {
	const mapshaper = (await import('mapshaper')).default;
	const lgas = JSON.parse(await readFile('public/geo/lgas.json', 'utf8')) as GeoJSON.FeatureCollection;
	const byId = new Map(lgas.features.map((f) => [String(f.properties?.id), f.geometry]));

	const inside: GeoJSON.Feature[] = [];
	const outside: GeoJSON.Feature[] = [];
	for (const sh of shapes) {
		for (const id of sh.lgas) {
			const geometry = byId.get(id);
			if (geometry) inside.push({ type: 'Feature', properties: { key: shapeKey(sh) }, geometry });
		}
		for (const ring of sh.beyond) {
			const soft = smooth(ring);
			const closed = [...soft, soft[0]];
			outside.push({ type: 'Feature', properties: { key: shapeKey(sh) }, geometry: { type: 'Polygon', coordinates: [closed] } });
		}
	}

	const out = await mapshaper.applyCommands(
		'-i lgas.json name=lgas -dissolve + name=nigeria ' +
			'-i outside.json name=outside -erase nigeria target=outside ' +
			'-i inside.json name=inside ' +
			'-merge-layers target=inside,outside name=all force ' +
			'-drop target=lgas,nigeria ' +
			// Snapshots overlap each other, so each is dissolved on its own layer:
			// a planar dissolve across all of them would hand shared land to only one.
			'-split key target=all ' +
			'-dissolve2 key target=* ' +
			'-merge-layers target=* name=all force ' +
			// Lighter shapes for phones: frontiers are approximate anyway, and old maps drew them freehand.
			'-simplify 45% keep-shapes target=all ' +
			'-o target=all format=geojson geojson-type=FeatureCollection precision=0.001 all.json',
		{
			'lgas.json': lgas,
			'inside.json': { type: 'FeatureCollection', features: inside },
			'outside.json': { type: 'FeatureCollection', features: outside.length ? outside : [] },
		},
	);
	return JSON.parse(String(out['all.json'])) as GeoJSON.FeatureCollection;
}

function extend(box: [number, number, number, number], coords: unknown): void {
	if (typeof (coords as number[])[0] === 'number') {
		const [x, y] = coords as number[];
		box[0] = Math.min(box[0], x);
		box[1] = Math.min(box[1], y);
		box[2] = Math.max(box[2], x);
		box[3] = Math.max(box[3], y);
		return;
	}
	for (const c of coords as unknown[]) extend(box, c);
}

/** A point well inside a polygon: the LGA centre nearest the middle of the others, or the ring's centre. */
export function labelPoint(lgas: string[], beyond: [number, number][][]): [number, number] | undefined {
	const pts = lgas.map((id) => lgaIndex.find((l) => l.id === id)?.point as [number, number]).filter(Boolean);
	if (pts.length) {
		let best = pts[0];
		let score = Infinity;
		for (const p of pts) {
			const d = pts.reduce((s, q) => s + (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2, 0);
			if (d < score) {
				score = d;
				best = p;
			}
		}
		return best;
	}
	const ring = beyond[0];
	if (!ring) return undefined;
	return [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
}

/** A gentle arc between two points, like a route drawn by hand on an old map. */
function arc(a: [number, number], b: [number, number], steps = 40): [number, number][] {
	const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
	const bend = 0.16;
	const c: [number, number] = [(a[0] + b[0]) / 2 - dy * bend, (a[1] + b[1]) / 2 + dx * bend];
	const out: [number, number][] = [];
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const u = 1 - t;
		out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
	}
	return out;
}

/** A route through several waypoints, rounded (Chaikin) but still starting and ending where it says. */
function curve(points: [number, number][], rounds = 4): [number, number][] {
	if (points.length === 2) return arc(points[0], points[1]);
	let pts = points;
	for (let r = 0; r < rounds; r++) {
		const next: [number, number][] = [pts[0]];
		for (let i = 0; i < pts.length - 1; i++) {
			const a = pts[i];
			const b = pts[i + 1];
			next.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
		}
		next.push(pts[pts.length - 1]);
		pts = next;
	}
	return pts;
}

const round3 = (p: [number, number]): [number, number] => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000];

/** How long an event stays on the map when its file does not say. */
function defaultUntil(kind: EventView['kind'], year: number): number {
	if (kind === 'partition') return LAST_YEAR;
	return Math.min(LAST_YEAR, year + (kind === 'migration' ? 30 : 20));
}

let cached: Promise<History> | null = null;

export function getHistory(): Promise<History> {
	cached ??= build();
	return cached;
}

async function build(): Promise<History> {
	const entries = (await getCollection('polities', ({ data }) => isVisible(data.status))).sort((a, b) => a.data.span.from - b.data.span.from);
	const groups = await getGroupViews();
	const groupName = new Map(groups.map((g) => [g.id, g.name]));

	const shapes: Shape[] = [];
	const polities: PolityView[] = [];

	for (const entry of entries) {
		const p = entry.data;
		const { sources, evidence } = makeCiter();
		const snapshots: SnapshotView[] = [];
		for (const [i, s] of p.snapshots.entries()) {
			const key = `${entry.id}|${i}`;
			const layers = { core: s.core, influence: s.influence, campaign: s.campaign } as const;
			let label: [number, number] | undefined;
			const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
			const conf: Partial<Record<Layer, Confidence>> = {};
			for (const layer of ['core', 'influence', 'campaign'] as const) {
				const extent = layers[layer];
				if (!extent) continue;
				const lgas = lgasOf(extent);
				const beyond = extent.beyond as [number, number][][];
				if (!lgas.length && !beyond.length) continue;
				conf[layer] = extent.confidence ?? s.confidence;
				shapes.push({ key, p: entry.id, s: i, layer, conf: conf[layer]!, lgas, beyond });
				label ??= labelPoint(lgas, beyond);
				for (const id of lgas) extend(box, lgaIndex.find((l) => l.id === id)!.point);
				for (const ring of beyond) extend(box, ring);
			}
			if (s.capital) extend(box, s.capital.point);
			for (const n of s.nodes) extend(box, n.point);
			snapshots.push({
				year: s.year,
				yearLabel: s.yearLabel,
				title: s.title,
				text: s.text,
				capital: s.capital as SnapshotView['capital'],
				nodes: s.nodes as SnapshotView['nodes'],
				links: await Promise.all(
					s.links.map(async (l) => ({
						kind: l.kind,
						to: l.to as SnapshotView['links'][number]['to'],
						label: l.label,
						note: l.note,
						confidence: l.confidence,
						refs: l.sources.length ? (await evidence({ sources: l.sources, confidence: l.confidence ?? s.confidence })).refs : [],
					})),
				),
				...conf,
				label: label ?? (s.capital?.point as [number, number] | undefined),
				bounds: Number.isFinite(box[0]) ? box : undefined,
				...(await evidence(s)),
			});
		}

		// Who lives in the polity's lands at its height today: homeland LGAs of each people.
		const peakIndex = p.snapshots.reduce((best, s, i) => (s.year <= p.peak ? i : best), 0);
		const peakSnap = p.snapshots[peakIndex];
		const peakLgas = new Set([...(peakSnap.core ? lgasOf(peakSnap.core) : []), ...(peakSnap.influence ? lgasOf(peakSnap.influence) : [])]);
		const livesThereToday = groups
			.map((g) => ({ id: g.id, name: g.name, lgas: g.areas.filter((a) => a.presence === 'core' && peakLgas.has(a.lga)).length }))
			.filter((g) => g.lgas > 0)
			.sort((a, b) => b.lgas - a.lgas || a.name.localeCompare(b.name))
			.slice(0, 12);

		polities.push({
			id: entry.id,
			name: p.name,
			kind: p.kind,
			status: p.status,
			otherNames: p.otherNames,
			shortName: p.shortName ?? p.name,
			color: INK[entry.id] ?? '#6b5a45',
			span: { from: p.span.from, to: p.span.to, fromLabel: p.span.fromLabel, toLabel: p.span.toLabel, ...(await evidence(p.span)) },
			peak: p.peak,
			summary: { text: p.summary.text, ...(await evidence(p.summary)) },
			ruler: p.ruler ? { title: p.ruler.title, ...(await evidence(p.ruler)) } : undefined,
			peoples: p.peoples.filter((g) => groupName.has(g.id)).map((g) => ({ id: g.id, name: groupName.get(g.id)! })),
			livesThereToday,
			snapshots,
			today: { text: p.today.text, title: p.today.title, seat: p.today.seat as PolityView['today']['seat'], ...(await evidence(p.today)) },
			sources,
			reviewNotes: p.reviewNotes,
		});
	}

	const events = await buildEvents(shapes);
	const societies = await buildSocieties(entries, groupName);
	const towns = await buildTowns(groupName);
	const thrones = await buildThrones(groupName);

	const dissolved = shapes.length ? await dissolve(shapes) : { type: 'FeatureCollection' as const, features: [] };
	const meta = new Map(shapes.map((sh) => [shapeKey(sh), sh]));
	const network = new Set(entries.filter((e) => e.data.kind === 'network').map((e) => e.id));
	const all = dissolved.features.filter((f) => f.geometry);
	// The parts of a partitioned kingdom go to their own collection: they move when they appear.
	const pieces: GeoJSON.Feature[] = all
		.filter((f) => meta.get(String(f.properties?.key))?.layer === 'piece')
		.map((f, i) => {
			const sh = meta.get(String(f.properties?.key))!;
			const e = events.find((x) => `ev|${x.id}` === sh.key)!;
			return { ...f, id: i + 1, properties: { key: sh.key, e: e.id, i: sh.s, name: e.pieces[sh.s].name, color: PIECE_INK[sh.s % PIECE_INK.length] } };
		});
	dissolved.features = all
		.filter((f) => meta.get(String(f.properties?.key))?.layer !== 'piece')
		.map((f, i) => {
			const sh = meta.get(String(f.properties?.key))!;
			const color = sh.p.startsWith('ev|') ? COLONIAL_INK : (INK[sh.p] ?? '#6b5a45');
			return {
				...f,
				id: i + 1,
				properties: { key: sh.key, p: sh.p, layer: sh.layer, conf: sh.conf, color, network: network.has(sh.p) },
			};
		});

	return { polities, events, societies, towns, thrones, shapes: dissolved, pieces: { type: 'FeatureCollection', features: pieces } };
}

/** Thrones made, restored, filled or imposed under colonial rule. */
async function buildThrones(groupName: Map<string, string>): Promise<ThroneView[]> {
	const entries = (await getCollection('thrones', ({ data }) => isVisible(data.status))).sort((a, b) => a.data.year - b.data.year);
	const out: ThroneView[] = [];
	for (const entry of entries) {
		const t = entry.data;
		const { sources, evidence } = makeCiter();
		out.push({
			id: entry.id,
			title: t.title,
			status: t.status,
			kind: t.kind,
			year: t.year,
			yearLabel: t.yearLabel,
			until: t.until,
			seat: t.seat as ThroneView['seat'],
			by: t.by,
			first: t.first,
			crowned: t.crowned ? { by: t.crowned.by, at: t.crowned.at as ThroneView['seat'] | undefined, text: t.crowned.text, ...(await evidence(t.crowned)) } : undefined,
			groups: t.groups.filter((g) => groupName.has(g.id)).map((g) => ({ id: g.id, name: groupName.get(g.id)! })),
			polity: t.polity?.id,
			text: t.text,
			...(await evidence(t)),
			sources,
			reviewNotes: t.reviewNotes,
		});
	}
	return out;
}

/** Inks for founding peoples who came from no state on the timeline. */
const PEOPLE_INK: Record<string, string> = {
	Igbo: '#4f7a3a',
	Yoruba: '#2e5c8a',
	Olukumi: '#2e5c8a',
	Ibibio: '#8a5a7a',
	Idoma: '#7a6a3a',
	Fulani: '#2f6b4f',
	Bariba: '#6a7f4f',
};

/** Towns founded by several peoples, or held by a state for a time. */
async function buildTowns(groupName: Map<string, string>): Promise<TownView[]> {
	const entries = (await getCollection('towns', ({ data }) => isVisible(data.status))).sort((a, b) => a.data.founded.year - b.data.founded.year);
	const polityName = new Map((await getCollection('polities')).map((p) => [p.id, p.data.name]));
	const out: TownView[] = [];
	for (const entry of entries) {
		const t = entry.data;
		const { sources, evidence } = makeCiter();
		const founders = [];
		for (const f of t.founders) {
			founders.push({
				people: f.people,
				group: f.group && groupName.has(f.group.id) ? { id: f.group.id, name: groupName.get(f.group.id)! } : undefined,
				polity: f.polity?.id,
				// One ink per people (“Igbo (Ado N’Idu)” is Igbo), so a town's wedges and threads match its founders.
				color: PEOPLE_INK[f.people.split(' (')[0]] ?? (f.polity && INK[f.polity.id]) ?? NEUTRAL_INK,
				from: f.from as TownView['founders'][number]['from'],
				quarters: f.quarters,
				text: f.text,
				...(await evidence(f)),
			});
		}
		const under = [];
		for (const u of [...t.under].sort((a, b) => a.from - b.from)) {
			under.push({ polity: u.polity.id, polityName: polityName.get(u.polity.id) ?? u.polity.id, color: INK[u.polity.id] ?? NEUTRAL_INK, from: u.from, to: u.to, kind: u.kind, text: u.text, ...(await evidence(u)) });
		}
		out.push({
			id: entry.id,
			name: t.name,
			status: t.status,
			otherNames: t.otherNames,
			point: t.point as [number, number],
			founded: { year: t.founded.year, yearLabel: t.founded.yearLabel, ...(await evidence(t.founded)) },
			summary: { text: t.summary.text, ...(await evidence(t.summary)) },
			founders,
			under,
			sources,
			reviewNotes: t.reviewNotes,
		});
	}
	return out;
}

/** The LGA nearest the middle of the others: where a people's name is written. */
function centralLga(lgas: string[]): string {
	const pts = lgas.map((id) => ({ id, p: lgaIndex.find((l) => l.id === id)!.point as [number, number] }));
	let best = pts[0];
	let score = Infinity;
	for (const a of pts) {
		const d = pts.reduce((s, b) => s + (a.p[0] - b.p[0]) ** 2 + (a.p[1] - b.p[1]) ** 2, 0);
		if (d < score) {
			score = d;
			best = a;
		}
	}
	return best.id;
}

/**
 * The peoples who governed themselves in the open land. A name written inside a
 * state's ruled land would contradict the map, so the build warns when one does.
 */
async function buildSocieties(polities: CollectionEntry<'polities'>[], groupName: Map<string, string>): Promise<SocietyView[]> {
	const entries = (await getCollection('societies', ({ data }) => isVisible(data.status))).sort((a, b) => a.data.name.localeCompare(b.data.name));
	// Ruled land by year range, to check each written name against.
	const ruled: { polity: string; from: number; to: number; lgas: Set<string> }[] = [];
	for (const p of polities) {
		for (const [i, s] of p.data.snapshots.entries()) {
			if (!s.core) continue;
			const next = p.data.snapshots[i + 1];
			ruled.push({ polity: p.id, from: s.year, to: next ? next.year - 1 : p.data.span.to, lgas: new Set(lgasOf(s.core)) });
		}
	}
	const out: SocietyView[] = [];
	for (const entry of entries) {
		const s = entry.data;
		const { sources, evidence } = makeCiter();
		const lands = s.lands.map((l) => {
			const at = centralLga(l.lgas as string[]);
			const to = l.to ?? s.span.to;
			for (const r of ruled) {
				if (r.lgas.has(at) && r.from <= to && l.from <= r.to) {
					console.warn(`[societies] ${entry.id}: "${l.label ?? s.name}" is written in ${at}, ruled by ${r.polity} in ${Math.max(r.from, l.from)}–${Math.min(r.to, to)}`);
				}
			}
			return {
				from: l.from,
				to,
				label: lgaIndex.find((x) => x.id === at)!.point as [number, number],
				name: l.label ?? s.name,
				confidence: l.confidence,
				note: l.note,
			};
		});
		out.push({
			id: entry.id,
			name: s.name,
			status: s.status,
			rule: s.rule,
			groups: s.groups.filter((g) => groupName.has(g.id)).map((g) => ({ id: g.id, name: groupName.get(g.id)! })),
			span: { from: s.span.from, to: s.span.to, fromLabel: s.span.fromLabel, toLabel: s.span.toLabel, ...(await evidence(s.span)) },
			summary: { text: s.summary.text, ...(await evidence(s.summary)) },
			end: s.end ? { text: s.end.text, ...(await evidence(s.end)) } : undefined,
			lands,
			sources,
			reviewNotes: s.reviewNotes,
		});
	}
	return out;
}

/** Wars, raids, alliances, migrations, conquests and partitions, with their land added to `shapes` for dissolving. */
async function buildEvents(shapes: Shape[]): Promise<EventView[]> {
	const entries = (await getCollection('events', ({ data }) => isVisible(data.status))).sort((a, b) => a.data.year - b.data.year || a.id.localeCompare(b.id));
	const out: EventView[] = [];
	for (const entry of entries) {
		const e = entry.data;
		const { sources, evidence } = makeCiter();
		const key = `ev|${entry.id}`;
		const actors = e.actors.map((a) => ({
			name: a.name,
			polity: a.polity?.id,
			side: a.side,
			color: a.side === 'colonial' || a.side === 'european' ? COLONIAL_INK : (a.ink ?? (a.polity ? (INK[a.polity.id] ?? NEUTRAL_INK) : NEUTRAL_INK)),
		}));
		const lead = actors.find((a) => a.side === 'colonial' || a.side === 'european' || a.side === 'attacker' || a.side === 'migrant') ?? actors[0];
		const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];

		const routes = await Promise.all(
			e.routes.map(async (r) => {
				for (const p of r.path) extend(box, p);
				const by = r.by ? actors.find((a) => a.name === r.by) : undefined;
				if (r.by && !by) throw new Error(`${entry.id}: route "${r.label}" is by "${r.by}", who is not an actor`);
				return {
					kind: r.kind,
					vessel: r.kind === 'voyage' ? (r.vessel ?? 'sail') : undefined,
					path: curve(r.path as [number, number][]).map(round3),
					label: r.label,
					by: r.by,
					when: r.when,
					note: r.note,
					confidence: r.confidence,
					refs: r.sources.length ? (await evidence({ sources: r.sources, confidence: r.confidence ?? e.confidence })).refs : [],
					color: (by ?? lead).color,
				};
			}),
		);

		const colonial = isForeign(e.kind);
		const moments = await Promise.all(
			e.moments.map(async (m) => {
				if (m.at) extend(box, m.at.point);
				return {
					when: m.when,
					title: m.title,
					text: m.text,
					at: m.at as EventView['moments'][number]['at'],
					mark: m.mark,
					colonial,
					confidence: m.confidence,
					refs: m.sources.length ? (await evidence({ sources: m.sources, confidence: m.confidence ?? e.confidence })).refs : [],
				};
			}),
		);

		const areaLgas = e.area ? lgasOf(e.area) : [];
		const areaBeyond = (e.area?.beyond ?? []) as [number, number][][];
		if (areaLgas.length || areaBeyond.length) {
			shapes.push({ key, p: key, s: 0, layer: 'campaign', conf: e.area?.confidence ?? e.confidence, lgas: areaLgas, beyond: areaBeyond });
			for (const id of areaLgas) extend(box, lgaIndex.find((l) => l.id === id)!.point);
			for (const ring of areaBeyond) extend(box, ring);
		}
		const pieces = e.pieces.map((piece, i) => {
			const lgas = lgasOf(piece.extent);
			const beyond = piece.extent.beyond as [number, number][][];
			shapes.push({ key, p: key, s: i, layer: 'piece', conf: piece.extent.confidence ?? e.confidence, lgas, beyond });
			for (const id of lgas) extend(box, lgaIndex.find((l) => l.id === id)!.point);
			for (const ring of beyond) extend(box, ring);
			return { name: piece.name, note: piece.note, label: labelPoint(lgas, beyond) };
		});

		out.push({
			id: entry.id,
			name: e.name,
			kind: e.kind,
			status: e.status,
			year: e.year,
			yearLabel: e.yearLabel,
			until: e.until ?? defaultUntil(e.kind, e.year),
			actors,
			summary: { text: e.summary.text, ...(await evidence(e.summary)) },
			routes,
			moments,
			area: areaLgas.length + areaBeyond.length > 0,
			pieces,
			polities: [...new Set(actors.flatMap((a) => (a.polity ? [a.polity] : [])))],
			bounds: Number.isFinite(box[0]) ? box : undefined,
			...(await evidence(e)),
			sources,
			reviewNotes: e.reviewNotes,
		});
	}
	return out;
}
