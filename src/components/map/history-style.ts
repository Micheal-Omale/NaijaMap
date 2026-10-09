// Map layers for the Then view (history). They all start hidden; MapView shows
// them in Then mode and hides the Today layers.
//
// Territory, lines and points fade with feature state `o` (0 to 1), which MapView
// animates when the year moves to a new snapshot. Feature state `dim` fades
// every polity but the selected one.

import type { StyleSpecification } from 'maplibre-gl';
import { COLONIAL_INK } from '../../lib/ink';
import type { RouteKind } from '../../lib/types';
import { ROUTES } from './glyphs';
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
	'hist-campaign',
	'hist-campaign-edge',
	'outline-then',
	'hist-glow',
	'hist-edge',
	'hist-edge-disputed',
	'hist-influence-edge',
	'hist-link-tribute',
	'hist-link-trade',
	'hist-link-war',
	'hist-link-ritual',
	'hist-link-descent',
	'hist-target',
	'hist-node',
	'hist-capital-ring',
	'hist-capital',
	'hist-seat',
	'hist-town-thread',
	'hist-town-ring',
	'hist-town',
	'hist-town-label',
	'hist-throne',
	'hist-people',
	'hist-place-label',
	'hist-target-label',
	'hist-seat-label',
	'hist-name',
	'story-edge-glow',
	'story-edge',
	'ev-piece-fill',
	'ev-piece-hatch',
	'ev-piece-edge',
	'ev-route-casing',
	...(Object.keys(ROUTES) as RouteKind[]).map((k) => `ev-route-${k}`),
	'ev-route-alliance-core',
	'ev-mover',
	'ev-ship',
	'ev-head',
	'ev-ripple',
	'beckon',
	'ev-site-head',
	'ev-site',
	'ev-site-label',
	'ev-piece-label',
	'hist-link-hit',
	'ev-route-hit',
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
export const HIST_SYMBOLS = ['hist-throne', 'hist-town', 'hist-town-label', 'hist-people', 'hist-place-label', 'hist-target-label', 'hist-seat-label', 'hist-name', 'ev-head', 'ev-site', 'ev-site-head', 'ev-site-label', 'ev-piece-label'];

/** Below this zoom, the moments of one place stack under a single mark; above it, they fan out. */
export const FAN_ZOOM = 6.5;

/** Layers the mouse and the finger can find, most specific first. */
export const HIT_LAYERS = ['hist-throne', 'hist-town', 'ev-site', 'ev-site-head', 'ev-ship', 'hist-target', 'ev-route-hit', 'hist-link-hit', 'hist-capital-ring', 'hist-node', 'hist-seat', 'hist-people', 'ev-piece-fill', 'hist-core', 'hist-influence'];

// Expressions are typed loosely: the style spec's own types do not model nested expressions well.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Expr = any;

function seen(base: number): Expr {
	return ['*', base, ['coalesce', ['feature-state', 'o'], 0], ['coalesce', ['feature-state', 'dim'], 1]];
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
		// Campaign: land an army marched into, cross-hatched in the polity's ink like a battle map.
		{
			id: 'hist-campaign',
			type: 'fill',
			source: 'hist-shapes',
			filter: ['==', ['get', 'layer'], 'campaign'],
			layout: hidden,
			paint: { 'fill-pattern': 'hist-war', 'fill-opacity': seen(0.95) },
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
		// The frontier of a story chapter, drawn by MapView as if by pen (a line gradient along each ring).
		{
			id: 'story-edge-glow',
			type: 'line',
			source: 'story-edge',
			filter: ['==', ['get', 'k'], 'edge'],
			layout: { ...hidden, 'line-join': 'round', 'line-cap': 'round' },
			paint: { 'line-color': '#000', 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 6, 8, 12], 'line-blur': 6, 'line-opacity': 0.45 },
		},
		{
			id: 'story-edge',
			type: 'line',
			source: 'story-edge',
			layout: { ...hidden, 'line-join': 'round', 'line-cap': 'round' },
			// Frontiers are drawn bold; a war line a little lighter; tribute and descent threads fine.
			paint: {
				'line-color': '#000',
				'line-width': ['interpolate', ['linear'], ['zoom'], 4, ['match', ['get', 'k'], 'edge', 2, 'war', 2.2, 1.1], 8, ['match', ['get', 'k'], 'edge', 3.6, 'war', 3.2, 1.8]],
			},
		},
		{
			id: 'hist-campaign-edge',
			type: 'line',
			source: 'hist-shapes',
			filter: ['==', ['get', 'layer'], 'campaign'],
			layout: { ...hidden, 'line-join': 'round' },
			paint: { 'line-color': ['get', 'color'], 'line-width': 1.6, 'line-dasharray': [4, 2, 1, 2], 'line-opacity': seen(0.9) },
		},
		link('tribute', [3, 2], 1.6),
		link('trade', [0.2, 2], 2),
		link('war', undefined, 1.6),
		link('ritual', [5, 2, 1, 2], 1.4),
		// Descent: a fine dotted thread to towns that trace their founders here.
		link('descent', [0.6, 1.8], 1.1),
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
		// Towns founded by several peoples, or held by a state: the threads back to each founder's
		// home (drawn when the town is pointed at), a ring in the ink of the state it is under,
		// and a dot split among its founding peoples.
		{
			id: 'hist-town-thread',
			type: 'line',
			source: 'town-threads',
			layout: { ...hidden, 'line-cap': 'round', 'line-join': 'round' },
			paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.4, 9, 2.4], 'line-dasharray': [0.6, 1.8], 'line-opacity': 0.95 },
		},
		{
			id: 'hist-town-ring',
			type: 'circle',
			source: 'hist-towns',
			layout: hidden,
			paint: {
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 5.5, 9, 9],
				'circle-color': c.inkHalo,
				'circle-opacity': seen(0.85),
				'circle-stroke-color': ['get', 'ring'],
				'circle-stroke-width': ['case', ['get', 'held'], 2.2, 1],
				'circle-stroke-opacity': seen(1),
			},
		},
		{
			id: 'hist-town',
			type: 'symbol',
			source: 'hist-towns',
			layout: {
				...hidden,
				'icon-image': ['get', 'icon'],
				'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.55, 9, 0.9],
				'icon-allow-overlap': true,
				'icon-ignore-placement': true,
			},
			paint: { 'icon-opacity': seen(1) },
		},
		{
			id: 'hist-town-label',
			type: 'symbol',
			source: 'hist-towns',
			minzoom: 5.6,
			layout: {
				...hidden,
				'text-field': ['get', 'name'],
				'text-font': ['Noto Sans Regular'],
				'text-size': ['interpolate', ['linear'], ['zoom'], 5.6, 10.5, 9, 13],
				'text-anchor': 'left',
				'text-offset': [1.1, 0],
				'text-optional': true,
			},
			paint: { 'text-color': c.labelStrong, 'text-halo-color': c.inkHalo, 'text-halo-width': 1.6, 'text-opacity': seen(1) },
		},
		// Thrones the colonial government made, restored or filled: a scarlet crown, with its title.
		{
			id: 'hist-throne',
			type: 'symbol',
			source: 'hist-points',
			filter: points('throne'),
			layout: {
				...hidden,
				'icon-image': ['get', 'icon'],
				'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 9, 0.95],
				'icon-allow-overlap': true,
				'icon-ignore-placement': true,
				'text-field': ['get', 'name'],
				'text-font': ['Noto Sans Regular'],
				'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 9, 12.5],
				'text-anchor': 'left',
				'text-offset': [1.2, 0],
				'text-max-width': 9,
				'text-optional': true,
			},
			paint: { 'icon-opacity': seen(1), 'text-color': COLONIAL_INK, 'text-halo-color': c.inkHalo, 'text-halo-width': 1.6, 'text-opacity': seen(1) },
		},
		{
			// Peoples who governed themselves, written in the open land in plain sepia, as old maps
			// named the peoples between the kingdoms. Lowest of the names, so a state's name wins a clash.
			id: 'hist-people',
			type: 'symbol',
			source: 'hist-points',
			filter: points('people'),
			layout: {
				...hidden,
				'text-field': ['get', 'name'],
				'text-font': ['Noto Sans Regular'],
				'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9.5, 8, 13.5],
				'text-letter-spacing': 0.16,
				'text-max-width': 8,
				'text-padding': 3,
			},
			paint: { 'text-color': c.label, 'text-halo-color': c.inkHalo, 'text-halo-width': 1.6, 'text-opacity': seen(0.92) },
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

/**
 * The parts of a partitioned kingdom: a tint and a hatch of their own, under a
 * scarlet fracture line. They sit over the old territory and drift apart when
 * they appear (history-map moves them).
 */
export function eventFillLayers(): Layer[] {
	return [
		{ id: 'ev-piece-fill', type: 'fill', source: 'ev-pieces', layout: hidden, paint: { 'fill-color': ['get', 'color'], 'fill-opacity': seen(0.22) } },
		{
			id: 'ev-piece-hatch',
			type: 'fill',
			source: 'ev-pieces',
			layout: hidden,
			paint: { 'fill-pattern': ['concat', 'piece-', ['to-string', ['get', 'i']]], 'fill-opacity': seen(0.9) },
		},
	];
}

/** Routes, arrowheads, marks and their labels, over everything else in the Then view. */
export function eventTopLayers(c: MapColors): Layer[] {
	const route = (kind: RouteKind): Layer => {
		const st = ROUTES[kind];
		return {
			id: `ev-route-${kind}`,
			type: 'line',
			source: 'ev-routes',
			filter: ['==', ['get', 'kind'], kind],
			layout: { ...hidden, 'line-cap': 'round', 'line-join': 'round' },
			paint: {
				'line-color': ['get', 'color'],
				'line-width': ['interpolate', ['linear'], ['zoom'], 4, st.width * 0.8, 9, st.width * 1.4],
				'line-opacity': seen(0.95),
				...(st.dash ? { 'line-dasharray': st.dash } : {}),
			},
		};
	};
	const markSize: Expr = ['interpolate', ['linear'], ['zoom'], 4, 0.6, 7, 0.82, 10, 1];
	return [
		{
			id: 'ev-piece-edge',
			type: 'line',
			source: 'ev-pieces',
			layout: { ...hidden, 'line-join': 'round' },
			paint: { 'line-color': COLONIAL_INK, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.2, 8, 2.2], 'line-dasharray': [2.6, 1.3], 'line-opacity': seen(0.95) },
		},
		// A pale casing under every route but the alliance rail, so lines read over any wash.
		{
			id: 'ev-route-casing',
			type: 'line',
			source: 'ev-routes',
			filter: ['!=', ['get', 'kind'], 'alliance'],
			layout: { ...hidden, 'line-cap': 'round', 'line-join': 'round' },
			paint: { 'line-color': c.inkHalo, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 4.4, 9, 6.6], 'line-opacity': seen(0.7) },
		},
		...(Object.keys(ROUTES) as RouteKind[]).map(route),
		// An alliance is a rail: two lines of the ally's ink with paper between them.
		{
			id: 'ev-route-alliance-core',
			type: 'line',
			source: 'ev-routes',
			filter: ['==', ['get', 'kind'], 'alliance'],
			layout: { ...hidden, 'line-cap': 'round', 'line-join': 'round' },
			paint: { 'line-color': c.inkHalo, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.4, 9, 2.6], 'line-opacity': seen(1) },
		},
		// Travellers on a migration route: dots that keep walking while it is on the map.
		{
			id: 'ev-mover',
			type: 'circle',
			source: 'ev-movers',
			layout: hidden,
			paint: {
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.4, 9, 3.6],
				'circle-color': ['get', 'color'],
				'circle-stroke-color': c.inkHalo,
				'circle-stroke-width': 1.2,
				'circle-opacity': ['get', 'a'],
				'circle-stroke-opacity': ['get', 'a'],
			},
		},
		// Ships on a voyage: side-on, facing the way they sail, rocking a little on the swell.
		{
			id: 'ev-ship',
			type: 'symbol',
			source: 'ev-ships',
			layout: {
				...hidden,
				'icon-image': ['get', 'icon'],
				'icon-rotate': ['get', 'rock'],
				'icon-rotation-alignment': 'viewport',
				'icon-anchor': 'bottom',
				'icon-offset': [0, 6],
				// The image is 48×36 at size 1: about 29 px long at the overview, 38 px at zoom 7.
				'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 7, 0.8, 10, 1],
				'icon-allow-overlap': true,
				'icon-ignore-placement': true,
			},
			paint: { 'icon-opacity': ['get', 'a'] },
		},
		{
			id: 'ev-head',
			type: 'symbol',
			source: 'ev-heads',
			layout: {
				...hidden,
				'icon-image': ['get', 'icon'],
				'icon-rotate': ['get', 'bearing'],
				'icon-rotation-alignment': 'map',
				'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 9, 0.8],
				'icon-allow-overlap': true,
				'icon-ignore-placement': true,
			},
			paint: { 'icon-opacity': seen(1) },
		},
		// Rings beckoning the visitor to point at the dots, until they have.
		{
			id: 'beckon',
			type: 'circle',
			source: 'beckon',
			layout: hidden,
			paint: {
				'circle-radius': ['get', 'r'],
				'circle-color': 'rgba(0,0,0,0)',
				'circle-stroke-color': c.highlight,
				'circle-stroke-width': 2,
				'circle-stroke-opacity': ['get', 'o'],
			},
		},
		// The ripple when a moment is stamped onto the map.
		{
			id: 'ev-ripple',
			type: 'circle',
			source: 'ev-sites',
			layout: hidden,
			paint: {
				'circle-radius': ['coalesce', ['feature-state', 'r'], 0],
				'circle-color': 'rgba(0,0,0,0)',
				'circle-stroke-color': ['get', 'ring'],
				'circle-stroke-width': 2,
				'circle-stroke-opacity': ['*', ['coalesce', ['feature-state', 'ro'], 0], ['coalesce', ['feature-state', 'dim'], 1]],
			},
		},
		// Zoomed out, each place shows one mark (its first moment) with a count of the rest.
		{
			id: 'ev-site-head',
			type: 'symbol',
			source: 'ev-sites',
			maxzoom: FAN_ZOOM,
			filter: ['==', ['get', 'n'], 0],
			layout: {
				...hidden,
				'icon-image': ['get', 'icon'],
				'icon-size': markSize,
				'icon-allow-overlap': true,
				'icon-ignore-placement': true,
				'symbol-sort-key': ['get', 'order'],
				'text-field': ['case', ['>', ['get', 'of'], 1], ['concat', '+', ['to-string', ['-', ['get', 'of'], 1]]], ''],
				'text-font': ['Noto Sans Bold'],
				'text-size': 9.5,
				'text-offset': [0.95, -0.85],
				'text-allow-overlap': true,
				'text-ignore-placement': true,
			},
			paint: { 'icon-opacity': seen(1), 'text-color': c.inkHalo, 'text-halo-color': c.labelStrong, 'text-halo-width': 3, 'text-opacity': seen(1) },
		},
		{
			id: 'ev-site',
			type: 'symbol',
			source: 'ev-sites',
			minzoom: FAN_ZOOM,
			layout: {
				...hidden,
				'icon-image': ['get', 'icon'],
				'icon-size': markSize,
				'icon-allow-overlap': true,
				'icon-ignore-placement': true,
				'symbol-sort-key': ['get', 'order'],
			},
			paint: { 'icon-opacity': seen(1) },
		},
		{
			id: 'ev-site-label',
			type: 'symbol',
			source: 'ev-sites',
			minzoom: FAN_ZOOM + 0.4,
			layout: {
				...hidden,
				'text-field': ['get', 'title'],
				'text-font': ['Noto Sans Regular'],
				'text-size': 11,
				'text-anchor': 'top',
				'text-offset': [0, 1.1],
				'text-max-width': 9,
				'text-optional': true,
			},
			paint: { 'text-color': c.labelStrong, 'text-halo-color': c.inkHalo, 'text-halo-width': 1.6, 'text-opacity': seen(1) },
		},
		{
			id: 'ev-piece-label',
			type: 'symbol',
			source: 'ev-labels',
			layout: {
				...hidden,
				'text-field': ['upcase', ['get', 'name']],
				'text-font': ['Noto Sans Bold'],
				'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 8, 12],
				'text-letter-spacing': 0.1,
				'text-max-width': 8,
				'text-padding': 4,
			},
			paint: { 'text-color': ['get', 'color'], 'text-halo-color': c.inkHalo, 'text-halo-width': 2, 'text-opacity': seen(1) },
		},
		// Wide, invisible twins of the thin lines, so a mouse or a finger can find them.
		{ id: 'hist-link-hit', type: 'line', source: 'hist-lines', layout: { ...hidden, 'line-cap': 'round' }, paint: { 'line-color': '#000', 'line-width': 16, 'line-opacity': 0 } },
		{ id: 'ev-route-hit', type: 'line', source: 'ev-routes', layout: { ...hidden, 'line-cap': 'round' }, paint: { 'line-color': '#000', 'line-width': 18, 'line-opacity': 0 } },
	];
}
