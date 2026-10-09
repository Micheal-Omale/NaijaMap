// A small old-map of the two sides: each side's land as drawn on the history
// map (ruled land solid, tributaries faint), its capital, and the names of the
// self-ruling peoples it counts. Plain SVG: no map library on this page.

import { useMemo } from 'react';
import type { History } from '../../lib/types';
import type { Index, MemberAt, VersusData } from '../../lib/versus';

interface Side {
	members: MemberAt[];
	ink: string;
	seat: [number, number] | null;
}

const NIGERIA_BOX: [number, number, number, number] = [2.6, 4.2, 14.7, 13.9];
const W = 800;

export default function VersusMap({ history, base, ix, a, b, years }: { history: History; base: VersusData['map']; ix: Index; a: Side; b: Side; years: [number, number] }) {
	const view = useMemo(() => {
		const shapesOf = (side: Side) => {
			const keys = new Set(side.members.filter((m) => m.snapshot !== undefined).map((m) => `${m.id}|${m.snapshot}`));
			return history.shapes.features.filter((f) => keys.has(String(f.properties?.key)) && (f.properties?.layer === 'core' || f.properties?.layer === 'influence'));
		};
		const fa = shapesOf(a);
		const fb = shapesOf(b);
		// Frame both sides, never tighter than a good part of Nigeria.
		const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
		const add = (p: number[]) => {
			box[0] = Math.min(box[0], p[0]);
			box[1] = Math.min(box[1], p[1]);
			box[2] = Math.max(box[2], p[0]);
			box[3] = Math.max(box[3], p[1]);
		};
		const walk = (c: unknown): void => {
			if (typeof (c as number[])[0] === 'number') add(c as number[]);
			else for (const d of c as unknown[]) walk(d);
		};
		for (const f of [...fa, ...fb]) if ('coordinates' in f.geometry) walk(f.geometry.coordinates);
		for (const s of [a, b]) {
			if (s.seat) add(s.seat);
			for (const m of s.members) if (m.kind === 'society') for (const l of societyLabels(ix, m.id, years[s === a ? 0 : 1])) add(l);
		}
		if (!Number.isFinite(box[0])) box.splice(0, 4, ...NIGERIA_BOX);
		const cx = (box[0] + box[2]) / 2;
		const cy = (box[1] + box[3]) / 2;
		const half = Math.max((box[2] - box[0]) / 2 + 0.8, (box[3] - box[1]) / 2 / 0.7 + 0.8, 3.2);
		const frame: [number, number, number, number] = [cx - half, cy - half * 0.7, cx + half, cy + half * 0.7];
		const k = Math.cos((cy * Math.PI) / 180);
		const sx = W / ((frame[2] - frame[0]) * k);
		const H = Math.round((frame[3] - frame[1]) * sx);
		const xy = (p: number[]) => `${((p[0] - frame[0]) * k * sx).toFixed(1)},${((frame[3] - p[1]) * sx).toFixed(1)}`;
		const ring = (r: number[][]) => `M${r.map(xy).join('L')}Z`;
		const line = (r: number[][]) => `M${r.map(xy).join('L')}`;
		const path = (g: GeoJSON.Geometry) => (g.type === 'Polygon' ? g.coordinates.map(ring).join('') : g.type === 'MultiPolygon' ? g.coordinates.flatMap((p) => p.map(ring)).join('') : '');
		const pt = (p: [number, number]) => xy(p).split(',').map(Number) as [number, number];
		return { fa, fb, ring, line, path, pt, H, sx: sx * k };
	}, [history, base, ix, a, b, years]);

	const { fa, fb, ring, line, path, pt, H } = view;
	const layer = (fs: GeoJSON.Feature[], ink: string, id: string) =>
		['influence', 'core'].map((lay) => (
			<g key={`${id}-${lay}`}>
				{fs
					.filter((f) => f.properties?.layer === lay)
					.map((f, i) => (
						<path key={i} d={path(f.geometry)} fill={lay === 'core' ? ink : `url(#${id}-hatch)`} fillOpacity={lay === 'core' ? 0.5 : 0.9} stroke={ink} strokeWidth={lay === 'core' ? 1.6 : 1} strokeDasharray={f.properties?.conf === 'disputed' ? '5 4' : undefined} strokeOpacity={0.9} />
					))}
			</g>
		));

	const marks = (s: Side, y: number, key: string) => (
		<g key={key}>
			{s.members.map((m) =>
				m.kind === 'society'
					? societyLabels(ix, m.id, y).map((p, i) => {
							const [x, yy] = pt(p);
							return (
								<g key={`${m.id}-${i}`}>
									<circle cx={x} cy={yy} r="16" fill="none" stroke={s.ink} strokeWidth="1.5" strokeDasharray="3 3" />
									<text x={x} y={yy - 20} textAnchor="middle" className="vs-map__label" fill={s.ink}>
										{m.name}
									</text>
								</g>
							);
						})
					: m.capital && (
							<g key={m.id}>
								<circle cx={pt(m.capital.point)[0]} cy={pt(m.capital.point)[1]} r="4.5" fill={s.ink} stroke="var(--map-ink-halo)" strokeWidth="2" />
								<text x={pt(m.capital.point)[0] + 7} y={pt(m.capital.point)[1] + 4} className="vs-map__label" fill={s.ink}>
									{m.capital.name}
								</text>
							</g>
						),
			)}
		</g>
	);

	return (
		<svg className="vs-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="">
			<defs>
				{[
					['a', a.ink],
					['b', b.ink],
				].map(([id, ink]) => (
					<pattern key={id} id={`${id}-hatch`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform={`rotate(${id === 'a' ? 45 : -45})`}>
						<line x1="0" y1="0" x2="0" y2="7" stroke={ink} strokeWidth="1.6" strokeOpacity="0.45" />
					</pattern>
				))}
			</defs>
			<rect width={W} height={H} className="vs-map__sea" />
			<path d={base.land.map(ring).join('')} className="vs-map__land" />
			<path d={base.nigeria.map(ring).join('')} className="vs-map__nigeria" />
			<path d={base.rivers.map(line).join('')} className="vs-map__river" />
			{layer(fa, a.ink, 'a')}
			{layer(fb, b.ink, 'b')}
			{marks(a, years[0], 'ma')}
			{marks(b, years[1], 'mb')}
		</svg>
	);
}

function societyLabels(ix: Index, member: string, y: number): [number, number][] {
	const s = ix.societies.get(member.slice(8));
	return (s?.lands ?? []).filter((l) => l.from <= y && y <= l.to).map((l) => l.label);
}
