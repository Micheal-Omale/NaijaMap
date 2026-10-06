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
export type LinkKind = 'tribute' | 'trade' | 'war' | 'ritual';

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
	links: { kind: LinkKind; to: PlaceRef; label?: string }[];
	/** Confidence of each drawn layer, when it is drawn. */
	core?: Confidence;
	influence?: Confidence;
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

export interface History {
	polities: PolityView[];
	/**
	 * Dissolved territory per snapshot. Properties: key (`<polity>|<snapshot index>`),
	 * p (polity id), layer (core or influence), conf, color, network (true for Nri and Aro).
	 */
	shapes: GeoJSON.FeatureCollection;
}
