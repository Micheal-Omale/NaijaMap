// The history view's signs as SVG, for the key, the hover cards and the event
// panel. Drawn from the same definitions as the map's own icons (glyphs.ts), so
// what a visitor reads in the key is exactly what they see on the map.

import { COLONIAL_INK } from '../../lib/ink';
import type { MarkKind, Vessel } from '../../lib/types';
import { MARKS, SAILCLOTH, SHIPS, type LineStyle } from './glyphs';

/** A mark's badge: a parchment roundel, or a scarlet square for colonial forces. */
export function MarkIcon({ mark, colonial = false, size = 22 }: { mark: MarkKind; colonial?: boolean; size?: number }) {
	const g = MARKS[mark];
	const ink = colonial ? 'var(--surface)' : 'var(--map-label-strong)';
	return (
		<svg className="mark-icon" width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
			{colonial ? (
				<rect x="3" y="3" width="22" height="22" rx="3.2" fill={COLONIAL_INK} stroke="var(--surface)" strokeWidth="1.6" />
			) : (
				<circle cx="14" cy="14" r="11.5" fill="var(--surface)" stroke="var(--map-label-strong)" strokeWidth="1.6" />
			)}
			<g transform="translate(5.84 5.84) scale(0.68)">
				{g.fill && <path d={g.fill} fill={ink} />}
				{g.stroke && <path d={g.stroke} fill="none" stroke={ink} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />}
			</g>
		</svg>
	);
}

/**
 * A short sample of a line as the map draws it: its width, its dashes (in line
 * widths, as MapLibre reads them), a rail for an alliance, an arrowhead for a
 * route that goes somewhere.
 */
export function LineSample({ style, color, width = 34 }: { style: LineStyle; color: string; width?: number }) {
	const w = Math.max(1.4, style.width * 0.8);
	const dash = style.dash?.map((d) => Math.max(d * w, 0.01)).join(' ');
	const end = style.arrow ? width - 7 : width - 2;
	return (
		<svg className="line-sample" width={width} height="14" viewBox={`0 0 ${width} 14`} aria-hidden="true">
			{!style.double && <line x1="2" y1="7" x2={end} y2="7" stroke="var(--surface)" strokeWidth={w + 3} strokeLinecap="round" />}
			<line x1="2" y1="7" x2={end} y2="7" stroke={color} strokeWidth={w} strokeLinecap="round" strokeDasharray={dash} />
			{style.double && <line x1="2" y1="7" x2={end} y2="7" stroke="var(--surface)" strokeWidth={w * 0.36} strokeLinecap="round" />}
			{style.arrow && <path d={`M${width - 1.5} 7 L${width - 9} 2.6 L${width - 7} 7 L${width - 9} 11.4 Z`} fill={color} stroke="var(--surface)" strokeWidth="1" strokeLinejoin="round" />}
		</svg>
	);
}

/** A ship as the map draws it, bow to the right, in the colonial ink. */
export function ShipIcon({ vessel, size = 30 }: { vessel: Vessel; size?: number }) {
	const g = SHIPS[vessel];
	return (
		<svg className="ship-icon" width={size} height={(size * 24) / 32} viewBox="0 0 32 24" aria-hidden="true">
			<g fill="none" stroke="var(--surface)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
				<path d={g.fill} />
				{g.paper && <path d={g.paper} />}
				{g.stroke && <path d={g.stroke} />}
			</g>
			{g.stroke && <path d={g.stroke} fill="none" stroke={COLONIAL_INK} strokeWidth="1.4" strokeLinecap="round" />}
			<path d={g.fill} fill={COLONIAL_INK} />
			{g.paper && <path d={g.paper} fill={SAILCLOTH} stroke={COLONIAL_INK} strokeWidth="1.2" strokeLinejoin="round" />}
		</svg>
	);
}
