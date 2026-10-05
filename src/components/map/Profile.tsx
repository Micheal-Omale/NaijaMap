import type { Translate } from '../../i18n/utils';
import type { AreaView, Confidence, Evidence, GroupView, Presence } from '../../lib/types';

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

function Refs({ refs, tr }: { refs: number[]; tr: Translate }) {
	return (
		<span className="refs">
			{refs.map((n) => (
				<a key={n} href={`#source-${n}`} aria-label={tr.t('profile.ref', { n })}>
					{n}
				</a>
			))}
		</span>
	);
}

function Claim({ e, tr }: { e: Evidence; tr: Translate }) {
	return (
		<span className="claim">
			<Refs refs={e.refs} tr={tr} />
			<ConfidenceBadge level={e.confidence} tr={tr} />
		</span>
	);
}

export function Swatch({ kind }: { kind: Presence | 'enclave' }) {
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
					<Swatch kind="enclave" />
					<span>{t('presence.enclave')}</span>
				</li>
			</ul>
		</div>
	);
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
}

export default function Profile({ group, tr, onShowLga }: Props) {
	const { t, plural } = tr;
	const states = byState(group.areas);
	const allStates = new Set([...group.areas.map((a) => a.state), ...group.enclaves.map((e) => e.state)]);

	return (
		<article className="profile" aria-labelledby="profile-name">
			<header className="profile__head">
				<p className="profile__eyebrow">
					{t('profile.familyEyebrow', { name: group.language.family.name })}
				</p>
				<h2 id="profile-name" className="profile__name">
					{group.name}
				</h2>
				<p className="profile__counts">
					{plural('profile.lgaCount', group.areas.length)} {plural('profile.stateCount', allStates.size)}
					{group.enclaves.length > 0 && <> · {plural('profile.enclaveCount', group.enclaves.length)}</>}
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
					<dd>{group.language.family.lineage.join(' › ')}</dd>
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

			{group.enclaves.length > 0 && (
				<section className="profile__section" aria-labelledby="enclaves-heading">
					<h3 id="enclaves-heading">{t('profile.enclaves')}</h3>
					<ul className="areas">
						{group.enclaves.map((e) => (
							<li key={e.name} className="area">
								<button
									type="button"
									className="area__name"
									onClick={() => onShowLga(e.lga)}
									aria-label={t('profile.showOnMap', { name: e.name })}
								>
									<Swatch kind="enclave" />
									{e.name}
								</button>
								<span className="area__presence">
									{e.lgaName}, {e.state}
									{e.approximate && <> · {t('map.approximate')}</>}
								</span>
								<Claim e={e} tr={tr} />
								{e.note && <p className="note">{e.note}</p>}
							</li>
						))}
					</ul>
				</section>
			)}

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
