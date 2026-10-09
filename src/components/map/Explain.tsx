// Says what something on the history map means: a tribute line, a line of
// march, a bombardment, the piece of a divided kingdom, a people who ruled themselves. One explanation serves
// the card that follows the mouse and the card pinned where a finger tapped.

import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Translate } from '../../i18n/utils';
import { COLONIAL_INK } from '../../lib/ink';
import { activeAt, snapshotAt } from '../../lib/timeline';
import type { Confidence, History, MarkKind, Vessel } from '../../lib/types';
import { LINKS, ROUTES, type LineStyle } from './glyphs';
import type { MapItem } from './history-map';
import { LineSample, MarkIcon, ShipIcon } from './Marks';
import { ConfidenceBadge } from './Profile';

export interface Explained {
	/** What kind of thing it is, and whose. */
	kicker: string;
	title: string;
	text?: string;
	when?: string;
	/** What this kind of line or mark means, as the key would say it. */
	meaning?: string;
	sample: { mark: MarkKind; colonial: boolean } | { line: LineStyle; color: string; ship?: Vessel } | { swatch: string } | { people: true } | { town: string[] } | { crown: true; warrant: boolean };
	color: string;
	confidence?: Confidence;
	note?: string;
	/** Where the visitor can go from here. */
	polity?: { id: string; name: string };
	event?: { id: string; name: string };
	/** Atlas profiles of a self-governing people, for the jump to today. */
	groups?: { id: string; name: string }[];
	/** Read on in the pinned card only: how their independence ended. */
	more?: string;
	/** Who crowned or installed a ruler, and how sure that is. */
	crowned?: { by: string; text: string; confidence: Confidence };
	/** A town's founding peoples, each in the ink of its thread. */
	founders?: { people: string; color: string; quarters: string[]; text: string; from?: string }[];
	/** The states a town was under, in order; `now` marks the one in the chosen year. */
	under?: { name: string; color: string; when: string; kind: string; text: string; now: boolean }[];
}

const SURENESS: Record<Confidence, number> = { high: 2, medium: 1, disputed: 0 };
const weaker = (a: Confidence, b: Confidence): Confidence => (SURENESS[a] <= SURENESS[b] ? a : b);

export function explain(item: MapItem, history: History, year: number, tr: Translate): Explained | null {
	const { t } = tr;
	if (item.type === 'moment' || item.type === 'route' || item.type === 'piece') {
		const e = history.events.find((x) => x.id === item.event);
		if (!e) return null;
		const lead = e.polities[0] ? history.polities.find((p) => p.id === e.polities[0]) : undefined;
		const base = { event: { id: e.id, name: e.name }, polity: lead ? { id: lead.id, name: lead.name } : undefined };
		if (item.type === 'moment') {
			const m = e.moments[item.index];
			if (!m) return null;
			return {
				...base,
				kicker: `${t(`mark.${m.mark}`)} · ${e.name}`,
				title: m.title,
				text: m.text,
				when: [m.when, m.at?.name].filter(Boolean).join(' · '),
				sample: { mark: m.mark, colonial: m.colonial },
				color: m.colonial ? COLONIAL_INK : 'var(--map-label-strong)',
				confidence: m.confidence ?? e.confidence,
			};
		}
		if (item.type === 'route') {
			const r = e.routes[item.index];
			if (!r) return null;
			return {
				...base,
				kicker: `${t(`route.${r.kind}`)} · ${e.name}`,
				title: r.label,
				when: [r.when ?? e.yearLabel ?? String(e.year), r.by ? t('event.by', { name: r.by }) : ''].filter(Boolean).join(' · '),
				meaning: t(`route.${r.kind}.help`),
				sample: { line: ROUTES[r.kind], color: r.color, ship: r.vessel },
				color: r.color,
				confidence: r.confidence ?? e.confidence,
				note: r.note,
			};
		}
		const piece = e.pieces[item.index];
		if (!piece) return null;
		const swatch = history.pieces.features.find((f) => f.properties?.e === e.id && f.properties?.i === item.index)?.properties?.color ?? COLONIAL_INK;
		return {
			...base,
			kicker: `${t('event.kind.partition')} · ${e.name}`,
			title: piece.name,
			text: piece.note,
			when: e.yearLabel ?? String(e.year),
			meaning: t('event.piece.help'),
			sample: { swatch: String(swatch) },
			color: String(swatch),
			confidence: e.confidence,
		};
	}

	if (item.type === 'society') {
		const s = history.societies.find((x) => x.id === item.society);
		const land = s?.lands[item.land];
		if (!s || !land) return null;
		return {
			kicker: t(`society.rule.${s.rule}`),
			title: land.name,
			text: s.summary.text,
			when: t('society.when', { from: s.span.fromLabel ?? String(s.span.from), to: s.span.toLabel ?? String(s.span.to) }),
			meaning: t('society.help'),
			sample: { people: true },
			color: 'var(--map-label-strong)',
			// The weaker of what is said about them and the years they are shown for.
			confidence: land.confidence ?? weaker(s.summary.confidence, s.span.confidence),
			note: land.note,
			groups: s.groups,
			more: s.end?.text,
		};
	}

	if (item.type === 'throne') {
		const th = history.thrones.find((x) => x.id === item.throne);
		if (!th) return null;
		const p = th.polity ? history.polities.find((x) => x.id === th.polity) : undefined;
		const when = th.yearLabel ?? String(th.year);
		return {
			kicker: t(`throne.kind.${th.kind}`),
			title: th.title,
			when: [th.until ? t('throne.span', { from: when, to: th.until }) : when, th.seat.name, th.first ? t('throne.first', { name: th.first }) : ''].filter(Boolean).join(' · '),
			text: th.text,
			meaning: t('throne.help', { by: th.by }),
			sample: { crown: true, warrant: th.kind === 'warrant' },
			color: COLONIAL_INK,
			confidence: th.confidence,
			note: th.note,
			polity: p ? { id: p.id, name: p.name } : undefined,
			groups: th.groups,
			crowned: th.crowned ? { by: th.crowned.by, text: th.crowned.text, confidence: th.crowned.confidence } : undefined,
		};
	}

	if (item.type === 'town') {
		const town = history.towns.find((x) => x.id === item.town);
		if (!town) return null;
		const peoples = [...new Set(town.founders.map((f) => f.people))];
		const now = town.under.find((u) => u.from <= year && year <= u.to);
		const lead = now ? history.polities.find((x) => x.id === now.polity) : undefined;
		return {
			kicker: peoples.length > 1 ? t('town.kicker.many', { peoples: peoples.join(', ') }) : t('town.kicker.one', { people: peoples[0] }),
			title: town.name,
			when: [town.founded.yearLabel ?? String(town.founded.year), now ? t(`town.under.${now.kind}`, { name: now.polityName }) : ''].filter(Boolean).join(' · '),
			text: town.summary.text,
			meaning: t('town.help'),
			sample: { town: [...new Set(town.founders.map((f) => f.color))] },
			color: now?.color ?? town.founders[0].color,
			confidence: weaker(town.summary.confidence, town.founded.confidence),
			polity: lead ? { id: lead.id, name: lead.name } : undefined,
			groups: [...new Map(town.founders.flatMap((f) => (f.group ? [[f.group.id, f.group] as const] : []))).values()],
			founders: town.founders.map((f) => ({ people: f.people, color: f.color, quarters: f.quarters, text: f.text, from: f.from?.name })),
			under: town.under.map((u) => ({ name: u.polityName, color: u.color, when: `${u.from}–${u.to}`, kind: t(`town.kind.${u.kind}`), text: u.text, now: u === now })),
		};
	}

	const p = history.polities.find((x) => x.id === item.polity);
	if (!p) return null;
	const at = snapshotAt(p, year);
	const snap = at >= 0 ? p.snapshots[at] : undefined;
	const polity = { id: p.id, name: p.name };
	if (item.type === 'link') {
		const s = p.snapshots[item.snapshot];
		const l = s?.links[item.index];
		if (!s || !l) return null;
		return {
			polity,
			kicker: `${t(`then.key.${l.kind}`)} · ${p.name}`,
			title: l.label ?? l.to.name,
			when: s.yearLabel ?? String(s.year),
			meaning: t(`link.${l.kind}.help`),
			sample: { line: LINKS[l.kind], color: p.color },
			color: p.color,
			confidence: l.confidence ?? s.confidence,
			note: l.note,
		};
	}
	if (item.type === 'place') {
		return {
			polity,
			kicker: item.kind === 'seat' ? t('explain.seat', { title: p.today.title ?? p.name }) : t(item.kind === 'capital' ? 'explain.capital' : 'explain.node', { name: p.name }),
			title: item.name,
			text: item.kind === 'seat' ? p.today.text : snap?.title,
			when: item.kind === 'seat' ? undefined : (snap?.yearLabel ?? (snap ? String(snap.year) : undefined)),
			sample: { swatch: p.color },
			color: p.color,
		};
	}
	const a = activeAt(history, year).find((x) => x.polity.id === p.id);
	return {
		polity,
		kicker: t(`kind.${p.kind}`),
		title: p.name,
		text: a?.snapshot.title,
		when: a ? (a.snapshot.yearLabel ?? String(a.snapshot.year)) : undefined,
		sample: { swatch: p.color },
		color: p.color,
		confidence: a?.snapshot.confidence,
	};
}

function Sample({ sample }: { sample: Explained['sample'] }) {
	if ('mark' in sample) return <MarkIcon mark={sample.mark} colonial={sample.colonial} size={26} />;
	if ('line' in sample && sample.ship) return <ShipIcon vessel={sample.ship} size={34} />;
	if ('line' in sample) return <LineSample style={sample.line} color={sample.color} width={38} />;
	if ('people' in sample) return <span className="explain__people" aria-hidden="true">Aa</span>;
	if ('crown' in sample) {
		return sample.warrant ? (
			<svg className="explain__crown" viewBox="0 0 24 24" aria-hidden="true">
				<path d="M7 5.5h10v12H7zM9.5 9h5M9.5 12h5" fill="none" stroke="currentColor" strokeWidth="1.5" />
				<circle cx="15.5" cy="17" r="2.6" />
			</svg>
		) : (
			<svg className="explain__crown" viewBox="0 0 24 24" aria-hidden="true">
				<path d="M6 16l-.5-7.5 3.8 3L12 6.5l2.7 5 3.8-3L18 16zM6 17h12v1.8H6z" />
			</svg>
		);
	}
	if ('town' in sample) {
		const step = 360 / sample.town.length;
		const wedges = sample.town.map((c, i) => `${c} ${i * step}deg ${(i + 1) * step}deg`).join(', ');
		return <span className="explain__town" style={{ background: `conic-gradient(${wedges})` }} aria-hidden="true" />;
	}
	return <span className="explain__swatch" style={{ background: sample.swatch }} aria-hidden="true" />;
}

function Body({ x, tr, pinned = false }: { x: Explained; tr: Translate; pinned?: boolean }) {
	return (
		<>
			<p className="explain__kicker">
				<Sample sample={x.sample} />
				<span>{x.kicker}</span>
			</p>
			<p className="explain__title">{x.title}</p>
			{x.when && <p className="explain__when">{x.when}</p>}
			{x.text && <p className="explain__text">{x.text}</p>}
			{pinned && x.more && <p className="explain__text">{x.more}</p>}
			{x.crowned && (
				<p className="explain__crowned">
					<strong>{tr.t('throne.crowned', { by: x.crowned.by })}</strong> {x.crowned.text} <ConfidenceBadge level={x.crowned.confidence} tr={tr} />
				</p>
			)}
			{x.founders && (
				<ul className="explain__founders">
					{x.founders.map((f, i) => (
						<li key={i} style={{ ['--founder' as string]: f.color }}>
							<strong>{f.people}</strong>
							{f.from && <span className="explain__from"> {tr.t('town.from', { place: f.from })}</span>}
							{f.quarters.length > 0 && <span className="explain__quarters"> · {f.quarters.join(', ')}</span>}
							{pinned && <span className="explain__founder-text">{f.text}</span>}
						</li>
					))}
				</ul>
			)}
			{pinned && x.under && x.under.length > 0 && (
				<ul className="explain__under">
					{x.under.map((u, i) => (
						<li key={i} className={u.now ? 'is-now' : undefined} style={{ ['--founder' as string]: u.color }}>
							<strong>
								{u.kind} {u.name}
							</strong>{' '}
							<span className="explain__quarters">{u.when}</span>
							<span className="explain__founder-text">{u.text}</span>
						</li>
					))}
				</ul>
			)}
			{x.meaning && <p className="explain__meaning">{x.meaning}</p>}
			{x.note && <p className="explain__note">{x.note}</p>}
			{x.confidence && (
				<p className="explain__conf">
					<ConfidenceBadge level={x.confidence} tr={tr} />
				</p>
			)}
		</>
	);
}

/** The card that follows the mouse: the thing pointed at, then the states also drawn there. */
export function HoverExplain({ items, x, y, history, year, tr }: { items: MapItem[]; x: number; y: number; history: History; year: number; tr: Translate }) {
	const [top, ...rest] = items;
	const main = top ? explain(top, history, year, tr) : null;
	if (!main) return null;
	const others = [...new Set(rest.flatMap((i) => (i.type === 'polity' && i.polity !== main.polity?.id ? [i.polity] : [])))];
	return (
		<div className="hover-card explain explain--hover" style={{ left: x + 16, top: y + 16, ['--explain-ink' as string]: main.color }} aria-hidden="true">
			<Body x={main} tr={tr} />
			{others.length > 0 && (
				<p className="explain__also">
					{tr.t('explain.alsoHere')}:{' '}
					{others
						.slice(0, 3)
						.map((id) => history.polities.find((p) => p.id === id)?.name)
						.filter(Boolean)
						.join(', ')}
				</p>
			)}
			{top.type !== 'polity' && <p className="hover-card__hint">{tr.t('explain.pin')}</p>}
		</div>
	);
}

/** The card left where something was tapped or clicked, with ways to read on. */
export function PinnedExplain({
	item,
	x,
	y,
	narrow,
	history,
	year,
	tr,
	onClose,
	onOpenPolity,
	onOpenEvent,
	onOpenGroup,
}: {
	item: MapItem;
	x: number;
	y: number;
	narrow: boolean;
	history: History;
	year: number;
	tr: Translate;
	onClose: () => void;
	onOpenPolity: (id: string) => void;
	onOpenEvent: (id: string) => void;
	onOpenGroup: (id: string) => void;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const x0 = explain(item, history, year, tr);
	useEffect(() => {
		ref.current?.focus();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				onClose();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [item, onClose]);
	// A tall card (a people's story) can still run off the bottom: once drawn, lift it to fit.
	useLayoutEffect(() => {
		const el = ref.current;
		const region = el?.parentElement;
		if (!el || !region || narrow) return;
		const room = region.clientHeight - 12;
		if (el.offsetTop + el.offsetHeight > room) el.style.top = `${Math.max(12, room - el.offsetHeight)}px`;
	}, [item, narrow, x, y]);
	if (!x0) return null;
	// Keep the card on screen: open it to the left or above the tap when there is no room.
	const style: React.CSSProperties & Record<string, string | number> = { '--explain-ink': x0.color };
	if (!narrow) {
		const w = 320;
		const region = ref.current?.parentElement?.getBoundingClientRect();
		const maxX = (region?.width ?? window.innerWidth) - w - 12;
		const maxY = (region?.height ?? window.innerHeight) - 300;
		style.left = Math.max(12, Math.min(x + 14, maxX));
		style.top = Math.max(12, Math.min(y + 14, maxY));
	}
	return (
		<div ref={ref} className={`explain explain--pinned${narrow ? ' explain--sheet' : ''}`} style={style} role="dialog" aria-label={x0.title} tabIndex={-1}>
			<button type="button" className="explain__close" onClick={onClose} aria-label={tr.t('explain.close')}>
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path d="M6 6l12 12M18 6L6 18" />
				</svg>
			</button>
			<Body x={x0} tr={tr} pinned />
			<div className="explain__actions">
				{x0.groups?.slice(0, 2).map((g, i) => (
					<button key={g.id} type="button" className={`explain__action${i === 0 ? ' explain__action--primary' : ''}`} onClick={() => onOpenGroup(g.id)}>
						{tr.t('society.open', { name: g.name })}
					</button>
				))}
				{x0.event && (
					<button type="button" className="explain__action explain__action--primary" onClick={() => onOpenEvent(x0.event!.id)}>
						{tr.t('event.open')}
					</button>
				)}
				{x0.polity && (
					<button type="button" className="explain__action" onClick={() => onOpenPolity(x0.polity!.id)}>
						{tr.t('event.story', { name: x0.polity.name })}
					</button>
				)}
			</div>
		</div>
	);
}
