import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { loadFont } from '@remotion/google-fonts/BricolageGrotesque';
import {
	C,
	EASE,
	END_LEN,
	FPS,
	GONG,
	MUSIC_BACK,
	MUSIC_STOP,
	PULSE,
	REC,
	ROLL,
	SERIF,
	TOTAL_FRAMES,
	T_BRIDGE,
	T_END,
	T_LANG,
	T_TODAY,
	bar,
} from './config';
import { COPY } from './copy';
import { Desk, Lines, Morph, Plate, Scrim, Screen, Year, ramp } from './parts';

const { fontFamily: BRICOLAGE } = loadFont('normal', { weights: ['600', '700'], subsets: ['latin'], ignoreTooManyRequestsWarning: true });

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const sec = (s: number) => Math.round(s * FPS);
/** A tap lands this long after its mark in the recordings. */
const TAP = 0.12;

// ---- The drain and the flood (S3, S4): one register-locked camera, a year that runs.

const SWEEP_FROM = 112;
const SWEEP_LEN = 470 - SWEEP_FROM;
const DRAIN = [1580, 1535, 1515, 1500, 1472, 1440, 1400, 1380, 1300, 1255, 1180];
/** The flood rushes forward in pulses on bars 3, 4 and 5, and holds on the year each headline names. */
const FLOOD = [
	{ year: 1000, at: GONG },
	...[[1180, 1255, 1300, 1380, 1400, 1440], [1472, 1500, 1515, 1535, 1580], [1650, 1700, 1750, 1800, 1808, 1850]].flatMap((years, b) =>
		years.map((year, k) => ({ year, at: Math.round(bar(3 + b) + k * PULSE) })),
	),
];
const LAND = 6; // frames a flood plate takes to soak in
/** Where the sweep's camera ends: the plate Story picks up and carries into the phone. */
const SWEEP_END = { name: 'sweep-1850', scale: 1.07, y: -30 };

/** The year shown at a global frame: 1600 rolling down on the drum's roll, then up through the flood. */
function yearAt(g: number): number {
	const keys = [SWEEP_FROM, ...ROLL, GONG];
	const years = [1600, ...DRAIN, 1000];
	if (g < GONG) return interpolate(g, keys, years, clamp);
	let i = FLOOD.length - 1;
	while (i > 0 && FLOOD[i].at > g) i--;
	if (i === 0) return 1000;
	return interpolate(g, [FLOOD[i].at, FLOOD[i].at + LAND], [FLOOD[i - 1].year, FLOOD[i].year], { ...clamp, easing: EASE.out });
}

const Sweep: React.FC = () => {
	const f = useCurrentFrame();
	const g = f + SWEEP_FROM;
	// The plates: hard cuts on the roll, then each flood plate dissolving in over the last.
	let plates: React.ReactNode;
	if (g < ROLL[0]) plates = <Plate name="p03-then-1600" scale={1.025} />;
	else if (g < GONG) {
		let i = ROLL.length - 1;
		while (ROLL[i] > g) i--;
		plates = <Plate name={`sweep-${DRAIN[i]}`} />;
	} else {
		// On the gong the map lands with a little weight, then drifts in through the centuries.
		const scale = 1 + 0.018 * (1 - ramp(g, GONG, GONG + 24, EASE.expo)) + interpolate(g, [GONG, 470], [0, SWEEP_END.scale - 1], clamp);
		const y = interpolate(g, [GONG, 470], [0, SWEEP_END.y], clamp);
		let i = FLOOD.length - 1;
		while (i > 0 && FLOOD[i].at > g) i--;
		const soak = i > 0 ? ramp(g, FLOOD[i].at, FLOOD[i].at + LAND, EASE.inOut) : 1;
		plates = (
			<>
				{i > 0 && soak < 1 && <Plate name={`sweep-${FLOOD[i - 1].year}`} scale={scale} y={y} />}
				<Plate name={`sweep-${FLOOD[i].year}`} scale={scale} y={y} opacity={soak} />
			</>
		);
	}
	const s4 = COPY.S4;
	const b = (n: number) => bar(n) - SWEEP_FROM;
	const landed = (year: number) => FLOOD.find((s) => s.year === year)!.at + LAND - SWEEP_FROM;
	// The cartouche clears off the map before the map is carried into the phone.
	const clear = 1 - ramp(f, SWEEP_LEN - 12, SWEEP_LEN - 1, EASE.inOut);
	return (
		<AbsoluteFill style={{ background: C.parchment }}>
			{plates}
			<Scrim to={560} opacity={clear} />
			<Year value={yearAt(g)} y={226} opacity={ramp(f, 0, 8) * clear} ad={ramp(g, GONG + 4, GONG + 18) * (1 - ramp(g, bar(3) - 6, bar(3)))} />
			<Lines lines={[COPY.S3.headline]} at={ROLL[0] - SWEEP_FROM + 1} out={b(3) - 9} y={420} size={78} />
			<Lines lines={[s4.b3.headline]} at={b(3)} out={b(4) - 9} y={420} size={78} />
			<Lines lines={[s4.b3.kicker]} at={landed(1440)} out={b(4) - 9} y={520} size={38} italic color={C.sienna} />
			<Lines lines={[s4.b4.headline]} at={b(4)} out={b(5) - 9} y={420} size={78} />
			<Lines lines={[s4.b4.kicker]} at={landed(1580)} out={b(5) - 9} y={520} size={38} italic color={C.sienna} />
			<Lines lines={s4.b5.headlineLines} at={b(5)} out={SWEEP_LEN - 16} y={420} size={78} />
			<Lines lines={[s4.b5.kicker]} at={landed(1850)} out={SWEEP_LEN - 16} y={612} size={36} italic color={C.sienna} />
		</AbsoluteFill>
	);
};

// ---- The other scenes. Frames inside each are the scene's own.

const Hook: React.FC = () => {
	const f = useCurrentFrame();
	return (
		<AbsoluteFill style={{ background: C.atlas }}>
			<Plate name="p01-today-atlas" scale={interpolate(f, [0, 46], [1, 1.04])} />
			<Scrim color="244,242,237" to={380} />
			<Lines lines={[COPY.S1.headline]} at={2} y={300} size={92} />
		</AbsoluteFill>
	);
};

const Turn: React.FC = () => {
	const f = useCurrentFrame();
	const scale = interpolate(f, [0, 66], [1, 1.025]);
	return (
		<AbsoluteFill style={{ background: C.parchment }}>
			<Plate name="p03-then-1600" scale={scale} />
			{/* Today's lines lift off the old map. */}
			<Plate name="p02-then-1600-statelines" scale={scale} opacity={1 - ramp(f, 34, 64, EASE.inOut)} />
			<Scrim to={460} />
			<Lines lines={['This is the same land', 'in 1600.']} at={4} out={54} y={300} size={84} />
		</AbsoluteFill>
	);
};

/**
 * S5 and the first shot of S6. The 1850 map shrinks into the phone and becomes the product;
 * the Oyo story plays (dissolving past the beat where the site clears the other kingdoms);
 * the ship; then Benin's plate fills the screen and grows back out to the full frame.
 */
const STORY = 690 - 470;
const R2_TRIM = 0.25;
const R2A = sec(REC.R2.fading - R2_TRIM);
const R3_AT = 156;
const Story: React.FC = () => {
	const f = useCurrentFrame();
	const into = ramp(f, 0, 20, EASE.hop);
	const out = ramp(f, STORY - 22, STORY, EASE.hop);
	return (
		<AbsoluteFill>
			<Desk />
			<Sequence durationInFrames={R2A}>
				<Screen src="rec/R2.mp4" trim={sec(R2_TRIM)} at={-40} />
			</Sequence>
			<Sequence from={R2A - 8} durationInFrames={R3_AT - R2A + 16}>
				<Screen src="rec/R2.mp4" trim={sec(REC.R2.oyoRising)} at={-40} fade={8} />
			</Sequence>
			<Sequence from={R3_AT}>
				<Screen src="rec/R3.mp4" trim={sec(REC.R3.tap + 2.2)} at={-40} fade={8} />
			</Sequence>
			{f < 26 && <Morph {...SWEEP_END} q={into} opacity={1 - ramp(f, 14, 25, EASE.inOut)} />}
			{f >= STORY - 32 && <Morph name="p21-benin-1897" origin="50% 50%" q={1 - out} opacity={ramp(f, STORY - 32, STORY - 24, EASE.inOut)} />}
			<Lines lines={[COPY.S5.headline]} at={10} out={148} y={330} size={76} />
			<Lines lines={[COPY.S6.kickers.shot1]} at={158} out={STORY - 34} y={350} size={50} italic />
		</AbsoluteFill>
	);
};

/** A dated event plate, full bleed, in its own camera. `soft` when it has grown out of the phone. */
const Event: React.FC<{ name: string; text: string; len: number; soft?: boolean }> = ({ name, text, len, soft = false }) => {
	const f = useCurrentFrame();
	return (
		<AbsoluteFill style={{ background: C.parchment }}>
			<Plate name={name} scale={interpolate(f, [0, len], [1, 1.035])} origin="50% 50%" />
			<Scrim to={420} opacity={soft ? ramp(f, 0, 10, EASE.inOut) : 1} />
			<Lines lines={[text]} at={soft ? 5 : 2} y={300} size={50} italic stagger={0} />
		</AbsoluteFill>
	);
};

const TODAY = T_BRIDGE - T_TODAY;
const TODAY_END = { name: 'p23-then-today', scale: 1.22, origin: '50% 66%' };
const Today: React.FC = () => {
	const f = useCurrentFrame();
	// Lines in the score's time: the music is gone until bar 11.
	const m = (frame: number) => frame - 783;
	return (
		<AbsoluteFill>
			<Plate name="p22-borno-divided-1902" origin="50% 50%" scale={1.035} />
			<AbsoluteFill style={{ opacity: ramp(f, 0, 18, EASE.inOut), background: C.parchment }}>
				<Plate name={TODAY_END.name} scale={interpolate(f, [0, TODAY], [1.16, TODAY_END.scale])} origin={TODAY_END.origin} />
				<Scrim to={420} opacity={1 - ramp(f, TODAY - 10, TODAY - 1, EASE.inOut)} />
			</AbsoluteFill>
			<Lines lines={[COPY.S7.headline1]} at={m(800)} out={m(853)} y={300} size={84} />
			<Lines lines={[COPY.S7.headline2]} at={m(MUSIC_BACK)} out={TODAY - 9} y={300} size={84} />
		</AbsoluteFill>
	);
};

/**
 * S8: today's map shrinks into the phone; the search and the highlight across state lines
 * in one take; then one tap back to the kingdom, dissolving past the moment the site clears
 * the map to parchment and catching the kingdom as it draws itself in.
 */
const BRIDGE = T_LANG - T_BRIDGE;
const R1A = 1.5; // the search box is about to be tapped
const R1A_LEN = 150;
const R1B = REC.R1.tapKingdom - 0.7;
/** The kingdom dissolves in so that it is whole by the time the sheet has gone. */
const R1C_AT = R1A_LEN - 6 + sec(REC.R1.sheetGone - R1B) - 6;
const Bridge: React.FC = () => {
	const f = useCurrentFrame();
	// The camera leans in while Igala's lands hold still, and is back in place for the kingdom.
	const zoom = 1 + 0.035 * (ramp(f, 90, 150, EASE.inOut) - ramp(f, 150, 200, EASE.inOut));
	return (
		<AbsoluteFill>
			<Desk />
			<Sequence durationInFrames={R1A_LEN}>
				<Screen src="rec/R1.mp4" trim={sec(R1A)} at={-40} zoom={zoom} />
			</Sequence>
			<Sequence from={R1A_LEN - 6} durationInFrames={R1C_AT - R1A_LEN + 12}>
				<Screen src="rec/R1.mp4" trim={sec(R1B)} at={-40} fade={6} zoom={zoom} />
			</Sequence>
			<Sequence from={R1C_AT}>
				<Screen src="rec/R1.mp4" trim={sec(REC.R1.kingdomDrawing)} at={-40} fade={6} zoom={zoom} />
			</Sequence>
			{f < 26 && <Morph {...TODAY_END} q={ramp(f, 0, 20, EASE.hop)} opacity={1 - ramp(f, 14, 25, EASE.inOut)} />}
			<Lines lines={[COPY.S8.headlineB12]} at={10} out={bar(13) - bar(12) - 9} y={330} size={76} />
			<Lines lines={[COPY.S8.headlineB13]} at={bar(13) - bar(12)} out={bar(14) - bar(12) - 9} y={330} size={76} />
			<Lines lines={['And the states', 'they built before.']} at={bar(14) - bar(12)} out={BRIDGE - 8} y={300} size={80} />
		</AbsoluteFill>
	);
};

/**
 * S8b: three searches, each named for what it is. The camera leans in while "Yoru" offers
 * both Yoruba (a people) and Yoruboid (a branch of Defoid), and pulls back as the site lights
 * every area Yoruboid-speaking peoples live in, three lands apart; then Igboid, eleven peoples
 * on both banks of the Niger; then Hausa, a people rather than a branch.
 */
const LANG = T_END - T_LANG;
const R4_SHOTS = (() => {
	const a = { at: 0, trim: 0.95 };
	const y = { at: 44, trim: 4.1 };
	const yPick = y.at + sec(REC.R4.select + TAP - y.trim);
	const i = { at: yPick + 72, trim: REC.R4.igboid - 0.65 };
	const iPick = i.at + sec(REC.R4.igboid + TAP - i.trim);
	const h = { at: iPick + 102, trim: REC.R4.hausa - 0.65 };
	const hPick = h.at + sec(REC.R4.hausa + TAP - h.trim);
	return { a, y, yPick, i, iPick, h, hPick };
})();
const Lang: React.FC = () => {
	const f = useCurrentFrame();
	const { a, y, yPick, i, iPick, h, hPick } = R4_SHOTS;
	const zoom = 1 + 0.2 * (ramp(f, 6, 28, EASE.inOut) - ramp(f, yPick - 2, yPick + 24, EASE.hop)) + 0.035 * ramp(f, yPick + 24, LANG, EASE.inOut);
	const s = COPY.S8b;
	const label = (k: number, from: number, to: number) => (
		<React.Fragment key={k}>
			<Lines lines={[s.results[k].name]} at={from} out={to} y={286} size={84} />
			<Lines lines={[s.results[k].kicker]} at={from + 6} out={to} y={396} size={34} italic color={C.sienna} />
		</React.Fragment>
	);
	return (
		<AbsoluteFill>
			<Desk />
			{/* The kingdom holds while the search comes up over it. */}
			{f < 10 && <Screen src="rec/R1.mp4" trim={sec(REC.R1.kingdomDrawing) + BRIDGE - R1C_AT - 1} at={-40} hold={0} />}
			<Sequence durationInFrames={y.at + 6}>
				<Screen src="rec/R4.mp4" trim={sec(a.trim)} at={-40} fade={8} zoom={zoom} />
			</Sequence>
			<Sequence from={y.at} durationInFrames={i.at - y.at + 6}>
				<Screen src="rec/R4.mp4" trim={sec(y.trim)} at={-40} fade={6} zoom={zoom} />
			</Sequence>
			<Sequence from={i.at} durationInFrames={h.at - i.at + 6}>
				<Screen src="rec/R4.mp4" trim={sec(i.trim)} at={-40} fade={6} zoom={zoom} />
			</Sequence>
			<Sequence from={h.at}>
				<Screen src="rec/R4.mp4" trim={sec(h.trim)} at={-40} fade={6} zoom={zoom} hold={sec(REC.R4.end - h.trim) - 1} />
			</Sequence>
			<Lines lines={[s.headline]} at={6} out={yPick - 8} y={300} size={76} />
			{label(0, yPick + 4, i.at - 4)}
			{label(1, i.at + 6, h.at - 4)}
			{label(2, h.at + 6, LANG - 12)}
			{/* Down to black for the gong. */}
			<AbsoluteFill style={{ background: C.black, opacity: ramp(f, LANG - 12, LANG, EASE.in) }} />
		</AbsoluteFill>
	);
};

const End: React.FC<{ siteUrl: string }> = ({ siteUrl }) => {
	const f = useCurrentFrame();
	const mark = ramp(f, 4, 30, EASE.expo);
	const rise = (a: number, b: number) => `translateY(${(1 - ramp(f, a, b)) * 110}%)`;
	return (
		<AbsoluteFill style={{ background: C.black }}>
			<AbsoluteFill style={{ transform: `scale(${interpolate(f, [0, END_LEN], [1, 1.025])})` }}>
				<Img
					src={staticFile('brand/icon.svg')}
					style={{ position: 'absolute', left: 540 - 60, top: 500, width: 120, height: 120, opacity: mark, transform: `translateY(${(1 - mark) * 24}px)` }}
				/>
				<div style={{ position: 'absolute', top: 664, left: 0, right: 0, overflow: 'hidden', textAlign: 'center' }}>
					<div style={{ fontFamily: BRICOLAGE, fontWeight: 700, fontSize: 80, color: C.surface, letterSpacing: '-0.02em', transform: rise(8, 30) }}>
						{COPY.S9.brand}
					</div>
				</div>
				<Lines lines={COPY.S9.taglineLines} at={18} y={790} size={40} color="#d9c9a8" align="center" italic />
				<Lines lines={[COPY.S9.cta]} at={36} y={990} size={34} color="#c08a5e" align="center" />
				<div style={{ position: 'absolute', top: 1046, left: 0, right: 0, overflow: 'hidden', textAlign: 'center' }}>
					<div style={{ fontFamily: BRICOLAGE, fontWeight: 600, fontSize: 64, color: C.surface, letterSpacing: '-0.01em', transform: rise(42, 64) }}>
						{siteUrl}
					</div>
				</div>
				<Lines lines={[COPY.S9.subLine]} at={52} y={1150} size={30} color="#8c7b66" align="center" />
				<div style={{ position: 'absolute', top: 1450, left: 72, right: 72, textAlign: 'center', fontFamily: SERIF, fontSize: 24, color: '#8c7b66', opacity: ramp(f, 60, 84) }}>
					{COPY.S9.credits}
				</div>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

// ---- Sound: the film's own score (src/film/score-book.ts), written to this cut with the map's
// ensemble, and the product's own cues on the taps in the recordings.

const Score: React.FC = () => {
	const { yPick, iPick, hPick } = R4_SHOTS;
	const cue = (name: string, at: number, volume = 1) => (
		<Sequence from={at} durationInFrames={90}>
			<Audio src={staticFile(`audio/${name}.wav`)} volume={volume} />
		</Sequence>
	);
	return (
		<>
			<Audio src={staticFile('audio/A2-film.wav')} />
			{cue('tap', 470 + sec(REC.R2.tap - R2_TRIM + TAP), 0.7)}
			{cue('open', 470 + sec(REC.R2.tap - R2_TRIM + TAP + 0.1), 0.5)}
			{cue('tap', T_BRIDGE + sec(REC.R1.select + TAP - R1A), 0.7)}
			{cue('tap', T_BRIDGE + R1A_LEN - 6 + sec(REC.R1.tapKingdom + TAP - R1B), 0.7)}
			{cue('tap', T_LANG + sec(1.1 + TAP - R4_SHOTS.a.trim), 0.5)}
			{[yPick, iPick, hPick].map((at) => (
				<React.Fragment key={at}>{cue('tap', T_LANG + at, 0.6)}</React.Fragment>
			))}
		</>
	);
};
export interface BeforeTheLinesProps {
	siteUrl?: string;
}

export const BeforeTheLines: React.FC<BeforeTheLinesProps> = ({ siteUrl = COPY.S9.defaultUrl }) => (
	<AbsoluteFill style={{ background: C.black }}>
		<Sequence durationInFrames={46}>
			<Hook />
		</Sequence>
		<Sequence from={46} durationInFrames={SWEEP_FROM - 46}>
			<Turn />
		</Sequence>
		<Sequence from={SWEEP_FROM} durationInFrames={SWEEP_LEN}>
			<Sweep />
		</Sequence>
		<Sequence from={470} durationInFrames={STORY}>
			<Story />
		</Sequence>
		<Sequence from={690} durationInFrames={MUSIC_STOP - 690}>
			<Event name="p21-benin-1897" text={COPY.S6.kickers.shot2} len={MUSIC_STOP - 690} soft />
		</Sequence>
		<Sequence from={MUSIC_STOP} durationInFrames={T_TODAY - MUSIC_STOP}>
			<Event name="p22-borno-divided-1902" text={COPY.S6.kickers.shot3} len={T_TODAY - MUSIC_STOP} />
		</Sequence>
		<Sequence from={T_TODAY} durationInFrames={TODAY}>
			<Today />
		</Sequence>
		<Sequence from={T_BRIDGE} durationInFrames={BRIDGE}>
			<Bridge />
		</Sequence>
		<Sequence from={T_LANG} durationInFrames={LANG}>
			<Lang />
		</Sequence>
		<Sequence from={T_END}>
			<End siteUrl={siteUrl} />
		</Sequence>
		<Score />
	</AbsoluteFill>
);

export { TOTAL_FRAMES };
