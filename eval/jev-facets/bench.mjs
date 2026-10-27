import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BUILTIN_ADAPTERS } from '/workspace/work/call-pele-answer/skills/call-pele-answer/scripts/routers/systemone.mjs';
import { FACETS, decide } from '../../skills/call-pele-answer/scripts/core/facets.mjs';
const split = process.argv[2] || 't';
const blocks = JSON.parse(readFileSync(new URL('./blocks.json', import.meta.url))).filter(b => split === 'all' || b.split === split);
const CACHE = new URL('./answers.cache.json', import.meta.url);
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE)) : {};
const key = (q, t) => createHash('sha1').update(JSON.stringify([q, t])).digest('hex');
const need = {}; let requests = 0, ms = 0, errors = 0;
for (const b of blocks) for (const [n, q] of Object.entries(FACETS)) if (cache[key(q, b.text)] == null) (need[b.text] ??= {})[n] = q;
const texts = Object.keys(need);
if (texts.length) {
  const qs = Object.assign({}, ...Object.values(need));
  const a = BUILTIN_ADAPTERS.find(x => x.name === 'classifier-systemone');
  const t = Date.now();
  try { const r = await a.ask(texts, qs); requests++; ms = Date.now() - t;
    texts.forEach((tx, i) => { for (const [n, q] of Object.entries(qs)) { const v = r[i][n]?.noul; if (v == null) errors++; else cache[key(q, tx)] = v; } });
  } catch (e) { errors++; console.error('ask failed', e.message); }
  writeFileSync(CACHE, JSON.stringify(cache));
}
let top1 = 0, recall = 0, extra = 0; const miss = [];
for (const b of blocks) {
  const s = Object.fromEntries(Object.entries(FACETS).map(([n, q]) => [n, cache[key(q, b.text)] ?? 0]));
  const { primary, cands } = decide(s, b.text);
  const ok = b.gold.includes(primary); top1 += ok;
  const inC = b.gold.includes('prose') ? cands.length === 0 : cands.some(c => b.gold.includes(c)); recall += inC;
  extra += cands.filter(c => !b.gold.includes(c)).length;
  if (!ok) miss.push(`${b.id}: ${primary} [${cands.join(' ')}]`);
}
const n = blocks.length;
console.log(JSON.stringify({ split, blocks: n, questions: Object.keys(FACETS).length, top1: +(top1 / n).toFixed(3), recall: +(recall / n).toFixed(3), extra_per_block: +(extra / n).toFixed(2), live_requests: requests, live_ms: ms, errors }));
if (process.env.V) console.log(miss.join('\n'));
