import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PaddingOptions } from 'maplibre-gl';
import type { Lang } from '../../i18n/ui';
import { useTranslations } from '../../i18n/utils';
import type { Atlas } from '../../lib/atlas';
import { activeAt, DEFAULT_YEAR, formatYearParam, parseYear, TODAY } from '../../lib/timeline';
import type { GroupView, History, PlaceView, Presence } from '../../lib/types';
import { HistoryIntro, PolityProfile } from './HistoryPanel';
import type { FocusRequest, Mode } from './MapView';
import { CommunityCard, PlaceCard } from './PlaceCard';
import Profile from './Profile';
import Search from './Search';
import Swap from './Swap';
import Timeline from './Timeline';
import './map-app.css';
import './history.css';

const MapView = lazy(() => import('./MapView'));

interface Props {
	lang: Lang;
}

type Data = {
	groups: GroupView[];
	places: PlaceView[];
	atlas: Atlas;
	lgas: GeoJSON.FeatureCollection;
	base: GeoJSON.FeatureCollection;
	labels: GeoJSON.FeatureCollection;
};

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: Data };
type HistoryState =
	| { status: 'idle' | 'loading' | 'error' }
	| { status: 'ready'; history: History; region: GeoJSON.FeatureCollection };

/** The view the web address describes, so any view can be shared. */
type UrlView = { mode: Mode; group: string | null; year: number; polity: string | null };

function viewFromUrl(): UrlView {
	const params = new URL(window.location.href).searchParams;
	const year = parseYear(params.get('year'));
	const polity = params.get('polity');
	const mode: Mode = params.get('mode') === 'then' || polity || year !== null ? 'then' : 'today';
	return { mode, group: mode === 'today' ? params.get('group') : null, year: year ?? DEFAULT_YEAR, polity: mode === 'then' ? polity : null };
}

function writeUrl(view: UrlView, push: boolean): void {
	const url = new URL(window.location.href);
	for (const key of ['group', 'mode', 'year', 'polity']) url.searchParams.delete(key);
	if (view.mode === 'then') {
		url.searchParams.set('mode', 'then');
		url.searchParams.set('year', formatYearParam(view.year));
		if (view.polity) url.searchParams.set('polity', view.polity);
	} else if (view.group) {
		url.searchParams.set('group', view.group);
	}
	if (url.href === window.location.href) return;
	if (push) window.history.pushState(null, '', url);
	else window.history.replaceState(null, '', url);
}

function hasWebGL(): boolean {
	try {
		const canvas = document.createElement('canvas');
		return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
	} catch {
		return false;
	}
}

async function getJson<T>(url: string): Promise<T> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${url}: ${res.status}`);
	return res.json() as Promise<T>;
}

function useIsNarrow(): boolean {
	const query = '(max-width: 899px)';
	const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
	useEffect(() => {
		const mq = window.matchMedia(query);
		const on = () => setNarrow(mq.matches);
		mq.addEventListener('change', on);
		return () => mq.removeEventListener('change', on);
	}, []);
	return narrow;
}

export default function MapApp({ lang }: Props) {
	const tr = useMemo(() => useTranslations(lang), [lang]);
	const { t, plural } = tr;
	const initial = useMemo(viewFromUrl, []);
	const [load, setLoad] = useState<LoadState>({ status: 'loading' });
	const [mode, setMode] = useState<Mode>(initial.mode);
	const [groupId, setGroupId] = useState<string | null>(initial.group);
	const [year, setYear] = useState(initial.year);
	const [polityId, setPolityId] = useState<string | null>(initial.polity);
	const [historyLoad, setHistoryLoad] = useState<HistoryState>({ status: 'idle' });
	const [showStateLines, setShowStateLines] = useState(false);
	const [selectedLga, setSelectedLga] = useState<string | null>(null);
	// Name of a tapped community dot of the selected group.
	const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null);
	// The LGA under the mouse (desktop), for the quick "who lives here" card.
	const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
	const [hoverPolities, setHoverPolities] = useState<{ ids: string[]; x: number; y: number } | null>(null);
	const [focus, setFocus] = useState<FocusRequest>(() =>
		initial.mode === 'then' ? (initial.polity ? { kind: 'polity', id: initial.polity, year: initial.year } : { kind: 'region' }) : { kind: 'group' },
	);
	const [sheetOpen, setSheetOpen] = useState(false);
	const [announcement, setAnnouncement] = useState('');
	const [webgl] = useState(hasWebGL);
	const narrow = useIsNarrow();
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		let cancelled = false;
		setLoad({ status: 'loading' });
		Promise.all([
			getJson<GroupView[]>('/data/groups.json'),
			getJson<GeoJSON.FeatureCollection>('/geo/lgas.json'),
			getJson<GeoJSON.FeatureCollection>('/geo/base.json'),
			getJson<GeoJSON.FeatureCollection>('/geo/labels.json'),
			getJson<PlaceView[]>('/data/places.json'),
			getJson<Atlas>('/data/atlas.json'),
		])
			.then(
				([groups, lgas, base, labels, places, atlas]) =>
					!cancelled && setLoad({ status: 'ready', data: { groups, places, atlas, lgas, base, labels } }),
			)
			.catch((err) => {
				console.error(err);
				if (!cancelled) setLoad({ status: 'error' });
			});
		return () => {
			cancelled = true;
		};
	}, [attempt]);

	// The history view's data loads only when someone opens it.
	useEffect(() => {
		if (mode !== 'then' || historyLoad.status === 'ready' || historyLoad.status === 'loading') return;
		setHistoryLoad({ status: 'loading' });
		Promise.all([getJson<History>('/data/history.json'), getJson<GeoJSON.FeatureCollection>('/geo/region.json')])
			.then(([history, region]) => setHistoryLoad({ status: 'ready', history, region }))
			.catch((err) => {
				console.error(err);
				setHistoryLoad({ status: 'error' });
			});
	}, [mode, historyLoad.status]);

	// The mood (Today or Then) sets the colour tokens for the whole page.
	useEffect(() => {
		document.documentElement.dataset.mood = mode;
	}, [mode]);

	const data = load.status === 'ready' ? load.data : null;
	const history = historyLoad.status === 'ready' ? historyLoad.history : null;
	const group = mode === 'today' ? (data?.groups.find((g) => g.id === groupId) ?? null) : null;
	const polity = mode === 'then' ? (history?.polities.find((p) => p.id === polityId) ?? null) : null;

	const placeByLga = useMemo(() => new Map((data?.places ?? []).map((p) => [p.lga, p])), [data]);

	// LGA id → name and state, for the tapped LGA card.
	const lgaInfo = useMemo(() => {
		const m = new Map<string, { name: string; state: string }>();
		for (const f of data?.lgas.features ?? []) {
			const p = f.properties as { id: string; name: string; state: string };
			m.set(p.id, { name: p.name, state: p.state });
		}
		return m;
	}, [data]);

	// Which groups live in an LGA (homeland, shared, smaller, or a named community).
	const groupsIn = useCallback(
		(lga: string) => {
			const found: { group: GroupView; presence: Presence | 'community' }[] = [];
			for (const g of data?.groups ?? []) {
				const area = g.areas.find((a) => a.lga === lga);
				if (area) found.push({ group: g, presence: area.presence });
				else if (g.communities.some((c) => c.lga === lga || c.alsoIn.some((o) => o.lga === lga))) found.push({ group: g, presence: 'community' });
			}
			return found;
		},
		[data],
	);

	// Keep the address bar in step with the view, so any view can be shared.
	const selectGroup = useCallback(
		(next: GroupView | null) => {
			writeUrl({ mode: 'today', group: next?.id ?? null, year, polity: null }, true);
			setMode('today');
			setGroupId(next?.id ?? null);
			setSelectedLga(null);
			setSelectedCommunity(null);
			setFocus({ kind: next ? 'group' : 'nigeria' });
			setSheetOpen(false);
			setAnnouncement(
				next
					? plural('announce.selected', next.areas.length + next.communities.length, { name: next.name })
					: t('announce.cleared'),
			);
		},
		[t, plural, year],
	);

	/** Opens the history view, optionally on one polity and year. */
	const openThen = useCallback(
		(next: { polity?: string | null; year?: number } = {}) => {
			const y = next.year ?? year;
			const p = next.polity ?? null;
			writeUrl({ mode: 'then', group: null, year: y, polity: p }, true);
			setMode('then');
			setYear(y);
			setPolityId(p);
			setSelectedLga(null);
			setSelectedCommunity(null);
			setHover(null);
			setSheetOpen(false);
			setFocus(p ? { kind: 'polity', id: p, year: y } : { kind: 'region' });
		},
		[year],
	);

	const selectPolity = useCallback(
		(id: string | null) => {
			writeUrl({ mode: 'then', group: null, year, polity: id }, true);
			setPolityId(id);
			setHoverPolities(null);
			if (id) {
				setFocus({ kind: 'polity', id, year });
				setSheetOpen(true);
			}
		},
		[year],
	);

	const changeYear = useCallback(
		(y: number) => {
			writeUrl({ mode: 'then', group: null, year: y, polity: polityId }, false);
			setYear(y);
		},
		[polityId],
	);

	// Tell screen reader users what the map shows after the year settles.
	useEffect(() => {
		if (mode !== 'then' || !history) return;
		const id = window.setTimeout(() => {
			const label = year >= TODAY ? t('timeline.today') : String(year);
			setAnnouncement(plural('announce.year', year >= TODAY ? history.polities.filter((p) => p.today.seat).length : activeAt(history, year).length, { year: label }));
		}, 700);
		return () => clearTimeout(id);
	}, [mode, year, history, t, plural]);

	useEffect(() => {
		const onPop = () => {
			const v = viewFromUrl();
			setMode(v.mode);
			setGroupId(v.group);
			setYear(v.year);
			setPolityId(v.polity);
			setSelectedLga(null);
			setSelectedCommunity(null);
			setFocus(v.mode === 'then' ? (v.polity ? { kind: 'polity', id: v.polity, year: v.year } : { kind: 'region' }) : { kind: 'group' });
		};
		window.addEventListener('popstate', onPop);
		return () => window.removeEventListener('popstate', onPop);
	}, []);

	useEffect(() => {
		if (mode === 'then') {
			const when = year >= TODAY ? t('timeline.today') : String(year);
			document.title = `${polity ? polity.name : t('mode.then')}, ${when} · ${t('site.name')}`;
		} else document.title = group ? `${group.name} · ${t('site.name')}` : t('site.name');
	}, [group, polity, mode, year, t]);

	const showLga = useCallback((id: string) => {
		setSelectedLga(id);
		setSelectedCommunity(null);
		setFocus({ kind: 'lga', id });
		setSheetOpen(false);
	}, []);

	// Leave room for the bottom sheet on phones so highlights are not hidden under it,
	// and for the timeline in the history view.
	const padding: PaddingOptions = narrow
		? { top: mode === 'then' ? 190 : 96, bottom: Math.round(window.innerHeight * 0.3) + 40, left: 32, right: 32 }
		: { top: 80, bottom: mode === 'then' ? 170 : 80, left: 80, right: 96 };

	const tapped = mode === 'today' && selectedLga ? lgaInfo.get(selectedLga) : undefined;
	const tappedGroups = selectedLga ? groupsIn(selectedLga) : [];
	const community = group?.communities.find((c) => c.name === selectedCommunity) ?? null;
	const hasSheet = mode === 'then' ? Boolean(polity) : Boolean(group || tapped || community);
	const sheetRef = useRef<HTMLDivElement>(null);

	// The panel shows one view at a time: a community, a place, a people, a polity, or a list.
	const view =
		mode === 'then'
			? polity
				? { key: `polity:${polity.id}`, depth: 1 }
				: { key: 'then', depth: 0 }
			: community && group
				? { key: `community:${group.id}:${community.name}`, depth: 2 }
				: tapped && selectedLga
					? { key: `lga:${selectedLga}`, depth: 2 }
					: group
						? { key: `group:${group.id}`, depth: 1 }
						: { key: 'key', depth: 0 };

	const tapLga = useCallback((id: string | null) => {
		setSelectedLga(id);
		setSelectedCommunity(null);
		// On phones, open the sheet so the brief is readable straight away.
		if (id) setSheetOpen(true);
	}, []);

	const tapCommunity = useCallback(
		(name: string, groupId?: string) => {
			// From the atlas, a dot belongs to a group that is not selected yet: select it first.
			const owner = groupId && groupId !== group?.id ? data?.groups.find((g) => g.id === groupId) : group;
			const c = owner?.communities.find((x) => x.name === name);
			if (!owner || !c) return;
			if (owner !== group) selectGroup(owner);
			setSelectedCommunity(name);
			setSelectedLga(c.lga);
			setSheetOpen(true);
		},
		[group, data, selectGroup],
	);

	// Escape steps back one level: a place or community card, then the people (or polity), then the full list.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'Escape' || e.defaultPrevented) return;
			const el = e.target as HTMLElement | null;
			if (el?.closest('input, textarea, select, [role="combobox"], [role="listbox"]')) return;
			if (mode === 'then') {
				if (polityId) selectPolity(null);
			} else if (selectedLga || selectedCommunity) tapLga(null);
			else if (group) selectGroup(null);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [mode, polityId, selectPolity, selectedLga, selectedCommunity, group, tapLga, selectGroup]);

	const openGroup = useCallback(
		(id: string) => {
			const g = data?.groups.find((x) => x.id === id);
			if (g) selectGroup(g);
		},
		[data, selectGroup],
	);

	const mapLabel = mode === 'then' ? t('map.labelThen', { year: year >= TODAY ? t('timeline.today') : year }) : t('map.label');

	return (
		<div className="app" data-sheet={hasSheet ? (sheetOpen ? 'open' : 'peek') : 'none'} data-mode={mode}>
			<div className="panel">
				<div className="topbar">
					<div className="topbar__row">
						<a className="brand" href="/" aria-label={t('site.name')}>
							<span className="brand__mark" aria-hidden="true" />
							<span className="brand__name">{t('site.name')}</span>
						</a>
						<div className="mode-switch" role="group" aria-label={t('mode.label')}>
							<button type="button" aria-pressed={mode === 'today'} onClick={() => mode !== 'today' && selectGroup(null)}>
								<svg viewBox="0 0 24 24" aria-hidden="true">
									<circle cx="12" cy="9" r="3.2" />
									<path d="M12 21s-6.5-6-6.5-11.5a6.5 6.5 0 0113 0C18.5 15 12 21 12 21z" />
								</svg>
								<span>{t('mode.today')}</span>
							</button>
							<button type="button" aria-pressed={mode === 'then'} onClick={() => mode !== 'then' && openThen()}>
								<svg viewBox="0 0 24 24" aria-hidden="true">
									<path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z" />
									<path d="M5 17a3 3 0 013-3h11" />
								</svg>
								<span>{t('mode.then')}</span>
							</button>
						</div>
					</div>
					{mode === 'today' &&
						(data ? (
							<Search groups={data.groups} selected={group} onSelect={selectGroup} tr={tr} />
						) : (
							<div className="search search--placeholder" aria-hidden="true" />
						))}
				</div>

				<div className="sheet" ref={sheetRef}>
					{hasSheet && narrow && (
						<button
							type="button"
							className="sheet__handle"
							aria-expanded={sheetOpen}
							onClick={() => setSheetOpen((o) => !o)}
						>
							<span className="sheet__grip" aria-hidden="true" />
							<span className="visually-hidden">{sheetOpen ? t('profile.collapse') : t('profile.expand')}</span>
						</button>
					)}

					<Swap viewKey={view.key} depth={view.depth} scroller={sheetRef}>
						{mode === 'then' ? (
							!history ? (
								<p className="muted then-loading">{historyLoad.status === 'error' ? t('map.loadError') : t('then.loading')}</p>
							) : polity ? (
								<PolityProfile
									polity={polity}
									year={year}
									tr={tr}
									onYear={changeYear}
									onBack={() => selectPolity(null)}
									onOpenGroup={openGroup}
								/>
							) : (
								<HistoryIntro
									history={history}
									year={year}
									tr={tr}
									onSelect={selectPolity}
									showStateLines={showStateLines}
									onStateLines={setShowStateLines}
								/>
							)
						) : community && group ? (
							<CommunityCard community={community} group={group} tr={tr} onClose={() => tapLga(null)} backTo={group.name} />
						) : tapped && selectedLga ? (
							<PlaceCard
								lga={{ id: selectedLga, ...tapped }}
								place={placeByLga.get(selectedLga)}
								groupsHere={tappedGroups}
								tr={tr}
								onOpenGroup={openGroup}
								onClose={() => tapLga(null)}
								backTo={group?.name}
							/>
						) : group ? (
							<Profile
								group={group}
								tr={tr}
								onShowLga={showLga}
								onBack={() => selectGroup(null)}
								onOpenKingdom={(id, peak) => openThen({ polity: id, year: peak })}
							/>
						) : (
							<div className="intro">
								<p className="intro__tagline">{t('site.tagline')}</p>
								{data && data.groups.length === 0 && <p className="muted">{t('site.noGroups')}</p>}
								{data && data.groups.length > 0 && (
									<div className="atlas-key">
										<p className="atlas-key__intro">{t('atlas.intro')}</p>
										{data.atlas.families.map((f) => (
											<section key={f.name} className="atlas-key__family">
												<h3>
													<span className="atlas-key__swatch" style={{ background: f.color }} aria-hidden="true" />
													{t('atlas.family', { name: f.name })}
												</h3>
												<ul className="intro__groups">
													{f.groups.map((id) => {
														const g = data.groups.find((x) => x.id === id);
														const a = data.atlas.groups.find((x) => x.id === id);
														if (!g) return null;
														return (
															<li key={id}>
																<button type="button" className="chip chip--atlas" onClick={() => selectGroup(g)}>
																	<span className="chip__dot" style={{ background: a?.color }} aria-hidden="true" />
																	{g.name}
																</button>
															</li>
														);
													})}
												</ul>
											</section>
										))}
										<p className="atlas-key__mixed">
											<span className="atlas-key__stripes" aria-hidden="true" />
											{t('atlas.shared')}
										</p>
										<p className="atlas-key__mixed">
											<span className="atlas-key__hatch" aria-hidden="true" />
											{t('atlas.mixed')}
										</p>
									</div>
								)}
								<p className="intro__note">{t('site.notOwnership')}</p>
							</div>
						)}
					</Swap>
				</div>
			</div>

			<div className="map-region">
				{hover && data && !narrow && mode === 'today' && <HoverCard hover={hover} data={data} groupsIn={groupsIn} tr={tr} />}
				{hoverPolities && history && !narrow && mode === 'then' && <PolityHoverCard hover={hoverPolities} history={history} year={year} tr={tr} />}
				{mode === 'then' && history && <Timeline history={history} year={year} onYear={changeYear} tr={tr} />}
				{mode === 'then' && <div className="paper" aria-hidden="true" />}
				{!webgl ? (
					<p className="map-message">{t('map.noWebgl')}</p>
				) : load.status === 'error' ? (
					<div className="map-message" role="alert">
						<p>{t('map.loadError')}</p>
						<button type="button" className="button" onClick={() => setAttempt((n) => n + 1)}>
							{t('map.retry')}
						</button>
					</div>
				) : data ? (
					<Suspense fallback={<p className="map-message">{t('map.loading')}</p>}>
						<MapView
							lgas={data.lgas}
							base={data.base}
							labels={data.labels}
							atlas={data.atlas}
							groups={data.groups}
							group={group}
							selectedLga={mode === 'today' ? selectedLga : null}
							focus={focus}
							padding={padding}
							label={mapLabel}
							attribution={`${t('map.creditBoundaries')}: <a href='https://data.grid3.org/' target='_blank' rel='noopener'>GRID3</a> (CC BY 4.0) · ${t('map.creditRivers')}, ${t('map.creditRegion')}: <a href='https://www.naturalearthdata.com/' target='_blank' rel='noopener'>Natural Earth</a>`}
							onSelectLga={tapLga}
							onSelectCommunity={tapCommunity}
							onHover={setHover}
							mode={mode}
							history={history}
							region={historyLoad.status === 'ready' ? historyLoad.region : null}
							year={year}
							polity={polity?.id ?? null}
							showStateLines={showStateLines}
							onSelectPolity={selectPolity}
							onHoverPolities={setHoverPolities}
						/>
					</Suspense>
				) : (
					<p className="map-message">{t('map.loading')}</p>
				)}
			</div>

			<p className="visually-hidden" role="status" aria-live="polite">
				{announcement}
			</p>
		</div>
	);
}

const PRESENCE_ORDER = { core: 0, significant: 1, minority: 2, community: 3 } as const;

/** A small card that follows the mouse: the LGA and every people mapped there. */
function HoverCard({
	hover,
	data,
	groupsIn,
	tr,
}: {
	hover: { id: string; x: number; y: number };
	data: Data;
	groupsIn: (lga: string) => { group: GroupView; presence: Presence | 'community' }[];
	tr: ReturnType<typeof useTranslations>;
}) {
	const { t } = tr;
	const f = data.lgas.features.find((x) => x.properties?.id === hover.id);
	if (!f) return null;
	const p = f.properties as { name: string; state: string };
	const color = new Map(data.atlas.groups.map((g) => [g.id, g.color]));
	const here = groupsIn(hover.id).sort((a, b) => PRESENCE_ORDER[a.presence] - PRESENCE_ORDER[b.presence]);
	const shared = data.atlas.lgas[hover.id]?.shared;
	return (
		<div className="hover-card" style={{ left: hover.x + 16, top: hover.y + 16 }} aria-hidden="true">
			<p className="hover-card__title">
				{p.name} <span>· {p.state}</span>
			</p>
			{shared && <p className="hover-card__shared">{t('hover.shared')}</p>}
			{here.length === 0 ? (
				<p className="hover-card__none">{t('hover.none')}</p>
			) : (
				<ul>
					{here.slice(0, 6).map(({ group: g, presence }) => (
						<li key={g.id}>
							<span className="chip__dot" style={{ background: color.get(g.id) }} />
							<strong>{g.name}</strong>
							<span>{presence === 'community' ? t('presence.community') : t(`presence.${presence}`)}</span>
						</li>
					))}
				</ul>
			)}
			<p className="hover-card__hint">{t('hover.tap')}</p>
		</div>
	);
}

/** The history view's hover card: the states drawn under the mouse, and what each was doing that year. */
function PolityHoverCard({
	hover,
	history,
	year,
	tr,
}: {
	hover: { ids: string[]; x: number; y: number };
	history: History;
	year: number;
	tr: ReturnType<typeof useTranslations>;
}) {
	const { t } = tr;
	const active = activeAt(history, year);
	return (
		<div className="hover-card hover-card--then" style={{ left: hover.x + 16, top: hover.y + 16 }} aria-hidden="true">
			<ul>
				{hover.ids.slice(0, 4).map((id) => {
					const p = history.polities.find((x) => x.id === id);
					if (!p) return null;
					const a = active.find((x) => x.polity.id === id);
					return (
						<li key={id}>
							<span className="chip__dot" style={{ background: p.color }} />
							<strong>{p.name}</strong>
							<span>{a ? a.snapshot.title : (p.today.title ?? '')}</span>
						</li>
					);
				})}
			</ul>
			<p className="hover-card__hint">{t('hover.thenTap')}</p>
		</div>
	);
}
