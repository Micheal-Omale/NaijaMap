// Captures clean 9:16 "plates" of the real map for the promo film (docs/promo/).
//
// The window is 1480 x 1920 CSS pixels: the side panel takes the first 400, so the
// map is exactly 1080 x 1920, and at device scale 2 each plate is 2160 x 3840, with
// room to push in. The map's own overlays (timeline, caption chips, hint, zoom and
// credit) are hidden so the plate is the map alone; the film credits GRID3 and
// Natural Earth on its end card instead.
//
// Every plate but the event views shares one camera, Nigeria filling the width and
// sitting low, so the north stays clear for the film's headlines and the sweep plates
// dissolve in register. A plate is shot only once the map has drawn: the style and
// tiles loaded, the history layers holding features, the map idle, and the ink soaked.
//
// Runs against the dev server, which exposes the map (window.__niajmap):
//   npx astro dev --background
//   npm i --no-save puppeteer-core
//   node docs/promo/capture-plates.mjs [baseUrl] [outDir]
//
// The dev server shows draft data. Publish what the film shows before it is posted.
// CHROME=<path to chrome.exe> overrides the browser; ONLY=p02,sweep-1255 re-shoots
// just the plates whose names start with those. Plates are JPEG (quality 95).

import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const OUT = process.argv[3] ?? 'film-public/plates';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PANEL = 400;
const W = 1080;
const H = 1920;
/** Nigeria across the full width, its centre a little below the frame's. */
const CAMERA = { center: [8.65, 10.2], zoom: 5.94, bearing: 0, pitch: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const then = (year, extra = '') => `/?mode=then&year=${year}${extra}`;

/** [file name, path, what to do before the shot, keep the view's own camera] */
const PLATES = [
	['p01-today-atlas', '/'],
	['p02-then-1600-statelines', then(1600), 'stateLines'],
	['p03-then-1600', then(1600)],
	...[1000, 1180, 1255, 1300, 1380, 1400, 1440, 1472, 1500, 1515, 1535, 1580, 1650, 1700, 1750, 1800, 1808, 1850].map((y) => [`sweep-${y}`, then(y)]),
	['p21-benin-1897', then(1897, '&event=benin-expedition-1897'), null, true],
	['p22-borno-divided-1902', then(1902, '&event=kanem-bornu-partition'), null, true],
	['p23-then-today', then('today')],
	['p24-today-igala', '/?group=igala'],
];

const HIDE = `
	astro-dev-toolbar, .timeline, .explain-hint, .map-credit, .lower-third,
	.maplibregl-ctrl-top-right, .maplibregl-ctrl-bottom-right, .maplibregl-ctrl-bottom-left { display: none !important; }
`;

/**
 * Waits until the map has really drawn this view, not merely stopped changing. The
 * map never reports loaded() while ships and walkers animate, so the signal is the
 * history layers holding features (they arrive several seconds after the style).
 */
async function drawn(page, history) {
	await page.waitForFunction(() => window.__niajmap, { timeout: 90000, polling: 250 });
	if (history) {
		await page
			.waitForFunction(
				() => ['hist-shapes', 'hist-towns', 'ev-routes'].some((s) => window.__niajmap.getSource(s) && window.__niajmap.querySourceFeatures(s).length),
				{ timeout: 60000, polling: 250 },
			)
			.catch(() => console.warn('  no history features drawn'));
	} else await wait(5000);
	await page.evaluate(() => window.__niajmap.triggerRepaint());
	// The ink soaks in over about 760 ms; give it, the tiles and any burst time to finish.
	await wait(4000);
}

const MAX_TRIES = 8;
async function settled(page, name) {
	const clip = { x: PANEL, y: 0, width: W, height: H };
	let last = Buffer.from(await page.screenshot({ type: 'jpeg', quality: 95, clip, captureBeyondViewport: false }));
	for (let i = 0; i < MAX_TRIES; i++) {
		await wait(1500);
		const next = Buffer.from(await page.screenshot({ type: 'jpeg', quality: 95, clip, captureBeyondViewport: false }));
		if (next.equals(last)) return next;
		last = next;
	}
	console.warn(`  ${name}: still changing (a ship or a walker?), keeping the last frame`);
	return last;
}

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
	executablePath: CHROME,
	headless: 'new',
	args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--enable-webgl'],
});

const only = process.env.ONLY?.split(',');
for (const [name, path, action, ownCamera] of PLATES.filter(([n]) => !only || only.some((o) => n.startsWith(o)))) {
	const page = await browser.newPage();
	await page.emulateMediaFeatures([
		{ name: 'prefers-color-scheme', value: 'light' },
		{ name: 'prefers-reduced-motion', value: 'no-preference' },
	]);
	await page.setViewport({ width: PANEL + W, height: H, deviceScaleFactor: 2 });
	await page.evaluateOnNewDocument(() => {
		try {
			localStorage.setItem('niajmap.sound', 'off');
			localStorage.setItem('niajmap.explain-hint', 'done');
		} catch {}
	});
	await page.goto(BASE + path, { waitUntil: 'networkidle0', timeout: 90000 }).catch((e) => console.warn(`${name}: ${e.message}`));
	await page.addStyleTag({ content: HIDE });
	const history = path.includes('mode=then');
	await drawn(page, history);
	if (action === 'stateLines') {
		await page.click('label.toggle input').catch(() => console.warn(`${name}: no state-lines toggle`));
		await wait(1500);
	}
	if (!ownCamera) {
		await page.evaluate((camera) => window.__niajmap.jumpTo(camera), CAMERA);
		await drawn(page, false);
	}
	writeFileSync(`${OUT}/${name}.jpg`, await settled(page, name));
	console.log(`plate ${name}`);
	await page.close();
}
await browser.close();
