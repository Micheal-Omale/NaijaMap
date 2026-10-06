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
import type { GroupView } from '../../lib/types';
import type { Atlas } from '../../lib/atlas';
import { EMPTY, buildStyle, dotsImage, hatchImage, mixImage, readColors, stripesImage } from './style';

setWorkerUrl(workerUrl);

export const NIGERIA: [[number, number], [number, number]] = [
	[2.67, 4.27],
	[14.68, 13.89],
];

export type FocusRequest = { kind: 'group' } | { kind: 'lga'; id: string } | { kind: 'nigeria' };

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
	const container = useRef<HTMLDivElement>(null);
	const mapRef = useRef<MapLibre | null>(null);
	const ready = useRef<Promise<void> | null>(null);
	const highlightFeatures = useRef<GeoJSON.Feature[]>([]);
	const latest = useRef({ onSelectLga, onSelectCommunity, onHover, padding, atlasOn: !group });
	latest.current = { onSelectLga, onSelectCommunity, onHover, padding, atlasOn: !group };

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
			] as const) {
				if (map.hasImage(id)) map.updateImage(id, image);
				else map.addImage(id, image, { pixelRatio: 2 });
			}
		};
		ready.current = new Promise((resolve) => {
			map.once('load', () => {
				addPatterns();
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
		map.on('mousemove', 'land', (e) => {
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
			map.setPaintProperty('atlas-fill', 'fill-opacity', latest.current.atlasOn ? 0.88 : 0.14);
			map.setPaintProperty('atlas-shared', 'fill-opacity', latest.current.atlasOn ? 0.92 : 0.14);
		};
		scheme.addEventListener('change', onScheme);

		return () => {
			scheme.removeEventListener('change', onScheme);
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
				points.push({
					type: 'Feature',
					properties: { kind: 'community', name: c.name, lga: c.lga, approximate: c.approximate },
					geometry: { type: 'Point', coordinates: c.point },
				});
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
							const key = c.lga + '|' + c.name;
							const entry = byPlace.get(key) ?? { name: c.name, groups: [], point: c.point };
							entry.groups.push(g);
							byPlace.set(key, entry);
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

	useEffect(() => {
		const map = mapRef.current;
		if (!map || !ready.current) return;
		const on = !group;
		ready.current.then(() => {
			map.setPaintProperty('atlas-fill', 'fill-opacity', on ? 0.88 : 0.14);
			map.setPaintProperty('atlas-shared', 'fill-opacity', on ? 0.92 : 0.14);
			map.setLayoutProperty('atlas-mix', 'visibility', on ? 'visible' : 'none');
			map.setLayoutProperty('atlas-label', 'visibility', on ? 'visible' : 'none');
			map.setLayoutProperty('atlas-community', 'visibility', on ? 'visible' : 'none');
			map.setLayoutProperty('atlas-community-label', 'visibility', on ? 'visible' : 'none');
		});
	}, [group]);

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
			if (focus.kind === 'group') {
				bounds = boundsOf(highlightFeatures.current) ?? NIGERIA;
			} else if (focus.kind === 'lga') {
				bounds = boundsOf(lgas.features.filter((f) => f.properties?.id === focus.id));
				maxZoom = 8.5;
			}
			if (!bounds) return;
			map.fitBounds(bounds, {
				padding: latest.current.padding,
				maxZoom,
				duration: reducedMotion() ? 0 : 900,
			});
		});
		return () => {
			cancelled = true;
		};
	}, [focus, lgas]);

	return <div ref={container} className="map-canvas" />;
}
