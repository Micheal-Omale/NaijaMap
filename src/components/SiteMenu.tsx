// The site menu: a button at the start of the top bar that opens a drawer naming
// every view, with a line on what each one shows, how to get around, the sound
// and share controls, and how far to trust the map. The map app and the Versus
// page both carry it, so every view is a tap or two away from any page.

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react';
import type { Translate } from '../i18n/utils';
import { setSound, soundEnabled, subscribeSound } from '../lib/sound';
import MenuPreview, { type Previews } from './MenuPreview';
import { shareView } from './ShareButton';
import './site-menu.css';

export type View = 'today' | 'then' | 'power' | 'versus';

const VIEWS: { view: View; href: string }[] = [
	{ view: 'today', href: '/' },
	{ view: 'then', href: '/?mode=then' },
	{ view: 'power', href: '/?mode=power' },
	{ view: 'versus', href: '/versus' },
];

/** Until the menu has been opened once, its button carries a dot. */
const SEEN = 'niajmap.menu-seen';

function menuSeen(): boolean {
	try {
		return localStorage.getItem(SEEN) === 'yes';
	} catch {
		return true;
	}
}

/** Each view's icon, shared by the tab bar and the menu. */
export function ViewIcon({ view }: { view: View }) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true">
			{view === 'today' ? (
				<>
					<circle cx="12" cy="9" r="3.2" />
					<path d="M12 21s-6.5-6-6.5-11.5a6.5 6.5 0 0113 0C18.5 15 12 21 12 21z" />
				</>
			) : view === 'then' ? (
				<>
					<path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z" />
					<path d="M5 17a3 3 0 013-3h11" />
				</>
			) : view === 'power' ? (
				<>
					<path d="M4 20h16" />
					<path d="M6 20V10l6-5 6 5v10" />
					<path d="M10 20v-5h4v5" />
				</>
			) : (
				<>
					<path d="M4 4l9 9M4 4h4M4 4v4" />
					<path d="M20 4l-9 9M20 4h-4M20 4v4" />
					<path d="M7 14l3 3-3 3M17 14l-3 3 3 3" />
				</>
			)}
		</svg>
	);
}

interface Props {
	tr: Translate;
	current: View;
	/** Switches to a view in place. Without it, or for Versus, each view is a plain link. */
	onView?: (view: Exclude<View, 'versus'>) => void;
	/** A view's own address, when it differs from the default (Versus opening on the kingdom in view). */
	hrefs?: Partial<Record<View, string>>;
}

export default function SiteMenu({ tr, current, onView, hrefs }: Props) {
	const { t } = tr;
	const id = useId();
	const dialog = useRef<HTMLDialogElement>(null);
	const timer = useRef<number | undefined>(undefined);
	const [expanded, setExpanded] = useState(false);
	const [fresh, setFresh] = useState(() => !menuSeen());
	const [note, setNote] = useState<'copied' | 'failed' | null>(null);
	const sound = useSyncExternalStore(subscribeSound, soundEnabled, () => false);
	useEffect(() => () => clearTimeout(timer.current), []);
	// The preview cards' drawings stay out of the page's first load; they come as the menu is reached for.
	const [previews, setPreviews] = useState<Previews | null>(null);
	const fetching = useRef(false);
	const fetchPreviews = () => {
		if (fetching.current) return;
		fetching.current = true;
		import('./menu-previews').then((m) => setPreviews(m.PREVIEWS)).catch(() => (fetching.current = false));
	};
	// Pointing at a card plays its motion again.
	const [replays, setReplays] = useState<Partial<Record<View, number>>>({});

	const open = () => {
		fetchPreviews();
		const d = dialog.current;
		if (!d) return;
		clearTimeout(timer.current);
		if (!d.open) {
			d.showModal();
			// Measure the closed pose first, so the drawer slides from it.
			void d.offsetWidth;
		}
		d.dataset.open = '';
		setExpanded(true);
		setNote(null);
		if (fresh) {
			setFresh(false);
			try {
				localStorage.setItem(SEEN, 'yes');
			} catch {}
		}
	};

	/** Slides the drawer out, then closes it; focus goes back to the button. */
	const close = useCallback(() => {
		const d = dialog.current;
		if (!d?.open) return;
		delete d.dataset.open;
		setExpanded(false);
		clearTimeout(timer.current);
		const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		timer.current = window.setTimeout(() => d.close(), still ? 0 : 300);
	}, []);

	const go = (e: MouseEvent<HTMLAnchorElement>, view: View) => {
		// A new tab or window is the browser's business.
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		if (view === current) {
			e.preventDefault();
			close();
		} else if (onView && view !== 'versus') {
			e.preventDefault();
			close();
			onView(view);
		}
	};

	const share = async () => {
		const result = await shareView();
		if (result) setNote(result);
	};

	return (
		<>
			<button
				type="button"
				className="site-menu-button"
				aria-label={t('menu.open')}
				title={t('menu.open')}
				aria-haspopup="dialog"
				aria-expanded={expanded}
				aria-controls={id}
				data-fresh={fresh ? 'true' : undefined}
				onPointerEnter={fetchPreviews}
				onFocus={fetchPreviews}
				onClick={open}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path d="M4 7h16M4 12h16M4 17h10" />
				</svg>
			</button>

			<dialog
				ref={dialog}
				id={id}
				className="site-menu"
				aria-labelledby={`${id}-name`}
				onCancel={(e) => {
					e.preventDefault();
					close();
				}}
				// The drawer's body fills the dialog, so a click on the dialog itself is on the backdrop.
				onClick={(e) => e.target === e.currentTarget && close()}
			>
				<div className="site-menu__body">
					<header className="site-menu__head">
						<svg className="site-menu__mark" viewBox="0 0 512 512" aria-hidden="true">
							<rect width="512" height="512" rx="112" fill="#0a7650" />
							<rect x="200" y="96" width="112" height="320" rx="18" fill="#f7efdc" />
							<circle cx="372" cy="380" r="58" fill="#e8590c" stroke="#f7efdc" strokeWidth="18" />
						</svg>
						<div>
							<p className="site-menu__name" id={`${id}-name`}>
								{t('site.name')}
							</p>
							<p className="site-menu__tagline">{t('site.tagline')}</p>
						</div>
						<button type="button" className="site-menu__close" aria-label={t('menu.close')} title={t('menu.close')} onClick={close}>
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<path d="M6 6l12 12M18 6L6 18" />
							</svg>
						</button>
					</header>

					<nav aria-labelledby={`${id}-explore`}>
						<h2 className="site-menu__label" id={`${id}-explore`}>
							{t('menu.explore')}
						</h2>
						<ul className="site-menu__list">
							{VIEWS.map(({ view, href }, k) => (
								<li key={view} style={{ '--k': k } as React.CSSProperties}>
									<a
										className="site-menu__item site-menu__item--view"
										href={hrefs?.[view] ?? href}
										aria-current={view === current ? 'page' : undefined}
										onClick={(e) => go(e, view)}
										onPointerEnter={(e) => e.pointerType === 'mouse' && setReplays((r) => ({ ...r, [view]: (r[view] ?? 0) + 1 }))}
									>
										<MenuPreview key={replays[view] ?? 0} view={view} data={previews} replay={Boolean(replays[view])} icon={<ViewIcon view={view} />} />
										<span className="site-menu__text">
											<span className="site-menu__title">
												{t(`mode.${view}`)}
												{view === current && <span className="site-menu__here">{t('menu.here')}</span>}
											</span>
											<span className="site-menu__vibe">{t(`menu.vibe.${view}`)}</span>
											<span className="site-menu__desc">{t(`menu.${view}`)}</span>
										</span>
									</a>
								</li>
							))}
						</ul>
					</nav>

					<section aria-labelledby={`${id}-tips`}>
						<h2 className="site-menu__label" id={`${id}-tips`}>
							{t('menu.tips')}
						</h2>
						<ol className="site-menu__tips">
							<li>{t('menu.tip.tap')}</li>
							<li>{t('menu.tip.panel')}</li>
							<li>{t('menu.tip.link')}</li>
						</ol>
					</section>

					<section aria-labelledby={`${id}-settings`}>
						<h2 className="site-menu__label" id={`${id}-settings`}>
							{t('menu.settings')}
						</h2>
						<ul className="site-menu__list">
							<li>
								<button type="button" className="site-menu__item" role="switch" aria-checked={sound} onClick={() => setSound(!sound)}>
									<span className="site-menu__icon">
										<svg viewBox="0 0 24 24" aria-hidden="true">
											<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
											{sound ? <path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
										</svg>
									</span>
									<span className="site-menu__text">
										<span className="site-menu__title">{t('menu.sound')}</span>
										<span className="site-menu__desc">{t('menu.soundText')}</span>
									</span>
									<span className="site-menu__switch" aria-hidden="true" />
								</button>
							</li>
							<li>
								<button type="button" className="site-menu__item" onClick={share}>
									<span className="site-menu__icon">
										<svg viewBox="0 0 24 24" aria-hidden="true">
											<circle cx="18" cy="5.5" r="2.5" />
											<circle cx="6" cy="12" r="2.5" />
											<circle cx="18" cy="18.5" r="2.5" />
											<path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1" />
										</svg>
									</span>
									<span className="site-menu__text">
										<span className="site-menu__title">{t('menu.share')}</span>
										<span className="site-menu__desc" role="status">
											{note ? t(note === 'copied' ? 'share.copied' : 'share.failed') : t('menu.shareText')}
										</span>
									</span>
								</button>
							</li>
						</ul>
					</section>

					<footer className="site-menu__about">
						<h2 className="site-menu__label">{t('menu.about')}</h2>
						<p>{t('menu.aboutText')}</p>
						<p>{t('site.notOwnership')}</p>
						<p className="site-menu__credit">
							{t('map.creditBoundaries')}:{' '}
							<a href="https://data.grid3.org/" target="_blank" rel="noopener">
								GRID3
							</a>{' '}
							(CC BY 4.0) ·{' '}
							<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">
								Natural Earth
							</a>
						</p>
					</footer>
				</div>
			</dialog>
		</>
	);
}
