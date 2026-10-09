// Draws the Power view's infographic layer on the map: each region's party as a
// badge under its name, coalitions as rails between the regions they joined,
// every federal leader's road from home to the seat of power, and the seats
// themselves. It borrows the Then view's motion: when a period opens, its roads
// draw out like pen lines while each leader's home is stamped with a ripple,
// then the coalitions draw their rails one after another. A coup plays the same
// way: its moments are stamped in order with the Then view's marks, each with a
// ripple, and its routes (a plotter's flight) draw after them.

import type { GeoJSONSource, Map as MapLibre } from 'maplibre-gl';
import { EMPTY } from './style';

type Point = [number, number];

/** What MapApp hands over for a period (a subset of PowerMap). */
export interface PowerLayerData {
	key: string;
	units: { id: string; label?: Point; party?: { id: string; short: string; slot: number } }[];
	coalitions: { id: string; name: string; years: string; links: [Point, Point][]; dim: boolean; selected: boolean }[];
	pins: { point: Point; color: string }[];
	roads: { from: Point; to: Point; color: string }[];
	capitals: { name: string; point: Point }[];
	coup?: {
		key: string;
		moments: { point: Point; mark: string; title: string; when: string }[];
		routes: { path: Point[]; label: string }[];
		areaPoint?: Point;
	};
}

const sineInOut = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const power2InOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const power3Out = (t: number) => 1 - (1 - t) ** 3;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** How far each of a period's coalitions bows from the straight line, in turn. */
const BENDS = [0.2, -0.2, 0.38, -0.38];

/** The timing of a period's arrival. Tunable here, never inside the loop. */
const MOTION = {
	/** Roads leave home one after another, drawn like a pen line. */
	road: { delay: 250, stagger: 280, ms: 1150, ease: power2InOut },
	/** Each home is stamped as its road sets out: one ripple ring. */
	ripple: { ms: 1050, from: 4, to: 26, ease: power3Out },
	/** Then the coalitions draw their rails, hub outwards. */
	coalition: { delay: 900, stagger: 420, linkStagger: 160, ms: 1500, ease: sineInOut },
	/** A coup's moments, stamped one by one once the camera has started to move. */
	stamp: { delay: 700, stagger: 900, pop: 420 },
	/** Its routes draw after the first stamp. */
	coupRoute: { delay: 1300, stagger: 500, ms: 1800, ease: power2InOut },
};

/** A stamp that lands a little large and settles, like a seal pressed into wax. */
const backOut = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;

/** A gentle arc between two points, like a route drawn by hand (as in the Then view). */
function arc(a: Point, b: Point, bend = 0.18, steps = 40): Point[] {
	const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
	const c: Point = [(a[0] + b[0]) / 2 - dy * bend, (a[1] + b[1]) / 2 + dx * bend];
	const out: Point[] = [];
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const u = 1 - t;
		out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
	}
	return out;
}

/** A path through several waypoints, smoothed by corner cutting (as the Then view's routes are). */
function smooth(points: Point[], rounds = 4): Point[] {
	let pts = points;
	for (let r = 0; r < rounds; r++) {
		const out: Point[] = [pts[0]];
		for (let i = 0; i < pts.length - 1; i++) {
			const [a, b] = [pts[i], pts[i + 1]];
			out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
		}
		out.push(pts[pts.length - 1]);
		pts = out;
	}
	return pts;
}

/** The first part of a path, `t` of the way along it. */
function partOf(path: Point[], t: number): Point[] {
	if (t >= 1) return path;
	const lens = [0];
	for (let i = 1; i < path.length; i++) lens.push(lens[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
	const goal = lens[lens.length - 1] * Math.max(t, 0.0001);
	const out: Point[] = [path[0]];
	for (let i = 1; i < path.length; i++) {
		if (lens[i] < goal) {
			out.push(path[i]);
			continue;
		}
		const f = (goal - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
		out.push([path[i - 1][0] + (path[i][0] - path[i - 1][0]) * f, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * f]);
		break;
	}
	return out;
}

const badgeId = (slot: number, short: string) => `party-${slot}-${short}`;

/** A party badge for the map: its short name on its colour, as in the panel. */
function badgeImage(short: string, fill: string, ink: string): ImageData {
	const ratio = 2;
	const font = `700 ${10.5 * ratio}px "Noto Sans", ui-sans-serif, system-ui, sans-serif`;
	const probe = document.createElement('canvas').getContext('2d')!;
	probe.font = font;
	const w = Math.ceil(probe.measureText(short).width + 12 * ratio);
	const h = 17 * ratio;
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = fill;
	ctx.beginPath();
	ctx.roundRect(0, 0, w, h, 4 * ratio);
	ctx.fill();
	ctx.font = font;
	ctx.fillStyle = ink;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(short, w / 2, h / 2 + ratio * 0.6);
	return ctx.getImageData(0, 0, w, h);
}

export class PowerLayer {
	private data: PowerLayerData | null = null;
	private key: string | null = null;
	private start = 0;
	private coupKey: string | null = null;
	private coupStart = 0;
	private frame = 0;
	private readonly still = window.matchMedia('(prefers-reduced-motion: reduce)');

	constructor(private readonly map: MapLibre) {}

	/** (Re)draws the party badges in the current theme's colours. */
	addImages() {
		const css = getComputedStyle(document.documentElement);
		for (const u of this.data?.units ?? []) {
			if (!u.party) continue;
			const id = badgeId(u.party.slot, u.party.short);
			const img = badgeImage(u.party.short, css.getPropertyValue(`--party-${u.party.slot}`).trim(), css.getPropertyValue(`--party-${u.party.slot}-ink`).trim());
			if (this.map.hasImage(id)) this.map.updateImage(id, img);
			else this.map.addImage(id, img, { pixelRatio: 2 });
		}
	}

	/** Makes the period's badge images, so the region labels can ask for them. */
	prepare(data: PowerLayerData | null) {
		this.data = data;
		this.addImages();
	}

	/** Shows a period; a new period arrives with motion, a change of focus only redraws. */
	set(data: PowerLayerData | null) {
		this.data = data;
		this.addImages();
		const fresh = Boolean(data && data.key !== this.key);
		const freshCoup = Boolean(data?.coup && data.coup.key !== this.coupKey);
		this.key = data?.key ?? null;
		this.coupKey = data?.coup?.key ?? null;
		const now = performance.now();
		if (this.still.matches) {
			this.start = this.coupStart = -Infinity;
			this.render(now);
			return;
		}
		if (fresh) this.start = now;
		if (freshCoup) this.coupStart = now;
		if ((fresh || freshCoup) && !this.frame) this.frame = requestAnimationFrame(this.tick);
		else if (!this.frame) this.render(now);
	}

	/** The badge image a unit's label should carry, if any. */
	static badgeFor(party?: { short: string; slot: number }) {
		return party ? badgeId(party.slot, party.short) : undefined;
	}

	destroy() {
		cancelAnimationFrame(this.frame);
	}

	private tick = (now: number) => {
		const busy = this.render(now);
		this.frame = busy ? requestAnimationFrame(this.tick) : 0;
	};

	/** Draws everything as it stands at `now`. Returns true while anything is still moving. */
	private render(now: number): boolean {
		const set = (id: string, fc: GeoJSON.FeatureCollection) => this.map.getSource<GeoJSONSource>(id)?.setData(fc);
		const d = this.data;
		if (!d) {
			for (const id of ['power-roads', 'power-coalitions', 'power-coalition-labels', 'power-capitals', 'power-ripples', 'power-coup-marks', 'power-coup-routes', 'power-coup-area-label'])
				set(id, EMPTY);
			return false;
		}
		const elapsed = now - this.start;
		let busy = false;
		const progress = (delay: number, ms: number, ease: (t: number) => number) => {
			const raw = clamp01((elapsed - delay) / ms);
			if (raw < 1) busy = true;
			return ease(raw);
		};

		const roads: GeoJSON.Feature[] = [];
		const ripples: GeoJSON.Feature[] = [];
		d.roads.forEach((r, i) => {
			const t = progress(MOTION.road.delay + i * MOTION.road.stagger, MOTION.road.ms, MOTION.road.ease);
			if (t > 0) roads.push({ type: 'Feature', properties: { color: r.color }, geometry: { type: 'LineString', coordinates: partOf(arc(r.from, r.to, -0.12), t) } });
		});
		d.pins.forEach((p, i) => {
			const raw = clamp01((elapsed - (MOTION.road.delay + i * MOTION.road.stagger)) / MOTION.ripple.ms);
			if (raw > 0 && raw < 1) {
				busy = true;
				const e = MOTION.ripple.ease(raw);
				ripples.push({ type: 'Feature', properties: { r: MOTION.ripple.from + (MOTION.ripple.to - MOTION.ripple.from) * e, o: 1 - e, color: p.color }, geometry: { type: 'Point', coordinates: p.point } });
			} else if (raw === 0) busy = true;
		});

		const rails: GeoJSON.Feature[] = [];
		const names: GeoJSON.Feature[] = [];
		d.coalitions.forEach((c, i) => {
			c.links.forEach(([a, b], j) => {
				const t = progress(MOTION.coalition.delay + i * MOTION.coalition.stagger + j * MOTION.coalition.linkStagger, MOTION.coalition.ms, MOTION.coalition.ease);
				if (t <= 0) return;
				// Coalitions that join the same regions bow to different sides, so their rails never lie on top of each other.
				const path = arc(a, b, BENDS[i % BENDS.length]);
				// The first rail carries the coalition's name along it, once it has finished drawing.
				const first = j === 0 && t >= 1;
				rails.push({
					type: 'Feature',
					properties: { id: c.id, dim: c.dim, selected: c.selected, first, name: `${c.name} · ${c.years}` },
					geometry: { type: 'LineString', coordinates: partOf(path, t) },
				});
			});
		});

		// The coup: its moments stamped in order, then its routes.
		const marks: GeoJSON.Feature[] = [];
		const coupRoutes: GeoJSON.Feature[] = [];
		const coup = d.coup;
		if (coup) {
			const since = now - this.coupStart;
			const ink = getComputedStyle(document.documentElement).getPropertyValue('--map-label-strong').trim();
			coup.moments.forEach((m, i) => {
				const at = MOTION.stamp.delay + i * MOTION.stamp.stagger;
				const raw = clamp01((since - at) / MOTION.stamp.pop);
				if (raw < 1) busy = true;
				if (raw <= 0) return;
				marks.push({
					type: 'Feature',
					properties: { mark: `mark-${m.mark}-l`, s: backOut(raw), o: raw, label: `${m.title}\n${m.when}`, order: i + 1 },
					geometry: { type: 'Point', coordinates: m.point },
				});
				const ring = clamp01((since - at) / MOTION.ripple.ms);
				if (ring > 0 && ring < 1) {
					const e = MOTION.ripple.ease(ring);
					ripples.push({ type: 'Feature', properties: { r: 8 + MOTION.ripple.to * e, o: 1 - e, color: ink }, geometry: { type: 'Point', coordinates: m.point } });
				}
			});
			coup.routes.forEach((r, i) => {
				const raw = clamp01((since - (MOTION.coupRoute.delay + i * MOTION.coupRoute.stagger)) / MOTION.coupRoute.ms);
				if (raw < 1) busy = true;
				if (raw <= 0) return;
				const path = r.path.length === 2 ? arc(r.path[0], r.path[1], 0.15) : smooth(r.path);
				coupRoutes.push({ type: 'Feature', properties: { label: r.label, done: raw >= 1 }, geometry: { type: 'LineString', coordinates: partOf(path, MOTION.coupRoute.ease(raw)) } });
			});
		}
		set('power-coup-marks', { type: 'FeatureCollection', features: marks });
		set('power-coup-routes', { type: 'FeatureCollection', features: coupRoutes });
		set('power-coup-area-label', {
			type: 'FeatureCollection',
			features: coup?.areaPoint ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: coup.areaPoint } }] : [],
		});

		set('power-roads', { type: 'FeatureCollection', features: roads });
		set('power-ripples', { type: 'FeatureCollection', features: ripples });
		set('power-coalitions', { type: 'FeatureCollection', features: rails });
		set('power-coalition-labels', { type: 'FeatureCollection', features: names });
		set('power-capitals', {
			type: 'FeatureCollection',
			features: d.capitals.map((c) => ({ type: 'Feature' as const, properties: { name: c.name }, geometry: { type: 'Point' as const, coordinates: c.point } })),
		});
		return busy;
	}
}
