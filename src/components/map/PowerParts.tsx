// The Power view's infographic parts: party badges, election result bars with
// their alliances bracketed above, and the cards for parties and coalitions.
// Party colours come from the --party-N tokens (global.css), so a party reads
// the same in the panel and on the map.

import { useState, type CSSProperties } from 'react';
import type { UiKey } from '../../i18n/ui';
import type { Translate } from '../../i18n/utils';
import type { CoalitionView, CoupPersonView, CoupView, PartyView, ResultView } from '../../lib/types';
import { MarkIcon } from './Marks';
import { Claim } from './Profile';

export const partyVars = (slot?: number): CSSProperties =>
	({ '--p': slot ? `var(--party-${slot})` : 'var(--party-other)', '--pi': slot ? `var(--party-${slot}-ink)` : 'var(--party-other-ink)' }) as CSSProperties;

/** A party's short name on its own colour: the one place party colour carries text. */
export function PartyBadge({ party, size = 'md' }: { party?: PartyView; size?: 'sm' | 'md' }) {
	if (!party) return null;
	return (
		<abbr className={`party-badge party-badge--${size}`} style={partyVars(party.slot)} title={party.name}>
			{party.short}
		</abbr>
	);
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 });
const pct = (v: number) => `${v >= 10 ? v.toFixed(1) : v.toFixed(1)}%`;

/** One election as a stacked bar: alliances bracketed above, a majority tick for seats, a legend below. */
export function ResultBar({ result, parties, tr }: { result: ResultView; parties: Map<string, PartyView>; tr: Translate }) {
	const { t } = tr;
	const total = result.measure === 'percent' ? 100 : result.parts.reduce((a, p) => a + p.value, 0);
	const [hover, setHover] = useState<number | null>(null);
	const share = (v: number) => (result.measure === 'percent' ? v : (v / total) * 100);
	const amount = (v: number) =>
		result.measure === 'seats' ? t('power.seats', { n: String(v) }) : result.measure === 'votes' ? t('power.votes', { n: compact.format(v) }) : '';

	// Runs of the same alliance, for the brackets above the bar.
	const blocs: { name: string; start: number; width: number; value: number }[] = [];
	let at = 0;
	for (const p of result.parts) {
		const w = share(p.value);
		const last = blocs[blocs.length - 1];
		if (p.bloc && last && last.name === p.bloc) {
			last.width += w;
			last.value += p.value;
		} else if (p.bloc) blocs.push({ name: p.bloc, start: at, width: w, value: p.value });
		at += w;
	}
	const winner = result.parts.reduce((a, p, i) => (p.value > result.parts[a].value ? i : a), 0);
	const shown = hover ?? winner;
	const focus = result.parts[shown];
	const focusParty = focus.party ? parties.get(focus.party) : undefined;

	return (
		<figure className="result" aria-label={result.title}>
			<figcaption className="result__title">
				<strong>{result.title}</strong>
				{result.measure === 'seats' && <span className="muted"> · {t('power.seatsTotal', { n: String(total) })}</span>}
			</figcaption>
			{blocs.length > 0 && (
				<div className="result__blocs" aria-hidden="true">
					{blocs.map((b) => (
						<span key={b.name + b.start} className="result__bloc" style={{ left: `${b.start}%`, width: `${b.width}%` }}>
							<span className="result__bloc-name">
								{b.name}
								{result.measure === 'seats' ? ` · ${b.value}` : ''}
							</span>
						</span>
					))}
				</div>
			)}
			<div className="result__bar" role="list" onMouseLeave={() => setHover(null)}>
				{result.parts.map((p, i) => {
					const party = p.party ? parties.get(p.party) : undefined;
					const w = share(p.value);
					return (
						<span
							key={p.label + i}
							role="listitem"
							tabIndex={0}
							className={`result__seg${shown === i ? ' is-focus' : ''}`}
							style={{ ...partyVars(party?.slot), flexGrow: w }}
							aria-label={`${p.label}${p.candidate ? ` (${p.candidate})` : ''}: ${amount(p.value)} ${pct(share(p.value))}`}
							onMouseEnter={() => setHover(i)}
							onFocus={() => setHover(i)}
							onBlur={() => setHover(null)}
						>
							{w >= 11 && <span className="result__seg-label">{p.label}</span>}
						</span>
					);
				})}
				{result.measure === 'seats' && <span className="result__majority" style={{ left: '50%' }} title={t('power.majority')} aria-hidden="true" />}
			</div>
			<p className="result__focus" aria-live="polite">
				<span className="result__swatch" style={partyVars(focusParty?.slot)} aria-hidden="true" />
				<strong>{focusParty ? `${focusParty.short}` : focus.label}</strong>
				{focus.candidate && <span> · {focus.candidate}</span>}
				<span className="result__num">
					{amount(focus.value) && `${amount(focus.value)} · `}
					{pct(share(focus.value))}
				</span>
			</p>
			<ul className="result__legend">
				{result.parts.map((p, i) => {
					const party = p.party ? parties.get(p.party) : undefined;
					return (
						<li key={p.label + i} className={shown === i ? 'is-focus' : undefined} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
							<span className="result__swatch" style={partyVars(party?.slot)} aria-hidden="true" />
							<span className="result__legend-name">{p.label}</span>
							<span className="result__legend-num">{result.measure === 'seats' ? p.value : pct(share(p.value))}</span>
						</li>
					);
				})}
			</ul>
			{result.note && <p className="result__note">{result.note}</p>}
			<p className="result__claim">
				<Claim e={result} tr={tr} />
			</p>
		</figure>
	);
}

export function PartyCard({ party, colors, tr, onOpenGroup }: { party: PartyView; colors: Map<string, string>; tr: Translate; onOpenGroup: (id: string) => void }) {
	const { t } = tr;
	return (
		<article className="party-card" style={partyVars(party.slot)}>
			<header className="party-card__head">
				<PartyBadge party={party} />
				<strong>{party.name}</strong>
			</header>
			{party.leader && (
				<p className="party-card__leader">
					<span className="muted">{t('power.partyLeader')}</span> {party.leader}
				</p>
			)}
			{party.peoples.length > 0 && (
				<p className="power-unit__groups">
					<span className="muted">{t('power.partyBase')}</span>
					{party.peoples.map((g) => (
						<button key={g.id} type="button" className="chip chip--atlas" onClick={() => onOpenGroup(g.id)}>
							<span className="chip__dot" style={{ background: colors.get(g.id) ?? 'var(--party-other)' }} aria-hidden="true" />
							{g.name}
						</button>
					))}
				</p>
			)}
			<p className="party-card__text">
				{party.text} <Claim e={party} tr={tr} />
			</p>
		</article>
	);
}

export function CoalitionCard({
	coalition: c,
	parties,
	selected,
	tr,
	onSelect,
}: {
	coalition: CoalitionView;
	parties: Map<string, PartyView>;
	selected: boolean;
	tr: Translate;
	onSelect: (id: string | null) => void;
}) {
	const { t } = tr;
	const years = c.to === c.from ? String(c.from) : `${c.from}–${c.to ?? t('power.today')}`;
	return (
		<article className={`coalition-card${selected ? ' is-selected' : ''}`}>
			<button type="button" className="coalition-card__head" aria-pressed={selected} onClick={() => onSelect(selected ? null : c.id)}>
				<span className="coalition-card__kind">{t(`power.kind.${c.kind}` as UiKey)}</span>
				<strong>{c.name}</strong>
				<span className="muted coalition-card__years">{years}</span>
			</button>
			<p className="coalition-card__parties" aria-label={t('power.coalitionParties')}>
				{c.parties.map((id, i) => (
					<span key={id} className="coalition-card__party">
						{i > 0 && <span className="coalition-card__join" aria-hidden="true">+</span>}
						<PartyBadge party={parties.get(id)} />
					</span>
				))}
			</p>
			<p className="coalition-card__text">
				{c.text} <Claim e={c} tr={tr} />
			</p>
		</article>
	);
}

/** A person in a coup story, with their people's colour when the sources name it. */
function PersonChip({ person, colors, onOpenGroup }: { person: CoupPersonView; colors: Map<string, string>; onOpenGroup: (id: string) => void }) {
	const dot = <span className="chip__dot" style={{ background: (person.group && colors.get(person.group)) || 'var(--party-other)' }} aria-hidden="true" />;
	return (
		<span className="coup-person" title={person.groupNote}>
			<strong>{person.name}</strong>
			{person.groupName &&
				(person.group ? (
					<button type="button" className="coup-person__people" onClick={() => onOpenGroup(person.group!)}>
						{dot}
						{person.groupName}
					</button>
				) : (
					<span className="coup-person__people">
						{dot}
						{person.groupName}
					</span>
				))}
			{person.role && <span className="coup-person__role">{person.role}</span>}
		</span>
	);
}

/** One coup: who fell and who rose, who struck, who died, and its moments in order. */
export function CoupCard({
	coup: c,
	selected,
	colors,
	tr,
	onSelect,
	onMoment,
	onOpenGroup,
}: {
	coup: CoupView;
	selected: boolean;
	colors: Map<string, string>;
	tr: Translate;
	onSelect: (id: string | null) => void;
	onMoment: (point: [number, number]) => void;
	onOpenGroup: (id: string) => void;
}) {
	const { t } = tr;
	return (
		<article className={`coup-card coup-card--${c.outcome}${selected ? ' is-selected' : ''}`}>
			<button type="button" className="coup-card__head" aria-pressed={selected} aria-expanded={selected} onClick={() => onSelect(selected ? null : c.id)}>
				<span className="coup-card__outcome">{t(`power.coup.${c.outcome}` as UiKey)}</span>
				<span className="coup-card__date">{c.date}</span>
				<strong className="coup-card__name">{c.name}</strong>
				{(c.fell || c.rose) && (
					<span className="coup-card__swap" aria-hidden="true">
						{c.fell?.name ?? '?'} <span className="coup-card__arrow">→</span> {c.rose?.name ?? t('power.coup.survived')}
					</span>
				)}
			</button>
			{selected && (
				<div className="coup-card__body">
					<div className="coup-card__fellrose">
						{c.fell && (
							<div>
								<p className="coup-card__label">{t('power.coup.fell')}</p>
								<PersonChip person={c.fell} colors={colors} onOpenGroup={onOpenGroup} />
							</div>
						)}
						{c.rose && (
							<div>
								<p className="coup-card__label">{t('power.coup.rose')}</p>
								<PersonChip person={c.rose} colors={colors} onOpenGroup={onOpenGroup} />
							</div>
						)}
					</div>
					<p className="coup-card__text">
						{c.text} <Claim e={c} tr={tr} />
					</p>
					{c.plotters.length > 0 && (
						<>
							<p className="coup-card__label">{t('power.coup.plotters')}</p>
							<ul className="coup-card__people">
								{c.plotters.map((p) => (
									<li key={p.name}>
										<PersonChip person={p} colors={colors} onOpenGroup={onOpenGroup} />
									</li>
								))}
							</ul>
						</>
					)}
					{c.killed.length > 0 && (
						<>
							<p className="coup-card__label">{t('power.coup.killed')}</p>
							<ul className="coup-card__people coup-card__people--killed">
								{c.killed.map((p) => (
									<li key={p.name}>
										<PersonChip person={p} colors={colors} onOpenGroup={onOpenGroup} />
									</li>
								))}
							</ul>
						</>
					)}
					{c.areaLabel && (
						<p className="coup-card__area">
							<span className="coup-card__area-swatch" aria-hidden="true" />
							{c.areaLabel}
						</p>
					)}
					<p className="coup-card__label">{t('power.coup.moments')}</p>
					<ol className="coup-moments">
						{c.moments.map((m, i) => (
							<li key={i} className="coup-moment">
								<MarkIcon mark={m.mark} size={24} />
								<div>
									<p className="coup-moment__when">{m.when}</p>
									{m.at ? (
										<button type="button" className="coup-moment__title" onClick={() => onMoment(m.at!.point)}>
											{m.title} <span className="muted">· {m.at.name}</span>
										</button>
									) : (
										<p className="coup-moment__title">{m.title}</p>
									)}
									<p className="coup-moment__text">{m.text}</p>
								</div>
							</li>
						))}
					</ol>
				</div>
			)}
		</article>
	);
}
