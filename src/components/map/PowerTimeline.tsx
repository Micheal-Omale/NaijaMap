// The Power view's timeline, like the kingdoms': the periods from 1954 to today
// laid out by their years, with step and play. Playing moves from period to
// period, holding each long enough to see who held power.

import { useEffect, useState } from 'react';
import type { Translate } from '../../i18n/utils';
import type { EraView, PoliticsView } from '../../lib/types';

/** How long play holds each period. */
const HOLD_MS = 7000;

interface Props {
	politics: PoliticsView;
	era: EraView;
	tr: Translate;
	onEra: (id: string) => void;
	onStory: () => void;
}

export default function PowerTimeline({ politics, era, tr, onEra, onStory }: Props) {
	const { t } = tr;
	const [playing, setPlaying] = useState(false);
	const eras = politics.eras;
	const at = eras.findIndex((e) => e.id === era.id);
	const now = new Date().getFullYear();
	const first = eras[0]?.from ?? 1954;
	const span = Math.max(1, now - first);
	const pos = (y: number) => ((y - first) / span) * 100;

	useEffect(() => {
		if (!playing) return;
		if (at >= eras.length - 1) {
			setPlaying(false);
			return;
		}
		const id = window.setTimeout(() => onEra(eras[at + 1].id), HOLD_MS);
		return () => clearTimeout(id);
	}, [playing, at, eras, onEra]);

	const step = (d: number) => {
		setPlaying(false);
		const e = eras[at + d];
		if (e) onEra(e.id);
	};

	return (
		<div className="power-timeline" role="group" aria-label={t('power.eras')}>
			<div className="power-timeline__buttons">
				<button type="button" className="timeline__btn" aria-label={t('timeline.prev')} onClick={() => step(-1)} disabled={at <= 0}>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M15 6l-6 6 6 6" />
					</svg>
				</button>
				<button
					type="button"
					className="timeline__btn timeline__btn--play"
					aria-pressed={playing}
					aria-label={playing ? t('timeline.pause') : t('timeline.play')}
					onClick={() => {
						if (playing) return setPlaying(false);
						if (at >= eras.length - 1) onEra(eras[0].id);
						setPlaying(true);
					}}
				>
					{playing ? (
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="M8 5v14M16 5v14" />
						</svg>
					) : (
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="M7 4.5l12 7.5-12 7.5z" className="fill" />
						</svg>
					)}
				</button>
				<button type="button" className="timeline__btn" aria-label={t('timeline.next')} onClick={() => step(1)} disabled={at >= eras.length - 1}>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M9 6l6 6-6 6" />
					</svg>
				</button>
			</div>
			<div className="power-timeline__now">
				<span className="power-timeline__years">{era.label}</span>
				<button type="button" className="power-timeline__story" onClick={onStory}>
					{t('power.story.open')}
				</button>
			</div>
			<div className="power-timeline__track">
				<div className="power-timeline__rail" aria-hidden="true" />
				{eras.map((e) => {
					const on = e.id === era.id;
					const left = pos(e.from);
					const width = pos(e.to ?? now) - left;
					return (
						<button
							key={e.id}
							type="button"
							className={`power-timeline__era${on ? ' is-on' : ''}${e.id.startsWith('military') ? ' is-military' : ''}`}
							style={{ left: `${left}%`, width: `${width}%` }}
							aria-pressed={on}
							aria-label={`${e.label}: ${e.name}`}
							title={`${e.label}: ${e.name}`}
							onClick={() => {
								setPlaying(false);
								onEra(e.id);
							}}
						>
							<span className="power-timeline__bar" />
							{on && <span className="power-timeline__name">{e.name}</span>}
						</button>
					);
				})}
				{playing && <span className="power-timeline__clock" key={era.id} style={{ left: `${pos(era.from)}%`, width: `${pos(era.to ?? now) - pos(era.from)}%`, animationDuration: `${HOLD_MS}ms` }} aria-hidden="true" />}
				<span className="power-timeline__tick" style={{ left: '0%' }}>
					{first}
				</span>
				<span className="power-timeline__tick" style={{ left: `${pos(1960)}%` }}>
					1960
				</span>
				<span className="power-timeline__tick" style={{ left: `${pos(1999)}%` }}>
					1999
				</span>
				<span className="power-timeline__tick power-timeline__tick--end" style={{ left: '100%' }}>
					{t('timeline.today')}
				</span>
			</div>
		</div>
	);
}
