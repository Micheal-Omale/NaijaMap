// A polity's story, told like a documentary over the old map.
//
// It opens with a title sequence (letterbox bars close in, the name rises out
// of a mask), then runs chapter by chapter, one per snapshot, ending on what
// remains today. Scrolling the story is the remote control: when a chapter
// reaches the reading line it latches, and the map flies to that moment,
// changes year and draws the frontier. "Watch" plays the chapters on their own,
// giving each the time it takes to read.
//
// Motion follows the house discipline (inspiration PATTERNS.md): masked
// SplitText lines rising with power3.out, an ink block wipe for chapter years
// (after Copy.jsx), latched one-shots so a chapter reveals once, and exits about
// three times faster than entrances.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import type { Translate } from '../../i18n/utils';
import { chaptersOf, chapterYear, type Chapter } from '../../lib/story';
import { TODAY } from '../../lib/timeline';
import type { History, LinkKind, PolityView } from '../../lib/types';
import { Claim, ConfidenceBadge } from './Profile';
import SoundToggle from './SoundToggle';
import ShareButton from '../ShareButton';

gsap.registerPlugin(SplitText);

const MOTION = {
	bars: { duration: 1.1, ease: 'power4.inOut' },
	title: { duration: 1.2, stagger: 0.035, ease: 'power4.out' },
	lines: { duration: 0.9, stagger: 0.09, ease: 'power3.out' },
	block: { duration: 0.55, ease: 'power4.inOut' },
	exit: { duration: 0.4, ease: 'power2.in' },
	counter: { duration: 1.4, ease: 'power3.inOut' },
	/** Autoplay: time on each chapter, from its length in words. */
	read: { msPerWord: 340, min: 7500, max: 17000 },
};

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

function words(text: string): number {
	return text.split(/\s+/).length;
}

/** The polity whose height lies closest to this one's, for "continue with". */
function neighbour(history: History, p: PolityView): PolityView | null {
	const centre = (x: PolityView) => {
		const s = x.snapshots.reduce((best, s) => (s.year <= x.peak ? s : best), x.snapshots[0]);
		return s.capital?.point ?? s.label ?? null;
	};
	const here = centre(p);
	if (!here) return null;
	let best: PolityView | null = null;
	let score = Infinity;
	for (const q of history.polities) {
		const c = centre(q);
		if (q.id === p.id || !c) continue;
		const overlap = Math.min(p.span.to, q.span.to) - Math.max(p.span.from, q.span.from);
		const d = Math.hypot(c[0] - here[0], c[1] - here[1]) - (overlap > 0 ? 0.5 : 0);
		if (d < score) {
			score = d;
			best = q;
		}
	}
	return best;
}

const LINK_ICON: Record<LinkKind, string> = {
	tribute: 'then-line--tribute',
	trade: 'then-line--trade',
	war: 'then-line--war',
	ritual: 'then-line--ritual',
	descent: 'then-line--descent',
};

/** Lines grouped for a chapter: wars, routes and ritual ties first, then vassals, then towns of descent. */
const LINK_GROUPS: { kinds: LinkKind[]; heading?: 'story.vassals' | 'story.descent' }[] = [
	{ kinds: ['war', 'trade', 'ritual'] },
	{ kinds: ['tribute'], heading: 'story.vassals' },
	{ kinds: ['descent'], heading: 'story.descent' },
];

interface Props {
	polity: PolityView;
	history: History;
	/** The chapter the map is showing. */
	chapter: number;
	tr: Translate;
	onChapter: (index: number) => void;
	onClose: () => void;
	onOpenGroup: (id: string) => void;
	onOpenPolity: (id: string) => void;
}

export default function StoryMode({ polity: p, history, chapter, tr, onChapter, onClose, onOpenGroup, onOpenPolity }: Props) {
	const { t } = tr;
	const root = useRef<HTMLDivElement>(null);
	const scroller = useRef<HTMLDivElement>(null);
	const counter = useRef<HTMLSpanElement>(null);
	const chapters = useMemo(() => chaptersOf(p), [p]);
	const [playing, setPlaying] = useState(false);
	const revealed = useRef(new Set<number>());
	const latest = useRef({ chapter, onChapter });
	latest.current = { chapter, onChapter };
	// While the story scrolls itself (a click on the timeline, or Watch), the reading line is ignored.
	const steering = useRef(0);
	const next = neighbour(history, p);
	const prefix = `story-${p.id}-source`;

	const yearText = (c: Chapter) => {
		if (c.kind === 'today') return t('timeline.today');
		if (c.kind === 'snapshot') return p.snapshots[c.index].yearLabel ?? String(p.snapshots[c.index].year);
		return `${p.span.fromLabel ?? p.span.from} – ${p.span.toLabel ?? p.span.to}`;
	};

	// ---- Title sequence, and the exit.
	useLayoutEffect(() => {
		const el = root.current;
		if (!el) return;
		const ctx = gsap.context(() => {
			if (reducedMotion()) return;
			const tl = gsap.timeline();
			tl.from('.story-bar--top', { yPercent: -100, ...MOTION.bars }, 0)
				.from('.story-bar--bottom', { yPercent: 100, ...MOTION.bars }, 0)
				.from('.story-column', { clipPath: 'inset(0 0 100% 0)', duration: 1, ease: 'power4.inOut' }, 0.1);
		}, el);
		return () => ctx.revert();
	}, [p.id]);

	const close = useCallback(() => {
		const el = root.current;
		if (!el || reducedMotion()) return onClose();
		gsap
			.timeline({ onComplete: onClose })
			.to(el.querySelector('.story-column'), { clipPath: 'inset(0 0 100% 0)', ...MOTION.exit }, 0)
			.to(el.querySelector('.story-bar--top'), { yPercent: -100, ...MOTION.exit }, 0)
			.to(el.querySelector('.story-bar--bottom'), { yPercent: 100, ...MOTION.exit }, 0);
	}, [onClose]);

	// ---- Reveal a chapter the first time it is read (a latched one-shot).
	const reveal = useCallback(
		(index: number) => {
			if (revealed.current.has(index)) return;
			revealed.current.add(index);
			const el = scroller.current?.querySelector<HTMLElement>(`[data-chapter="${index}"]`);
			if (!el) return;
			// A data attribute, not a class: React owns className and would wipe it on the next render.
			el.dataset.revealed = 'true';
			if (reducedMotion()) return;
			// The prologue waits for the letterbox bars to close in.
			const tl = gsap.timeline({ delay: index === 0 ? 0.55 : 0 });
			const title = el.querySelector<HTMLElement>('.story-title');
			if (title) {
				const split = SplitText.create(title, { type: index === 0 ? 'chars,words' : 'words', mask: index === 0 ? 'chars' : 'words' });
				tl.from(index === 0 ? split.chars : split.words, { yPercent: 115, ...(index === 0 ? MOTION.title : MOTION.lines), onComplete: () => split.revert() }, 0.15);
			}
			// The year: an ink block wipes across, then lifts away to leave the numerals.
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
			tl.from(el.querySelectorAll('.story-rise'), { y: 18, opacity: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out' }, 0.6);
		},
		[],
	);

	// ---- Chapters reveal as they come into view; the one crossing the reading line
	// (40% down the story column) is the one on the map.
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
		return () => {
			entering.disconnect();
			reading.disconnect();
		};
	}, [p.id, reveal]);

	// Open on the chapter the address asked for.
	useEffect(() => {
		const el = scroller.current?.querySelector<HTMLElement>(`[data-chapter="${latest.current.chapter}"]`);
		reveal(latest.current.chapter);
		if (el && latest.current.chapter > 0) scroller.current!.scrollTop = el.offsetTop - 24;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [p.id]);

	/** Scrolls the story to a chapter and puts it on the map. */
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

	// ---- The year counter in the lower bar runs between chapters.
	const shownYear = chapterYear(p, chapters[chapter] ?? chapters[0]);
	const lastYear = useRef(shownYear);
	useEffect(() => {
		const el = counter.current;
		if (!el) return;
		const from = lastYear.current;
		lastYear.current = shownYear;
		const label = (y: number) => (y >= TODAY ? t('timeline.today') : String(Math.round(y)));
		if (reducedMotion() || from >= TODAY || shownYear >= TODAY) {
			el.textContent = label(shownYear);
			return;
		}
		const state = { y: from };
		const tween = gsap.to(state, { y: shownYear, ...MOTION.counter, onUpdate: () => void (el.textContent = label(state.y)) });
		return () => void tween.kill();
	}, [shownYear, t]);

	// ---- Watch: each chapter holds for its reading time, then the story moves on.
	const readMs = (c: Chapter) => {
		const text = c.kind === 'snapshot' ? p.snapshots[c.index].text + p.snapshots[c.index].title : c.kind === 'today' ? p.today.text : p.summary.text;
		return Math.min(MOTION.read.max, Math.max(MOTION.read.min, words(text) * MOTION.read.msPerWord));
	};
	const hold = readMs(chapters[chapter] ?? chapters[0]);
	useEffect(() => {
		if (!playing) return;
		if (chapter >= chapters.length - 1) {
			setPlaying(false);
			return;
		}
		const id = window.setTimeout(() => goTo(chapter + 1), hold);
		return () => clearTimeout(id);
	}, [playing, chapter, chapters.length, hold, goTo]);

	// The visitor's hand stops the film.
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

	// ---- Phone gestures: drag the sheet between three heights; swipe sideways between chapters.
	const grab = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const handle = grab.current;
		const el = root.current;
		const box = scroller.current;
		if (!handle || !el || !box) return;
		const phone = window.matchMedia('(max-width: 899px)');
		const tick = () => navigator.vibrate?.(8);
		const stops = () => [0.22, 0.46, 0.86].map((f) => Math.round(window.innerHeight * f));
		const setHeight = (h: number) => el.style.setProperty('--story-bottom', `${Math.round(h)}px`);
		let drag: { y: number; h: number } | null = null;

		const down = (e: PointerEvent) => {
			if (!phone.matches) return;
			drag = { y: e.clientY, h: box.getBoundingClientRect().height };
			el.classList.remove('is-snapping');
			handle.setPointerCapture(e.pointerId);
		};
		const move = (e: PointerEvent) => {
			if (!drag) return;
			const h = drag.h + (drag.y - e.clientY);
			setHeight(Math.min(window.innerHeight * 0.92, Math.max(window.innerHeight * 0.16, h)));
		};
		const up = (e: PointerEvent) => {
			if (!drag) return;
			const moved = drag.y - e.clientY;
			const h = box.getBoundingClientRect().height;
			const all = stops();
			// A deliberate pull goes to the next height in that direction; a small one settles on the nearest.
			let target = all.reduce((a, b) => (Math.abs(b - h) < Math.abs(a - h) ? b : a));
			if (moved > 40) target = all.find((s) => s > drag!.h + 10) ?? all[all.length - 1];
			if (moved < -40) target = [...all].reverse().find((s) => s < drag!.h - 10) ?? all[0];
			drag = null;
			el.classList.add('is-snapping');
			setHeight(target);
			tick();
		};
		handle.addEventListener('pointerdown', down);
		handle.addEventListener('pointermove', move);
		handle.addEventListener('pointerup', up);
		handle.addEventListener('pointercancel', up);

		let swipe: { x: number; y: number; t: number } | null = null;
		const touchStart = (e: TouchEvent) => {
			const t = e.touches[0];
			swipe = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, t: performance.now() } : null;
		};
		const touchEnd = (e: TouchEvent) => {
			if (!swipe || !phone.matches) return;
			const t = e.changedTouches[0];
			const dx = t.clientX - swipe.x;
			const dy = t.clientY - swipe.y;
			const quick = performance.now() - swipe.t < 700;
			swipe = null;
			if (!quick || Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
			setPlaying(false);
			goTo(latest.current.chapter + (dx < 0 ? 1 : -1));
			tick();
		};
		box.addEventListener('touchstart', touchStart, { passive: true });
		box.addEventListener('touchend', touchEnd, { passive: true });
		return () => {
			handle.removeEventListener('pointerdown', down);
			handle.removeEventListener('pointermove', move);
			handle.removeEventListener('pointerup', up);
			handle.removeEventListener('pointercancel', up);
			box.removeEventListener('touchstart', touchStart);
			box.removeEventListener('touchend', touchEnd);
		};
	}, [goTo]);

	// Keys: arrows step chapters, space plays, Escape closes.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const el = e.target as HTMLElement | null;
			if (el?.closest('input, textarea, select')) return;
			if (e.key === 'Escape') {
				e.preventDefault();
				close();
			} else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
				if (e.key !== 'ArrowRight' && el?.closest('.story-column')) return;
				e.preventDefault();
				setPlaying(false);
				goTo(latest.current.chapter + 1);
			} else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
				if (e.key !== 'ArrowLeft' && el?.closest('.story-column')) return;
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

	// ---- The focused timeline: this polity's own span, chapters as stations, Today at the end.
	const span = Math.max(1, p.span.to - p.span.from);
	const at = (c: Chapter) => (c.kind === 'today' ? 100 : c.kind === 'cover' ? 0 : 4 + ((p.snapshots[c.index].year - p.span.from) / span) * 84);
	const current = chapters[chapter] ?? chapters[0];
	// The prologue shows the polity at its height, so its station on the timeline is the peak chapter.
	const station = current.kind === 'cover' ? 1 + p.snapshots.reduce((best, s, i) => (s.year <= p.peak ? i : best), 0) : chapter;
	const nowPos = at(chapters[station]);

	return (
		<div className="story" ref={root} style={{ '--ink-polity': p.color } as React.CSSProperties} role="dialog" aria-modal="false" aria-labelledby="story-name">
			<div className="story-bar story-bar--top">
				<button type="button" className="story-close" onClick={close}>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M15 6l-6 6 6 6" />
					</svg>
					<span>{t('story.back')}</span>
				</button>
				<p className="story-bar__title">
					<span>{t(`kind.${p.kind}`)}</span> {p.name}
				</p>
				<div className="story-bar__end">
					<p className="story-bar__count" aria-live="polite">
						{current.kind === 'cover' ? t('story.prologue') : current.kind === 'today' ? t('story.epilogue') : t('story.chapterOf', { n: ROMAN[current.index] ?? current.index + 1, total: ROMAN[p.snapshots.length - 1] ?? p.snapshots.length })}
					</p>
					<SoundToggle tr={tr} className="sound-toggle--film" />
					<ShareButton tr={tr} className="sound-toggle--film" />
				</div>
			</div>

			<div className="story-column" ref={scroller} tabIndex={-1}>
				<div className="story-grab" ref={grab} aria-hidden="true">
					<span />
				</div>
				{chapters.map((c, i) => (
					<section key={i} className={`story-chapter story-chapter--${c.kind}${i === chapter ? ' is-active' : ''}`} data-chapter={i} aria-labelledby={i === 0 ? 'story-name' : `story-ch-${i}`}>
						{c.kind === 'cover' && (
							<>
								<p className="story-eyebrow story-rise">
									{t(`kind.${p.kind}`)} · {yearText(c)}
								</p>
								<h2 id="story-name" className="story-title story-title--cover">
									{p.name}
								</h2>
								{p.otherNames.length > 0 && <p className="story-aka story-rise">{t('polity.otherNames', { names: p.otherNames.join(', ') })}</p>}
								{p.status !== 'published' && <p className="profile__draft story-rise">{t('polity.draft')}</p>}
								<p className="story-lead">
									<span className="story-lines">{p.summary.text}</span> <Claim e={p.summary} tr={tr} prefix={prefix} />
								</p>
								<dl className="story-facts story-rise">
									{p.ruler && (
										<div>
											<dt>{t('polity.ruler')}</dt>
											<dd>{p.ruler.title}</dd>
										</div>
									)}
									<div>
										<dt>{t('story.chapters')}</dt>
										<dd>{p.snapshots.length}</dd>
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
									<a className="story-begin story-versus" href={`/versus?a=${p.id}`}>
										{t('story.versus', { name: p.shortName })} →
									</a>
								</div>
							</>
						)}

						{c.kind === 'snapshot' &&
							(() => {
								const s = p.snapshots[c.index];
								return (
									<>
										<p className="story-chapter__num story-rise">{t('story.chapter', { n: ROMAN[c.index] ?? c.index + 1 })}</p>
										<p className="story-year" aria-hidden="true">
											<span className="story-year__text">{s.yearLabel ?? s.year}</span>
											<span className="story-year__block" />
										</p>
										<h3 id={`story-ch-${i}`} className="story-title">
											<span className="visually-hidden">{s.yearLabel ?? s.year}: </span>
											{s.title}
										</h3>
										<p className="story-text">
											<span className="story-lines">{s.text}</span> <Claim e={s} tr={tr} prefix={prefix} />
										</p>
										{s.note && <p className="story-note story-rise">{s.note}</p>}
										<ul className="story-marks story-rise">
											{s.capital && (
												<li>
													<span className="then-swatch then-swatch--capital" aria-hidden="true" />
													<span>
														<strong>{t('polity.capital')}</strong> {s.capital.name}
													</span>
												</li>
											)}
											{s.core && (
												<li>
													<span className="then-swatch then-swatch--core" aria-hidden="true" />
													<span>
														<strong>{t('polity.layer.core')}</strong> <ConfidenceBadge level={s.core} tr={tr} />
													</span>
												</li>
											)}
											{s.influence && (
												<li>
													<span className={`then-swatch then-swatch--${p.kind === 'network' ? 'network' : 'influence'}`} aria-hidden="true" />
													<span>
														<strong>{t('polity.layer.influence')}</strong> <ConfidenceBadge level={s.influence} tr={tr} />
													</span>
												</li>
											)}
											{s.campaign && (
												<li>
													<span className="then-swatch then-swatch--campaign" aria-hidden="true" />
													<span>
														<strong>{t('polity.layer.campaign')}</strong> <ConfidenceBadge level={s.campaign} tr={tr} />
													</span>
												</li>
											)}
										</ul>
										{LINK_GROUPS.map((g) => {
											const list = s.links.filter((l) => g.kinds.includes(l.kind));
											if (!list.length) return null;
											return (
												<div key={g.kinds.join()} className="story-links story-rise">
													{g.heading && <h4>{t(g.heading)}</h4>}
													<ul className="story-marks">
														{list.map((l) => (
															<li key={l.kind + l.to.name}>
																<span className={`then-line ${LINK_ICON[l.kind]}`} aria-hidden="true" />
																<span>
																	{!g.heading && <strong>{t(`then.key.${l.kind}`)}</strong>} {l.label ?? l.to.name}{' '}
																	{l.refs.length > 0 && <Claim e={{ refs: l.refs, confidence: l.confidence ?? s.confidence }} tr={tr} prefix={prefix} />}
																	{l.note && <span className="story-links__note">{l.note}</span>}
																</span>
															</li>
														))}
													</ul>
												</div>
											);
										})}
									</>
								);
							})()}

						{c.kind === 'today' && (
							<>
								<p className="story-chapter__num story-rise">{t('story.epilogue')}</p>
								<p className="story-year" aria-hidden="true">
									<span className="story-year__text">{t('timeline.today')}</span>
									<span className="story-year__block" />
								</p>
								<h3 id={`story-ch-${i}`} className="story-title">
									{p.today.title ?? t('polity.today')}
								</h3>
								<p className="story-text">
									<span className="story-lines">{p.today.text}</span> <Claim e={p.today} tr={tr} prefix={prefix} />
								</p>
								{p.livesThereToday.length > 0 && (
									<div className="story-rise story-people">
										<h4>{t('polity.livesThere')}</h4>
										<p className="muted">{t('story.livesHelp')}</p>
										<ul className="intro__groups">
											{p.livesThereToday.map((g) => (
												<li key={g.id}>
													<button type="button" className="chip" onClick={() => onOpenGroup(g.id)} aria-label={t('polity.openPeople', { name: g.name })}>
														{g.name} <span className="chip__count">{g.lgas}</span>
													</button>
												</li>
											))}
										</ul>
									</div>
								)}
								{next && (
									<button type="button" className="story-next story-rise" onClick={() => onOpenPolity(next.id)}>
										<span>{t('story.next')}</span>
										<strong style={{ color: next.color }}>{next.name}</strong>
										<svg viewBox="0 0 24 24" aria-hidden="true">
											<path d="M5 12h14M13 6l6 6-6 6" />
										</svg>
									</button>
								)}
								<details className="story-sources">
									<summary>{t('story.sources', { count: p.sources.length })}</summary>
									<ol className="sources">
										{p.sources.map((s) => (
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
									{p.status !== 'published' && p.reviewNotes.length > 0 && (
										<div className="review-notes">
											<h4>{t('profile.reviewNotes')}</h4>
											<ul>
												{p.reviewNotes.map((n) => (
													<li key={n}>{n}</li>
												))}
											</ul>
										</div>
									)}
									<p className="profile__disclaimer">{t('then.method')}</p>
								</details>
							</>
						)}
					</section>
				))}
				<div className="story-tail" aria-hidden="true" />
			</div>

			<div className="story-bar story-bar--bottom">
				<div className="story-now">
					<span className="story-now__year" ref={counter}>
						{shownYear >= TODAY ? t('timeline.today') : shownYear}
					</span>
					<span className="story-now__label">{current.kind === 'snapshot' ? p.snapshots[current.index].title : current.kind === 'today' ? (p.today.title ?? '') : t('story.height')}</span>
				</div>
				<div className="story-track" role="group" aria-label={t('story.timeline', { name: p.name })}>
					<div className="story-track__rail" aria-hidden="true">
						<span className="story-track__fill" style={{ width: `${nowPos}%` }} />
					</div>
					{chapters.map((c, i) =>
						c.kind === 'cover' ? null : (
							<button
								key={i}
								type="button"
								className={`story-stop${i === station ? ' is-now' : ''}${i < station ? ' is-past' : ''}`}
								style={{ left: `${at(c)}%` }}
								onClick={() => {
									setPlaying(false);
									goTo(i);
								}}
								aria-label={`${yearText(c)}: ${c.kind === 'snapshot' ? p.snapshots[c.index].title : t('story.epilogue')}`}
								aria-current={i === station ? 'step' : undefined}
							>
								<span className="story-stop__dot" />
								{(i === station || i === 1 || c.kind === 'today') && <span className="story-stop__label">{c.kind === 'today' ? t('timeline.today') : p.snapshots[c.index].year}</span>}
							</button>
						),
					)}
					{playing && <span className="story-track__clock" key={chapter} style={{ left: `${nowPos}%`, animationDuration: `${hold}ms` }} aria-hidden="true" />}
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
								if (chapter >= chapters.length - 1) goTo(1);
								else if (chapter === 0) goTo(1);
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
