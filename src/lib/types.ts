// Shapes sent to the browser in /data/groups.json. Built by src/lib/groups.ts.
// Shared by the build and the map island, so no Astro imports here.

export type Confidence = 'high' | 'medium' | 'disputed';
export type Presence = 'core' | 'significant' | 'minority';
export type ReviewStatus = 'draft' | 'reviewed' | 'published';

/** A claim's evidence. `refs` are 1 based numbers into the group's own `sources` list. */
export interface Evidence {
	refs: number[];
	confidence: Confidence;
	note?: string;
}

export interface SourceView {
	n: number;
	id: string;
	citation: string;
	url?: string;
	checked: boolean;
}

export interface AreaView extends Evidence {
	lga: string;
	name: string;
	state: string;
	presence: Presence;
}

export interface VillageView {
	name: string;
	point?: [number, number];
	/** Set when the village lies in another LGA than its community's own. */
	lga?: string;
}

export interface CommunityView extends Evidence {
	name: string;
	lga: string;
	lgaName: string;
	state: string;
	point: [number, number];
	/** True when the point is the LGA's centre, not the town itself. */
	approximate: boolean;
	villages: VillageView[];
	/** Other LGAs the community spreads into, by name. */
	alsoIn: { lga: string; name: string; state: string }[];
	/**
	 * Where the community's name is marked on the map: its own point, plus one
	 * per other LGA whose villages are located (Ifeku in Esan South-East).
	 */
	markers: { lga: string; point: [number, number] }[];
	history?: Evidence & { text: string };
	livelihoods?: Evidence & { text: string };
}

export interface GroupView {
	id: string;
	name: string;
	status: ReviewStatus;
	searchAliases: string[];
	language: Evidence & {
		name: string;
		iso639_3?: string;
		glottocode?: string;
		family: { name: string; lineage: string[] };
	};
	summary: Evidence & { text: string };
	ruler?: Evidence & { title: string; seat?: string };
	areas: AreaView[];
	communities: CommunityView[];
	sources: SourceView[];
	reviewNotes: string[];
	/** Polities this people built or belonged to, for the jump to the Then view. */
	kingdoms: { id: string; name: string; peak: number }[];
}

export interface PeopleView extends Evidence {
	name: string;
	/** Group id when a profile exists. */
	group?: string;
	standing?: 'indigenous' | 'settled';
	share?: 'majority' | 'large' | 'minority';
	/** Mother tongue first. Two or more means bilingual. */
	languages: string[];
}

/** A brief about who lives in one LGA. Built by getPlaceViews(). */
export interface PlaceView {
	lga: string;
	name: string;
	state: string;
	status: ReviewStatus;
	summary: Evidence & { text: string };
	peoples: PeopleView[];
	languageUse?: Evidence & { text: string };
	history?: Evidence & { text: string };
	livelihoods?: Evidence & { text: string };
	sources: SourceView[];
}

// ---- History (Then mode). Built by src/lib/polities.ts into /data/history.json.

export type PolityKind = 'empire' | 'kingdom' | 'caliphate' | 'confederacy' | 'city-state' | 'network';
export type LinkKind = 'tribute' | 'trade' | 'war' | 'ritual' | 'descent';

export interface PlaceRef {
	name: string;
	point: [number, number];
}

export interface SnapshotView extends Evidence {
	year: number;
	yearLabel?: string;
	title: string;
	text: string;
	capital?: PlaceRef;
	nodes: PlaceRef[];
	links: { kind: LinkKind; to: PlaceRef; label?: string; note?: string; confidence?: Confidence; refs: number[] }[];
	/** Confidence of each drawn layer, when it is drawn. */
	core?: Confidence;
	influence?: Confidence;
	campaign?: Confidence;
	/** Where the polity's name is written in this snapshot. */
	label?: [number, number];
	/** Map extent of everything drawn in this snapshot, [west, south, east, north]. */
	bounds?: [number, number, number, number];
}

export interface PolityView {
	id: string;
	name: string;
	kind: PolityKind;
	status: ReviewStatus;
	otherNames: string[];
	/** The name written on the map. */
	shortName: string;
	/** The polity's ink on the old map. */
	color: string;
	span: Evidence & { from: number; to: number; fromLabel?: string; toLabel?: string };
	peak: number;
	summary: Evidence & { text: string };
	ruler?: Evidence & { title: string };
	/** Peoples whose kingdom this was (visible groups only). */
	peoples: { id: string; name: string }[];
	/** Peoples whose homelands lie inside the polity's lands at its height, most LGAs first. */
	livesThereToday: { id: string; name: string; lgas: number }[];
	snapshots: SnapshotView[];
	today: Evidence & { text: string; title?: string; seat?: PlaceRef };
	sources: SourceView[];
	reviewNotes: string[];
}

export type EventKind = 'war' | 'raid' | 'alliance' | 'migration' | 'colonial' | 'partition' | 'contact';
export type RouteKind = 'advance' | 'retreat' | 'raid' | 'migration' | 'exile' | 'loot' | 'alliance' | 'voyage';
/** A ship on a voyage route: sail before the steamers came up the Niger, steam after. */
export type Vessel = 'sail' | 'steam';
export type MarkKind = 'battle' | 'massacre' | 'bombarded' | 'burned' | 'captured' | 'founded' | 'treaty' | 'camp' | 'garrison' | 'exile' | 'flight' | 'loot' | 'shrine' | 'anchor';
export type ActorSide = 'attacker' | 'defender' | 'ally' | 'migrant' | 'origin' | 'colonial' | 'resister' | 'european' | 'trader';

export interface EventView extends Evidence {
	id: string;
	name: string;
	kind: EventKind;
	status: ReviewStatus;
	year: number;
	yearLabel?: string;
	/** Last year on the map. */
	until: number;
	/** Each actor's ink: its polity's, or the colonial red. */
	actors: { name: string; polity?: string; side: ActorSide; color: string }[];
	summary: Evidence & { text: string };
	routes: { kind: RouteKind; vessel?: Vessel; path: [number, number][]; label: string; by?: string; when?: string; note?: string; confidence?: Confidence; refs: number[]; color: string }[];
	moments: { when: string; title: string; text: string; at?: PlaceRef; mark: MarkKind; colonial: boolean; confidence?: Confidence; refs: number[] }[];
	/** True when the event has land drawn: fought over, or divided. */
	area: boolean;
	/** For a partition, where each part of the lands went. Shapes are in `History.pieces`. */
	pieces: { name: string; note?: string; label?: [number, number] }[];
	/** Polities taking part, for dimming and their stories. */
	polities: string[];
	/** Map extent of everything drawn, [west, south, east, north]. */
	bounds?: [number, number, number, number];
	sources: SourceView[];
	reviewNotes: string[];
}

export type SocietyRule = 'elders' | 'assemblies' | 'chiefdoms' | 'kingdoms' | 'villages';

/** A people who governed themselves in the land between the mapped states. */
export interface SocietyView {
	id: string;
	name: string;
	status: ReviewStatus;
	rule: SocietyRule;
	/** Their profiles on the atlas (visible groups only). */
	groups: { id: string; name: string }[];
	span: Evidence & { from: number; to: number; fromLabel?: string; toLabel?: string };
	summary: Evidence & { text: string };
	end?: Evidence & { text: string };
	/** Where the name is written, and when. `to` is inclusive. */
	lands: { from: number; to: number; label: [number, number]; name: string; confidence?: Confidence; note?: string }[];
	sources: SourceView[];
	reviewNotes: string[];
}

export type UnderKind = 'ruled' | 'tribute' | 'garrison' | 'crowned';

/** A town founded by several peoples, or held by a state for a time. */
export interface TownView {
	id: string;
	name: string;
	status: ReviewStatus;
	otherNames: string[];
	point: [number, number];
	founded: Evidence & { year: number; yearLabel?: string };
	summary: Evidence & { text: string };
	/** Each founding people, with the ink its thread is drawn in. */
	founders: (Evidence & { people: string; group?: { id: string; name: string }; polity?: string; color: string; from?: PlaceRef; quarters: string[]; text: string })[];
	under: (Evidence & { polity: string; polityName: string; color: string; from: number; to: number; kind: UnderKind; text: string })[];
	sources: SourceView[];
	reviewNotes: string[];
}

export type ThroneKind = 'created' | 'restored' | 'installed' | 'imposed' | 'retitled' | 'warrant';

/** A throne the colonial government made, restored, filled or imposed. */
export interface ThroneView extends Evidence {
	id: string;
	title: string;
	status: ReviewStatus;
	kind: ThroneKind;
	year: number;
	yearLabel?: string;
	/** Last year on the map; the end of the timeline (and the Today stop) when it still stands. */
	until?: number;
	seat: PlaceRef;
	by: string;
	first?: string;
	/** Who crowned or installed the holder, and where. */
	crowned?: Evidence & { by: string; at?: PlaceRef; text: string };
	groups: { id: string; name: string }[];
	polity?: string;
	text: string;
	sources: SourceView[];
	reviewNotes: string[];
}

export interface History {
	polities: PolityView[];
	/** Thrones made, restored, filled or imposed under colonial rule. */
	thrones: ThroneView[];
	/** Towns founded by several peoples, or held by a state for a time. */
	towns: TownView[];
	/** Peoples who governed themselves between the mapped states, written in the open land. */
	societies: SocietyView[];
	/** Wars, raids, alliances, migrations, colonial conquests and partitions, by year. */
	events: EventView[];
	/**
	 * The parts of a partitioned kingdom. Properties: key (`ev|<event id>`), e (event id),
	 * i (piece index), name, color. Kept apart from `shapes` because they move when they appear.
	 */
	pieces: GeoJSON.FeatureCollection;
	/**
	 * Dissolved territory per snapshot. Properties: key (`<polity>|<snapshot index>`),
	 * p (polity id), layer (core or influence), conf, color, network (true for Nri and Aro).
	 */
	shapes: GeoJSON.FeatureCollection;
}

// ---- Politics (Power mode). Built by src/lib/politics.ts into /data/politics.json.

export interface LeaderView extends Evidence {
	name: string;
	title: string;
	from: number;
	to?: number;
	/** Group id, when the people has a profile; its colour comes from the atlas. */
	group?: string;
	groupName: string;
	groupNote?: string;
	home?: PlaceRef;
	/** Party id within the period. */
	party?: string;
}

export interface PartyView extends Evidence {
	id: string;
	name: string;
	short: string;
	/** Colour slot (1–8) in the party palette. */
	slot: number;
	peoples: { id: string; name: string }[];
	leader?: string;
	text: string;
}

export interface CoalitionView extends Evidence {
	id: string;
	name: string;
	kind: 'coalition' | 'alliance' | 'merger';
	from: number;
	to?: number;
	parties: string[];
	between: string[];
	/** One link per partner: from the hub unit's label point to the partner's. */
	links: [[number, number], [number, number]][];
	text: string;
}

export interface CoupPersonView {
	name: string;
	role?: string;
	group?: string;
	groupName?: string;
	groupNote?: string;
}

export interface CoupView extends Evidence {
	id: string;
	name: string;
	date: string;
	year: number;
	outcome: 'seized' | 'bloodless' | 'failed';
	fell?: CoupPersonView;
	rose?: CoupPersonView;
	plotters: CoupPersonView[];
	killed: CoupPersonView[];
	text: string;
	moments: { when: string; title: string; text: string; at?: PlaceRef; mark: MarkKind }[];
	routes: { path: [number, number][]; label: string }[];
	/** LGAs of the land the coup named, if any. */
	area: string[];
	areaPoint?: [number, number];
	areaLabel?: string;
}

export interface ResultView extends Evidence {
	title: string;
	year: number;
	measure: 'seats' | 'votes' | 'percent';
	parts: { party?: string; label: string; value: number; bloc?: string; candidate?: string }[];
	note?: string;
}

export interface UnitView extends Evidence {
	id: string;
	name: string;
	kind: 'region' | 'state' | 'territory' | 'zone';
	lgas: string[];
	label?: [number, number];
	seat?: PlaceRef;
	/** The peoples who dominated its politics, leading first. */
	groups: { id: string; name: string }[];
	text: string;
	leaders: LeaderView[];
	party?: string;
}

export interface EraView {
	id: string;
	name: string;
	status: ReviewStatus;
	from: number;
	to?: number;
	label: string;
	summary: Evidence & { text: string };
	federal: Evidence & { text: string; leaders: LeaderView[] };
	units: UnitView[];
	parties: PartyView[];
	coalitions: CoalitionView[];
	results: ResultView[];
	coups: CoupView[];
	sources: SourceView[];
	reviewNotes: string[];
}

export interface PoliticsView {
	eras: EraView[];
}
