// A fighter's portrait: the land the side held in that year, drawn alone and
// large, in its ink. A people with no drawn land (they ruled themselves, town by
// town) shows its initial instead.

import { useMemo } from 'react';
import type { History } from '../../lib/types';
import type { Index, MemberAt } from '../../lib/versus';

const SIZE = 240;
const PAD = 14;

export default function Crest({ history, ix, members, year, side, label }: { history: History; ix: Index; members: MemberAt[]; year: number; side: 'a' | 'b'; label: string }) {
	const shape = useMemo(() => {
		const keys = new Set(members.filter((m) => m.snapshot !== undefined).map((m) => `${m.id}|${m.snapshot}`));
		const fs = history.shapes.features.filter((f) => keys.has(String(f.properties?.key)) && (f.properties?.layer === 'core' || f.properties?.layer === 'influence'));
		const pts: number[][] = [];
		const walk = (c: unknown): void => {
			if (typeof (c as number[])[0] === 'number') pts.push(c as number[]);
			else for (const d of c as unknown[]) walk(d);
		};
		for (const f of fs) if ('coordinates' in f.geometry) walk(f.geometry.coordinates);
		// Societies have no drawn land: mark their homes as dots instead.
		const dots: [number, number][] = [];
		for (const m of members) {
			if (m.kind !== 'society') continue;
			for (const l of ix.societies.get(m.id.slice(8))?.lands ?? []) if (l.from <= year && year <= l.to) dots.push(l.label);
		}
		pts.push(...dots);
		if (!pts.length) return null;
		const xs = pts.map((p) => p[0]);
		const ys = pts.map((p) => p[1]);
		const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
		const k = Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
		const span = Math.max((x1 - x0) * k, y1 - y0, 0.6);
		const s = (SIZE - PAD * 2) / span;
		const ox = PAD + (SIZE - PAD * 2 - (x1 - x0) * k * s) / 2;
		const oy = PAD + (SIZE - PAD * 2 - (y1 - y0) * s) / 2;
		const xy = (p: number[]) => `${(ox + (p[0] - x0) * k * s).toFixed(1)},${(oy + (y1 - p[1]) * s).toFixed(1)}`;
		const ring = (r: number[][]) => `M${r.map(xy).join('L')}Z`;
		const path = (g: GeoJSON.Geometry) => (g.type === 'Polygon' ? g.coordinates.map(ring).join('') : g.type === 'MultiPolygon' ? g.coordinates.flatMap((p) => p.map(ring)).join('') : '');
		return {
			core: fs.filter((f) => f.properties?.layer === 'core').map((f) => path(f.geometry)).join(''),
			influence: fs.filter((f) => f.properties?.layer === 'influence').map((f) => path(f.geometry)).join(''),
			dots: dots.map((p) => xy(p).split(',').map(Number) as [number, number]),
			capitals: members.flatMap((m) => (m.capital ? [xy(m.capital.point).split(',').map(Number) as [number, number]] : [])),
		};
	}, [history, ix, members, year]);

	return (
		<div className="vs-crest" aria-hidden="true">
			{shape ? (
				<svg viewBox={`0 0 ${SIZE} ${SIZE}`}>
					<defs>
						<pattern id={`crest-hatch-${side}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
							<line x1="0" y1="0" x2="0" y2="6" className="vs-crest__hatch" />
						</pattern>
					</defs>
					{shape.influence && <path d={shape.influence} className="vs-crest__influence" fill={`url(#crest-hatch-${side})`} />}
					{shape.core && <path d={shape.core} className="vs-crest__core" />}
					{shape.dots.map(([x, y], i) => (
						<circle key={i} cx={x} cy={y} r="13" className="vs-crest__dot" />
					))}
					{shape.capitals.map(([x, y], i) => (
						<g key={i} className="vs-crest__capital">
							<circle cx={x} cy={y} r="9" />
							<circle cx={x} cy={y} r="3.5" />
						</g>
					))}
				</svg>
			) : (
				<span className="vs-crest__letter">{label.replace(/^All the /, '').charAt(0)}</span>
			)}
		</div>
	);
}
