// rendercheck — check a built page as the browser paints it. Source-level checks cannot see paint
// cut off by an SVG's own viewport (a label or marker past the viewBox), a collapsed figure,
// sideways page overflow, or a script error. The browser is the oracle: each figure is screenshot
// as authored, then again with its overflow released; new ink outside the figure's box was being cut off.
// Strokes, markers and text all count as ink, so no geometry model is needed.
//
// Zero dependencies: a local Chrome/Chromium/Edge is driven over the DevTools pipe (fd 3/4).
// No browser found → { skipped } and the build goes on. Switch: --render-check on|off,
// config "renderCheck": false, PE_RENDER_CHECK=0. Default on; it costs one headless launch per page.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, delimiter } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const NAMES = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome', 'microsoft-edge', 'chrome-headless-shell'];
const FIXED = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
export function findBrowser(env = process.env) {
  if (env.PE_CHROME) return existsSync(env.PE_CHROME) ? env.PE_CHROME : null;
  for (const d of (env.PATH || '').split(delimiter)) for (const n of NAMES) for (const x of ['', '.exe']) { const p = join(d, n + x); if (d && existsSync(p)) return p; }
  return FIXED.find(p => existsSync(p)) || null;
}

// Minimal CDP client over --remote-debugging-pipe: messages are JSON terminated by \0.
function cdp(proc) {
  let id = 0, buf = '';
  const wait = new Map(), events = [];
  proc.stdio[4].on('data', d => {
    buf += d.toString('utf8');
    let k;
    while ((k = buf.indexOf('\0')) >= 0) {
      const msg = JSON.parse(buf.slice(0, k)); buf = buf.slice(k + 1);
      if (msg.id && wait.has(msg.id)) { const w = wait.get(msg.id); wait.delete(msg.id); msg.error ? w.no(new Error(msg.error.message)) : w.ok(msg.result); }
      else if (msg.method) events.push(msg);
    }
  });
  const send = (method, params = {}, sessionId) => new Promise((ok, no) => {
    const m = ++id; wait.set(m, { ok, no });
    proc.stdio[3].write(JSON.stringify({ id: m, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
  });
  return { send, events };
}

// Runs inside the page. Reveals every hidden beat/tab/view so each figure can be painted, then lists figures.
const PREP = `(() => {
  document.querySelectorAll('[hidden]').forEach(e => e.hidden = false);
  document.querySelectorAll('.pe-narrow,.pe-wide').forEach(e => e.style.display = 'block');
  const figs = [...document.querySelectorAll('svg')].filter(s => !s.parentElement.closest('svg') && !s.closest('button,.pe-bar,.pe-seg'));
  return figs.map((s, i) => { s.dataset.peRc = i; const r = s.getBoundingClientRect();
    const p = s.closest('section'); const h = p && p.querySelector('h2');
    return { i, w: r.width, h: r.height, panel: h ? h.textContent.replace(/^\\s*\\d+\\s*/, '').trim() : '' }; });
})()`;
const BOXES = `(() => [...document.querySelectorAll('[data-pe-rc]')].map(s => { const r = s.getBoundingClientRect();
  return { i: +s.dataset.peRc, x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; }))()`;
const SIZE = '({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight })';
const RELEASE = on => `(() => { document.querySelectorAll('[data-pe-rc]').forEach(s => s.style.overflow = ${on ? "'visible'" : "''"}); return 1; })()`;
// Pixel diff in the page: decode both full-page PNGs on a canvas; for each figure, count changed pixels in a
// ring around it that lie outside every figure's (guarded) box. Two screenshots per width, whatever the figure count.
const DIFF = (a, b, boxes, guard, margin) => `(async () => {
  const load = s => { const t = atob(s), u = new Uint8Array(t.length); for (let k = 0; k < t.length; k++) u[k] = t.charCodeAt(k); return createImageBitmap(new Blob([u], { type: 'image/png' })); };
  const [A, B] = await Promise.all([load(${JSON.stringify(a)}), load(${JSON.stringify(b)})]);
  const W = Math.min(A.width, B.width), H = Math.min(A.height, B.height), c = new OffscreenCanvas(W, H), g = c.getContext('2d');
  g.drawImage(A, 0, 0); const da = g.getImageData(0, 0, W, H).data; g.clearRect(0, 0, W, H);
  g.drawImage(B, 0, 0); const db = g.getImageData(0, 0, W, H).data;
  const bx = ${JSON.stringify(boxes)}, G = ${guard}, M = ${margin};
  const mask = new Uint8Array(W * H);
  for (const b of bx) for (let y = Math.max(0, Math.floor(b.y - G)); y < Math.min(H, Math.ceil(b.y + b.h + G)); y++) mask.fill(1, y * W + Math.max(0, Math.floor(b.x - G)), y * W + Math.min(W, Math.ceil(b.x + b.w + G)));
  const inside = (x, y) => mask[y * W + x] === 1;
  return bx.map(b => { let n = 0, far = 0;
    for (let y = Math.max(0, Math.floor(b.y - M)); y < Math.min(H, b.y + b.h + M); y++)
      for (let x = Math.max(0, Math.floor(b.x - M)); x < Math.min(W, b.x + b.w + M); x++) {
        const k = (y * W + x) * 4;
        if (Math.abs(da[k] - db[k]) > 24 || Math.abs(da[k + 1] - db[k + 1]) > 24 || Math.abs(da[k + 2] - db[k + 2]) > 24) {
          if (inside(x, y)) continue;
          n++; far = Math.max(far, Math.max(b.x - x, x - b.x - b.w, b.y - y, y - b.y - b.h)); }
      }
    return { i: b.i, n, far: Math.round(far) }; });
})()`;

export const MIN_PIXELS = 12, EDGE_GUARD = 2, MARGIN = 120;

// renderCheck(htmlPath) → { findings: [{rule, panel, message}], ms, skipped? }
export async function renderCheck(htmlPath, { browser = findBrowser(), widths = [1000, 390], timeout = 30000 } = {}) {
  const t0 = Date.now();
  if (!browser) return { findings: [], ms: 0, skipped: '没找到 Chrome/Chromium/Edge（设 PE_CHROME=路径，或 --render-check off）' };
  const dir = mkdtempSync(join(tmpdir(), 'pe-rc-'));
  const proc = spawn(browser, ['--headless=new', '--remote-debugging-pipe', '--no-sandbox', '--disable-gpu', '--no-first-run',
    '--no-default-browser-check', '--hide-scrollbars', '--force-device-scale-factor=1', `--user-data-dir=${dir}`, 'about:blank'],
    { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  const findings = [];
  let timer;
  const killed = new Promise((_, no) => { timer = setTimeout(() => no(new Error(`渲染检查超时（${timeout} ms）`)), timeout); proc.on('error', no); });
  const run = async () => {
    const { send, events } = cdp(proc);
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: s } = await send('Target.attachToTarget', { targetId, flatten: true });
    const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, s);
      if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception?.description || r.exceptionDetails.text || '').split('\n')[0]); return r.result.value; };
    await send('Runtime.enable', {}, s); await send('Page.enable', {}, s);
    for (const width of widths) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 }, s);
      const before = events.length;
      await send('Page.navigate', { url: pathToFileURL(htmlPath).href }, s);
      for (let k = 0; k < 100 && !events.slice(before).some(e => e.method === 'Page.loadEventFired'); k++) await new Promise(r => setTimeout(r, 30));
      await ev('document.fonts ? document.fonts.ready.then(() => 1) : 1');
      for (const e of events.slice(before).filter(e => e.method === 'Runtime.exceptionThrown'))
        findings.push({ rule: 'render/script-error', panel: '', width, message: `页面脚本报错：${(e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text || '').split('\n')[0]}` });
      const over = await ev('document.documentElement.scrollWidth - document.documentElement.clientWidth');
      if (over > 1) findings.push({ rule: 'render/page-overflow', panel: '', width, message: `${width}px 宽时页面横向溢出 ${over}px` });
      const figs = await ev(PREP);
      const live = figs.filter(f => {
        if (f.w >= 8 && f.h >= 8) return true;
        findings.push({ rule: 'render/collapsed', panel: f.panel, width, message: `图被压成 ${Math.round(f.w)}×${Math.round(f.h)}px` }); return false; });
      if (!live.length) continue;
      const boxes = (await ev(BOXES)).filter(b => live.some(f => f.i === b.i)), sz = await ev(SIZE);
      const clip = { x: 0, y: 0, width: sz.w, height: sz.h, scale: 1 };
      const shot = async () => (await send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true }, s)).data;
      const A = await shot(); await ev(RELEASE(true)); const B = await shot(); await ev(RELEASE(false));
      for (const d of await ev(DIFF(A, B, boxes, EDGE_GUARD, MARGIN))) if (d.n >= MIN_PIXELS)
        findings.push({ rule: 'render/clipped', panel: figs.find(f => f.i === d.i).panel, width, message: `图有内容画在边界外被裁掉（${d.n} 像素，最远 ${d.far}px）` });
    }
  };
  try { await Promise.race([run(), killed]); }
  catch (e) { findings.push({ rule: 'render/failed', panel: '', message: `渲染检查没跑完：${e.message}` }); }
  finally { clearTimeout(timer); proc.kill('SIGKILL'); try { rmSync(dir, { recursive: true, force: true }); } catch {} }
  // one finding per rule+panel: the same clip at two widths is one problem
  const seen = new Set();
  return { findings: findings.filter(f => { const k = f.rule + '|' + f.panel + '|' + f.message.replace(/\d+/g, ''); return seen.has(k) ? false : seen.add(k); }), ms: Date.now() - t0 };
}
