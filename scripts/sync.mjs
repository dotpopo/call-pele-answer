#!/usr/bin/env node
// One source, many artifacts: skills/call-pele-answer/SKILL.md front matter is the only place
// version and summary are written. This copies them into the Claude Code plugin manifests.
//   node scripts/sync.mjs          write the copies
//   node scripts/sync.mjs --check  exit 1 when any copy has drifted (CI and tests use this)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const at = p => join(root, p);

export function frontMatter(md) {
  const m = /^---\n([\s\S]*?)\n---/.exec(md);
  if (!m) throw new Error('SKILL.md has no front matter');
  const get = k => (new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(m[1]) || [])[1]?.trim();
  return { name: get('name'), version: get('version'), summary: get('summary') };
}

export function plan() {
  const src = frontMatter(readFileSync(at('skills/call-pele-answer/SKILL.md'), 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(src.version || '')) throw new Error(`bad version in SKILL.md: ${src.version}`);
  const files = [];
  const plugin = JSON.parse(readFileSync(at('.claude-plugin/plugin.json'), 'utf8'));
  files.push(['.claude-plugin/plugin.json', { ...plugin, name: src.name, version: src.version, description: src.summary }]);
  const market = JSON.parse(readFileSync(at('.claude-plugin/marketplace.json'), 'utf8'));
  market.plugins = market.plugins.map(p => p.name === src.name ? { ...p, version: src.version, description: src.summary } : p);
  files.push(['.claude-plugin/marketplace.json', market]);
  return files.map(([path, obj]) => ({ path, want: JSON.stringify(obj, null, 2) + '\n', have: readFileSync(at(path), 'utf8') }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const drift = plan().filter(f => f.want !== f.have);
  if (check) {
    for (const f of drift) console.error(`drift: ${f.path} differs from SKILL.md (run node scripts/sync.mjs)`);
    if (!drift.length) console.log('sync: all copies match SKILL.md');
    process.exitCode = drift.length ? 1 : 0;
  } else {
    for (const f of drift) { writeFileSync(at(f.path), f.want); console.log(`wrote ${f.path}`); }
    if (!drift.length) console.log('sync: nothing to do');
  }
}
