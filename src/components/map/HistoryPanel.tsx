// The side panel in the history view: the states and events on the map in the
// chosen year, the peoples who governed themselves between them, and the map key. A polity's story opens in StoryMode, an event in
// EventPanel.

import type { Translate } from '../../i18n/utils';
import { COLONIAL_INK, isForeign } from '../../lib/ink';
import { activeAt, eventsOn, eventYears, societiesAt, TODAY } from '../../lib/timeline';
import type { History, LinkKind, MarkKind, RouteKind } from '../../lib/types';
import { EVENT_MARK, LINKS, MARKS, ROUTES } from './glyphs';
import { LineSample, MarkIcon, ShipIcon } from './Marks';

export function HistoryKey({ tr }: { tr: Translate }) {
	const { t } = tr;
	return (
		<div className="legend then-key">
			<h3 className="legend__heading">{t('legend.heading')}</h3>
			<p className="then-key__hint">{t('then.key.hint')}</p>

			<h4 className="then-key__group">{t('then.key.territory')}</h4>
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
					<span className="then-swatch then-swatch--campaign" aria-hidden="true" />
					{t('then.key.campaign')}
				</li>
				<li>
					<span className="then-swatch then-swatch--capital" aria-hidden="true" />
					{t('then.key.capital')}
				</li>
				<li>
					<span className="then-swatch then-swatch--pieces" aria-hidden="true" />
					{t('then.key.pieces')}
				</li>
				<li>
					<svg className="then-swatch then-swatch--crown" viewBox="0 0 24 24" aria-hidden="true">
						<path d="M6 16l-.5-7.5 3.8 3L12 6.5l2.7 5 3.8-3L18 16zM6 17h12v1.8H6z" />
					</svg>
					{t('then.key.throne')}
				</li>
				<li>
					<svg className="then-swatch then-swatch--crown" viewBox="0 0 24 24" aria-hidden="true">
						<path d="M7 5.5h10v12H7zM9.5 9h5M9.5 12h5" fill="none" stroke="currentColor" strokeWidth="1.5" />
						<circle cx="15.5" cy="17" r="2.6" />
					</svg>
					{t('then.key.warrant')}
				</li>
				<li>
					<span className="then-swatch then-swatch--town" aria-hidden="true" />
					{t('then.key.town')}
				</li>
				<li>
					<span className="then-swatch then-swatch--people" aria-hidden="true">
						Aa
					</span>
					{t('then.key.people')}
				</li>
			</ul>

			<h4 className="then-key__group">{t('then.key.links')}</h4>
			<ul>
				{(Object.keys(LINKS) as LinkKind[]).map((k) => (
					<li key={k} title={t(`link.${k}.help`)}>
						<LineSample style={LINKS[k]} color="var(--ink-polity, #8a5a2c)" />
						{t(`then.key.${k}`)}
					</li>
				))}
			</ul>

			<h4 className="then-key__group">{t('then.key.routes')}</h4>
			<ul>
				{(Object.keys(ROUTES) as RouteKind[]).map((k) => (
					<li key={k} title={t(`route.${k}.help`)}>
						{k === 'voyage' ? (
							<span className="then-key__ships" aria-hidden="true">
								<ShipIcon vessel="sail" size={22} />
								<ShipIcon vessel="steam" size={22} />
							</span>
						) : (
							<LineSample style={ROUTES[k]} color={k === 'exile' || k === 'loot' ? COLONIAL_INK : 'var(--ink-polity, #8a5a2c)'} />
						)}
						{t(`route.${k}`)}
					</li>
				))}
			</ul>

			<h4 className="then-key__group">{t('then.key.marks')}</h4>
			<ul className="then-key__marks">
				{(Object.keys(MARKS) as MarkKind[]).map((m) => (
					<li key={m}>
						<MarkIcon mark={m} colonial={m === 'bombarded' || m === 'exile' || m === 'loot' || m === 'anchor'} />
						{t(`mark.${m}`)}
					</li>
				))}
			</ul>
			<p className="then-key__note">{t('then.key.badges')}</p>
		</div>
	);
}

interface IntroProps {
	history: History;
	year: number;
	tr: Translate;
	onSelect: (id: string) => void;
	onOpenEvent: (id: string) => void;
	showStateLines: boolean;
	onStateLines: (on: boolean) => void;
}

/** The states and events on the map in this year, or at the Today stop, the seats that remain. */
export function HistoryIntro({ history, year, tr, onSelect, onOpenEvent, showStateLines, onStateLines }: IntroProps) {
	const { t, plural } = tr;
	const active = activeAt(history, year);
	const events = eventsOn(history, year);
	const nextYear = year < TODAY ? eventYears(history).find((y) => y > year) : undefined;
	const next = nextYear ? history.polities.find((p) => p.span.from === nextYear) : undefined;
	// Each place a people is named once, in the order of the alphabet.
	const peoples = [...new Set(societiesAt(history, year).flatMap((s) => s.lands.filter((l) => l.from <= year && year <= l.to).map((l) => l.name)))].sort((a, b) => a.localeCompare(b));

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
			{events.length > 0 && (
				<>
					<h3 className="then-intro__events">{plural('then.events', events.length)}</h3>
					<ul className="event-list">
						{events.map((e) => {
							const colonial = isForeign(e.kind);
							return (
								<li key={e.id}>
									<button type="button" className={`event-row${e.year === year ? ' is-new' : ''}`} onClick={() => onOpenEvent(e.id)}>
										<MarkIcon mark={EVENT_MARK[e.kind]} colonial={colonial} size={24} />
										<span className="event-row__text">
											<strong>{e.name}</strong>
											<span>
												{t(`event.kind.${e.kind}`)} · {e.yearLabel ?? e.year}
											</span>
										</span>
									</button>
								</li>
							);
						})}
					</ul>
				</>
			)}
			{peoples.length > 0 && (
				<p className="then-intro__peoples">
					<strong>{plural('then.peoples', peoples.length)}</strong> {peoples.join(', ')}. {t('then.peoples.hint')}
				</p>
			)}
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
