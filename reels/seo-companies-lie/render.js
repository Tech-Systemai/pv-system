// usage: node render.js frames|stills [t,t,...]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FR = process.env.NOCAP ? 'frames_nc' : 'frames';
const dir = __dirname, FPS = 30, WORKERS = 4;
(async () => {
  const mode = process.argv[2];
  const browser = await chromium.launch();
  const mk = async () => {
    const p = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    p.on('pageerror', e => console.error('PAGEERR', e.message));
    await p.goto('file://' + path.join(dir, 'index.html'));
    await p.evaluate(() => document.fonts.ready);
    if (process.env.NOCAP) await p.addStyleTag({ content: '#cap{display:none!important}' });
    return p;
  };
  if (mode === 'stills') {
    const p = await mk();
    fs.mkdirSync(path.join(dir, 'stills'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'sfx.json'), JSON.stringify(await p.evaluate(() => ({ sfx: SFX, dur: DUR }))));
    for (const t of process.argv[3].split(',').map(Number)) {
      await p.evaluate(t => render(t), t);
      await p.screenshot({ path: path.join(dir, 'stills', `t${t.toFixed(2)}.jpg`), type: 'jpeg', quality: 70 });
    }
  } else {
    fs.mkdirSync(path.join(dir, FR), { recursive: true });
    const p0 = await mk(); const dur = await p0.evaluate(() => DUR); await p0.close();
    const N = Math.round(dur * FPS);
    await Promise.all([...Array(WORKERS)].map(async (_, k) => {
      const p = await mk();
      for (let i = k; i < N; i += WORKERS) {
        await p.evaluate(t => render(t), i / FPS);
        await p.screenshot({ path: path.join(dir, FR, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 96 });
      }
    }));
    console.log('frames', N);
  }
  await browser.close();
})();
