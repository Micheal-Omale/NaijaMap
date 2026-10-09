import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import type { Translate } from '../../i18n/utils';
import type { LanguageGroup } from '../../lib/families';
import { search } from '../../lib/search';
import type { GroupView } from '../../lib/types';

interface Props {
	groups: GroupView[];
	/** Language families and their branches (Igboid, Yoruboid…), searched alongside the peoples. */
	families: LanguageGroup[];
	selected: GroupView | null;
	selectedFamily: LanguageGroup | null;
	onSelect: (group: GroupView | null) => void;
	onSelectFamily: (family: LanguageGroup) => void;
	tr: Translate;
}

type Hit = { kind: 'group'; item: GroupView; matched: string; score: number } | { kind: 'family'; item: LanguageGroup; matched: string; score: number };

/** The examples the empty bar cycles through, and how long each stays. */
const EXAMPLES = { everyMs: 2600 };

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** ARIA 1.2 combobox with a listbox popup. Enter picks the best match. */
export default function Search({ groups, families, selected, selectedFamily, onSelect, onSelectFamily, tr }: Props) {
	const { t, plural } = tr;
	const id = useId();
	const [query, setQuery] = useState(selected?.name ?? selectedFamily?.name ?? '');
	const [open, setOpen] = useState(false);
	const [focused, setFocused] = useState(false);
	const [active, setActive] = useState(0);
	const hits = useMemo<Hit[]>(() => {
		const peoples = search(groups, query, 6).map((h) => ({ kind: 'group' as const, ...h }));
		const langs = search(families, query, 4).map((h) => ({ kind: 'family' as const, ...h }));
		// Peoples first on a tie: "Igbo" before "Igboid".
		return [...peoples, ...langs].sort((a, b) => a.score - b.score || (a.kind === 'group' ? -1 : 1)).slice(0, 7);
	}, [groups, families, query]);
	const listId = `${id}-list`;
	const showList = open && query.trim().length > 0;

	// The bar's name follows a pick made elsewhere (a chip, a family link, the back button).
	useEffect(() => {
		setQuery(selected?.name ?? selectedFamily?.name ?? '');
	}, [selected, selectedFamily]);

	// While empty and idle, the bar suggests what to type, one example at a time.
	const examples = useMemo(() => t('search.examples').split('|'), [t]);
	const [example, setExample] = useState(0);
	const idle = !query && !focused;
	useEffect(() => {
		if (!idle || reducedMotion()) return;
		const timer = window.setInterval(() => setExample((i) => (i + 1) % examples.length), EXAMPLES.everyMs);
		return () => clearInterval(timer);
	}, [idle, examples.length]);

	function choose(hit: Hit) {
		setQuery(hit.item.name);
		setOpen(false);
		// On a phone this also puts the keyboard away, so the map and its sheet show.
		(document.activeElement as HTMLElement | null)?.blur();
		if (hit.kind === 'family') onSelectFamily(hit.item);
		else onSelect(hit.item);
	}

	function clear() {
		setQuery('');
		setOpen(false);
		onSelect(null);
	}

	function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			setOpen(true);
			setActive((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			setActive((i) => Math.max(i - 1, 0));
		} else if (e.key === 'Enter') {
			const hit = hits[active] ?? hits[0];
			if (hit) {
				e.preventDefault();
				choose(hit);
			}
		} else if (e.key === 'Escape') {
			if (open) setOpen(false);
			else clear();
		}
	}

	return (
		<div className="search">
			<label htmlFor={`${id}-input`} className="visually-hidden">
				{t('search.label')}
			</label>
			<svg className="search__icon" viewBox="0 0 24 24" aria-hidden="true">
				<circle cx="11" cy="11" r="6.5" />
				<path d="m16 16 4.5 4.5" />
			</svg>
			<input
				id={`${id}-input`}
				className="search__input"
				type="search"
				role="combobox"
				autoComplete="off"
				autoCapitalize="words"
				spellCheck={false}
				enterKeyHint="search"
				placeholder={focused ? t('search.placeholder') : ''}
				aria-expanded={showList}
				aria-controls={listId}
				aria-autocomplete="list"
				aria-activedescendant={showList && hits[active] ? `${id}-opt-${active}` : undefined}
				value={query}
				onChange={(e) => {
					setQuery(e.target.value);
					setActive(0);
					setOpen(true);
				}}
				onFocus={() => {
					setFocused(true);
					setOpen(true);
				}}
				onBlur={() => {
					setFocused(false);
					setOpen(false);
				}}
				onKeyDown={onKeyDown}
			/>
			{idle && (
				<span className="search__hint" aria-hidden="true">
					{t('search.try')}{' '}
					<span className="search__example" key={example}>
						{examples[example]}
					</span>
				</span>
			)}
			{query && (
				<button type="button" className="search__clear" onClick={clear} aria-label={t('search.clear')}>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M6 6l12 12M18 6 6 18" />
					</svg>
				</button>
			)}
			<div className="search__popup" hidden={!showList}>
				<ul id={listId} role="listbox" aria-label={t('search.label')} className="search__list">
					{hits.map((hit, i) => (
						<li
							key={hit.item.id}
							id={`${id}-opt-${i}`}
							role="option"
							aria-selected={i === active}
							className={`search__option${hit.kind === 'family' ? ' search__option--family' : ''}`}
							// mousedown so the pick lands before the input blurs
							onMouseDown={(e) => {
								e.preventDefault();
								choose(hit);
							}}
							onMouseEnter={() => setActive(i)}
						>
							{hit.kind === 'family' && (
								<svg className="search__kind" viewBox="0 0 24 24" aria-hidden="true">
									<path d="M12 4v5M12 9l-6 5M12 9l6 5M6 14v3M18 14v3M12 9v8" />
									<circle cx="12" cy="4" r="1.6" />
									<circle cx="6" cy="18.5" r="1.6" />
									<circle cx="12" cy="18.5" r="1.6" />
									<circle cx="18" cy="18.5" r="1.6" />
								</svg>
							)}
							<span className="search__name">{hit.item.name}</span>
							{hit.kind === 'group' && hit.matched !== hit.item.name && <span className="search__alias">{hit.matched}</span>}
							<span className="search__family">
								{hit.kind === 'family' ? plural('search.familyPeoples', hit.item.groups.length) : hit.item.language.family.name}
							</span>
						</li>
					))}
				</ul>
				{hits.length === 0 && (
					<p className="search__empty" role="status">
						{t('search.noResults', { query: query.trim() })} {t('search.tryFamily')}
					</p>
				)}
			</div>
		</div>
	);
}
