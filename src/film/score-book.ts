// "Before the Lines": the film's own score, written to picture with the map's ensemble, so the
// film sounds like the product. Rendered by docs/promo/render-score.mjs into A2-film.wav.
// Frames are the film's (30 fps). The grid is the site's: 12/8 at 92 BPM from frame 0, so the
// picture's cuts on the drum roll, the gong and bars 3 to 5 fall on it.
//
// The arc. A flute asks a question over today's map; the talking drum speaks the turn to 1600,
// then rewinds the centuries on the cuts, falling as the years fall, and a gong opens the year
// 1000. The ensemble rises in three waves with the kingdoms, the empires (the kakaki, the royal
// trumpets of the Sahel courts) and the peoples who ruled themselves (a chorus calling and
// answering). It thins to a courtyard for the product; a ship's bell rings far off for 1472;
// low drums gather for Benin and break on the partition of Borno into a flute's lament. The
// talking drum and the kakaki hail the rulers who still reign. Each language is announced by
// its own people's instrument: the dùndún speaking Yo-rù-bá (mid, low, high) for Yoruboid, the
// udu and the ogene for Igboid, the kakaki for Hausa. A breath of silence on the black, a last
// gong, and the flute's question answered.

import { filmKit } from '../lib/sound';

type Kit = ReturnType<typeof filmKit>;
type Part = 'bell' | 'udu' | 'answer' | 'shaker' | 'bass' | 'balafon';

export const FILM_SECONDS = 59;

export function renderFilmScore(c: OfflineAudioContext): Promise<AudioBuffer> {
	write(filmKit(c), c);
	return c.startRendering();
}

function write(k: Kit, c: OfflineAudioContext): void {
	const P = k.PULSE;
	const g = k.mix.gain;
	const pl = k.places;
	const N = k.note;
	const T = k.TONES;
	const fs = (frame: number) => frame / 30;
	const ps = (pulse: number) => pulse * P;
	/** The pulse nearest a film frame: picture moments that come from the recordings land on the grid. */
	const on = (frame: number) => Math.round(fs(frame) / P);
	const rnd = (a: number, b: number) => a + Math.random() * (b - a);
	const hum = (t: number) => t + rnd(-0.006, 0.006);

	// ---- Bed: the pad and the wind, shaped to the picture.
	const curve = (param: AudioParam, scale: number, points: [number, number][]) => {
		param.cancelScheduledValues(0);
		param.setValueAtTime(points[0][1] * scale, 0);
		for (const [t, v] of points.slice(1)) param.linearRampToValueAtTime(v * scale, t);
	};
	const END = fs(1604); // the last gong
	curve(k.pad.gain, k.mix.pad.level, [
		[0, 0], [2.5, 0.45], [5.0, 0.7], [5.25, 1], [7.8, 0.8], [15.7, 0.55], [20.8, 0.55], [21.6, 0.85],
		[24.8, 0.95], [29.9, 0.95], [31.2, 0.6], [40.4, 0.5], [52.9, 0.45], [END - 0.15, 0.1], [END + 0.1, 1], [57.6, 0.55], [58.6, 0],
	]);
	curve(k.air.gain, k.mix.air.level, [
		[0, 0], [0.6, 1], [2.6, 0.9], [4.2, 0.25], [5.25, 0.9], [7.6, 0.8], [8.8, 0], [24.8, 0], [25.0, 0.8], [29.4, 0.6], [30.8, 0],
		[END, 0], [END + 0.4, 0.5], [58.6, 0],
	]);

	// ---- Players.
	const flutePhrase = (notes: [number, number, number, number?][], vel = 0.9, place: AudioNode = pl.flute) => {
		for (const [pulse, degree, len, fall = 1] of notes) k.flute(hum(ps(pulse)), place, N(degree), len * P, vel * g.flute, fall);
	};
	const speak = (strokes: [number, keyof typeof T, number, number][], vel = 1, place: AudioNode = pl.lead, jingle = true) => {
		for (const [pulse, tone, glide, v] of strokes) k.talkingDrum(hum(ps(pulse)), place, T[tone], glide, vel * v * g.lead, jingle);
	};
	/** A noise sweep, for the rewind: the band falls from f0 to f1 and swells into the gong. */
	const sweep = (t0: number, t1: number, f0: number, f1: number, peak: number, place: AudioNode) => {
		const len = Math.ceil((t1 - t0 + 0.3) * c.sampleRate);
		const buf = c.createBuffer(1, len, c.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
		const src = c.createBufferSource();
		src.buffer = buf;
		const band = c.createBiquadFilter();
		band.type = 'bandpass';
		band.Q.value = 1.4;
		band.frequency.setValueAtTime(f0, t0);
		band.frequency.exponentialRampToValueAtTime(f1, t1);
		const amp = c.createGain();
		amp.gain.setValueAtTime(0.0001, t0);
		amp.gain.exponentialRampToValueAtTime(peak, t1 - 0.04);
		amp.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.08);
		src.connect(band).connect(amp).connect(place);
		src.start(t0);
		src.stop(t1 + 0.3);
	};
	/** The groove, pulse by pulse, each part at its own level (0 is out). */
	const groove = (from: number, to: number, mix: Partial<Record<Part, number>>, figure = 0) => {
		for (let p = Math.ceil(from); p < to; p++) {
			const t = ps(p);
			const i = p % 12;
			const bar = Math.floor(p / 12);
			if (mix.bell && k.BELL.includes(i)) k.iron(hum(t), pl.bell, i === 0 ? 440 : 659, mix.bell * g.bell * (i === 0 ? 0.9 : 0.6) * rnd(0.85, 1), 0.12);
			if (mix.udu) for (const [at, pitch, s, often] of k.UDU) if (at === i && Math.random() < often) k.udu(hum(t), pl.bass, pitch, mix.udu * s * rnd(0.85, 1));
			if (mix.answer) for (const [at, tone, glide] of k.ANSWER) if (at === i) k.talkingDrum(hum(t), pl.answer, T[tone] * 0.75, glide, mix.answer * g.answer * rnd(0.85, 1));
			if (mix.shaker) k.shekere(hum(t), pl.shaker, mix.shaker * g.shaker * (i % 3 === 0 ? 1 : 0.5) * rnd(0.8, 1), i % 3 === 2);
			if (mix.bass && (i === 0 || i === 7)) k.skinDrum(t, pl.bass, 52, mix.bass * g.bass * (i === 0 ? 0.8 : 0.45));
			const deg = k.FIGURES[(Math.floor(bar / 2) + figure) % 2][i];
			if (mix.balafon && deg !== undefined) k.balafon(hum(t), pl.balafon, N(deg), mix.balafon * g.balafon * rnd(0.8, 1));
		}
	};

	// ---- 0:00 Today's map. A glint, and the flute's question, which does not come home.
	k.iron(0.03, pl.bell, 1318.5, 0.3 * g.bell, 0.3);
	flutePhrase([[0.4, 5, 2], [2.4, 6, 1], [3.4, 8, 2.6], [6.2, 7, 7, 0.97]], 0.85);

	// 0:01.5 "This is the same land in 1600." The drum says it, softly, under the held note.
	k.skinDrum(ps(7), pl.bass, 55, 0.4 * g.bass);
	speak([[7.5, 'M', 1, 0.45], [8, 'M', 1, 0.4], [9, 'H', 0.95, 0.55], [10, 'M', 1, 0.45], [11, 'L', 1.1, 0.6]], 0.9, pl.lead, false);
	// Today's lines lift off: low wood, and voices beginning to hum.
	for (const [pulse, degree] of [[12, 0], [13.5, 2], [15, 3]]) k.balafon(hum(ps(pulse)), pl.balafon, N(degree), 0.4 * g.balafon);
	k.voices(ps(12), pl.voices, 110, 6 * P, 'u', 'o', 4, 0.3 * g.voices, false, 1);

	// ---- 0:03.9 The rewind: a stroke on every cut, each lower as the years fall, quickening into the gong.
	for (let s = 0; s < 11; s++) {
		const pulse = 18 + s / 2;
		const pitch = 205 * 0.5 ** (s / 10);
		k.talkingDrum(hum(ps(pulse)), pl.lead, pitch, 0.9, (0.5 + 0.5 * (s / 10)) * g.lead, s > 7);
		if (s % 2 === 0) k.talkingDrum(hum(ps(pulse)), pl.answer, pitch * 0.75, 0.9, 0.35 * g.answer);
	}
	sweep(ps(16.5), ps(24), 3400, 240, 0.06, pl.near);

	// 0:05.2 The year 1000. The gong, the big drum, men's voices; then wind, and a call from far away.
	k.iron(ps(24), pl.gong, 110, 1.15 * g.gong);
	k.skinDrum(ps(24), pl.bass, 52, 1.0 * g.bass);
	k.voices(ps(24) + 0.03, pl.voices, 110, 2.6, 'o', 'u', 5, 0.5 * g.voices, false, 0.97);
	k.voices(ps(24) + 0.05, pl.voices, 164.81, 2.3, 'o', 'u', 3, 0.32 * g.voices, false, 0.97);
	k.flute(ps(28.5), pl.kakaki, N(10), 1.3, 0.4 * g.flute, 0.96);
	k.udu(ps(30), pl.bass, 66, 0.45);
	k.udu(ps(33), pl.bass, 78, 0.3);

	// ---- 0:07.8 Bar 3, "Kingdoms rise." The heartbeat and the bell; the balafon climbs a note for each year.
	groove(36, 48, { bass: 0.8, udu: 0.7, bell: 0.35 });
	for (let s = 0; s < 6; s++) k.balafon(hum(ps(36 + s)), pl.balafon, N(s), (0.55 + 0.06 * s) * g.balafon);
	flutePhrase([[42, 7, 5, 0.97]], 0.75); // 1440, Ewuare
	// Bar 4, "Empires spread." Shekere and the answering drum join; on 1580 the kakaki sound.
	groove(48, 60, { bass: 0.9, udu: 0.8, bell: 0.5, answer: 0.7, shaker: 0.6 });
	for (let s = 0; s < 5; s++) k.balafon(hum(ps(48 + s)), pl.balafon, N(2 + s), (0.6 + 0.06 * s) * g.balafon);
	k.kakaki(ps(53), pl.kakaki, 220, 4 * P, 0.8 * g.kakaki);
	k.kakaki(ps(57), pl.kakaki, 164.81, 3 * P, 0.75 * g.kakaki, 0.85);
	// Bar 5, "Between them, peoples ruled themselves." Everyone; the women call, the men answer.
	groove(60, 72, { bass: 1, udu: 0.9, bell: 0.6, answer: 0.8, shaker: 0.8 });
	for (let s = 0; s < 6; s++) k.balafon(hum(ps(60 + s)), pl.balafon, N(4 + s), (0.65 + 0.05 * s) * g.balafon);
	k.voices(ps(66), pl.voices, 440, 2 * P, 'a', 'o', 3, 0.5 * g.voices, true, 0.97);
	k.voices(ps(68), pl.voices, 587.33, 1.5 * P, 'a', 'e', 3, 0.45 * g.voices, true, 0.96);
	k.voices(ps(69.5), pl.voices, 220, 2.5 * P, 'o', 'u', 4, 0.55 * g.voices, false, 0.95);

	// ---- 0:15.7 The map goes into the phone: a soft gong, and the courtyard thins for the product.
	k.iron(ps(72), pl.gong, 220, 0.45 * g.gong, 0.6);
	k.skinDrum(ps(72), pl.bass, 52, 0.5 * g.bass);
	groove(72, 96, { bell: 0.4, udu: 0.55, balafon: 0.5, shaker: 0.3 });
	// The motif, whole, over Oyo's story.
	flutePhrase([[78, 8, 3], [81, 7, 1], [82, 6, 2], [84, 5, 6, 0.98], [90, 6, 2], [92, 5, 1], [93, 3, 3, 0.97]], 0.85);

	// 0:20.9 "1472 · The Portuguese reach the coast." A ship's bell, far off; the men hum low.
	for (const [pulse, v] of [[96, 0.5], [97.5, 0.4], [102, 0.32], [103.5, 0.26]]) k.iron(ps(pulse), pl.kakaki, 1046.5, v, 0.3);
	k.voices(ps(96), pl.voices, 82.41, 10 * P, 'u', 'u', 4, 0.38 * g.voices, false, 1);
	groove(96, 106, { bell: 0.3, udu: 0.5, shaker: 0.25, answer: 0.45 });

	// ---- 0:23.0 "1897 · The British invasion of Benin." Low drums gather; the drum speaks low and urgent.
	for (const [pulse, v] of [[106, 0.55], [109, 0.7], [112, 0.85]]) k.skinDrum(ps(pulse), pl.bass, 58, v * g.bass);
	speak([[108, 'L', 0.9, 0.5], [110, 'L', 0.9, 0.6], [111, 'M', 0.9, 0.55], [113, 'L', 0.88, 0.8]], 0.9);
	k.voices(ps(106), pl.voices, 110, fs(745) - ps(106), 'a', 'a', 5, 0.45 * g.voices, false, 1);
	groove(106, 114, { bell: 0.35, shaker: 0.3 });

	// 0:24.8 The cut to Borno, divided four ways: one blow, and the rhythm is gone.
	const cut = fs(745);
	k.iron(cut, pl.gong, 110, 1.2 * g.gong);
	k.skinDrum(cut, pl.bass, 46, 1.1 * g.bass);
	k.voices(cut + 0.05, pl.voices, 110, 4.6, 'o', 'u', 5, 0.42 * g.voices, false, 0.98);
	// The lament: the motif fallen an octave, each note leaning down. "The empires ended."
	for (const [t, degree, len, fall] of [[25.6, 5, 0.9, 0.985], [26.55, 3, 0.55, 1], [27.15, 2, 0.55, 1], [27.75, 1, 0.7, 0.99], [28.5, 0, 1.4, 0.95]]) {
		k.flute(t, pl.flute, N(degree), len, 0.75 * g.flute, fall);
	}

	// ---- 0:30.0 "Their rulers still reign." The drum hails them; the kakaki answer; the courtyard comes back.
	speak([[138, 'H', 1, 0.9], [138.5, 'H', 1, 0.55], [139, 'M', 1, 0.7], [140, 'H', 1.06, 0.85], [141, 'L', 1, 0.75], [141.5, 'L', 1, 0.5], [142, 'M', 1, 0.8], [143, 'H', 0.94, 1]]);
	k.kakaki(ps(144.5), pl.kakaki, 220, 3 * P, 0.85 * g.kakaki);
	k.kakaki(ps(148), pl.kakaki, 164.81, 4 * P, 0.8 * g.kakaki, 0.85);
	groove(144, 186, { bell: 0.5, udu: 0.6, answer: 0.45, shaker: 0.45, balafon: 0.45, bass: 0.6 }, 1);
	// "See where they live today." The motif again, sure of itself now.
	flutePhrase([[162, 8, 3], [165, 7, 1], [166, 6, 2], [168, 5, 5, 0.98]], 0.85);
	// "And the states they built before." Voices for the past, and a soft gong as the kingdom draws in.
	k.voices(ps(174), pl.voices, 110, 6 * P, 'a', 'o', 4, 0.4 * g.voices, false, 0.98);
	k.voices(ps(174), pl.voices, 440, 6 * P, 'a', 'o', 3, 0.28 * g.voices, true, 0.98);
	k.iron(ps(177), pl.gong, 220, 0.5 * g.gong, 0.7);

	// ---- 0:40.4 Languages. The groove keeps going lightly; each reveal is its own people's instrument.
	const yo = on(1287);
	const ig = on(1382);
	const ha = on(1507);
	const light = { bell: 0.55, shaker: 0.55, balafon: 0.5, bass: 0.6, answer: 0.4 };
	groove(186, ig - 2, light);
	// Yoruboid: the dùndún says Yo-rù-bá, mid, low, high.
	speak([[yo, 'M', 1, 0.95], [yo + 1, 'L', 1, 0.85], [yo + 2, 'H', 1.04, 1], [yo + 2.5, 'H', 1, 0.5], [yo + 3, 'M', 0.97, 0.7]]);
	// Igboid: the udu's bloops and the ogene, the iron double bell; the groove's own bell steps aside.
	groove(ig - 2, ig + 8, { shaker: 0.5, bass: 0.6, balafon: 0.3 });
	for (const [at, pitch, v] of [[0, 66, 1], [1, 92, 0.7], [2.5, 78, 0.9], [4, 66, 0.6], [5.5, 92, 0.5]]) k.udu(hum(ps(ig + at)), pl.near, pitch, v);
	for (const [at, freq] of [[0, 784], [1, 587.33], [2, 587.33], [3, 784], [4, 587.33], [6, 784]]) k.iron(hum(ps(ig + at)), pl.bell, freq, 0.5 * g.bell, 0.15);
	groove(ig + 8, ha - 1, light);
	// Hausa: the kakaki, the long trumpets of the emirs' courts, close by this time, the pair a little apart.
	k.kakaki(ps(ha), pl.left, 220, 5 * P, 0.5 * g.kakaki);
	k.kakaki(ps(ha) + 0.04, pl.kakaki, 220, 5 * P, 0.6 * g.kakaki);
	k.kakaki(ps(ha + 5.5), pl.left, 164.81, 5 * P, 0.48 * g.kakaki, 0.82);
	k.kakaki(ps(ha + 5.5) + 0.04, pl.kakaki, 164.81, 5 * P, 0.55 * g.kakaki, 0.82);
	groove(ha - 1, 243, { bell: 0.5, shaker: 0.6, bass: 0.6, answer: 0.35 });

	// ---- 0:53.1 Black: a breath of nothing. 0:53.5 The last gong, the voices, and the question answered.
	k.iron(END, pl.gong, 110, 1.15 * g.gong);
	k.skinDrum(END, pl.bass, 52, 1.0 * g.bass);
	k.voices(END + 0.03, pl.voices, 110, 4.4, 'a', 'u', 5, 0.42 * g.voices, false, 0.98);
	k.voices(END + 0.05, pl.voices, 164.81, 4.0, 'a', 'u', 3, 0.28 * g.voices, false, 0.98);
	k.voices(END + 0.08, pl.voices, 440, 3.8, 'a', 'o', 3, 0.26 * g.voices, true, 0.98);
	const e = on(1604);
	flutePhrase([[e + 3, 8, 3], [e + 6, 7, 1], [e + 7, 6, 2], [e + 9, 5, 10]], 0.85);
	k.balafon(ps(e + 9), pl.balafon, N(0), 0.35 * g.balafon);
}
