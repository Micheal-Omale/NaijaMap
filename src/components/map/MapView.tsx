import { useEffect, useRef } from 'react';
import {
	AttributionControl,
	Map as MapLibre,
	NavigationControl,
	setWorkerUrl,
	type GeoJSONSource,
	type LngLatBoundsLike,
	type PaddingOptions,
} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GroupView, History } from '../../lib/types';
import type { Atlas } from '../../lib/atlas';
import { DIM, HistoryOnMap, type MapItem } from './history-map';
import { PowerLayer } from './power-map';
import { THEN_ONLY, TODAY_ONLY } from './history-style';
import { EMPTY, POWER_ONLY, buildStyle, crossImage, dotsImage, hatchImage, mixImage, readColors, stripesImage } from './style';

setWorkerUrl(workerUrl);

export const NIGERIA: [[number, number], [number, number]] = [
	[2.67, 4.27],
	[14.68, 13.89],
];

/** The history view's opening frame: Nigeria with room for Kanem, Borgu and Adamawa beyond its borders. */
export const REGION: [[number, number], [number, number]] = [
	[1.6, 3.9],
	[15.6, 14.4],
];

export type Mode = 'today' | 'then' | 'power';

/** What the Power view draws: each region in the colours of the peoples who led it, and leaders' hometowns. */
export interface PowerMap {
	/** The period's id: a new key makes the period arrive with motion. */
	key: string;
	units: {
		id: string;
		name: string;
		lgas: string[];
		colors: string[];
		label?: [number, number];
		groups: string;
		dim: boolean;
		party?: { id: string; short: string; slot: number };
	}[];
	pins: { name: string; label: string; point: [number, number]; color: string }[];
	/** Coalitions as rails from the hub region to each partner. */
	coalitions: { id: string; name: string; years: string; links: [[number, number], [number, number]][]; dim: boolean; selected: boolean }[];
	/** Each leader's road from home to the seat of power. */
	roads: { from: [number, number]; to: [number, number]; color: string }[];
	capitals: { name: string; point: [number, number] }[];
	/** The coup being played: its moments stamped in order, its routes, the land it named. */
	coup?: {
		key: string;
		moments: { point: [number, number]; mark: string; title: string; when: string }[];
		routes: { path: [number, number][]; label: string }[];
		area: string[];
		areaPoint?: [number, number];
	};
}

export type FocusRequest =
	| { kind: 'group' }
	| { kind: 'lga'; id: string }
	| { kind: 'nigeria' }
	| { kind: 'region'; cinematic?: boolean }
	| { kind: 'polity'; id: string; year: number; cinematic?: boolean }
	/** Several places at once, for playback following the events of a year. */
	| { kind: 'bounds'; bounds: [number, number, number, number]; cinematic?: boolean }
	/** Everything one event draws. */
	| { kind: 'event'; id: string; cinematic?: boolean }
	/** One place, close enough to see what happened there, for a moment of an event. */
	| { kind: 'point'; point: [number, number]; cinematic?: boolean };

/**
 * Camera language for the history view. A cinematic move is slow and eased at
 * both ends, like a rostrum camera over a map; once it settles, the camera keeps
 * drifting a little closer (a Ken Burns push) until the visitor touches the map.
 */
const CAMERA = {
	quick: 900,
	cinematic: 2600,
	ease: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2), // power3.inOut
	drift: { zoom: 0.3, ms: 18000 },
};

interface Props {
	lgas: GeoJSON.FeatureCollection;
	base: GeoJSON.FeatureCollection;
	labels: GeoJSON.FeatureCollection;
	/** The default coloured view, shown when no group is selected. */
	atlas: Atlas;
	/** Every visible group, so the atlas can show each group's named communities. */
	groups: GroupView[];
	group: GroupView | null;
	selectedLga: string | null;
	/** A new object each time the view should move. */
	focus: FocusRequest;
	padding: PaddingOptions;
	label: string;
	attribution: string;
	onSelectLga: (id: string | null) => void;
	onSelectCommunity: (name: string, group?: string) => void;
	/** The LGA under the mouse, with its position on the map; null when the mouse leaves. */
	onHover: (hover: { id: string; x: number; y: number } | null) => void;
	mode: Mode;
	/** The history view's data, once loaded. */
	history: History | null;
	region: GeoJSON.FeatureCollection | null;
	year: number;
	polity: string | null;
	showStateLines: boolean;
	onSelectPolity: (id: string | null) => void;
	/** What is under the mouse in the history view, most specific first; null when the mouse leaves it all. */
	onHoverItems: (hover: { items: MapItem[]; x: number; y: number } | null) => void;
	/** A tap or click on something that can be explained (a line, a mark, a piece), or on nothing (null). */
	onPickItem: (pick: { item: MapItem; x: number; y: number } | null) => void;
	/** A town or throne whose card is pinned: its threads (to founders, to whoever crowned it) stay drawn. */
	pinned: MapItem | null;
	/** Rings one moment's mark; a new object each time. */
	pulse: { event: string; index: number } | null;
	/** Rings ripple from the dots on the map, inviting a first hover or tap. */
	beckon?: boolean;
	/** True while a polity's story is told: the rest of the map recedes further. */
	story: boolean;
	/** A frontier to draw by pen: one snapshot's ruled land. */
	frontier: { id: string; index: number } | null;
	/** The Power view's regions and pins, once loaded. */
	power: PowerMap | null;
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

function boundsOf(features: GeoJSON.Feature[]): LngLatBoundsLike | null {
	const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
	for (const f of features) {
		if (f.geometry.type !== 'GeometryCollection') extend(box, f.geometry.coordinates);
	}
	return Number.isFinite(box[0]) ? [box[0], box[1], box[2], box[3]] : null;
}

export default function MapView(props: Props) {
	const { lgas, base, labels, atlas, groups, group, selectedLga, focus, padding, label, attribution, onSelectLga, onSelectCommunity, onHover } = props;
	const { mode, history, region, year, polity, showStateLines, onSelectPolity, onHoverItems, onPickItem, pulse, beckon = false, story, frontier, power, pinned } = props;
	const historyRef = useRef<HistoryOnMap | null>(null);
	const powerRef = useRef<PowerLayer | null>(null);
	const repaintRef = useRef<() => void>(() => {});
	/** True while the camera is moving on its own (a cinematic flight, or the drift after it). */
	const autoCamera = useRef(false);
	const latestYear = useRef({ year, mode, polity });
	latestYear.current = { year, mode, polity };
	const container = useRef<HTMLDivElement>(null);
	const mapRef = useRef<MapLibre | null>(null);
	const ready = useRef<Promise<void> | null>(null);
	const highlightFeatures = useRef<GeoJSON.Feature[]>([]);
	const latest = useRef({ onSelectLga, onSelectCommunity, onHover, onSelectPolity, onHoverItems, onPickItem, padding, atlasOn: !group, mode, pinned });
	latest.current = { onSelectLga, onSelectCommunity, onHover, onSelectPolity, onHoverItems, onPickItem, padding, atlasOn: !group, mode, pinned };

	// Create the map once.
	useEffect(() => {
		if (!container.current) return;
		const colors = readColors();
		const map = new MapLibre({
			container: container.current,
			style: buildStyle(colors, lgas, base, labels),
			bounds: NIGERIA,
			fitBoundsOptions: { padding: latest.current.padding },
			// Generous, so a tall phone screen can still show the whole country.
			maxBounds: [
				[-14, -10],
				[31, 28],
			],
			minZoom: 4,
			maxZoom: 11,
			renderWorldCopies: false,
			attributionControl: false,
			dragRotate: false,
			pitchWithRotate: false,
		});
		map.touchZoomRotate.disableRotation();
		map.keyboard.disableRotation();
		map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
		map.addControl(new AttributionControl({ compact: true, customAttribution: attribution }), 'bottom-right');
		map.getCanvas().setAttribute('aria-label', label);
		// Start the credits collapsed to the (i) button; MapLibre opens them on load.
		map.once('load', () => {
			container.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
		});
		mapRef.current = map;
		// Dev only: lets the screenshot checks tap exact map positions.
		if (import.meta.env.DEV) (window as unknown as { __niajmap?: MapLibre }).__niajmap = map;

		const addPatterns = (c = readColors()) => {
			for (const [id, image] of [
				['hatch', hatchImage(c.highlight)],
				['dots', dotsImage(c.highlight)],
				['mix', mixImage(c.ink)],
				// Old map hatching and stippling, in faint sepia over each polity's own wash.
				['hist-hatch', hatchImage(c.labelStrong + '55', 7)],
				['hist-dots', dotsImage(c.labelStrong + 'aa', 7)],
				['hist-war', crossImage('#9b2c1f')],
			] as const) {
				if (map.hasImage(id)) map.updateImage(id, image);
				else map.addImage(id, image, { pixelRatio: 2 });
			}
		};
		ready.current = new Promise((resolve) => {
			map.once('load', () => {
				addPatterns();
				historyRef.current = new HistoryOnMap(map);
				historyRef.current.addImages(readColors());
				powerRef.current = new PowerLayer(map);
				if (import.meta.env.DEV) (window as unknown as { __niajhist?: HistoryOnMap }).__niajhist = historyRef.current;
				resolve();
			});
		});

		// Hover and tap on LGAs.
		let hovered: string | number | undefined;
		const setHover = (id: string | number | undefined) => {
			if (hovered !== undefined) map.setFeatureState({ source: 'lgas', id: hovered }, { hover: false });
			hovered = id;
			if (id !== undefined) map.setFeatureState({ source: 'lgas', id }, { hover: true });
		};
		map.on('mousemove', (e) => {
			if (latest.current.mode !== 'then' || !historyRef.current) return;
			const items = historyRef.current.itemsAt(e.point);
			// A town pointed at shows the threads back to its founders; otherwise the pinned town keeps them.
			historyRef.current.showThreads(items[0]?.type === 'town' || items[0]?.type === 'throne' ? items[0] : latest.current.pinned);
			map.getCanvas().style.cursor = items.length ? 'pointer' : '';
			latest.current.onHoverItems(items.length ? { items, x: e.point.x, y: e.point.y } : null);
		});
		map.on('mouseout', () => {
			latest.current.onHoverItems(null);
			historyRef.current?.showThreads(latest.current.pinned);
		});
		// The visitor's hand always beats the camera's drift.
		// Only an automatic move (a cinematic flight or the drift) is interrupted here; stopping on every
		// wheel or touch would also cancel the visitor's own zoom and pinch easing.
		for (const type of ['mousedown', 'touchstart', 'wheel'] as const) {
			map.getCanvasContainer().addEventListener(
				type,
				() => {
					if (!autoCamera.current) return;
					autoCamera.current = false;
					map.stop();
				},
				{ passive: true, capture: true },
			);
		}
		map.on('mousemove', 'land', (e) => {
			if (latest.current.mode === 'then') return;
			map.getCanvas().style.cursor = 'pointer';
			const id = e.features?.[0]?.id;
			setHover(id);
			latest.current.onHover(id === undefined ? null : { id: String(id), x: e.point.x, y: e.point.y });
		});
		for (const layer of ['community', 'village', 'atlas-community']) {
			map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
		}
		map.on('mouseleave', 'land', () => {
			map.getCanvas().style.cursor = '';
			setHover(undefined);
			latest.current.onHover(null);
		});
		map.on('click', (e) => {
			if (latest.current.mode === 'then') {
				// A line, a mark or a piece is explained where it was touched; open land opens its polity's story.
				const [top] = historyRef.current?.itemsAt(e.point) ?? [];
				if (top && top.type === 'polity') latest.current.onSelectPolity(top.polity);
				else latest.current.onPickItem(top ? { item: top, x: e.point.x, y: e.point.y } : null);
				return;
			}
			// Dots first: a small box makes them easy to hit with a finger.
			const box: [[number, number], [number, number]] = [
				[e.point.x - 8, e.point.y - 8],
				[e.point.x + 8, e.point.y + 8],
			];
			const dots = map.queryRenderedFeatures(box, { layers: ['community', 'village', 'atlas-community'] });
			const distance = (f: (typeof dots)[number]) => {
				const at = map.project((f.geometry as GeoJSON.Point).coordinates as [number, number]);
				return Math.hypot(at.x - e.point.x, at.y - e.point.y);
			};
			const dot = dots.sort((a, b) => distance(a) - distance(b))[0];
			if (dot) {
				const p = dot.properties as { kind: string; name: string; community?: string; group?: string };
				latest.current.onSelectCommunity(p.kind === 'village' && p.community ? p.community : p.name, p.group);
				return;
			}
			const [hit] = map.queryRenderedFeatures(e.point, { layers: ['land'] });
			latest.current.onSelectLga(hit ? String(hit.id) : null);
		});

		// Follow the system light or dark setting.
		const scheme = window.matchMedia('(prefers-color-scheme: dark)');
		const onScheme = () => {
			const c = readColors();
			for (const layer of buildStyle(c, EMPTY, EMPTY, EMPTY).layers) {
				if (!('paint' in layer) || !layer.paint) continue;
				for (const [key, value] of Object.entries(layer.paint)) {
					map.setPaintProperty(layer.id, key as Parameters<MapLibre['setPaintProperty']>[1], value);
				}
			}
			addPatterns(c);
			historyRef.current?.addImages(c);
			powerRef.current?.addImages();
			map.setPaintProperty('atlas-fill', 'fill-opacity', latest.current.atlasOn ? 0.88 : 0.14);
			map.setPaintProperty('atlas-shared', 'fill-opacity', latest.current.atlasOn ? 0.92 : 0.14);
		};
		scheme.addEventListener('change', onScheme);
		repaintRef.current = onScheme;

		return () => {
			scheme.removeEventListener('change', onScheme);
			historyRef.current?.destroy();
			historyRef.current = null;
			powerRef.current?.destroy();
			powerRef.current = null;
			map.remove();
			mapRef.current = null;
		};
		// The geometry never changes after load; the map is built once.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Draw the selected group.
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !ready.current) return;
		let cancelled = false;
		ready.current.then(() => {
			if (cancelled) return;
			const presence = new Map(group?.areas.map((a) => [a.lga, a.presence]) ?? []);
			const features = lgas.features
				.filter((f) => presence.has(String(f.properties?.id)))
				.map((f) => ({ ...f, properties: { ...f.properties, presence: presence.get(String(f.properties?.id)) } }));
			const points: GeoJSON.Feature[] = [];
			for (const c of group?.communities ?? []) {
				for (const m of c.markers) {
					points.push({
						type: 'Feature',
						properties: { kind: 'community', name: c.name, lga: m.lga, approximate: c.approximate && m.lga === c.lga },
						geometry: { type: 'Point', coordinates: m.point },
					});
				}
				for (const v of c.villages) {
					if (!v.point) continue;
					points.push({
						type: 'Feature',
						properties: { kind: 'village', name: v.name, community: c.name },
						geometry: { type: 'Point', coordinates: v.point },
					});
				}
			}
			highlightFeatures.current = [...features, ...points];
			map.getSource<GeoJSONSource>('highlight')?.setData({ type: 'FeatureCollection', features });
			map.getSource<GeoJSONSource>('communities')?.setData({ type: 'FeatureCollection', features: points });
		});
		return () => {
			cancelled = true;
		};
	}, [group, lgas]);

	// The atlas: colour every LGA by its main group, and write each group's name.
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !ready.current) return;
		ready.current.then(() => {
			const color = new Map(atlas.groups.map((g) => [g.id, g.color]));
			const features = lgas.features
				.filter((f) => atlas.lgas[String(f.properties?.id)])
				.map((f) => {
					const a = atlas.lgas[String(f.properties?.id)];
					let pattern: string | undefined;
					if (a.shared) {
						pattern = 'stripes-' + a.shared.join('-');
						if (!map.hasImage(pattern)) {
							map.addImage(pattern, stripesImage(a.shared.map((id) => color.get(id) ?? '#999999')), { pixelRatio: 2 });
						}
					}
					return {
						...f,
						properties: { id: f.properties?.id, group: a.group, color: color.get(a.group), mixed: a.mixed, ...(pattern ? { pattern } : {}) },
					};
				});
			map.getSource<GeoJSONSource>('atlas')?.setData({ type: 'FeatureCollection', features });
			// Named communities of every group (Ebu, Ilushi, Ette and the rest), so small pockets
			// that do not colour an LGA still show on the atlas.
			map.getSource<GeoJSONSource>('atlas-communities')?.setData({
				type: 'FeatureCollection',
				features: (() => {
					// One dot per place: a community shared by two groups (Ette: Idoma and Igala) is labelled with both.
					const byPlace = new Map<string, { name: string; groups: GroupView[]; point: [number, number] }>();
					for (const g of groups) {
						for (const c of g.communities) {
							// A community across an LGA line (Ifeku) is marked on each side.
							for (const m of c.markers) {
								const key = m.lga + '|' + c.name;
								const entry = byPlace.get(key) ?? { name: c.name, groups: [], point: m.point };
								entry.groups.push(g);
								byPlace.set(key, entry);
							}
						}
					}
					return [...byPlace.values()].map((e) => ({
						type: 'Feature' as const,
						properties: {
							kind: 'community',
							name: e.name,
							group: e.groups[0].id,
							color: color.get(e.groups[0].id) ?? '#888888',
							label: e.name + ' (' + e.groups.map((g) => g.name).join(', ') + ')',
						},
						geometry: { type: 'Point' as const, coordinates: e.point },
					}));
				})(),
			});
			map.getSource<GeoJSONSource>('atlas-labels')?.setData({
				type: 'FeatureCollection',
				features: atlas.groups
					.filter((g) => g.label && g.lgas > 0)
					.map((g) => ({ type: 'Feature', properties: { name: g.name, size: g.lgas }, geometry: { type: 'Point', coordinates: g.label! } })),
			});
		});
	}, [atlas, lgas, groups]);

	// Which layers show: the Today atlas (dimmed behind a selected group) or the Then old map.
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !ready.current) return;
		ready.current.then(() => {
			const then = mode === 'then';
			// The mood switches the colour tokens; repaint every layer from them.
			if (document.documentElement.dataset.mood !== mode) {
				document.documentElement.dataset.mood = mode;
				repaintRef.current();
			}
			const show = (id: string, on: boolean) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
			const powerOn = mode === 'power';
			for (const id of THEN_ONLY) show(id, then);
			for (const id of TODAY_ONLY) show(id, !then && !powerOn);
			for (const id of POWER_ONLY) show(id, powerOn);
			// The Power view keeps today's outline, LGA and state lines under its regions.
			if (powerOn) for (const id of ['lga-line', 'outline', 'state-label']) show(id, true);
			show('state-line', !then || showStateLines);
			const on = !group;
			map.setPaintProperty('atlas-fill', 'fill-opacity', on ? 0.88 : 0.14);
			map.setPaintProperty('atlas-shared', 'fill-opacity', on ? 0.92 : 0.14);
			if (!then && !powerOn) {
				for (const id of ['atlas-mix', 'atlas-label', 'atlas-community', 'atlas-community-label']) show(id, on);
			}
			map.getCanvas().setAttribute('aria-label', label);
		});
	}, [group, mode, showStateLines, label]);

	// The Power view: colour each region's LGAs by its leading peoples (stripes when several share the lead).
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !ready.current) return;
		ready.current.then(() => {
			const byLga = new Map<string, PowerMap['units'][number]>();
			for (const u of power?.units ?? []) for (const id of u.lgas) byLga.set(id, u);
			const features = lgas.features
				.filter((f) => byLga.has(String(f.properties?.id)))
				.map((f) => {
					const u = byLga.get(String(f.properties?.id))!;
					let pattern: string | undefined;
					if (u.colors.length > 1) {
						pattern = 'power-' + u.colors.join('-').replace(/#/g, '');
						if (!map.hasImage(pattern)) map.addImage(pattern, stripesImage(u.colors), { pixelRatio: 2 });
					}
					return { ...f, properties: { id: f.properties?.id, unit: u.id, color: u.colors[0], dim: u.dim, ...(pattern ? { pattern } : {}) } };
				});
			map.getSource<GeoJSONSource>('power')?.setData({ type: 'FeatureCollection', features });
			const area = new Set(power?.coup?.area ?? []);
			map.getSource<GeoJSONSource>('power-coup-area')?.setData({
				type: 'FeatureCollection',
				features: area.size ? lgas.features.filter((f) => area.has(String(f.properties?.id))) : [],
			});
			powerRef.current?.prepare(power);
			map.getSource<GeoJSONSource>('power-labels')?.setData({
				type: 'FeatureCollection',
				features: (power?.units ?? [])
					.filter((u) => u.label)
					.map((u) => ({
						type: 'Feature' as const,
						properties: { name: u.name, groups: u.groups, ...(u.party ? { badge: PowerLayer.badgeFor(u.party) } : {}) },
						geometry: { type: 'Point' as const, coordinates: u.label! },
					})),
			});
			map.getSource<GeoJSONSource>('power-pins')?.setData({
				type: 'FeatureCollection',
				features: (power?.pins ?? []).map((p) => ({ type: 'Feature' as const, properties: { name: p.name, label: p.label, color: p.color }, geometry: { type: 'Point' as const, coordinates: p.point } })),
			});
			// Party badges, coalitions, roads to the seat of power; the badge images must exist before the labels ask for them.
			powerRef.current?.set(power);
		});
	}, [power, lgas]);

	// The history view's data, once it has loaded.
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !ready.current || !history || !region) return;
		ready.current.then(() => {
			historyRef.current?.setData(history, region);
			historyRef.current?.setYear(latestYear.current.year, latestYear.current.mode === 'then');
			historyRef.current?.setSelected(latestYear.current.polity);
		});
	}, [history, region]);

	useEffect(() => {
		if (!ready.current || !history) return;
		ready.current.then(() => historyRef.current?.setYear(year, mode === 'then'));
	}, [year, mode, history]);

	useEffect(() => {
		if (!ready.current || !history) return;
		ready.current.then(() => historyRef.current?.setSelected(polity, story ? DIM.story : DIM.selected));
	}, [polity, story, history]);

	useEffect(() => {
		if (!ready.current || !history) return;
		ready.current.then(() => historyRef.current?.showThreads(mode === 'then' ? pinned : null));
	}, [pinned, history, mode]);

	useEffect(() => {
		if (!ready.current || !history || !pulse) return;
		ready.current.then(() => historyRef.current?.pulseMoment(pulse.event, pulse.index));
	}, [pulse, history]);

	useEffect(() => {
		if (!ready.current || !history) return;
		const on = beckon && mode === 'then';
		ready.current.then(() => historyRef.current?.beckon(on));
	}, [beckon, mode, history]);

	const frontierKey = frontier ? `${frontier.id}|${frontier.index}` : '';
	useEffect(() => {
		if (!ready.current || !history) return;
		ready.current.then(() => historyRef.current?.drawFrontier(frontier?.id ?? null, frontier?.index ?? 0));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [frontierKey, history]);

	// Outline the tapped LGA.
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !ready.current || !selectedLga) return;
		const id = selectedLga;
		ready.current.then(() => map.setFeatureState({ source: 'lgas', id }, { selected: true }));
		return () => {
			if (mapRef.current) map.setFeatureState({ source: 'lgas', id }, { selected: false });
		};
	}, [selectedLga]);

	// Move the view.
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !ready.current) return;
		let cancelled = false;
		ready.current.then(() => {
			if (cancelled) return;
			let bounds: LngLatBoundsLike | null = NIGERIA;
			let maxZoom = 7.2;
			if (focus.kind === 'bounds') {
				bounds = focus.bounds;
				maxZoom = 6.2;
			} else if (focus.kind === 'region') {
				bounds = REGION;
			} else if (focus.kind === 'polity') {
				bounds = historyRef.current?.bounds(focus.id, focus.year) ?? null;
				// A story keeps some of the neighbours in frame, for context.
				maxZoom = focus.cinematic ? 6.4 : 6.8;
			} else if (focus.kind === 'event') {
				bounds = historyRef.current?.eventBounds(focus.id) ?? null;
				maxZoom = 7.4;
			} else if (focus.kind === 'point') {
				const [x, y] = focus.point;
				bounds = [x - 0.9, y - 0.7, x + 0.9, y + 0.7];
				maxZoom = 7.6;
			} else if (focus.kind === 'group') {
				bounds = boundsOf(highlightFeatures.current) ?? NIGERIA;
			} else if (focus.kind === 'lga') {
				bounds = boundsOf(lgas.features.filter((f) => f.properties?.id === focus.id));
				maxZoom = 8.5;
			}
			if (!bounds) return;
			const cinematic = 'cinematic' in focus && focus.cinematic;
			const still = reducedMotion();
			map.fitBounds(bounds, {
				padding: latest.current.padding,
				maxZoom,
				duration: still ? 0 : cinematic ? CAMERA.cinematic : CAMERA.quick,
				...(cinematic ? { easing: CAMERA.ease } : {}),
			});
			autoCamera.current = Boolean(cinematic) && !still;
			if (!cinematic || still) return;
			// Once the camera has settled and the map is fully drawn, keep it breathing: a slow push in.
			// Waiting for idle (not just moveend) keeps the drift from starving tile loading on slow phones.
			map.once('moveend', () => {
				if (cancelled) return;
				map.once('idle', () => {
					if (cancelled || map.isMoving() || !autoCamera.current) return;
					map.once('moveend', () => (autoCamera.current = false));
					map.easeTo({ zoom: map.getZoom() + CAMERA.drift.zoom, duration: CAMERA.drift.ms, easing: (t) => t });
				});
			});
		});
		return () => {
			cancelled = true;
		};
	}, [focus, lgas, history]);

	return <div ref={container} className="map-canvas" />;
}
