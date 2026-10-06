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
