// untouched test set: blocks from the same target-model drafts that runs.json did not sample
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { splitAnswer } from '../../skills/call-pele-answer/scripts/core/compose.mjs';
import { deformat } from '../../skills/call-pele-answer/scripts/core/tableshape.mjs';
import { stripFigureTalk } from './strip.mjs';
const used = new Set(JSON.parse(readFileSync('runs.raw.json')).map(b => b.id));
const files = execSync("find /workspace/work/pele-skillopt/runs -name draft.md -o -name answer.md | grep -v /skills/", { encoding: 'utf8' }).trim().split('\n');
const byQ = {};
for (const f of files) { const q = f.match(/pele-\d+/)?.[0]; if (!q) continue; const t = statSync(f).mtimeMs; if (!byQ[q] || byQ[q].t < t) byQ[q] = { f, t }; }
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const out = [];
for (const q of Object.keys(byQ).sort()) {
  let a; try { a = splitAnswer(readFileSync(byQ[q].f, 'utf8')); } catch { continue; }
  const bs = a.blocks.map((b, i) => ({ id: `q:${q}#${i + 1}`, text: stripFigureTalk(deformat(b.text.replace(/^\s*(```|~~~)[\s\S]*?^\s*\1\s*$/gm, '').replace(/<!--[\s\S]*?-->/g, '')).replace(/\n{2,}/g, '\n').trim()).slice(0, 900) }))
    .filter(b => b.text.length >= 40 && !used.has(b.id));
  bs.sort(() => rnd() - 0.5); out.push(...bs.slice(0, 1));
}
writeFileSync('fresh.raw.json', JSON.stringify(out, null, 1)); console.log(out.length);
