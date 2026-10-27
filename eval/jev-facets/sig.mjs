import { readFileSync } from 'node:fs'; import { createHash } from 'node:crypto';
import { FACETS, decide, stateOf, gridShape } from '../../skills/call-pele-answer/scripts/core/facets.mjs';
const cache = JSON.parse(readFileSync(new URL('./answers.cache.json', import.meta.url)));
const key = (q, t) => createHash('sha1').update(JSON.stringify([q, stateOf(t)])).digest('hex');
const [facet, filt] = process.argv.slice(2);
for (const f of (process.env.SET || 'real,runs,fresh,final').split(',')) for (const b of JSON.parse(readFileSync(new URL('./' + f + '.json', import.meta.url)))) {
  if (filt && !eval(filt)) continue;
  const v = cache[key(FACETS[facet], b.text)];
  console.log((v ?? -1).toFixed(2), b.gold.join('/'), f + ':' + b.id, b.text.replace(/\s+/g, ' ').slice(0, 90));
}
