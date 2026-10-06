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
import type { Confidence, History, PolityView, SnapshotView } from './types';

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

const lgasByState = new Map<string, string[]>();
for (const l of lgaIndex) lgasByState.set(l.stateId, [...(lgasByState.get(l.stateId) ?? []), l.id]);

type Polity = CollectionEntry<'polities'>['data'];
type Extent = NonNullable<Polity['snapshots'][number]['core']>;

function lgasOf(extent: Extent): string[] {
	const set = new Set<string>();
	for (const s of extent.states) for (const id of lgasByState.get(s) ?? []) set.add(id);
	for (const id of extent.lgas) set.add(id as string);
	for (const id of extent.except) set.delete(id as string);
	return [...set];
}

type Shape = { key: string; p: string; s: number; layer: 'core' | 'influence'; conf: Confidence; lgas: string[]; beyond: [number, number][][] };

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
			if (geometry) inside.push({ type: 'Feature', properties: { key: `${sh.key}|${sh.layer}` }, geometry });
		}
		for (const ring of sh.beyond) {
			const soft = smooth(ring);
			const closed = [...soft, soft[0]];
			outside.push({ type: 'Feature', properties: { key: `${sh.key}|${sh.layer}` }, geometry: { type: 'Polygon', coordinates: [closed] } });
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
function labelPoint(lgas: string[], beyond: [number, number][][]): [number, number] | undefined {
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
			const layers = { core: s.core, influence: s.influence } as const;
			let label: [number, number] | undefined;
			const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
			const conf: Partial<Record<'core' | 'influence', Confidence>> = {};
			for (const layer of ['core', 'influence'] as const) {
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
				links: s.links as SnapshotView['links'],
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

	const dissolved = shapes.length ? await dissolve(shapes) : { type: 'FeatureCollection' as const, features: [] };
	const meta = new Map(shapes.map((sh) => [`${sh.key}|${sh.layer}`, sh]));
	const network = new Set(entries.filter((e) => e.data.kind === 'network').map((e) => e.id));
	dissolved.features = dissolved.features
		.filter((f) => f.geometry)
		.map((f, i) => {
			const sh = meta.get(String(f.properties?.key))!;
			return {
				...f,
				id: i + 1,
				properties: { key: sh.key, p: sh.p, layer: sh.layer, conf: sh.conf, color: INK[sh.p] ?? '#6b5a45', network: network.has(sh.p) },
			};
		});

	return { polities, shapes: dissolved };
}
