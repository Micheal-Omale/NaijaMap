import type { StyleSpecification } from 'maplibre-gl';

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
	};
}

export const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * Layers, bottom to top: land (every LGA), the selected group's areas (solid
 * for homeland, hatched for shared and smaller presence, so colour is never
 * the only cue), LGA lines, rivers and lakes, state lines, outline, enclave
 * points. No external tiles or fonts: everything comes from /geo.
 */
export function buildStyle(c: MapColors, lgas: GeoJSON.FeatureCollection, base: GeoJSON.FeatureCollection): StyleSpecification {
	return {
		version: 8,
		sources: {
			lgas: { type: 'geojson', data: lgas, promoteId: 'id' },
			base: { type: 'geojson', data: base },
			highlight: { type: 'geojson', data: EMPTY },
			enclaves: { type: 'geojson', data: EMPTY },
		},
		layers: [
			{ id: 'bg', type: 'background', paint: { 'background-color': c.bg } },
			{
				id: 'land',
				type: 'fill',
				source: 'lgas',
				paint: {
					'fill-color': ['case', ['boolean', ['feature-state', 'hover'], false], c.landHover, c.land],
				},
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
			{
				id: 'lga-line',
				type: 'line',
				source: 'lgas',
				paint: {
					'line-color': c.lgaLine,
					'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.4, 9, 1.2],
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
				paint: {
					'line-color': c.highlight,
					'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1, 9, 2],
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
				id: 'enclave-halo',
				type: 'circle',
				source: 'enclaves',
				paint: {
					'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 9, 9, 14],
					'circle-color': c.highlight,
					'circle-opacity': 0.25,
				},
			},
			{
				id: 'enclave',
				type: 'circle',
				source: 'enclaves',
				paint: {
					'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4.5, 9, 7],
					'circle-color': c.highlight,
					'circle-stroke-color': c.surface,
					'circle-stroke-width': 2,
				},
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
