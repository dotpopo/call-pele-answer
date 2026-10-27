// tune-split view of process forms: gold vs facet values of the draw-gate questions
import { readFileSync } from 'node:fs'; import { createHash } from 'node:crypto';
import { FACETS, decide } from '../../skills/call-pele-answer/scripts/core/facets.mjs';
const cache = JSON.parse(readFileSync('answers.cache.json')); const key = (q, t) => createHash('sha1').update(JSON.stringify([q, t])).digest('hex');
const K = ['steps','decision','multi_branch','roles_handoff','states','loop_back','paths_merge','any_order','uses_previous','back_and_forth','transitions','advice'];
const P = ['flowchart','swimlane','stateDiagram','steps','sequenceDiagram'];
for (const f of ['blocks','real','runs']) for (const b of JSON.parse(readFileSync(f + '.json'))) {
  if (b.split !== 't') continue;
  const s = Object.fromEntries(Object.keys(FACETS).map(n => [n, cache[key(FACETS[n], b.text)] ?? 0]));
  const p = decide(s, b.text).primary;
  if (!P.includes(p) && !P.some(x => b.gold.includes(x))) continue;
  console.log((b.gold.includes(p) ? 'ok ' : 'BAD') , b.id.slice(0, 26).padEnd(26), ('gold=' + b.gold[0]).padEnd(20), ('got=' + p).padEnd(18), K.map(k => k.slice(0, 5) + '=' + (s[k] ?? 0).toFixed(2)).join(' '));
}
