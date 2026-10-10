import React from 'react';
import { AbsoluteFill, Freeze, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { C, EASE, H, SAFE, SERIF, W } from './config';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 0 → 1 between frames a and b. */
export const ramp = (f: number, a: number, b: number, easing: (t: number) => number = EASE.out) =>
	interpolate(f, [a, b], [0, 1], { ...clamp, easing });

/**
 * A plate: a still of the real map, 2160 x 3840, shown at 1080 x 1920. Every sweep
 * plate shares one camera, so plates given the same scale and y dissolve in register.
 */
export const Plate: React.FC<{ name: string; scale?: number; y?: number; opacity?: number; origin?: string }> = ({
	name,
	scale = 1,
	y = 0,
	opacity = 1,
	origin = '50% 60%',
}) => (
	<AbsoluteFill style={{ opacity }}>
		<Img
			src={staticFile(`plates/${name}.jpg`)}
			style={{ width: W, height: H, transform: `translateY(${y}px) scale(${scale})`, transformOrigin: origin }}
		/>
	</AbsoluteFill>
);

/** Parchment laid over the top of a plate, so type reads like a cartouche on the map. */
export const Scrim: React.FC<{ color?: string; to?: number; opacity?: number }> = ({ color = '236,225,200', to = 520, opacity = 1 }) => (
	<AbsoluteFill
		style={{
			opacity,
			background: `linear-gradient(to bottom, rgba(${color},.95) 0px, rgba(${color},.88) ${to}px, rgba(${color},0) ${to + 200}px)`,
		}}
	/>
);

/**
 * Lines that rise out of a mask and leave upward about three times faster than they came
 * (PATTERNS.md §2, §9). Frames are the parent sequence's.
 */
export const Lines: React.FC<{
	lines: readonly string[];
	at: number;
	out?: number;
	y: number;
	size?: number;
	color?: string;
	italic?: boolean;
	align?: 'left' | 'center';
	stagger?: number;
}> = ({ lines, at, out, y, size = 84, color = C.ink, italic = false, align = 'left', stagger = 3 }) => {
	const f = useCurrentFrame();
	return (
		<div
			style={{
				position: 'absolute',
				top: y,
				left: align === 'center' ? 0 : SAFE.left,
				// Platform buttons sit low on the right; the top of the frame is clear to 48 px.
				right: align === 'center' ? 0 : 48,
				textAlign: align,
			}}
		>
			{lines.map((line, i) => {
				const rise = 1 - ramp(f, at + i * stagger, at + i * stagger + 22);
				const leave = out === undefined ? 0 : ramp(f, out + i * 2, out + i * 2 + 8, EASE.in);
				return (
					<div key={i} style={{ overflow: 'hidden', paddingBottom: size * 0.12, marginBottom: -size * 0.12 }}>
						<div
							style={{
								transform: `translateY(${(rise - leave) * 108}%)`,
								fontFamily: SERIF,
								fontStyle: italic ? 'italic' : 'normal',
								fontSize: size,
								lineHeight: 1.1,
								letterSpacing: italic ? 0 : '-0.012em',
								color,
								whiteSpace: 'nowrap',
							}}
						>
							{line}
						</div>
					</div>
				);
			})}
		</div>
	);
};

/**
 * The year as an odometer: each digit rolls, and a higher digit turns only as the one
 * below it passes 9, so a falling or rising year reads as time running.
 */
export const Year: React.FC<{ value: number; y: number; size?: number; opacity?: number; ad?: number }> = ({ value, y, size = 170, opacity = 1, ad = 0 }) => {
	const digits = [3, 2, 1, 0].map((k) => {
		const p = 10 ** k;
		const base = Math.floor(value / p);
		const rem = value - base * p;
		return base + (k === 0 ? rem : Math.max(0, rem - (p - 1)));
	});
	return (
		<div style={{ position: 'absolute', top: y, left: SAFE.left - size * 0.04, display: 'flex', alignItems: 'baseline', opacity }}>
			{digits.map((pos, i) => (
				<div key={i} style={{ height: size, overflow: 'hidden', width: size * 0.56 }}>
					<div style={{ transform: `translateY(${-(pos % 10) * size}px)` }}>
						{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, j) => (
							<div key={j} style={{ height: size, fontFamily: SERIF, fontSize: size, lineHeight: 1, color: C.ink, textAlign: 'center', fontVariantNumeric: 'lining-nums tabular-nums' }}>
								{d}
							</div>
						))}
					</div>
				</div>
			))}
			<div style={{ fontFamily: SERIF, fontSize: size * 0.24, color: C.sienna, letterSpacing: '0.12em', marginLeft: size * 0.08, opacity: ad }}>AD</div>
		</div>
	);
};

/** Where a phone screen sits: 70% of the frame, centred, its top at 572 inside a 12 px ink bezel. */
export const SCREEN = { left: (W - W * 0.7) / 2 - 12, top: 560, w: W * 0.7, h: H * 0.7 } as const;

/**
 * A phone screen recording, framed by a thin ink bezel and wiped up into place (PATTERNS.md §4).
 * `trim` is the first frame of the recording to show; `fade` dissolves it in over the screen
 * beneath; `zoom` pushes the camera in from the top of the phone; from `hold` on, the frame holds.
 */
export const Screen: React.FC<{ src: string; trim: number; at?: number; rate?: number; fade?: number; zoom?: number; hold?: number }> = ({
	src,
	trim,
	at = 0,
	rate = 1,
	fade = 0,
	zoom = 1,
	hold,
}) => {
	const f = useCurrentFrame();
	const p = ramp(f, at, at + 20, EASE.expo);
	const { w, h } = SCREEN;
	const video = <OffthreadVideo src={staticFile(src)} trimBefore={trim} playbackRate={rate} muted style={{ width: w, height: h }} />;
	return (
		<div
			style={{
				position: 'absolute',
				left: SCREEN.left,
				top: SCREEN.top,
				padding: 12,
				borderRadius: 58,
				background: C.ink,
				boxShadow: '0 40px 80px -30px rgba(43,33,24,.55)',
				clipPath: `inset(${(1 - p) * 100}% 0 0 0 round 58px)`,
				opacity: fade ? ramp(f, 0, fade, EASE.inOut) : 1,
				transform: `translateY(${(1 - p) * 80}px) scale(${zoom})`,
				transformOrigin: '50% 0',
			}}
		>
			<div style={{ width: w, height: h, borderRadius: 46, overflow: 'hidden', background: C.surface }}>
				{hold !== undefined && f >= hold ? <Freeze frame={hold}>{video}</Freeze> : video}
			</div>
		</div>
	);
};

/**
 * A plate on its way into (q → 1) or out of (q → 0) the phone: at 0 it is the full frame,
 * at 1 it sits exactly where Screen's picture does, so the map becomes the product.
 */
export const Morph: React.FC<{ name: string; q: number; scale?: number; y?: number; origin?: string; opacity?: number }> = ({
	name,
	q,
	scale = 1,
	y = 0,
	origin,
	opacity = 1,
}) => {
	const k = 1 - 0.3 * q;
	return (
		<div
			style={{
				position: 'absolute',
				left: SCREEN.left * q,
				top: SCREEN.top * q,
				padding: 12 * q,
				borderRadius: 58 * q,
				background: C.ink,
				opacity,
				boxShadow: `0 40px 80px -30px rgba(43,33,24,${0.55 * q})`,
			}}
		>
			<div style={{ position: 'relative', width: W * k, height: H * k, borderRadius: 46 * q, overflow: 'hidden' }}>
				<div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `scale(${k})`, transformOrigin: '0 0' }}>
					<Plate name={name} scale={scale} y={y} origin={origin} />
				</div>
			</div>
		</div>
	);
};
/** Parchment with the 1600 map faint beneath, behind the screen recordings. */
export const Desk: React.FC = () => (
	<AbsoluteFill style={{ background: C.parchment }}>
		<Plate name="p03-then-1600" scale={1.35} opacity={0.28} />
		<AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(236,225,200,.9) 0%, rgba(236,225,200,.55) 45%, rgba(236,225,200,.85) 100%)' }} />
	</AbsoluteFill>
);
