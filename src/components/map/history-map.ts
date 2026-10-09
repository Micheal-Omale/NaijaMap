// Draws the history view on the map: polity territory, capitals, links and
// names for the chosen year, with ink that bleeds between eras as the timeline
// moves, and the year's events: marches, raids, migrations and exiles drawn as
// routes, moments stamped as marks, and partitioned kingdoms cracking apart.
// The peoples who governed themselves between the states are named in the open land.
//
// Every feature belongs to one key (`<polity>|<index>` for a snapshot,
// `<key>|war` for a war line, `today|<polity>` for a surviving seat,
// `ev|<event>` for an event, or `soc:<society>|<land>` for a people's name). Changing the year fades only the keys that leave
// or join. When a polity moves from one snapshot to the next, the two
// cross-dissolve at the same pace, so land held in both eras never blinks; a
// polity that rises or falls fades on its own. An event that arrives is drawn:
// its routes grow from their start like a pen line, its moments are stamped in
// order, and a partition's pieces drift apart along their fracture lines.

import type { FilterSpecification, GeoJSONSource, LngLatBoundsLike, Map as MapLibre, PointLike } from 'maplibre-gl';
import { COLONIAL_INK } from '../../lib/ink';
import { keysAt, snapshotAt, TODAY, townSpans } from '../../lib/timeline';
import type { History, MarkKind, PolityKind, RouteKind, Vessel } from '../../lib/types';
import { arrowImage, crownImage, markImage, MARKS, pieceImage, ROUTES, SHIPS, shipImage, townImage, warrantImage } from './glyphs';
import { HIST_SYMBOLS, HIT_LAYERS } from './history-style';
import type { MapColors } from './style';

const sineInOut = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const power2Out = (t: number) => 1 - (1 - t) ** 2;
const power2In = (t: number) => t * t;
const power2InOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const power3Out = (t: number) => 1 - (1 - t) ** 3;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

const MOTION = {
	/** One era dissolving into the next. */
	morph: { ms: 1300, ease: sineInOut },
	/** A polity rising: ink soaks in. */
	rise: { ms: 1400, ease: power2Out },
	/** A polity falling: ink lifts away, faster than it came (about 2:1). */
	fall: { ms: 700, ease: power2In },
	/** The rest of the map receding when one polity takes the stage. */
	dim: { ms: 900, ease: sineInOut },
	/** A frontier drawing itself, like a pen going round the border. */
	draw: { ms: 2200, ease: sineInOut },
};

/** How an event arrives. Tunable here, never inside the loop. */
const EVENT_MOTION = {
	/** Routes wait for the ink of the year to settle a little, then draw one after another. */
	routeDelay: 280,
	routeStagger: 360,
	/** A route's drawing time grows with its length (in degrees), within these bounds. */
	routeMs: { base: 820, perDegree: 300, max: 2300 },
	routeEase: power2InOut,
	/** Moments are stamped after the routes have started, in their own order. */
	stampDelay: 650,
	stampStagger: 260,
	/** One ripple ring; a colonial strike rings twice. */
	ripple: { ms: 1050, from: 4, to: 28, ease: power3Out },
	/** The shatter: pieces burst outward, then settle a little closer, leaving the cracks open. */
	shatter: { delay: 450, ms: 1900, peak: 0.1, rest: 0.055, burst: 0.42 },
	/** Travellers on a migration: three to a route, one lap in this time. */
	movers: { perRoute: 3, lapMs: 7000, frameMs: 33 },
	/**
	 * Ships from Europe. A voyage is slower than a march: the ship itself is the pen,
	 * drawing its wake as it sails in from the open sea, one ship after another.
	 * Once the lane is drawn, a ship keeps plying it for as long as the event is on the map.
	 */
	voyage: {
		draw: { base: 1800, perDegree: 560, max: 6400, ease: sineInOut },
		stagger: 1100,
		/** One crossing of the lane: the ship rests in port and fades (the first share), then the next sails in from sea. */
		lapMs: 18000,
		dock: 0.12,
		fadeIn: 0.07,
		/** A slow rock on the swell, in degrees, and its period. */
		rock: { deg: 3.5, ms: 2600 },
		/** How far ahead to look when deciding whether a ship faces east or west, as a share of the lane. */
		lookAhead: 0.04,
	},
};

/**
 * Beckoning: until a visitor has pointed at something, rings ripple out from a few
 * of the dots on the map in turn (capitals, towns, the marks of events), so the
 * map itself says "these can be opened". A few at a time, spread over the map.
 */
const BECKON = { everyMs: 2000, ms: 1500, perCycle: 3, staggerMs: 260, from: 5, to: 22, opacity: 0.9, ease: power3Out };

/** How far other polities recede: when one is selected, and when its story is told. */
export const DIM = { none: 1, selected: 0.28, story: 0.1 } as const;

/** How big a polity's name is written, by kind. */
const WEIGHT: Record<PolityKind, number> = { empire: 1, caliphate: 1, kingdom: 0.55, confederacy: 0.55, 'city-state': 0.15, network: 0.35 };

/** Something on the map a visitor can point at, and have explained. */
export type MapItem =
	| { type: 'moment'; event: string; index: number }
	| { type: 'route'; event: string; index: number }
	| { type: 'piece'; event: string; index: number }
	| { type: 'link'; polity: string; snapshot: number; index: number }
	| { type: 'place'; polity: string; kind: 'capital' | 'node' | 'seat'; name: string }
	| { type: 'society'; society: string; land: number }
	| { type: 'town'; town: string }
	| { type: 'throne'; throne: string }
	| { type: 'polity'; polity: string };

export const itemKey = (i: MapItem): string =>
	i.type === 'polity' ? `polity:${i.polity}` : i.type === 'society' ? `society:${i.society}` : i.type === 'town' ? `town:${i.town}` : i.type === 'throne' ? `throne:${i.throne}` : i.type === 'place' ? `place:${i.polity}:${i.name}` : i.type === 'link' ? `link:${i.polity}:${i.snapshot}:${i.index}` : `${i.type}:${i.event}:${i.index}`;

type Source = 'hist-shapes' | 'hist-lines' | 'hist-points' | 'hist-towns' | 'ev-routes' | 'ev-heads' | 'ev-sites' | 'ev-pieces' | 'ev-labels';
type Ref = { source: Source; id: number; p: string };
type Prop = 'o' | 'dim';
type Anim = { ref: Ref; prop: Prop; from: number; to: number; start: number; ms: number; ease: (t: number) => number };

/** An event route, kept whole so it can be drawn a little more each frame. */
type RouteRec = { id: number; key: string; e: string; r: number; kind: RouteKind; vessel?: Vessel; color: string; coords: [number, number][]; cum: number[]; arrow: boolean };
type PieceRec = { id: number; key: string; e: string; i: number; geometry: GeoJSON.Geometry; label?: [number, number]; dir: [number, number]; name: string; color: string };

const refKey = (r: Ref, prop: Prop) => `${r.source}:${r.id}:${prop}`;
const polityOf = (key: string) => (key.startsWith('ev|') ? key : key.split('|')[0]);

/** A gentle arc between two points, like a route drawn by hand. */
function arc(a: [number, number], b: [number, number], steps = 32): [number, number][] {
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

/** Running length along a path, in degrees with longitude shrunk by latitude. */
function cumulative(coords: [number, number][]): number[] {
	const out = [0];
	for (let i = 1; i < coords.length; i++) {
		const [a, b] = [coords[i - 1], coords[i]];
		const k = Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180));
		out.push(out[i - 1] + Math.hypot((b[0] - a[0]) * k, b[1] - a[1]));
	}
	return out;
}

/** The point at distance `d` along a path, and the direction of travel there (degrees clockwise from north). */
function along(coords: [number, number][], cum: number[], d: number): { at: [number, number]; index: number; bearing: number } {
	let i = 1;
	while (i < cum.length - 1 && cum[i] < d) i++;
	const [a, b] = [coords[i - 1], coords[i]];
	const span = cum[i] - cum[i - 1] || 1;
	const t = clamp01((d - cum[i - 1]) / span);
	const k = Math.cos(a[1] * (Math.PI / 180));
	const bearing = (Math.atan2((b[0] - a[0]) * k, b[1] - a[1]) * 180) / Math.PI;
	return { at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], index: i, bearing };
}

function shift(geometry: GeoJSON.Geometry, dx: number, dy: number): GeoJSON.Geometry {
	const move = (ring: number[][]) => ring.map(([x, y]) => [x + dx, y + dy]);
	if (geometry.type === 'Polygon') return { type: 'Polygon', coordinates: geometry.coordinates.map(move) };
	if (geometry.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: geometry.coordinates.map((p) => p.map(move)) };
	return geometry;
}

function hexToRgba(hex: string, alpha: number): string {
	const n = parseInt(hex.slice(1), 16);
	return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** How far apart the moments of one place fan out, in degrees (about 20 px at zoom 7). */
const FAN_DEGREES = 0.055;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const markIcon = (mark: MarkKind, colonial: boolean) => `mark-${mark}-${colonial ? 'c' : 'l'}`;
const arrowIcon = (color: string) => `arrow-${color.slice(1)}`;
const shipIcon = (vessel: Vessel, west: boolean) => `ship-${vessel}-${west ? 'w' : 'e'}`;

export class HistoryOnMap {
	private history: History | null = null;
	private refs = new Map<string, Ref[]>();
	private all: Ref[] = [];
	private values = new Map<string, number>();
	private anims = new Map<string, Anim>();
	private active = new Set<string>();
	/** Keys still fading out: their labels stay until the ink has lifted. */
	private leaving = new Set<string>();
	private leaveTimer = 0;
	private frame = 0;
	private drawFrame = 0;
	private selected: string | null = null;
	private baseFilters = new Map<string, FilterSpecification | undefined>();
	/** The polities taking part in each event, so an event stays lit when one of them is selected. */
	private eventPolities = new Map<string, Set<string>>();

	// Event motion.
	private routes: RouteRec[] = [];
	private pieces: PieceRec[] = [];
	private sites: { id: number; key: string; e: string; m: number; colonial: boolean }[] = [];
	/** Route id → how much of it is drawn (0 to 1). Absent means drawn in full. */
	private progress = new Map<number, number>();
	private draws = new Map<number, { start: number; ms: number; ease: (t: number) => number }>();
	/** Voyage route id → when its first ship reached port, so the next ones follow on without a jump. */
	private docked = new Map<number, number>();
	private ripples = new Map<number, { start: number; ms: number; rings: number }>();
	/** Event id → how far its pieces have drifted (0 to 1 of the shatter), and the running shatter. */
	private shatterT = new Map<string, number>();
	private shatters = new Map<string, { start: number; ms: number }>();
	private motionFrame = 0;
	private lastMovers = 0;
	private colors: MapColors | null = null;
	/** Points a visitor can open, by key, for the beckoning rings. */
	private beckons: { key: string; at: [number, number] }[] = [];
	private beckonOn = false;
	private beckonFrame = 0;
	private beckonStart = 0;

	constructor(private map: MapLibre) {
		for (const id of HIST_SYMBOLS) this.baseFilters.set(id, map.getFilter(id) as FilterSpecification | undefined);
	}

	/** Adds (or repaints, after a theme change) the marks, arrowheads and partition hatches. */
	addImages(c: MapColors): void {
		this.colors = c;
		const ink = { paper: c.inkHalo, sepia: c.labelStrong, red: COLONIAL_INK };
		const put = (id: string, image: { width: number; height: number; data: Uint8ClampedArray }) => {
			if (this.map.hasImage(id)) this.map.updateImage(id, image);
			else this.map.addImage(id, image, { pixelRatio: 2 });
		};
		for (const mark of Object.keys(MARKS) as MarkKind[]) {
			put(markIcon(mark, false), markImage(mark, false, ink));
			put(markIcon(mark, true), markImage(mark, true, ink));
		}
		for (const color of new Set(this.routes.map((r) => r.color))) put(arrowIcon(color), arrowImage(color, c.inkHalo));
		for (const p of this.pieces) put(`piece-${p.i}`, pieceImage(p.color, p.i));
		for (const vessel of Object.keys(SHIPS) as Vessel[]) for (const west of [false, true]) put(shipIcon(vessel, west), shipImage(vessel, west, COLONIAL_INK, c.inkHalo));
		put('throne-crown', crownImage(COLONIAL_INK, c.inkHalo));
		put('throne-warrant', warrantImage(COLONIAL_INK, c.inkHalo));
		for (const t of this.history?.towns ?? []) put(`town-${t.id}`, townImage([...new Set(t.founders.map((x) => x.color))], c.inkHalo));
	}

	setData(history: History, region: GeoJSON.FeatureCollection): void {
		this.history = history;
		this.refs.clear();
		this.all = [];
		this.values.clear();
		this.active.clear();
		this.leaving.clear();
		this.eventPolities.clear();
		this.progress.clear();
		this.draws.clear();
		this.docked.clear();
		this.ripples.clear();
		this.shatterT.clear();
		this.shatters.clear();
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
				if (s.label) point(key, p.id, { kind: 'name', name: p.shortName, color, weight: WEIGHT[p.kind] }, s.label);
				if (s.capital) point(key, p.id, { kind: 'capital', name: s.capital.name, color }, s.capital.point);
				for (const n of s.nodes) point(key, p.id, { kind: 'node', name: n.name, color }, n.point);
				const from = s.capital?.point ?? s.label;
				for (const [li, l] of s.links.entries()) {
					if (!from) continue;
					// A war belongs to its moment: its own key, shown only in the years after the snapshot begins.
					const k = l.kind === 'war' ? `${key}|war` : key;
					const id = lines.length + 1;
					lines.push({ type: 'Feature', id, properties: { key: k, p: p.id, s: i, l: li, kind: l.kind, color }, geometry: { type: 'LineString', coordinates: arc(from, l.to.point) } });
					add(k, { source: 'hist-lines', id, p: p.id });
					point(k, p.id, { kind: 'target', name: l.label ?? l.to.name, color, s: i, l: li }, l.to.point);
				}
			}
			if (p.today.seat) {
				point(`today|${p.id}`, p.id, { kind: 'seat', name: p.today.seat.name, title: p.today.title ?? p.name, color: p.color }, p.today.seat.point);
			}
		}

		// Towns: one feature per stretch of years under one overlord (or none), its ring in that state's ink.
		const towns: GeoJSON.Feature[] = [];
		for (const t of history.towns) {
			this.eventPolities.set(`town:${t.id}`, new Set([...t.founders.flatMap((x) => (x.polity ? [x.polity] : [])), ...t.under.map((u) => u.polity)]));
			for (const [i, w] of townSpans(t).entries()) {
				const id = towns.length + 1;
				const key = `town:${t.id}|${i}`;
				towns.push({ type: 'Feature', id, properties: { key, p: `town:${t.id}`, town: t.id, name: t.name, icon: `town-${t.id}`, ring: w.under?.color ?? '#8a7a66', held: Boolean(w.under) }, geometry: { type: 'Point', coordinates: t.point } });
				add(key, { source: 'hist-towns', id, p: `town:${t.id}` });
			}
		}

		// Thrones of the colonial era, at their seats; they stay lit with the polity they belong to.
		for (const t of history.thrones) {
			const key = `throne:${t.id}`;
			if (t.polity) this.eventPolities.set(key, new Set([t.polity]));
			point(key, key, { kind: 'throne', name: t.title, throne: t.id, icon: t.kind === 'warrant' ? 'throne-warrant' : 'throne-crown' }, t.seat.point);
		}

		// Peoples who governed themselves: a name in the open land for each place they lived.
		for (const s of history.societies) {
			for (const [i, l] of s.lands.entries()) point(`soc:${s.id}|${i}`, `soc:${s.id}`, { kind: 'people', name: l.name, society: s.id, land: i }, l.label);
		}

		// Events: routes, moments, and the pieces of partitioned kingdoms.
		this.routes = [];
		this.sites = [];
		const sites: GeoJSON.Feature[] = [];
		const labels: GeoJSON.Feature[] = [];
		for (const e of history.events) {
			const key = `ev|${e.id}`;
			this.eventPolities.set(key, new Set(e.polities));
			for (const [ri, r] of e.routes.entries()) {
				const id = this.routes.length + 1;
				this.routes.push({ id, key, e: e.id, r: ri, kind: r.kind, vessel: r.vessel, color: r.color, coords: r.path, cum: cumulative(r.path), arrow: Boolean(ROUTES[r.kind].arrow) });
				add(key, { source: 'ev-routes', id, p: key });
				if (ROUTES[r.kind].arrow) add(key, { source: 'ev-heads', id, p: key });
			}
			// Moments that share a place fan out around it, so each mark can be found.
			const groups = new Map<string, number[]>();
			for (const [mi, m] of e.moments.entries()) {
				if (!m.at) continue;
				const g = m.at.point.join(',');
				groups.set(g, [...(groups.get(g) ?? []), mi]);
			}
			for (const indexes of groups.values()) {
				for (const [n, mi] of indexes.entries()) {
					const m = e.moments[mi];
					// Fanned on a small ring around the place, in degrees, so the fan opens as the map zooms in.
					const spread = indexes.length > 1 ? FAN_DEGREES : 0;
					const angle = -Math.PI / 2 + (n / indexes.length) * Math.PI * 2;
					const [px, py] = m.at!.point;
					const at: [number, number] = [px + (Math.cos(angle) * spread) / Math.cos((py * Math.PI) / 180), py - Math.sin(angle) * spread];
					const id = sites.length + 1;
					sites.push({
						type: 'Feature',
						id,
						properties: {
							key,
							e: e.id,
							m: mi,
							n,
							of: indexes.length,
							icon: markIcon(m.mark, m.colonial),
							title: m.title,
							ring: m.colonial ? COLONIAL_INK : '#5c4a38',
							// The first moment told at a place wins when marks crowd; colonial strikes before the rest.
							order: n * 2 + (m.colonial ? 0 : 1),
						},
						geometry: { type: 'Point', coordinates: at },
					});
					this.sites.push({ id, key, e: e.id, m: mi, colonial: m.colonial });
					add(key, { source: 'ev-sites', id, p: key });
				}
			}
		}
		this.pieces = [];
		for (const f of history.pieces.features) {
			const e = history.events.find((x) => x.id === f.properties?.e);
			if (!e) continue;
			const i = Number(f.properties?.i);
			const key = String(f.properties?.key);
			const all = e.pieces.map((p) => p.label).filter((x): x is [number, number] => Boolean(x));
			const centre: [number, number] = [all.reduce((s, p) => s + p[0], 0) / (all.length || 1), all.reduce((s, p) => s + p[1], 0) / (all.length || 1)];
			const label = e.pieces[i]?.label;
			const away = label ? [label[0] - centre[0], label[1] - centre[1]] : [0, 0];
			const len = Math.hypot(away[0], away[1]) || 1;
			this.pieces.push({ id: Number(f.id), key, e: e.id, i, geometry: f.geometry, label, dir: [away[0] / len, away[1] / len], name: String(f.properties?.name), color: String(f.properties?.color) });
			add(key, { source: 'ev-pieces', id: Number(f.id), p: key });
			if (label) {
				labels.push({ type: 'Feature', id: Number(f.id), properties: { key, name: f.properties?.name, color: f.properties?.color }, geometry: { type: 'Point', coordinates: label } });
				add(key, { source: 'ev-labels', id: Number(f.id), p: key });
			}
		}

		// What the beckoning rings call attention to: capitals, seats, towns, thrones and the marks of events.
		const seen = new Set<string>();
		this.beckons = [];
		for (const f of [...points.filter((p) => ['capital', 'seat', 'throne'].includes(String(p.properties?.kind))), ...towns, ...sites]) {
			const at = (f.geometry as GeoJSON.Point).coordinates as [number, number];
			const key = String(f.properties?.key);
			if (seen.has(key + at.join())) continue;
			seen.add(key + at.join());
			this.beckons.push({ key, at });
		}

		if (this.colors) this.addImages(this.colors);
		this.map.getSource<GeoJSONSource>('region')?.setData(region);
		this.map.getSource<GeoJSONSource>('hist-shapes')?.setData(history.shapes);
		this.map.getSource<GeoJSONSource>('hist-lines')?.setData({ type: 'FeatureCollection', features: lines });
		this.map.getSource<GeoJSONSource>('hist-points')?.setData({ type: 'FeatureCollection', features: points });
		this.map.getSource<GeoJSONSource>('hist-towns')?.setData({ type: 'FeatureCollection', features: towns });
		this.map.getSource<GeoJSONSource>('ev-sites')?.setData({ type: 'FeatureCollection', features: sites });
		this.map.getSource<GeoJSONSource>('ev-labels')?.setData({ type: 'FeatureCollection', features: labels });
		this.writeRoutes();
		this.writePieces();
		this.applyFilters();
	}

	/** Shows the snapshots and events of `year` (none when `on` is false), dissolving what changes. */
	setYear(year: number, on: boolean): void {
		if (!this.history) return;
		const next = on ? keysAt(this.history, year) : new Set<string>();
		const instant = !on || reducedMotion();
		const staying = (key: string, set: Set<string>) =>
			!key.startsWith('ev|') && [...set].some((k) => k !== key && polityOf(k) === polityOf(key) && !k.endsWith('|war'));
		for (const key of this.active) {
			if (next.has(key)) continue;
			this.fade(this.refs.get(key) ?? [], 'o', 0, instant, staying(key, next) ? MOTION.morph : MOTION.fall);
			if (!instant) this.leaving.add(key);
		}
		for (const key of next) {
			if (this.active.has(key)) continue;
			this.leaving.delete(key);
			this.fade(this.refs.get(key) ?? [], 'o', 1, instant, staying(key, this.active) ? MOTION.morph : MOTION.rise);
			if (key.startsWith('ev|')) this.arrive(key.slice(3), instant);
		}
		this.active = next;
		this.applyFilters();
		this.wakeMotion();
		// Labels of the old era leave once their ink has gone.
		clearTimeout(this.leaveTimer);
		if (this.leaving.size) {
			this.leaveTimer = window.setTimeout(() => {
				this.leaving.clear();
				this.applyFilters();
			}, MOTION.morph.ms + 50);
		}
	}

	/** Brings polity `id` forward and lets the rest recede, gently. Its events stay lit with it. */
	setSelected(id: string | null, level: number = DIM.selected): void {
		this.selected = id;
		const instant = reducedMotion();
		const own = (r: Ref) => id === null || r.p === id || Boolean(this.eventPolities.get(r.p)?.has(id));
		this.fade(this.all.filter((r) => !own(r)), 'dim', level, instant, MOTION.dim);
		this.fade(this.all.filter(own), 'dim', DIM.none, instant, MOTION.dim);
		this.applyFilters();
	}

	/**
	 * Draws the threads behind a town or a throne, or clears them (null): from a town back to each
	 * of its founders' homes, from a ruler's seat back to whoever crowned them (the Attah at Idah).
	 */
	showThreads(item: MapItem | null): void {
		const lines: GeoJSON.Feature[] = [];
		if (item?.type === 'town') {
			const t = this.history?.towns.find((x) => x.id === item.town);
			for (const f of t?.founders ?? []) {
				if (!f.from) continue;
				lines.push({ type: 'Feature', properties: { color: f.color }, geometry: { type: 'LineString', coordinates: arc(f.from.point, t!.point) } });
			}
		} else if (item?.type === 'throne') {
			const t = this.history?.thrones.find((x) => x.id === item.throne);
			if (t?.crowned?.at) lines.push({ type: 'Feature', properties: { color: COLONIAL_INK }, geometry: { type: 'LineString', coordinates: arc(t.crowned.at.point, t.seat.point) } });
		}
		this.map.getSource<GeoJSONSource>('town-threads')?.setData({ type: 'FeatureCollection', features: lines });
	}

	/** Rings one moment's mark, for a moment told in playback or pointed at in the event panel. */
	pulseMoment(event: string, index: number): void {
		const site = this.sites.find((s) => s.e === event && s.m === index);
		if (!site || reducedMotion()) return;
		this.ripples.set(site.id, { start: performance.now(), ms: EVENT_MOTION.ripple.ms, rings: site.colonial ? 2 : 1 });
		this.wakeMotion();
	}

	/**
	 * Draws the frontier of one snapshot's ruled land, as if by pen: every ring of
	 * the border is traced from its start at the same time. Cleared with `null`.
	 */
	drawFrontier(id: string | null, index = 0): void {
		cancelAnimationFrame(this.drawFrame);
		const source = this.map.getSource<GeoJSONSource>('story-edge');
		if (!source || !this.history) return;
		const p = id ? this.history.polities.find((x) => x.id === id) : null;
		const key = `${id}|${index}`;
		const shapes = p ? this.history.shapes.features.filter((f) => f.properties?.key === key && f.properties?.layer === 'core') : [];
		const lines: GeoJSON.Feature[] = [];
		for (const f of shapes) {
			const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
			for (const poly of polys) {
				// Outer rings only; skip specks the eye cannot follow.
				if (poly[0].length < 12) continue;
				lines.push({ type: 'Feature', properties: { k: 'edge' }, geometry: { type: 'LineString', coordinates: poly[0] } });
			}
		}
		// The chapter's own lines (tribute from vassals, founding ties) draw with the frontier.
		const snap = p?.snapshots[index];
		const from = snap?.capital?.point ?? snap?.label;
		if (snap && from) {
			for (const l of snap.links) lines.push({ type: 'Feature', properties: { k: l.kind }, geometry: { type: 'LineString', coordinates: arc(from, l.to.point) } });
		}
		source.setData({ type: 'FeatureCollection', features: lines });
		if (!p || !lines.length) return;
		const solid = p.color;
		const clear = hexToRgba(p.color, 0);
		const gradient = (t: number) =>
			t >= 1 ? solid : ['interpolate', ['linear'], ['line-progress'], 0, solid, Math.max(t, 0.0001), solid, Math.min(Math.max(t, 0.0001) + 0.0001, 1), clear];
		const paint = (t: number) => {
			for (const layer of ['story-edge', 'story-edge-glow']) this.map.setPaintProperty(layer, 'line-gradient', gradient(t) as never);
		};
		if (reducedMotion()) {
			paint(1);
			return;
		}
		const start = performance.now();
		const step = (now: number) => {
			const t = Math.min(1, (now - start) / MOTION.draw.ms);
			paint(MOTION.draw.ease(t));
			if (t < 1) this.drawFrame = requestAnimationFrame(step);
		};
		paint(0);
		this.drawFrame = requestAnimationFrame(step);
	}

	/**
	 * What is drawn under a point, most specific first: an event's marks, a link's
	 * target, a route or a link line, a place, a people's name, a partition piece, then territory.
	 */
	itemsAt(point: PointLike): MapItem[] {
		const layers = HIT_LAYERS.filter((l) => this.map.getLayer(l));
		const [x, y] = Array.isArray(point) ? point : [point.x, point.y];
		const box: [PointLike, PointLike] = [
			[x - 7, y - 7],
			[x + 7, y + 7],
		];
		const found = this.map.queryRenderedFeatures(box, { layers }).filter((f) => this.active.has(String(f.properties?.key)));
		const rank = (layer: string) => HIT_LAYERS.indexOf(layer);
		found.sort((a, b) => rank(a.layer.id) - rank(b.layer.id));
		const items: MapItem[] = [];
		const seen = new Set<string>();
		for (const f of found) {
			const p = f.properties ?? {};
			let item: MapItem | null = null;
			switch (f.layer.id) {
				case 'ev-site':
				case 'ev-site-head':
					item = { type: 'moment', event: String(p.e), index: Number(p.m) };
					break;
				case 'ev-ship':
				case 'ev-route-hit': {
					const rec = this.routes.find((r) => r.id === Number(f.id));
					if (rec) item = { type: 'route', event: rec.e, index: rec.r };
					break;
				}
				case 'ev-piece-fill': {
					const rec = this.pieces.find((r) => r.id === Number(f.id));
					if (rec) item = { type: 'piece', event: rec.e, index: rec.i };
					break;
				}
				case 'hist-target':
				case 'hist-link-hit':
					item = { type: 'link', polity: String(p.p), snapshot: Number(p.s), index: Number(p.l) };
					break;
				case 'hist-capital-ring':
				case 'hist-node':
				case 'hist-seat':
					item = { type: 'place', polity: String(p.p), kind: String(p.kind) as 'capital' | 'node' | 'seat', name: String(p.name) };
					break;
				case 'hist-throne':
					item = { type: 'throne', throne: String(p.throne) };
					break;
				case 'hist-town':
					item = { type: 'town', town: String(p.town) };
					break;
				case 'hist-people':
					item = { type: 'society', society: String(p.society), land: Number(p.land) };
					break;
				default:
					if (!String(p.p).startsWith('ev|')) item = { type: 'polity', polity: String(p.p) };
			}
			if (!item) continue;
			const k = itemKey(item);
			if (seen.has(k)) continue;
			seen.add(k);
			items.push(item);
		}
		return items;
	}

	/** Polities drawn under a point, most specific first. */
	politiesAt(point: PointLike): string[] {
		const ids = this.itemsAt(point).flatMap((i) => (i.type === 'polity' || i.type === 'place' || i.type === 'link' ? [i.polity] : []));
		return [...new Set(ids)];
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

	/** Where to look for an event: everything it draws, with room around a small one. */
	eventBounds(id: string): LngLatBoundsLike | null {
		const b = this.history?.events.find((e) => e.id === id)?.bounds;
		if (!b) return null;
		const padX = Math.max(0, 1.6 - (b[2] - b[0])) / 2 + 0.2;
		const padY = Math.max(0, 1.2 - (b[3] - b[1])) / 2 + 0.2;
		return [b[0] - padX, b[1] - padY, b[2] + padX, b[3] + padY];
	}

	/** Starts or stops the beckoning rings. */
	beckon(on: boolean): void {
		if (on === this.beckonOn) return;
		this.beckonOn = on;
		cancelAnimationFrame(this.beckonFrame);
		this.beckonFrame = 0;
		if (!on || reducedMotion()) {
			this.map.getSource<GeoJSONSource>('beckon')?.setData({ type: 'FeatureCollection', features: [] });
			return;
		}
		this.beckonStart = performance.now();
		this.beckonFrame = requestAnimationFrame(this.beckonTick);
	}

	private beckonTick = (now: number) => {
		const { everyMs, ms, perCycle, staggerMs, from, to, opacity, ease } = BECKON;
		const t = now - this.beckonStart;
		const cycle = Math.floor(t / everyMs);
		const local = t % everyMs;
		const lit = this.beckons.filter((b) => this.active.has(b.key) && !this.leaving.has(b.key));
		const out: GeoJSON.Feature[] = [];
		for (let k = 0; k < Math.min(perCycle, lit.length); k++) {
			const p = clamp01((local - k * staggerMs) / ms);
			if (p <= 0 || p >= 1) continue;
			// A stable but scattered pick, so the rings wander over the whole map.
			const b = lit[((cycle * perCycle + k) * 7919) % lit.length];
			out.push({ type: 'Feature', properties: { r: from + (to - from) * ease(p), o: opacity * (1 - p) }, geometry: { type: 'Point', coordinates: b.at } });
		}
		this.map.getSource<GeoJSONSource>('beckon')?.setData({ type: 'FeatureCollection', features: out });
		this.beckonFrame = requestAnimationFrame(this.beckonTick);
	};

	destroy(): void {
		cancelAnimationFrame(this.beckonFrame);
		cancelAnimationFrame(this.frame);
		cancelAnimationFrame(this.drawFrame);
		cancelAnimationFrame(this.motionFrame);
		clearTimeout(this.leaveTimer);
	}

	// ---- Event motion: routes drawn, moments stamped, pieces drifting, travellers walking.

	/** An event joins the map: its routes start undrawn, its marks wait to be stamped, its pieces close together. */
	private arrive(event: string, instant: boolean): void {
		const now = performance.now();
		const routes = this.routes.filter((r) => r.e === event);
		let sailing = 0;
		for (const [n, r] of routes.entries()) {
			this.draws.delete(r.id);
			this.docked.delete(r.id);
			if (instant) {
				this.progress.delete(r.id);
				continue;
			}
			const length = r.cum[r.cum.length - 1];
			this.progress.set(r.id, 0);
			if (r.kind === 'voyage') {
				// Ships come in one after another, each at its own slow pace.
				const { base, perDegree, max, ease } = EVENT_MOTION.voyage.draw;
				this.draws.set(r.id, { start: now + EVENT_MOTION.routeDelay + sailing++ * EVENT_MOTION.voyage.stagger, ms: Math.min(max, base + length * perDegree), ease });
				continue;
			}
			const { base, perDegree, max } = EVENT_MOTION.routeMs;
			this.draws.set(r.id, { start: now + EVENT_MOTION.routeDelay + n * EVENT_MOTION.routeStagger, ms: Math.min(max, base + length * perDegree), ease: EVENT_MOTION.routeEase });
		}
		if (!instant) {
			const sites = this.sites.filter((s) => s.e === event).sort((a, b) => a.m - b.m);
			for (const [n, s] of sites.entries()) {
				this.ripples.set(s.id, { start: now + EVENT_MOTION.stampDelay + n * EVENT_MOTION.stampStagger, ms: EVENT_MOTION.ripple.ms, rings: s.colonial ? 2 : 1 });
			}
		}
		if (this.pieces.some((p) => p.e === event)) {
			this.shatters.delete(event);
			if (instant) this.shatterT.set(event, 1);
			else {
				this.shatterT.set(event, 0);
				this.shatters.set(event, { start: now + EVENT_MOTION.shatter.delay, ms: EVENT_MOTION.shatter.ms });
			}
		}
		this.writeRoutes();
		this.writePieces();
	}

	/** True while something keeps moving on its own: travellers on a migration, ships on a voyage. */
	private hasMovers(): boolean {
		return !reducedMotion() && this.routes.some((r) => (r.kind === 'migration' || r.kind === 'voyage') && this.active.has(r.key));
	}

	private wakeMotion(): void {
		if (this.motionFrame) return;
		if (!this.draws.size && !this.ripples.size && !this.shatters.size && !this.hasMovers()) {
			this.writeMovers(performance.now());
			this.writeShips(performance.now());
			return;
		}
		this.motionFrame = requestAnimationFrame(this.motionTick);
	}

	private motionTick = (now: number) => {
		this.motionFrame = 0;
		if (this.draws.size) {
			for (const [id, d] of this.draws) {
				const t = clamp01((now - d.start) / d.ms);
				this.progress.set(id, d.ease(t));
				if (t >= 1) {
					if (this.routes[id - 1]?.kind === 'voyage') this.docked.set(id, now);
					this.draws.delete(id);
					this.progress.delete(id);
				}
			}
			this.writeRoutes();
			// A ship is the pen of its own lane, so it moves every frame while the lane draws.
			this.writeShips(now);
		}
		for (const [id, r] of this.ripples) {
			const local = now - r.start;
			if (local < 0) continue;
			const { from, to, ease } = EVENT_MOTION.ripple;
			if (local >= r.ms * r.rings) {
				this.ripples.delete(id);
				this.map.setFeatureState({ source: 'ev-sites', id }, { r: 0, ro: 0 });
				continue;
			}
			const phase = (local % r.ms) / r.ms;
			this.map.setFeatureState({ source: 'ev-sites', id }, { r: from + (to - from) * ease(phase), ro: 0.85 * (1 - phase) });
		}
		if (this.shatters.size) {
			for (const [event, s] of this.shatters) {
				const t = clamp01((now - s.start) / s.ms);
				this.shatterT.set(event, t);
				if (t >= 1) this.shatters.delete(event);
			}
			this.writePieces();
		}
		if (now - this.lastMovers >= EVENT_MOTION.movers.frameMs) {
			this.writeMovers(now);
			if (!this.draws.size) this.writeShips(now);
		}
		if (this.draws.size || this.ripples.size || this.shatters.size || this.hasMovers()) this.motionFrame = requestAnimationFrame(this.motionTick);
	};

	/** Writes every route as far as it has been drawn, and its arrowhead at the pen's tip. */
	private writeRoutes(): void {
		const lines: GeoJSON.Feature[] = [];
		const heads: GeoJSON.Feature[] = [];
		for (const r of this.routes) {
			const p = this.progress.get(r.id) ?? 1;
			if (p <= 0) continue;
			const total = r.cum[r.cum.length - 1];
			const tip = along(r.coords, r.cum, total * p);
			const coords = p >= 1 ? r.coords : [...r.coords.slice(0, tip.index), tip.at];
			if (coords.length < 2) continue;
			lines.push({ type: 'Feature', id: r.id, properties: { key: r.key, kind: r.kind, color: r.color }, geometry: { type: 'LineString', coordinates: coords } });
			if (r.arrow) {
				heads.push({ type: 'Feature', id: r.id, properties: { key: r.key, icon: arrowIcon(r.color), bearing: tip.bearing }, geometry: { type: 'Point', coordinates: tip.at } });
			}
		}
		this.map.getSource<GeoJSONSource>('ev-routes')?.setData({ type: 'FeatureCollection', features: lines });
		this.map.getSource<GeoJSONSource>('ev-heads')?.setData({ type: 'FeatureCollection', features: heads });
	}

	/** Writes each piece where the shatter has carried it: out in a burst, then back a little, the cracks left open. */
	private writePieces(): void {
		const { burst, peak, rest } = EVENT_MOTION.shatter;
		const reach = (t: number) => (t < burst ? peak * power3Out(t / burst) : peak - (peak - rest) * sineInOut((t - burst) / (1 - burst)));
		const fills: GeoJSON.Feature[] = [];
		const labels: GeoJSON.Feature[] = [];
		for (const p of this.pieces) {
			const d = reach(this.shatterT.get(p.e) ?? 1);
			const [dx, dy] = [p.dir[0] * d, p.dir[1] * d];
			fills.push({ type: 'Feature', id: p.id, properties: { key: p.key, e: p.e, i: p.i, name: p.name, color: p.color }, geometry: shift(p.geometry, dx, dy) });
			if (p.label) labels.push({ type: 'Feature', id: p.id, properties: { key: p.key, name: p.name.split(':')[0], color: p.color }, geometry: { type: 'Point', coordinates: [p.label[0] + dx, p.label[1] + dy] } });
		}
		this.map.getSource<GeoJSONSource>('ev-pieces')?.setData({ type: 'FeatureCollection', features: fills });
		this.map.getSource<GeoJSONSource>('ev-labels')?.setData({ type: 'FeatureCollection', features: labels });
	}

	/** Travellers walking each migration on the map; they keep to the selected polity's events when one is chosen. */
	private writeMovers(now: number): void {
		this.lastMovers = now;
		const out: GeoJSON.Feature[] = [];
		if (this.hasMovers()) {
			const { perRoute, lapMs } = EVENT_MOTION.movers;
			for (const r of this.routes) {
				if (r.kind !== 'migration' || !this.active.has(r.key) || this.leaving.has(r.key) || this.progress.has(r.id)) continue;
				const lit = this.selected === null || Boolean(this.eventPolities.get(r.key)?.has(this.selected));
				const total = r.cum[r.cum.length - 1];
				for (let k = 0; k < perRoute; k++) {
					const phase = (now / lapMs + k / perRoute + r.id * 0.137) % 1;
					// Travellers fade in at the start of the road and out at its end.
					const a = Math.min(1, phase * 6, (1 - phase) * 6) * (lit ? 0.95 : 0.2);
					out.push({ type: 'Feature', properties: { color: r.color, a }, geometry: { type: 'Point', coordinates: along(r.coords, r.cum, total * phase).at } });
				}
			}
		}
		this.map.getSource<GeoJSONSource>('ev-movers')?.setData({ type: 'FeatureCollection', features: out });
	}

	/**
	 * Ships on each voyage on the map: at the tip of the lane while it is being drawn,
	 * then one ship plying it from sea to port, again and again. Each faces east or west
	 * by where the lane goes next, so a ship never sails backwards or upside down.
	 */
	private writeShips(now: number): void {
		const out: GeoJSON.Feature[] = [];
		if (!reducedMotion()) {
			const { lapMs, dock, fadeIn, rock, lookAhead } = EVENT_MOTION.voyage;
			for (const r of this.routes) {
				if (r.kind !== 'voyage' || !this.active.has(r.key) || this.leaving.has(r.key)) continue;
				const drawing = this.progress.get(r.id);
				if (drawing !== undefined && drawing <= 0) continue;
				const lit = this.selected === null || Boolean(this.eventPolities.get(r.key)?.has(this.selected));
				const total = r.cum[r.cum.length - 1];
				// While the lane draws, the ship is its pen. After that each crossing begins with the
				// last ship resting in port and fading, then the next sails in from the open sea.
				let phase: number;
				let fade: number;
				if (drawing !== undefined) {
					phase = drawing;
					fade = Math.min(1, phase / fadeIn);
				} else {
					const since = now - (this.docked.get(r.id) ?? -r.id * 0.291 * lapMs);
					const cycle = (since / lapMs) % 1;
					phase = cycle < dock ? 1 : (cycle - dock) / (1 - dock);
					fade = cycle < dock ? 1 - cycle / dock : Math.min(1, phase / fadeIn);
				}
				const ahead = along(r.coords, r.cum, Math.min(total, total * (phase + lookAhead))).at;
				const behind = along(r.coords, r.cum, Math.max(0, total * (phase - lookAhead))).at;
				out.push({
					type: 'Feature',
					id: r.id,
					properties: {
						key: r.key,
						icon: shipIcon(r.vessel ?? 'sail', ahead[0] - behind[0] < 0),
						a: fade * (lit ? 1 : 0.22),
						rock: Math.sin((now / rock.ms + r.id * 0.37) * Math.PI * 2) * rock.deg,
					},
					geometry: { type: 'Point', coordinates: along(r.coords, r.cum, total * phase).at },
				});
			}
		}
		this.map.getSource<GeoJSONSource>('ev-ships')?.setData({ type: 'FeatureCollection', features: out });
	}

	private applyFilters(): void {
		const keys = ['literal', [...new Set([...this.active, ...this.leaving])]];
		for (const id of HIST_SYMBOLS) {
			const base = this.baseFilters.get(id);
			const parts: unknown[] = ['all', ['in', ['get', 'key'], keys]];
			if (base) parts.push(base);
			// Labels at the end of tribute and trade lines name places only for the selected polity.
			if (id === 'hist-target-label') parts.push(['==', ['get', 'p'], this.selected ?? '']);
			this.map.setFilter(id, parts as FilterSpecification);
		}
	}

	private fade(refs: Ref[], prop: Prop, to: number, instant: boolean, motion: { ms: number; ease: (t: number) => number }): void {
		const now = performance.now();
		const rest = prop === 'o' ? 0 : 1;
		for (const ref of refs) {
			const k = refKey(ref, prop);
			const running = this.anims.get(k);
			const from = running ? this.current(running, now) : (this.values.get(k) ?? rest);
			if (instant || from === to) {
				this.anims.delete(k);
				if (from !== to || instant) this.set(ref, prop, to);
				continue;
			}
			this.anims.set(k, { ref, prop, from, to, start: now, ms: motion.ms, ease: motion.ease });
		}
		if (this.anims.size && !this.frame) this.frame = requestAnimationFrame(this.tick);
	}

	private current(a: Anim, now: number): number {
		const t = Math.min(1, (now - a.start) / a.ms);
		return a.from + (a.to - a.from) * a.ease(t);
	}

	private set(ref: Ref, prop: Prop, value: number): void {
		this.values.set(refKey(ref, prop), value);
		this.map.setFeatureState({ source: ref.source, id: ref.id }, { [prop]: value });
	}

	private lastDim = 0;

	private tick = (now: number) => {
		// Dimming touches every feature on the map, so it steps at about 20 frames a second;
		// the era dissolves, which touch only what changes, run every frame.
		const dimFrame = now - this.lastDim >= 50;
		if (dimFrame) this.lastDim = now;
		for (const [k, a] of this.anims) {
			const done = now - a.start >= a.ms;
			if (a.prop === 'dim' && !dimFrame && !done) continue;
			this.set(a.ref, a.prop, this.current(a, now));
			if (done) this.anims.delete(k);
		}
		this.frame = this.anims.size ? requestAnimationFrame(this.tick) : 0;
	};
}
