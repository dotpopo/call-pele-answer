import { readFileSync } from 'node:fs';
import { BUILTIN_ADAPTERS } from '/workspace/work/call-pele-answer/skills/call-pele-answer/scripts/routers/systemone.mjs';
import { routeAsk, routeLocal } from '/workspace/work/call-pele-answer/skills/call-pele-answer/scripts/routers/engine.mjs';
const B = JSON.parse(readFileSync(new URL('./blocks.json', import.meta.url)));
const a = BUILTIN_ADAPTERS.find(x => x.name === 'classifier-systemone');
for (const [name, fn] of [['local', t => routeLocal(t)], ['jev-full(old)', t => routeAsk(t, a, 'full')]]) {
  const t0 = Date.now(); const r = await fn(B.map(b => b.text)); const ms = Date.now() - t0;
  const alias = { numbered: 'steps', stateDiagram: 'stateDiagram', prose: 'prose' };
  const out = { t: [0, 0], h: [0, 0] };
  r.blocks.forEach((x, i) => { const p = x.family === 'prose' ? 'prose' : (alias[x.type] || x.type || x.family); const ok = B[i].gold.includes(p) || B[i].gold.includes(x.family); out[B[i].split][0] += ok; out[B[i].split][1]++; });
  console.log(name, ms + 'ms', 'tune', (out.t[0] / out.t[1]).toFixed(3), 'held-out', (out.h[0] / out.h[1]).toFixed(3));
}
