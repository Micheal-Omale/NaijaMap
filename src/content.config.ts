// The data model. Every claim the site makes carries at least one source and a
// confidence level, and nothing reaches the public build until its status is
// `published` (see src/lib/groups.ts). A bad reference fails the build.

import { defineCollection, reference } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import lgaIndex from './data/lgas.json';

const lgaIds = lgaIndex.map((lga) => lga.id) as [string, ...string[]];
const lga = z.enum(lgaIds);
/** [longitude, latitude], inside Nigeria. */
const point = z.tuple([z.number().min(2.6).max(14.7), z.number().min(4.2).max(13.9)]);

/** high: well attested. medium: one source, approximate, or not yet checked directly. disputed: sources disagree. */
const confidence = z.enum(['high', 'medium', 'disputed']);

/** Attached to every claim. */
const evidence = {
	sources: z.array(reference('sources')).min(1),
	confidence,
	note: z.string().optional(),
};

const sources = defineCollection({
	loader: file('data/sources.json'),
	schema: z.object({
		title: z.string(),
		author: z.string().optional(),
		year: z.number().int().optional(),
		publisher: z.string().optional(),
		url: z.url().optional(),
		/** testimony: a first hand account (for example the owner's local knowledge), recorded as such. */
		kind: z.enum(['book', 'article', 'dataset', 'reference', 'news', 'web', 'testimony']),
		licence: z.string().optional(),
		accessed: z.iso.date().optional(),
		/** false when the compiler has only seen this source cited elsewhere. */
		checked: z.boolean(),
	}),
});

const families = defineCollection({
	loader: file('data/families.json'),
	schema: z.object({
		name: z.string(),
		/** Broadest first, ending with this family. */
		lineage: z.array(z.string()).min(1),
		...evidence,
	}),
});

const groups = defineCollection({
	loader: glob({ pattern: '*.json', base: 'data/groups' }),
	schema: z
		.object({
			name: z.string(),
			/** draft: compiled, not checked. reviewed: owner checked. published: live on the public site. */
			status: z.enum(['draft', 'reviewed', 'published']),
			/** Other spellings people type. Search help only, not a claim. */
			searchAliases: z.array(z.string()).default([]),
			language: z.object({
				name: z.string(),
				iso639_3: z.string().length(3).optional(),
				glottocode: z.string().optional(),
				family: reference('families'),
				...evidence,
			}),
			summary: z.object({ text: z.string(), ...evidence }),
			ruler: z.object({ title: z.string(), seat: lga.optional(), ...evidence }).optional(),
			areas: z
				.array(
					z.object({
						lga,
						/** core: homeland, the group is the majority. significant: a large share of a mixed LGA. minority: present but small. */
						presence: z.enum(['core', 'significant', 'minority']),
						...evidence,
					}),
				)
				.min(1),
			/** Named communities where the group's language is spoken, mainly outside the homeland LGAs. */
			communities: z
				.array(
					z.object({
						name: z.string(),
						lga,
						/** [longitude, latitude]. Leave out when unknown; the map then places it approximately inside its LGA. */
						point: point.optional(),
						/** Villages or quarters that make up the community, each drawn as its own point when located. */
						villages: z
							.array(
								z.object({
									name: z.string(),
									point: point.optional(),
									/** Set when the village lies in one of `alsoIn` rather than the community's own LGA. */
									lga: lga.optional(),
								}),
							)
							.default([]),
						/** Other LGAs the community spreads into, beyond its main LGA. */
						alsoIn: z.array(lga).default([]),
						history: z.object({ text: z.string(), ...evidence }).optional(),
						livelihoods: z.object({ text: z.string(), ...evidence }).optional(),
						...evidence,
					}),
				)
				.default([]),
			reviewNotes: z.array(z.string()).default([]),
		})
		.refine((g) => new Set(g.areas.map((a) => a.lga)).size === g.areas.length, {
			message: 'An LGA is listed twice in areas',
		}),
});

/**
 * A short brief about who lives in one LGA: its peoples, whether each is
 * indigenous or settled, their rough share, and the languages they speak.
 * The file name is the LGA id, for example data/places/kogi-lokoja.json.
 */
const places = defineCollection({
	loader: glob({ pattern: '*.json', base: 'data/places' }),
	schema: z.object({
		status: z.enum(['draft', 'reviewed', 'published']),
		summary: z.object({ text: z.string(), ...evidence }),
		peoples: z
			.array(
				z.object({
					name: z.string(),
					/** Links to the group's profile when one exists. */
					group: reference('groups').optional(),
					/** indigenous: native to the area. settled: arrived later (traders, migrants). Leave out when sources do not say. */
					standing: z.enum(['indigenous', 'settled']).optional(),
					share: z.enum(['majority', 'large', 'minority']).optional(),
					/** Mother tongue first, then other languages commonly spoken. Two or more means bilingual. */
					languages: z.array(z.string()).min(1),
					...evidence,
				}),
			)
			.min(1),
		/** How languages are used across the area: lingua francas, multilingualism. */
		languageUse: z.object({ text: z.string(), ...evidence }).optional(),
		/** Why the place matters historically: founding, kingdoms, events. */
		history: z.object({ text: z.string(), ...evidence }).optional(),
		/** What people mainly do for a living: farming, fishing, trade, crafts, industry. */
		livelihoods: z.object({ text: z.string(), ...evidence }).optional(),
	}),
});

const stateIds = [...new Set(lgaIndex.map((l) => l.stateId))] as [string, ...string[]];
/** [longitude, latitude] anywhere a polity on the timeline reached, from the Volta to Darfur and the Fezzan. */
const wide = z.tuple([z.number().min(-3).max(25), z.number().min(0).max(30)]);
const year = z.number().int().min(800).max(1960);

/**
 * Land inside Nigeria, by today's units, drawn to the nearest LGA: whole
 * states, plus single LGAs, minus `except`. `beyond` adds rough rings outside
 * Nigeria (clipped at the border when drawn), for land in today's neighbours.
 */
const extent = z.object({
	states: z.array(z.enum(stateIds)).default([]),
	lgas: z.array(lga).default([]),
	except: z.array(lga).default([]),
	beyond: z.array(z.array(wide).min(3)).default([]),
	/** Set when this layer is less sure than the snapshot as a whole (a claimed tributary, a disputed reach). */
	confidence: confidence.optional(),
});

const place = z.object({ name: z.string(), point: wide });

/**
 * A precolonial state on the timeline: a kingdom, empire, confederacy,
 * city state or ritual network. Each snapshot is the polity as it stood from
 * its `year` until the next snapshot (or the end of `span`).
 */
const polities = defineCollection({
	loader: glob({ pattern: '*.json', base: 'data/polities' }),
	schema: z
		.object({
			name: z.string(),
			status: z.enum(['draft', 'reviewed', 'published']),
			/** network: ritual or trade reach rather than ruled land (Nri, Aro), drawn differently. */
			kind: z.enum(['empire', 'kingdom', 'caliphate', 'confederacy', 'city-state', 'network']),
			otherNames: z.array(z.string()).default([]),
			/** First and last year on the timeline. Early dates are approximate. */
			span: z.object({ from: year, to: year, fromLabel: z.string().optional(), toLabel: z.string().optional(), ...evidence }),
			/** The year shown when the polity is opened from a people's profile: its height. */
			peak: year,
			summary: z.object({ text: z.string(), ...evidence }),
			ruler: z.object({ title: z.string(), ...evidence }).optional(),
			/** Peoples whose kingdom this was, for the link from their profile. */
			peoples: z.array(reference('groups')).default([]),
			snapshots: z
				.array(
					z.object({
						year,
						/** Shown when the year is not exact, for example "c. 1450". */
						yearLabel: z.string().optional(),
						title: z.string(),
						text: z.string(),
						capital: place.optional(),
						/** Land under direct rule. */
						core: extent.optional(),
						/** Tributaries, vassals and land under looser control. */
						influence: extent.optional(),
						/** Named places of a network polity, or key towns. */
						nodes: z.array(place).default([]),
						/** Lines from the capital: tribute paid to it, trade routes, wars fought, ritual reach. */
						links: z
							.array(
								z.object({
									kind: z.enum(['tribute', 'trade', 'war', 'ritual']),
									to: place,
									label: z.string().optional(),
								}),
							)
							.default([]),
						...evidence,
					}),
				)
				.min(1),
			/** What remains today: the traditional ruler and seat that carry the name on. */
			today: z.object({ text: z.string(), title: z.string().optional(), seat: place.optional(), ...evidence }),
			reviewNotes: z.array(z.string()).default([]),
		})
		.refine((p) => p.snapshots.every((s, i) => i === 0 || s.year > p.snapshots[i - 1].year), {
			message: 'Snapshots must be in year order, one per year',
		})
		.refine((p) => p.snapshots[0].year === p.span.from && p.snapshots.every((s) => s.year <= p.span.to), {
			message: 'The first snapshot starts the span, and none falls after its end',
		}),
});

export const collections = { sources, families, groups, places, polities };
