// A period of politics, told like a kingdom's story over the map: a title
// sequence, then chapter by chapter (the centre, each region or zone, the
// coalitions, the coups, the elections) with the map following, and an epilogue
// leading on to the next period. It shares the kingdom story's stage (story.css)
// and its motion: masked lines rising, an ink block wiping in the year, latched
// one-shot reveals, exits faster than entrances.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import type { Translate } from '../../i18n/utils';
import { powerChapterYear, powerChaptersOf, type PowerChapter } from '../../lib/power-story';
import type { EraView, PoliticsView } from '../../lib/types';
import { Leader, NEUTRAL } from './PowerPanel';
import { CoalitionCard, CoupCard, PartyBadge, PartyCard, ResultBar } from './PowerParts';
import { Claim } from './Profile';
import SoundToggle from './SoundToggle';

gsap.registerPlugin(SplitText);

const MOTION = {
	bars: { duration: 1.1, ease: 'power4.inOut' },
	title: { duration: 1.2, stagger: 0.035, ease: 'power4.out' },
	lines: { duration: 0.9, stagger: 0.09, ease: 'power3.out' },
	block: { duration: 0.55, ease: 'power4.inOut' },
	exit: { duration: 0.4, ease: 'power2.in' },
	counter: { duration: 1.4, ease: 'power3.inOut' },
	/** Watch: time on each chapter, from its length in words. */
	read: { msPerWord: 330, min: 7500, max: 17000 },
};

/** The politics story's ink, for the column's wash and the year blocks (a kingdom's story takes its polity's). */
const POWER_INK = '#1f6f5c';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const words = (text: string) => text.split(/\s+/).length;

interface Props {
	politics: PoliticsView;
	era: EraView;
	chapter: number;
	/** Group id → atlas colour. */
	colors: Map<string, string>;
	tr: Translate;
	onChapter: (index: number) => void;
	onClose: () => void;
	onOpenGroup: (id: string) => void;
	/** Opens another period's story (the next one, from the epilogue). */
	onEra: (id: string) => void;
	onMoment: (point: [number, number]) => void;
}

export default function PowerStory({ politics, era, chapter, colors, tr, onChapter, onClose, onOpenGroup, onEra, onMoment }: Props) {
	const { t } = tr;
	const root = useRef<HTMLDivElement>(null);
	const scroller = useRef<HTMLDivElement>(null);
	const counter = useRef<HTMLSpanElement>(null);
	const chapters = useMemo(() => powerChaptersOf(era), [era]);
	const parties = useMemo(() => new Map(era.parties.map((p) => [p.id, p])), [era]);
	const [playing, setPlaying] = useState(false);
	const revealed = useRef(new Set<number>());
	const latest = useRef({ chapter, onChapter });
	latest.current = { chapter, onChapter };
	const steering = useRef(0);
	const at = politics.eras.findIndex((e) => e.id === era.id);
	const next = politics.eras[at + 1] ?? null;
	const prefix = `power-story-${era.id}-source`;
	const unitWord = era.units.some((u) => u.kind === 'zone') ? 'power.story.zone' : era.units.some((u) => u.kind === 'state') ? 'power.story.state' : 'power.story.region';

	const titleOf = (c: PowerChapter): string => {
		if (c.kind === 'cover') return era.name;
		if (c.kind === 'centre') return t('power.federal');
		if (c.kind === 'unit') return era.units.find((u) => u.id === c.id)?.name ?? '';
		if (c.kind === 'coalition') return era.coalitions.find((x) => x.id === c.id)?.name ?? '';
		if (c.kind === 'coup') return era.coups.find((x) => x.id === c.id)?.name ?? '';
		if (c.kind === 'results') return t('power.results');
		return t('story.epilogue');
	};
	const textOf = (c: PowerChapter): string => {
		if (c.kind === 'cover') return era.summary.text;
		if (c.kind === 'centre') return era.federal.text + era.federal.leaders.map((l) => l.name + l.title).join(' ');
		if (c.kind === 'unit') return era.units.find((u) => u.id === c.id)?.text ?? '';
		if (c.kind === 'coalition') return era.coalitions.find((x) => x.id === c.id)?.text ?? '';
		if (c.kind === 'coup') {
			const k = era.coups.find((x) => x.id === c.id);
			return (k?.text ?? '') + (k?.moments.map((m) => m.text).join(' ') ?? '');
		}
		return era.summary.text.slice(0, 200);
	};

	// ---- Title sequence, and the exit.
	useLayoutEffect(() => {
		const el = root.current;
		if (!el) return;
		const ctx = gsap.context(() => {
			if (reducedMotion()) return;
			gsap
				.timeline()
				.from('.story-bar--top', { yPercent: -100, ...MOTION.bars }, 0)
				.from('.story-bar--bottom', { yPercent: 100, ...MOTION.bars }, 0)
				.from('.story-column', { clipPath: 'inset(0 0 100% 0)', duration: 1, ease: 'power4.inOut' }, 0.1);
		}, el);
		return () => ctx.revert();
	}, [era.id]);

	const close = useCallback(() => {
		const el = root.current;
		if (!el || reducedMotion()) return onClose();
		gsap
			.timeline({ onComplete: onClose })
			.to(el.querySelector('.story-column'), { clipPath: 'inset(0 0 100% 0)', ...MOTION.exit }, 0)
			.to(el.querySelector('.story-bar--top'), { yPercent: -100, ...MOTION.exit }, 0)
			.to(el.querySelector('.story-bar--bottom'), { yPercent: 100, ...MOTION.exit }, 0);
	}, [onClose]);

	// ---- A chapter reveals once, the first time it is read.
	const reveal = useCallback((index: number) => {
		if (revealed.current.has(index)) return;
		revealed.current.add(index);
		const el = scroller.current?.querySelector<HTMLElement>(`[data-chapter="${index}"]`);
		if (!el) return;
		el.dataset.revealed = 'true';
		if (reducedMotion()) return;
		const tl = gsap.timeline({ delay: index === 0 ? 0.55 : 0 });
		const title = el.querySelector<HTMLElement>('.story-title');
		if (title) {
			const split = SplitText.create(title, { type: index === 0 ? 'chars,words' : 'words', mask: index === 0 ? 'chars' : 'words' });
			tl.from(index === 0 ? split.chars : split.words, { yPercent: 115, ...(index === 0 ? MOTION.title : MOTION.lines), onComplete: () => split.revert() }, 0.15);
		}
		const year = el.querySelector<HTMLElement>('.story-year');
		const block = el.querySelector<HTMLElement>('.story-year__block');
		if (year && block) {
			gsap.set(year.querySelector('.story-year__text'), { opacity: 0 });
			tl.fromTo(block, { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, ...MOTION.block }, 0)
				.set(year.querySelector('.story-year__text'), { opacity: 1 })
				.set(block, { transformOrigin: 'right center' })
				.to(block, { scaleX: 0, ...MOTION.block });
		}
		for (const body of el.querySelectorAll<HTMLElement>('.story-lines')) {
			const split = SplitText.create(body, { type: 'lines', mask: 'lines' });
			tl.from(split.lines, { yPercent: 100, ...MOTION.lines, onComplete: () => split.revert() }, 0.35);
		}
		tl.from(el.querySelectorAll('.story-rise'), { y: 18, opacity: 0, duration: 0.8, stagger: 0.06, ease: 'power3.out' }, 0.6);
	}, []);

	// ---- The chapter crossing the reading line is the one on the map.
	useEffect(() => {
		const box = scroller.current;
		if (!box) return;
		const entering = new IntersectionObserver(
			(entries) => {
				for (const e of entries) if (e.isIntersecting) reveal(Number((e.target as HTMLElement).dataset.chapter));
			},
			{ root: box, rootMargin: '0px 0px -12% 0px' },
		);
		const reading = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (!e.isIntersecting || performance.now() < steering.current) continue;
					const index = Number((e.target as HTMLElement).dataset.chapter);
					if (index !== latest.current.chapter) latest.current.onChapter(index);
				}
			},
			{ root: box, rootMargin: '-40% 0px -55% 0px' },
		);
		for (const el of box.querySelectorAll('[data-chapter]')) {
			entering.observe(el);
			reading.observe(el);
		}
		reveal(0);
		return () => {
			entering.disconnect();
			reading.disconnect();
		};
	}, [era.id, reveal]);

	const goTo = useCallback(
		(index: number) => {
			const i = Math.max(0, Math.min(chapters.length - 1, index));
			const el = scroller.current?.querySelector<HTMLElement>(`[data-chapter="${i}"]`);
			steering.current = performance.now() + 1200;
			reveal(i);
			latest.current.onChapter(i);
			el && scroller.current?.scrollTo({ top: el.offsetTop - 24, behavior: reducedMotion() ? 'auto' : 'smooth' });
		},
		[chapters.length, reveal],
	);

	// ---- The year counter runs between chapters.
	const current = chapters[chapter] ?? chapters[0];
	const shownYear = powerChapterYear(era, current);
	const lastYear = useRef(shownYear);
	useEffect(() => {
		const el = counter.current;
		if (!el) return;
		const from = lastYear.current;
		lastYear.current = shownYear;
		if (reducedMotion()) {
			el.textContent = String(shownYear);
			return;
		}
		const state = { y: from };
		const tween = gsap.to(state, { y: shownYear, ...MOTION.counter, onUpdate: () => void (el.textContent = String(Math.round(state.y))) });
		return () => void tween.kill();
	}, [shownYear]);

	// ---- Watch.
	const hold = Math.min(MOTION.read.max, Math.max(MOTION.read.min, words(textOf(current)) * MOTION.read.msPerWord));
	useEffect(() => {
		if (!playing) return;
		if (chapter >= chapters.length - 1) {
			setPlaying(false);
			return;
		}
		const id = window.setTimeout(() => goTo(chapter + 1), hold);
		return () => clearTimeout(id);
	}, [playing, chapter, chapters.length, hold, goTo]);

	useEffect(() => {
		const box = scroller.current;
		if (!box || !playing) return;
		const stop = () => setPlaying(false);
		box.addEventListener('wheel', stop, { passive: true });
		box.addEventListener('touchstart', stop, { passive: true });
		return () => {
			box.removeEventListener('wheel', stop);
			box.removeEventListener('touchstart', stop);
		};
	}, [playing]);

	// Keys: arrows step chapters, space plays, Escape closes.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const el = e.target as HTMLElement | null;
			if (el?.closest('input, textarea, select')) return;
			if (e.key === 'Escape') {
				e.preventDefault();
				close();
			} else if (e.key === 'ArrowRight') {
				e.preventDefault();
				setPlaying(false);
				goTo(latest.current.chapter + 1);
			} else if (e.key === 'ArrowLeft') {
				e.preventDefault();
				setPlaying(false);
				goTo(latest.current.chapter - 1);
			} else if (e.key === ' ' && !el?.closest('button, a')) {
				e.preventDefault();
				setPlaying((x) => !x);
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [close, goTo]);

	// Stations: evenly spaced, since a period's chapters are not all dated.
	const pos = (i: number) => (chapters.length <= 2 ? 0 : ((i - 1) / (chapters.length - 2)) * 100);
	const station = Math.max(1, chapter);
	const kindLabel = (c: PowerChapter) =>
		c.kind === 'cover'
			? t('story.prologue')
			: c.kind === 'centre'
				? t('power.story.centre')
				: c.kind === 'unit'
					? t(unitWord)
					: c.kind === 'coalition'
						? t('power.story.coalition')
						: c.kind === 'coup'
							? t('power.story.coup')
							: c.kind === 'results'
								? t('power.story.results')
								: t('story.epilogue');

	return (
		<div className="story story--power" ref={root} style={{ '--ink-polity': POWER_INK } as React.CSSProperties} role="dialog" aria-modal="false" aria-labelledby="power-story-name">
			<div className="story-bar story-bar--top">
				<button type="button" className="story-close" onClick={close}>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M15 6l-6 6 6 6" />
					</svg>
					<span>{t('story.back')}</span>
				</button>
				<p className="story-bar__title">
					<span>{era.label}</span> {era.name}
				</p>
				<div className="story-bar__end">
					<p className="story-bar__count" aria-live="polite">
						{kindLabel(current)}
						{chapter > 0 && chapter < chapters.length - 1 ? ` · ${chapter} / ${chapters.length - 2}` : ''}
					</p>
					<SoundToggle tr={tr} className="sound-toggle--film" />
				</div>
			</div>

			<div className="story-column" ref={scroller} tabIndex={-1}>
				{chapters.map((c, i) => (
					<section key={i} className={`story-chapter story-chapter--${c.kind === 'cover' ? 'cover' : 'snapshot'}${i === chapter ? ' is-active' : ''}`} data-chapter={i} aria-labelledby={i === 0 ? 'power-story-name' : `power-ch-${i}`}>
						{c.kind === 'cover' ? (
							<>
								<p className="story-eyebrow story-rise">
									{t('power.story.period')} · {era.label}
								</p>
								<h2 id="power-story-name" className="story-title story-title--cover">
									{era.name}
								</h2>
								{era.status !== 'published' && <p className="profile__draft story-rise">{t('power.draft')}</p>}
								<p className="story-lead">
									<span className="story-lines">{era.summary.text}</span> <Claim e={era.summary} tr={tr} prefix={prefix} />
								</p>
								<dl className="story-facts story-rise">
									<div>
										<dt>{t(unitWord)}</dt>
										<dd>{era.units.length}</dd>
									</div>
									<div>
										<dt>{t('power.parties')}</dt>
										<dd>{era.parties.length}</dd>
									</div>
									<div>
										<dt>{t('power.coups')}</dt>
										<dd>{era.coups.length}</dd>
									</div>
								</dl>
								<div className="story-start story-rise">
									<button type="button" className="story-watch" onClick={() => (setPlaying(true), goTo(1))}>
										<svg viewBox="0 0 24 24" aria-hidden="true">
											<path d="M7 4.5l12 7.5-12 7.5z" />
										</svg>
										{t('story.watch')}
									</button>
									<button type="button" className="story-begin" onClick={() => goTo(1)}>
										{t('story.read')}
										<span aria-hidden="true" className="story-begin__line" />
									</button>
								</div>
							</>
						) : (
							<>
								<p className="story-chapter__num story-rise">{kindLabel(c)}</p>
								<p className="story-year" aria-hidden="true">
									<span className="story-year__text">{c.kind === 'end' ? era.label : powerChapterYear(era, c)}</span>
									<span className="story-year__block" />
								</p>
								<h3 id={`power-ch-${i}`} className="story-title">
									{titleOf(c)}
								</h3>
								<Chapter
									c={c}
									era={era}
									parties={parties}
									colors={colors}
									tr={tr}
									prefix={prefix}
									onOpenGroup={onOpenGroup}
									onMoment={onMoment}
								/>
								{c.kind === 'end' && (
									<>
										{next && (
											<button type="button" className="story-next story-rise" onClick={() => onEra(next.id)}>
												<span>{t('story.next')}</span>
												<strong>{next.name}</strong>
												<svg viewBox="0 0 24 24" aria-hidden="true">
													<path d="M5 12h14M13 6l6 6-6 6" />
												</svg>
											</button>
										)}
										<details className="story-sources">
											<summary>{t('story.sources', { count: era.sources.length })}</summary>
											<ol className="sources">
												{era.sources.map((s) => (
													<li key={s.id} id={`${prefix}-${s.n}`}>
														{s.url ? (
															<a href={s.url} rel="noopener" target="_blank">
																{s.citation}
															</a>
														) : (
															s.citation
														)}
														{!s.checked && <span className="sources__unchecked"> ({t('profile.sourceNotChecked')})</span>}
													</li>
												))}
											</ol>
											{era.status !== 'published' && era.reviewNotes.length > 0 && (
												<div className="review-notes">
													<h4>{t('profile.reviewNotes')}</h4>
													<ul>
														{era.reviewNotes.map((n) => (
															<li key={n}>{n}</li>
														))}
													</ul>
												</div>
											)}
											<p className="profile__disclaimer">{t('power.method')}</p>
										</details>
									</>
								)}
							</>
						)}
					</section>
				))}
				<div className="story-tail" aria-hidden="true" />
			</div>

			<div className="story-bar story-bar--bottom">
				<div className="story-now">
					<span className="story-now__year" ref={counter}>
						{shownYear}
					</span>
					<span className="story-now__label">{chapter === 0 ? era.label : titleOf(current)}</span>
				</div>
				<div className="story-track" role="group" aria-label={t('power.story.track', { name: era.name })}>
					<div className="story-track__rail" aria-hidden="true">
						<span className="story-track__fill" style={{ width: `${pos(station)}%` }} />
					</div>
					{chapters.map((c, i) =>
						c.kind === 'cover' ? null : (
							<button
								key={i}
								type="button"
								className={`story-stop${i === station ? ' is-now' : ''}${i < station ? ' is-past' : ''}`}
								style={{ left: `${pos(i)}%` }}
								onClick={() => {
									setPlaying(false);
									goTo(i);
								}}
								aria-label={`${kindLabel(c)}: ${titleOf(c)}`}
								aria-current={i === station ? 'step' : undefined}
							>
								<span className="story-stop__dot" />
								{(i === station || i === 1 || c.kind === 'end') && <span className="story-stop__label">{c.kind === 'end' ? t('story.epilogue') : titleOf(c)}</span>}
							</button>
						),
					)}
					{playing && <span className="story-track__clock" key={chapter} style={{ left: `${pos(station)}%`, animationDuration: `${hold}ms` }} aria-hidden="true" />}
				</div>
				<div className="story-controls">
					<button type="button" className="timeline__btn" aria-label={t('timeline.prev')} onClick={() => (setPlaying(false), goTo(chapter - 1))} disabled={chapter === 0}>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="M15 6l-6 6 6 6" />
						</svg>
					</button>
					<button
						type="button"
						className="timeline__btn timeline__btn--play"
						aria-pressed={playing}
						aria-label={playing ? t('timeline.pause') : t('story.watch')}
						onClick={() => {
							if (playing) setPlaying(false);
							else {
								setPlaying(true);
								if (chapter === 0 || chapter >= chapters.length - 1) goTo(1);
							}
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
					<button type="button" className="timeline__btn" aria-label={t('timeline.next')} onClick={() => (setPlaying(false), goTo(chapter + 1))} disabled={chapter >= chapters.length - 1}>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="M9 6l6 6-6 6" />
						</svg>
					</button>
				</div>
			</div>
		</div>
	);
}

/** The body of one chapter. */
function Chapter({
	c,
	era,
	parties,
	colors,
	tr,
	prefix,
	onOpenGroup,
	onMoment,
}: {
	c: PowerChapter;
	era: EraView;
	parties: Map<string, EraView['parties'][number]>;
	colors: Map<string, string>;
	tr: Translate;
	prefix: string;
	onOpenGroup: (id: string) => void;
	onMoment: (point: [number, number]) => void;
}) {
	const { t } = tr;
	if (c.kind === 'centre') {
		return (
			<>
				<p className="story-text">
					<span className="story-lines">{era.federal.text}</span> <Claim e={era.federal} tr={tr} prefix={prefix} />
				</p>
				<ul className="power-leaders story-rise">
					{era.federal.leaders.map((l) => (
						<Leader key={l.name + l.from} leader={l} party={l.party ? parties.get(l.party) : undefined} colors={colors} tr={tr} onOpenGroup={onOpenGroup} />
					))}
				</ul>
				{era.parties.length > 0 && (
					<div className="story-links story-rise">
						<h4>{t('power.parties')}</h4>
						<div className="party-list">
							{era.parties.map((p) => (
								<PartyCard key={p.id} party={p} colors={colors} tr={tr} onOpenGroup={onOpenGroup} />
							))}
						</div>
					</div>
				)}
			</>
		);
	}
	if (c.kind === 'unit') {
		const u = era.units.find((x) => x.id === c.id);
		if (!u) return null;
		return (
			<>
				<p className="power-unit__groups story-rise">
					<span className="muted">{t('power.dominant')}</span>
					{u.groups.map((g) => (
						<button key={g.id} type="button" className="chip chip--atlas" onClick={() => onOpenGroup(g.id)}>
							<span className="chip__dot" style={{ background: colors.get(g.id) ?? NEUTRAL }} aria-hidden="true" />
							{g.name}
						</button>
					))}
					{u.party && <PartyBadge party={parties.get(u.party)} size="sm" />}
				</p>
				<p className="story-text">
					<span className="story-lines">{u.text}</span> <Claim e={u} tr={tr} prefix={prefix} />
				</p>
				{u.seat && <p className="story-note story-rise">{t('power.story.seat', { place: u.seat.name })}</p>}
				{u.leaders.length > 0 && (
					<div className="story-links story-rise">
						<h4>{t('power.story.leaders')}</h4>
						<ul className="power-leaders">
							{u.leaders.map((l) => (
								<Leader key={l.name + l.from} leader={l} party={l.party ? parties.get(l.party) : undefined} colors={colors} tr={tr} onOpenGroup={onOpenGroup} />
							))}
						</ul>
					</div>
				)}
			</>
		);
	}
	if (c.kind === 'coalition') {
		const k = era.coalitions.find((x) => x.id === c.id);
		if (!k) return null;
		return (
			<div className="story-rise">
				<CoalitionCard coalition={k} parties={parties} selected tr={tr} onSelect={() => {}} />
			</div>
		);
	}
	if (c.kind === 'coup') {
		const k = era.coups.find((x) => x.id === c.id);
		if (!k) return null;
		return (
			<div className="story-rise">
				<CoupCard coup={k} selected colors={colors} tr={tr} onSelect={() => {}} onMoment={onMoment} onOpenGroup={onOpenGroup} />
			</div>
		);
	}
	if (c.kind === 'results') {
		return (
			<div className="story-rise">
				{era.results.map((r) => (
					<ResultBar key={r.title} result={r} parties={parties} tr={tr} />
				))}
			</div>
		);
	}
	if (c.kind === 'end') {
		return <p className="story-text story-rise">{t('power.story.endText', { name: era.name, years: era.label })}</p>;
	}
	return null;
}
