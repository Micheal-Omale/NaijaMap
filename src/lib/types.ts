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
