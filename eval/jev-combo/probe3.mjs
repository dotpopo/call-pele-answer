import { TYPES } from '/workspace/work/call-pele-answer/skills/call-pele-answer/scripts/routers/catalog.mjs';
import fs from 'fs';
const C = {};
for (const [f, t] of Object.entries(TYPES)) for (const [k, v] of Object.entries(t)) C[k === 'flowchart' && f === 'structure' ? 'componentGraph' : k] = v.desc;
Object.assign(C, { table: 'several items described along the same attributes', callout: 'one warning, hard limit or key takeaway the reader must not miss', code: 'a command, code snippet or config', tabs: 'two or more alternative approaches, each described in detail', slider: 'how a result changes when one parameter is made larger or smaller' });
const q = {}; for (const [k, d] of Object.entries(C)) q[k] = { type: 'noul', instructions: `The text itself contains ${d}` };
const md = fs.readFileSync(process.argv[2], 'utf8').split(/\n(?=## )/).filter(s => s.startsWith('## '));
for (const s of md) {
  const r = await fetch('https://api.typesafe.ai/v1/systemone', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + process.env.TYPESAFE_API_KEY }, body: JSON.stringify({ state: s, model: 'jev-latest', questions: q }) }).then(r => r.json());
  const y = Object.entries(r.answers).map(([k, v]) => [k, v.noul]).sort((a, b) => b[1] - a[1]);
  console.log(s.split('\n')[0].slice(3, 18).padEnd(16), y.filter(x => x[1] >= 0.8).map(([k, v]) => k + ':' + v.toFixed(2)).join(' '), '| .7-.8:', y.filter(x => x[1] >= 0.7 && x[1] < .8).map(x => x[0]).join(','));
}
