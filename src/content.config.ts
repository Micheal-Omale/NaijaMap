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
const year = z.number().int().min(800).max(1970);

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
			/** The name written on the map, when the full name is long (Igala for Igala Kingdom). */
			shortName: z.string().optional(),
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
						/** Land an army marched into or fought over, without holding it (the Igala invasion of Benin, 1515). */
						campaign: extent.optional(),
						/** Named places of a network polity, or key towns. */
						nodes: z.array(place).default([]),
						/** Lines from the capital: tribute paid to it, trade routes, wars fought, ritual reach. */
						links: z
							.array(
								z.object({
									/** descent: a town or people whose traditions trace their founders to this polity. */
									kind: z.enum(['tribute', 'trade', 'war', 'ritual', 'descent']),
									to: place,
									label: z.string().optional(),
									/** What the link rests on, when it is a tradition or less sure than the snapshot. */
									note: z.string().optional(),
									confidence: confidence.optional(),
									sources: z.array(reference('sources')).default([]),
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

/**
 * Something that happened between states, or to one, on the history timeline:
 * a war, a raid, an alliance, a migration, a colonial conquest, or the
 * partition of a kingdom's lands among colonial provinces. Drawn with its own
 * routes (lines of march, migrations, exiles) and marked moments (an ambush, a
 * bombardment, a burning), each explained when hovered or tapped.
 */
const events = defineCollection({
	loader: glob({ pattern: '*.json', base: 'data/events' }),
	schema: z
		.object({
			name: z.string(),
			status: z.enum(['draft', 'reviewed', 'published']),
			/** colonial: an attack by British forces. partition: a kingdom's lands divided among colonial provinces. */
			kind: z.enum(['war', 'raid', 'alliance', 'migration', 'colonial', 'partition', 'contact']),
			year,
			yearLabel: z.string().optional(),
			/** Last year the event stays on the map. Left out, it lasts a generation (to the timeline's end for a partition). */
			until: year.optional(),
			/** Who took part. `polity` links to the state on the timeline, for its ink and its story. */
			actors: z
				.array(
					z.object({
						name: z.string(),
						polity: reference('polities').optional(),
						side: z.enum(['attacker', 'defender', 'ally', 'migrant', 'origin', 'colonial', 'resister', 'european', 'trader']),
						/** A fixed ink for an actor with no polity on the timeline (Biafra, the Federal army), so it keeps its colour from one event to the next. */
						ink: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
					}),
				)
				.min(1),
			summary: z.object({ text: z.string(), ...evidence }),
			/** Lines on the map: a march, a raid, a migration, an exile, loot carried off, the bond between allies, or a ship's voyage. */
			routes: z
				.array(
					z.object({
						kind: z.enum(['advance', 'retreat', 'raid', 'migration', 'exile', 'loot', 'alliance', 'voyage']),
						/** For a voyage: the ship drawn sailing it. Sail by default. */
						vessel: z.enum(['sail', 'steam']).optional(),
						/** Waypoints, first to last. Two points are joined by a gentle arc; more by a smooth curve. */
						path: z.array(wide).min(2),
						label: z.string(),
						/** The actor (by name) whose line this is: it takes their ink. */
						by: z.string().optional(),
						when: z.string().optional(),
						note: z.string().optional(),
						confidence: confidence.optional(),
						sources: z.array(reference('sources')).default([]),
					}),
				)
				.default([]),
			/** Dated moments, in order: each is marked on the map and told in the event's chronology. */
			moments: z
				.array(
					z.object({
						when: z.string(),
						title: z.string(),
						text: z.string(),
						at: place.optional(),
						mark: z.enum(['battle', 'massacre', 'bombarded', 'burned', 'captured', 'founded', 'treaty', 'camp', 'garrison', 'exile', 'flight', 'loot', 'shrine', 'anchor']),
						confidence: confidence.optional(),
						sources: z.array(reference('sources')).default([]),
					}),
				)
				.default([]),
			/** Land fought over or raided, cross-hatched like a battle map. */
			area: extent.optional(),
			/** For a partition: where each part of the kingdom's lands went. */
			pieces: z.array(z.object({ name: z.string(), extent, note: z.string().optional() })).default([]),
			...evidence,
			reviewNotes: z.array(z.string()).default([]),
		})
		.refine((e) => e.until === undefined || e.until >= e.year, { message: 'An event cannot end before it starts' })
		.refine((e) => e.kind !== 'partition' || e.pieces.length >= 2, { message: 'A partition needs at least two pieces' }),
});

/**
 * A people who governed themselves in the land between the mapped states: by
 * lineage elders, village assemblies, many small chiefs, or kingdoms too small
 * for the timeline. Written on the old map in the gaps, so open land never
 * reads as empty. Each `lands` entry is where the people lived for a stretch of
 * years, by today's LGAs; its name is written at the most central of them.
 */
const societies = defineCollection({
	loader: glob({ pattern: '*.json', base: 'data/societies' }),
	schema: z
		.object({
			name: z.string(),
			status: z.enum(['draft', 'reviewed', 'published']),
			/** The peoples' profiles on the atlas, for the jump from the old map. */
			groups: z.array(reference('groups')).default([]),
			/**
			 * elders: kin groups led by their eldest men, nobody above them. assemblies: village
			 * councils, assemblies, age grades and title societies. chiefdoms: many small chiefs or
			 * priest-chiefs, none over the rest. kingdoms: kings, but too small or local for the timeline.
			 * villages: independent communities, when the sources do not say how they were run.
			 */
			rule: z.enum(['elders', 'assemblies', 'chiefdoms', 'kingdoms', 'villages']),
			/** First and last year on the map. The first is often "before written records", not a founding. */
			span: z.object({ from: year, to: year, fromLabel: z.string().optional(), toLabel: z.string().optional(), ...evidence }),
			/** How they governed themselves. */
			summary: z.object({ text: z.string(), ...evidence }),
			/** How independent rule ended, or who pressed on it (jihad, raids, British conquest). */
			end: z.object({ text: z.string(), ...evidence }).optional(),
			lands: z
				.array(
					z.object({
						from: year,
						/** Left out: to the end of the span. */
						to: year.optional(),
						lgas: z.array(lga).min(1),
						/** A label for this place when it differs from the society's name (Igbo: "Ezza, Izzi, Ikwo"). */
						label: z.string().optional(),
						confidence: confidence.optional(),
						note: z.string().optional(),
					}),
				)
				.min(1),
			reviewNotes: z.array(z.string()).default([]),
		})
		.refine((s) => s.lands.every((l) => l.from >= s.span.from && l.from <= s.span.to && (l.to === undefined || (l.to >= l.from && l.to <= s.span.to))), {
			message: 'Every land lies inside the span, and ends after it starts',
		}),
});

/**
 * A town on the history map whose founding or allegiance matters: one founded
 * by several peoples (Illah: Igbo, Igala and Benin quarters), or one held by a
 * state for a time (Agenebode: Igala land, then a Benin garrison). Each founder
 * names where they came from, so the map can draw the thread back.
 */
const towns = defineCollection({
	loader: glob({ pattern: '*.json', base: 'data/towns' }),
	schema: z.object({
		name: z.string(),
		status: z.enum(['draft', 'reviewed', 'published']),
		otherNames: z.array(z.string()).default([]),
		point: wide,
		/** When the town first appears on the map: its founding, as tradition or records date it. */
		founded: z.object({ year, yearLabel: z.string().optional(), ...evidence }),
		summary: z.object({ text: z.string(), ...evidence }),
		founders: z
			.array(
				z.object({
					/** The people the founders came from, as the town remembers them. */
					people: z.string(),
					group: reference('groups').optional(),
					/** The state they came from, for its ink. */
					polity: reference('polities').optional(),
					/** Where they came from. */
					from: place.optional(),
					/** The quarters or villages they founded. */
					quarters: z.array(z.string()).default([]),
					text: z.string(),
					...evidence,
				}),
			)
			.min(1),
		/** States the town was under, and how. */
		under: z
			.array(
				z.object({
					polity: reference('polities'),
					from: year,
					to: year,
					/** ruled: part of the state. tribute: paid it. garrison: held as a military post. crowned: its rulers were installed by the state. */
					kind: z.enum(['ruled', 'tribute', 'garrison', 'crowned']),
					text: z.string(),
					...evidence,
				}),
			)
			.default([]),
		reviewNotes: z.array(z.string()).default([]),
	}),
});

/**
 * A throne the colonial government made: a new one where a people had none
 * (the Tor Tiv, 1946), an old one restored (the Oba of Benin, 1914), a king the
 * British chose (Sultan Attahiru II, 1903), or rulers set over a people from
 * outside (Zaria's rulers over the Atyap, 1912).
 */
const thrones = defineCollection({
	loader: glob({ pattern: '*.json', base: 'data/thrones' }),
	schema: z.object({
		title: z.string(),
		status: z.enum(['draft', 'reviewed', 'published']),
		/**
		 * created: new, with no precedent. restored: revived after a break. installed: the British chose
		 * the king. imposed: rulers set over a people from outside. retitled: an old throne given a new
		 * rank or name. warrant: a warrant chief, district head or political agent the British appointed.
		 */
		kind: z.enum(['created', 'restored', 'installed', 'imposed', 'retitled', 'warrant']),
		year,
		yearLabel: z.string().optional(),
		/** Left out while the throne still stands. */
		until: year.optional(),
		seat: place,
		/** Who made it: the British administration, the Royal Niger Company, Lugard. */
		by: z.string(),
		/** The first holder, or the king installed. */
		first: z.string().optional(),
		/** Who crowned or installed the holder, and where: the Attah Igala at Idah, a British Resident. */
		crowned: z.object({ by: z.string(), at: place.optional(), text: z.string(), ...evidence }).optional(),
		groups: z.array(reference('groups')).default([]),
		polity: reference('polities').optional(),
		text: z.string(),
		...evidence,
		reviewNotes: z.array(z.string()).default([]),
	}),
});

/**
 * How a state (or a people who ruled themselves) made war, for the Versus page:
 * its home ground, the arms it fielded and when, and the wars it actually won
 * or lost. The file id is the polity's id, or the society's. The page weighs
 * these with the land each side held to guess who would likely win; it is a
 * what-if, and every input it uses is a sourced claim here.
 */
const forces = defineCollection({
	loader: glob({ pattern: '*.json', base: 'data/forces' }),
	schema: z.object({
		status: z.enum(['draft', 'reviewed', 'published']),
		/** polity: the id is a polity's. society: the id is a society's. */
		of: z.enum(['polity', 'society']),
		/** Where its armies were at home. Horses die in the forest (tsetse); war canoes rule the creeks. */
		terrain: z.enum(['sahel', 'savanna', 'river', 'forest', 'delta']),
		summary: z.object({ text: z.string(), ...evidence }),
		/**
		 * What it fought with, from `from` to `to` (left out: to the end). level: 1 some, 2 a real strength, 3 famous for it.
		 * cavalry: horsemen. archers: bowmen as a main arm. firearms: guns and cannon. canoes: war canoes and river fleets.
		 * standing: a professional or regimented army. walls: walled towns, moats, earthworks. allies: tributaries,
		 * mercenaries or allied levies it could call. ritual: an oracle or sacred awe that kept enemies away.
		 * militia: every grown man of the village armed, as in the self-governing peoples.
		 */
		arms: z
			.array(
				z.object({
					kind: z.enum(['cavalry', 'archers', 'firearms', 'canoes', 'standing', 'walls', 'allies', 'ritual', 'militia']),
					level: z.number().int().min(1).max(3),
					from: year.optional(),
					to: year.optional(),
					text: z.string(),
					...evidence,
				}),
			)
			.min(1),
		/** Wars it actually fought: the record the page sets beside its guess. `polity` names the enemy when it is on the timeline. */
		record: z
			.array(
				z.object({
					year,
					yearLabel: z.string().optional(),
					against: z.string(),
					polity: reference('polities').optional(),
					/** won, lost, held (beat off an attack), or stalemate. */
					result: z.enum(['won', 'lost', 'held', 'stalemate']),
					text: z.string(),
					event: reference('events').optional(),
					...evidence,
				}),
			)
			.default([]),
		reviewNotes: z.array(z.string()).default([]),
	}),
});

/** One office holder: who, which office, when, and the people they came from. */
const leader = z
	.object({
		name: z.string(),
		title: z.string(),
		from: z.number().int(),
		/** Left out while still in office. */
		to: z.number().int().optional(),
		/** The people the leader came from, when it has a profile. */
		group: reference('groups').optional(),
		/** The people's name when it has no profile yet (Gere). */
		groupLabel: z.string().optional(),
		/** Other accounts of the leader's origins, when sources disagree. */
		groupNote: z.string().optional(),
		/** Hometown, pinned on the map. */
		home: place.optional(),
		/** The party they led or ran for, by its id in the period's `parties`. */
		party: z.string().optional(),
		...evidence,
	})
	.refine((l) => l.group || l.groupLabel, { message: 'A leader needs a group or a groupLabel' });

/**
 * A political party within one period. `slot` picks its colour from the
 * validated eight-hue party palette (see global.css), so a party keeps the same
 * colour wherever it appears, and a successor can carry on its forerunner's.
 */
const party = z.object({
	id: z.string(),
	name: z.string(),
	short: z.string(),
	slot: z.number().int().min(1).max(8),
	/** The peoples its vote and leadership came from, leading first. */
	peoples: z.array(reference('groups')).default([]),
	leader: z.string().optional(),
	text: z.string(),
	...evidence,
});

/**
 * Parties working together across regions: a coalition government, an
 * electoral alliance, or a merger. Drawn on the map as a rail from the first
 * unit (its hub) to each of the others.
 */
const coalition = z.object({
	id: z.string(),
	name: z.string(),
	kind: z.enum(['coalition', 'alliance', 'merger']),
	from: z.number().int(),
	to: z.number().int().optional(),
	parties: z.array(z.string()).min(2),
	/** Unit ids: the hub first, then the units it links to. */
	between: z.array(z.string()).min(2),
	text: z.string(),
	...evidence,
});

/** A person in a coup story: a plotter, a victim, the leader who fell or rose. */
const coupPerson = z.object({
	name: z.string(),
	role: z.string().optional(),
	group: reference('groups').optional(),
	groupLabel: z.string().optional(),
	groupNote: z.string().optional(),
});

/**
 * A coup or coup attempt: who fell and who rose, who struck and who died, and
 * its moments in order, stamped on the map with the Then view's marks.
 */
const coup = z.object({
	id: z.string(),
	name: z.string(),
	date: z.string(),
	year: z.number().int(),
	/** seized: took power by force. bloodless: took power without a fight. failed: crushed. */
	outcome: z.enum(['seized', 'bloodless', 'failed']),
	fell: coupPerson.optional(),
	rose: coupPerson.optional(),
	plotters: z.array(coupPerson).default([]),
	killed: z.array(coupPerson).default([]),
	text: z.string(),
	moments: z
		.array(
			z.object({
				when: z.string(),
				title: z.string(),
				text: z.string(),
				at: place.optional(),
				mark: z.enum(['battle', 'massacre', 'bombarded', 'burned', 'captured', 'founded', 'treaty', 'camp', 'garrison', 'exile', 'flight', 'loot', 'shrine']),
			}),
		)
		.default([]),
	/** Lines on the map: a flight, an escape. */
	routes: z.array(z.object({ path: z.array(wide).min(2), label: z.string() })).default([]),
	/** Land the coup named, cross-hatched (the five states Orkar's broadcast "excised"). */
	area: extent.optional(),
	areaLabel: z.string().optional(),
	...evidence,
});

/** One election's result, as seats or votes, for the period's result bars. */
const result = z.object({
	title: z.string(),
	year: z.number().int(),
	measure: z.enum(['seats', 'votes', 'percent']),
	parts: z
		.array(
			z.object({
				/** A party id; left out for "other parties", drawn neutral. */
				party: z.string().optional(),
				label: z.string(),
				value: z.number().min(0),
				/** The alliance this share belonged to, bracketed above the bar. */
				bloc: z.string().optional(),
				/** The winning candidate or leader, for presidential votes. */
				candidate: z.string().optional(),
			}),
		)
		.min(1),
	...evidence,
});

/**
 * A period of Nigerian politics: who held power at the centre and in each
 * region (or, since the 1990s, each geopolitical zone), and the peoples who
 * dominated it. Hausa and Fulani are always kept apart.
 */
const politics = defineCollection({
	loader: glob({ pattern: '*.json', base: 'data/politics' }),
	schema: z
		.object({
			name: z.string(),
			status: z.enum(['draft', 'reviewed', 'published']),
			from: z.number().int().min(1900).max(2100),
			/** Left out for the period running today. */
			to: z.number().int().min(1900).max(2100).optional(),
			label: z.string(),
			summary: z.object({ text: z.string(), ...evidence }),
			federal: z.object({ text: z.string(), leaders: z.array(leader).min(1), ...evidence }),
			units: z
				.array(
					z.object({
						id: z.string(),
						name: z.string(),
						kind: z.enum(['region', 'state', 'territory', 'zone']),
						extent,
						seat: place.optional(),
						/** The peoples who dominated its politics, leading first. */
						groups: z.array(reference('groups')).min(1),
						text: z.string(),
						leaders: z.array(leader).default([]),
						/** The party that held it, by id in `parties`. */
						party: z.string().optional(),
						...evidence,
					}),
				)
				.default([]),
			parties: z.array(party).default([]),
			coalitions: z.array(coalition).default([]),
			results: z.array(result).default([]),
			coups: z.array(coup).default([]),
			reviewNotes: z.array(z.string()).default([]),
		})
		.refine((e) => e.to === undefined || e.to >= e.from, { message: 'A period cannot end before it starts' })
		.superRefine((e, ctx) => {
			const units_ = e.units ?? [];
			const parties = new Set((e.parties ?? []).map((p) => p.id));
			const units = new Set(units_.map((u) => u.id));
			const bad = (what: string) => ctx.addIssue({ code: 'custom', message: what });
			for (const l of [...(e.federal?.leaders ?? []), ...units_.flatMap((u) => u.leaders ?? [])]) if (l.party && !parties.has(l.party)) bad(`Unknown party ${l.party} for ${l.name}`);
			for (const u of units_) if (u.party && !parties.has(u.party)) bad(`Unknown party ${u.party} for ${u.id}`);
			for (const c of e.coalitions ?? []) {
				for (const p of c.parties) if (!parties.has(p)) bad(`Unknown party ${p} in ${c.id}`);
				for (const u of c.between) if (!units.has(u)) bad(`Unknown unit ${u} in ${c.id}`);
			}
			for (const r of e.results ?? []) for (const p of r.parts) if (p.party && !parties.has(p.party)) bad(`Unknown party ${p.party} in ${r.title}`);
		}),
});

export const collections = { sources, families, groups, places, polities, events, societies, towns, thrones, politics, forces };
