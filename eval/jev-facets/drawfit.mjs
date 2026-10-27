// dump draw/no-draw features for the gate fit: JEV facet probabilities + code facts
import { readFileSync, writeFileSync } from 'node:fs'; import { createHash } from 'node:crypto';
import { FACETS, decide, gridShape, codeFacts } from '../../skills/call-pele-answer/scripts/core/facets.mjs';
const cache = JSON.parse(readFileSync(new URL('./answers.cache.json', import.meta.url))); const key = (q, t) => createHash('sha1').update(JSON.stringify([q, t])).digest('hex');
const sets = (process.env.SET || 'real,runs').split(',');
const rows = sets.flatMap(f => JSON.parse(readFileSync(new URL('./' + f + '.json', import.meta.url)))).map(b => {
  const s = Object.fromEntries(Object.keys(FACETS).map(n => [n, cache[key(FACETS[n], b.text)] ?? 0]));
  return { id: b.id, split: b.split, gold: b.gold, y: b.gold[0] === 'prose' ? 0 : 1, rule: decide(s, b.text).primary, s, c: codeFacts(b.text) };
});
writeFileSync('/tmp/draw.json', JSON.stringify(rows)); console.log(rows.length, 'rows');
