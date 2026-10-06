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
import { EMPTY, buildStyle, dotsImage, hatchImage, readColors } from './style';

setWorkerUrl(workerUrl);

export const NIGERIA: [[number, number], [number, number]] = [
	[2.67, 4.27],
	[14.68, 13.89],
];

export type FocusRequest = { kind: 'group' } | { kind: 'lga'; id: string } | { kind: 'nigeria' };

interface Props {
	lgas: GeoJSON.FeatureCollection;
	base: GeoJSON.FeatureCollection;
	group: GroupView | null;
	selectedLga: string | null;
	/** A new object each time the view should move. */
	focus: FocusRequest;
	padding: PaddingOptions;
	label: string;
	attribution: string;
	onSelectLga: (id: string | null) => void;
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
	const { lgas, base, group, selectedLga, focus, padding, label, attribution, onSelectLga } = props;
	const container = useRef<HTMLDivElement>(null);
	const mapRef = useRef<MapLibre | null>(null);
	const ready = useRef<Promise<void> | null>(null);
	const highlightFeatures = useRef<GeoJSON.Feature[]>([]);
	const latest = useRef({ onSelectLga, padding });
	latest.current = { onSelectLga, padding };

	// Create the map once.
	useEffect(() => {
		if (!container.current) return;
		const colors = readColors();
		const map = new MapLibre({
			container: container.current,
			style: buildStyle(colors, lgas, base),
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

		const addPatterns = (c = readColors()) => {
			for (const [id, image] of [
				['hatch', hatchImage(c.highlight)],
				['dots', dotsImage(c.highlight)],
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
			setHover(e.features?.[0]?.id);
		});
		map.on('mouseleave', 'land', () => {
			map.getCanvas().style.cursor = '';
			setHover(undefined);
		});
		map.on('click', (e) => {
			const [hit] = map.queryRenderedFeatures(e.point, { layers: ['land'] });
			latest.current.onSelectLga(hit ? String(hit.id) : null);
		});

		// Follow the system light or dark setting.
		const scheme = window.matchMedia('(prefers-color-scheme: dark)');
		const onScheme = () => {
			const c = readColors();
			for (const layer of buildStyle(c, EMPTY, EMPTY).layers) {
				if (!('paint' in layer) || !layer.paint) continue;
				for (const [key, value] of Object.entries(layer.paint)) {
					map.setPaintProperty(layer.id, key as Parameters<MapLibre['setPaintProperty']>[1], value);
				}
			}
			addPatterns(c);
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
