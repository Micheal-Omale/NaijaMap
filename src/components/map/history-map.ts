// Draws the history view on the map: polity territory, capitals, links and
// names for the chosen year, with ink that bleeds in and lifts away as the
// timeline moves between snapshots.
//
// Every feature belongs to one snapshot key (`<polity>|<index>`, or
// `today|<polity>` for a surviving seat). Changing the year fades the features of
// keys that leave or join; nothing else is touched.

import type { FilterSpecification, GeoJSONSource, LngLatBoundsLike, Map as MapLibre, PointLike } from 'maplibre-gl';
import { keysAt, snapshotAt, TODAY } from '../../lib/timeline';
import type { History, PolityKind } from '../../lib/types';
import { HIST_SYMBOLS } from './history-style';

const MOTION = {
	// Ink soaks in slowly and lifts away fast (exits about three times quicker than entrances).
	enter: { ms: 760, ease: (t: number) => 1 - (1 - t) ** 3 }, // power3.out
	exit: { ms: 260, ease: (t: number) => t * t }, // power2.in
};

/** How big a polity's name is written, by kind. */
const WEIGHT: Record<PolityKind, number> = { empire: 1, caliphate: 1, kingdom: 0.55, confederacy: 0.55, 'city-state': 0.15, network: 0.35 };

type Source = 'hist-shapes' | 'hist-lines' | 'hist-points';
type Ref = { source: Source; id: number; p: string };
type Anim = { ref: Ref; from: number; to: number; start: number; ms: number; ease: (t: number) => number };

const refKey = (r: Ref) => `${r.source}:${r.id}`;

/** A gentle arc between two points, like a route drawn by hand. */
function arc(a: [number, number], b: [number, number], steps = 24): [number, number][] {
	const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
	const bend = 0.18;
	const c: [number, number] = [(a[0] + b[0]) / 2 - dy * bend, (a[1] + b[1]) / 2 + dx * bend];
	const out: [number, number][] = [];
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const u = 1 - t;
		out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
	}
	return out;
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export class HistoryOnMap {
	private history: History | null = null;
	private refs = new Map<string, Ref[]>();
	private all: Ref[] = [];
	private opacity = new Map<string, number>();
	private anims = new Map<string, Anim>();
	private active = new Set<string>();
	private frame = 0;
	private selected: string | null = null;
	private baseFilters = new Map<string, FilterSpecification | undefined>();

	constructor(private map: MapLibre) {
		for (const id of HIST_SYMBOLS) this.baseFilters.set(id, map.getFilter(id) as FilterSpecification | undefined);
	}

	setData(history: History, region: GeoJSON.FeatureCollection): void {
		this.history = history;
		this.refs.clear();
		this.all = [];
		this.opacity.clear();
		this.active.clear();
		const add = (key: string, ref: Ref) => {
			this.refs.set(key, [...(this.refs.get(key) ?? []), ref]);
			this.all.push(ref);
		};

		for (const f of history.shapes.features) {
			add(String(f.properties?.key), { source: 'hist-shapes', id: Number(f.id), p: String(f.properties?.p) });
		}

		const lines: GeoJSON.Feature[] = [];
		const points: GeoJSON.Feature[] = [];
		const point = (key: string, p: string, props: Record<string, unknown>, at: [number, number]) => {
			const id = points.length + 1;
			points.push({ type: 'Feature', id, properties: { key, p, ...props }, geometry: { type: 'Point', coordinates: at } });
			add(key, { source: 'hist-points', id, p });
		};

		for (const p of history.polities) {
			for (const [i, s] of p.snapshots.entries()) {
				const key = `${p.id}|${i}`;
				const color = p.color;
				if (s.label) point(key, p.id, { kind: 'name', name: p.name, color, weight: WEIGHT[p.kind] }, s.label);
				if (s.capital) point(key, p.id, { kind: 'capital', name: s.capital.name, color }, s.capital.point);
				for (const n of s.nodes) point(key, p.id, { kind: 'node', name: n.name, color }, n.point);
				const from = s.capital?.point ?? s.label;
				for (const l of s.links) {
					if (!from) continue;
					// A war belongs to its moment: its own key, shown only in the years after the snapshot begins.
					const k = l.kind === 'war' ? `${key}|war` : key;
					const id = lines.length + 1;
					lines.push({ type: 'Feature', id, properties: { key: k, p: p.id, kind: l.kind, color }, geometry: { type: 'LineString', coordinates: arc(from, l.to.point) } });
					add(k, { source: 'hist-lines', id, p: p.id });
					point(k, p.id, { kind: 'target', name: l.label ?? l.to.name, color }, l.to.point);
				}
			}
			if (p.today.seat) {
				point(`today|${p.id}`, p.id, { kind: 'seat', name: p.today.seat.name, title: p.today.title ?? p.name, color: p.color }, p.today.seat.point);
			}
		}

		this.map.getSource<GeoJSONSource>('region')?.setData(region);
		this.map.getSource<GeoJSONSource>('hist-shapes')?.setData(history.shapes);
		this.map.getSource<GeoJSONSource>('hist-lines')?.setData({ type: 'FeatureCollection', features: lines });
		this.map.getSource<GeoJSONSource>('hist-points')?.setData({ type: 'FeatureCollection', features: points });
		this.applyFilters();
	}

	/** Shows the snapshots of `year` (none when `on` is false), fading what changes. */
	setYear(year: number, on: boolean): void {
		if (!this.history) return;
		const next = on ? keysAt(this.history, year) : new Set<string>();
		const instant = !on || reducedMotion();
		for (const key of this.active) if (!next.has(key)) this.fade(this.refs.get(key) ?? [], 0, instant);
		for (const key of next) if (!this.active.has(key)) this.fade(this.refs.get(key) ?? [], 1, instant);
		this.active = next;
		this.applyFilters();
	}

	/** Dims every polity but `id`. */
	setSelected(id: string | null): void {
		this.selected = id;
		for (const r of this.all) this.map.setFeatureState({ source: r.source, id: r.id }, { dim: id !== null && r.p !== id });
		this.applyFilters();
	}

	/** Polities drawn under a point, most specific first: places, then ruled land, then reach. */
	politiesAt(point: PointLike): string[] {
		const layers = ['hist-capital-ring', 'hist-node', 'hist-seat', 'hist-core', 'hist-influence'].filter((l) => this.map.getLayer(l));
		const box: [PointLike, PointLike] =
			Array.isArray(point) ? [[point[0] - 6, point[1] - 6], [point[0] + 6, point[1] + 6]] : [[point.x - 6, point.y - 6], [point.x + 6, point.y + 6]];
		const found = this.map.queryRenderedFeatures(box, { layers }).filter((f) => this.active.has(String(f.properties?.key)));
		const order = (layer: string) => (layer === 'hist-influence' ? 2 : layer === 'hist-core' ? 1 : 0);
		found.sort((a, b) => order(a.layer.id) - order(b.layer.id));
		return [...new Set(found.map((f) => String(f.properties?.p)))];
	}

	/** Where to look for a polity in a year: its snapshot then, or its height. */
	bounds(id: string, year: number): LngLatBoundsLike | null {
		const p = this.history?.polities.find((x) => x.id === id);
		if (!p) return null;
		if (year >= TODAY && p.today.seat) {
			const [x, y] = p.today.seat.point;
			return [x - 1.2, y - 1, x + 1.2, y + 1];
		}
		const at = snapshotAt(p, year);
		const peak = p.snapshots.reduce((best, s, i) => (s.year <= p.peak ? i : best), 0);
		const b = p.snapshots[at >= 0 ? at : peak].bounds;
		if (!b) return null;
		// A city-state is a dot on the map; give it room.
		const pad = Math.max(0, 0.8 - (b[2] - b[0])) / 2;
		return [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad];
	}

	destroy(): void {
		cancelAnimationFrame(this.frame);
	}

	private applyFilters(): void {
		const keys = ['literal', [...this.active]];
		for (const id of HIST_SYMBOLS) {
			const base = this.baseFilters.get(id);
			const parts: unknown[] = ['all', ['in', ['get', 'key'], keys]];
			if (base) parts.push(base);
			// Labels at the end of tribute and trade lines name places only for the selected polity.
			if (id === 'hist-target-label') parts.push(['==', ['get', 'p'], this.selected ?? '']);
			this.map.setFilter(id, parts as FilterSpecification);
		}
	}

	private fade(refs: Ref[], to: number, instant: boolean): void {
		const now = performance.now();
		const motion = to > 0 ? MOTION.enter : MOTION.exit;
		for (const ref of refs) {
			const k = refKey(ref);
			const from = this.anims.has(k) ? this.current(this.anims.get(k)!, now) : (this.opacity.get(k) ?? 0);
			if (instant) {
				this.anims.delete(k);
				this.set(ref, to);
				continue;
			}
			this.anims.set(k, { ref, from, to, start: now, ms: motion.ms, ease: motion.ease });
		}
		if (this.anims.size && !this.frame) this.frame = requestAnimationFrame(this.tick);
	}

	private current(a: Anim, now: number): number {
		const t = Math.min(1, (now - a.start) / a.ms);
		return a.from + (a.to - a.from) * a.ease(t);
	}

	private set(ref: Ref, o: number): void {
		this.opacity.set(refKey(ref), o);
		this.map.setFeatureState({ source: ref.source, id: ref.id }, { o });
	}

	private tick = (now: number) => {
		for (const [k, a] of this.anims) {
			const o = this.current(a, now);
			this.set(a.ref, o);
			if (now - a.start >= a.ms) this.anims.delete(k);
		}
		this.frame = this.anims.size ? requestAnimationFrame(this.tick) : 0;
	};
}
