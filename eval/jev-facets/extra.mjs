import { readFileSync } from 'node:fs'; import { createHash } from 'node:crypto'; import { FACETS, decide } from '../../skills/call-pele-answer/scripts/core/facets.mjs';
const cache = JSON.parse(readFileSync(new URL('./answers.cache.json', import.meta.url)));
const key = (q, t) => createHash('sha1').update(JSON.stringify([q, t])).digest('hex');
const B = JSON.parse(readFileSync(new URL('./blocks.json', import.meta.url))).filter(b => b.split === (process.argv[2] || 't'));
const cnt = {};
for (const b of B) { const s = Object.fromEntries(Object.entries(FACETS).map(([n, q]) => [n, cache[key(q, b.text)] ?? 0]));
  for (const c of decide(s, b.text).cands) if (!b.gold.includes(c)) (cnt[c] ??= []).push(b.id); }
for (const [c, ids] of Object.entries(cnt).sort((a, b) => b[1].length - a[1].length)) console.log(c, ids.length, ids.join(' '));
