// Every piece of UI text lives here, keyed by locale, so the site can be
// translated (Hausa, Yoruba, Igbo, Pidgin) without touching components.
// Data text (group names, histories, sources) lives with the data, not here.
//
// Placeholders: {name} is filled by format(). Keys ending in .one / .other
// are plural forms, picked by plural() with Intl.PluralRules.

export const languages = {
	en: 'English',
} as const;

export type Lang = keyof typeof languages;

export const defaultLang: Lang = 'en';

export const ui = {
	en: {
		'site.name': 'NiajMap',
		'site.tagline': 'Where Nigeria’s peoples live today, and the states they built before.',
		'site.description':
			'An interactive map of Nigeria’s ethnic groups and the precolonial states that came before them, with sources for every claim.',
		'site.notOwnership': 'Areas are approximate and show where people live. They are not claims of land ownership.',
		'site.groupsHeading': 'Groups on the map',
		'site.noGroups': 'No groups are published yet. The map is being checked before launch.',

		'search.label': 'Find an ethnic group',
		'search.placeholder': 'Search a group, e.g. Igala',
		'search.clear': 'Clear search',
		'search.noResults': 'No group matches “{query}” yet.',
		'search.available': 'Groups mapped so far: {list}.',
		'search.didYouMean': 'Showing the closest match',

		'map.label': 'Map of Nigeria’s Local Government Areas',
		'map.loading': 'Loading the map…',
		'map.noWebgl':
			'Your browser cannot draw the interactive map. Every area is still listed in the profile below.',
		'map.loadError': 'The map data could not load. Check your connection and try again.',
		'map.retry': 'Try again',
		'map.approximate': 'approximate location',
		'map.zoomIn': 'Zoom in',
		'map.zoomOut': 'Zoom out',
		'map.resetView': 'Show all of Nigeria',
		'map.creditBoundaries': 'Boundaries',
		'map.creditRivers': 'Rivers',

		'announce.selected.one': '{name}: {count} area highlighted.',
		'announce.selected.other': '{name}: {count} areas highlighted.',
		'announce.cleared': 'Highlight cleared.',

		'profile.draft': 'Draft. Not yet reviewed, and not shown on the public site.',
		'profile.close': 'Close profile',
		'profile.expand': 'Show full profile',
		'profile.collapse': 'Show less',
		'profile.language': 'Language',
		'profile.family': 'Language family',
		'profile.familyEyebrow': '{name} language family',
		'profile.ruler': 'Traditional ruler',
		'profile.rulerSeat': '{title}, seated at {seat}',
		'profile.where': 'Where they live',
		'profile.lgaCount.one': '{count} LGA',
		'profile.lgaCount.other': '{count} LGAs',
		'profile.stateCount.one': 'in {count} state',
		'profile.stateCount.other': 'across {count} states',
		'profile.communities': 'Communities beyond the homeland',
		'profile.villages': 'Villages and quarters',
		'profile.communityCount.one': '{count} community',
		'profile.communityCount.other': '{count} communities',
		'profile.showOnMap': 'Show {name} on the map',
		'profile.sources': 'Sources',
		'profile.sourceNotChecked': 'cited through another source, not yet checked directly',
		'profile.reviewNotes': 'Notes for review',
		'profile.ref': 'Source {n}',

		'atlas.intro': 'Each LGA is coloured by its main people. Colours follow language families; tap a name to see where that people lives.',
		'atlas.family': '{name} languages',
		'atlas.mixed': 'Hatched: shared with another people.',
		'place.who': 'Who lives here',
		'place.indigenous': 'Indigenous',
		'place.settled': 'Settled',
		'place.share.majority': 'Majority',
		'place.share.large': 'Large share',
		'place.share.minority': 'Minority',
		'place.speaks': 'Speaks {first}',
		'place.alsoSpeaks': 'also {rest}',
		'place.bilingual': 'Bilingual',
		'place.multilingual': 'Multilingual',
		'place.languageUse': 'Languages in daily life',
		'place.history': 'History',
		'place.livelihoods': 'What people do',
		'place.noBrief': 'No brief for this area yet.',
		'place.groupsMapped': 'Groups mapped here',
		'place.openProfile': 'Open the {name} profile',
		'place.sources.one': '{count} source',
		'place.sources.other': '{count} sources',
		'place.draft': 'Draft brief, not yet reviewed.',
		'community.kind': 'A community where {language} is spoken',
		'community.in': '{lga} LGA, {state}',

		'presence.core': 'Homeland',
		'presence.significant': 'Shared area',
		'presence.minority': 'Smaller presence',
		'presence.core.help': 'The group is the majority here.',
		'presence.significant.help': 'A large share of a mixed area.',
		'presence.minority.help': 'Present, but a small share.',
		'presence.community': 'Community where the language is spoken',

		'confidence.high': 'High confidence',
		'confidence.medium': 'Medium confidence',
		'confidence.disputed': 'Disputed',

		'legend.heading': 'Key',

		'review.title': 'Data review',
		'review.intro':
			'Every group below is a draft. Check each claim against its sources, then set its status to "published" in data/groups/<id>.json.',
	},
} as const satisfies Record<Lang, Record<string, string>>;

export type UiKey = keyof (typeof ui)[typeof defaultLang];
