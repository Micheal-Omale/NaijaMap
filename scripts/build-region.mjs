// Builds the land around Nigeria for the history (Then) view, where empires
// such as Kanem-Bornu, Borgu and the Sokoto Caliphate reach past today's border.
//
//   npm run geo:region
//
// Inputs (Natural Earth, public domain):
//   data/raw/countries/ne_50m_admin_0_countries.shp
//   data/raw/rivers/, data/raw/lakes/   (10m, also used by build-geo.mjs)
//   public/geo/lgas.json                Nigeria, so its own rivers are not drawn twice
//
// Output:
//   public/geo/region.json   neighbouring land, borders, coast, rivers and lakes (prop `kind`)

import { readFile, writeFile } from 'node:fs/promises';
import mapshaper from 'mapshaper';

const RAW = 'data/raw';
// West to the Volta, east to Darfur, north to the Fezzan: the reach of the polities on the timeline.
const BBOX = '-2,1,24,28';

const lgas = JSON.parse(await readFile('public/geo/lgas.json', 'utf8'));

const out = await mapshaper.applyCommands(
	`-i lgas.json name=nigeria ` +
		`-dissolve + name=nigeria_outline ` +
		`-i ${RAW}/countries/ne_50m_admin_0_countries.shp name=countries ` +
		`-clip bbox=${BBOX} ` +
		`-filter 'ADM0_A3 !== "NGA"' ` +
		`-filter-fields NAME ` +
		`-rename-fields name=NAME ` +
		`-simplify 30% keep-shapes ` +
		`-innerlines + name=borders ` +
		`-target countries -lines + name=coast_all ` +
		`-i ${RAW}/rivers/ne_10m_rivers_lake_centerlines.shp name=rivers ` +
		`-clip bbox=${BBOX} ` +
		`-erase nigeria_outline ` +
		`-filter 'scalerank <= 7' ` +
		`-filter-fields name ` +
		`-simplify 30% ` +
		`-i ${RAW}/lakes/ne_10m_lakes.shp name=lakes ` +
		`-clip bbox=${BBOX} ` +
		`-erase nigeria_outline ` +
		`-filter-fields name ` +
		`-o target=countries,borders,rivers,lakes format=geojson geojson-type=FeatureCollection precision=0.001`,
	{ 'lgas.json': lgas },
);

const read = (name) => JSON.parse(String(out[`${name}.json`]));
const region = { type: 'FeatureCollection', features: [] };
for (const [layer, kind] of [
	['countries', 'land'],
	['borders', 'border'],
	['rivers', 'river'],
	['lakes', 'lake'],
]) {
	for (const f of read(layer).features) {
		const name = f.properties?.name;
		f.properties = { kind, ...(name ? { name } : {}) };
		region.features.push(f);
	}
}

await writeFile('public/geo/region.json', JSON.stringify(region));
console.log(`region features: ${region.features.length}`);
