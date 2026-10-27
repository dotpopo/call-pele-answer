import { readFileSync } from 'node:fs'; import { createHash } from 'node:crypto'; import { FACETS } from '../../skills/call-pele-answer/scripts/core/facets.mjs';
const cache = JSON.parse(readFileSync(new URL('./answers.cache.json', import.meta.url)));
const key = (q, t) => createHash('sha1').update(JSON.stringify([q, t])).digest('hex');
const B = JSON.parse(readFileSync(new URL('./blocks.json', import.meta.url)));
const ids = process.argv.slice(2);
for (const b of B.filter(b => ids.includes(b.id))) console.log(b.id, Object.entries(FACETS).map(([n, q]) => [n, cache[key(q.instructions ?? q, b.text)] ?? cache[key(q, b.text)]]).filter(([, v]) => v >= 0.5).map(([n, v]) => n + '=' + v.toFixed(2)).join(' '));
