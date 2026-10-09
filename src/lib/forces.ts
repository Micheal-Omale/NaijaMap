// The Versus page's data: how each state made war (data/forces), the size of
// each society's lands, and a small base map. Built at build time into
// /data/versus.json; the territory itself comes from /data/history.json.

import { readFile } from 'node:fs/promises';
import { getCollection } from 'astro:content';
import { isVisible, makeCiter } from './groups';
import { geometryKm2, type ForcesView, type VersusData } from './versus';

let cached: Promise<VersusData> | undefined;

export function getVersus(): Promise<VersusData> {
	cached ??= build();
	return cached;
}

const round = (p: number[]): [number, number] => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];

/** Drops points closer than about a kilometre to the last kept one: the page's map is small. */
function thin(line: number[][]): [number, number][] {
	const out: [number, number][] = [];
	for (const p of line) {
		const q = round(p);
		const last = out[out.length - 1];
		if (!last || Math.abs(last[0] - q[0]) + Math.abs(last[1] - q[1]) >= 0.02) out.push(q);
	}
	return out;
}

async function json<T>(path: string): Promise<T> {
	return JSON.parse(await readFile(`public/geo/${path}`, 'utf8')) as T;
}

async function build(): Promise<VersusData> {
	const polities = new Set((await getCollection('polities', ({ data }) => isVisible(data.status))).map((p) => p.id));
	const societies = await getCollection('societies', ({ data }) => isVisible(data.status));
	const societyIds = new Set(societies.map((s) => s.id));
	const entries = await getCollection('forces', ({ data }) => isVisible(data.status));

	const forces: ForcesView[] = [];
	for (const entry of entries) {
		const f = entry.data;
		if (f.of === 'polity' ? !polities.has(entry.id) : !societyIds.has(entry.id)) {
			console.warn(`[forces] ${entry.id}: no visible ${f.of} with this id`);
			continue;
		}
		const { sources, evidence } = makeCiter();
		forces.push({
			id: entry.id,
			of: f.of,
			status: f.status,
			terrain: f.terrain,
			summary: { text: f.summary.text, ...(await evidence(f.summary)) },
			arms: await Promise.all(f.arms.map(async (a) => ({ kind: a.kind, level: a.level, from: a.from, to: a.to, text: a.text, ...(await evidence(a)) }))),
			record: await Promise.all(
				f.record.map(async (r) => ({
					year: r.year,
					yearLabel: r.yearLabel,
					against: r.against,
					polity: r.polity && polities.has(r.polity.id) ? r.polity.id : undefined,
					result: r.result,
					text: r.text,
					event: r.event?.id,
					...(await evidence(r)),
				})),
			),
			sources,
			reviewNotes: f.reviewNotes,
		});
	}

	// Each society's lands in km², from the LGA shapes.
	const lgas = await json<GeoJSON.FeatureCollection>('lgas.json');
	const lgaKm2 = new Map(lgas.features.map((f) => [String(f.properties?.id), geometryKm2(f.geometry)]));
	const societyKm2: Record<string, number[]> = {};
	for (const s of societies) {
		societyKm2[s.id] = s.data.lands.map((l) => Math.round(l.lgas.reduce((sum, id) => sum + (lgaKm2.get(id as string) ?? 0), 0)));
	}

	// A small base map: Nigeria, its neighbours, and the big rivers.
	const base = await json<GeoJSON.FeatureCollection>('base.json');
	const region = await json<GeoJSON.FeatureCollection>('region.json');
	const outline = base.features.find((f) => f.properties?.kind === 'outline')?.geometry as GeoJSON.MultiLineString | undefined;
	const land: [number, number][][] = [];
	const rivers: [number, number][][] = [];
	for (const f of region.features) {
		const g = f.geometry;
		const kind = f.properties?.kind;
		if (kind === 'land') {
			if (g.type === 'Polygon') land.push(thin(g.coordinates[0]));
			if (g.type === 'MultiPolygon') for (const p of g.coordinates) land.push(thin(p[0]));
		}
	}
	for (const f of [...base.features, ...region.features]) {
		if (f.properties?.kind !== 'river') continue;
		const g = f.geometry;
		if (g.type === 'LineString') rivers.push(thin(g.coordinates));
		if (g.type === 'MultiLineString') for (const l of g.coordinates) rivers.push(thin(l));
	}
	return {
		forces,
		societyKm2,
		map: { nigeria: (outline?.coordinates ?? []).map(thin), land: land.filter((r) => r.length > 2), rivers: rivers.filter((r) => r.length > 1) },
	};
}
