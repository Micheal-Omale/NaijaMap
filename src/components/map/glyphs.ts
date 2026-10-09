// The history view's sign language: one glyph per kind of moment, one line style
// per kind of route or link. The same definitions draw the icons on the map
// (canvas, in MapView) and the samples in the key, the hover cards and the event
// panel (SVG, in Marks.tsx), so a mark always means the same thing.

import type { EventKind, LinkKind, MarkKind, RouteKind, Vessel } from '../../lib/types';

/** A glyph on a 24×24 grid: stroked paths, plus optional filled ones. */
export interface Glyph {
	stroke?: string;
	fill?: string;
}

export const MARKS: Record<MarkKind, Glyph> = {
	// Crossed swords with their guards.
	battle: { stroke: 'M5.5 5.5l13 13M18.5 5.5l-13 13M4 15.5l4.5 4.5M15.5 20l4.5-4.5' },
	// An ambush or killing: a struck-through ring.
	massacre: { stroke: 'M12 4a8 8 0 110 16 8 8 0 010-16zM7 7l10 10' },
	// A shell bursting.
	bombarded: { fill: 'M12 2.5l1.9 5 5-2.1-2.1 5 5 1.9-5 1.9 2.1 5-5-2.1L12 21.5l-1.9-5-5 2.1 2.1-5-5-1.9 5-1.9-2.1-5 5 2.1z' },
	burned: { fill: 'M12 2.8c.9 3.9 5.4 5.6 5.4 10.6a5.4 5.4 0 01-10.8 0c0-2.6 1.4-4.2 2.5-5.3.4 2 1.4 3.1 2.5 3.2-.3-3 .2-5.6.4-8.5z' },
	// Taken: a closed lock.
	captured: { stroke: 'M6.5 11h11v9h-11zM9 11V8.2a3 3 0 016 0V11' },
	founded: { stroke: 'M6.5 21V3.5', fill: 'M7.5 4h10.5l-2.6 4 2.6 4H7.5z' },
	// An agreement: two linked rings.
	treaty: { stroke: 'M9 8.2a3.8 3.8 0 110 7.6 3.8 3.8 0 010-7.6zM15 8.2a3.8 3.8 0 110 7.6 3.8 3.8 0 010-7.6z' },
	camp: { stroke: 'M3 20L12 4.5 21 20zM12 4.5V20M8.8 20l3.2-5.2 3.2 5.2' },
	garrison: { stroke: 'M5 21V9.5h14V21M5 9.5V5h2.6v2h2.2V5h4.4v2h2.2V5H19v4.5M10 21v-5h4v5' },
	// Sent away: an arrow leaving a wall.
	exile: { stroke: 'M4.5 4v16M8 12h11.5M15 7.5l4.5 4.5-4.5 4.5' },
	flight: { stroke: 'M5 6l6 6-6 6M12 6l6 6-6 6' },
	// Carried off: a chest.
	loot: { stroke: 'M4 10.5h16V20H4zM4 10.5l2.2-4.5h11.6l2.2 4.5M10 14h4' },
	shrine: { stroke: 'M4 20.5h16M6.5 20.5V11M17.5 20.5V11M3 11.5L12 4l9 7.5M10 20.5v-4.5h4v4.5' },
	// Ships from Europe at anchor: a ring, a shank and two flukes.
	anchor: { stroke: 'M12 3.5a2 2 0 110 4 2 2 0 010-4zM12 7.5v13M8.5 10.5h7M4.8 13.8c.5 4 3.4 6.7 7.2 6.7s6.7-2.7 7.2-6.7M3.4 15.4l1.4-1.6 1.7 1.3M20.6 15.4l-1.4-1.6-1.7 1.3' },
};

/** Lines on the map. `dash` is in line widths, as MapLibre reads it; `double` draws a rail of two lines. */
export interface LineStyle {
	width: number;
	dash?: number[];
	double?: boolean;
	/** Drawn with an arrowhead at the end. */
	arrow?: boolean;
}

export const ROUTES: Record<RouteKind, LineStyle> = {
	advance: { width: 2.8, arrow: true },
	retreat: { width: 2, dash: [2, 1.4], arrow: true },
	raid: { width: 2.3, dash: [3, 1.2, 0.5, 1.2], arrow: true },
	migration: { width: 3, dash: [0.1, 1.7], arrow: true },
	exile: { width: 1.8, dash: [4, 1.8], arrow: true },
	loot: { width: 1.8, dash: [1, 1.2], arrow: true },
	alliance: { width: 5, double: true },
	// A sea lane or a river voyage: a light dashed wake behind the ship that sails it.
	voyage: { width: 1.7, dash: [2.4, 2.2] },
};

/** Polity links, as history-style draws them. */
export const LINKS: Record<LinkKind, LineStyle> = {
	tribute: { width: 1.6, dash: [3, 2] },
	trade: { width: 2, dash: [0.2, 2] },
	war: { width: 1.6 },
	ritual: { width: 1.4, dash: [5, 2, 1, 2] },
	descent: { width: 1.1, dash: [0.6, 1.8] },
};

/** The mark that stands for a whole event, in lists and on the timeline. */
export const EVENT_MARK: Record<EventKind, MarkKind> = {
	war: 'battle',
	raid: 'flight',
	alliance: 'treaty',
	migration: 'founded',
	colonial: 'bombarded',
	partition: 'captured',
	contact: 'anchor',
};

/** Sailcloth: a cream that stays light in both themes, so a ship keeps its shape on a dark sea. */
export const SAILCLOTH = '#f2e4c4';

/**
 * Ships seen from the side, as the old charts drew them, bow to the right on a
 * 32×24 grid: `fill` in ink (hull, funnel), `paper` as sailcloth outlined in ink
 * (sails, smoke), `stroke` as ink lines (masts, rigging). Mirrored to sail west.
 */
export interface ShipGlyph {
	fill: string;
	paper?: string;
	stroke?: string;
}

export const SHIPS: Record<Vessel, ShipGlyph> = {
	// A square-rigged ship of the sailing age: two masts, bellied sails, a pennant.
	sail: {
		fill: 'M3 15h25.2l2.6-2.2-2.9 7.4H6.6zM12.4 2.6l4 1.1-4 1.1z',
		paper: 'M8 4.8h7.6c1 2.8 1 5.6 0 8.4H8c1-2.8 1-5.6 0-8.4zM18.2 6.8h6.4c.8 2.2.8 4.4 0 6.6h-6.4c.8-2.2.8-4.4 0-6.6z',
		stroke: 'M12.4 15V2.6M21.4 15V5.4M28.4 13.2l2.6-4.6',
	},
	// A paddle steamer of the Niger expeditions: funnel, paddle box, a mast for sail.
	steam: {
		fill: 'M2.6 15.4h27l-3 5H6.2zM7.6 12.4h14.4v3H7.6zM11 5.6h3.4v6.8H11zM16.6 15.4a3.5 3.5 0 017 0z',
		paper: 'M9.6 4.8a2 2 0 113.4-1.6 2.4 2.4 0 014.2 1.4 2 2 0 01-1.2 3.4H9.8a1.7 1.7 0 01-.2-3.2z',
		stroke: 'M25.4 15.4V6.4M5.4 15.4V9.6',
	},
};

/** Draws a ship for the map, facing east or west, in one ink with a paper halo so it reads over sea and land. */
export function shipImage(vessel: Vessel, west: boolean, ink: string, paper: string, px = 96) {
	const canvas = document.createElement('canvas');
	canvas.width = px;
	canvas.height = Math.round((px * 24) / 32);
	const ctx = canvas.getContext('2d')!;
	const s = px / 32;
	if (west) {
		ctx.translate(px, 0);
		ctx.scale(-1, 1);
	}
	ctx.scale(s, s);
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	const g = SHIPS[vessel];
	const paths = { fill: new Path2D(g.fill), paper: g.paper ? new Path2D(g.paper) : null, stroke: g.stroke ? new Path2D(g.stroke) : null };
	// The halo first, under everything.
	ctx.strokeStyle = paper;
	ctx.lineWidth = 3.4;
	for (const p of [paths.fill, paths.paper, paths.stroke]) if (p) ctx.stroke(p);
	ctx.fillStyle = ink;
	ctx.strokeStyle = ink;
	ctx.lineWidth = 1.4;
	if (paths.stroke) ctx.stroke(paths.stroke);
	ctx.fill(paths.fill);
	if (paths.paper) {
		ctx.fillStyle = SAILCLOTH;
		ctx.fill(paths.paper);
		ctx.lineWidth = 1.2;
		ctx.stroke(paths.paper);
	}
	return { width: canvas.width, height: canvas.height, data: ctx.getImageData(0, 0, canvas.width, canvas.height).data };
}

/**
 * Draws a mark as a badge for the map: a parchment roundel for the peoples of
 * the region, a scarlet square for colonial forces, so a conquest reads as
 * foreign by shape as well as colour.
 */
export function markImage(mark: MarkKind, colonial: boolean, ink: { paper: string; sepia: string; red: string }, px = 46) {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = px;
	const ctx = canvas.getContext('2d')!;
	const s = px / 28;
	ctx.scale(s, s);
	// Badge.
	ctx.beginPath();
	if (colonial) {
		const r = 3.2;
		ctx.moveTo(3 + r, 3);
		ctx.arcTo(25, 3, 25, 25, r);
		ctx.arcTo(25, 25, 3, 25, r);
		ctx.arcTo(3, 25, 3, 3, r);
		ctx.arcTo(3, 3, 25, 3, r);
		ctx.closePath();
		ctx.fillStyle = ink.red;
		ctx.fill();
		ctx.lineWidth = 1.6;
		ctx.strokeStyle = ink.paper;
		ctx.stroke();
	} else {
		ctx.arc(14, 14, 11.5, 0, Math.PI * 2);
		ctx.fillStyle = ink.paper;
		ctx.fill();
		ctx.lineWidth = 1.6;
		ctx.strokeStyle = ink.sepia;
		ctx.stroke();
	}
	// Glyph, scaled into the badge.
	ctx.translate(14 - 12 * 0.68, 14 - 12 * 0.68);
	ctx.scale(0.68, 0.68);
	const color = colonial ? ink.paper : ink.sepia;
	const g = MARKS[mark];
	if (g.fill) {
		ctx.fillStyle = color;
		ctx.fill(new Path2D(g.fill));
	}
	if (g.stroke) {
		ctx.strokeStyle = color;
		ctx.lineWidth = 2.3;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.stroke(new Path2D(g.stroke));
	}
	return { width: px, height: px, data: ctx.getImageData(0, 0, px, px).data };
}

/** An arrowhead pointing north, in one ink; the map turns it along its route. */
export function arrowImage(color: string, halo: string, px = 30) {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = px;
	const ctx = canvas.getContext('2d')!;
	const s = px / 20;
	ctx.scale(s, s);
	ctx.beginPath();
	ctx.moveTo(10, 2.5);
	ctx.lineTo(17, 16.5);
	ctx.lineTo(10, 13);
	ctx.lineTo(3, 16.5);
	ctx.closePath();
	ctx.lineJoin = 'round';
	ctx.lineWidth = 2.4;
	ctx.strokeStyle = halo;
	ctx.stroke();
	ctx.fillStyle = color;
	ctx.fill();
	return { width: px, height: px, data: ctx.getImageData(0, 0, px, px).data };
}

/** Hatching for one piece of a partitioned kingdom: each piece runs its lines another way. */
export function pieceImage(color: string, index: number, size = 10) {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext('2d')!;
	ctx.strokeStyle = color;
	ctx.globalAlpha = 0.85;
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	const way = index % 4;
	for (const o of [-size, 0, size]) {
		if (way === 0) {
			ctx.moveTo(o, size);
			ctx.lineTo(o + size, 0);
		} else if (way === 1) {
			ctx.moveTo(o, 0);
			ctx.lineTo(o + size, size);
		} else if (way === 2) {
			ctx.moveTo(0, size / 2 + o);
			ctx.lineTo(size, size / 2 + o);
		} else {
			ctx.moveTo(size / 2 + o, 0);
			ctx.lineTo(size / 2 + o, size);
		}
	}
	ctx.stroke();
	return { width: size, height: size, data: ctx.getImageData(0, 0, size, size).data };
}

/** A town's dot, split into one wedge per founding people (Illah: Igbo, Igala and Benin), on a paper rim. */
export function townImage(colors: string[], rim: string, size = 22) {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext('2d')!;
	const c = size / 2;
	const r = size / 2 - 3;
	const step = (Math.PI * 2) / Math.max(1, colors.length);
	for (const [i, color] of colors.entries()) {
		ctx.beginPath();
		ctx.moveTo(c, c);
		ctx.arc(c, c, r, -Math.PI / 2 + i * step, -Math.PI / 2 + (i + 1) * step);
		ctx.closePath();
		ctx.fillStyle = color;
		ctx.fill();
	}
	// Thin paper lines between the wedges, so two close inks still read as two.
	if (colors.length > 1) {
		ctx.strokeStyle = rim;
		ctx.lineWidth = 1.2;
		for (let i = 0; i < colors.length; i++) {
			const a = -Math.PI / 2 + i * step;
			ctx.beginPath();
			ctx.moveTo(c, c);
			ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
			ctx.stroke();
		}
	}
	return { width: size, height: size, data: ctx.getImageData(0, 0, size, size).data };
}

/** A crown in the colonial ink on a paper disc: a throne the colonial government made, restored or filled. */
export function crownImage(ink: string, paper: string, size = 28) {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext('2d')!;
	const c = size / 2;
	ctx.beginPath();
	ctx.arc(c, c, c - 1.5, 0, Math.PI * 2);
	ctx.fillStyle = paper;
	ctx.fill();
	ctx.lineWidth = 1.6;
	ctx.strokeStyle = ink;
	ctx.stroke();
	// Three points and a band, drawn on the 24 grid of the other marks.
	const k = size / 24;
	ctx.beginPath();
	ctx.moveTo(6 * k, 16 * k);
	ctx.lineTo(5.5 * k, 8.5 * k);
	ctx.lineTo(9.3 * k, 11.5 * k);
	ctx.lineTo(12 * k, 6.5 * k);
	ctx.lineTo(14.7 * k, 11.5 * k);
	ctx.lineTo(18.5 * k, 8.5 * k);
	ctx.lineTo(18 * k, 16 * k);
	ctx.closePath();
	ctx.fillStyle = ink;
	ctx.fill();
	ctx.fillRect(6 * k, 17 * k, 12 * k, 1.8 * k);
	return { width: size, height: size, data: ctx.getImageData(0, 0, size, size).data };
}

/** A warrant chief: a sealed document in the colonial ink on a paper disc. Appointed, not crowned by custom. */
export function warrantImage(ink: string, paper: string, size = 28) {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext('2d')!;
	const c = size / 2;
	const k = size / 24;
	ctx.beginPath();
	ctx.arc(c, c, c - 1.5, 0, Math.PI * 2);
	ctx.fillStyle = paper;
	ctx.fill();
	ctx.lineWidth = 1.6;
	ctx.strokeStyle = ink;
	ctx.stroke();
	// The warrant: a sheet with two lines of writing, and a round seal at its foot.
	ctx.lineWidth = 1.5 * k;
	ctx.strokeRect(7 * k, 5.5 * k, 10 * k, 12 * k);
	ctx.beginPath();
	ctx.moveTo(9.5 * k, 9 * k);
	ctx.lineTo(14.5 * k, 9 * k);
	ctx.moveTo(9.5 * k, 12 * k);
	ctx.lineTo(14.5 * k, 12 * k);
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(15.5 * k, 17 * k, 2.6 * k, 0, Math.PI * 2);
	ctx.fillStyle = ink;
	ctx.fill();
	return { width: size, height: size, data: ctx.getImageData(0, 0, size, size).data };
}
