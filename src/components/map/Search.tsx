import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import type { Translate } from '../../i18n/utils';
import { search } from '../../lib/search';
import type { GroupView } from '../../lib/types';

interface Props {
	groups: GroupView[];
	selected: GroupView | null;
	onSelect: (group: GroupView | null) => void;
	tr: Translate;
}

/** ARIA 1.2 combobox with a listbox popup. Enter picks the best match. */
export default function Search({ groups, selected, onSelect, tr }: Props) {
	const { t } = tr;
	const id = useId();
	const [query, setQuery] = useState(selected?.name ?? '');
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(0);
	const hits = useMemo(() => search(groups, query), [groups, query]);
	const listId = `${id}-list`;
	const showList = open && query.trim().length > 0;

	function choose(group: GroupView) {
		setQuery(group.name);
		setOpen(false);
		onSelect(group);
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
				choose(hit.item);
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
				placeholder={t('search.placeholder')}
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
				onFocus={() => setOpen(true)}
				onBlur={() => setOpen(false)}
				onKeyDown={onKeyDown}
			/>
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
							className="search__option"
							// mousedown so the pick lands before the input blurs
							onMouseDown={(e) => {
								e.preventDefault();
								choose(hit.item);
							}}
							onMouseEnter={() => setActive(i)}
						>
							<span className="search__name">{hit.item.name}</span>
							{hit.matched !== hit.item.name && <span className="search__alias">{hit.matched}</span>}
							<span className="search__family">{hit.item.language.family.name}</span>
						</li>
					))}
				</ul>
				{hits.length === 0 && (
					<p className="search__empty" role="status">
						{t('search.noResults', { query: query.trim() })}{' '}
						{groups.length > 0 && t('search.available', { list: groups.map((g) => g.name).join(', ') })}
					</p>
				)}
			</div>
		</div>
	);
}
