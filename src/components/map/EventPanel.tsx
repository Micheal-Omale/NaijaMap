// One event told in full in the side panel: who took part, what happened in
// order (each moment can be found on the map), the lines it draws, where a
// divided kingdom's lands went, and the sources.

import type { Translate } from '../../i18n/utils';
import { COLONIAL_INK, isForeign } from '../../lib/ink';
import type { EventView, History } from '../../lib/types';
import { EVENT_MARK, ROUTES } from './glyphs';
import { LineSample, MarkIcon, ShipIcon } from './Marks';
import { Claim } from './Profile';

interface Props {
	event: EventView;
	history: History;
	year: number;
	tr: Translate;
	onBack: () => void;
	onShow: () => void;
	onMoment: (index: number) => void;
	onPulse: (index: number) => void;
	onOpenPolity: (id: string) => void;
}

export default function EventPanel({ event: e, history, year, tr, onBack, onShow, onMoment, onPulse, onOpenPolity }: Props) {
	const { t } = tr;
	const colonial = isForeign(e.kind);
	const pieceInk = (i: number) => String(history.pieces.features.find((f) => f.properties?.e === e.id && f.properties?.i === i)?.properties?.color ?? COLONIAL_INK);
	return (
		<article className={`profile event-panel${colonial ? ' event-panel--colonial' : ''}`} aria-labelledby="event-name">
			<header className="profile__head">
				<button type="button" className="back-link" onClick={onBack}>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M15 6l-6 6 6 6" />
					</svg>
					{t('event.back', { year })}
				</button>
				<p className="event-panel__eyebrow">
					<MarkIcon mark={EVENT_MARK[e.kind]} colonial={colonial} size={22} />
					{t(`event.kind.${e.kind}`)}
					<span>{e.yearLabel ?? e.year}</span>
				</p>
				<h2 id="event-name" className="profile__name event-panel__name">
					{e.name}
				</h2>
				{e.status !== 'published' && <p className="profile__draft">{t('event.draft')}</p>}
			</header>

			<p className="profile__summary">
				{e.summary.text} <Claim e={e.summary} tr={tr} />
			</p>

			<button type="button" className="button event-panel__show" onClick={onShow}>
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path d="M12 21s-6.5-6-6.5-11.5a6.5 6.5 0 0113 0C18.5 15 12 21 12 21z" />
					<circle cx="12" cy="9.5" r="2.4" />
				</svg>
				{t('event.show')}
			</button>

			<section className="profile__section" aria-labelledby="event-actors">
				<h3 id="event-actors">{t('event.actors')}</h3>
				<ul className="event-actors">
					{e.actors.map((a) => (
						<li key={a.name}>
							{a.polity ? (
								<button type="button" className="event-actor" onClick={() => onOpenPolity(a.polity!)}>
									<span className="chip__dot" style={{ background: a.color }} aria-hidden="true" />
									<strong>{a.name}</strong>
									<span>{t(`event.side.${a.side}`)}</span>
								</button>
							) : (
								<span className="event-actor">
									<span className="chip__dot" style={{ background: a.color }} aria-hidden="true" />
									<strong>{a.name}</strong>
									<span>{t(`event.side.${a.side}`)}</span>
								</span>
							)}
						</li>
					))}
				</ul>
			</section>

			{e.moments.length > 0 && (
				<section className="profile__section" aria-labelledby="event-chronology">
					<h3 id="event-chronology">{t('event.chronology')}</h3>
					<ol className="event-moments">
						{e.moments.map((m, i) => (
							<li key={i} onMouseEnter={() => m.at && onPulse(i)}>
								<MarkIcon mark={m.mark} colonial={m.colonial} size={26} />
								<div>
									<p className="event-moments__when">
										{m.when}
										{m.at && <span> · {m.at.name}</span>}
									</p>
									<p className="event-moments__title">{m.title}</p>
									<p className="event-moments__text">
										{m.text} {m.refs.length > 0 && <Claim e={{ refs: m.refs, confidence: m.confidence ?? e.confidence }} tr={tr} />}
									</p>
									{m.at ? (
										<button type="button" className="event-moments__go" onClick={() => onMoment(i)}>
											{t('event.showMoment', { place: m.at.name })}
										</button>
									) : (
										<p className="event-moments__none">{t('event.notPlaced')}</p>
									)}
								</div>
							</li>
						))}
					</ol>
				</section>
			)}

			{e.routes.length > 0 && (
				<section className="profile__section" aria-labelledby="event-routes">
					<h3 id="event-routes">{t('event.routes')}</h3>
					<ul className="event-routes">
						{e.routes.map((r, i) => (
							<li key={i}>
								{r.vessel ? <ShipIcon vessel={r.vessel} size={30} /> : <LineSample style={ROUTES[r.kind]} color={r.color} />}
								<span>
									<strong>{t(`route.${r.kind}`)}</strong> {r.label}
									{r.when && <span className="muted"> · {r.when}</span>}
									{r.note && <span className="event-routes__note">{r.note}</span>}
								</span>
							</li>
						))}
					</ul>
				</section>
			)}

			{e.pieces.length > 0 && (
				<section className="profile__section" aria-labelledby="event-pieces">
					<h3 id="event-pieces">{t('event.pieces')}</h3>
					<ul className="event-pieces">
						{e.pieces.map((p, i) => (
							<li key={p.name}>
								<span className={`event-pieces__swatch event-pieces__swatch--${i % 4}`} style={{ ['--piece' as string]: pieceInk(i) }} aria-hidden="true" />
								<span>
									<strong>{p.name}</strong>
									{p.note && <span className="event-routes__note">{p.note}</span>}
								</span>
							</li>
						))}
					</ul>
				</section>
			)}

			{e.note && <p className="polity__help muted">{e.note}</p>}

			<section className="profile__section" aria-labelledby="event-sources">
				<h3 id="event-sources">{t('profile.sources')}</h3>
				<ol className="sources">
					{e.sources.map((s) => (
						<li key={s.id} id={`source-${s.n}`}>
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

			{e.status !== 'published' && e.reviewNotes.length > 0 && (
				<section className="profile__section review-notes" aria-labelledby="event-review">
					<h3 id="event-review">{t('profile.reviewNotes')}</h3>
					<ul>
						{e.reviewNotes.map((n) => (
							<li key={n}>{n}</li>
						))}
					</ul>
				</section>
			)}
		</article>
	);
}
