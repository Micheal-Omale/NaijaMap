// Brings the film's mix to -14 LUFS integrated, -1.5 dBTP, the level Reels, TikTok and
// Shorts play at, in two passes (measure, then apply linearly). The picture is copied.
//   node scripts/loudnorm.mjs <in.mp4> <out.mp4>
// Remotion's bundled ffmpeg has no loudnorm; CapCut's does. FFMPEG=<path> overrides it.
import { execFileSync, spawnSync } from 'node:child_process';

const [input, output] = process.argv.slice(2);
const FFMPEG = process.env.FFMPEG ?? 'C:/Users/LENOVO/AppData/Local/CapCut/Apps/9.3.0.3970/ffmpeg.exe';
const TARGET = 'I=-14:TP=-1.5:LRA=11';

// ffmpeg prints the measurement on stderr.
const { stderr: log } = spawnSync(FFMPEG, ['-hide_banner', '-i', input, '-af', `loudnorm=${TARGET}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
const m = JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1));
const second = `loudnorm=${TARGET}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-i', input, '-c:v', 'copy', '-af', second, '-ar', '48000', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', output]);
console.log(`${output}: ${m.input_i} LUFS -> -14 LUFS`);
