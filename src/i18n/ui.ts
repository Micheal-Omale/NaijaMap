// Every piece of UI text lives here, keyed by locale, so the site can be
// translated (Hausa, Yoruba, Igbo, Pidgin) without touching components.
// Data text (group names, histories, sources) lives with the data, not here.

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
		'home.status': 'The map is being built. Check back soon.',
	},
} as const satisfies Record<Lang, Record<string, string>>;

export type UiKey = keyof (typeof ui)[typeof defaultLang];
