import { readFileSync, writeFileSync } from 'node:fs'; import { createHash } from 'node:crypto';
import { FACETS, decide, gridShape } from '../../skills/call-pele-answer/scripts/core/facets.mjs';
const cache = JSON.parse(readFileSync('answers.cache.json')); const key = (q, t) => createHash('sha1').update(JSON.stringify([q, t])).digest('hex');
const rows = JSON.parse(readFileSync('real.json')).map(b => { const s = Object.fromEntries(Object.keys(FACETS).map(n => [n, cache[key(FACETS[n], b.text)] ?? 0]));
  return { split: b.split, y: b.gold[0] === 'prose' ? 0 : 1, rule: decide(s, b.text).primary === 'prose' ? 0 : 1, x: [...Object.values(s), +gridShape(b.text), Math.min(b.text.length / 500, 2)] }; });
writeFileSync('/tmp/draw.json', JSON.stringify(rows));
