// The year control for the history view: play, step between events, or drag.
//
// Playback moves from event to event like turning the pages of an atlas: the
// year counter runs to the next snapshot year, the map changes on arrival, and
// the caption holds long enough to read. Dragging or stepping stops playback,
// and the newest intent always wins over a queued one.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Translate } from '../../i18n/utils';
import { eventYears, eventsAt, FIRST_YEAR, posToYear, SLIDER_MAX, TODAY, yearToPos } from '../../lib/timeline';
import type { History } from '../../lib/types';

const MOTION = {
	/** Counter run between events: ms per year travelled, clamped. */
	msPerYear: 9,
	minRun: 450,
	maxRun: 1500,
	/** How long the map rests on each event so the caption can be read. */
	hold: 2200,
	ease: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2), // power2.inOut
};

const ERAS = [1000, 1400, 1600, 1800];

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Props {
	history: History;
	year: number;
	onYear: (year: number) => void;
	tr: Translate;
}

export default function Timeline({ history, year, onYear, tr }: Props) {
	const { t } = tr;
	const stops = useMemo(() => eventYears(history), [history]);
	const [playing, setPlaying] = useState(false);
	// The year shown on the counter and slider; runs ahead of `year` while the counter is moving.
	const [shown, setShown] = useState(year);
	const frame = useRef(0);
	const timer = useRef(0);
	const latest = useRef({ year, onYear });
	latest.current = { year, onYear };

	useEffect(() => {
		if (!frame.current) setShown(year);
	}, [year]);

	const stop = useCallback(() => {
		cancelAnimationFrame(frame.current);
		clearTimeout(timer.current);
		frame.current = 0;
		timer.current = 0;
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

	// Playback: run to the next event, hold, repeat; end on the Today stop.
	useEffect(() => {
		if (!playing) return;
		const step = () => {
			const current = latest.current.year;
			const next = current >= TODAY ? stops[0] : (nextStop(current) ?? TODAY);
			runTo(next, () => {
				if (next >= TODAY) {
					setPlaying(false);
					return;
				}
				timer.current = window.setTimeout(step, MOTION.hold);
			});
		};
		step();
		return stop;
	}, [playing, stops, nextStop, runTo, stop]);

	const events = year < TODAY ? eventsAt(history, year) : [];

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

			{events.length > 0 && !frame.current && (
				<ol className="timeline__caption" key={year} aria-live="polite">
					{events.slice(0, 3).map(({ polity, snapshot }, i) => (
						<li key={polity.id} style={{ animationDelay: `${i * 90}ms` }}>
							<span className="timeline__caption-dot" style={{ background: polity.color }} aria-hidden="true" />
							<span className="timeline__caption-when">{snapshot.yearLabel ?? snapshot.year}</span>
							<strong>{polity.name}</strong> {snapshot.title}
						</li>
					))}
					{events.length > 3 && <li className="timeline__caption-more">+{events.length - 3}</li>}
				</ol>
			)}
		</div>
	);
}
