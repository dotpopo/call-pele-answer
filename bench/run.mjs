// Router benchmark: form-family accuracy + median wall time per router (3 runs). node bench/run.mjs
// BENCH_ROUTERS=local,classifier,… to choose. Results → bench/results.json
import { readFileSync, writeFileSync } from 'node:fs';
import { createEngine } from '../skills/call-pele-answer/scripts/core/engine.mjs';
const cases = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url)));
const answer = '基准。\n\n' + cases.map((c, i) => `## b${i + 1}\n${c[1]}`).join('\n\n');
const engine = await createEngine();
const out = { date: new Date().toISOString(), blocks: cases.length, keyed: { typesafe: !!process.env.TYPESAFE_API_KEY, classifier: !!process.env.CLASSIFIER_API_KEY } };
for (const router of (process.env.BENCH_ROUTERS || 'local,classifier,systemone-free,typesafe,hybrid').split(',')) {
  const runs = [];
  for (let k = 0; k < 3; k++) { runs.push(await engine.route(answer, { router })); await new Promise(r => setTimeout(r, 600)); }
  const r = runs[2];
  // accuracy is judged on the router's own pick (proposed family after gates), before page composition
  const fam = b => (b.recomposed ? b.recomposed.split(' → ')[0] : b.family);
  const ok = r.blocks.filter((b, i) => fam(b) === cases[i][0]).length;
  const ms = runs.map(x => x.ms).sort((a, b) => a - b)[1];
  const wrong = r.blocks.map((b, i) => (fam(b) !== cases[i][0] ? `${i + 1}:${cases[i][0]}→${fam(b)}` : null)).filter(Boolean);
  out[router] = { accuracy: `${ok}/${cases.length}`, median_ms: ms, by: r.by, notes: r.notes, wrong };
  console.log(router.padEnd(15), `${ok}/${cases.length}`, `${String(ms).padStart(5)} ms`, r.by, r.notes.join(' '), wrong.join(' '));
}
writeFileSync(new URL('./results.json', import.meta.url), JSON.stringify(out, null, 2));
