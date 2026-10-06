import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { PaddingOptions } from 'maplibre-gl';
import type { Lang } from '../../i18n/ui';
import { useTranslations } from '../../i18n/utils';
import type { GroupView, Presence } from '../../lib/types';
import type { FocusRequest } from './MapView';
import Profile, { Swatch } from './Profile';
import Search from './Search';
import './map-app.css';

const MapView = lazy(() => import('./MapView'));

interface Props {
	lang: Lang;
}

type Data = {
	groups: GroupView[];
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
		])
			.then(([groups, lgas, base, labels]) => !cancelled && setLoad({ status: 'ready', data: { groups, lgas, base, labels } }))
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
		setFocus({ kind: 'lga', id });
		setSheetOpen(false);
	}, []);

	// Leave room for the bottom sheet on phones so highlights are not hidden under it.
	const padding: PaddingOptions = narrow
		? { top: 96, bottom: Math.round(window.innerHeight * 0.3) + 40, left: 32, right: 32 }
		: { top: 80, bottom: 80, left: 80, right: 96 };

	const tapped = selectedLga ? lgaInfo.get(selectedLga) : undefined;
	const tappedGroups = selectedLga ? groupsIn(selectedLga) : [];
	const hasSheet = Boolean(group || tapped);

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

					{tapped && (
						<section className="lga-card" aria-live="polite">
							<div className="lga-card__head">
								<h2>
									{tapped.name}
									<span> · {tapped.state}</span>
								</h2>
								<button
									type="button"
									className="icon-button"
									onClick={() => setSelectedLga(null)}
									aria-label={t('profile.close')}
								>
									<svg viewBox="0 0 24 24" aria-hidden="true">
										<path d="M6 6l12 12M18 6 6 18" />
									</svg>
								</button>
							</div>
							{tappedGroups.length === 0 ? (
								<p className="muted">{t('map.lgaNoGroups')}</p>
							) : (
								<ul className="lga-card__groups">
									{tappedGroups.map(({ group: g, presence }) => (
										<li key={g.id}>
											<button type="button" className="link-button" onClick={() => selectGroup(g)}>
												<Swatch kind={presence} />
												{g.name}
											</button>
											<span className="muted">
												{presence === 'community' ? t('presence.community') : t(`presence.${presence}`)}
											</span>
										</li>
									))}
								</ul>
							)}
						</section>
					)}

					{group ? (
						<Profile group={group} tr={tr} onShowLga={showLga} />
					) : (
						!tapped && (
							<div className="intro">
								<p className="intro__tagline">{t('site.tagline')}</p>
								{data && data.groups.length === 0 && <p className="muted">{t('site.noGroups')}</p>}
								{data && data.groups.length > 0 && (
									<ul className="intro__groups">
										{data.groups.map((g) => (
											<li key={g.id}>
												<button type="button" className="chip" onClick={() => selectGroup(g)}>
													{g.name}
												</button>
											</li>
										))}
									</ul>
								)}
								<p className="intro__note">{t('site.notOwnership')}</p>
							</div>
						)
					)}
				</div>
			</div>

			<div className="map-region">
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
							group={group}
							selectedLga={selectedLga}
							focus={focus}
							padding={padding}
							label={t('map.label')}
							attribution={`${t('map.creditBoundaries')}: <a href='https://data.grid3.org/' target='_blank' rel='noopener'>GRID3</a> (CC BY 4.0) · ${t('map.creditRivers')}: <a href='https://www.naturalearthdata.com/' target='_blank' rel='noopener'>Natural Earth</a>`}
							onSelectLga={setSelectedLga}
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
