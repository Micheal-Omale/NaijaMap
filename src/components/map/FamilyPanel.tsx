// A language family or branch (Igboid, Yoruboid, Defoid…): every people in it,
// with their colour on the atlas, while the map lights up all the land they live in.

import type { Translate } from '../../i18n/utils';
import type { LanguageGroup } from '../../lib/families';

interface Props {
	family: LanguageGroup;
	/** Group id → atlas colour. */
	colors: Map<string, string>;
	/** Every branch by name, so the lineage can be walked up and down. */
	branches: Map<string, LanguageGroup>;
	lgaCount: number;
	tr: Translate;
	onBack: () => void;
	onOpenGroup: (id: string) => void;
	onOpenFamily: (family: LanguageGroup) => void;
}

export default function FamilyPanel({ family, colors, branches, lgaCount, tr, onBack, onOpenGroup, onOpenFamily }: Props) {
	const { t, plural } = tr;
	// The narrower branches inside this one that have more than one people, so the list is worth opening.
	const inside = [...branches.values()].filter((b) => b.lineage.length === family.lineage.length + 1 && b.lineage[family.lineage.length - 1] === family.name && b.groups.length > 1);

	return (
		<article className="profile family" aria-labelledby="family-name">
			<header className="profile__head">
				<button type="button" className="back-link" onClick={onBack}>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M15 6l-6 6 6 6" />
					</svg>
					{t('profile.back')}
				</button>
				<p className="profile__eyebrow">{t('family.eyebrow')}</p>
				<h2 id="family-name" className="profile__name">
					{t('family.name', { name: family.name })}
				</h2>
				<p className="profile__counts">
					{plural('family.peoples', family.groups.length)} · {plural('profile.lgaCount', lgaCount)}
				</p>
			</header>

			<nav className="family__lineage" aria-label={t('family.lineage')}>
				{family.lineage.map((name, i) => {
					const b = branches.get(name);
					const here = i === family.lineage.length - 1;
					return (
						<span key={name}>
							{i > 0 && <span aria-hidden="true"> › </span>}
							{here || !b ? (
								<strong aria-current={here ? 'page' : undefined}>{name}</strong>
							) : (
								<button type="button" className="link-button" onClick={() => onOpenFamily(b)}>
									{name}
								</button>
							)}
						</span>
					);
				})}
			</nav>

			<h3 className="family__h">{t('family.peoplesHeading')}</h3>
			<ul className="intro__groups">
				{family.groups.map((g) => (
					<li key={g.id}>
						<button type="button" className="chip chip--atlas" onClick={() => onOpenGroup(g.id)}>
							<span className="chip__dot" style={{ background: colors.get(g.id) }} aria-hidden="true" />
							{g.name}
						</button>
					</li>
				))}
			</ul>

			{inside.length > 0 && (
				<>
					<h3 className="family__h">{t('family.branches')}</h3>
					<ul className="intro__groups">
						{inside.map((b) => (
							<li key={b.id}>
								<button type="button" className="chip" onClick={() => onOpenFamily(b)}>
									{b.name} <span className="muted">{b.groups.length}</span>
								</button>
							</li>
						))}
					</ul>
				</>
			)}

			<p className="intro__note">{t('family.note')}</p>
		</article>
	);
}
