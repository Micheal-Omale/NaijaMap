// The year control for the history view: play, step between events, or drag.
//
// Playback moves from event to event like turning the pages of an atlas: the
// year counter runs to the next snapshot year, the map changes on arrival, and
// the caption holds long enough to read. When an event with dated moments
// begins (the invasion of Benin, the founding of Arochukwu), playback slows
// down and tells it moment by moment, the camera going to each place in turn.
// Dragging or stepping stops playback, and the newest intent always wins over a
// queued one.

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Translate } from '../../i18n/utils';
import { isForeign } from '../../lib/ink';
import { eventsAt, eventsStarting, eventYears, FIRST_YEAR, posToYear, SLIDER_MAX, TODAY, yearToPos } from '../../lib/timeline';
import type { EventView, History } from '../../lib/types';
import { EVENT_MARK } from './glyphs';
import { MarkIcon } from './Marks';

const MOTION = {
	/** Counter run between events: ms per year travelled, clamped. Slow enough to feel the years pass. */
	msPerYear: 14,
	minRun: 900,
	maxRun: 2600,
	/**
	 * How long the map rests on a caption: time for the camera to settle, then about
	 * 180 words a minute of reading, so a long caption is never cut off mid-sentence.
	 */
	read: { settle: 2200, msPerWord: 330, min: 7000, max: 17000 },
	/** An event told in detail: each placed moment is read the same way, from a shorter floor. */
	moment: { min: 5600, max: 14000 },
	/** Before the first moment of an event, the routes (and ships) get this long to set off. */
	lead: 2400,
	maxMoments: 6,
	ease: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2), // power2.inOut
};

const ERAS = [1000, 1400, 1600, 1800, 1900];

const words = (text: string) => text.split(/s+/).filter(Boolean).length;

/** Time to read a caption made of these lines, within the given bounds. */
function readMs(lines: (string | undefined)[], bounds: { min: number; max: number } = MOTION.read): number {
	const n = lines.reduce((sum, l) => sum + (l ? words(l) : 0), 0);
	return Math.min(bounds.max, Math.max(bounds.min, MOTION.read.settle + n * MOTION.read.msPerWord));
}

/** The narration line under a playback caption. */
function firstSentence(text: string): string {
	const m = text.match(/^.*?[.!?](\s|$)/);
	return (m ? m[0] : text).trim();
}

/** The event playback tells in detail in a year: the one with most placed moments, colonial conquests first. */
function featured(history: History, year: number): EventView | undefined {
	const placed = (e: EventView) => e.moments.filter((m) => m.at).length;
	return [...eventsStarting(history, year)].sort(
		(a, b) => Number(b.kind === 'colonial') - Number(a.kind === 'colonial') || placed(b) - placed(a),
	)[0];
}

/** The moments playback steps through: placed ones, in order, up to the cap. */
function tour(e: EventView | undefined): number[] {
	if (!e) return [];
	return e.moments.flatMap((m, i) => (m.at ? [i] : [])).slice(0, MOTION.maxMoments);
}

/** The words a playback caption shows on a stop, for its reading time. */
function captionLines(history: History, year: number): string[] {
	const lead = featured(history, year);
	const snaps = eventsAt(history, year);
	if (lead) return [lead.name, firstSentence(lead.summary.text), ...snaps.slice(0, 2).map((a) => `${a.polity.name}: ${a.snapshot.title}`)];
	return [snaps[0]?.snapshot.title ?? '', snaps[0] ? firstSentence(snaps[0].snapshot.text) : '', ...snaps.slice(1, 4).map((a) => `${a.polity.name}: ${a.snapshot.title}`)];
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Props {
	history: History;
	year: number;
	onYear: (year: number) => void;
	/** Playback is heading for this year: the camera sets off while the counter runs. */
	onArrive: (year: number) => void;
	/** Playback is telling one moment of an event: the camera goes to its place. */
	onMoment: (event: string, index: number) => void;
	onOpenEvent: (id: string) => void;
	onPlaying: (playing: boolean) => void;
	tr: Translate;
	/** Shown just above the bar while nothing plays: the hint that the map can be pointed at. */
	hint?: ReactNode;
}

export default function Timeline({ history, year, onYear, onArrive, onMoment, onOpenEvent, onPlaying, tr, hint }: Props) {
	const { t } = tr;
	const stops = useMemo(() => eventYears(history), [history]);
	const [playing, setPlaying] = useState(false);
	// The year shown on the counter and slider; runs ahead of `year` while the counter is moving.
	const [shown, setShown] = useState(year);
	// The moment being told, while playback holds on a detailed event.
	const [moment, setMoment] = useState<number | null>(null);
	const frame = useRef(0);
	const timer = useRef(0);
	const momentTimer = useRef(0);
	const latest = useRef({ year, onYear, onArrive, onMoment });
	latest.current = { year, onYear, onArrive, onMoment };

	useEffect(() => onPlaying(playing), [playing, onPlaying]);

	useEffect(() => {
		if (!frame.current) setShown(year);
	}, [year]);

	const stop = useCallback(() => {
		cancelAnimationFrame(frame.current);
		clearTimeout(timer.current);
		clearTimeout(momentTimer.current);
		frame.current = 0;
		timer.current = 0;
		momentTimer.current = 0;
		setMoment(null);
	}, []);

	useEffect(() => stop, [stop]);

	/** Runs the counter to `to`, then commits it. */
	const runTo = useCallback(
		(to: number, then?: () => void) => {
			stop();
			const from = latest.current.year >= TODAY ? stops[stops.length - 1] : latest.current.year;
			const span = Math.abs(to - from);
			const ms = reducedMotion() || to >= TODAY ? 0 : Math.min(MOTION.maxRun, Math.max(MOTION.minRun, span * MOTION.msPerYear));
			if (!ms) {
				setShown(to);
				latest.current.onYear(to);
				then?.();
				return;
			}
			const start = performance.now();
			const tick = (now: number) => {
				const p = Math.min(1, (now - start) / ms);
				setShown(Math.round(from + (to - from) * MOTION.ease(p)));
				if (p < 1) {
					frame.current = requestAnimationFrame(tick);
				} else {
					frame.current = 0;
					latest.current.onYear(to);
					then?.();
				}
			};
			frame.current = requestAnimationFrame(tick);
		},
		[stop, stops],
	);

	const nextStop = useCallback((from: number) => stops.find((y) => y > from), [stops]);
	const prevStop = useCallback((from: number) => [...stops].reverse().find((y) => y < from), [stops]);

	// Playback: run to the next event, hold (telling a detailed event moment by moment), repeat; end on the Today stop.
	useEffect(() => {
		if (!playing) return;
		/** On a stop: tell its event moment by moment, or hold on its caption for as long as it takes to read. */
		const tell = (at: number) => {
			const e = featured(history, at);
			const moments = tour(e);
			if (e && moments.length > 1) {
				// Let the routes draw first, then visit each moment's place.
				const visit = (n: number) => {
					const m = e.moments[moments[n]];
					setMoment(moments[n]);
					latest.current.onMoment(e.id, moments[n]);
					momentTimer.current = window.setTimeout(() => (n + 1 < moments.length ? visit(n + 1) : step()), readMs([m.title, firstSentence(m.text), e.name], MOTION.moment));
				};
				momentTimer.current = window.setTimeout(() => visit(0), MOTION.lead);
				return;
			}
			timer.current = window.setTimeout(step, readMs(captionLines(history, at)));
		};
		const step = () => {
			const current = latest.current.year;
			const next = current >= TODAY ? stops[0] : (nextStop(current) ?? TODAY);
			latest.current.onArrive(next);
			runTo(next, () => {
				if (next >= TODAY) {
					setPlaying(false);
					return;
				}
				tell(next);
			});
		};
		// Starting on a stop (the opening year, 1000 AD), tell it before moving on.
		const here = latest.current.year;
		if (here < TODAY && stops.includes(here)) {
			latest.current.onArrive(here);
			tell(here);
		} else step();
		return stop;
	}, [playing, stops, nextStop, runTo, stop, history]);

	const snapshots = year < TODAY ? eventsAt(history, year) : [];
	const starting = year < TODAY ? eventsStarting(history, year) : [];
	const lead = year < TODAY ? featured(history, year) : undefined;

	// Event marks on the track, one per year: colonial conquests stand out as scarlet squares.
	const eventMarks = useMemo(() => {
		const byYear = new Map<number, EventView[]>();
		for (const e of history.events) byYear.set(e.year, [...(byYear.get(e.year) ?? []), e]);
		return [...byYear.entries()].map(([y, list]) => ({
			year: y,
			list,
			kind: list.some((e) => isForeign(e.kind)) ? 'colonial' : list.some((e) => e.kind === 'war' || e.kind === 'raid') ? 'war' : list[0].kind,
		}));
	}, [history]);

	const told = lead && moment !== null ? lead.moments[moment] : undefined;

	return (
		<div className="timeline" role="group" aria-label={t('timeline.label')}>
			<div className="timeline__bar">
				<div className="timeline__buttons">
					<button
						type="button"
						className="timeline__btn"
						aria-label={t('timeline.prev')}
						onClick={() => {
							setPlaying(false);
							const to = year >= TODAY ? stops[stops.length - 1] : prevStop(year);
							if (to !== undefined) runTo(to);
						}}
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="M15 6l-6 6 6 6" />
						</svg>
					</button>
					<button
						type="button"
						className="timeline__btn timeline__btn--play"
						aria-label={playing ? t('timeline.pause') : t('timeline.play')}
						aria-pressed={playing}
						onClick={() => {
							if (playing) {
								setPlaying(false);
								stop();
								setShown(year);
							} else setPlaying(true);
						}}
					>
						{playing ? (
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<path d="M8 5v14M16 5v14" />
							</svg>
						) : (
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<path d="M7 4.5l12 7.5-12 7.5z" className="fill" />
							</svg>
						)}
					</button>
					<button
						type="button"
						className="timeline__btn"
						aria-label={t('timeline.next')}
						onClick={() => {
							setPlaying(false);
							if (year >= TODAY) return;
							runTo(nextStop(year) ?? TODAY);
						}}
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="M9 6l6 6-6 6" />
						</svg>
					</button>
				</div>

				<output className="timeline__year" aria-live="off">
					{shown >= TODAY ? t('timeline.today') : shown}
				</output>

				<div className="timeline__track">
					<input
						type="range"
						min={0}
						max={SLIDER_MAX}
						step={1}
						value={Math.round(yearToPos(shown))}
						aria-label={t('timeline.label')}
						aria-valuetext={shown >= TODAY ? t('timeline.today') : `${shown} ${t('timeline.ad')}`}
						onChange={(e) => {
							setPlaying(false);
							stop();
							const y = posToYear(Number(e.target.value));
							setShown(y);
							onYear(y);
						}}
					/>
					<div className="timeline__ticks" aria-hidden="true">
						{stops.map((y) => (
							<span key={y} className={y === year ? 'on' : undefined} style={{ left: `${(yearToPos(y) / SLIDER_MAX) * 100}%` }} />
						))}
					</div>
					<div className="timeline__events">
						{eventMarks.map((m) => {
							const label = t('timeline.goTo', { year: m.list[0].yearLabel ?? m.year, name: m.list.map((e) => e.name).join(' · ') });
							return (
								<button
									key={m.year}
									type="button"
									className={`timeline__event timeline__event--${m.kind}${m.year === year ? ' on' : ''}${yearToPos(m.year) / SLIDER_MAX > 0.8 ? ' is-end' : yearToPos(m.year) / SLIDER_MAX < 0.15 ? ' is-start' : ''}`}
									style={{ left: `${(yearToPos(m.year) / SLIDER_MAX) * 100}%` }}
									aria-label={label}
									data-tip={label.replace(/^[^:]*:\s*/, `${m.list[0].yearLabel ?? m.year}: `)}
									onClick={() => {
										setPlaying(false);
										runTo(m.year);
									}}
								/>
							);
						})}
					</div>
					<div className="timeline__eras" aria-hidden="true">
						{ERAS.map((y) => (
							<span key={y} style={{ left: `${(yearToPos(y) / SLIDER_MAX) * 100}%` }}>
								{y === FIRST_YEAR ? `${y} ${t('timeline.ad')}` : y}
							</span>
						))}
						<span className="timeline__eras-today" style={{ left: '100%' }}>
							{t('timeline.today')}
						</span>
					</div>
				</div>
			</div>

			{!playing && hint}

			{playing && !frame.current && lead && (
				<div className={`lower-third lower-third--event${isForeign(lead.kind) ? ' lower-third--colonial' : ''}`} key={`lt-ev-${year}`} aria-live="polite">
					{/* The card stays for the whole event; each moment's words rise in on their own. */}
					<p className="lower-third__year" key={`y-${moment ?? 'x'}`}>
						{told?.when ?? lead.yearLabel ?? year}
					</p>
					<div className="lower-third__body" key={`b-${moment ?? 'x'}`}>
						<p className="lower-third__kicker">
							<MarkIcon mark={told?.mark ?? EVENT_MARK[lead.kind]} colonial={isForeign(lead.kind)} size={18} />
							{t(`event.kind.${lead.kind}`)} · {lead.name}
						</p>
						<p className="lower-third__title">{told?.title ?? lead.name}</p>
						<p className="lower-third__text">{firstSentence(told?.text ?? lead.summary.text)}</p>
						{!told && snapshots.length > 0 && (
							<p className="lower-third__also">
								{snapshots
									.slice(0, 2)
									.map((e) => `${e.polity.name}: ${e.snapshot.title}`)
									.join(' · ')}
							</p>
						)}
					</div>
				</div>
			)}

			{playing && !frame.current && !lead && snapshots.length > 0 && (
				<div className="lower-third" key={`lt-${year}`} aria-live="polite">
					<p className="lower-third__year">{snapshots[0].snapshot.yearLabel ?? year}</p>
					<div className="lower-third__body">
						<p className="lower-third__kicker">
							<span style={{ background: snapshots[0].polity.color }} aria-hidden="true" />
							{snapshots[0].polity.name}
						</p>
						<p className="lower-third__title">{snapshots[0].snapshot.title}</p>
						<p className="lower-third__text">{firstSentence(snapshots[0].snapshot.text)}</p>
						{snapshots.length > 1 && (
							<p className="lower-third__also">
								{snapshots
									.slice(1, 4)
									.map((e) => `${e.polity.name}: ${e.snapshot.title}`)
									.join(' · ')}
							</p>
						)}
					</div>
				</div>
			)}

			{!playing && (snapshots.length > 0 || starting.length > 0) && !frame.current && (
				<ol className="timeline__caption" key={year} aria-live="polite">
					{starting.slice(0, 2).map((e, i) => (
						<li key={e.id} className="timeline__caption-event" style={{ animationDelay: `${i * 90}ms` }}>
							<button type="button" onClick={() => onOpenEvent(e.id)}>
								<MarkIcon mark={EVENT_MARK[e.kind]} colonial={isForeign(e.kind)} size={18} />
								<span className="timeline__caption-when">{e.yearLabel ?? e.year}</span>
								<strong>{e.name}</strong>
							</button>
						</li>
					))}
					{snapshots.slice(0, Math.max(0, 3 - starting.slice(0, 2).length)).map(({ polity, snapshot }, i) => (
						<li key={polity.id} style={{ animationDelay: `${(i + starting.length) * 90}ms` }}>
							<span className="timeline__caption-dot" style={{ background: polity.color }} aria-hidden="true" />
							<span className="timeline__caption-when">{snapshot.yearLabel ?? snapshot.year}</span>
							<strong>{polity.name}</strong> {snapshot.title}
						</li>
					))}
					{snapshots.length + starting.length > 3 && <li className="timeline__caption-more">+{snapshots.length + starting.length - 3}</li>}
				</ol>
			)}
		</div>
	);
}
