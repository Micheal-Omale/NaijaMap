import type { StyleSpecification } from 'maplibre-gl';
import { historyFillLayers, historyTopLayers, regionLayers } from './history-style';

/** Map colours, read from the CSS tokens in src/styles/global.css. */
export interface MapColors {
	bg: string;
	land: string;
	landHover: string;
	lgaLine: string;
	stateLine: string;
	outline: string;
	water: string;
	lake: string;
	highlight: string;
	highlightSoft: string;
	ink: string;
	surface: string;
	label: string;
	labelStrong: string;
	labelHalo: string;
	regionLand: string;
	regionBorder: string;
	inkHalo: string;
}

export function readColors(el: Element = document.documentElement): MapColors {
	const css = getComputedStyle(el);
	const v = (name: string) => css.getPropertyValue(name).trim();
	return {
		bg: v('--map-bg'),
		land: v('--map-land'),
		landHover: v('--map-land-hover'),
		lgaLine: v('--map-lga-line'),
		stateLine: v('--map-state-line'),
		outline: v('--map-outline'),
		water: v('--map-water'),
		lake: v('--map-lake'),
		highlight: v('--highlight'),
		highlightSoft: v('--highlight-soft'),
		ink: v('--ink'),
		surface: v('--surface'),
		label: v('--map-label'),
		labelStrong: v('--map-label-strong'),
		labelHalo: v('--map-label-halo'),
		regionLand: v('--map-region-land'),
		regionBorder: v('--map-region-border'),
		inkHalo: v('--map-ink-halo'),
	};
}

export const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * Layers, bottom to top: land (every LGA), the selected group's areas (solid
 * for homeland, hatched for shared areas, dotted for a smaller presence, so
 * colour is never the only cue), LGA lines, rivers and lakes, state lines,
 * outline, then community points (large) and their villages (small). No external tiles or fonts: everything comes from /geo.
 */
const REGULAR = ['Noto Sans Regular'];
const BOLD = ['Noto Sans Bold'];

export function buildStyle(
	c: MapColors,
	lgas: GeoJSON.FeatureCollection,
	base: GeoJSON.FeatureCollection,
	labels: GeoJSON.FeatureCollection,
): StyleSpecification {
	return {
		version: 8,
		// Self hosted glyphs (public/fonts, OFL licence), so labels need no outside server.
		glyphs: `${location.origin}/fonts/{fontstack}/{range}.pbf`,
		sources: {
			lgas: { type: 'geojson', data: lgas, promoteId: 'id' },
			base: { type: 'geojson', data: base },
			highlight: { type: 'geojson', data: EMPTY },
			communities: { type: 'geojson', data: EMPTY },
			labels: { type: 'geojson', data: labels },
			atlas: { type: 'geojson', data: EMPTY },
			'atlas-labels': { type: 'geojson', data: EMPTY },
			'atlas-communities': { type: 'geojson', data: EMPTY },
			// The Then view: land around Nigeria, then polity territory, lines and places.
			region: { type: 'geojson', data: EMPTY },
			'hist-shapes': { type: 'geojson', data: EMPTY },
			'hist-lines': { type: 'geojson', data: EMPTY },
			'hist-points': { type: 'geojson', data: EMPTY },
		},
		layers: [
			{ id: 'bg', type: 'background', paint: { 'background-color': c.bg } },
			...regionLayers(c),
			{
				id: 'land',
				type: 'fill',
				source: 'lgas',
				paint: {
					'fill-color': ['case', ['boolean', ['feature-state', 'hover'], false], c.landHover, c.land],
				},
			},
			{
				id: 'atlas-fill',
				type: 'fill',
				source: 'atlas',
				paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.88 },
			},
			{
				id: 'atlas-shared',
				type: 'fill',
				source: 'atlas',
				filter: ['has', 'pattern'],
				paint: { 'fill-pattern': ['get', 'pattern'], 'fill-opacity': 0.92 },
			},
			{
				id: 'atlas-mix',
				type: 'fill',
				source: 'atlas',
				filter: ['==', ['get', 'mixed'], true],
				paint: { 'fill-pattern': 'mix' },
			},
			{
				id: 'hl-fill',
				type: 'fill',
				source: 'highlight',
				paint: {
					'fill-color': ['match', ['get', 'presence'], 'core', c.highlight, c.highlightSoft],
					'fill-opacity': ['match', ['get', 'presence'], 'minority', 0.45, 1],
				},
			},
			{
				id: 'hl-hatch',
				type: 'fill',
				source: 'highlight',
				filter: ['!=', ['get', 'presence'], 'core'],
				paint: { 'fill-pattern': ['match', ['get', 'presence'], 'significant', 'hatch', 'dots'] },
			},
			...historyFillLayers(),
			{
				id: 'lga-line',
				type: 'line',
				source: 'lgas',
				paint: {
					'line-color': c.lgaLine,
					'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.3, 6, 0.6, 9, 1.2],
				},
			},
			{
				id: 'lake',
				type: 'fill',
				source: 'base',
				filter: ['==', ['get', 'kind'], 'lake'],
				paint: { 'fill-color': c.lake },
			},
			{
				id: 'river',
				type: 'line',
				source: 'base',
				filter: ['==', ['get', 'kind'], 'river'],
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: {
					'line-color': c.water,
					'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.2, 9, 3],
				},
			},
			{
				id: 'hl-line',
				type: 'line',
				source: 'highlight',
				// Thin dark edges, so each highlighted LGA stays visible inside the orange.
				paint: {
					'line-color': c.ink,
					'line-opacity': 0.55,
					'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 9, 1.4],
				},
			},
			{
				id: 'state-line',
				type: 'line',
				source: 'base',
				filter: ['==', ['get', 'kind'], 'state-line'],
				layout: { 'line-join': 'round' },
				paint: {
					'line-color': c.stateLine,
					'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 9, 1.6],
				},
			},
			{
				id: 'outline',
				type: 'line',
				source: 'base',
				filter: ['==', ['get', 'kind'], 'outline'],
				layout: { 'line-join': 'round' },
				paint: { 'line-color': c.outline, 'line-width': 1.6 },
			},
			{
				// Today's border, faint and dashed under the old map: a reference, not a frontier of the time.
				id: 'outline-then',
				type: 'line',
				source: 'base',
				filter: ['==', ['get', 'kind'], 'outline'],
				layout: { 'line-join': 'round', visibility: 'none' },
				paint: { 'line-color': c.outline, 'line-width': 1, 'line-opacity': 0.55, 'line-dasharray': [4, 3] },
			},
			...historyTopLayers(c),
			{
				id: 'lga-selected',
				type: 'line',
				source: 'lgas',
				paint: {
					'line-color': c.ink,
					'line-width': 2.5,
					// Feature state cannot drive a filter, so unselected LGAs are drawn fully transparent.
					'line-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 1, 0],
				},
			},
			{
				id: 'lga-label',
				type: 'symbol',
				source: 'labels',
				filter: ['==', ['get', 'kind'], 'lga'],
				minzoom: 7.2,
				layout: {
					'text-field': ['get', 'name'],
					'text-font': REGULAR,
					'text-size': ['interpolate', ['linear'], ['zoom'], 7.2, 10, 10, 13],
					'text-max-width': 7,
					'text-padding': 3,
				},
				paint: { 'text-color': c.label, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.4 },
			},
			{
				id: 'state-label',
				type: 'symbol',
				source: 'labels',
				filter: ['==', ['get', 'kind'], 'state'],
				minzoom: 5,
				maxzoom: 8.6,
				layout: {
					'text-field': ['upcase', ['get', 'name']],
					'text-font': BOLD,
					'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9.5, 8, 13],
					'text-letter-spacing': 0.12,
					'text-max-width': 6,
					'symbol-sort-key': 1,
				},
				paint: { 'text-color': c.labelStrong, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.6 },
			},
			{
				id: 'zone-label',
				type: 'symbol',
				source: 'labels',
				filter: ['==', ['get', 'kind'], 'zone'],
				maxzoom: 5.4,
				layout: {
					'text-field': ['upcase', ['get', 'name']],
					'text-font': BOLD,
					'text-size': 12,
					'text-letter-spacing': 0.25,
					'text-max-width': 6,
				},
				paint: { 'text-color': c.labelStrong, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.6 },
			},
			{
				id: 'atlas-label',
				type: 'symbol',
				source: 'atlas-labels',
				maxzoom: 8.4,
				layout: {
					'text-field': ['get', 'name'],
					'text-font': BOLD,
					'text-size': ['interpolate', ['linear'], ['get', 'size'], 1, 10.5, 40, 13, 150, 16],
					'text-max-width': 8,
					'text-padding': 4,
					'symbol-sort-key': ['-', 0, ['get', 'size']],
				},
				paint: { 'text-color': c.ink, 'text-halo-color': c.labelHalo, 'text-halo-width': 2 },
			},
			{
				id: 'atlas-community',
				type: 'circle',
				source: 'atlas-communities',
				paint: {
					'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 9, 7],
					'circle-color': ['get', 'color'],
					'circle-stroke-color': c.surface,
					'circle-stroke-width': 1.8,
				},
			},
			{
				id: 'atlas-community-label',
				type: 'symbol',
				source: 'atlas-communities',
				minzoom: 6.8,
				layout: {
					'text-field': ['get', 'label'],
					'text-font': REGULAR,
					'text-size': 11,
					'text-anchor': 'left',
					'text-offset': [0.8, 0],
					'text-optional': true,
				},
				paint: { 'text-color': c.ink, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.6 },
			},
			{
				id: 'village',
				type: 'circle',
				source: 'communities',
				filter: ['==', ['get', 'kind'], 'village'],
				minzoom: 6.5,
				paint: {
					'circle-radius': ['interpolate', ['linear'], ['zoom'], 6.5, 2.5, 10, 4.5],
					'circle-color': c.surface,
					'circle-stroke-color': c.ink,
					'circle-stroke-width': 1.2,
				},
			},
			{
				id: 'community-halo',
				type: 'circle',
				source: 'communities',
				filter: ['==', ['get', 'kind'], 'community'],
				paint: {
					// A light ring so the dot reads on top of the orange areas too.
					'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 7.5, 9, 11],
					'circle-color': c.surface,
					'circle-opacity': 0.9,
				},
			},
			{
				id: 'community',
				type: 'circle',
				source: 'communities',
				filter: ['==', ['get', 'kind'], 'community'],
				paint: {
					'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4.5, 9, 7],
					'circle-color': c.highlight,
					'circle-stroke-color': c.ink,
					'circle-stroke-width': 1.5,
				},
			},
			{
				id: 'community-label',
				type: 'symbol',
				source: 'communities',
				filter: ['==', ['get', 'kind'], 'community'],
				minzoom: 6.4,
				layout: {
					'text-field': ['get', 'name'],
					'text-font': BOLD,
					'text-size': 12,
					'text-anchor': 'left',
					'text-offset': [0.9, 0],
					'text-max-width': 9,
					'text-optional': true,
				},
				paint: { 'text-color': c.ink, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.8 },
			},
			{
				id: 'village-label',
				type: 'symbol',
				source: 'communities',
				filter: ['==', ['get', 'kind'], 'village'],
				minzoom: 8.6,
				layout: {
					'text-field': ['get', 'name'],
					'text-font': REGULAR,
					'text-size': 11,
					'text-anchor': 'left',
					'text-offset': [0.7, 0],
					'text-optional': true,
				},
				paint: { 'text-color': c.ink, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.5 },
			},
		],
	};
}

type Pattern = { width: number; height: number; data: Uint8ClampedArray };

/** Diagonal hatch in the highlight colour, drawn into an image MapLibre can tile. Marks shared areas. */
export function hatchImage(color: string, size = 8): Pattern {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext('2d')!;
	ctx.strokeStyle = color;
	ctx.lineWidth = 2;
	ctx.lineCap = 'square';
	ctx.beginPath();
	// Three strokes so the pattern joins seamlessly across tiles.
	for (const offset of [-size, 0, size]) {
		ctx.moveTo(offset, size);
		ctx.lineTo(offset + size, 0);
	}
	ctx.stroke();
	return { width: size, height: size, data: ctx.getImageData(0, 0, size, size).data };
}

/** Diagonal stripes in each group's colour, for an LGA shared by several groups. */
export function stripesImage(colors: string[]): Pattern {
	const band = 5;
	const size = band * colors.length * 2;
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext('2d')!;
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			ctx.fillStyle = colors[Math.floor(((x + y) % size) / band) % colors.length];
			ctx.fillRect(x, y, 1, 1);
		}
	}
	// Neighbouring shades of one family (Egbema and Ogba) would blur into one
	// colour, so close colours get a light hairline between bands.
	const rgb = colors.map((c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)));
	const close = rgb.some((a, i) => rgb.some((b, j) => j > i && a.reduce((s, v, k) => s + Math.abs(v - b[k]), 0) < 90));
	if (close) {
		ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) if ((x + y) % band === 0) ctx.fillRect(x, y, 1, 1);
		}
	}
	return { width: size, height: size, data: ctx.getImageData(0, 0, size, size).data };
}

/** Thin dark hatching laid over atlas colours where an LGA is shared by more than one group. */
export function mixImage(color: string, size = 10): Pattern {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext('2d')!;
	ctx.strokeStyle = color;
	ctx.globalAlpha = 0.45;
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	for (const offset of [-size, 0, size]) {
		ctx.moveTo(offset, 0);
		ctx.lineTo(offset + size, size);
	}
	ctx.stroke();
	return { width: size, height: size, data: ctx.getImageData(0, 0, size, size).data };
}

/** Sparse dots in the highlight colour. Marks a smaller presence. */
export function dotsImage(color: string, size = 8): Pattern {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = color;
	ctx.beginPath();
	for (const at of [size / 4, (size * 3) / 4]) {
		ctx.moveTo(at + 1.3, at);
		ctx.arc(at, at, 1.3, 0, Math.PI * 2);
	}
	ctx.fill();
	return { width: size, height: size, data: ctx.getImageData(0, 0, size, size).data };
}
