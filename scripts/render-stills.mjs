// Renders proof stills of the promo film from one bundle.
//   node scripts/render-stills.mjs <outDir> <frame> [frame...]
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';

const [out = 'out', ...frames] = process.argv.slice(2);
const browserExecutable = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(out, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts'), publicDir: path.resolve('film-public') });
const composition = await selectComposition({ serveUrl, id: 'BeforeTheLines', browserExecutable });
for (const frame of frames.map(Number)) {
	await renderStill({ composition, serveUrl, frame, browserExecutable, output: path.resolve(out, `f${String(frame).padStart(4, '0')}.jpg`), imageFormat: 'jpeg', jpegQuality: 80, scale: 0.4 });
	console.log(`frame ${frame}`);
}
