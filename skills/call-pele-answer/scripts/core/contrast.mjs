// contrast — WCAG contrast of the colours a page can paint, checked statically from theme data.
// Text must clear 4.5:1 and essential marks (chart series, semantic node strokes) 3:1 on the
// background they sit on, in light and dark, for every page palette and every swatch a panel can wear.
// Translucent mixes (color-mix in srgb) are composited first. Borders and faint hairlines are
// decoration and are not checked. Pairs mirror themes/pele.css and themes/palette-ui.mjs; when either
// changes how a colour is painted, change PAIRS here too (test/run.mjs pins both directions).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const TEXT_MIN = 4.5, MARK_MIN = 3;

const hex = h => { const s = h.replace('#', ''); const f = s.length === 3 ? s.split('').map(c => c + c).join('') : s; return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16)); };
const toHex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
export const mix = (a, b, p) => { const A = hex(a), B = hex(b); return toHex(A.map((v, i) => v * p + B[i] * (1 - p))); };
const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = c => { const [r, g, b] = hex(c).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const decls = s => Object.fromEntries([...s.matchAll(/(--pe-[\w-]+):\s*(#[0-9A-Fa-f]{3,6})/g)].map(m => [m[1], m[2]]));
export function baseTokens(css = readFileSync(fileURLToPath(new URL('../themes/pele.css', import.meta.url)), 'utf8')) {
  const light = decls(css.match(/:root\{([\s\S]*?)\}/)[1]);
  const dark = decls(css.match(/:root\[data-theme=dark\]\{([\s\S]*?)\}/)[1]);
  return { light, dark: { ...light, ...dark } };
}

const SEMANTIC = { red: 'bad', green: 'ok', yellow: 'warn', blue: 'new' };
const SERIES = ['blue', 'orange', 'green', 'red', 'cyan', 'yellow', 'purple', 'magenta'];

// One page state: mode × page palette × the swatch a panel wears (null = plain panel).
function pairs(t, mode, sw, studio) {
  const P = t['--pe-paper'], out = [];
  let accent = t['--pe-accent'] && t['--pe-accent'].startsWith('#') ? t['--pe-accent'] : t['--pe-blue'];
  let surface = t['--pe-surface'], panel = P, muted = t['--pe-muted'], accentText;
  if (sw) {
    const dk = mode === 'dark';
    accent = dk ? sw.l : sw.m;
    surface = dk ? mix(sw.d, P, 0.55) : mix(sw.l, P, 0.22);
    muted = mix(t['--pe-muted'], t['--pe-ink'], dk ? 0.55 : 0.65);   // palette-ui tint: --pe-muted
    accentText = dk ? sw.l : mix(sw.m, t['--pe-ink'], 0.55);           // palette-ui tint: --pe-accent-text
    panel = studio ? (dk ? mix(sw.d, P, 0.75) : mix(sw.l, P, 0.42)) : (dk ? mix(sw.d, P, 0.6) : mix(sw.l, P, 0.3));
  }
  const text = (what, fg, bg) => out.push({ what, kind: 'text', fg, bg, min: TEXT_MIN });
  const mark = (what, fg, bg) => out.push({ what, kind: 'mark', fg, bg, min: MARK_MIN });
  text('正文', t['--pe-ink'], panel);
  text('次要文字', muted, panel);
  text('次要文字（图框内）', muted, P);
  text('块编号/表头', accentText || accent, sw ? surface : panel);
  if (sw) text('块编号（块底色上）', accentText, panel);
  text('节点文字', t['--pe-ink'], surface);
  for (const [c, cls] of Object.entries(SEMANTIC)) {
    const k = c === 'blue' && sw ? accent : t[`--pe-${c}`];
    text(`${cls} 节点文字`, t['--pe-ink'], mix(k, P, 0.13));
    if (cls === 'bad') text('bad 节点强调文字', mix(k, t['--pe-ink'], 0.8), mix(k, P, 0.13));
    mark(`${cls} 节点描边`, k, P);
  }
  for (const c of SERIES) mark(`系列色 ${c}`, c === 'blue' && sw ? accent : t[`--pe-${c}`], P);
  if (sw && studio) text('调色器染色文字', accentText, panel);
  return out;
}

// check(registry?) → findings [{state, what, kind, fg, bg, ratio, min}]; empty means every pair clears.
export function check({ pages = [], swatches = [], auto = null, studio = false, css } = {}) {
  const base = baseTokens(css), found = [];
  const pageList = pages.length ? pages : [{ name: 'ink', light: {}, dark: {} }];
  for (const pg of pageList) for (const mode of ['light', 'dark']) {
    const t = { ...base[mode], ...(pg[mode] || {}) };
    for (const sw of [null, ...swatches.filter(s => !auto || auto.has(s.name))]) {
      const state = `${pg.name}/${mode}${sw ? '/' + sw.name : ''}${studio ? '/调色器' : ''}`;
      for (const p of pairs(t, mode, sw, studio)) {
        const r = ratio(p.fg, p.bg);
        if (r < p.min - 1e-9) found.push({ state, ...p, ratio: Math.round(r * 100) / 100 });
      }
    }
  }
  return found;
}
