// Records the film's interaction shots (R1 to R3) from the real site, as a phone would
// show them: a 432 x 768 touch viewport at 2.5x, so each frame is 1080 x 1920. Frames
// come from Chrome's screencast with their timestamps and are retimed to constant
// 30 fps with ffmpeg, so a slow frame is held, never sped up. Taps show a soft touch
// mark, as a phone's "show touches" does.
//
// Headless Chrome paints a 1080 x 1920 map at about 14 fps, so while the camera rolls
// the page's clock runs SLOW times slower (performance.now, Date.now, animation
// frames, timers, CSS animations) and the frames are retimed back: SLOW=3 gives about
// 40 fps of real motion.
//
//   (site running)  node docs/promo/capture-recordings.mjs [baseUrl] [outDir]
//
// ONLY=R2 re-shoots one. FFMPEG=<path> overrides ffmpeg. Writes <outDir>/R*.mp4 and
// <outDir>/markers.json (the second each key moment lands in each recording).

import puppeteer from 'puppeteer-core';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const OUT = process.argv[3] ?? 'film-public/rec';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
// CapCut's ffmpeg has no x264; Remotion's does.
const FFMPEG = process.env.FFMPEG ?? 'node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe';
const SLOW = Number(process.env.SLOW ?? 3);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const CLEAN = `
	astro-dev-toolbar, .profile__draft { display: none !important; }
	.film-touch { position: fixed; z-index: 2147483647; width: 46px; height: 46px; margin: -23px 0 0 -23px;
		border-radius: 50%; background: rgba(255,255,255,.55); box-shadow: 0 0 0 2px rgba(0,0,0,.18);
		pointer-events: none; animation: film-touch 520ms cubic-bezier(.22,1,.36,1) forwards; }
	@keyframes film-touch { 0% { transform: scale(.55); opacity: 0 } 18% { opacity: 1 } 100% { transform: scale(1.25); opacity: 0 } }
`;

/** Runs before the page's own scripts: a clock that can be slowed while the camera rolls. */
function slowClock() {
	const perf = performance.now.bind(performance);
	const offset = Date.now() - perf();
	const raf = window.requestAnimationFrame.bind(window);
	const st = window.setTimeout.bind(window);
	const si = window.setInterval.bind(window);
	let k = 1;
	let real0 = perf();
	let virt0 = real0;
	const now = () => virt0 + (perf() - real0) / k;
	window.__filmSlow = (next) => {
		virt0 = now();
		real0 = perf();
		k = next;
	};
	performance.now = now;
	Date.now = () => Math.round(offset + now());
	window.requestAnimationFrame = (cb) => raf(() => cb(now()));
	window.setTimeout = (fn, ms = 0, ...a) => st(fn, ms * k, ...a);
	window.setInterval = (fn, ms = 0, ...a) => si(fn, ms * k, ...a);
}

/** Taps the centre of the first element matching `selector` (and whose text includes `text`). */
async function tap(page, selector, text) {
	const handle = await page.evaluateHandle(
		(sel, text) => [...document.querySelectorAll(sel)].find((e) => !text || e.textContent.includes(text)),
		selector,
		text ?? '',
	);
	const el = handle.asElement();
	if (!el) throw new Error(`nothing to tap: ${selector} ${text ?? ''}`);
	const box = await el.boundingBox();
	const x = box.x + box.width / 2;
	const y = box.y + box.height / 2;
	await page.evaluate((x, y) => {
		const d = document.createElement('div');
		d.className = 'film-touch';
		d.style.left = `${x}px`;
		d.style.top = `${y}px`;
		document.body.append(d);
		setTimeout(() => d.remove(), 700);
	}, x, y);
	await wait(120 * SLOW);
	await page.touchscreen.tap(x, y);
}

/** Scrolls an element into the visible part of its scroller without recording it. */
const reveal = (page, selector, text) =>
	page.evaluate(
		(sel, text) => [...document.querySelectorAll(sel)].find((e) => e.textContent.includes(text))?.scrollIntoView({ block: 'start' }),
		selector,
		text,
	);

/** Each shot: where it starts, what to set up off camera, and what happens on camera. Marks are named moments. */
const SHOTS = {
	R1: {
		url: '/',
		action: async (page, mark) => {
			await wait(1200 * SLOW);
			await tap(page, '.search__input');
			await wait(500 * SLOW);
			await page.type('.search__input', 'Igala', { delay: 210 * SLOW });
			await wait(800 * SLOW);
			mark('select');
			await tap(page, '.search__option', 'Igala');
			await wait(3200 * SLOW);
			await tap(page, '.sheet__handle');
			await wait(900 * SLOW);
			await page.evaluate(() => document.querySelector('.kingdom-link')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
			await wait(1600 * SLOW);
			mark('tapKingdom');
			await tap(page, '.kingdom-link');
			await wait(6500 * SLOW);
		},
	},
	// A language branch, not a people: Yoruba and Yoruboid sit side by side in the list,
	// and the branch lights every area its peoples live in, however far apart.
	R4: {
		url: '/',
		action: async (page, mark) => {
			await wait(1000 * SLOW);
			await tap(page, '.search__input');
			await wait(400 * SLOW);
			await page.type('.search__input', 'Yoru', { delay: 200 * SLOW });
			await wait(1100 * SLOW);
			mark('suggest');
			await page.type('.search__input', 'boid', { delay: 170 * SLOW });
			await wait(700 * SLOW);
			mark('select');
			await tap(page, '.search__option--family', 'Yoruboid');
			await wait(3600 * SLOW);
			// A wider branch on both banks of the Niger, then a people rather than a branch.
			mark('clear1');
			await tap(page, '.search__clear');
			await wait(300 * SLOW);
			await page.type('.search__input', 'Igboid', { delay: 140 * SLOW });
			await wait(600 * SLOW);
			mark('igboid');
			await tap(page, '.search__option--family', 'Igboid');
			await wait(3600 * SLOW);
			mark('clear2');
			await tap(page, '.search__clear');
			await wait(300 * SLOW);
			await page.type('.search__input', 'Hausa', { delay: 140 * SLOW });
			await wait(600 * SLOW);
			mark('hausa');
			await tap(page, '.search__option:not(.search__option--family)', 'Hausa');
			await wait(5000 * SLOW);
		},
	},
	R2: {
		url: '/?mode=then&year=1750',
		setup: (page) => reveal(page, '.polity-row', 'Oyo Empire'),
		action: async (page, mark) => {
			await wait(1000 * SLOW);
			mark('tap');
			await tap(page, '.polity-row', 'Oyo Empire');
			await wait(11000 * SLOW);
		},
	},
	R3: {
		url: '/?mode=then&year=1472',
		setup: (page) => reveal(page, '.event-row', 'Portug'),
		action: async (page, mark) => {
			await wait(1000 * SLOW);
			mark('tap');
			await tap(page, '.event-row', 'Portug');
			await wait(12000 * SLOW);
		},
	},
};

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
	executablePath: CHROME,
	headless: 'new',
	args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--enable-webgl'],
});
const markers = {};
const only = process.env.ONLY?.split(',');

for (const [name, shot] of Object.entries(SHOTS).filter(([n]) => !only || only.includes(n))) {
	const page = await browser.newPage();
	await page.emulateMediaFeatures([
		{ name: 'prefers-color-scheme', value: 'light' },
		{ name: 'prefers-reduced-motion', value: 'no-preference' },
	]);
	await page.setViewport({ width: 432, height: 768, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true });
	await page.evaluateOnNewDocument(slowClock);
	await page.evaluateOnNewDocument(() => {
		try {
			localStorage.setItem('niajmap.sound', 'off');
			localStorage.setItem('niajmap.explain-hint', 'done');
		} catch {}
	});
	await page.goto(BASE + shot.url, { waitUntil: 'networkidle0', timeout: 90000 }).catch((e) => console.warn(`${name}: ${e.message}`));
	await page.addStyleTag({ content: CLEAN });
	await wait(6000);
	await shot.setup?.(page);
	await wait(1500);

	const dir = `${OUT}/.frames-${name}`;
	rmSync(dir, { recursive: true, force: true });
	mkdirSync(dir);
	const frames = [];
	const cdp = await page.createCDPSession();
	cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
		const file = `${dir}/${String(frames.length).padStart(5, '0')}.jpg`;
		writeFileSync(file, Buffer.from(data, 'base64'));
		frames.push({ file, t: metadata.timestamp });
		cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
	});
	await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
	await cdp.send('Animation.enable');
	await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW });
	await page.evaluate((k) => window.__filmSlow(k), SLOW);
	const t0 = Date.now() / 1000;
	markers[name] = {};
	await shot.action(page, (m) => (markers[name][m] = Date.now() / 1000 - t0));
	await cdp.send('Page.stopScreencast');
	await page.close();

	// Retime: each 1/30 s of real time shows the last frame painted by then, so a slow
	// frame is held. The sequence is then a plain image run for ffmpeg.
	const start = frames[0].t;
	for (const m of Object.keys(markers[name])) markers[name][m] = +((markers[name][m] - (start - t0)) / SLOW).toFixed(2);
	mkdirSync(`${dir}/seq`);
	const total = Math.floor(((frames.at(-1).t - start) / SLOW) * 30);
	for (let n = 0, i = 0; n <= total; n++) {
		const at = start + (n / 30) * SLOW;
		while (frames[i + 1] && frames[i + 1].t <= at) i++;
		copyFileSync(frames[i].file, `${dir}/seq/${String(n).padStart(5, '0')}.jpg`);
	}
	execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', '30', '-i', `${dir}/seq/%05d.jpg`,
		'-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-crf', '15', '-preset', 'slow', '-an', `${OUT}/${name}.mp4`]);
	const span = (frames.at(-1).t - start) / SLOW;
	console.log(`${name}: ${frames.length} frames over ${span.toFixed(1)} s (${(frames.length / span).toFixed(1)} fps captured)`, markers[name]);
	rmSync(dir, { recursive: true, force: true });
}
// Merged into what is there, so re-shooting one recording keeps the others' marks.
const previous = existsSync(`${OUT}/markers.json`) ? JSON.parse(readFileSync(`${OUT}/markers.json`, 'utf8')) : {};
writeFileSync(`${OUT}/markers.json`, JSON.stringify({ ...previous, ...markers }, null, '\t') + '\n');
await browser.close();
