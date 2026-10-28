#!/usr/bin/env node
// Context budget ratchet (from gstack). Two ledgers:
//   always-on: the front matter every session's skill scanner loads
//   per call:  SKILL.md, read whole each time the skill runs (references load only on demand)
// Ceilings live in test/budget.json; test/skill.mjs fails when a reading exceeds its ceiling.
//   node scripts/budget.mjs           print readings vs ceilings
//   node scripts/budget.mjs --update  set ceilings to readings + 5 % headroom (commit with the change, say why)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIX = join(root, 'test', 'budget.json');

// Token estimate, not a tokenizer: CJK char ≈ 1 token, other text ≈ 4 chars per token.
export const estTokens = s => { const cjk = (s.match(/[\u3000-\u9fff\uff00-\uffef]/g) || []).length; return Math.ceil(cjk + (s.length - cjk) / 4); };

export function measure() {
  const md = readFileSync(join(root, 'skills', 'call-pele-answer', 'SKILL.md'), 'utf8');
  const fm = /^---\n([\s\S]*?)\n---/.exec(md)[0];
  return {
    always_on_frontmatter_bytes: Buffer.byteLength(fm),
    always_on_frontmatter_tokens_est: estTokens(fm),
    per_call_skill_bytes: Buffer.byteLength(md),
    per_call_skill_tokens_est: estTokens(md),
    per_call_skill_lines: md.split('\n').length,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const now = measure();
  if (process.argv.includes('--update')) {
    const cap = Object.fromEntries(Object.entries(now).map(([k, v]) => [k, Math.ceil(v * 1.05)]));
    writeFileSync(FIX, JSON.stringify(cap, null, 2) + '\n');
    console.log('wrote test/budget.json', cap);
  } else {
    let cap = {}; try { cap = JSON.parse(readFileSync(FIX, 'utf8')); } catch {}
    for (const [k, v] of Object.entries(now)) console.log(`${k.padEnd(36)} ${String(v).padStart(6)}  ≤ ${cap[k] ?? '—'}`);
  }
}
