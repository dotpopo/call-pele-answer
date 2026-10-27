// apply stripFigureTalk to labeled sets in place; drop blocks left under 40 chars (orphan captions)
import { readFileSync, writeFileSync } from 'node:fs';
import { stripFigureTalk } from './strip.mjs';
for (const f of ['real', 'runs']) {
  const B = JSON.parse(readFileSync(f + '.json'));
  const out = B.map(b => ({ ...b, text: stripFigureTalk(b.text) })).filter(b => b.text.length >= 40);
  const changed = out.filter((b, i) => b.text !== B.find(x => x.id === b.id).text).length;
  writeFileSync(f + '.json', JSON.stringify(out, null, 0).replace(/\},\{/g, '},\n{'));
  console.log(f, B.length, '->', out.length, 'kept;', changed, 'texts changed');
}
