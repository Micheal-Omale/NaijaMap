// Renders the promo film so that no frame can come out blank. Under full load Chrome now and
// then hands back a frame with nothing painted (a parchment flash), so the film is rendered as
// a still sequence, every frame is checked against its neighbours, any flash is rendered again
// on its own, and only then is the picture encoded with the separately rendered sound.
//   node scripts/render-film.mjs            -> out/before-the-lines.mp4 (-14 LUFS)
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { bundle } from '@remotion/bundler';
import { renderFrames, renderMedia, renderStill, selectComposition } from '@remotion/renderer';

const browserExecutable = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FFMPEG = 'node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe';
const SCAN = process.env.SCAN ?? 'C:/Users/LENOVO/AppData/Local/CapCut/Apps/9.3.0.3970/ffmpeg.exe'; // has the scale filter
const OUT = path.resolve('out');
const FRAMES = path.join(OUT, 'frames');
const inputProps = JSON.parse(readFileSync('render-props.json', 'utf8'));
const common = { browserExecutable, inputProps, timeoutInMilliseconds: 120000, chromiumOptions: { gl: 'angle' } };

rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts'), publicDir: path.resolve('film-public') });
const composition = await selectComposition({ serveUrl, id: 'BeforeTheLines', ...common });
const n = composition.durationInFrames;
const pad = String(n - 1).length;
const file = (i) => path.join(FRAMES, `f${String(i).padStart(pad, '0')}.jpeg`);

await renderFrames({
	composition, serveUrl, ...common, outputDir: FRAMES, imageFormat: 'jpeg', jpegQuality: 92,
	imageSequencePattern: 'f[frame].[ext]', onStart: () => console.log(`rendering ${n} frames`), onFrameUpdate: () => {},
});
await renderMedia({ composition, serveUrl, ...common, codec: 'wav', outputLocation: path.join(OUT, 'before-the-lines.wav') });

/** Every frame as 27 x 48 grey, to compare neighbours. */
function thumbs() {
	const raw = execFileSync(SCAN, ['-v', 'error', '-framerate', '30', '-start_number', '0', '-i', path.join(FRAMES, `f%0${pad}d.jpeg`),
		'-vf', 'scale=27:48,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 30 });
	const size = 27 * 48;
	return Array.from({ length: raw.length / size }, (_, i) => raw.subarray(i * size, (i + 1) * size));
}
const mad = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;

/** A flash: one or two frames unlike the frames on both sides, which are like each other. */
function flashes(t) {
	const bad = new Set();
	for (let i = 1; i < t.length - 1; i++) {
		for (const k of [1, 2]) {
			if (i + k >= t.length) continue;
			if (mad(t[i - 1], t[i]) > 10 && mad(t[i - 1], t[i + k]) < 4) for (let j = i; j < i + k; j++) bad.add(j);
		}
	}
	return [...bad];
}

for (let pass = 1; ; pass++) {
	const bad = flashes(thumbs());
	console.log(`pass ${pass}: ${bad.length ? `flashes at ${bad.join(', ')}` : 'no flashes'}`);
	if (!bad.length) break;
	// A flash that renders the same three times is in the film itself: look at it.
	if (pass === 4) {
		console.warn(`still there after three re-renders, check by eye: ${bad.join(', ')}`);
		break;
	}
	for (const frame of bad) await renderStill({ composition, serveUrl, ...common, frame, output: file(frame), imageFormat: 'jpeg', jpegQuality: 92 });
}

const raw = path.join(OUT, 'before-the-lines.raw.mp4');
execFileSync(FFMPEG, ['-y', '-v', 'error', '-framerate', '30', '-start_number', '0', '-i', path.join(FRAMES, `f%0${pad}d.jpeg`),
	'-i', path.join(OUT, 'before-the-lines.wav'), '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p',
	'-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', raw]);
execFileSync('node', ['scripts/loudnorm.mjs', raw, path.join(OUT, 'before-the-lines.mp4')], { stdio: 'inherit' });
console.log(`${readdirSync(FRAMES).length} frames encoded`);
