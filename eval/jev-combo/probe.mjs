import { TYPES } from '/workspace/work/call-pele-answer/skills/call-pele-answer/scripts/routers/catalog.mjs';
import fs from 'fs';
const C = {};
for (const [f, t] of Object.entries(TYPES)) for (const [k, v] of Object.entries(t)) C[k === 'flowchart' ? (f === 'steps' ? 'flowchart' : 'componentGraph') : k] = v.desc;
Object.assign(C, { table: 'a table comparing items across the same attributes', callout: 'a highlighted box with one warning, limit or key takeaway', stepper: 'a step-by-step walkthrough the reader clicks through one step at a time', tabs: 'tabs, one per alternative or sub-topic', slider: 'a slider the reader drags to see how a result changes with one parameter', code: 'a code or command snippet', text: 'plain paragraphs, no component' });
const q = { lead: { type: 'choice', instructions: 'The single component that best explains this block of an answer', criteria: C },
  count: { type: 'score', instructions: 'How many different components this block needs so a reader fully understands it', criteria: ['one is enough', 'two, each showing something the other cannot', 'three or more'] },
  arrange: { type: 'choice', instructions: 'If more than one component is used for this block, how should they be arranged', criteria: { single: 'only one component', views: 'the same content in different forms; the reader switches between them', stack: 'each component shows a different part or angle; all shown together one after another' } } };
for (const [k, d] of Object.entries(C)) q[`c_${k}`] = { type: 'noul', instructions: `Adding ${d} would show something about this block that the other forms would not` };
const md = fs.readFileSync(process.argv[2], 'utf8').split(/\n(?=## )/).filter(s => s.startsWith('## '));
const t0 = Date.now();
for (const s of md) {
  const r = await fetch('https://api.typesafe.ai/v1/systemone', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + process.env.TYPESAFE_API_KEY }, body: JSON.stringify({ state: s, model: 'jev-latest', questions: q }) }).then(r => r.json());
  const a = r.answers; if (!a) { console.log(JSON.stringify(r).slice(0, 300)); continue; }
  const yes = Object.entries(a).filter(([k]) => k.startsWith('c_')).map(([k, v]) => [k.slice(2), v.noul]).sort((x, y) => y[1] - x[1]);
  console.log(s.split('\n')[0].slice(0, 20), '| lead', a.lead.choice, a.lead.confidence?.toFixed(2), '| count', a.count.score?.toFixed(2), '| arrange', a.arrange.choice, JSON.stringify(a.arrange.probabilities));
  console.log('    lead top:', Object.entries(a.lead.probabilities||{}).sort((x,y)=>y[1]-x[1]).slice(0,6).map(([k,v])=>k+':'+v.toFixed(2)).join(' '));
  if(0)console.log('   ', yes.slice(0, 8).map(([k, v]) => `${k}:${v.toFixed(2)}`).join(' '), '| #>=.5', yes.filter(x => x[1] >= .5).length);
}
console.log('ms', Date.now() - t0);
