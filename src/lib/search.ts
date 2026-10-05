// Group search that forgives near misses ("Igalla", "igla", "Ìgálà").
// Small on purpose: a few hundred names at most, so no index or library.

export interface Searchable {
	id: string;
	name: string;
	searchAliases: string[];
}

export interface SearchHit<T> {
	item: T;
	/** The name or alias that matched. */
	matched: string;
	/** Lower is better. 0 exact, 1 prefix, 2 contains, 3+ spelling distance. */
	score: number;
}

/** Lowercase, strip tone marks and dots under letters, keep letters and digits only. */
export function normalize(text: string): string {
	return text
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '');
}

/** Optimal string alignment distance (Levenshtein plus swapped neighbours). */
function distance(a: string, b: string, limit: number): number {
	if (Math.abs(a.length - b.length) > limit) return limit + 1;
	const rows: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
	for (let j = 1; j <= b.length; j++) rows[0][j] = j;
	for (let i = 1; i <= a.length; i++) {
		let rowMin = Infinity;
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			let d = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
				d = Math.min(d, rows[i - 2][j - 2] + 1);
			}
			rows[i][j] = d;
			rowMin = Math.min(rowMin, d);
		}
		if (rowMin > limit) return limit + 1;
	}
	return rows[a.length][b.length];
}

function scoreOne(query: string, candidate: string): number | undefined {
	if (candidate === query) return 0;
	if (candidate.startsWith(query)) return 1;
	if (query.length >= 3 && candidate.includes(query)) return 2;
	// Allow about one slip per four letters, compared against a same length prefix
	// too, so a half typed misspelling ("igla") still finds "igala".
	const limit = Math.max(1, Math.floor(query.length / 4));
	if (query.length < 3) return undefined;
	const whole = distance(query, candidate, limit);
	const prefix = distance(query, candidate.slice(0, query.length + 1), limit);
	const d = Math.min(whole, prefix);
	return d <= limit ? 3 + d : undefined;
}

export function search<T extends Searchable>(items: T[], rawQuery: string, max = 6): SearchHit<T>[] {
	const query = normalize(rawQuery);
	if (!query) return [];
	const hits: SearchHit<T>[] = [];
	for (const item of items) {
		let best: SearchHit<T> | undefined;
		for (const name of [item.name, ...item.searchAliases]) {
			const score = scoreOne(query, normalize(name));
			if (score !== undefined && (!best || score < best.score)) best = { item, matched: name, score };
		}
		if (best) hits.push(best);
	}
	return hits.sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name)).slice(0, max);
}
