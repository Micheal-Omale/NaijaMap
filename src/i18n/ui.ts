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
		'card.back': 'Back to {name}',
		'profile.back': 'All peoples',
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
		'atlas.mixed': 'Hatched: one main people, shared with another.',
		'atlas.shared': 'Striped: shared by several peoples, none the majority.',
		'hover.shared': 'Shared by several peoples',
		'hover.none': 'No people mapped here yet.',
		'hover.tap': 'Tap for details',
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
		'community.inAlso': '{lga} LGA, also {others}, {state}',

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

		'mode.label': 'Map view',
		'mode.today': 'Peoples today',
		'mode.then': 'Kingdoms in history',
		'map.labelThen': 'Old map of the states and kingdoms of the Nigeria region in {year}',
		'map.creditRegion': 'Neighbouring lands',

		'then.tagline': 'How the great kingdoms, empires and confederacies rose, spread and changed, from about 1000 AD to colonial rule.',
		'then.loading': 'Unrolling the old map…',
		'then.count.one': '{count} state on the map',
		'then.count.other': '{count} states on the map',
		'then.none': 'No state is mapped in this year.',
		'then.next': 'Next: {name}, {year}',
		'then.method':
			'Inside Nigeria, territory is drawn to the nearest modern LGA; beyond its borders, as rough outlines. Old frontiers were zones more than lines, so read every edge as approximate.',
		'then.todayIntro': 'What carries the old names on: the traditional rulers who still reign from the old seats.',
		'then.key.core': 'Ruled directly',
		'then.key.influence': 'Tributaries and looser control',
		'then.key.network': 'Ritual or trade reach (Nri, Aro)',
		'then.key.disputed': 'Dashed edge: extent disputed',
		'then.key.capital': 'Capital',
		'then.key.tribute': 'Tribute',
		'then.key.trade': 'Trade',
		'then.key.war': 'War',
		'then.key.ritual': 'Ritual ties',
		'then.stateLines': 'Show today’s state lines',

		'timeline.label': 'Year',
		'timeline.play': 'Play history',
		'timeline.pause': 'Pause',
		'timeline.prev': 'Previous event',
		'timeline.next': 'Next event',
		'timeline.today': 'Today',
		'timeline.ad': 'AD',

		'polity.back': 'All states in {year}',
		'polity.backToday': 'All seats today',
		'polity.span': '{from} to {to}',
		'polity.otherNames': 'Also called {names}',
		'polity.inYear': 'In {year}',
		'polity.notYet': 'Not yet founded in {year}. Its story here begins around {from}.',
		'polity.gone': 'Gone by {year}. It ended in {to}.',
		'polity.history': 'Through time',
		'polity.ruler': 'Ruler',
		'polity.capital': 'Capital',
		'polity.today': 'What remains today',
		'polity.peoples': 'The people of this state',
		'polity.livesThere': 'Living in its lands today',
		'polity.livesThere.help': 'Peoples whose homelands lie inside its lands at its height ({year}), by number of LGAs.',
		'polity.layer.core': 'Ruled land',
		'polity.layer.influence': 'Wider reach',
		'polity.draft': 'Draft. Not yet reviewed, and not shown on the public site.',
		'polity.showYear': 'Show {year} on the map',
		'polity.openPeople': 'Open the {name} profile',

		'kind.empire': 'Empire',
		'kind.kingdom': 'Kingdom',
		'kind.caliphate': 'Caliphate',
		'kind.confederacy': 'Confederacy',
		'kind.city-state': 'City-state',
		'kind.network': 'Ritual and trade network',

		'profile.kingdoms': 'In history',
		'profile.seeKingdom': 'See {name} at its height, {year}',

		'announce.year.one': '{year}: {count} state on the map.',
		'announce.year.other': '{year}: {count} states on the map.',
		'hover.thenTap': 'Tap for its story',

		'review.title': 'Data review',
		'review.intro':
			'Every group below is a draft. Check each claim against its sources, then set its status to "published" in data/groups/<id>.json.',
	},
} as const satisfies Record<Lang, Record<string, string>>;

export type UiKey = keyof (typeof ui)[typeof defaultLang];
