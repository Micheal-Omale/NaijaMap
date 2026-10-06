import { getCollection, getEntries, getEntry, type CollectionEntry } from 'astro:content';
import lgaIndex from '../data/lgas.json';
import type { Evidence, GroupView, PeopleView, PlaceView, SourceView } from './types';

const lgaById = new Map(lgaIndex.map((lga) => [lga.id, lga]));

/**
 * Drafts never reach the public build. They show in `npm run dev`, or in a
 * private preview built with NIAJMAP_INCLUDE_DRAFTS=true.
 */
export const includeDrafts = import.meta.env.DEV || import.meta.env.NIAJMAP_INCLUDE_DRAFTS === 'true';

export function isVisible(status: 'draft' | 'reviewed' | 'published'): boolean {
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
	const polities = (await getCollection('polities', ({ data }) => isVisible(data.status))).sort((a, b) => a.data.span.from - b.data.span.from);
	const views = await Promise.all(entries.map(toView));
	for (const v of views) {
		v.kingdoms = polities.filter((p) => p.data.peoples.some((r) => r.id === v.id)).map((p) => ({ id: p.id, name: p.data.name, peak: p.data.peak }));
	}
	return views;
}

/** Numbers sources in the order claims first cite them, like footnotes, for one profile or brief. */
export function makeCiter() {
	const sources: SourceView[] = [];
	const numbers = new Map<string, number>();
	async function evidence(claim: { sources: SourceRef[]; confidence: Evidence['confidence']; note?: string }): Promise<Evidence> {
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
	return { sources, evidence };
}

async function toView(entry: CollectionEntry<'groups'>): Promise<GroupView> {
	const g = entry.data;
	const { sources, evidence } = makeCiter();

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
		const point = (c.point ?? l.point) as [number, number];
		const markers = [{ lga: l.id, point }];
		for (const other of c.alsoIn) {
			// Mark the village nearest the middle of the community's villages in that LGA.
			const pts = c.villages.filter((v) => v.lga === other && v.point).map((v) => v.point as [number, number]);
			if (!pts.length) continue;
			const mid = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
			const near = pts.reduce((a, b) => ((a[0] - mid[0]) ** 2 + (a[1] - mid[1]) ** 2 <= (b[0] - mid[0]) ** 2 + (b[1] - mid[1]) ** 2 ? a : b));
			markers.push({ lga: other, point: near });
		}
		communities.push({
			name: c.name,
			lga: l.id,
			lgaName: l.name,
			state: l.state,
			point,
			approximate: !c.point,
			villages: c.villages,
			markers,
			alsoIn: c.alsoIn.map((id) => {
				const o = lga(id);
				return { lga: o.id, name: o.name, state: o.state };
			}),
			history: c.history ? { text: c.history.text, ...(await evidence(c.history)) } : undefined,
			livelihoods: c.livelihoods ? { text: c.livelihoods.text, ...(await evidence(c.livelihoods)) } : undefined,
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
		kingdoms: [],
	};
}

export async function getPlaceViews(): Promise<PlaceView[]> {
	const entries = await getCollection('places', ({ data }) => isVisible(data.status));
	const visibleGroups = new Set((await getCollection('groups', ({ data }) => isVisible(data.status))).map((g) => g.id));
	return Promise.all(
		entries.map(async (entry) => {
			const l = lgaById.get(entry.id);
			if (!l) throw new Error(`data/places/${entry.id}.json: the file name must be an LGA id from src/data/lgas.json`);
			const p = entry.data;
			const { sources, evidence } = makeCiter();
			const summary = { text: p.summary.text, ...(await evidence(p.summary)) };
			const peoples: PeopleView[] = [];
			for (const person of p.peoples) {
				peoples.push({
					name: person.name,
					// Only link to profiles that are visible on this build.
					group: person.group && visibleGroups.has(person.group.id) ? person.group.id : undefined,
					standing: person.standing,
					share: person.share,
					languages: person.languages,
					...(await evidence(person)),
				});
			}
			const languageUse = p.languageUse ? { text: p.languageUse.text, ...(await evidence(p.languageUse)) } : undefined;
			const history = p.history ? { text: p.history.text, ...(await evidence(p.history)) } : undefined;
			const livelihoods = p.livelihoods ? { text: p.livelihoods.text, ...(await evidence(p.livelihoods)) } : undefined;
			return { lga: l.id, name: l.name, state: l.state, status: p.status, summary, peoples, languageUse, history, livelihoods, sources };
		}),
	);
}
