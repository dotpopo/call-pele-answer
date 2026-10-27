// real blocks from SkillOpt target-model drafts: one draft per question (newest), up to 2 blocks each, text only
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { splitAnswer } from '../../skills/call-pele-answer/scripts/core/compose.mjs';
import { stripFigureTalk } from './strip.mjs';
import { deformat } from '../../skills/call-pele-answer/scripts/core/tableshape.mjs';
const files = execSync("find /workspace/work/pele-skillopt/runs -name draft.md -o -name answer.md | grep -v /skills/", { encoding: 'utf8' }).trim().split('\n');
const byQ = {};
for (const f of files) { const q = f.match(/pele-\d+/)?.[0]; if (!q) continue; const t = statSync(f).mtimeMs; if (!byQ[q] || byQ[q].t < t) byQ[q] = { f, t }; }
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const out = [];
for (const q of Object.keys(byQ).sort()) {
  let a; try { a = splitAnswer(readFileSync(byQ[q].f, 'utf8')); } catch { continue; }
  const bs = a.blocks.map((b, i) => {
    const forms = [...b.text.matchAll(/^\s*(?:```|~~~)(\w+)[^\n]*\n\s*([\w-]+)?/gm)].map(m => m[1] === 'mermaid' ? m[2] : m[1]);
    if (/^\s*\|.*\|\s*$/m.test(b.text)) forms.push('table');
    const text = deformat(b.text.replace(/^\s*(```|~~~)[\s\S]*?^\s*\1\s*$/gm, '').replace(/<!--[\s\S]*?-->/g, '')).replace(/\n{2,}/g, '\n').trim();
    const textS = stripFigureTalk(text);
    return { id: `q:${q}#${i + 1}`, title: b.title, authored: forms, text: textS.slice(0, 900) };
  }).filter(b => b.text.length >= 40);
  bs.sort(() => rnd() - 0.5); out.push(...bs.slice(0, 2));
}
writeFileSync('runs.raw.json', JSON.stringify(out, null, 1));
console.log(out.length, 'blocks from', Object.keys(byQ).length, 'questions');
