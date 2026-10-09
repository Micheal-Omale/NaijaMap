// The Power view's side panel: pick a period, then see who held power at the
// centre and which peoples dominated each region (or zone), with every leader's
// people named as the sources give it. Hausa and Fulani are always kept apart.

import { useEffect, useMemo, useRef } from 'react';
import type { Translate } from '../../i18n/utils';
import type { EraView, LeaderView, PartyView, PoliticsView } from '../../lib/types';
import { Claim } from './Profile';
import { CoalitionCard, CoupCard, PartyBadge, PartyCard, ResultBar } from './PowerParts';

interface Props {
	politics: PoliticsView;
	era: EraView;
	unitId: string | null;
	/** The coalition picked in the panel, drawn on the map. */
	coalitionId: string | null;
	/** The coup picked in the panel, played on the map. */
	coupId: string | null;
	/** Group id → atlas colour. */
	colors: Map<string, string>;
	tr: Translate;
	onEra: (id: string) => void;
	onUnit: (id: string | null) => void;
	onCoalition: (id: string | null) => void;
	onCoup: (id: string | null) => void;
	/** Takes the camera to one moment of a coup. */
	onMoment: (point: [number, number]) => void;
	onOpenGroup: (id: string) => void;
	/** Opens this period as a story, told over the map. */
	onStory: () => void;
}

export const NEUTRAL = '#9a8f80';

export default function PowerPanel({ politics, era, unitId, coalitionId, coupId, colors, tr, onEra, onUnit, onCoalition, onCoup, onMoment, onOpenGroup, onStory }: Props) {
	const { t } = tr;
	const parties = useMemo(() => new Map(era.parties.map((p) => [p.id, p])), [era]);
	const selected = useRef<HTMLElement>(null);
	useEffect(() => {
		selected.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	}, [unitId]);
	const unitsHeading = era.units.some((u) => u.kind === 'zone')
		? 'power.units.zone'
		: era.units.some((u) => u.kind === 'state')
			? 'power.units.state'
			: 'power.units.region';

	return (
		<article className="profile power" aria-labelledby="power-name">
			<p className="intro__tagline">{t('power.tagline')}</p>

			<nav className="power-eras" aria-label={t('power.eras')}>
				{politics.eras.map((e) => (
					<button key={e.id} type="button" className="power-eras__item" aria-pressed={e.id === era.id} onClick={() => onEra(e.id)}>
						<span className="power-eras__years">{e.label}</span>
						<span className="power-eras__name">{e.name}</span>
					</button>
				))}
			</nav>

			<header className="profile__head">
				<p className="power__years">{era.label}</p>
				<h2 id="power-name" className="profile__name">
					{era.name}
				</h2>
				{era.status !== 'published' && <p className="profile__draft">{t('power.draft')}</p>}
				<button type="button" className="button power-story-open" onClick={onStory}>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M7 4.5l12 7.5-12 7.5z" />
					</svg>
					{t('power.story.open')}
				</button>
			</header>

			<p className="profile__summary">
				{era.summary.text} <Claim e={era.summary} tr={tr} />
			</p>

			<section className="profile__section" aria-labelledby="power-results">
				<h3 id="power-results">{t('power.results')}</h3>
				{era.results.length === 0 ? (
					<p className="muted power-banned">{t('power.noParties')}</p>
				) : (
					era.results.map((r) => <ResultBar key={r.title} result={r} parties={parties} tr={tr} />)
				)}
			</section>

			<section className="profile__section" aria-labelledby="power-federal">
				<h3 id="power-federal">{t('power.federal')}</h3>
				<p>
					{era.federal.text} <Claim e={era.federal} tr={tr} />
				</p>
				<ul className="power-leaders">
					{era.federal.leaders.map((l) => (
						<Leader key={l.name + l.from} leader={l} party={l.party ? parties.get(l.party) : undefined} colors={colors} tr={tr} onOpenGroup={onOpenGroup} />
					))}
				</ul>
			</section>

			{era.coups.length > 0 && (
				<section className="profile__section" aria-labelledby="power-coups">
					<h3 id="power-coups">{t('power.coups')}</h3>
					<p className="muted power-hint">{t('power.coupsHint')}</p>
					<div className="coup-list">
						{era.coups.map((c) => (
							<CoupCard key={c.id} coup={c} selected={c.id === coupId} colors={colors} tr={tr} onSelect={onCoup} onMoment={onMoment} onOpenGroup={onOpenGroup} />
						))}
					</div>
				</section>
			)}

			{era.coalitions.length > 0 && (
				<section className="profile__section" aria-labelledby="power-coalitions">
					<h3 id="power-coalitions">{t('power.coalitions')}</h3>
					<p className="muted power-hint">{t('power.coalitionsHint')}</p>
					<div className="coalition-list">
						{era.coalitions.map((c) => (
							<CoalitionCard key={c.id} coalition={c} parties={parties} selected={c.id === coalitionId} tr={tr} onSelect={onCoalition} />
						))}
					</div>
				</section>
			)}

			{era.parties.length > 0 && (
				<section className="profile__section" aria-labelledby="power-parties">
					<h3 id="power-parties">{t('power.parties')}</h3>
					<div className="party-list">
						{era.parties.map((p) => (
							<PartyCard key={p.id} party={p} colors={colors} tr={tr} onOpenGroup={onOpenGroup} />
						))}
					</div>
				</section>
			)}

			<section className="profile__section" aria-labelledby="power-units">
				<h3 id="power-units">{t(unitsHeading)}</h3>
				{era.units.length === 0 ? (
					<p className="muted">{t('power.noUnits')}</p>
				) : (
					<ul className="power-units">
						{era.units.map((u) => {
							const on = u.id === unitId;
							return (
								<li key={u.id}>
									<article
										ref={on ? selected : undefined}
										className={`power-unit${on ? ' is-selected' : ''}`}
										aria-labelledby={`unit-${u.id}`}
									>
										<button type="button" className="power-unit__head" aria-pressed={on} onClick={() => onUnit(on ? null : u.id)}>
											<span className="power-unit__swatch" aria-hidden="true">
												{u.groups.map((g) => (
													<span key={g.id} style={{ background: colors.get(g.id) ?? NEUTRAL }} />
												))}
											</span>
											<strong id={`unit-${u.id}`}>{u.name}</strong>
											{u.party && <PartyBadge party={parties.get(u.party)} size="sm" />}
										</button>
										<p className="power-unit__groups">
											<span className="muted">{t('power.dominant')}</span>
											{u.groups.map((g) => (
												<button key={g.id} type="button" className="chip chip--atlas" onClick={() => onOpenGroup(g.id)}>
													<span className="chip__dot" style={{ background: colors.get(g.id) ?? NEUTRAL }} aria-hidden="true" />
													{g.name}
												</button>
											))}
										</p>
										<p className="power-unit__text">
											{u.text} <Claim e={u} tr={tr} />
										</p>
										{u.leaders.length > 0 && (
											<ul className="power-leaders">
												{u.leaders.map((l) => (
													<Leader key={l.name + l.from} leader={l} party={l.party ? parties.get(l.party) : undefined} colors={colors} tr={tr} onOpenGroup={onOpenGroup} />
												))}
											</ul>
										)}
									</article>
								</li>
							);
						})}
					</ul>
				)}
			</section>

			<p className="polity__help muted">{t('power.method')}</p>

			<section className="profile__section" aria-labelledby="power-sources">
				<h3 id="power-sources">{t('profile.sources')}</h3>
				<ol className="sources">
					{era.sources.map((s) => (
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

			{era.status !== 'published' && era.reviewNotes.length > 0 && (
				<section className="profile__section review-notes" aria-labelledby="power-review">
					<h3 id="power-review">{t('profile.reviewNotes')}</h3>
					<ul>
						{era.reviewNotes.map((n) => (
							<li key={n}>{n}</li>
						))}
					</ul>
				</section>
			)}
		</article>
	);
}

export function Leader({
	leader: l,
	party,
	colors,
	tr,
	onOpenGroup,
}: {
	leader: LeaderView;
	party?: PartyView;
	colors: Map<string, string>;
	tr: Translate;
	onOpenGroup: (id: string) => void;
}) {
	const { t } = tr;
	const color = (l.group && colors.get(l.group)) || NEUTRAL;
	const years = l.to === l.from ? String(l.from) : `${l.from}–${l.to ?? t('power.today')}`;
	return (
		<li className="power-leader">
			<span className="chip__dot" style={{ background: color }} aria-hidden="true" />
			<div>
				<p className="power-leader__name">
					<strong>{l.name}</strong> <span className="muted">· {years}</span>
				</p>
				<p className="power-leader__title">
					{party ? l.title.replace(` (${party.short})`, '') : l.title} {party && <PartyBadge party={party} size="sm" />}
				</p>
				<p className="power-leader__group">
					{l.group ? (
						<button type="button" className="power-leader__people" onClick={() => onOpenGroup(l.group!)}>
							{l.groupName}
						</button>
					) : (
						<span className="power-leader__people">{l.groupName}</span>
					)}
					{l.home && <span className="muted"> · {t('power.from', { place: l.home.name })}</span>} <Claim e={l} tr={tr} />
				</p>
				{l.groupNote && <p className="power-leader__note">{l.groupNote}</p>}
			</div>
		</li>
	);
}
