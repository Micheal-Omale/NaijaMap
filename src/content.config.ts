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
						villages: z.array(z.object({ name: z.string(), point: point.optional() })).default([]),
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

export const collections = { sources, families, groups, places };
