// Shares the view the address bar describes: every view of the site keeps its
// state in the address, so the link opens the same group, kingdom, event,
// period or match-up. Phones get the system share sheet; elsewhere the link is
// copied, and a short note says so.

import { useEffect, useRef, useState } from 'react';
import type { Translate } from '../i18n/utils';

async function copy(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		// Older browsers, or a page without clipboard permission.
		const area = document.createElement('textarea');
		area.value = text;
		area.setAttribute('readonly', '');
		area.style.position = 'fixed';
		area.style.opacity = '0';
		document.body.append(area);
		area.select();
		let ok = false;
		try {
			ok = document.execCommand('copy');
		} catch {}
		area.remove();
		return ok;
	}
}

export default function ShareButton({ tr, className = '', text }: { tr: Translate; className?: string; text?: string }) {
	const { t } = tr;
	const [note, setNote] = useState<'copied' | 'failed' | null>(null);
	const timer = useRef<number | undefined>(undefined);
	useEffect(() => () => clearTimeout(timer.current), []);

	const share = async () => {
		const url = window.location.href;
		const title = document.title;
		// The share sheet suits touch screens; on a desktop it is a detour, so copy instead.
		if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
			try {
				await navigator.share({ title, text: text ?? title, url });
				return;
			} catch (err) {
				if ((err as DOMException)?.name === 'AbortError') return;
			}
		}
		const ok = await copy(url);
		setNote(ok ? 'copied' : 'failed');
		clearTimeout(timer.current);
		timer.current = window.setTimeout(() => setNote(null), 2200);
	};

	return (
		<span className="share">
			<button type="button" className={`sound-toggle share-button ${className}`} aria-label={t('share.label')} title={t('share.label')} onClick={share}>
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<circle cx="18" cy="5.5" r="2.5" />
					<circle cx="6" cy="12" r="2.5" />
					<circle cx="18" cy="18.5" r="2.5" />
					<path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1" />
				</svg>
			</button>
			<span className="share__note" role="status" data-show={note ? 'true' : undefined}>
				{note ? t(note === 'copied' ? 'share.copied' : 'share.failed') : ''}
			</span>
		</span>
	);
}
