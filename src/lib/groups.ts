import { getCollection, getEntries, getEntry, type CollectionEntry } from 'astro:content';
import lgaIndex from '../data/lgas.json';
import type { Evidence, GroupView, SourceView } from './types';

const lgaById = new Map(lgaIndex.map((lga) => [lga.id, lga]));

/**
 * Drafts never reach the public build. They show in `npm run dev`, or in a
 * private preview built with NIAJMAP_INCLUDE_DRAFTS=true.
 */
export const includeDrafts = import.meta.env.DEV || import.meta.env.NIAJMAP_INCLUDE_DRAFTS === 'true';

export function isVisible(status: CollectionEntry<'groups'>['data']['status']): boolean {
	return status === 'published' || includeDrafts;
}

type SourceRef = { id: string };

function citation(s: CollectionEntry<'sources'>['data']): string {
	const parts = [s.author, s.year ? `(${s.year})` : undefined, s.title, s.publisher].filter(Boolean);
	return parts.join('. ').replace(/\.\./g, '.');
}

export async function getGroupViews(): Promise<GroupView[]> {
	const entries = (await getCollection('groups', ({ data }) => isVisible(data.status))).sort((a, b) =>
		a.data.name.localeCompare(b.data.name),
	);
	return Promise.all(entries.map(toView));
}

async function toView(entry: CollectionEntry<'groups'>): Promise<GroupView> {
	const g = entry.data;
	const sources: SourceView[] = [];
	const numbers = new Map<string, number>();

	// Number sources in the order claims first cite them, like footnotes.
	async function evidence(claim: { sources: SourceRef[]; confidence: Evidence['confidence']; note?: string }) {
		const resolved = await getEntries(claim.sources as Parameters<typeof getEntries<'sources'>>[0]);
		const refs = resolved.map((s) => {
			let n = numbers.get(s.id);
			if (n === undefined) {
				n = sources.length + 1;
				numbers.set(s.id, n);
				sources.push({ n, id: s.id, citation: citation(s.data), url: s.data.url, checked: s.data.checked });
			}
			return n;
		});
		return { refs, confidence: claim.confidence, ...(claim.note ? { note: claim.note } : {}) };
	}

	function lga(id: string) {
		const found = lgaById.get(id);
		if (!found) throw new Error(`${entry.id}: unknown LGA ${id}`);
		return found;
	}

	const family = await getEntry(g.language.family);
	if (!family) throw new Error(`${entry.id}: unknown family ${g.language.family.id}`);

	const language = {
		name: g.language.name,
		iso639_3: g.language.iso639_3,
		glottocode: g.language.glottocode,
		family: { name: family.data.name, lineage: family.data.lineage },
		...(await evidence(g.language)),
	};
	const summary = { text: g.summary.text, ...(await evidence(g.summary)) };
	const ruler = g.ruler
		? { title: g.ruler.title, seat: g.ruler.seat ? lga(g.ruler.seat).name : undefined, ...(await evidence(g.ruler)) }
		: undefined;

	const areas = [];
	for (const a of g.areas) {
		const l = lga(a.lga);
		areas.push({ lga: l.id, name: l.name, state: l.state, presence: a.presence, ...(await evidence(a)) });
	}

	const communities = [];
	for (const c of g.communities) {
		const l = lga(c.lga);
		communities.push({
			name: c.name,
			lga: l.id,
			lgaName: l.name,
			state: l.state,
			point: (c.point ?? l.point) as [number, number],
			approximate: !c.point,
			villages: c.villages,
			...(await evidence(c)),
		});
	}

	return {
		id: entry.id,
		name: g.name,
		status: g.status,
		searchAliases: g.searchAliases,
		language,
		summary,
		ruler,
		areas,
		communities,
		sources,
		reviewNotes: g.reviewNotes,
	};
}
