// draw/no-draw confusion: prose blocks wrongly drawn, drawable blocks left as text, and process forms drawn on prose
import { readFileSync } from 'node:fs'; import { createHash } from 'node:crypto';
import { FACETS, decide } from './ref/facets055.mjs';
const cache = JSON.parse(readFileSync(new URL('./answers.cache.json', import.meta.url))); const key = (q, t) => createHash('sha1').update(JSON.stringify([q, t])).digest('hex');
const split = process.argv[2] || 't'; const sets = (process.env.SET || 'real,runs').split(',');
const PROC = ['flowchart','swimlane','stateDiagram','sequenceDiagram','agentflow','steps'];
let P = 0, wrong = 0, wrongProc = 0, D = 0, missed = 0;
for (const f of sets) for (const b of JSON.parse(readFileSync(new URL('./' + f + '.json', import.meta.url)))) {
  if (split !== 'all' && b.split !== split) continue;
  const s = Object.fromEntries(Object.keys(FACETS).map(n => [n, cache[key(FACETS[n], b.text)] ?? 0]));
  const p = decide(s, b.text).primary;
  if (b.gold[0] === 'prose') { P++; if (p !== 'prose' && !b.gold.includes(p)) { wrong++; if (PROC.includes(p)) wrongProc++; } }
  else { D++; if (p === 'prose') missed++; }
}
console.log(JSON.stringify({ split, prose_blocks: P, wrongly_drawn: wrong, of_which_process: wrongProc, draw_blocks: D, left_as_text: missed }));
