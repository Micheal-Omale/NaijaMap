import type { ReactNode } from 'react';
import type { Translate } from '../../i18n/utils';
import type { CommunityView, Evidence, GroupView, PeopleView, PlaceView, Presence, SourceView } from '../../lib/types';
import { Claim, Swatch } from './Profile';

function Sources({ sources, prefix, tr }: { sources: SourceView[]; prefix: string; tr: Translate }) {
	if (sources.length === 0) return null;
	return (
		<details className="card-sources">
			<summary>{tr.plural('place.sources', sources.length)}</summary>
			<ol>
				{sources.map((s) => (
					<li key={s.id} id={`${prefix}-${s.n}`}>
						{s.url ? (
							<a href={s.url} rel="noopener" target="_blank">
								{s.citation}
							</a>
						) : (
							s.citation
						)}
						{!s.checked && <span className="sources__unchecked"> ({tr.t('profile.sourceNotChecked')})</span>}
					</li>
				))}
			</ol>
		</details>
	);
}

function Section({ title, e, prefix, tr }: { title: string; e?: Evidence & { text: string }; prefix: string; tr: Translate }) {
	if (!e) return null;
	return (
		<>
			<h3 className="place-card__h">{title}</h3>
			<p className="place-card__summary">
				{e.text} <Claim e={e} tr={tr} prefix={prefix} />
			</p>
			{e.note && <p className="note note--card">{e.note}</p>}
		</>
	);
}

function Languages({ languages, tr }: { languages: string[]; tr: Translate }) {
	const [first, ...rest] = languages;
	return (
		<span className="people__langs">
			{tr.t('place.speaks', { first })}
			{rest.length > 0 && <>, {tr.t('place.alsoSpeaks', { rest: rest.join(', ') })}</>}
		</span>
	);
}

function People({ person, tr, onOpenGroup }: { person: PeopleView; tr: Translate; onOpenGroup: (id: string) => void }) {
	const { t } = tr;
	return (
		<li className="people">
			<div className="people__head">
				{person.group ? (
					<button
						type="button"
						className="link-button"
						onClick={() => onOpenGroup(person.group!)}
						aria-label={t('place.openProfile', { name: person.name })}
					>
						{person.name}
					</button>
				) : (
					<strong>{person.name}</strong>
				)}
				<span className="tags">
					{person.standing && <span className={`tag tag--${person.standing}`}>{t(`place.${person.standing}`)}</span>}
					{person.share && <span className="tag">{t(`place.share.${person.share}`)}</span>}
					{person.languages.length === 2 && <span className="tag tag--lang">{t('place.bilingual')}</span>}
					{person.languages.length > 2 && <span className="tag tag--lang">{t('place.multilingual')}</span>}
				</span>
			</div>
			<p className="people__body">
				<Languages languages={person.languages} tr={tr} /> <Claim e={person} tr={tr} prefix="place-source" />
			</p>
			{person.note && <p className="note">{person.note}</p>}
		</li>
	);
}

function CardFrame({ title, sub, onClose, tr, children }: { title: string; sub: string; onClose: () => void; tr: Translate; children: ReactNode }) {
	return (
		<section className="place-card" aria-live="polite" aria-labelledby="place-card-title">
			<div className="place-card__head">
				<h2 id="place-card-title">
					{title}
					<span> · {sub}</span>
				</h2>
				<button type="button" className="icon-button" onClick={onClose} aria-label={tr.t('profile.close')}>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M6 6l12 12M18 6 6 18" />
					</svg>
				</button>
			</div>
			{children}
		</section>
	);
}

interface PlaceProps {
	lga: { id: string; name: string; state: string };
	place: PlaceView | undefined;
	/** Fallback when there is no brief: groups whose data maps them here. */
	groupsHere: { group: GroupView; presence: Presence | 'community' }[];
	tr: Translate;
	onOpenGroup: (id: string) => void;
	onClose: () => void;
}

/** What a visitor sees after tapping an LGA: who lives there, and how they speak. */
export function PlaceCard({ lga, place, groupsHere, tr, onOpenGroup, onClose }: PlaceProps) {
	const { t } = tr;
	return (
		<CardFrame title={lga.name} sub={lga.state} onClose={onClose} tr={tr}>
			{place ? (
				<>
					{place.status !== 'published' && <p className="card-draft">{t('place.draft')}</p>}
					<p className="place-card__summary">
						{place.summary.text} <Claim e={place.summary} tr={tr} prefix="place-source" />
					</p>
					<Section title={t('place.history')} e={place.history} prefix="place-source" tr={tr} />
					<Section title={t('place.livelihoods')} e={place.livelihoods} prefix="place-source" tr={tr} />
					<h3 className="place-card__h">{t('place.who')}</h3>
					<ul className="peoples">
						{place.peoples.map((p) => (
							<People key={p.name} person={p} tr={tr} onOpenGroup={onOpenGroup} />
						))}
					</ul>
					{place.languageUse && (
						<>
							<h3 className="place-card__h">{t('place.languageUse')}</h3>
							<p className="place-card__summary">
								{place.languageUse.text} <Claim e={place.languageUse} tr={tr} prefix="place-source" />
							</p>
						</>
					)}
					<Sources sources={place.sources} prefix="place-source" tr={tr} />
				</>
			) : (
				<>
					<p className="muted">{t('place.noBrief')}</p>
					{groupsHere.length > 0 && (
						<>
							<h3 className="place-card__h">{t('place.groupsMapped')}</h3>
							<ul className="lga-card__groups">
								{groupsHere.map(({ group: g, presence }) => (
									<li key={g.id}>
										<button type="button" className="link-button" onClick={() => onOpenGroup(g.id)}>
											<Swatch kind={presence} />
											{g.name}
										</button>
										<span className="muted">{t(`presence.${presence}`)}</span>
									</li>
								))}
							</ul>
						</>
					)}
				</>
			)}
		</CardFrame>
	);
}

interface CommunityProps {
	community: CommunityView;
	group: GroupView;
	tr: Translate;
	onClose: () => void;
}

/** What a visitor sees after tapping a community dot. */
export function CommunityCard({ community: c, group, tr, onClose }: CommunityProps) {
	const { t } = tr;
	// Only the sources this community cites, keeping the profile's numbers.
	const refs = new Set([...c.refs, ...(c.history?.refs ?? []), ...(c.livelihoods?.refs ?? [])]);
	const cited = group.sources.filter((s) => refs.has(s.n));
	return (
		<CardFrame
			title={c.name}
			sub={
				c.alsoIn.length
					? t('community.inAlso', { lga: c.lgaName, others: c.alsoIn.map((o) => o.name).join(', '), state: c.state })
					: t('community.in', { lga: c.lgaName, state: c.state })
			}
			onClose={onClose}
			tr={tr}
		>
			<p className="place-card__summary">
				{t('community.kind', { language: group.language.name })}{' '}
				<Claim e={c} tr={tr} prefix="community-source" />
			</p>
			<Section title={t('place.history')} e={c.history} prefix="community-source" tr={tr} />
			<Section title={t('place.livelihoods')} e={c.livelihoods} prefix="community-source" tr={tr} />
			{c.villages.length > 0 && (
				<>
					<h3 className="place-card__h">{t('profile.villages')}</h3>
					<p className="villages villages--card">{c.villages.map((v) => v.name).join(' · ')}</p>
				</>
			)}
			{c.note && <p className="note note--card">{c.note}</p>}
			{c.approximate && <p className="muted">{t('map.approximate')}</p>}
			<Sources sources={cited} prefix="community-source" tr={tr} />
		</CardFrame>
	);
}
