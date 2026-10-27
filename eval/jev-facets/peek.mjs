import { readFileSync } from 'node:fs'; import { createHash } from 'node:crypto';
import { FACETS } from '../../skills/call-pele-answer/scripts/core/facets.mjs';
const cache = JSON.parse(readFileSync('answers.cache.json')); const key = (q, t) => createHash('sha1').update(JSON.stringify([q, t])).digest('hex');
const B = JSON.parse(readFileSync('real.json'));
for (const id of process.argv.slice(2)) { const b = B.find(x => x.id.endsWith(id)); const s = Object.entries(FACETS).map(([n, q]) => [n, cache[key(q, b.text)]]).filter(([, v]) => v >= 0.5); console.log(id, b.gold.join('/'), s.map(([n, v]) => `${n}=${v.toFixed(2)}`).join(' ')); }
