// Turns the map's sound on and off. The same switch sits in the top bar and in a
// story's letterbox, and both follow the one setting.

import { useSyncExternalStore } from 'react';
import type { Translate } from '../../i18n/utils';
import { setSound, soundEnabled, subscribeSound } from '../../lib/sound';

export default function SoundToggle({ tr, className = '' }: { tr: Translate; className?: string }) {
	const { t } = tr;
	const on = useSyncExternalStore(subscribeSound, soundEnabled, () => false);
	return (
		<button
			type="button"
			className={`sound-toggle ${className}`}
			aria-pressed={on}
			aria-label={t('sound.label')}
			title={on ? t('sound.off') : t('sound.on')}
			onClick={() => setSound(!on)}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
				{on ? (
					<>
						<path className="sound-toggle__wave" d="M15.5 9a4 4 0 010 6" />
						<path className="sound-toggle__wave sound-toggle__wave--2" d="M18 6.5a7.5 7.5 0 010 11" />
					</>
				) : (
					<path d="M16 9.5l5 5M21 9.5l-5 5" />
				)}
			</svg>
		</button>
	);
}
