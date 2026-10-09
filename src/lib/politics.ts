// Builds /data/politics.json for the Power view: each period's federal leaders
// and its regions (or zones), resolved to LGAs so the map can colour them by the
// peoples who dominated their politics.

import { getCollection, type CollectionEntry } from 'astro:content';
import { isVisible, makeCiter } from './groups';
import { labelPoint, lgasOf } from './polities';
import type { EraView, LeaderView, PoliticsView } from './types';

type Leader = CollectionEntry<'politics'>['data']['federal']['leaders'][number];

let cached: Promise<PoliticsView> | null = null;

export function getPolitics(): Promise<PoliticsView> {
	cached ??= build();
	return cached;
}

async function build(): Promise<PoliticsView> {
	const entries = (await getCollection('politics', ({ data }) => isVisible(data.status))).sort((a, b) => a.data.from - b.data.from);
	// Names of every group, published or not: a leader's people is named even before its profile is live.
	const names = new Map((await getCollection('groups')).map((g) => [g.id, g.data.name]));
	const nameOf = (id: string) => names.get(id) ?? id;

	const eras: EraView[] = [];
	for (const entry of entries) {
		const e = entry.data;
		const { sources, evidence } = makeCiter();
		const leader = async (l: Leader): Promise<LeaderView> => ({
			name: l.name,
			title: l.title,
			from: l.from,
			...(l.to ? { to: l.to } : {}),
			...(l.group ? { group: l.group.id } : {}),
			groupName: l.group ? nameOf(l.group.id) : l.groupLabel!,
			...(l.groupNote ? { groupNote: l.groupNote } : {}),
			...(l.home ? { home: l.home } : {}),
			...(l.party ? { party: l.party } : {}),
			...(await evidence(l)),
		});
		const units = [];
		for (const u of e.units) {
			const lgas = lgasOf(u.extent);
			units.push({
				id: u.id,
				name: u.name,
				kind: u.kind,
				lgas,
				label: labelPoint(lgas, []) ?? u.seat?.point,
				...(u.seat ? { seat: u.seat } : {}),
				groups: u.groups.map((g) => ({ id: g.id, name: nameOf(g.id) })),
				text: u.text,
				leaders: await Promise.all(u.leaders.map(leader)),
				...(u.party ? { party: u.party } : {}),
				...(await evidence(u)),
			});
		}
		const anchor = new Map(units.map((u) => [u.id, u.label ?? u.seat?.point]));
		const parties = [];
		for (const p of e.parties) {
			parties.push({
				id: p.id,
				name: p.name,
				short: p.short,
				slot: p.slot,
				peoples: p.peoples.map((g) => ({ id: g.id, name: nameOf(g.id) })),
				...(p.leader ? { leader: p.leader } : {}),
				text: p.text,
				...(await evidence(p)),
			});
		}
		const coalitions = [];
		for (const c of e.coalitions) {
			const [hub, ...rest] = c.between.map((id) => anchor.get(id));
			coalitions.push({
				id: c.id,
				name: c.name,
				kind: c.kind,
				from: c.from,
				...(c.to ? { to: c.to } : {}),
				parties: c.parties,
				between: c.between,
				links: hub ? rest.filter((p): p is [number, number] => Boolean(p)).map((p) => [hub, p] as [[number, number], [number, number]]) : [],
				text: c.text,
				...(await evidence(c)),
			});
		}
		const person = (p: { name: string; role?: string; group?: { id: string }; groupLabel?: string; groupNote?: string }) => ({
			name: p.name,
			...(p.role ? { role: p.role } : {}),
			...(p.group ? { group: p.group.id, groupName: nameOf(p.group.id) } : p.groupLabel ? { groupName: p.groupLabel } : {}),
			...(p.groupNote ? { groupNote: p.groupNote } : {}),
		});
		const coups = [];
		for (const c of e.coups) {
			coups.push({
				id: c.id,
				name: c.name,
				date: c.date,
				year: c.year,
				outcome: c.outcome,
				...(c.fell ? { fell: person(c.fell) } : {}),
				...(c.rose ? { rose: person(c.rose) } : {}),
				plotters: c.plotters.map(person),
				killed: c.killed.map(person),
				text: c.text,
				moments: c.moments,
				routes: c.routes,
				area: c.area ? lgasOf(c.area) : [],
				...(c.area ? { areaPoint: labelPoint(lgasOf(c.area), []) } : {}),
				...(c.areaLabel ? { areaLabel: c.areaLabel } : {}),
				...(await evidence(c)),
			});
		}
		const results = [];
		for (const r of e.results) {
			results.push({ title: r.title, year: r.year, measure: r.measure, parts: r.parts, ...(r.note ? { note: r.note } : {}), ...(await evidence(r)) });
		}
		eras.push({
			id: entry.id,
			name: e.name,
			status: e.status,
			from: e.from,
			...(e.to ? { to: e.to } : {}),
			label: e.label,
			summary: { text: e.summary.text, ...(await evidence(e.summary)) },
			federal: { text: e.federal.text, leaders: await Promise.all(e.federal.leaders.map(leader)), ...(await evidence(e.federal)) },
			units,
			parties,
			coalitions,
			results,
			coups,
			sources,
			reviewNotes: e.reviewNotes,
		});
	}
	return { eras };
}
