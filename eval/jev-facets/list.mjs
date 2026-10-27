import { readFileSync } from 'node:fs'; import { createHash } from 'node:crypto';
import { FACETS, decide, stateOf } from '../../skills/call-pele-answer/scripts/core/facets.mjs';
const cache = JSON.parse(readFileSync(new URL('./answers.cache.json', import.meta.url)));
const key = (q, t) => createHash('sha1').update(JSON.stringify([q, stateOf(t)])).digest('hex');
const sets = (process.env.SET || 'real,runs,fresh,final').split(',');
for (const f of sets) for (const b of JSON.parse(readFileSync(new URL('./' + f + '.json', import.meta.url)))) {
  const s = Object.fromEntries(Object.entries(FACETS).map(([n, q]) => [n, cache[key(q, b.text)] ?? 0]));
  const { primary } = decide(s, b.text); const prose = b.gold.includes('prose');
  const kind = b.gold.includes(primary) ? null : primary === 'prose' ? 'MISS' : prose ? 'WRONG' : 'WRONGFORM';
  if (!kind) continue;
  const hi = Object.entries(s).filter(([, v]) => v >= 0.5).map(([n, v]) => n + '=' + v.toFixed(2)).join(' ');
  console.log(`${kind} ${f}:${b.id} gold=${b.gold.join('/')} got=${primary} | ${hi}\n   ${b.text.replace(/\s+/g, ' ').slice(0, 220)}`);
}
