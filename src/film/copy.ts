// Exact text from §7 Claims Ledger: character for character.
// Do not modify, rephrase, or add any unverified claims. The name, the address and the language
// scene (S8b) were set by the owner on 2026-10-10; S8b states only what data/ holds.

export const COPY = {
	S1: {
		headline: 'You know this shape.',
	},
	S2: {
		headline: 'This is the same land in 1600.',
	},
	S3: {
		headline: 'Rewind a thousand years.',
		headlineLines: ['Rewind', 'a thousand years.'],
	},
	S4: {
		b3: {
			headline: 'Kingdoms rise.',
			kicker: 'c. 1440 · Oba Ewuare the Great',
		},
		b4: {
			headline: 'Empires spread.',
			kicker: 'c. 1580 · Idris Alooma: the imperial height',
		},
		b5: {
			headlineLines: ['Between them,', 'peoples ruled themselves.'],
			headline: 'Between them, peoples ruled themselves.',
			kicker: 'c. 1850 · Sokoto Caliphate: the largest state in West Africa',
		},
	},
	S5: {
		headline: "Open any kingdom's story.",
	},
	S6: {
		kickers: {
			shot1: '1472 · The Portuguese reach the coast',
			shot2: '1897 · The British invasion of Benin',
			shot3: '1902 · Borno divided four ways',
		},
	},
	S7: {
		headline1: 'The empires ended.',
		headline2: 'Their rulers still reign.',
	},
	S8: {
		headlineB12: 'Search for a people.',
		headlineB13: 'See where they live today.',
		headlineB14: 'And the states they built before.',
	},
	S8b: {
		headline: 'Or follow a language.',
		// data/families.json and data/groups: Yoruboid (Yoruba, Igala, Itsekiri) and Igboid (11 peoples,
		// Delta to Rivers) are branches; Hausa is a people whose language is Chadic.
		results: [
			{ name: 'Yoruboid', kicker: 'A language branch · Yoruba, Igala and Itsekiri' },
			{ name: 'Igboid', kicker: 'A language branch · 11 peoples, both banks of the Niger' },
			{ name: 'Hausa', kicker: 'A people, not a branch · their language is Chadic' },
		],
	},
	S9: {
		brand: 'Nigeria Histomap',
		tagline: "Where Nigeria's peoples live today, and the states they built before.",
		taglineLines: ["Where Nigeria's peoples live today,", 'and the states they built before.'],
		defaultUrl: 'histonaija.logfolio.pro',
		cta: 'Explore the history yourself.',
		subLine: 'Free · Every claim sourced',
		credits: 'Boundaries: GRID3 (CC BY 4.0) · Rivers and neighbouring lands: Natural Earth',
	},
	VO: [
		'You know this shape.',
		'This is the same land, in 1600.',
		'Rewind a thousand years.',
		'Kingdoms rose. Empires spread. Between them, peoples ruled themselves.',
		'Then ships came from the sea.',
		'The empires ended. Their rulers still reign.',
		'Search for your people, and the states they built before.',
		'Nigeria Histomap.',
	],
} as const;
