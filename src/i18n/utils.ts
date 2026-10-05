import { defaultLang, languages, ui, type Lang, type UiKey } from './ui';

export function isLang(value: string | undefined): value is Lang {
	return value !== undefined && value in languages;
}

/** Reads the locale from the first path segment; no prefix means the default (English). */
export function getLangFromUrl(url: URL): Lang {
	const [, first] = url.pathname.split('/');
	return isLang(first) ? first : defaultLang;
}

/** Returns a lookup for one locale that falls back to English for missing keys. */
export function useTranslations(lang: Lang) {
	return function t(key: UiKey): string {
		const strings: Partial<Record<UiKey, string>> = ui[lang];
		return strings[key] ?? ui[defaultLang][key];
	};
}
