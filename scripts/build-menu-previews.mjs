// Draws the menu's preview cards: each view's own map, tiny, in its own colours,
// so a visitor can see what a view feels like before opening it.
//
//   npx astro dev --background
//   node scripts/build-menu-previews.mjs [baseUrl]
//
// Reads the published data from the running site (the dev server shows drafts too,
// so publish first, or point it at a preview build) and writes
// src/components/menu-previews.ts. Run it again when the atlas, the First Republic
// or the kingdoms of 1750 change shape.
//
//   Peoples:  every LGA in its main people's colour, dissolved by colour
//   Kingdoms: Oyo, Benin, Bornu, Igala and Kwararafa as they stood in 1750
//   Politics: the regions of the First Republic, and its leaders' roads to Lagos
//   Versus:   Oyo against Benin, the page's opening match-up, as they stood in 1750

import { writeFile } from 'node:fs/promises';
import mapshaper from 'mapshaper';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const OUT = 'src/components/menu-previews.ts';

/** The cards' frame: Nigeria fills a 120 by 100 box with a small margin. */
const BOX = { w: 120, h: 100, west: 2.45, north: 14.1, scale: 9.4 };
/** Simplification, in metres: anything finer is lost at the size of a card. */
const SIMPLIFY = 12000;

const KINGDOM_YEAR = 1750;
const KINGDOMS = ['kanem-bornu', 'kwararafa', 'igala', 'benin', 'oyo'];
/** The kingdom whose frontier the card draws by pen. */
const PEN = 'oyo';
const SEAT = { name: 'Lagos', point: [3.39, 6.45] };
/** The Versus card's two sides, each fitted into its half of the card. */
const VERSUS = { a: { id: 'oyo', box: [36, 6, 48, 36] }, b: { id: 'benin', box: [36, 58, 48, 36] } };
/** The atlas fills in from the confluence of the Niger and the Benue, the middle of the country. */
const CENTRE = [6.74, 7.8];

const get = async (path) => {
	const res = await fetch(BASE + path);
	if (!res.ok) throw new Error(`${path}: ${res.status}`);
	return res.json();
};

const [lgas, base, atlas, history, politics] = await Promise.all([
	get('/geo/lgas.json'),
	get('/geo/base.json'),
	get('/data/atlas.json'),
	get('/data/history.json'),
	get('/data/politics.json'),
]);

async function simplify(fc, dissolve) {
	const cmd = `-i in.json ${dissolve ? `-dissolve ${dissolve} ` : ''}-simplify interval=${SIMPLIFY} keep-shapes -filter-slivers min-area=40km2 -o out.json format=geojson geojson-type=FeatureCollection precision=0.0001`;
	const out = await mapshaper.applyCommands(cmd, { 'in.json': fc });
	const result = JSON.parse(String(out['out.json']));
	// Slivers too small for a card come back empty.
	result.features = result.features.filter((f) => f.geometry);
	return result;
}

const xy = ([lon, lat]) => [(lon - BOX.west) * BOX.scale, (BOX.north - lat) * BOX.scale];
// Half a unit is a third of a pixel on a card.
const num = (n) => String(Math.round(n * 2) / 2);
/** One closed ring of card points, without the repeats that rounding makes. */
const ring = (pts) =>
	pts
		.filter((p, i, a) => i === 0 || num(p[0]) !== num(a[i - 1][0]) || num(p[1]) !== num(a[i - 1][1]))
		.map((p, i) => `${i ? 'L' : 'M'}${num(p[0])} ${num(p[1])}`)
		.join('') + 'Z';
const polygons = (geom) => (geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : []);
const path = (geom, project = xy) =>
	polygons(geom)
		.flatMap((poly) => poly.map((r) => ring(r.map(project))))
		.join('');

/** A projection that fits a shape, centred, into a box of the card. */
function fit(geom, [x0, y0, w, h]) {
	const pts = polygons(geom).flat(2).map(xy);
	const [minX, maxX] = [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0]))];
	const [minY, maxY] = [Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1]))];
	const k = Math.min(w / (maxX - minX), h / (maxY - minY));
	const dx = x0 + (w - (maxX - minX) * k) / 2;
	const dy = y0 + (h - (maxY - minY) * k) / 2;
	return (c) => {
		const [x, y] = xy(c);
		return [(x - minX) * k + dx, (y - minY) * k + dy];
	};
}

/** The middle of a shape's bounding box, in lon/lat. */
function middle(geom) {
	const pts = polygons(geom).flat(2);
	const lon = pts.map((p) => p[0]);
	const lat = pts.map((p) => p[1]);
	return [(Math.min(...lon) + Math.max(...lon)) / 2, (Math.min(...lat) + Math.max(...lat)) / 2];
}

// ---- The outline: the mainland, without the small islands.
const outline = base.features.find((f) => f.properties.kind === 'outline');
const mainland = outline.geometry.coordinates.reduce((a, b) => (b.length > a.length ? b : a));
const outlineShape = await simplify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [mainland] } }] });

// ---- Peoples: the atlas in its language families' colours (a people's own shade is lost at this size).
const groupColor = new Map(atlas.groups.map((g) => [g.id, g.color]));
const familyColor = new Map(atlas.families.map((f) => [f.name, f.color]));
const groupFamily = new Map(atlas.groups.map((g) => [g.id, familyColor.get(g.family)]));
const peoplesIn = {
	type: 'FeatureCollection',
	features: lgas.features
		.map((f) => ({ ...f, properties: { color: groupFamily.get(atlas.lgas[f.properties.id]?.group) ?? null } }))
		.filter((f) => f.properties.color),
};
const peoples = (await simplify(peoplesIn, 'color')).features
	.map((f) => {
		const [lon, lat] = middle(f.geometry);
		return { d: path(f.geometry), fill: f.properties.color, far: Math.hypot(lon - CENTRE[0], lat - CENTRE[1]) };
	})
	.sort((a, b) => a.far - b.far)
	.map(({ d, fill }) => ({ d, fill }));

// ---- Politics: the First Republic's regions, each in its leading people's colour.
const era = politics.eras.find((e) => e.id === 'first-republic');
const unitOf = new Map(era.units.flatMap((u) => u.lgas.map((id) => [id, u])));
const politicsIn = {
	type: 'FeatureCollection',
	features: lgas.features
		.filter((f) => unitOf.has(f.properties.id))
		.map((f) => {
			const u = unitOf.get(f.properties.id);
			return { ...f, properties: { unit: u.id, color: groupColor.get(u.groups[0]?.id) ?? '#8a8f99' } };
		}),
};
const regions = (await simplify(politicsIn, 'unit copy-fields=color')).features.map((f) => ({ d: path(f.geometry), fill: f.properties.color }));
const roads = era.federal.leaders
	.filter((l) => l.home)
	.map((l) => {
		const [x1, y1] = xy(l.home.point);
		const [x2, y2] = xy(SEAT.point);
		// A gentle arc, as the map draws them.
		const mx = (x1 + x2) / 2 + (y2 - y1) * 0.18;
		const my = (y1 + y2) / 2 - (x2 - x1) * 0.18;
		return { d: `M${num(x1)} ${num(y1)}Q${num(mx)} ${num(my)} ${num(x2)} ${num(y2)}`, home: [num(x1), num(y1)].map(Number) };
	});

// ---- Kingdoms: each one's snapshot standing in 1750.
const kingdomShapes = [];
for (const id of KINGDOMS) {
	const p = history.polities.find((x) => x.id === id);
	if (!p) throw new Error(`No polity ${id}`);
	const index = p.snapshots.findLastIndex((s) => s.year <= KINGDOM_YEAR);
	for (const layer of ['influence', 'core']) {
		const f = history.shapes.features.find((x) => x.properties.key === `${id}|${index}` && x.properties.layer === layer);
		if (!f) continue;
		const [s] = (await simplify({ type: 'FeatureCollection', features: [f] })).features;
		if (s) kingdomShapes.push({ id, layer, d: path(s.geometry), fill: p.color });
	}
}
const pen = kingdomShapes.find((k) => k.id === PEN && k.layer === 'core');
if (!pen) throw new Error(`No ${PEN} core in ${KINGDOM_YEAR}`);

// ---- Versus: the two sides' heartlands, each filling its half.
const side = async ({ id, box }) => {
	const p = history.polities.find((x) => x.id === id);
	const index = p.snapshots.findLastIndex((s) => s.year <= KINGDOM_YEAR);
	const f = history.shapes.features.find((x) => x.properties.key === `${id}|${index}` && x.properties.layer === 'core');
	const [s] = (await simplify({ type: 'FeatureCollection', features: [f] })).features;
	return { name: p.shortName ?? p.name, d: path(s.geometry, fit(s.geometry, box)) };
};
const versus = { a: await side(VERSUS.a), b: await side(VERSUS.b) };

const data = {
	box: [BOX.w, BOX.h],
	outline: path(outlineShape.features[0].geometry),
	peoples,
	kingdoms: { year: KINGDOM_YEAR, shapes: kingdomShapes.map(({ layer, d, fill }) => ({ layer, d, fill })), pen: pen.d },
	politics: { regions, roads, seat: xy(SEAT.point).map((n) => Number(num(n))) },
	versus,
};

const source = `// Generated by scripts/build-menu-previews.mjs from the published map data. Do not edit by hand.
// Paths are in a ${BOX.w} by ${BOX.h} box.

export const PREVIEWS = ${JSON.stringify(data, null, '\t')} as const;
`;
await writeFile(OUT, source);
console.log(`${OUT}: ${(source.length / 1024).toFixed(1)} KB · peoples ${peoples.length} · regions ${regions.length} · kingdoms ${kingdomShapes.length}`);
