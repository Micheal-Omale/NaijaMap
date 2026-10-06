// Map layers for the Then view (history). They all start hidden; MapView shows
// them in Then mode and hides the Today layers.
//
// Territory, lines and points fade with feature state `o` (0 to 1), which MapView
// animates when the year moves to a new snapshot. Feature state `dim` fades
// every polity but the selected one.

import type { StyleSpecification } from 'maplibre-gl';
import type { MapColors } from './style';

type Layer = StyleSpecification['layers'][number];

/** Layers drawn only in the Then view. */
export const THEN_ONLY = [
	'region-land',
	'region-lake',
	'region-river',
	'region-border',
	'hist-influence',
	'hist-influence-hatch',
	'hist-network',
	'hist-core',
	'outline-then',
	'hist-glow',
	'hist-edge',
	'hist-edge-disputed',
	'hist-influence-edge',
	'hist-link-tribute',
	'hist-link-trade',
	'hist-link-war',
	'hist-link-ritual',
	'hist-target',
	'hist-node',
	'hist-capital-ring',
	'hist-capital',
	'hist-seat',
	'hist-place-label',
	'hist-target-label',
	'hist-seat-label',
	'hist-name',
];

/** Layers hidden in the Then view (the ethnic atlas and today's admin labels). */
export const TODAY_ONLY = [
	'atlas-fill',
	'atlas-shared',
	'atlas-mix',
	'hl-fill',
	'hl-hatch',
	'lga-line',
	'hl-line',
	'outline',
	'lga-label',
	'state-label',
	'zone-label',
	'atlas-label',
	'atlas-community',
	'atlas-community-label',
	'village',
	'community-halo',
	'community',
	'community-label',
	'village-label',
];

/** Symbol layers, filtered to the year's snapshots: a hidden symbol would still block others. */
export const HIST_SYMBOLS = ['hist-place-label', 'hist-target-label', 'hist-seat-label', 'hist-name'];

// Expressions are typed loosely: the style spec's own types do not model nested expressions well.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Expr = any;

function seen(base: number): Expr {
	return ['*', base, ['coalesce', ['feature-state', 'o'], 0], ['case', ['boolean', ['feature-state', 'dim'], false], 0.25, 1]];
}

const hidden = { visibility: 'none' } as const;
const points = (...kinds: string[]): Expr => ['in', ['get', 'kind'], ['literal', kinds]];

export function regionLayers(c: MapColors): Layer[] {
	return [
		{ id: 'region-land', type: 'fill', source: 'region', filter: ['==', ['get', 'kind'], 'land'], layout: hidden, paint: { 'fill-color': c.regionLand } },
		{ id: 'region-lake', type: 'fill', source: 'region', filter: ['==', ['get', 'kind'], 'lake'], layout: hidden, paint: { 'fill-color': c.lake } },
		{
			id: 'region-river',
			type: 'line',
			source: 'region',
			filter: ['==', ['get', 'kind'], 'river'],
			layout: { ...hidden, 'line-cap': 'round', 'line-join': 'round' },
			paint: { 'line-color': c.water, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 9, 2.4] },
		},
		{
			id: 'region-border',
			type: 'line',
			source: 'region',
			filter: ['==', ['get', 'kind'], 'border'],
			layout: hidden,
			paint: { 'line-color': c.regionBorder, 'line-width': 0.8, 'line-dasharray': [3, 2] },
		},
	];
}

export function historyFillLayers(): Layer[] {
	const influence: Expr = ['==', ['get', 'layer'], 'influence'];
	return [
		// Influence: a light wash of the polity's ink, hatched. A ritual or trade network is dotted instead.
		{ id: 'hist-influence', type: 'fill', source: 'hist-shapes', filter: influence, layout: hidden, paint: { 'fill-color': ['get', 'color'], 'fill-opacity': seen(0.16) } },
		{
			id: 'hist-influence-hatch',
			type: 'fill',
			source: 'hist-shapes',
			filter: ['all', influence, ['!', ['get', 'network']]],
			layout: hidden,
			paint: { 'fill-pattern': 'hist-hatch', 'fill-opacity': seen(0.75) },
		},
		{
			id: 'hist-network',
			type: 'fill',
			source: 'hist-shapes',
			filter: ['all', influence, ['get', 'network']],
			layout: hidden,
			paint: { 'fill-pattern': 'hist-dots', 'fill-opacity': seen(0.9) },
		},
		// Core: land under direct rule, a stronger wash.
		{ id: 'hist-core', type: 'fill', source: 'hist-shapes', filter: ['==', ['get', 'layer'], 'core'], layout: hidden, paint: { 'fill-color': ['get', 'color'], 'fill-opacity': seen(0.46) } },
	];
}

export function historyTopLayers(c: MapColors): Layer[] {
	const core: Expr = ['==', ['get', 'layer'], 'core'];
	const disputed: Expr = ['==', ['get', 'conf'], 'disputed'];
	const edgeWidth: Expr = ['interpolate', ['linear'], ['zoom'], 4, 1, 8, 2.2];
	const link = (kind: string, dash: number[] | undefined, width: number): Layer => ({
		id: `hist-link-${kind}`,
		type: 'line',
		source: 'hist-lines',
		filter: ['==', ['get', 'kind'], kind],
		layout: { ...hidden, 'line-cap': 'round', 'line-join': 'round' },
		paint: { 'line-color': ['get', 'color'], 'line-width': width, 'line-opacity': seen(0.9), ...(dash ? { 'line-dasharray': dash } : {}) },
	});
	return [
		// A soft band inside each edge, so territory fades at its border like a hand-tinted map.
		{
			id: 'hist-glow',
			type: 'line',
			source: 'hist-shapes',
			filter: core,
			layout: hidden,
			paint: { 'line-color': ['get', 'color'], 'line-width': 9, 'line-blur': 8, 'line-offset': 3, 'line-opacity': seen(0.4) },
		},
		{
			id: 'hist-edge',
			type: 'line',
			source: 'hist-shapes',
			filter: ['all', core, ['!', disputed]],
			layout: { ...hidden, 'line-join': 'round' },
			paint: { 'line-color': ['get', 'color'], 'line-width': edgeWidth, 'line-opacity': seen(0.95) },
		},
		{
			// A disputed edge is dashed, so uncertainty shows without colour.
			id: 'hist-edge-disputed',
			type: 'line',
			source: 'hist-shapes',
			filter: ['all', core, disputed],
			layout: { ...hidden, 'line-join': 'round' },
			paint: { 'line-color': ['get', 'color'], 'line-width': edgeWidth, 'line-dasharray': [2, 1.6], 'line-opacity': seen(0.95) },
		},
		{
			id: 'hist-influence-edge',
			type: 'line',
			source: 'hist-shapes',
			filter: ['==', ['get', 'layer'], 'influence'],
			layout: { ...hidden, 'line-join': 'round' },
			paint: { 'line-color': ['get', 'color'], 'line-width': 1, 'line-dasharray': [1, 2.2], 'line-opacity': seen(0.75) },
		},
		link('tribute', [3, 2], 1.6),
		link('trade', [0.2, 2], 2),
		link('war', undefined, 1.6),
		link('ritual', [5, 2, 1, 2], 1.4),
		{
			id: 'hist-target',
			type: 'circle',
			source: 'hist-points',
			filter: points('target'),
			layout: hidden,
			paint: { 'circle-radius': 3, 'circle-color': c.inkHalo, 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 1.5, 'circle-opacity': seen(1), 'circle-stroke-opacity': seen(1) },
		},
		{
			id: 'hist-node',
			type: 'circle',
			source: 'hist-points',
			filter: points('node'),
			layout: hidden,
			paint: { 'circle-radius': 3.2, 'circle-color': ['get', 'color'], 'circle-stroke-color': c.inkHalo, 'circle-stroke-width': 1.2, 'circle-opacity': seen(1), 'circle-stroke-opacity': seen(1) },
		},
		// A capital: a dot in a ring, the old map sign for a seat of rule.
		{
			id: 'hist-capital-ring',
			type: 'circle',
			source: 'hist-points',
			filter: points('capital'),
			layout: hidden,
			paint: {
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 5.5, 9, 9],
				'circle-color': c.inkHalo,
				'circle-opacity': seen(0.9),
				'circle-stroke-color': ['get', 'color'],
				'circle-stroke-width': 1.4,
				'circle-stroke-opacity': seen(1),
			},
		},
		{
			id: 'hist-capital',
			type: 'circle',
			source: 'hist-points',
			filter: points('capital'),
			layout: hidden,
			paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.6, 9, 4.2], 'circle-color': ['get', 'color'], 'circle-opacity': seen(1) },
		},
		{
			id: 'hist-seat',
			type: 'circle',
			source: 'hist-points',
			filter: points('seat'),
			layout: hidden,
			paint: {
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4.5, 9, 7],
				'circle-color': ['get', 'color'],
				'circle-stroke-color': c.inkHalo,
				'circle-stroke-width': 2,
				'circle-opacity': seen(1),
				'circle-stroke-opacity': seen(1),
			},
		},
		{
			id: 'hist-place-label',
			type: 'symbol',
			source: 'hist-points',
			filter: points('capital', 'node'),
			minzoom: 5.2,
			layout: {
				...hidden,
				'text-field': ['get', 'name'],
				'text-font': ['Noto Sans Regular'],
				'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10.5, 9, 13],
				'text-anchor': 'left',
				'text-offset': [0.9, 0],
				'text-max-width': 9,
				'text-optional': true,
				'symbol-sort-key': ['match', ['get', 'kind'], 'capital', 0, 1],
			},
			paint: { 'text-color': c.labelStrong, 'text-halo-color': c.inkHalo, 'text-halo-width': 1.6, 'text-opacity': seen(1) },
		},
		{
			id: 'hist-target-label',
			type: 'symbol',
			source: 'hist-points',
			filter: points('target'),
			layout: {
				...hidden,
				'text-field': ['get', 'name'],
				'text-font': ['Noto Sans Regular'],
				'text-size': 11,
				'text-anchor': 'top',
				'text-offset': [0, 0.6],
				'text-max-width': 10,
				'text-optional': true,
			},
			paint: { 'text-color': c.label, 'text-halo-color': c.inkHalo, 'text-halo-width': 1.6, 'text-opacity': seen(1) },
		},
		{
			id: 'hist-seat-label',
			type: 'symbol',
			source: 'hist-points',
			filter: points('seat'),
			layout: {
				...hidden,
				'text-field': ['format', ['get', 'title'], { 'text-font': ['literal', ['Noto Sans Bold']] }, '\n', {}, ['get', 'name'], { 'font-scale': 0.85 }],
				'text-font': ['Noto Sans Regular'],
				'text-size': 11.5,
				'text-anchor': 'left',
				'text-offset': [1, 0],
				'text-max-width': 12,
				'text-justify': 'left',
				'text-optional': true,
			},
			paint: { 'text-color': c.labelStrong, 'text-halo-color': c.inkHalo, 'text-halo-width': 1.6, 'text-opacity': seen(1) },
		},
		{
			// Polity names in spaced capitals, in the polity's own ink, as on old maps.
			id: 'hist-name',
			type: 'symbol',
			source: 'hist-points',
			filter: points('name'),
			layout: {
				...hidden,
				'text-field': ['upcase', ['get', 'name']],
				'text-font': ['Noto Sans Bold'],
				'text-size': ['interpolate', ['linear'], ['zoom'], 4, ['+', 9, ['*', 3, ['get', 'weight']]], 8, ['+', 13, ['*', 5, ['get', 'weight']]]],
				'text-letter-spacing': 0.22,
				'text-max-width': 7,
				'text-padding': 2,
				'symbol-sort-key': ['-', 1, ['get', 'weight']],
			},
			paint: { 'text-color': ['get', 'color'], 'text-halo-color': c.inkHalo, 'text-halo-width': 2, 'text-opacity': seen(1) },
		},
	];
}
