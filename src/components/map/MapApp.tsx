import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PaddingOptions } from 'maplibre-gl';
import type { Lang } from '../../i18n/ui';
import { useTranslations } from '../../i18n/utils';
import type { Atlas } from '../../lib/atlas';
import { chapterFrontier, chaptersOf, chapterYear } from '../../lib/story';
import { activeAt, DEFAULT_YEAR, eventsAt, eventsStarting, formatYearParam, parseYear, TODAY } from '../../lib/timeline';
import type { CoupView, GroupView, History, PlaceView, PoliticsView, Presence, UnitView } from '../../lib/types';
import { powerChaptersOf } from '../../lib/power-story';
import PowerTimeline from './PowerTimeline';
import EventPanel from './EventPanel';
import { HoverExplain, PinnedExplain } from './Explain';
import ExplainHint, { hintSeen } from './ExplainHint';
import type { MapItem } from './history-map';
import { HistoryIntro } from './HistoryPanel';
import type { FocusRequest, Mode, PowerMap } from './MapView';
import { CommunityCard, PlaceCard } from './PlaceCard';
import PowerPanel, { NEUTRAL } from './PowerPanel';
import Profile from './Profile';
import Search from './Search';
import FamilyPanel from './FamilyPanel';
import { FAMILY_PREFIX, familyHighlight, familyId, languageGroups, type LanguageGroup } from '../../lib/families';
import { useSheetDrag, type SheetState } from './sheet-drag';
import SoundToggle from './SoundToggle';
import ShareButton from '../ShareButton';
import Swap from './Swap';
import { cue, resumeOnGesture, setScene } from '../../lib/sound';
import Timeline from './Timeline';
import './map-app.css';
import './history.css';
import './story.css';
import './events.css';
import './power.css';
import './mobile.css';

/**
 * A lazy import that survives a dropped or stale chunk: it tries again, then
 * reloads the page once (the address keeps the view). Uncaught, a failed import
 * unmounts the whole app and leaves the page blank.
 */
function chunk<T>(name: string, load: () => Promise<T>): () => Promise<T> {
	const key = `niajmap.reloaded.${name}`;
	return () =>
		load()
			.catch(() => new Promise((r) => setTimeout(r, 500)).then(load))
			.then((m) => {
				try {
					sessionStorage.removeItem(key);
				} catch {}
				return m;
			})
			.catch((err) => {
				try {
					if (!sessionStorage.getItem(key)) {
						sessionStorage.setItem(key, '1');
						window.location.reload();
						return new Promise<T>(() => {});
					}
				} catch {}
				throw err;
			});
}

const MapView = lazy(chunk('map', () => import('./MapView')));
// The storytelling view (and GSAP with it) loads only when a story is opened.
const StoryMode = lazy(chunk('story', () => import('./StoryMode')));
const PowerStory = lazy(chunk('power-story', () => import('./PowerStory')));

/** If the story cannot load, say so and offer the way back, instead of taking the page down with it. */
class StoryBoundary extends Component<{ onClose: () => void; message: string; back: string; children: ReactNode }, { failed: boolean }> {
	state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	componentDidCatch(err: unknown) {
		console.error(err);
	}
	render() {
		if (!this.state.failed) return this.props.children;
		return (
			<div className="story story--failed" role="alert">
				<p>{this.props.message}</p>
				<button type="button" className="story-close" onClick={this.props.onClose}>
					<span>{this.props.back}</span>
				</button>
			</div>
		);
	}
}

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
type PoliticsState = { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; politics: PoliticsView };

/** The seats of federal power: Lagos until December 1991, then Abuja. */
const SEATS = {
	lagos: { name: 'Lagos', point: [3.39, 6.45] as [number, number] },
	abuja: { name: 'Abuja', point: [7.49, 9.06] as [number, number] },
};

/** The view the web address describes, so any view can be shared. */
type UrlView = { mode: Mode; group: string | null; year: number; polity: string | null; chapter?: number; event?: string | null; era?: string | null };

function viewFromUrl(): UrlView {
	const params = new URL(window.location.href).searchParams;
	const year = parseYear(params.get('year'));
	const polity = params.get('polity');
	const mode: Mode = params.get('mode') === 'power' ? 'power' : params.get('mode') === 'then' || polity || year !== null ? 'then' : 'today';
	const chapter = Number(params.get('ch'));
	return {
		mode,
		group: mode === 'today' ? (params.get('group') ?? (params.get('family') ? familyId(params.get('family')!) : null)) : null,
		year: year ?? DEFAULT_YEAR,
		polity: mode === 'then' ? polity : null,
		chapter: Number.isInteger(chapter) && chapter > 0 ? chapter : 0,
		event: mode === 'then' && !polity ? params.get('event') : null,
		era: mode === 'power' ? params.get('era') : null,
	};
}

function writeUrl(view: UrlView, push: boolean): void {
	const url = new URL(window.location.href);
	for (const key of ['group', 'family', 'mode', 'year', 'polity', 'ch', 'event', 'era']) url.searchParams.delete(key);
	if (view.mode === 'power') {
		url.searchParams.set('mode', 'power');
		if (view.era) url.searchParams.set('era', view.era);
	} else if (view.mode === 'then') {
		url.searchParams.set('mode', 'then');
		url.searchParams.set('year', formatYearParam(view.year));
		if (view.polity) url.searchParams.set('polity', view.polity);
		if (view.polity && view.chapter) url.searchParams.set('ch', String(view.chapter));
		if (!view.polity && view.event) url.searchParams.set('event', view.event);
	} else if (view.group?.startsWith(FAMILY_PREFIX)) {
		url.searchParams.set('family', view.group.slice(FAMILY_PREFIX.length));
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

/** On phones: the bottom sheet's resting peek and the tab bar under it, in px (as map-app.css sets them). */
const SHEET_PEEK = 148;
const TAB_BAR = 72;

export default function MapApp({ lang }: Props) {
	const tr = useMemo(() => useTranslations(lang), [lang]);
	const { t, plural } = tr;
	const initial = useMemo(viewFromUrl, []);
	const [load, setLoad] = useState<LoadState>({ status: 'loading' });
	const [mode, setMode] = useState<Mode>(initial.mode);
	const [groupId, setGroupId] = useState<string | null>(initial.group);
	const [year, setYear] = useState(initial.year);
	const [polityId, setPolityId] = useState<string | null>(initial.polity);
	const [chapter, setChapter] = useState(initial.chapter ?? 0);
	// True while the main timeline plays: the view turns into a documentary (letterbox, following camera).
	const [playing, setPlaying] = useState(false);
	const [historyLoad, setHistoryLoad] = useState<HistoryState>({ status: 'idle' });
	const [politicsLoad, setPoliticsLoad] = useState<PoliticsState>({ status: 'idle' });
	// The Power view's period, and the region (or zone) picked on the map or in the panel.
	const [eraId, setEraId] = useState<string | null>(initial.era ?? null);
	const [unitId, setUnitId] = useState<string | null>(null);
	const [coalitionId, setCoalitionId] = useState<string | null>(null);
	const [coupId, setCoupId] = useState<string | null>(null);
	// A period of politics told as a story, and the chapter it is on.
	const [powerStory, setPowerStory] = useState(false);
	const [powerChapter, setPowerChapter] = useState(0);
	const [showStateLines, setShowStateLines] = useState(false);
	const [selectedLga, setSelectedLga] = useState<string | null>(null);
	// Name of a tapped community dot of the selected group.
	const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null);
	// The LGA under the mouse (desktop), for the quick "who lives here" card.
	const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
	// What is under the mouse in the history view, and what was last tapped there.
	const [hoverItems, setHoverItems] = useState<{ items: MapItem[]; x: number; y: number } | null>(null);
	const [pick, setPick] = useState<{ item: MapItem; x: number; y: number } | null>(null);
	// Until a visitor has pointed at something on the history map, a hint and beckoning rings invite them to.
	const [hintDone, setHintDone] = useState(hintSeen);
	const [hintUsed, setHintUsed] = useState(false);
	const closeHint = useCallback(() => setHintDone(true), []);
	useEffect(() => {
		if (!hintDone && mode === 'then' && (hoverItems || pick)) setHintUsed(true);
	}, [hintDone, mode, hoverItems, pick]);
	// The event open in the panel, and a moment's mark to ring.
	const [eventId, setEventId] = useState<string | null>(initial.event ?? null);
	const [pulse, setPulse] = useState<{ event: string; index: number } | null>(null);
	const [focus, setFocus] = useState<FocusRequest>(() =>
		initial.mode === 'then'
			? initial.polity
				? { kind: 'polity', id: initial.polity, year: initial.year, cinematic: true }
				: initial.event
					? { kind: 'event', id: initial.event, cinematic: true }
					: { kind: 'region' }
			: initial.mode === 'power'
				? { kind: 'nigeria' }
				: { kind: 'group' },
	);
	// The phone's bottom sheet rests at one of three heights. Most code only asks for it open or not.
	const [sheet, setSheet] = useState<SheetState>('peek');
	const sheetOpen = sheet !== 'peek';
	const setSheetOpen = useCallback((open: boolean | ((was: boolean) => boolean)) => {
		setSheet((s) => {
			const want = typeof open === 'function' ? open(s !== 'peek') : open;
			return want ? (s === 'full' ? 'full' : 'half') : 'peek';
		});
	}, []);
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

	// The Power view's data loads only when someone opens it.
	useEffect(() => {
		if (mode !== 'power' || politicsLoad.status === 'ready' || politicsLoad.status === 'loading') return;
		setPoliticsLoad({ status: 'loading' });
		getJson<PoliticsView>('/data/politics.json')
			.then((politics) => setPoliticsLoad({ status: 'ready', politics }))
			.catch((err) => {
				console.error(err);
				setPoliticsLoad({ status: 'error' });
			});
	}, [mode, politicsLoad.status]);

	// A story opened from a link: the chapter decides the year, whatever the address said.
	useEffect(() => {
		const loaded = historyLoad.status === 'ready' ? historyLoad.history : null;
		if (mode !== 'then' || !loaded || !polityId) return;
		const p = loaded.polities.find((x) => x.id === polityId);
		const c = p && chaptersOf(p)[chapter];
		if (!p || !c) return;
		const y = chapterYear(p, c);
		if (y !== year) {
			setYear(y);
			setFocus({ kind: 'polity', id: p.id, year: y, cinematic: true });
		}
		// Only when the data arrives or another story opens; chapter moves set the year themselves.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [historyLoad, polityId]);

	// The phone's status bar takes the colour of the view: page, parchment, or the film of a story.
	useEffect(() => {
		const film = (mode === 'then' && polityId) || playing;
		for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
			meta.dataset.original ??= meta.content;
			const dark = meta.media.includes('dark');
			meta.content = film ? '#110c08' : mode === 'then' ? (dark ? '#1a1510' : '#ece1c8') : meta.dataset.original;
		}
	}, [mode, polityId, playing]);

	// The mood (Today or Then) sets the colour tokens for the whole page.
	useEffect(() => {
		document.documentElement.dataset.mood = mode;
	}, [mode]);

	const data = load.status === 'ready' ? load.data : null;
	const history = historyLoad.status === 'ready' ? historyLoad.history : null;
	const group = mode === 'today' ? (data?.groups.find((g) => g.id === groupId) ?? null) : null;
	const polity = mode === 'then' ? (history?.polities.find((p) => p.id === polityId) ?? null) : null;
	const event = mode === 'then' && !polityId ? (history?.events.find((e) => e.id === eventId) ?? null) : null;
	const politics = politicsLoad.status === 'ready' ? politicsLoad.politics : null;
	// The First Republic opens the Power view unless the address names another period.
	const era = politics ? (politics.eras.find((e) => e.id === eraId) ?? politics.eras.find((e) => e.id === 'first-republic') ?? politics.eras[0] ?? null) : null;
	// Language families and branches, searchable and shown as one highlight (Igboid, Yoruboid…).
	const families = useMemo(() => (data ? languageGroups(data.groups) : []), [data]);
	const branches = useMemo(() => new Map(families.map((x) => [x.name, x])), [families]);
	const family = mode === 'today' && groupId?.startsWith(FAMILY_PREFIX) ? (branches.get(groupId.slice(FAMILY_PREFIX.length)) ?? null) : null;
	// The map draws a family as one people living in all its peoples' lands.
	const familyShape = useMemo(() => (family ? { ...family.groups[0], id: family.id, name: family.name, ...familyHighlight(family) } : null), [family]);
	const groupColor = useMemo(() => new Map((data?.atlas.groups ?? []).map((g) => [g.id, g.color])), [data]);

	// What the Power view draws: each region in its leading peoples' colours, and the period's federal leaders at home.
	const powerMap = useMemo<PowerMap | null>(() => {
		if (mode !== 'power' || !era) return null;
		const party = new Map(era.parties.map((p) => [p.id, p]));
		const pins = new Map<string, PowerMap['pins'][number]>();
		const roads: PowerMap['roads'] = [];
		const capitals = new Map<string, PowerMap['capitals'][number]>();
		for (const l of era.federal.leaders) {
			if (!l.home) continue;
			const key = l.home.point.join(',');
			const short = l.party ? party.get(l.party)?.short : undefined;
			const label = `${l.name} (${l.groupName})${short ? ` · ${short}` : ''}`;
			const prev = pins.get(key);
			const color = (l.group && groupColor.get(l.group)) || NEUTRAL;
			pins.set(key, prev ? { ...prev, label: `${prev.label}\n${label}` } : { name: l.name, label, point: l.home.point, color });
			// Each leader's road to the seat of power: Lagos, then Abuja from December 1991.
			const seat = l.from >= 1992 ? SEATS.abuja : SEATS.lagos;
			capitals.set(seat.name, seat);
			if (Math.hypot(l.home.point[0] - seat.point[0], l.home.point[1] - seat.point[1]) > 0.2) roads.push({ from: l.home.point, to: seat.point, color });
		}
		const coalition = era.coalitions.find((c) => c.id === coalitionId) ?? null;
		const coupOpen = era.coups.find((c) => c.id === coupId) ?? null;
		// While a coup plays, the regions recede and its own marks take the map.
		const inFocus = (id: string) => (coupOpen ? false : coalition ? coalition.between.includes(id) : unitId ? unitId === id : true);
		return {
			key: era.id,
			units: era.units.map((u) => {
				const p = u.party ? party.get(u.party) : undefined;
				return {
					id: u.id,
					name: u.name,
					lgas: u.lgas,
					colors: u.groups.slice(0, 3).map((g) => groupColor.get(g.id) ?? NEUTRAL),
					label: u.label,
					groups: u.groups.map((g) => g.name).join(', '),
					dim: !inFocus(u.id),
					...(p ? { party: { id: p.id, short: p.short, slot: p.slot } } : {}),
				};
			}),
			coalitions: (coupOpen ? [] : era.coalitions).map((c) => ({
				id: c.id,
				name: c.name,
				years: c.to === c.from ? String(c.from) : `${c.from}–${c.to ?? t('power.today')}`,
				links: c.links,
				dim: Boolean(coalition && coalition.id !== c.id),
				selected: coalition?.id === c.id,
			})),
			pins: coupOpen ? [] : [...pins.values()],
			roads: coupOpen ? [] : roads,
			capitals: coupOpen ? [] : [...capitals.values()],
			...(coupOpen
				? {
						coup: {
							key: coupOpen.id,
							moments: coupOpen.moments.filter((m) => m.at).map((m) => ({ point: m.at!.point, mark: m.mark, title: m.title, when: m.when })),
							routes: coupOpen.routes,
							area: coupOpen.area,
							...(coupOpen.areaPoint ? { areaPoint: coupOpen.areaPoint } : {}),
						},
					}
				: {}),
		};
	}, [mode, era, groupColor, unitId, coalitionId, coupId, t]);

	/** Which region (or zone) of the open period an LGA lies in. */
	const unitOf = useCallback((lga: string) => era?.units.find((u) => u.lgas.includes(lga)) ?? null, [era]);

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

	/** Shows a language family (or branch) on the map, with its peoples in the sheet. */
	const selectFamily = useCallback(
		(next: LanguageGroup | null) => {
			writeUrl({ mode: 'today', group: next?.id ?? null, year, polity: null }, true);
			setMode('today');
			setGroupId(next?.id ?? null);
			setSelectedLga(null);
			setSelectedCommunity(null);
			setFocus({ kind: next ? 'group' : 'nigeria' });
			setSheetOpen(false);
			setAnnouncement(next ? plural('announce.selected', next.groups.length, { name: next.name }) : t('announce.cleared'));
		},
		[t, plural, year, setSheetOpen],
	);

	/** Opens the history view, optionally on one polity's story at its height. */
	const openThen = useCallback(
		(next: { polity?: string | null; year?: number } = {}) => {
			const y = next.year ?? year;
			const p = next.polity ?? null;
			writeUrl({ mode: 'then', group: null, year: y, polity: p, chapter: 0 }, true);
			setMode('then');
			setYear(y);
			setPolityId(p);
			setChapter(0);
			setSelectedLga(null);
			setSelectedCommunity(null);
			setHover(null);
			setSheetOpen(false);
			setFocus(p ? { kind: 'polity', id: p, year: y, cinematic: true } : { kind: 'region', cinematic: true });
		},
		[year],
	);

	/** Opens the Power view on a period (the last one opened, or the First Republic). */
	const openPower = useCallback(() => {
		writeUrl({ mode: 'power', group: null, year, polity: null, era: eraId }, true);
		setMode('power');
		setUnitId(null);
		setSelectedLga(null);
		setSelectedCommunity(null);
		setHover(null);
		setPlaying(false);
		setSheetOpen(false);
		setFocus({ kind: 'nigeria' });
	}, [year, eraId]);

	const selectEra = useCallback(
		(id: string) => {
			writeUrl({ mode: 'power', group: null, year, polity: null, era: id }, false);
			setEraId(id);
			setUnitId(null);
			setCoalitionId(null);
			setCoupId(null);
		},
		[year],
	);

	/** The box around some LGAs, to frame a region or the regions of a coalition. */
	const lgaBounds = useCallback(
		(ids: string[]): [number, number, number, number] | null => {
			const want = new Set(ids);
			const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
			const walk = (c: unknown): void => {
				if (typeof (c as number[])[0] === 'number') {
					const [x, y] = c as number[];
					box[0] = Math.min(box[0], x);
					box[1] = Math.min(box[1], y);
					box[2] = Math.max(box[2], x);
					box[3] = Math.max(box[3], y);
				} else for (const d of c as unknown[]) walk(d);
			};
			for (const f of data?.lgas.features ?? []) if (want.has(String(f.properties?.id)) && 'coordinates' in f.geometry) walk(f.geometry.coordinates);
			return Number.isFinite(box[0]) ? box : null;
		},
		[data],
	);

	/** Frames every place a coup touched; the whole country when it named land or has no places. */
	const frameCoup = useCallback((c: CoupView) => {
		const pts = [...c.moments.flatMap((m) => (m.at ? [m.at.point] : [])), ...c.routes.flatMap((r) => r.path), ...(c.areaPoint ? [c.areaPoint] : [])];
		if (c.area.length > 0 || pts.length === 0) return setFocus({ kind: 'nigeria' });
		const xs = pts.map((p) => p[0]);
		const ys = pts.map((p) => p[1]);
		const pad = 0.9;
		setFocus({ kind: 'bounds', bounds: [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad], cinematic: true });
	}, []);

	/** Moves a period's story (and the map with it) to one chapter: a region lit and framed, a coalition drawn, a coup played. */
	const goPowerChapter = useCallback(
		(i: number) => {
			if (!era) return;
			const c = powerChaptersOf(era)[i];
			if (!c) return;
			setPowerChapter(i);
			setUnitId(c.kind === 'unit' ? c.id : null);
			setCoalitionId(c.kind === 'coalition' ? c.id : null);
			setCoupId(c.kind === 'coup' ? c.id : null);
			if (c.kind === 'unit' || c.kind === 'coalition') {
				const ids = c.kind === 'unit' ? (era.units.find((u) => u.id === c.id)?.lgas ?? []) : era.units.filter((u) => era.coalitions.find((k) => k.id === c.id)?.between.includes(u.id)).flatMap((u) => u.lgas);
				const b = lgaBounds(ids);
				setFocus(b ? { kind: 'bounds', bounds: b, cinematic: true } : { kind: 'nigeria' });
			} else if (c.kind === 'coup') {
				const k = era.coups.find((x) => x.id === c.id);
				if (k) frameCoup(k);
			} else setFocus({ kind: 'nigeria' });
		},
		[era, lgaBounds, frameCoup],
	);

	const closePowerStory = useCallback(() => {
		setPowerStory(false);
		setPowerChapter(0);
		setUnitId(null);
		setCoalitionId(null);
		setCoupId(null);
		setFocus({ kind: 'nigeria' });
	}, []);

	/** Opens a polity's story at its prologue, or closes the story with null. */
	const selectPolity = useCallback(
		(id: string | null) => {
			const p = id ? history?.polities.find((x) => x.id === id) : null;
			const y = p ? chapterYear(p, { kind: 'cover' }) : year;
			writeUrl({ mode: 'then', group: null, year: y, polity: id, chapter: 0 }, true);
			setPolityId(id);
			setChapter(0);
			setYear(y);
			setHoverItems(null);
			setPick(null);
			if (id) setEventId(null);
			setPlaying(false);
			setFocus(id ? { kind: 'polity', id, year: y, cinematic: true } : { kind: 'region', cinematic: true });
		},
		[year, history],
	);

	/** Moves the story (and the map with it) to one chapter. */
	const goChapter = useCallback(
		(i: number) => {
			const p = history?.polities.find((x) => x.id === polityId);
			if (!p) return;
			const c = chaptersOf(p)[i];
			if (!c) return;
			const y = chapterYear(p, c);
			writeUrl({ mode: 'then', group: null, year: y, polity: p.id, chapter: i }, false);
			setChapter(i);
			setYear(y);
			setFocus({ kind: 'polity', id: p.id, year: y, cinematic: true });
		},
		[history, polityId],
	);

	const changeYear = useCallback(
		(y: number) => {
			// An open event stays open while it is still on the map.
			const keep = event && y >= event.year && y <= event.until ? event.id : null;
			writeUrl({ mode: 'then', group: null, year: y, polity: polityId, chapter, event: keep }, false);
			setYear(y);
			setPick(null);
			if (!keep) setEventId(null);
		},
		[polityId, chapter, event],
	);

	/** Opens an event in the panel, at its own year if it is not on the map now, and frames everything it draws. */
	const openEvent = useCallback(
		(id: string) => {
			const e = history?.events.find((x) => x.id === id);
			if (!e) return;
			const y = year >= e.year && year <= e.until ? year : e.year;
			writeUrl({ mode: 'then', group: null, year: y, polity: null, chapter: 0, event: id }, true);
			setPolityId(null);
			setEventId(id);
			setYear(y);
			setPick(null);
			setHoverItems(null);
			setSheetOpen(true);
			setFocus({ kind: 'event', id, cinematic: true });
		},
		[history, year],
	);

	const closeEvent = useCallback(() => {
		writeUrl({ mode: 'then', group: null, year, polity: null, chapter: 0 }, true);
		setEventId(null);
		setSheetOpen(false);
	}, [year]);

	/** Goes to one moment of an event: the camera to its place, and its mark rung. */
	const showMoment = useCallback(
		(id: string, index: number, cinematic = true) => {
			const m = history?.events.find((x) => x.id === id)?.moments[index];
			if (!m?.at) return;
			setFocus({ kind: 'point', point: m.at.point, cinematic });
			setPulse({ event: id, index });
		},
		[history],
	);

	/** Main playback, documentary style: the camera follows the year's events. */
	const followEvents = useCallback(
		(y: number) => {
			if (!history) return;
			if (y >= TODAY) {
				setFocus({ kind: 'region', cinematic: true });
				return;
			}
			const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
			for (const b0 of [...eventsAt(history, y).map((a) => a.snapshot.bounds), ...eventsStarting(history, y).map((e) => e.bounds)]) {
				const b = b0;
				if (!b) continue;
				box[0] = Math.min(box[0], b[0]);
				box[1] = Math.min(box[1], b[1]);
				box[2] = Math.max(box[2], b[2]);
				box[3] = Math.max(box[3], b[3]);
			}
			if (!Number.isFinite(box[0])) return;
			// Never closer than a region: playback is the wide shot.
			const minSpan = 4;
			const cx = (box[0] + box[2]) / 2;
			const cy = (box[1] + box[3]) / 2;
			const w = Math.max(minSpan, box[2] - box[0]) / 2;
			const h = Math.max(minSpan * 0.75, box[3] - box[1]) / 2;
			setFocus({ kind: 'bounds', bounds: [cx - w, cy - h, cx + w, cy + h], cinematic: true });
		},
		[history],
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
			setChapter(v.chapter ?? 0);
			setEventId(v.event ?? null);
			setPick(null);
			setSelectedLga(null);
			setSelectedCommunity(null);
			setEraId(v.era ?? null);
			setUnitId(null);
			setFocus(v.mode === 'then' ? (v.polity ? { kind: 'polity', id: v.polity, year: v.year } : { kind: 'region' }) : v.mode === 'power' ? { kind: 'nigeria' } : { kind: 'group' });
		};
		window.addEventListener('popstate', onPop);
		return () => window.removeEventListener('popstate', onPop);
	}, []);

	useEffect(() => {
		if (mode === 'power') {
			document.title = `${era ? `${era.name}, ${era.label}` : t('mode.power')} · ${t('site.name')}`;
		} else if (mode === 'then') {
			const when = year >= TODAY ? t('timeline.today') : String(year);
			document.title = `${polity ? polity.name : event ? event.name : t('mode.then')}, ${when} · ${t('site.name')}`;
		} else document.title = group ? `${group.name} · ${t('site.name')}` : t('site.name');
	}, [group, polity, event, mode, year, era, t]);

	const showLga = useCallback((id: string) => {
		setSelectedLga(id);
		setSelectedCommunity(null);
		setFocus({ kind: 'lga', id });
		setSheetOpen(false);
	}, []);

	// Leave room for the bottom sheet on phones so highlights are not hidden under it,
	// and for the timeline in the history view.
	// and for the timeline in the history view; a story frames its polity between the letterbox bars.
	const storyOpen = mode === 'then' && Boolean(polityId);
	const powerStoryOpen = mode === 'power' && powerStory && Boolean(era);
	const storyChapter = polity ? chaptersOf(polity)[Math.min(chapter, polity.snapshots.length + 1)] : null;
	const frontierIndex = polity && storyChapter ? chapterFrontier(polity, storyChapter) : null;
	const storyFrontier = polity && frontierIndex !== null ? { id: polity.id, index: frontierIndex } : null;
	const padding: PaddingOptions = storyOpen || powerStoryOpen
		? narrow
			? { top: 64, bottom: Math.round(window.innerHeight * 0.46) + 96, left: 24, right: 24 }
			: { top: 96, bottom: 150, left: 70, right: 90 }
		: narrow
			? { top: 84, bottom: SHEET_PEEK + TAB_BAR + (mode === 'then' ? 104 : 16), left: 24, right: 24 }
			: { top: playing ? 110 : 80, bottom: mode === 'then' ? (playing ? 230 : 170) : mode === 'power' ? 150 : 80, left: 80, right: 96 };

	// ---- Sound: each view sets the bed's mix, and moments get their cue.
	useEffect(resumeOnGesture, []);
	useEffect(() => {
		setScene(storyOpen || powerStoryOpen ? 'story' : mode === 'then' ? (playing ? 'film' : 'then') : mode);
	}, [mode, storyOpen, powerStoryOpen, playing]);
	const heard = useRef({ mode, story: polity?.id ?? null, chapter, group: groupId, event: eventId });
	useEffect(() => {
		const was = heard.current;
		const story = polity?.id ?? null;
		heard.current = { mode, story, chapter, group: groupId, event: eventId };
		if (story !== was.story) cue(story ? 'open' : 'close');
		else if (story && chapter !== was.chapter) cue('chapter');
		else if (mode !== was.mode) cue('mode');
		else if ((groupId && groupId !== was.group) || (eventId && eventId !== was.event)) cue('tap');
	}, [mode, polity?.id, chapter, groupId, eventId]);

	const tapped = mode === 'today' && selectedLga ? lgaInfo.get(selectedLga) : undefined;
	const tappedGroups = selectedLga ? groupsIn(selectedLga) : [];
	const community = group?.communities.find((c) => c.name === selectedCommunity) ?? null;
	const hasSheet = mode === 'power' ? Boolean(unitId) : mode === 'then' ? Boolean(event) : Boolean(group || family || tapped || community);
	const sheetRef = useRef<HTMLDivElement>(null);
	useSheetDrag(sheetRef, sheet, setSheet, narrow && !storyOpen && !powerStoryOpen);

	// The panel shows one view at a time: a community, a place, a people, a polity, or a list.
	const view =
		mode === 'power'
			? { key: `power:${era?.id ?? ''}`, depth: 0 }
			: mode === 'then'
			? event
				? { key: `event:${event.id}`, depth: 1 }
				: { key: 'then', depth: 0 }
			: community && group
				? { key: `community:${group.id}:${community.name}`, depth: 2 }
				: tapped && selectedLga
					? { key: `lga:${selectedLga}`, depth: 2 }
					: family
						? { key: `family:${family.name}`, depth: 1 }
						: group
						? { key: `group:${group.id}`, depth: 1 }
						: { key: 'key', depth: 0 };

	const tapLga = useCallback(
		(id: string | null) => {
			// In the Power view a tap picks the whole region (or zone) the LGA lies in.
			if (mode === 'power') {
				const u = id ? unitOf(id) : null;
				setUnitId(u?.id ?? null);
				setCoalitionId(null);
				setCoupId(null);
				if (u) setSheetOpen(true);
				return;
			}
			setSelectedLga(id);
			setSelectedCommunity(null);
			// On phones, open the sheet so the brief is readable straight away.
			if (id) setSheetOpen(true);
		},
		[mode, unitOf],
	);

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
			// In the history view the story closes itself (with its exit animation).
			if (mode === 'then') return;
			if (mode === 'power') {
				setUnitId(null);
				return;
			}
			if (selectedLga || selectedCommunity) tapLga(null);
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

	// Versus opens on the kingdom in view, at the year on the timeline, or on the default match-up.
	const versusHref = mode === 'then' && polity && year <= polity.span.to ? `/versus?a=${polity.id}~${year}` : '/versus';

	const mapLabel = mode === 'then' ? t('map.labelThen', { year: year >= TODAY ? t('timeline.today') : year }) : t('map.label');

	return (
		<div className="app" data-sheet={sheet} data-picked={hasSheet ? 'true' : undefined} data-mode={mode} data-story={storyOpen || powerStoryOpen ? 'open' : undefined} data-playing={playing && !storyOpen ? 'true' : undefined}>
			<div className="panel">
				<div className="topbar">
					<div className="topbar__row">
						<a className="brand" href="/" aria-label={t('site.name')}>
							<span className="brand__mark" aria-hidden="true" />
							<span className="brand__name">{t('site.name')}</span>
						</a>
						<SoundToggle tr={tr} />
						<ShareButton tr={tr} />
						<div className="mode-switch" role="group" aria-label={t('mode.label')}>
							<button type="button" title={t('mode.today')} aria-pressed={mode === 'today'} onClick={() => mode !== 'today' && selectGroup(null)}>
								<svg viewBox="0 0 24 24" aria-hidden="true">
									<circle cx="12" cy="9" r="3.2" />
									<path d="M12 21s-6.5-6-6.5-11.5a6.5 6.5 0 0113 0C18.5 15 12 21 12 21z" />
								</svg>
								<span>{t('mode.today.short')}</span>
							</button>
							<button type="button" title={t('mode.then')} aria-pressed={mode === 'then'} onClick={() => mode !== 'then' && openThen()}>
								<svg viewBox="0 0 24 24" aria-hidden="true">
									<path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z" />
									<path d="M5 17a3 3 0 013-3h11" />
								</svg>
								<span>{t('mode.then.short')}</span>
							</button>
							<button type="button" aria-pressed={mode === 'power'} onClick={() => mode !== 'power' && openPower()}>
								<svg viewBox="0 0 24 24" aria-hidden="true">
									<path d="M4 20h16" />
									<path d="M6 20V10l6-5 6 5v10" />
									<path d="M10 20v-5h4v5" />
								</svg>
								<span>{t('mode.power')}</span>
							</button>
							<a className="mode-switch__link" href={versusHref} title={t('mode.versus.long')}>
								<svg viewBox="0 0 24 24" aria-hidden="true">
									<path d="M4 4l9 9M4 4h4M4 4v4" />
									<path d="M20 4l-9 9M20 4h-4M20 4v4" />
									<path d="M7 14l3 3-3 3M17 14l-3 3 3 3" />
								</svg>
								<span>{t('mode.versus')}</span>
							</a>
						</div>
					</div>
					{mode === 'today' &&
						(data ? (
							<Search groups={data.groups} families={families} selected={group} selectedFamily={family} onSelect={selectGroup} onSelectFamily={selectFamily} tr={tr} />
						) : (
							<div className="search search--placeholder" aria-hidden="true" />
						))}
				</div>

				<div className="sheet" ref={sheetRef}>
					{narrow && (
						<button
							type="button"
							className="sheet__handle"
							aria-expanded={sheetOpen}
							// A tap steps the sheet up a height, and from full back down to a peek.
							onClick={() => setSheet((s) => (s === 'peek' ? 'half' : s === 'half' ? 'full' : 'peek'))}
						>
							<span className="sheet__grip" aria-hidden="true" />
							<span className="visually-hidden">{sheetOpen ? t('profile.collapse') : t('profile.expand')}</span>
						</button>
					)}

					<Swap viewKey={view.key} depth={view.depth} scroller={sheetRef}>
						{mode === 'power' ? (
							!politics || !era ? (
								<p className="muted then-loading">{politicsLoad.status === 'error' ? t('map.loadError') : t('power.loading')}</p>
							) : (
								<PowerPanel
									politics={politics}
									era={era}
									unitId={unitId}
									colors={groupColor}
									tr={tr}
									onEra={selectEra}
									coalitionId={coalitionId}
									onUnit={(id) => {
										setUnitId(id);
										setCoalitionId(null);
									}}
									onCoalition={(id) => {
										setCoalitionId(id);
										setUnitId(null);
										setCoupId(null);
									}}
									coupId={coupId}
									onCoup={(id) => {
										setCoupId(id);
										setUnitId(null);
										setCoalitionId(null);
										const c = id ? era.coups.find((x) => x.id === id) : null;
										if (!c) return setFocus({ kind: 'nigeria' });
										frameCoup(c);
									}}
									onMoment={(point) => setFocus({ kind: 'point', point, cinematic: true })}
									onOpenGroup={openGroup}
									onStory={() => {
										setPowerStory(true);
										goPowerChapter(0);
									}}
								/>
							)
						) : mode === 'then' ? (
							!history ? (
								<p className="muted then-loading">{historyLoad.status === 'error' ? t('map.loadError') : t('then.loading')}</p>
							) : event ? (
								<EventPanel
									event={event}
									history={history}
									year={year}
									tr={tr}
									onBack={closeEvent}
									onShow={() => setFocus({ kind: 'event', id: event.id, cinematic: true })}
									onMoment={(i) => {
										showMoment(event.id, i);
										setSheetOpen(false);
									}}
									onPulse={(i) => setPulse({ event: event.id, index: i })}
									onOpenPolity={selectPolity}
								/>
							) : (
								<HistoryIntro
									history={history}
									year={year}
									tr={tr}
									onSelect={selectPolity}
									onOpenEvent={openEvent}
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
								backTo={group?.name ?? family?.name}
							/>
						) : family && familyShape ? (
							<FamilyPanel
								family={family}
								colors={groupColor}
								branches={branches}
								lgaCount={familyShape.areas.length}
								tr={tr}
								onBack={() => selectGroup(null)}
								onOpenGroup={openGroup}
								onOpenFamily={selectFamily}
							/>
						) : group ? (
							<Profile
								group={group}
								tr={tr}
								onShowLga={showLga}
								onBack={() => selectGroup(null)}
								onOpenKingdom={(id, peak) => openThen({ polity: id, year: peak })}
								onOpenFamily={(name) => {
									const b = branches.get(name);
									if (b) selectFamily(b);
								}}
							/>
						) : (
							<div className="intro">
								{data && data.groups.length > 0 && (
									<header className="sheet-head">
										<h2>{t('intro.peek.title')}</h2>
										<p>{t('intro.peek.count', { groups: data.groups.length, families: data.atlas.families.length })}</p>
									</header>
								)}
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
				{hover && !narrow && mode === 'power' && <PowerHover hover={hover} unit={unitOf(hover.id)} colors={groupColor} tr={tr} />}
					{hoverItems && history && !narrow && mode === 'then' && !pick && <HoverExplain {...hoverItems} history={history} year={year} tr={tr} />}
				{pick && history && mode === 'then' && !storyOpen && (
					<PinnedExplain
						key={JSON.stringify(pick.item)}
						item={pick.item}
						x={pick.x}
						y={pick.y}
						narrow={narrow}
						history={history}
						year={year}
						tr={tr}
						onClose={() => setPick(null)}
						onOpenPolity={selectPolity}
						onOpenEvent={openEvent}
						onOpenGroup={(id) => {
							setPick(null);
							openGroup(id);
						}}
					/>
				)}
				{mode === 'then' && history && !storyOpen && (
					<Timeline
						history={history}
						year={year}
						onYear={changeYear}
						onArrive={followEvents}
						onMoment={(id, i) => showMoment(id, i)}
						onOpenEvent={openEvent}
						onPlaying={setPlaying}
						tr={tr}
						hint={!hintDone ? <ExplainHint used={hintUsed} onDone={closeHint} tr={tr} /> : undefined}
					/>
				)}
				{mode === 'power' && politics && era && !powerStoryOpen && (
					<PowerTimeline
						politics={politics}
						era={era}
						tr={tr}
						onEra={selectEra}
						onStory={() => {
							setPowerStory(true);
							goPowerChapter(0);
						}}
					/>
				)}
				{narrow && !storyOpen && !powerStoryOpen && (
					<button
						type="button"
						className="fab fab--recentre"
						aria-label={t('map.recentre')}
						title={t('map.recentre')}
						onClick={() => setFocus(mode === 'then' ? { kind: 'region', cinematic: false } : mode === 'today' && group ? { kind: 'group' } : { kind: 'nigeria' })}
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<circle cx="12" cy="12" r="3.2" />
							<path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
							<circle cx="12" cy="12" r="7" />
						</svg>
					</button>
				)}
				{narrow && (
					<p className="map-credit">
						{t('map.creditBoundaries')}:{' '}
						<a href="https://data.grid3.org/" target="_blank" rel="noopener">
							GRID3
						</a>{' '}
						(CC BY 4.0) ·{' '}
						<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">
							Natural Earth
						</a>
					</p>
				)}
				{mode === 'then' && !storyOpen && <div className="letterbox" aria-hidden="true" />}
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
							group={group ?? familyShape}
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
							onHoverItems={setHoverItems}
							onPickItem={(p) => {
								if (p) setPick(p);
								else if (pick) setPick(null);
								else if (polityId) selectPolity(null);
							}}
							pulse={pulse}
							beckon={!hintDone && !hintUsed && !playing && !storyOpen}
							pinned={pick && (pick.item.type === 'town' || pick.item.type === 'throne') && !storyOpen ? pick.item : null}
							story={storyOpen}
							frontier={storyFrontier}
							power={powerMap}
						/>
					</Suspense>
				) : (
					<p className="map-message">{t('map.loading')}</p>
				)}
			</div>

			{powerStoryOpen && era && politics && (
				<StoryBoundary key={`power-${era.id}`} onClose={closePowerStory} message={t('story.loadError')} back={t('story.back')}>
					<Suspense fallback={null}>
						<PowerStory
							key={era.id}
							politics={politics}
							era={era}
							chapter={powerChapter}
							colors={groupColor}
							tr={tr}
							onChapter={goPowerChapter}
							onClose={closePowerStory}
							onOpenGroup={(id) => {
								setPowerStory(false);
								openGroup(id);
							}}
							onEra={(id) => {
								selectEra(id);
								setPowerChapter(0);
								setFocus({ kind: 'nigeria' });
							}}
							onMoment={(point) => setFocus({ kind: 'point', point, cinematic: true })}
						/>
					</Suspense>
				</StoryBoundary>
			)}

			{storyOpen && polity && history && (
				<StoryBoundary key={polity.id} onClose={() => selectPolity(null)} message={t('story.loadError')} back={t('story.back')}>
				<Suspense fallback={null}>
					<StoryMode
						key={polity.id}
						polity={polity}
						history={history}
						chapter={chapter}
						tr={tr}
						onChapter={goChapter}
						onClose={() => selectPolity(null)}
						onOpenGroup={openGroup}
						onOpenPolity={selectPolity}
					/>
				</Suspense>
				</StoryBoundary>
			)}

			<p className="visually-hidden" role="status" aria-live="polite">
				{announcement}
			</p>
		</div>
	);
}

const PRESENCE_ORDER = { core: 0, significant: 1, minority: 2, community: 3 } as const;

/** In the Power view, a small card that follows the mouse: the region, its leading peoples and who led it. */
function PowerHover({
	hover,
	unit,
	colors,
	tr,
}: {
	hover: { id: string; x: number; y: number };
	unit: UnitView | null;
	colors: Map<string, string>;
	tr: ReturnType<typeof useTranslations>;
}) {
	const { t } = tr;
	if (!unit) return null;
	return (
		<div className="hover-card hover-card--power" style={{ left: hover.x + 16, top: hover.y + 16 }} aria-hidden="true">
			<p className="hover-card__title">{unit.name}</p>
			<p className="power-hover__groups">
				{unit.groups.map((g) => (
					<span key={g.id}>
						<span className="chip__dot" style={{ background: colors.get(g.id) ?? NEUTRAL }} />
						{g.name}
					</span>
				))}
			</p>
			{unit.leaders.map((l) => (
				<p key={l.name + l.from} className="power-hover__leader">
					<strong>{l.name}</strong> ({l.groupName}), {l.from}–{l.to ?? t('power.today')}
				</p>
			))}
			<p className="hover-card__hint">{t('power.hover')}</p>
		</div>
	);
}

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
