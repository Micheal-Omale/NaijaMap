// Tells a first-time visitor that the dots, marks and lines of the history map
// open: hover (or tap, on a phone) to see what one means. It rises in once the
// map has drawn, thanks the visitor the first time they try it, then goes for
// good. While it shows, the map beckons with rings around a few of the dots.

import { useEffect, useMemo, useState } from 'react';
import type { Translate } from '../../i18n/utils';

const MOTION = {
	/** Let the map draw its first year before asking anything of the visitor. */
	delayMs: 1600,
	/** How long the thank-you stays before the hint leaves. */
	doneMs: 2400,
};

const KEY = 'niajmap.explain-hint';

/** Whether this visitor has already learned that the map explains itself. */
export function hintSeen(): boolean {
	try {
		return localStorage.getItem(KEY) === 'done';
	} catch {
		return false;
	}
}

function remember(): void {
	try {
		localStorage.setItem(KEY, 'done');
	} catch {
		// Private windows can refuse storage; the hint then shows again next visit.
	}
}

interface Props {
	/** The visitor has pointed at (or tapped) something on the map. */
	used: boolean;
	onDone: () => void;
	tr: Translate;
}

export default function ExplainHint({ used, onDone, tr }: Props) {
	const { t } = tr;
	const touch = useMemo(() => window.matchMedia('(hover: none)').matches, []);
	const [shown, setShown] = useState(false);

	useEffect(() => {
		const id = window.setTimeout(() => setShown(true), MOTION.delayMs);
		return () => clearTimeout(id);
	}, []);

	useEffect(() => {
		if (!used) return;
		remember();
		const id = window.setTimeout(onDone, MOTION.doneMs);
		return () => clearTimeout(id);
	}, [used, onDone]);

	return (
		<div className="explain-hint" data-shown={shown || used ? 'true' : undefined} data-used={used ? 'true' : undefined} role="status">
			<span className="explain-hint__icon" aria-hidden="true">
				{touch ? (
					<svg viewBox="0 0 24 24">
						<circle cx="12" cy="8" r="3.2" className="explain-hint__ping" />
						<path d="M10.2 21l-3.6-5.4a1.5 1.5 0 012.4-1.8l1.4 1.6V8.2a1.6 1.6 0 013.2 0v5l3.4.7a2 2 0 011.6 2.3l-.9 4.8" />
					</svg>
				) : (
					<svg viewBox="0 0 24 24">
						<circle cx="9" cy="9" r="3.2" className="explain-hint__ping" />
						<path d="M9 9l3.2 11 2-4.6 4.6-2z" />
					</svg>
				)}
			</span>
			<p>{used ? t('hint.explain.done') : t(touch ? 'hint.explain.touch' : 'hint.explain.mouse')}</p>
			{!used && (
				<button
					type="button"
					onClick={() => {
						remember();
						onDone();
					}}
				>
					{t('hint.explain.close')}
				</button>
			)}
		</div>
	);
}
