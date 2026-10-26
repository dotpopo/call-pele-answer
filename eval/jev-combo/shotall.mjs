// node shotall.mjs page.html outdir — screenshot every views pane and every steps beat
import puppeteer from 'puppeteer-core'; import fs from 'fs';
const [, , page, out] = process.argv; fs.mkdirSync(out, { recursive: true });
const b = await puppeteer.launch({ executablePath: '/workspace/tools/chr/root/usr/lib/chromium/chromium-headless-shell', args: ['--no-sandbox'], env: { ...process.env, LD_LIBRARY_PATH: '/workspace/tools/chr/root/usr/lib/aarch64-linux-gnu:/workspace/tools/chr/root/usr/lib/chromium' } });
const pg = await b.newPage(); await pg.setViewport({ width: 1000, height: 900, deviceScaleFactor: 1 });
await pg.goto('file://' + page); await new Promise(r => setTimeout(r, 2500));
const views = await pg.$$('.pe-views'); let n = 0;
for (let v = 0; v < views.length; v++) {
  const bs = await views[v].$$('.pe-seg button');
  for (let k = 0; k < Math.max(1, bs.length); k++) { if (bs[k]) { await bs[k].click(); await new Promise(r => setTimeout(r, 700)); } await views[v].screenshot({ path: `${out}/v${v + 1}-${k + 1}.png` }); n++; }
}
const steps = await pg.$$('.pe-steps'); 
for (let s = 0; s < steps.length; s++) {
  const btns = await steps[s].$$('button'); const labels = await Promise.all(btns.map(x => x.evaluate(e => e.textContent + '|' + (e.getAttribute('aria-label') || ''))));
  console.log('steps buttons', labels);
  const nextB = btns[labels.findIndex(l => l.includes('下一步'))]; const play = btns[labels.findIndex(l => l.includes('播放'))];
  if (play) { await play.click(); await new Promise(r => setTimeout(r, 200)); }
  for (let k = 0; k < 6; k++) { await steps[s].screenshot({ path: `${out}/s${s + 1}-${k}.png` }); n++; if (!nextB) break; await nextB.click(); await new Promise(r => setTimeout(r, 900)); }
}
for (const sel of ['.pe-callout']) { const els = await pg.$$(sel); for (let i = 0; i < els.length; i++) { await els[i].screenshot({ path: `${out}/c${i + 1}.png` }); n++; } }
const errs = await pg.$$eval('.pe-error, .mermaid-error, [id^=dmermaid]', e => e.length); console.log('shots', n, 'error nodes', errs);
await b.close();
