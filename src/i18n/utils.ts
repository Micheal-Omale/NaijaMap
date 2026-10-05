import { defaultLang, languages, ui, type Lang, type UiKey } from './ui';

export function isLang(value: string | undefined): value is Lang {
	return value !== undefined && value in languages;
}

/** Reads the locale from the first path segment; no prefix means the default (English). */
export function getLangFromUrl(url: URL): Lang {
	const [, first] = url.pathname.split('/');
	return isLang(first) ? first : defaultLang;
}

type Vars = Record<string, string | number>;

function fill(text: string, vars?: Vars): string {
	if (!vars) return text;
	return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

type PluralBase = UiKey extends infer K ? (K extends `${infer B}.other` ? B : never) : never;

/** Returns lookups for one locale. Missing keys fall back to English. */
export function useTranslations(lang: Lang) {
	const strings: Partial<Record<UiKey, string>> = ui[lang];
	const rules = new Intl.PluralRules(lang);

	function t(key: UiKey, vars?: Vars): string {
		return fill(strings[key] ?? ui[defaultLang][key], vars);
	}

	/** Picks `<base>.one`, `<base>.other` and so on for `count`, and fills {count}. */
	function plural(base: PluralBase, count: number, vars?: Vars): string {
		const form = `${base}.${rules.select(count)}` as UiKey;
		const key = (form in ui[defaultLang] ? form : `${base}.other`) as UiKey;
		return t(key, { count, ...vars });
	}

	return { t, plural };
}

export type Translate = ReturnType<typeof useTranslations>;
