// Renders index.html to an MP4 (1080x1920, 30fps, length = window.DUR).
//   node render.mjs [out.mp4] [--sub=4] [--nocap] [--stills=1.0,5.2,...]
// --sub=N renders N sub-frames per frame and blends them for real motion blur.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const dir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (n, d) => { const a = args.find(a => a.startsWith(`--${n}`)); return a ? (a.split('=')[1] ?? true) : d; };
const out = args.find(a => !a.startsWith('--')) || path.join(dir, path.basename(dir) + '.mp4');
const SUB = +flag('sub', 1), FPS = 30, WORKERS = 4;
const url = pathToFileURL(path.join(dir, 'index.html')).href + '?render' + (flag('nocap') ? '&nocap' : '');

const browser = await chromium.launch();
const open = async () => {
  const p = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await p.goto(url); await p.waitForFunction('window.READY'); return p;
};

const stills = flag('stills');
if (stills) {
  const p = await open();
  for (const t of String(stills).split(',')) {
    await p.evaluate(t => window.seek(t), +t);
    await p.screenshot({ path: `${out}-${(+t).toFixed(2)}.jpg`, type: 'jpeg', quality: 80 });
  }
  await browser.close(); process.exit(0);
}

const DUR = await (await open()).evaluate('window.DUR');
const total = Math.round(DUR * FPS * SUB);
const tmp = fs.mkdtempSync(path.join(path.dirname(out), '.frames-'));
let done = 0;
await Promise.all([...Array(WORKERS)].map(async (_, w) => {
  const p = await open();
  for (let i = w; i < total; i += WORKERS) {
    await p.evaluate(t => window.seek(t), i / (FPS * SUB));
    await p.screenshot({ path: path.join(tmp, `f${String(i).padStart(6, '0')}.jpg`), type: 'jpeg', quality: 95 });
    if (++done % 300 === 0) console.log(`${done}/${total}`);
  }
}));
await browser.close();

const vf = (SUB > 1 ? `tmix=frames=${SUB},fps=${FPS},` : '') + 'format=yuv420p';
await new Promise((res, rej) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS * SUB), '-i', path.join(tmp, 'f%06d.jpg'),
  '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-movflags', '+faststart', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', out],
  { stdio: 'inherit' }).on('exit', c => c ? rej(new Error('ffmpeg ' + c)) : res()));
fs.rmSync(tmp, { recursive: true });
console.log('wrote', out);
