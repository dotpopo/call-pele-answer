// extract real blocks from delivered answer drafts: text only (fences dropped, tables deformatted), authored forms kept as a hint
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { splitAnswer } from '../../skills/call-pele-answer/scripts/core/compose.mjs';
import { stripFigureTalk } from './strip.mjs';
import { deformat } from '../../skills/call-pele-answer/scripts/core/tableshape.mjs';
const D = '/workspace/work/answers/';
const out = [];
for (const f of readdirSync(D).filter(f => f.endsWith('.md') && !/rating-guide|clawhub-audit/.test(f)).sort()) {
  const a = splitAnswer(readFileSync(D + f, 'utf8'));
  a.blocks.forEach((b, i) => {
    const forms = [...b.text.matchAll(/^\s*(?:```|~~~)(\w+)[^\n]*\n\s*([\w-]+)?/gm)].map(m => m[1] === 'mermaid' ? m[2] : m[1]);
    if (/^\s*\|.*\|\s*$/m.test(b.text)) forms.push('table');
    const text = deformat(b.text.replace(/^\s*(```|~~~)[\s\S]*?^\s*\1\s*$/gm, '').replace(/<!--[\s\S]*?-->/g, '')).replace(/\n{2,}/g, '\n').trim();
    const textS = stripFigureTalk(text);
    if (textS.length >= 40) out.push({ id: `${f.replace('.md', '')}#${i + 1}`, title: b.title, authored: forms, text: textS.slice(0, 900) });
  });
}
writeFileSync('real.raw.json', JSON.stringify(out, null, 1));
console.log(out.length, 'blocks from', new Set(out.map(o => o.id.split('#')[0])).size, 'drafts');
