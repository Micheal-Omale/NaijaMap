// Helpers for the reading pages: addresses, descriptions and schema.org data, so
// search engines and AI answers can find, read and cite each people, kingdom and event.

import type { SourceView } from './types';

export const SITE_URL = 'https://histonaija.logfolio.pro';

export const paths = {
	peoples: '/peoples',
	people: (id: string) => `/peoples/${id}`,
	kingdoms: '/kingdoms',
	kingdom: (id: string) => `/kingdoms/${id}`,
	events: '/events',
	event: (id: string) => `/events/${id}`,
	states: '/states',
	state: (id: string) => `/states/${id}`,
	about: '/about',
	privacy: '/privacy',
};

/** The map views the reading pages open. */
export const mapLinks = {
	people: (id: string) => `/?group=${encodeURIComponent(id)}`,
	kingdom: (id: string, year: number) => `/?mode=then&year=${year}&polity=${encodeURIComponent(id)}`,
	event: (id: string, year: number) => `/?mode=then&year=${year}&event=${encodeURIComponent(id)}`,
};

export const absolute = (path: string) => new URL(path, SITE_URL).href;

/** JSON for a <script type="application/ld+json">, safe to inline in HTML. */
export function jsonLd(data: object | object[]): string {
	return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** Cuts text to about `max` characters on a word boundary, for meta descriptions. */
export function clip(text: string, max = 158): string {
	const flat = text.replace(/\s+/g, ' ').trim();
	if (flat.length <= max) return flat;
	const cut = flat.slice(0, max - 1);
	return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.\s]+$/, '')}…`;
}

/** The first sentence, or the first `max` characters. */
export function firstSentence(text: string, max = 220): string {
	const m = text.match(/^.+?[.!?](?=\s+[A-Z“‘"(]|$)/);
	return clip(m ? m[0] : text, max);
}

/** "a", "a and b", "a, b and c". */
export function joinList(items: string[], and = 'and'): string {
	if (items.length <= 1) return items.join('');
	return `${items.slice(0, -1).join(', ')} ${and} ${items.at(-1)}`;
}

/** "Kogi State", but "the Federal Capital Territory". */
export function stateName(state: string): string {
	return state === 'Federal Capital Territory' ? `the ${state}` : `${state} State`;
}

/** "an Idomoid", "a Chadic". */
export function withArticle(word: string): string {
	return `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`;
}

/** The states of a people's homeland, the one with the most LGAs first. */
export function homeStates(areas: { state: string }[]): string[] {
	const counts = new Map<string, number>();
	for (const a of areas) counts.set(a.state, (counts.get(a.state) ?? 0) + 1);
	return [...counts].sort((a, b) => b[1] - a[1]).map(([state]) => state);
}

/** "Benue State", "Delta and Edo States", "Niger State and the Federal Capital Territory". */
export function statesText(states: string[], and = 'and'): string {
	if (states.length === 2 && !states.includes('Federal Capital Territory')) return `${states[0]} ${and} ${states[1]} States`;
	return joinList(states.map(stateName), and);
}

/** An event's dates for its title: "1877–1886" from its label, or its first year. */
export function eventYears(e: { year: number; yearLabel?: string }): string {
	return e.yearLabel && /^(c\. )?\d{3,4}(–\d{2,4})?$/.test(e.yearLabel) ? e.yearLabel : yearText(e.year);
}

/** LGAs grouped by state, in first-seen order. */
export function byState<T extends { state: string }>(areas: T[]): { state: string; areas: T[] }[] {
	const groups = new Map<string, T[]>();
	for (const a of areas) groups.set(a.state, [...(groups.get(a.state) ?? []), a]);
	return [...groups].map(([state, list]) => ({ state, areas: list }));
}

/** "Idah and Ofu in Kogi State", or, for many LGAs, "Kano, Jigawa and Katsina States". */
export function placesText(areas: { name: string; state: string }[], and = 'and'): string {
	const states = byState(areas);
	if (areas.length <= 6) return joinList(states.map((s) => `${joinList(s.areas.map((a) => a.name), and)} in ${stateName(s.state)}`), and);
	if (states.length === 1) return stateName(states[0].state);
	const fct = states.find((s) => s.state === 'Federal Capital Territory');
	const named = states.filter((s) => s !== fct).map((s) => s.state);
	return joinList([`${joinList(named, and)} ${named.length > 1 ? 'States' : 'State'}`, ...(fct ? ['the Federal Capital Territory'] : [])], and);
}

/** A year as written on the page: 1750, or 600 BCE. */
export function yearText(year: number): string {
	return year < 0 ? `${-year} BCE` : String(year);
}

export function breadcrumbs(items: { name: string; path: string }[]) {
	return {
		'@type': 'BreadcrumbList',
		itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: absolute(item.path) })),
	};
}

export const publisher = {
	'@type': 'Organization',
	name: 'HistoNaija',
	url: SITE_URL,
	logo: absolute('/icons/icon-512.png'),
};

export const dataLicence = 'https://creativecommons.org/licenses/by-sa/4.0/';

/** A reading page as an Article, with its sources as citations. */
export function article(o: { path: string; headline: string; description: string; about: object; sources: SourceView[]; image?: string }) {
	return {
		'@context': 'https://schema.org',
		'@type': 'Article',
		headline: o.headline.slice(0, 110),
		description: o.description,
		url: absolute(o.path),
		mainEntityOfPage: absolute(o.path),
		image: absolute(o.image ?? '/og/atlas.png'),
		inLanguage: 'en',
		isAccessibleForFree: true,
		license: dataLicence,
		author: publisher,
		publisher,
		isPartOf: { '@type': 'WebSite', name: 'HistoNaija', url: SITE_URL },
		about: o.about,
		citation: o.sources.map((s) => (s.url ? { '@type': 'CreativeWork', name: s.citation, url: s.url } : s.citation)),
	};
}
