#!/usr/bin/env node
// Install the one skill directory into each agent's skills folder.
//   node scripts/install.mjs [--target claude,codex,cursor,opencode|all] [--link] [--dry-run] [--home DIR]
// --link makes a symlink to this checkout (updates with git pull); default copies.
// Claude Code users can also use the plugin: /plugin marketplace add dotpopo/call-pele-answer
import { cpSync, existsSync, lstatSync, mkdirSync, rmSync, symlinkSync, readlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SRC = join(root, 'skills', 'call-pele-answer');
export const TARGETS = {
  claude: h => join(h, '.claude', 'skills'),
  codex: h => join(h, '.codex', 'skills'),
  agents: h => join(h, '.agents', 'skills'),   // shared skills dir read by Codex and other agents
  cursor: h => join(h, '.cursor', 'skills'),
  opencode: h => join(process.env.XDG_CONFIG_HOME || join(h, '.config'), 'opencode', 'skills'),
};

export function install({ targets = Object.keys(TARGETS), link = false, dry = false, home = homedir(), log = console.log } = {}) {
  const done = [];
  for (const t of targets) {
    if (!TARGETS[t]) throw new Error(`unknown target ${t} (use ${Object.keys(TARGETS).join(', ')})`);
    const dest = join(TARGETS[t](home), 'call-pele-answer');
    if (resolve(dest) === resolve(SRC)) { log(`${t}: already the source, skipped`); continue; }
    log(`${t}: ${link ? 'link' : 'copy'} → ${dest}`);
    if (!dry) {
      mkdirSync(dirname(dest), { recursive: true });
      const exists = existsSync(dest) || (() => { try { return lstatSync(dest).isSymbolicLink(); } catch { return false; } })();
      if (exists) rmSync(dest, { recursive: true, force: true });
      if (link) symlinkSync(SRC, dest, 'dir'); else cpSync(SRC, dest, { recursive: true });
    }
    done.push({ target: t, dest });
  }
  return done;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const val = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const tv = val('--target');
  const targets = !tv || tv === 'all' ? undefined : tv.split(',');
  install({ targets, link: a.includes('--link'), dry: a.includes('--dry-run'), home: val('--home') || homedir() });
  console.log('done. Node.js 18+ is the only requirement; no npm install.');
}
