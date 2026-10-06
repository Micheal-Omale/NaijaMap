// Builds the map geometry from the raw open data in data/raw/.
//
//   npm run geo
//
// Inputs (see data/SOURCES.md for licences):
//   data/raw/nga-adm2.geojson   GRID3 LGA boundaries via geoBoundaries (CC BY 4.0)
//   data/raw/nga-adm1.geojson   GRID3 state boundaries via geoBoundaries (CC BY 4.0)
//   data/raw/rivers/, lakes/    Natural Earth 10m (public domain)
//
// Outputs:
//   public/geo/lgas.json        all 774 LGAs, simplified, props { id, name, state }
//   public/geo/base.json        state lines, national outline, rivers, lakes (prop `kind`)
//   public/geo/labels.json      label points: geopolitical zones, states, LGAs (prop `kind`)
//   src/data/lgas.json          LGA index { id, name, state, stateId, point } for data checks

import { mkdir, writeFile } from 'node:fs/promises';
import mapshaper from 'mapshaper';

const RAW = 'data/raw';
const PRECISION = 0.0005; // about 55 m, finer than any LGA edge needs at national zoom

// The six geopolitical zones, used for overview labels.
const ZONES = {
	'North Central': ['Benue', 'Kogi', 'Kwara', 'Nasarawa', 'Niger', 'Plateau', 'Federal Capital Territory'],
	'North East': ['Adamawa', 'Bauchi', 'Borno', 'Gombe', 'Taraba', 'Yobe'],
	'North West': ['Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Sokoto', 'Zamfara'],
	'South East': ['Abia', 'Anambra', 'Ebonyi', 'Enugu', 'Imo'],
	'South South': ['Akwa Ibom', 'Bayelsa', 'Cross River', 'Delta', 'Edo', 'Rivers'],
	'South West': ['Ekiti', 'Lagos', 'Ogun', 'Ondo', 'Osun', 'Oyo'],
};
const zoneOf = Object.fromEntries(Object.entries(ZONES).flatMap(([zone, states]) => states.map((st) => [st, zone])));

const STATE_NAMES = {
	'Abuja Federal Capital Territory': 'Federal Capital Territory',
};

function slug(text) {
	return text
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

function stateId(state) {
	return state === 'Federal Capital Territory' ? 'fct' : slug(state);
}

async function run(commands, inputs = {}) {
	const out = await mapshaper.applyCommands(commands, inputs);
	return Object.fromEntries(Object.entries(out).map(([name, buf]) => [name, JSON.parse(String(buf))]));
}

// 1. LGAs with their state (largest overlap), simplified with shared topology.
const lgaOut = await run(
	`-i ${RAW}/nga-adm2.geojson name=lgas ` +
		`-join ${RAW}/nga-adm1.geojson fields=shapeName largest-overlap prefix=state_ ` +
		`-simplify 20% keep-shapes ` +
		`-o lgas.json format=geojson precision=${PRECISION}`,
);
const lgas = lgaOut['lgas.json'];

const seen = new Set();
for (const feature of lgas.features) {
	const p = feature.properties;
	const state = STATE_NAMES[p.state_shapeName] ?? p.state_shapeName;
	const id = `${stateId(state)}-${slug(p.shapeName)}`;
	if (seen.has(id)) throw new Error(`Duplicate LGA id ${id}`);
	seen.add(id);
	if (!zoneOf[state]) throw new Error(`No zone for state ${state}`);
	feature.properties = { id, name: p.shapeName, state, zone: zoneOf[state] };
}
if (lgas.features.length !== 774) throw new Error(`Expected 774 LGAs, got ${lgas.features.length}`);

// 2. Everything else is derived from the simplified LGAs so edges line up exactly.
const derived = await run(
	`-i lgas.json name=lgas ` +
		`-dissolve state + name=states ` +
		`-innerlines + name=state_lines ` +
		`-target lgas -dissolve + name=outline ` +
		`-target lgas -points inner + name=points ` +
		`-target states -points inner + name=state_points ` +
		`-target lgas -dissolve zone + name=zones ` +
		`-target zones -points inner + name=zone_points ` +
		`-i ${RAW}/rivers/ne_10m_rivers_lake_centerlines.shp name=rivers ` +
		`-clip target=rivers outline ` +
		`-filter-fields target=rivers name,scalerank ` +
		`-i ${RAW}/lakes/ne_10m_lakes.shp name=lakes ` +
		`-clip target=lakes outline ` +
		`-filter-fields target=lakes name ` +
		`-target outline -lines + name=outline_line ` +
		`-o target=state_lines,outline_line,rivers,lakes,points,state_points,zone_points format=geojson geojson-type=FeatureCollection precision=${PRECISION}`,
	{ 'lgas.json': lgas },
);

const kinds = { state_lines: 'state-line', outline_line: 'outline', rivers: 'river', lakes: 'lake' };
const base = { type: 'FeatureCollection', features: [] };
for (const [layer, kind] of Object.entries(kinds)) {
	for (const feature of derived[`${layer}.json`].features) {
		const name = feature.properties?.name;
		feature.properties = { kind, ...(name ? { name } : {}) };
		base.features.push(feature);
	}
}

const index = derived['points.json'].features
	.map((f) => ({
		id: f.properties.id,
		name: f.properties.name,
		state: f.properties.state,
		stateId: stateId(f.properties.state),
		point: f.geometry.coordinates.map((n) => Math.round(n * 10000) / 10000),
	}))
	.sort((a, b) => a.id.localeCompare(b.id));

// The highlight layer copies LGA features, so keep only what it needs.
for (const feature of lgas.features) delete feature.properties.zone;

const round = (n) => Math.round(n * 1000) / 1000;
const label = (kind, name, coords) => ({
	type: 'Feature',
	properties: { kind, name },
	geometry: { type: 'Point', coordinates: coords.map(round) },
});
const labels = {
	type: 'FeatureCollection',
	features: [
		...derived['zone_points.json'].features.map((f) => label('zone', f.properties.zone, f.geometry.coordinates)),
		...derived['state_points.json'].features.map((f) =>
			label('state', f.properties.state === 'Federal Capital Territory' ? 'FCT' : f.properties.state, f.geometry.coordinates),
		),
		...index.map((l) => label('lga', l.name, l.point)),
	],
};

await mkdir('public/geo', { recursive: true });
await mkdir('src/data', { recursive: true });
await writeFile('public/geo/lgas.json', JSON.stringify(lgas));
await writeFile('public/geo/base.json', JSON.stringify(base));
await writeFile('public/geo/labels.json', JSON.stringify(labels));
await writeFile('src/data/lgas.json', JSON.stringify(index, null, '\t') + '\n');

console.log(`LGAs: ${lgas.features.length}, base features: ${base.features.length}, index: ${index.length}`);
