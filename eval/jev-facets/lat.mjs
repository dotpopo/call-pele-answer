import { readFileSync } from 'node:fs';
import { BUILTIN_ADAPTERS } from '/workspace/work/call-pele-answer/skills/call-pele-answer/scripts/routers/systemone.mjs';
import { FACETS } from './decide.mjs';
const B = JSON.parse(readFileSync(new URL('./blocks.json', import.meta.url)));
const a = BUILTIN_ADAPTERS.find(x => x.name === 'classifier-systemone'); const ts = [];
for (let r = 0; r < 5; r++) { const texts = B.slice(r * 5, r * 5 + 5).map(b => b.text + ' ' + Math.random().toString(36).slice(2, 6));
  const t = Date.now(); await a.ask(texts, FACETS); ts.push(Date.now() - t); }
ts.sort((x, y) => x - y); console.log(JSON.stringify({ runs: ts.length, blocks: 5, questions: Object.keys(FACETS).length, ms: ts, median: ts[2] }));
