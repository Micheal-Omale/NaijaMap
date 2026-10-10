// Renders the film's music from the site's own sound engine (src/lib/sound.ts), offline,
// so the score is the product's ensemble at sample accuracy, with no screen recording.
//
//   (dev server running: npx astro dev --background)
//   node docs/promo/render-score.mjs [baseUrl] [outDir]      (ONLY=A2-film renders just the film score)
//
// The ensemble is generative. SEED=<n> picks another take; the same seed always
// renders the same music. Writes A1-score.wav (the opening and the "film" scene,
// 60 s, or SECONDS) and the one-shots gong.wav, tap.wav, open.wav and chapter.wav, 48 kHz.

import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const OUT = process.argv[3] ?? 'film-public/audio';
const SEED = Number(process.env.SEED ?? 7);
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const RENDERS = [
	// The film's own score, written to picture (src/film/score-book.ts).
	['A2-film', 'film', 59],
	['A1-score', 'score', Number(process.env.SECONDS ?? 60)],
	['gong', 'gong', 9],
	['tap', 'tap', 1.5],
	['open', 'open', 3],
	['chapter', 'chapter', 2],
];

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => localStorage.setItem('niajmap.sound', 'off'));
await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 90000 });

const only = process.env.ONLY?.split(',');
for (const [name, what, seconds] of RENDERS.filter(([n]) => !only || only.includes(n))) {
	const b64 = await page.evaluate(
		async (what, seconds, seed) => {
			// A seeded random, so a take can be rendered again.
			let a = seed >>> 0;
			Math.random = () => {
				a = (a + 0x6d2b79f5) >>> 0;
				let t = a;
				t = Math.imul(t ^ (t >>> 15), t | 1);
				t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
				return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
			};
			const sound = await import('/src/lib/sound.ts');
			const rate = 48000;
			const c = new OfflineAudioContext(2, Math.round(seconds * rate), rate);
			const buf =
				what === 'film'
					? await (await import('/src/film/score-book.ts')).renderFilmScore(c)
					: what === 'score'
						? await sound.renderSoundscape(c, 'film')
						: await sound.renderCue(c, what);
			// 16-bit PCM WAV.
			const n = buf.length;
			const data = new DataView(new ArrayBuffer(44 + n * 4));
			const str = (o, s) => [...s].forEach((ch, i) => data.setUint8(o + i, ch.charCodeAt(0)));
			str(0, 'RIFF'); data.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt ');
			data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 2, true);
			data.setUint32(24, rate, true); data.setUint32(28, rate * 4, true); data.setUint16(32, 4, true);
			data.setUint16(34, 16, true); str(36, 'data'); data.setUint32(40, n * 4, true);
			const L = buf.getChannelData(0), R = buf.getChannelData(1);
			for (let i = 0; i < n; i++) {
				data.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
				data.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
			}
			const bytes = new Uint8Array(data.buffer);
			let s = '';
			for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
			return btoa(s);
		},
		what,
		seconds,
		SEED,
	);
	writeFileSync(`${OUT}/${name}.wav`, Buffer.from(b64, 'base64'));
	console.log(`${name}.wav (${seconds} s, seed ${SEED})`);
}
await browser.close();
