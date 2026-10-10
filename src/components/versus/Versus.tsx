// The Versus page: two sides, each a state, a self-ruling people, a whole people
// united, or an alliance, each at a chosen moment of its history. It shows them
// as two fighters on a versus screen, guesses who would likely win and why, and
// sets the guess beside the wars they really fought. The address holds the
// match-up, so it can be shared.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import type { Lang } from '../../i18n/ui';
import { useTranslations, type Translate } from '../../i18n/utils';
import type { History, SourceView } from '../../lib/types';
import {
	armsAt,
	buildIndex,
	expand,
	formatSide,
	judge,
	km,
	memberName,
	metInHistory,
	parseSide,
	phaseOf,
	PHASES,
	resolveYear,
	stopsOf,
	verdictBand,
	type ArmKind,
	type Bout,
	type ForcesView,
	type Index,
	type Phase,
	type SideScore,
	type SideSpec,
	type Terrain,
	type VersusData,
} from '../../lib/versus';
import { cue, resumeOnGesture, setScene } from '../../lib/sound';
import SoundToggle from '../map/SoundToggle';
import ShareButton from '../ShareButton';
import Crest from './Crest';
import VersusMap from './VersusMap';
import './versus.css';

type Load = { status: 'loading' | 'error' } | { status: 'ready'; ix: Index; history: History; data: VersusData };

const TERRAINS: Terrain[] = ['savanna', 'forest', 'river', 'delta', 'sahel'];
/** The order arms are listed in on the tale of the tape. */
const ARM_ORDER: ArmKind[] = ['cavalry', 'archers', 'firearms', 'canoes', 'standing', 'walls', 'allies', 'militia', 'ritual'];
const DEFAULT_A: SideSpec = { members: ['oyo'], when: 'peak' };
const DEFAULT_B: SideSpec = { members: ['benin'], when: 'peak' };

/** Famous match-ups, as address strings. */
const PRESETS: { a: string; b: string; on?: Terrain }[] = [
	{ a: 'oyo', b: 'benin' },
	{ a: 'people:yoruba~1800', b: 'people:igbo~1800' },
	{ a: 'oyo', b: 'aro' },
	{ a: 'igala~1515', b: 'benin~1515' },
	{ a: 'people:hausa~1804', b: 'sokoto~1804' },
	{ a: 'ibadan~1840', b: 'sokoto~1840' },
	{ a: 'kwararafa~1650', b: 'kano~1650' },
	{ a: 'igala~1700', b: 'kwararafa~1700' },
	{ a: 'sokoto~1808', b: 'kanem-bornu~1808' },
	{ a: 'oyo', b: 'oyo~low' },
];

function readUrl(): { a: SideSpec; b: SideSpec; field: Terrain | null } {
	const q = new URL(window.location.href).searchParams;
	const on = q.get('on') as Terrain | null;
	return { a: parseSide(q.get('a')) ?? DEFAULT_A, b: parseSide(q.get('b')) ?? DEFAULT_B, field: on && TERRAINS.includes(on) ? on : null };
}

function urlFor(a: SideSpec, b: SideSpec, field: Terrain | null): string {
	// Ids are slugs, so the address stays readable: ?a=people:yoruba~1800&b=aro
	return `${window.location.pathname}?a=${formatSide(a)}&b=${formatSide(b)}${field ? `&on=${field}` : ''}`;
}

const fmt = new Intl.NumberFormat('en');
const roundKm = (v: number) => fmt.format(v >= 10000 ? Math.round(v / 1000) * 1000 : v >= 1000 ? Math.round(v / 100) * 100 : Math.round(v / 10) * 10);

/** Two inks that can be told apart: the second side takes another when both are the same state's. */
function inks(a: string, b: string): [string, string] {
	const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
	const dist = (x: string, y: string) => Math.hypot(...rgb(x).map((v, i) => v - rgb(y)[i]));
	if (dist(a, b) >= 60) return [a, b];
	// Too alike (the same state at two moments): the second takes whichever stand-in is furthest from the first.
	const far = ['#8e2f3c', '#2f5a85', '#c9822a', '#2f6b4f'].sort((x, y) => dist(a, y) - dist(a, x))[0];
	return [a, far];
}

export default function Versus({ lang }: { lang: Lang }) {
	const tr = useMemo(() => useTranslations(lang), [lang]);
	const { t } = tr;
	const initial = useMemo(readUrl, []);
	const [a, setA] = useState<SideSpec>(initial.a);
	const [b, setB] = useState<SideSpec>(initial.b);
	const [field, setField] = useState<Terrain | null>(initial.field);
	const [load, setLoad] = useState<Load>({ status: 'loading' });
	const [attempt, setAttempt] = useState(0);

	// The map's music follows the visitor here, with the war drums to the fore.
	useEffect(() => {
		setScene('versus');
		return resumeOnGesture();
	}, []);

	useEffect(() => {
		let cancelled = false;
		setLoad({ status: 'loading' });
		const get = (u: string) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${u}: ${r.status}`))));
		Promise.all([get('/data/history.json'), get('/data/versus.json')])
			.then(([history, data]: [History, VersusData]) => !cancelled && setLoad({ status: 'ready', ix: buildIndex(history, data), history, data }))
			.catch((err) => {
				console.error(err);
				if (!cancelled) setLoad({ status: 'error' });
			});
		return () => {
			cancelled = true;
		};
	}, [attempt]);

	// The address follows the match-up, so it can be shared or bookmarked.
	useEffect(() => {
		const next = urlFor(a, b, field);
		if (next !== window.location.pathname + window.location.search) window.history.replaceState(null, '', next);
	}, [a, b, field]);

	useEffect(() => {
		const onPop = () => {
			const v = readUrl();
			setA(v.a);
			setB(v.b);
			setField(v.field);
		};
		window.addEventListener('popstate', onPop);
		return () => window.removeEventListener('popstate', onPop);
	}, []);

	const goPreset = useCallback((p: (typeof PRESETS)[number]) => {
		setA(parseSide(p.a)!);
		setB(parseSide(p.b)!);
		setField(p.on ?? null);
		window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
	}, []);

	if (load.status !== 'ready') {
		return (
			<main className="vs vs--wait">
				<Top tr={tr} />
				<p className="vs-wait" role="status">
					{load.status === 'error' ? t('versus.loadError') : t('versus.loading')}
				</p>
				{load.status === 'error' && (
					<button type="button" className="vs-btn" onClick={() => setAttempt((n) => n + 1)}>
						{t('versus.retry')}
					</button>
				)}
			</main>
		);
	}
	return <Arena tr={tr} ix={load.ix} history={load.history} data={load.data} a={a} b={b} field={field} setA={setA} setB={setB} setField={setField} onPreset={goPreset} />;
}

function Top({ tr }: { tr: Translate }) {
	const { t } = tr;
	return (
		<header className="vs-top">
			<a className="vs-brand" href="/?mode=then">
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path d="M15 6l-6 6 6 6" />
				</svg>
				<span>{t('site.name')}</span>
				<span className="visually-hidden">: {t('versus.back')}</span>
			</a>
			<p className="vs-top__title" aria-hidden="true">
				{t('versus.title')}
			</p>
			<div className="vs-top__tools">
				<SoundToggle tr={tr} />
				<ShareButton tr={tr} />
			</div>
		</header>
	);
}

/** One side resolved: its members, its year, its name and ink. */
interface Resolved {
	spec: SideSpec;
	members: string[];
	year: number;
	name: string;
	ink: string;
	phase: Phase | null;
	people: string | null;
}

function resolve(ix: Index, t: Translate['t'], spec: SideSpec): Resolved | null {
	const members = expand(ix, spec.members);
	if (!members.length) return null;
	const year = resolveYear(ix, members, spec.when) ?? stopsOf(ix, members)[0];
	const people = spec.members.length === 1 && spec.members[0].startsWith('people:') ? spec.members[0] : null;
	const name = people ? t('versus.people', { name: memberName(ix, people) }) : spec.members.map((m) => ix.polities.get(m)?.name ?? memberName(ix, m)).join(' + ');
	const lead = members.find((m) => ix.polities.has(m));
	return { spec, members, year, name, ink: (lead && ix.polities.get(lead)!.color) || '#6b5a45', phase: phaseOf(ix, members, year), people };
}

interface ArenaProps {
	tr: Translate;
	ix: Index;
	history: History;
	data: VersusData;
	a: SideSpec;
	b: SideSpec;
	field: Terrain | null;
	setA: (s: SideSpec) => void;
	setB: (s: SideSpec) => void;
	setField: (f: Terrain | null) => void;
	onPreset: (p: (typeof PRESETS)[number]) => void;
}

function Arena({ tr, ix, history, data, a, b, field, setA, setB, setField, onPreset }: ArenaProps) {
	const { t } = tr;
	const ra = resolve(ix, t, a) ?? resolve(ix, t, DEFAULT_A)!;
	const rb = resolve(ix, t, b) ?? resolve(ix, t, DEFAULT_B)!;
	const [inkA, inkB] = inks(ra.ink, rb.ink);
	const result = useMemo(() => judge(ix, { members: ra.members, year: ra.year }, { members: rb.members, year: rb.year }, field), [ix, ra.members.join(), ra.year, rb.members.join(), rb.year, field]);
	const met = useMemo(() => metInHistory(ix, ra.members, rb.members), [ix, ra.members.join(), rb.members.join()]);

	useEffect(() => {
		document.title = `${ra.name} ${t('versus.vs')} ${rb.name} · ${t('versus.title')} · ${t('site.name')}`;
	}, [ra.name, rb.name, t]);

	const sa = result.bouts[0].a;
	const sb = result.bouts[0].b;
	const pA = result.pA;
	const band = verdictBand(pA);
	const winner = pA >= 0.5 ? ra : rb;
	// A new match-up replays the entrance: the banners wipe in and the seal stamps down.
	const fight = `${ra.members.join()}@${ra.year}|${rb.members.join()}@${rb.year}`;
	useEffect(() => cue('clash'), [fight]);
	const fieldHeard = useRef(field);
	useEffect(() => {
		if (field !== fieldHeard.current) cue('tap');
		fieldHeard.current = field;
	}, [field]);

	return (
		<main className="vs" style={{ '--ink-a': inkA, '--ink-b': inkB } as React.CSSProperties}>
			<Top tr={tr} />
			<h1 className="visually-hidden">
				{ra.name} {t('versus.vs')} {rb.name}
			</h1>

			<section className="vs-arena" key={fight} aria-label={t('versus.title')}>
				<span className="vs-arena__seam" aria-hidden="true" />
				<Fighter tr={tr} ix={ix} history={history} side="a" r={ra} score={sa} onChange={setA} />
				<div className="vs-seal" aria-hidden="true">
					<span>{t('versus.vs')}</span>
				</div>
				<Fighter tr={tr} ix={ix} history={history} side="b" r={rb} score={sb} onChange={setB} />
			</section>

			<section className="vs-meter" aria-labelledby="vs-verdict" data-band={band} key={`m-${fight}-${field}`}>
				<p className="vs-kicker">{t('versus.verdict')}</p>
				<h2 id="vs-verdict" className="vs-verdict">
					{band === 'even' ? t('versus.verdict.even') : t(`versus.verdict.${band}`, { name: winner.name })}
				</h2>
				<Meter pA={pA} a={ra.name} b={rb.name} tr={tr} />
				<div className="vs-field" role="radiogroup" aria-label={t('versus.field')}>
					<span className="vs-field__label" aria-hidden="true">
						{t('versus.field')}
					</span>
					<button type="button" role="radio" aria-checked={field === null} onClick={() => setField(null)}>
						{t('versus.field.both')}
					</button>
					{TERRAINS.map((x) => (
						<button key={x} type="button" role="radio" aria-checked={field === x} onClick={() => setField(x)}>
							{t(`versus.terrainShort.${x}`)}
						</button>
					))}
				</div>
				<ul className="vs-bouts">
					{result.bouts.map((bout, i) => (
						<li key={i}>
							<span>
								{bout.attacker
									? t('versus.bout.invades', {
											a: bout.attacker === 'a' ? ra.name : rb.name,
											b: bout.attacker === 'a' ? rb.name : ra.name,
											terrain: t(`versus.terrain.${bout.field}`),
										})
									: t('versus.bout.neutral', { terrain: t(`versus.terrain.${bout.field}`) })}
							</span>
							<Meter pA={bout.pA} a={ra.name} b={rb.name} tr={tr} thin />
						</li>
					))}
				</ul>
				<p className="vs-note">{t('versus.verdict.note')}</p>
			</section>

			<Tape tr={tr} ra={ra} rb={rb} sa={sa} sb={sb} />

			<section className="vs-block" aria-labelledby="vs-why">
				<h2 id="vs-why" className="vs-h">
					{t('versus.why')}
				</h2>
				<ol className="vs-factors">
					{reasons(tr, ra, rb, result.bouts).map((r, i) => (
						<li key={i} data-side={r.side}>
							{r.text}
						</li>
					))}
				</ol>
			</section>

			<HistoryMet tr={tr} ix={ix} met={met} ra={ra} pA={pA} />

			<section className="vs-block" aria-labelledby="vs-map">
				<h2 id="vs-map" className="vs-h">
					{t('versus.map')}
				</h2>
				<VersusMap history={history} base={data.map} ix={ix} a={{ members: sa.members, ink: inkA, seat: sa.seat }} b={{ members: sb.members, ink: inkB, seat: sb.seat }} years={[ra.year, rb.year]} />
				<p className="vs-note">{t('versus.mapNote', { a: ra.name, ya: ra.year, b: rb.name, yb: rb.year })}</p>
			</section>

			<section className="vs-block" aria-labelledby="vs-detail">
				<h2 id="vs-detail" className="vs-h">
					{t('versus.detail')}
				</h2>
				<div className="vs-dossiers">
					<Forces tr={tr} r={ra} score={sa} side="a" />
					<Forces tr={tr} r={rb} score={sb} side="b" />
				</div>
			</section>

			<section className="vs-block" aria-labelledby="vs-presets">
				<h2 id="vs-presets" className="vs-h">
					{t('versus.presets')}
				</h2>
				<ul className="vs-presets">
					{PRESETS.map((p) => {
						const pa = resolve(ix, t, parseSide(p.a)!);
						const pb = resolve(ix, t, parseSide(p.b)!);
						if (!pa || !pb) return null;
						const [ia, ib] = inks(pa.ink, pb.ink);
						const href = `?a=${p.a}&b=${p.b}${p.on ? `&on=${p.on}` : ''}`;
						return (
							<li key={href}>
								<a
									href={href}
									style={{ '--pa': ia, '--pb': ib } as React.CSSProperties}
									onClick={(e) => {
										if (e.metaKey || e.ctrlKey || e.shiftKey) return;
										e.preventDefault();
										onPreset(p);
									}}
								>
									<span className="vs-preset__a">
										<strong>{pa.name}</strong>
										<small>{pa.year}</small>
									</span>
									<em>{t('versus.vs')}</em>
									<span className="vs-preset__b">
										<strong>{pb.name}</strong>
										<small>{pb.year}</small>
									</span>
								</a>
							</li>
						);
					})}
				</ul>
			</section>

			<footer className="vs-method">
				<h2 className="vs-h">{t('versus.method')}</h2>
				<p>{t('versus.methodText')}</p>
				<p>{t('site.notOwnership')}</p>
			</footer>
		</main>
	);
}

/** The split bar: side A's chance from the left, side B's from the right, meeting at the seam. */
function Meter({ pA, a, b, tr, thin = false }: { pA: number; a: string; b: string; tr: Translate; thin?: boolean }) {
	const { t } = tr;
	const pa = Math.round(pA * 100);
	// Mounts at even, then fills, so each new match-up is seen being weighed.
	const [shown, setShown] = useState(50);
	useEffect(() => {
		const id = requestAnimationFrame(() => setShown(pa));
		return () => cancelAnimationFrame(id);
	}, [pa]);
	return (
		<div className={`vs-bar${thin ? ' vs-bar--thin' : ''}`} role="img" aria-label={`${t('versus.chance', { name: a, pct: pa })}; ${t('versus.chance', { name: b, pct: 100 - pa })}`}>
			{!thin && (
				<span className="vs-bar__pct vs-bar__pct--a" aria-hidden="true">
					{pa}
					<small>%</small>
				</span>
			)}
			<span className="vs-bar__track">
				<span className="vs-bar__a" style={{ width: `${shown}%` }} />
				<span className="vs-bar__seam" style={{ left: `${shown}%` }} />
			</span>
			{!thin && (
				<span className="vs-bar__pct vs-bar__pct--b" aria-hidden="true">
					{100 - pa}
					<small>%</small>
				</span>
			)}
		</div>
	);
}

// ---- One fighter's banner: the land as its portrait, its name, and the choosing.

function Fighter({ tr, ix, history, side, r, score, onChange }: { tr: Translate; ix: Index; history: History; side: 'a' | 'b'; r: Resolved; score: SideScore; onChange: (s: SideSpec) => void }) {
	const { t } = tr;
	const id = `vs-${side}`;
	const single = r.members.length === 1 && !r.people && ix.polities.has(r.members[0]);
	const polity = single ? ix.polities.get(r.members[0])! : null;
	// The year chosen may fall between stops (a shared link, a preset): list it too.
	const stops = [...new Set([...stopsOf(ix, r.members), r.year])].sort((x, y) => x - y);
	const lead = score.members[0];
	const snapshot = polity && lead?.snapshot !== undefined ? polity.snapshots[lead.snapshot] : null;
	const pick = r.people ?? (r.spec.members.length === 1 ? r.spec.members[0] : '');
	const polities = [...ix.polities.values()].sort((x, y) => x.name.localeCompare(y.name));
	const societies = [...ix.societies.values()].sort((x, y) => x.name.localeCompare(y.name));
	const allies = r.people ? [] : r.spec.members;

	return (
		<div className="vs-fighter" data-side={side}>
			<Crest history={history} ix={ix} members={score.members} year={r.year} side={side} label={r.name} />
			<div className="vs-fighter__id">
				<p className="vs-fighter__when">
					{single && r.phase && <span>{t(`versus.at.${r.phase}`)}</span>}
					<span className="vs-fighter__year">{snapshot?.yearLabel ?? r.year}</span>
				</p>
				<p className="vs-fighter__name">
					<span>{r.name}</span>
				</p>
				<p className="vs-fighter__sub">{snapshot ? snapshot.title : score.members.length > 1 ? score.members.map((m) => m.name).join(' · ') : t('versus.peopleNote', { name: r.name })}</p>
				{score.members.length === 0 && <p className="vs-fighter__warn">{t('versus.nobody', { year: r.year })}</p>}
				{score.absent.length > 0 && score.members.length > 0 && <p className="vs-fighter__absent">{t('versus.absent', { year: r.year, names: score.absent.map((m) => memberName(ix, m)).join(', ') })}</p>}
			</div>

			<div className="vs-pick">
				<label className="visually-hidden" htmlFor={`${id}-pick`}>
					{t(side === 'a' ? 'versus.sideA' : 'versus.sideB')}
				</label>
				<select id={`${id}-pick`} className="vs-select" value={allies.length > 1 ? '' : pick} onChange={(e) => e.target.value && onChange({ members: [e.target.value], when: 'peak' })}>
					{allies.length > 1 && <option value="">{r.name}</option>}
					<optgroup label={t('versus.group.peoples')}>
						{ix.peoples.map((p) => (
							<option key={p.id} value={`people:${p.id}`}>
								{t('versus.people', { name: p.name })}
							</option>
						))}
					</optgroup>
					<optgroup label={t('versus.group.polities')}>
						{polities.map((p) => (
							<option key={p.id} value={p.id}>
								{p.name}
							</option>
						))}
					</optgroup>
					<optgroup label={t('versus.group.societies')}>
						{societies.map((s) => (
							<option key={s.id} value={`society:${s.id}`}>
								{s.name}
							</option>
						))}
					</optgroup>
				</select>

				<div className="vs-phases" role="radiogroup" aria-label={t('versus.when')}>
					{PHASES.map((ph) => (
						<button key={ph} type="button" role="radio" aria-checked={r.spec.when === ph || (typeof r.spec.when === 'number' && r.phase === ph)} onClick={() => onChange({ ...r.spec, when: ph })}>
							{t(`versus.phase.${ph}`)}
						</button>
					))}
				</div>

				<div className="vs-pick__row">
					<label className="visually-hidden" htmlFor={`${id}-year`}>
						{t('versus.year')}
					</label>
					<select id={`${id}-year`} className="vs-select vs-select--small" value={r.year} onChange={(e) => onChange({ ...r.spec, when: Number(e.target.value) })}>
						{stops.map((y) => {
							const s = polity?.snapshots.find((x) => x.year === y);
							return (
								<option key={y} value={y}>
									{s ? `${s.yearLabel ?? y} · ${s.title}` : y}
								</option>
							);
						})}
					</select>
					{!r.people && (
						<select
							className="vs-select vs-select--small vs-select--ally"
							aria-label={t('versus.ally')}
							value=""
							onChange={(e) => {
								const v = e.target.value;
								if (v && !allies.includes(v)) onChange({ members: [...allies, v], when: typeof r.spec.when === 'number' ? r.spec.when : r.year });
							}}
						>
							<option value="">+ {t('versus.addAlly')}</option>
							<optgroup label={t('versus.group.polities')}>
								{polities
									.filter((p) => !allies.includes(p.id))
									.map((p) => (
										<option key={p.id} value={p.id}>
											{p.name}
										</option>
									))}
							</optgroup>
							<optgroup label={t('versus.group.societies')}>
								{societies
									.filter((s) => !allies.includes(`society:${s.id}`))
									.map((s) => (
										<option key={s.id} value={`society:${s.id}`}>
											{s.name}
										</option>
									))}
							</optgroup>
						</select>
					)}
				</div>
				{allies.length > 1 && (
					<ul className="vs-allies" aria-label={t('versus.members')}>
						{allies.map((m) => (
							<li key={m}>
								<span>{memberName(ix, m)}</span>
								<button type="button" aria-label={t('versus.remove', { name: memberName(ix, m) })} onClick={() => onChange({ ...r.spec, members: allies.filter((x) => x !== m) })}>
									×
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

// ---- The tale of the tape: the two sides row by row, A on the left, B on the right.

function Tape({ tr, ra, rb, sa, sb }: { tr: Translate; ra: Resolved; rb: Resolved; sa: SideScore; sb: SideScore }) {
	const { t } = tr;
	const land = (s: SideScore) => s.members.reduce((n, m) => n + m.coreKm2 + m.influenceKm2, 0);
	const la = land(sa);
	const lb = land(sb);
	const top = Math.max(la, lb, 1);
	// Each arm at its best among the side's members, in the year shown.
	const best = (s: SideScore, year: number) => {
		const m = new Map<ArmKind, number>();
		for (const x of s.members) for (const arm of armsAt(x.forces, year)) m.set(arm.kind, Math.max(m.get(arm.kind) ?? 0, arm.level));
		return m;
	};
	const aa = best(sa, ra.year);
	const ab = best(sb, rb.year);
	const kinds = ARM_ORDER.filter((k) => aa.has(k) || ab.has(k));
	const record = (s: SideScore) => {
		let w = 0;
		let l = 0;
		for (const m of s.members) for (const r of m.forces?.record ?? []) r.result === 'won' || r.result === 'held' ? w++ : r.result === 'lost' ? l++ : 0;
		return { w, l };
	};
	const ka = record(sa);
	const kb = record(sb);
	const rule = (s: SideScore) => (s.members.length > 1 ? t('versus.org.alliance') : s.members[0] ? t(`versus.org.${s.members[0].orgLabel}` as 'versus.org.kingdom') : '—');
	const capital = (s: SideScore) => s.members[0]?.capital?.name ?? '—';
	const lead = (x: number, y: number) => (x > y ? 'a' : y > x ? 'b' : undefined);

	return (
		<section className="vs-tape" aria-labelledby="vs-tape">
			<h2 id="vs-tape" className="vs-h vs-h--center">
				{t('versus.tape')}
			</h2>
			<table>
				<thead className="visually-hidden">
					<tr>
						<th scope="col">{ra.name}</th>
						<th scope="col" />
						<th scope="col">{rb.name}</th>
					</tr>
				</thead>
				<tbody>
					<tr className="vs-tape__land" data-lead={lead(la, lb)}>
						<td>
							<span className="vs-tape__num">{roundKm(la)}</span>
							<span className="vs-tape__fill" style={{ width: `${(la / top) * 100}%` }} />
						</td>
						<th scope="row">{t('versus.land')} · km²</th>
						<td>
							<span className="vs-tape__num">{roundKm(lb)}</span>
							<span className="vs-tape__fill" style={{ width: `${(lb / top) * 100}%` }} />
						</td>
					</tr>
					{kinds.map((k) => (
						<tr key={k} data-lead={lead(aa.get(k) ?? 0, ab.get(k) ?? 0)}>
							<td>
								<Pips n={aa.get(k) ?? 0} />
							</td>
							<th scope="row">{t(`versus.arm.${k}`)}</th>
							<td>
								<Pips n={ab.get(k) ?? 0} />
							</td>
						</tr>
					))}
					<tr data-lead={lead(ka.w - ka.l, kb.w - kb.l)}>
						<td className="vs-tape__text">
							{ka.w}–{ka.l}
						</td>
						<th scope="row">{t('versus.recordShort')}</th>
						<td className="vs-tape__text">
							{kb.w}–{kb.l}
						</td>
					</tr>
					<tr>
						<td className="vs-tape__text">{rule(sa)}</td>
						<th scope="row">{t('versus.rule')}</th>
						<td className="vs-tape__text">{rule(sb)}</td>
					</tr>
					<tr>
						<td className="vs-tape__text">{t(`versus.terrainShort.${sa.terrain}`)}</td>
						<th scope="row">{t('versus.home')}</th>
						<td className="vs-tape__text">{t(`versus.terrainShort.${sb.terrain}`)}</td>
					</tr>
					<tr>
						<td className="vs-tape__text">{capital(sa)}</td>
						<th scope="row">{t('versus.capital')}</th>
						<td className="vs-tape__text">{capital(sb)}</td>
					</tr>
				</tbody>
			</table>
		</section>
	);
}

function Pips({ n }: { n: number }) {
	return (
		<span className="vs-pips" data-n={n}>
			{[1, 2, 3].map((i) => (
				<i key={i} data-on={i <= n ? 'true' : undefined} />
			))}
			<span className="visually-hidden">{n} / 3</span>
		</span>
	);
}

// ---- Why: the reasons behind the guess, in plain words.

function armList(tr: Translate, kinds: ArmKind[]): string {
	const names = kinds.map((k) => tr.t(`versus.arm.${k}`));
	return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] ?? '');
}

function reasons(tr: Translate, ra: Resolved, rb: Resolved, bouts: Bout[]): { side?: 'a' | 'b'; text: string }[] {
	const { t } = tr;
	const out: { side?: 'a' | 'b'; text: string }[] = [];
	const seen = new Set<string>();
	const push = (side: 'a' | 'b' | undefined, text: string) => {
		if (seen.has(text)) return;
		seen.add(text);
		out.push({ side, text });
	};
	const name = (s: 'a' | 'b') => (s === 'a' ? ra.name : rb.name);

	// Land, as shown on the tape (ruled and tributary together); the guess weighs tributaries for less.
	const sa = bouts[0].a;
	const sb = bouts[0].b;
	const land = (sc: SideScore) => sc.members.reduce((n, m) => n + m.coreKm2 + m.influenceKm2, 0);
	if (land(sa) > 0 && land(sb) > 0) {
		const big = land(sa) >= land(sb) ? 'a' : 'b';
		const [x, y] = big === 'a' ? [land(sa), land(sb)] : [land(sb), land(sa)];
		const ratio = x / y;
		push(
			big,
			ratio < 1.4
				? t('versus.why.reachEven', { a: name(big), b: name(big === 'a' ? 'b' : 'a'), ka: roundKm(x), kb: roundKm(y) })
				: t('versus.why.reach', { a: name(big), b: name(big === 'a' ? 'b' : 'a'), ka: roundKm(x), kb: roundKm(y), ratio: ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1) }),
		);
	}

	// What each side fought with.
	for (const [s, sc] of [['a', sa], ['b', sb]] as const) {
		if (!sc.members.length) continue;
		const kinds = [...new Set(sc.members.flatMap((m) => m.forces?.arms.map((x) => x.kind) ?? []))];
		const strong = sc.arms.filter((x) => x.level >= 2).map((x) => x.kind);
		if (!kinds.length) push(s, t('versus.why.noArms', { name: name(s) }));
		else if (strong.length) push(s, t('versus.why.arms', { name: name(s), arms: armList(tr, strong.slice(0, 3)) }));
	}

	// The ground, the walls, the march.
	for (const bout of bouts) {
		for (const [s, sc] of [['a', bout.a], ['b', bout.b]] as const) {
			const attacking = bout.attacker === s || bout.attacker === null;
			const horse = sc.arms.find((x) => x.kind === 'cavalry' && x.level >= 2 && x.fit <= 0.6);
			if (horse && attacking) push(s, t('versus.why.ground.cavalry', { name: name(s), terrain: t(`versus.terrain.${bout.field}`) }));
			const canoe = sc.arms.find((x) => x.kind === 'canoes' && x.level >= 3 && x.fit <= 0.4);
			if (canoe && attacking) push(s, t('versus.why.ground.canoes', { name: name(s) }));
			if (!attacking && sc.arms.some((x) => x.kind === 'walls' && x.level >= 2)) push(s, t('versus.why.walls', { name: name(s) }));
			if (!attacking && sc.scattered > 1) push(s, t('versus.why.scattered', { name: name(s) }));
			if (bout.attacker === s && sc.march < 0.85 && sc.seat) {
				const other = s === 'a' ? bout.b : bout.a;
				if (other.seat) push(s, t('versus.why.march', { name: name(s), km: fmt.format(Math.round(km(sc.seat, other.seat) / 10) * 10) }));
			}
		}
	}

	// Allies, decline, time.
	for (const [s, sc] of [['a', sa], ['b', sb]] as const) {
		if (sc.members.length > 1) push(s, t('versus.why.unity', { name: name(s), count: sc.members.length, pct: Math.round(sc.unity * 100) }));
		if (sc.phase < 0.9) push(s, t('versus.why.decline', { name: name(s), year: sc.year }));
	}
	const gap = Math.abs(ra.year - rb.year);
	if (gap >= 80) push(undefined, t('versus.why.time', { years: gap }));
	return out;
}

// ---- What really happened.

function HistoryMet({ tr, ix, met, ra, pA }: { tr: Translate; ix: Index; met: ReturnType<typeof metInHistory>; ra: Resolved; pA: number }) {
	const { t } = tr;
	// Who won each real clash, from either side's telling.
	const wins = { a: 0, b: 0 };
	for (const m of met) {
		const mine = ra.members.includes(m.from) ? 'a' : 'b';
		const theirs = mine === 'a' ? 'b' : 'a';
		if (m.record.result === 'won' || m.record.result === 'held') wins[mine]++;
		else if (m.record.result === 'lost') wins[theirs]++;
	}
	const guess = verdictBand(pA) === 'even' ? null : pA >= 0.5 ? 'a' : 'b';
	const real = wins.a > wins.b ? 'a' : wins.b > wins.a ? 'b' : null;
	const verdict = !met.length ? null : wins.a && wins.b && !real ? 'mixed' : real && guess ? (real === guess ? 'agrees' : 'disagrees') : wins.a && wins.b ? 'mixed' : null;
	return (
		<section className="vs-block" aria-labelledby="vs-history" data-verdict={verdict ?? undefined}>
			<h2 id="vs-history" className="vs-h">
				{t('versus.history')}
			</h2>
			{!met.length ? (
				<p className="vs-note">{t('versus.history.none')}</p>
			) : (
				<>
					{verdict && (
						<p className="vs-stamp" data-verdict={verdict}>
							{t(`versus.history.${verdict}`)}
						</p>
					)}
					<ol className="vs-wars">
						{met.map(({ from, record: r, forces }) => (
							<li key={`${from}-${r.year}-${r.result}`} data-side={ra.members.includes(from) ? 'a' : 'b'}>
								<span className="vs-wars__year">{r.yearLabel ?? r.year}</span>
								<div>
									<p className="vs-wars__head">
										{memberName(ix, from)} <span className={`vs-result vs-result--${r.result}`}>{t(`versus.result.${r.result}`)}</span> <span className="vs-wars__vs">{r.against}</span>
									</p>
									<p>
										{r.text} <Refs refs={r.refs} sources={forces.sources} />
										{r.confidence !== 'high' && <span className={`vs-conf vs-conf--${r.confidence}`}>{t(`confidence.${r.confidence}`)}</span>}
									</p>
									{r.event && (
										<a className="vs-link" href={`/?mode=then&year=${r.year}&event=${r.event}`}>
											{t('versus.history.openEvent')} →
										</a>
									)}
								</div>
							</li>
						))}
					</ol>
				</>
			)}
		</section>
	);
}

// ---- How each side made war, with its sources.

function Refs({ refs, sources }: { refs: number[]; sources: SourceView[] }) {
	if (!refs.length) return null;
	return (
		<sup className="vs-refs">
			{refs.map((n, i) => {
				const s = sources.find((x) => x.n === n);
				return (
					<span key={n}>
						{i > 0 && ','}
						<span title={s?.citation}>{n}</span>
					</span>
				);
			})}
		</sup>
	);
}

function Forces({ tr, r, score, side }: { tr: Translate; r: Resolved; score: SideScore; side: 'a' | 'b' }) {
	const { t } = tr;
	return (
		<div className="vs-dossier" data-side={side}>
			<p className="vs-dossier__side">{r.name}</p>
			{score.members.map((m) => {
				const f = m.forces;
				return (
					<details key={m.id} className="vs-member" open={score.members.length <= 2}>
						<summary>
							{m.name} <span className="vs-faint">· {m.yearLabel ?? r.year}</span>
						</summary>
						{!f ? <p className="vs-note">{t('versus.noForces', { name: m.name })}</p> : <ForcesBody tr={tr} f={f} year={r.year} />}
					</details>
				);
			})}
			{score.members.length === 0 && <p className="vs-note">{t('versus.nobody', { year: r.year })}</p>}
		</div>
	);
}

function ForcesBody({ tr, f, year }: { tr: Translate; f: ForcesView; year: number }) {
	const { t } = tr;
	const span = (a: { from?: number; to?: number }) => (a.from || a.to ? `${a.from ?? ''}–${a.to ?? ''}` : '');
	return (
		<>
			<p className="vs-dossier__lead">
				{f.summary.text} <Refs refs={f.summary.refs} sources={f.sources} />
			</p>
			<h3 className="vs-h3">{t('versus.arms')}</h3>
			<ul className="vs-arms">
				{f.arms.map((a, i) => {
					const live = (a.from === undefined || year >= a.from) && (a.to === undefined || year <= a.to);
					return (
						<li key={i} data-live={live ? 'true' : undefined}>
							<Pips n={a.level} />
							<span className="vs-arms__kind">
								{t(`versus.arm.${a.kind}`)}
								{span(a) && <span className="vs-faint"> {span(a)}</span>}
							</span>
							<span className="vs-arms__text">
								{a.text} <Refs refs={a.refs} sources={f.sources} />
								{a.confidence !== 'high' && <span className={`vs-conf vs-conf--${a.confidence}`}>{t(`confidence.${a.confidence}`)}</span>}
							</span>
						</li>
					);
				})}
			</ul>
			{f.record.length > 0 && (
				<>
					<h3 className="vs-h3">{t('versus.record')}</h3>
					<ul className="vs-record">
						{f.record.map((r, i) => (
							<li key={i}>
								<span className="vs-wars__year">{r.yearLabel ?? r.year}</span> <span className={`vs-result vs-result--${r.result}`}>{t(`versus.result.${r.result}`)}</span> {r.against}. {r.text} <Refs refs={r.refs} sources={f.sources} />
							</li>
						))}
					</ul>
				</>
			)}
			<details className="vs-sources">
				<summary>{t('versus.sources', { count: f.sources.length })}</summary>
				<ol>
					{f.sources.map((s) => (
						<li key={s.n} value={s.n}>
							{s.url ? (
								<a href={s.url} rel="noopener" target="_blank">
									{s.citation}
								</a>
							) : (
								s.citation
							)}
							{!s.checked && <span className="vs-faint"> ({t('versus.unchecked')})</span>}
						</li>
					))}
				</ol>
			</details>
			{f.status !== 'published' && <p className="vs-note">{t('versus.draft')}</p>}
		</>
	);
}
