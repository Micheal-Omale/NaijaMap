// The side panel in the history view: the states on the map in the chosen year
// (with the map key), and one polity's story through time.

import type { Translate } from '../../i18n/utils';
import { activeAt, eventYears, snapshotAt, TODAY } from '../../lib/timeline';
import type { History, PolityView } from '../../lib/types';
import { Claim, ConfidenceBadge } from './Profile';

function yearText(year: number, tr: Translate): string {
	return year >= TODAY ? tr.t('timeline.today') : String(year);
}

export function HistoryKey({ tr }: { tr: Translate }) {
	const { t } = tr;
	return (
		<div className="legend then-key">
			<h3 className="legend__heading">{t('legend.heading')}</h3>
			<ul>
				<li>
					<span className="then-swatch then-swatch--core" aria-hidden="true" />
					{t('then.key.core')}
				</li>
				<li>
					<span className="then-swatch then-swatch--influence" aria-hidden="true" />
					{t('then.key.influence')}
				</li>
				<li>
					<span className="then-swatch then-swatch--network" aria-hidden="true" />
					{t('then.key.network')}
				</li>
				<li>
					<span className="then-swatch then-swatch--disputed" aria-hidden="true" />
					{t('then.key.disputed')}
				</li>
				<li>
					<span className="then-swatch then-swatch--capital" aria-hidden="true" />
					{t('then.key.capital')}
				</li>
				{(['tribute', 'trade', 'war', 'ritual'] as const).map((k) => (
					<li key={k}>
						<span className={`then-line then-line--${k}`} aria-hidden="true" />
						{t(`then.key.${k}`)}
					</li>
				))}
			</ul>
		</div>
	);
}

interface IntroProps {
	history: History;
	year: number;
	tr: Translate;
	onSelect: (id: string) => void;
	showStateLines: boolean;
	onStateLines: (on: boolean) => void;
}

/** The states on the map in this year, or at the Today stop, the seats that remain. */
export function HistoryIntro({ history, year, tr, onSelect, showStateLines, onStateLines }: IntroProps) {
	const { t, plural } = tr;
	const active = activeAt(history, year);
	const nextYear = year < TODAY ? eventYears(history).find((y) => y > year) : undefined;
	const next = nextYear ? history.polities.find((p) => p.span.from === nextYear) : undefined;

	return (
		<div className="intro then-intro">
			<p className="intro__tagline">{year >= TODAY ? t('then.todayIntro') : t('then.tagline')}</p>
			{year < TODAY && (
				<h2 className="then-intro__year">
					{t('polity.inYear', { year })} <span>{plural('then.count', active.length)}</span>
				</h2>
			)}
			{year < TODAY && active.length === 0 && <p className="muted">{t('then.none')}</p>}
			<ul className="polity-list">
				{(year >= TODAY ? history.polities.filter((p) => p.today.seat) : active.map((a) => a.polity)).map((p) => {
					const a = active.find((x) => x.polity === p);
					return (
						<li key={p.id}>
							<button type="button" className="polity-row" onClick={() => onSelect(p.id)}>
								<span className="polity-row__ink" style={{ background: p.color }} aria-hidden="true" />
								<span className="polity-row__text">
									<strong>{p.name}</strong>
									<span>{a ? a.snapshot.title : (p.today.title ?? p.today.text)}</span>
								</span>
							</button>
						</li>
					);
				})}
			</ul>
			{next && <p className="muted then-intro__next">{t('then.next', { name: next.name, year: next.span.fromLabel ?? next.span.from })}</p>}
			<label className="toggle">
				<input type="checkbox" checked={showStateLines} onChange={(e) => onStateLines(e.target.checked)} />
				<span>{t('then.stateLines')}</span>
			</label>
			<HistoryKey tr={tr} />
			<p className="intro__note">{t('then.method')}</p>
		</div>
	);
}

interface ProfileProps {
	polity: PolityView;
	year: number;
	tr: Translate;
	onYear: (year: number) => void;
	onBack: () => void;
	onOpenGroup: (id: string) => void;
}

export function PolityProfile({ polity: p, year, tr, onYear, onBack, onOpenGroup }: ProfileProps) {
	const { t } = tr;
	const index = year >= TODAY ? -1 : snapshotAt(p, year);
	const now = index >= 0 ? p.snapshots[index] : null;
	const peak = p.snapshots.reduce((best, s, i) => (s.year <= p.peak ? i : best), 0);
	const from = p.span.fromLabel ?? String(p.span.from);
	const to = p.span.toLabel ?? String(p.span.to);
	const capital = now?.capital ?? [...p.snapshots].reverse().find((s) => s.capital && s.year <= Math.max(year, p.span.from))?.capital;
	const prefix = `p-${p.id}-source`;

	return (
		<article className="profile polity" aria-labelledby="polity-name" style={{ '--ink-polity': p.color } as React.CSSProperties}>
			<header className="profile__head">
				<button type="button" className="back-link" onClick={onBack}>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M15 6l-6 6 6 6" />
					</svg>
					{year >= TODAY ? t('polity.backToday') : t('polity.back', { year: yearText(year, tr) })}
				</button>
				<p className="profile__eyebrow polity__eyebrow">{t(`kind.${p.kind}`)}</p>
				<h2 id="polity-name" className="profile__name">
					{p.name}
				</h2>
				<p className="profile__counts">
					{t('polity.span', { from, to })} <Claim e={p.span} tr={tr} prefix={prefix} />
				</p>
				{p.otherNames.length > 0 && <p className="polity__aka">{t('polity.otherNames', { names: p.otherNames.join(', ') })}</p>}
				{p.status !== 'published' && <p className="profile__draft">{t('polity.draft')}</p>}
			</header>

			<p className="profile__summary">
				{p.summary.text} <Claim e={p.summary} tr={tr} prefix={prefix} />
			</p>

			<dl className="facts">
				{p.ruler && (
					<div>
						<dt>{t('polity.ruler')}</dt>
						<dd>
							{p.ruler.title} <Claim e={p.ruler} tr={tr} prefix={prefix} />
						</dd>
					</div>
				)}
				{capital && (
					<div>
						<dt>{t('polity.capital')}</dt>
						<dd>{capital.name}</dd>
					</div>
				)}
			</dl>

			<section className="profile__section polity__now" aria-labelledby="polity-now">
				<h3 id="polity-now">{year >= TODAY ? t('polity.today') : t('polity.inYear', { year })}</h3>
				{year >= TODAY ? (
					<p>
						{p.today.text} <Claim e={p.today} tr={tr} prefix={prefix} />
					</p>
				) : now ? (
					<>
						<p className="polity__now-title">
							<span>{now.yearLabel ?? now.year}</span> {now.title}
						</p>
						<p>
							{now.text} <Claim e={now} tr={tr} prefix={prefix} />
						</p>
						{(now.core || now.influence) && (
							<p className="polity__layers">
								{now.core && (
									<span>
										<span className="then-swatch then-swatch--core" aria-hidden="true" /> {t('polity.layer.core')}{' '}
										<ConfidenceBadge level={now.core} tr={tr} />
									</span>
								)}
								{now.influence && (
									<span>
										<span className={`then-swatch then-swatch--${p.kind === 'network' ? 'network' : 'influence'}`} aria-hidden="true" />{' '}
										{t('polity.layer.influence')} <ConfidenceBadge level={now.influence} tr={tr} />
									</span>
								)}
							</p>
						)}
						{now.note && <p className="note">{now.note}</p>}
					</>
				) : (
					<p className="muted">{year < p.span.from ? t('polity.notYet', { year, from }) : t('polity.gone', { year, to })}</p>
				)}
			</section>

			<section className="profile__section" aria-labelledby="polity-history">
				<h3 id="polity-history">{t('polity.history')}</h3>
				<ol className="polity-steps">
					{p.snapshots.map((s, i) => (
						<li key={s.year} className={i === index ? 'is-now' : i === peak ? 'is-peak' : undefined}>
							<button type="button" onClick={() => onYear(s.year)} aria-label={`${t('polity.showYear', { year: s.year })}: ${s.title}`} aria-current={i === index ? 'step' : undefined}>
								<span className="polity-steps__year">{s.yearLabel ?? s.year}</span>
								<span className="polity-steps__title">{s.title}</span>
							</button>
						</li>
					))}
					<li className={year >= TODAY ? 'is-now' : undefined}>
						<button type="button" onClick={() => onYear(TODAY)} aria-current={year >= TODAY ? 'step' : undefined}>
							<span className="polity-steps__year">{t('timeline.today')}</span>
							<span className="polity-steps__title">{p.today.title ?? t('polity.today')}</span>
						</button>
					</li>
				</ol>
			</section>

			{year < TODAY && (
				<section className="profile__section" aria-labelledby="polity-today">
					<h3 id="polity-today">{t('polity.today')}</h3>
					<p>
						{p.today.text} <Claim e={p.today} tr={tr} prefix={prefix} />
					</p>
				</section>
			)}

			{p.peoples.length > 0 && (
				<section className="profile__section" aria-labelledby="polity-peoples">
					<h3 id="polity-peoples">{t('polity.peoples')}</h3>
					<ul className="intro__groups">
						{p.peoples.map((g) => (
							<li key={g.id}>
								<button type="button" className="chip" onClick={() => onOpenGroup(g.id)} aria-label={t('polity.openPeople', { name: g.name })}>
									{g.name}
								</button>
							</li>
						))}
					</ul>
				</section>
			)}

			{p.livesThereToday.length > 0 && (
				<section className="profile__section" aria-labelledby="polity-lives">
					<h3 id="polity-lives">{t('polity.livesThere')}</h3>
					<p className="muted polity__help">{t('polity.livesThere.help', { year: p.snapshots[peak].yearLabel ?? p.snapshots[peak].year })}</p>
					<ul className="intro__groups">
						{p.livesThereToday.map((g) => (
							<li key={g.id}>
								<button type="button" className="chip" onClick={() => onOpenGroup(g.id)} aria-label={t('polity.openPeople', { name: g.name })}>
									{g.name} <span className="chip__count">{g.lgas}</span>
								</button>
							</li>
						))}
					</ul>
				</section>
			)}

			<section className="profile__section" aria-labelledby="polity-sources">
				<h3 id="polity-sources">{t('profile.sources')}</h3>
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
			</section>

			{p.status !== 'published' && p.reviewNotes.length > 0 && (
				<section className="profile__section review-notes" aria-labelledby="polity-review">
					<h3 id="polity-review">{t('profile.reviewNotes')}</h3>
					<ul>
						{p.reviewNotes.map((n) => (
							<li key={n}>{n}</li>
						))}
					</ul>
				</section>
			)}

			<p className="profile__disclaimer">{t('then.method')}</p>
		</article>
	);
}
