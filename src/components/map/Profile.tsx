import type { Translate } from '../../i18n/utils';
import { AdBanner } from './AdBanner';
import type { AreaView, CommunityView, Confidence, Evidence, GroupView, Presence } from '../../lib/types';

const PRESENCE_ORDER: Presence[] = ['core', 'significant', 'minority'];

export function ConfidenceBadge({ level, tr }: { level: Confidence; tr: Translate }) {
	const filled = level === 'high' ? 3 : level === 'medium' ? 2 : 0;
	return (
		<span className={`conf conf--${level}`}>
			{level === 'disputed' ? (
				<svg viewBox="0 0 18 8" aria-hidden="true">
					<path d="M1 4h16" strokeDasharray="3 2" />
				</svg>
			) : (
				<svg viewBox="0 0 18 8" aria-hidden="true">
					{[3, 9, 15].map((cx, i) => (
						<circle key={cx} cx={cx} cy="4" r="2.4" className={i < filled ? 'on' : 'off'} />
					))}
				</svg>
			)}
			{tr.t(`confidence.${level}`)}
		</span>
	);
}

function Refs({ refs, tr, prefix = 'source' }: { refs: number[]; tr: Translate; prefix?: string }) {
	return (
		<span className="refs">
			{refs.map((n) => (
				<a key={n} href={`#${prefix}-${n}`} aria-label={tr.t('profile.ref', { n })}>
					{n}
				</a>
			))}
		</span>
	);
}

export function Claim({ e, tr, prefix }: { e: Evidence; tr: Translate; prefix?: string }) {
	return (
		<span className="claim">
			<Refs refs={e.refs} tr={tr} prefix={prefix} />
			<ConfidenceBadge level={e.confidence} tr={tr} />
		</span>
	);
}

export function Swatch({ kind }: { kind: Presence | 'community' }) {
	return <span className={`swatch swatch--${kind}`} aria-hidden="true" />;
}

export function Legend({ tr }: { tr: Translate }) {
	const { t } = tr;
	return (
		<div className="legend">
			<h3 className="legend__heading">{t('legend.heading')}</h3>
			<ul>
				{PRESENCE_ORDER.map((p) => (
					<li key={p}>
						<Swatch kind={p} />
						<span>
							<strong>{t(`presence.${p}`)}</strong> {t(`presence.${p}.help`)}
						</span>
					</li>
				))}
				<li>
					<Swatch kind="community" />
					<span>{t('presence.community')}</span>
				</li>
			</ul>
		</div>
	);
}

function communitiesByState(list: CommunityView[]): [string, CommunityView[]][] {
	const states = new Map<string, CommunityView[]>();
	for (const c of list) states.set(c.state, [...(states.get(c.state) ?? []), c]);
	return [...states.entries()].sort((a, b) => b[1].length - a[1].length);
}

function byState(areas: AreaView[]): [string, AreaView[]][] {
	const states = new Map<string, AreaView[]>();
	for (const a of areas) states.set(a.state, [...(states.get(a.state) ?? []), a]);
	for (const list of states.values()) {
		list.sort(
			(a, b) => PRESENCE_ORDER.indexOf(a.presence) - PRESENCE_ORDER.indexOf(b.presence) || a.name.localeCompare(b.name),
		);
	}
	// Largest state first.
	return [...states.entries()].sort((a, b) => b[1].length - a[1].length);
}

interface Props {
	group: GroupView;
	tr: Translate;
	onShowLga: (id: string) => void;
	/** Back to the list of every people. */
	onBack: () => void;
	/** Opens the history view on a polity at its height. */
	onOpenKingdom: (id: string, peak: number) => void;
	/** Opens a language family or branch (Yoruboid, Defoid…) with all its peoples. */
	onOpenFamily?: (name: string) => void;
}

export default function Profile({ group, tr, onShowLga, onBack, onOpenKingdom, onOpenFamily }: Props) {
	const { t, plural } = tr;
	const states = byState(group.areas);
	const allStates = new Set([...group.areas.map((a) => a.state), ...group.communities.map((c) => c.state)]);
	const adCtx = { lgas: group.areas.map((a) => a.lga), states: [...allStates], group: group.id };

	return (
		<article className="profile" aria-labelledby="profile-name">
			<header className="profile__head">
				<button type="button" className="back-link" onClick={onBack}>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M15 6l-6 6 6 6" />
					</svg>
					{t('profile.back')}
				</button>
				<p className="profile__eyebrow">
					{onOpenFamily ? (
						<button type="button" className="profile__family-link" onClick={() => onOpenFamily(group.language.family.name)}>
							{t('profile.familyEyebrow', { name: group.language.family.name })}
						</button>
					) : (
						t('profile.familyEyebrow', { name: group.language.family.name })
					)}
				</p>
				<h2 id="profile-name" className="profile__name">
					{group.name}
				</h2>
				<p className="profile__counts">
					{plural('profile.lgaCount', group.areas.length)} {plural('profile.stateCount', allStates.size)}
					{group.communities.length > 0 && <> · {plural('profile.communityCount', group.communities.length)}</>}
				</p>
				{group.status !== 'published' && <p className="profile__draft">{t('profile.draft')}</p>}
			</header>

			<p className="profile__summary">
				{group.summary.text} <Claim e={group.summary} tr={tr} />
			</p>

			<dl className="facts">
				<div>
					<dt>{t('profile.language')}</dt>
					<dd>
						{group.language.name}
						{group.language.iso639_3 && <span className="code"> ISO {group.language.iso639_3}</span>}{' '}
						<Claim e={group.language} tr={tr} />
					</dd>
				</div>
				<div>
					<dt>{t('profile.family')}</dt>
					<dd>
						{onOpenFamily
							? group.language.family.lineage.map((name, i) => (
									<span key={name}>
										{i > 0 && ' › '}
										<button type="button" className="link-button" onClick={() => onOpenFamily(name)}>
											{name}
										</button>
									</span>
								))
							: group.language.family.lineage.join(' › ')}
					</dd>
				</div>
				{group.ruler && (
					<div>
						<dt>{t('profile.ruler')}</dt>
						<dd>
							{group.ruler.seat
								? t('profile.rulerSeat', { title: group.ruler.title, seat: group.ruler.seat })
								: group.ruler.title}{' '}
							<Claim e={group.ruler} tr={tr} />
						</dd>
					</div>
				)}
			</dl>

			<AdBanner ctx={adCtx} slot="profile-top" tr={tr} />

			{group.kingdoms.length > 0 && (
				<section className="profile__section" aria-labelledby="kingdoms-heading">
					<h3 id="kingdoms-heading">{t('profile.kingdoms')}</h3>
					<ul className="kingdom-links">
						{group.kingdoms.map((k) => (
							<li key={k.id}>
								<button type="button" className="kingdom-link" onClick={() => onOpenKingdom(k.id, k.peak)}>
									<svg viewBox="0 0 24 24" aria-hidden="true">
										<path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z" />
										<path d="M5 17a3 3 0 013-3h11" />
									</svg>
									<span>{t('profile.seeKingdom', { name: k.name, year: k.peak })}</span>
								</button>
							</li>
						))}
					</ul>
				</section>
			)}

			<section className="profile__section" aria-labelledby="where-heading">
				<h3 id="where-heading">{t('profile.where')}</h3>
				{states.map(([state, areas]) => (
					<div key={state} className="state-block">
						<h4>{state}</h4>
						<ul className="areas">
							{areas.map((a) => (
								<li key={a.lga} className="area">
									<button
										type="button"
										className="area__name"
										onClick={() => onShowLga(a.lga)}
										aria-label={t('profile.showOnMap', { name: a.name })}
									>
										<Swatch kind={a.presence} />
										{a.name}
									</button>
									<span className="area__presence">{t(`presence.${a.presence}`)}</span>
									<Claim e={a} tr={tr} />
									{a.note && <p className="note">{a.note}</p>}
								</li>
							))}
						</ul>
					</div>
				))}
			</section>

			{group.communities.length > 0 && (
				<section className="profile__section" aria-labelledby="communities-heading">
					<h3 id="communities-heading">{t('profile.communities')}</h3>
					{communitiesByState(group.communities).map(([state, list]) => (
						<div key={state} className="state-block">
							<h4>{state}</h4>
							<ul className="areas">
								{list.map((c) => (
									<li key={c.name} className="area">
										<button
											type="button"
											className="area__name"
											onClick={() => onShowLga(c.lga)}
											aria-label={t('profile.showOnMap', { name: c.name })}
										>
											<Swatch kind="community" />
											{c.name}
										</button>
										<span className="area__presence">
											{c.lgaName}
											{c.alsoIn.length > 0 && <>, {c.alsoIn.map((o) => o.name).join(', ')}</>}
											{c.approximate && <> · {t('map.approximate')}</>}
										</span>
										<Claim e={c} tr={tr} />
										{c.villages.length > 0 && (
											<p className="villages">
												<span className="visually-hidden">{t('profile.villages')}: </span>
												{c.villages.map((v) => v.name).join(' · ')}
											</p>
										)}
										{c.note && <p className="note">{c.note}</p>}
									</li>
								))}
							</ul>
						</div>
					))}
				</section>
			)}

			<AdBanner ctx={adCtx} slot="profile-end" tr={tr} house={false} />

			<Legend tr={tr} />

			<section className="profile__section" aria-labelledby="sources-heading">
				<h3 id="sources-heading">{t('profile.sources')}</h3>
				<ol className="sources">
					{group.sources.map((s) => (
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

			{group.status !== 'published' && group.reviewNotes.length > 0 && (
				<section className="profile__section review-notes" aria-labelledby="review-heading">
					<h3 id="review-heading">{t('profile.reviewNotes')}</h3>
					<ul>
						{group.reviewNotes.map((n) => (
							<li key={n}>{n}</li>
						))}
					</ul>
				</section>
			)}

			<p className="profile__disclaimer">{t('site.notOwnership')}</p>
		</article>
	);
}
