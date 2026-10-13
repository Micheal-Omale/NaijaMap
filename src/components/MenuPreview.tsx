// A view's preview card in the menu: the view's own map, tiny and in its own look,
// playing a second of its signature motion, so a visitor knows what a view feels
// like before opening it. The atlas fills in with colour; the old map soaks in its
// kingdoms and a pen draws Oyo's frontier; the regions of power light up and their
// leaders' roads run to Lagos; the two sides of Versus wipe in and the seal stamps.

import type { View } from './SiteMenu';
import type { PREVIEWS } from './menu-previews';

export type Previews = typeof PREVIEWS;

interface Props {
	view: View;
	/** The cards' drawings, fetched with the menu's first opening; until then, the card's ground. */
	data: Previews | null;
	/** Played again on demand: straight away, not in turn after the cards above it. */
	replay?: boolean;
	icon: React.ReactNode;
}

export default function MenuPreview({ view, data, replay, icon }: Props) {
	return (
		<span className={`menu-preview menu-preview--${view}`} data-replay={replay ? 'true' : undefined} aria-hidden="true">
			{data && <Drawing view={view} data={data} />}
			<span className="menu-preview__badge">{icon}</span>
		</span>
	);
}

function Drawing({ view, data }: { view: View; data: Previews }) {
	const [w, h] = data.box;
	if (view === 'versus') {
		const { a, b } = data.versus;
		return (
			<svg viewBox={`0 0 ${w} ${h}`}>
				<g className="menu-preview__side menu-preview__side--a">
					<path className="menu-preview__ink" d={`M0 0H${w}V${h * 0.46}L0 ${h * 0.54}Z`} />
					<path className="menu-preview__land" d={a.d} />
				</g>
				<g className="menu-preview__side menu-preview__side--b">
					<path className="menu-preview__ink" d={`M0 ${h * 0.54}L${w} ${h * 0.46}V${h}H0Z`} />
					<path className="menu-preview__land" d={b.d} />
				</g>
				<g className="menu-preview__seal">
					<circle cx={w / 2} cy={h / 2} r="13" />
					<text x={w / 2} y={h / 2} dy="0.36em" textAnchor="middle">
						VS
					</text>
				</g>
			</svg>
		);
	}
	const shapes =
		view === 'today'
			? data.peoples.map((s, i) => <path key={i} className="menu-preview__area" d={s.d} fill={s.fill} style={{ '--i': i } as React.CSSProperties} />)
			: view === 'then'
				? data.kingdoms.shapes.map((s, i) => (
						<path key={i} className={`menu-preview__${s.layer === 'core' ? 'core' : 'reach'}`} d={s.d} fill={s.fill} stroke={s.fill} style={{ '--i': i } as React.CSSProperties} />
					))
				: data.politics.regions.map((s, i) => <path key={i} className="menu-preview__area" d={s.d} fill={s.fill} style={{ '--i': i * 4 } as React.CSSProperties} />);
	return (
		<svg viewBox={`0 0 ${w} ${h}`}>
			<path className="menu-preview__land" d={data.outline} />
			{shapes}
			<path className="menu-preview__outline" d={data.outline} />
			{view === 'then' && (
				<>
					<path className="menu-preview__pen" d={data.kingdoms.pen} pathLength={1} />
					<text className="menu-preview__year" x="6" y={h - 7}>
						{data.kingdoms.year}
					</text>
				</>
			)}
			{view === 'power' && (
				<>
					{data.politics.roads.map((r, i) => (
						<g key={i}>
							<path className="menu-preview__road" d={r.d} pathLength={1} style={{ '--i': i } as React.CSSProperties} />
							<circle className="menu-preview__home" cx={r.home[0]} cy={r.home[1]} r="2.6" />
						</g>
					))}
					<circle className="menu-preview__seat" cx={data.politics.seat[0]} cy={data.politics.seat[1]} r="4" />
				</>
			)}
		</svg>
	);
}
