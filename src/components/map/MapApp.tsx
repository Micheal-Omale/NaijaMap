import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { PaddingOptions } from 'maplibre-gl';
import type { Lang } from '../../i18n/ui';
import { useTranslations } from '../../i18n/utils';
import type { Atlas } from '../../lib/atlas';
import type { GroupView, PlaceView, Presence } from '../../lib/types';
import type { FocusRequest } from './MapView';
import { CommunityCard, PlaceCard } from './PlaceCard';
import Profile from './Profile';
import Search from './Search';
import './map-app.css';

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

const GROUP_PARAM = 'group';

function groupFromUrl(): string | null {
	return new URL(window.location.href).searchParams.get(GROUP_PARAM);
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
	const [load, setLoad] = useState<LoadState>({ status: 'loading' });
	const [groupId, setGroupId] = useState<string | null>(() => groupFromUrl());
	const [selectedLga, setSelectedLga] = useState<string | null>(null);
	// Name of a tapped community dot of the selected group.
	const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null);
	// The LGA under the mouse (desktop), for the quick "who lives here" card.
	const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
	const [focus, setFocus] = useState<FocusRequest>({ kind: 'group' });
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

	const data = load.status === 'ready' ? load.data : null;
	const group = data?.groups.find((g) => g.id === groupId) ?? null;

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
				else if (g.communities.some((c) => c.lga === lga)) found.push({ group: g, presence: 'community' });
			}
			return found;
		},
		[data],
	);

	// Keep the address bar in step with the view, so any view can be shared.
	const selectGroup = useCallback(
		(next: GroupView | null) => {
			const url = new URL(window.location.href);
			if (next) url.searchParams.set(GROUP_PARAM, next.id);
			else url.searchParams.delete(GROUP_PARAM);
			if (url.href !== window.location.href) window.history.pushState(null, '', url);
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
		[t, plural],
	);

	useEffect(() => {
		const onPop = () => {
			setGroupId(groupFromUrl());
			setSelectedLga(null);
			setSelectedCommunity(null);
			setFocus({ kind: 'group' });
		};
		window.addEventListener('popstate', onPop);
		return () => window.removeEventListener('popstate', onPop);
	}, []);

	useEffect(() => {
		document.title = group ? `${group.name} · ${t('site.name')}` : t('site.name');
	}, [group, t]);

	const showLga = useCallback((id: string) => {
		setSelectedLga(id);
		setSelectedCommunity(null);
		setFocus({ kind: 'lga', id });
		setSheetOpen(false);
	}, []);

	// Leave room for the bottom sheet on phones so highlights are not hidden under it.
	const padding: PaddingOptions = narrow
		? { top: 96, bottom: Math.round(window.innerHeight * 0.3) + 40, left: 32, right: 32 }
		: { top: 80, bottom: 80, left: 80, right: 96 };

	const tapped = selectedLga ? lgaInfo.get(selectedLga) : undefined;
	const tappedGroups = selectedLga ? groupsIn(selectedLga) : [];
	const community = group?.communities.find((c) => c.name === selectedCommunity) ?? null;
	const hasSheet = Boolean(group || tapped || community);

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

	const openGroup = useCallback(
		(id: string) => {
			const g = data?.groups.find((x) => x.id === id);
			if (g) selectGroup(g);
		},
		[data, selectGroup],
	);

	return (
		<div className="app" data-sheet={hasSheet ? (sheetOpen ? 'open' : 'peek') : 'none'}>
			<div className="panel">
				<div className="topbar">
					<a className="brand" href="/" aria-label={t('site.name')}>
						<span className="brand__mark" aria-hidden="true" />
						<span className="brand__name">{t('site.name')}</span>
					</a>
					{data ? (
						<Search groups={data.groups} selected={group} onSelect={selectGroup} tr={tr} />
					) : (
						<div className="search search--placeholder" aria-hidden="true" />
					)}
				</div>

				<div className="sheet">
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

					{community && group ? (
						<CommunityCard community={community} group={group} tr={tr} onClose={() => tapLga(null)} />
					) : (
						tapped &&
						selectedLga && (
							<PlaceCard
								lga={{ id: selectedLga, ...tapped }}
								place={placeByLga.get(selectedLga)}
								groupsHere={tappedGroups}
								tr={tr}
								onOpenGroup={openGroup}
								onClose={() => tapLga(null)}
							/>
						)
					)}

					{group ? (
						<Profile group={group} tr={tr} onShowLga={showLga} />
					) : (
						!tapped && (
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
						)
					)}
				</div>
			</div>

			<div className="map-region">
				{hover && data && !narrow && <HoverCard hover={hover} data={data} groupsIn={groupsIn} tr={tr} />}
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
							selectedLga={selectedLga}
							focus={focus}
							padding={padding}
							label={t('map.label')}
							attribution={`${t('map.creditBoundaries')}: <a href='https://data.grid3.org/' target='_blank' rel='noopener'>GRID3</a> (CC BY 4.0) · ${t('map.creditRivers')}: <a href='https://www.naturalearthdata.com/' target='_blank' rel='noopener'>Natural Earth</a>`}
							onSelectLga={tapLga}
							onSelectCommunity={tapCommunity}
							onHover={setHover}
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
