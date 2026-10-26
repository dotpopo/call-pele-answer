import fs from 'fs';
const src = fs.readFileSync('probe.mjs','utf8'); // reuse C
import { TYPES } from '/workspace/work/call-pele-answer/skills/call-pele-answer/scripts/routers/catalog.mjs';
const C = {};
for (const [f, t] of Object.entries(TYPES)) for (const [k, v] of Object.entries(t)) C[k === 'flowchart' ? (f === 'steps' ? 'flowchart' : 'componentGraph') : k] = v.desc;
Object.assign(C, { table: 'a table comparing items across the same attributes', callout: 'a highlighted box with one warning, limit or key takeaway', stepper: 'a step-by-step walkthrough the reader clicks through one step at a time', tabs: 'tabs, one per alternative or sub-topic', slider: 'a slider the reader drags to see how a result changes with one parameter', code: 'a code or command snippet', text: 'plain paragraphs, no component' });
const ask = (s, q) => fetch('https://api.typesafe.ai/v1/systemone', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + process.env.TYPESAFE_API_KEY }, body: JSON.stringify({ state: s, model: 'jev-latest', questions: q }) }).then(r => r.json()).then(r => r.answers);
const md = fs.readFileSync(process.argv[2], 'utf8').split(/\n(?=## )/).filter(s => s.startsWith('## '));
for (const s of md) {
  const a = await ask(s, { lead: { type: 'choice', instructions: 'The single component that best explains this block of an answer', criteria: C },
    count: { type: 'score', instructions: 'How many different components this block needs so a reader fully understands it', criteria: ['one is enough', 'two, each showing something the other cannot', 'three or more'] },
    arrange: { type: 'choice', instructions: 'If more than one component is used, how should they be arranged', criteria: { single: 'only one component', views: 'the same content in different forms; the reader switches between them', stack: 'each component shows a different part or angle; all shown together one after another' } } });
  const chosen = [a.lead.choice]; const log = [a.lead.choice];
  while (chosen.length < 3) {
    const rest = Object.fromEntries(Object.entries(C).filter(([k]) => !chosen.includes(k)));
    const b = await ask(s, { next: { type: 'choice', instructions: `This block is already shown as: ${chosen.map(k => C[k]).join('; ')}. Pick the component that would show a different part or angle of it that those cannot`, criteria: rest },
      worth: { type: 'noul', instructions: `Besides ${chosen.map(k => C[k]).join('; ')}, the text contains important information those forms cannot show` } });
    log.push(`${b.next.choice}(${b.next.confidence.toFixed(2)},worth ${b.worth.noul.toFixed(2)})`);
    if (b.worth.noul < 0.5) break; chosen.push(b.next.choice);
  }
  console.log(s.split('\n')[0].slice(3, 20).padEnd(18), a.arrange.choice.padEnd(6), 'count', a.count.score.toFixed(2), '→', log.join(' + '), '=> ', chosen.join('+'));
}
