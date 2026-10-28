// Static contract tests for the skill itself (no network, milliseconds). Run alone: node test/skill.mjs
// Every failure names the one source to fix and the command to run. Fix discipline: AGENTS.md.
import { readFileSync, readdirSync, existsSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const S = join(root, 'skills', 'call-pele-answer');
const read = p => readFileSync(join(root, p), 'utf8');
let pass = 0, fail = 0;
const t = (name, ok, fix = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${ok || !fix ? '' : `\n    → ${fix}`}`); };

// 1. one source, many artifacts
{
  const { plan } = await import('../scripts/sync.mjs');
  const drift = plan().filter(f => f.want !== f.have).map(f => f.path);
  t('插件清单与 SKILL.md 的版本、简介一致', !drift.length, `源：SKILL.md front matter。跑 node scripts/sync.mjs，不要手改 ${drift.join(', ')}`);
}

// 2. command alignment: docs ⇄ command table ⇄ dispatch
const { COMMANDS, GLOBAL_FLAGS, helpText } = await import('../skills/call-pele-answer/scripts/core/commands.mjs');
{
  const names = new Set(COMMANDS.map(c => c.name));
  const flags = new Set([...GLOBAL_FLAGS.map(f => f.name), ...COMMANDS.flatMap(c => c.flags)]);
  const pe = readFileSync(join(S, 'scripts', 'pe.mjs'), 'utf8');
  const dispatched = new Set([...pe.matchAll(/case '([a-z-]+)'/g), ...pe.matchAll(/cmd === '([a-z-]+)'/g)].map(m => m[1]).filter(n => !['help'].includes(n)));
  const notInTable = [...dispatched].filter(n => !names.has(n)), notDispatched = [...names].filter(n => !dispatched.has(n));
  t('pe.mjs 分发的命令都在命令表里', !notInTable.length, `源：scripts/core/commands.mjs。补上 ${notInTable.join(', ')} 的 usage 和 flags`);
  t('命令表里的命令都有分发', !notDispatched.length, `源：scripts/pe.mjs run()。实现 ${notDispatched.join(', ')}，或从命令表删掉`);
  const read_ = ['pe.mjs', 'core/stats.mjs'].flatMap(f => [...readFileSync(join(S, 'scripts', f), 'utf8').matchAll(/opts\.([a-zA-Z_]+)/g)].map(m => m[1]));
  const undeclared = [...new Set(read_)].filter(f => !flags.has(f));
  t('代码读取的参数都在命令表声明', !undeclared.length, `源：scripts/core/commands.mjs。给对应命令声明 ${undeclared.map(f => '--' + f).join(', ')}`);
  const docs = ['skills/call-pele-answer/SKILL.md', ...readdirSync(join(S, 'references')).map(f => `skills/call-pele-answer/references/${f}`), 'README.md', 'README.en.md'];
  const badCmd = [], badFlag = [];
  for (const d of docs) {
    const txt = read(d).replace(/```[\s\S]*?```/g, m => /\bpe /.test(m) ? m : '');
    for (const m of txt.matchAll(/(?:^|[`\s(（])pe ([a-z][a-z-]*)/gm)) if (!names.has(m[1])) badCmd.push(`${d}: pe ${m[1]}`);
    for (const m of txt.matchAll(/(?<![\w-])--([a-z][a-z-]*)/g)) if (!m[1].startsWith('pe') && !m[1].startsWith('pele') && !flags.has(m[1]) && !['target', 'link', 'dry-run', 'home', 'check', 'update'].includes(m[1])) badFlag.push(`${d}: --${m[1]}`);
  }
  t('文档里写的 pe 子命令都存在', !badCmd.length, `${badCmd.slice(0, 5).join('; ')}。笔误改文档；新命令先进 scripts/core/commands.mjs 再实现`);
  t('文档里写的参数都存在', !badFlag.length, `${badFlag.slice(0, 5).join('; ')}。笔误改文档；新参数先在 scripts/core/commands.mjs 声明`);
  const help = execFileSync('node', [join(S, 'scripts', 'pe.mjs'), '--help'], { encoding: 'utf8' });
  t('pe --help 列出全部命令', COMMANDS.every(c => help.includes(`pe ${c.name}`)) && help === helpText() + '\n', '源：scripts/core/commands.mjs helpText()');
}

// 3. context budget ratchet: what every session loads and what each call reads
const { measure } = await import('../scripts/budget.mjs');
{
  const now = measure(), cap = JSON.parse(read('test/budget.json'));
  for (const k of Object.keys(cap)) t(`预算：${k} ${now[k]} ≤ ${cap[k]}`, now[k] <= cap[k], `意外变大就删冗余；确有功能需要，跑 node scripts/budget.mjs --update，和功能放同一个提交并写理由`);
  t('预算：每一项都有上限', Object.keys(now).every(k => k in cap), '跑 node scripts/budget.mjs --update');
}

// 4. structure contract: only the bytes software or the flow depends on, never whole sentences
{
  const md = readFileSync(join(S, 'SKILL.md'), 'utf8');
  const fm = /^---\n([\s\S]*?)\n---/.exec(md)[1];
  const desc = (/description: >-\n((?: {2}.*\n?)+)/.exec(fm)?.[1] || '').split('\n').map(s => s.trim()).join('');
  t('name 与目录名一致', /^name: call-pele-answer$/m.test(fm), '源：SKILL.md front matter');
  t(`description ≤ 1024 字符（现在 ${desc.length}）`, desc.length > 0 && desc.length <= 1024, '源：SKILL.md description；细节移到正文');
  const body = md.slice(md.indexOf('## 唯一流程'));
  const at = ['pe options', 'pe assemble', 'pe answer'].map(k => body.indexOf(k));
  t('五步流程顺序：pe options → pe assemble → pe answer', at.every(i => i >= 0) && at[0] < at[1] && at[1] < at[2], '源：SKILL.md「唯一流程」。这是流程骨架，改措辞可以，顺序和命令不能丢');
  t('流程提到 pe:use 标记（pe answer 靠它判断已组装）', md.includes('pe:use'), '源：SKILL.md 第 4 步');
  const safety = md.slice(md.indexOf('## 安全与诚实'), md.indexOf('## 参考'));
  t('安全与诚实一节仍在', md.includes('## 安全与诚实') && safety.length > 40, '源：SKILL.md「安全与诚实」，恢复该节');
  for (const ref of [...md.matchAll(/references\/([\w-]+\.md)/g)].map(m => m[1])) t(`引用的 references/${ref} 存在`, existsSync(join(S, 'references', ref)), '补文件或改引用');
}

// 5. install: one skill dir into every agent; Codex-style hosts get only name + description
{
  const { install, TARGETS } = await import('../scripts/install.mjs');
  const h = mkdtempSync(join(tmpdir(), 'pe-inst-'));
  const got = install({ home: h, log: () => {} });
  t('安装脚本把同一份技能装进每个 Agent 目录', got.length === Object.keys(TARGETS).length && got.every(g => existsSync(join(g.dest, 'SKILL.md')) && existsSync(join(g.dest, 'scripts', 'pe.mjs'))), '源：scripts/install.mjs');
  const keys = p => /^---\n([\s\S]*?)\n---/.exec(readFileSync(join(p, 'SKILL.md'), 'utf8'))[1].split('\n').filter(l => /^[\w-]+:/.test(l)).map(l => l.split(':')[0]);
  const byT = Object.fromEntries(got.map(g => [g.target, g.dest]));
  t('Codex / .agents 只保留 name、description', ['codex', 'agents'].every(k => keys(byT[k]).join() === 'name,description'), '源：scripts/install.mjs TRIM');
  t('Claude 保留完整 front matter', keys(byT.claude).length === keys(S).length, '源：scripts/install.mjs TRIM');
  const { lstatSync } = await import('node:fs');
  install({ home: h, link: true, targets: ['claude'], log: () => {} });
  t('--link 改为软链接，重复安装会覆盖', lstatSync(join(h, '.claude', 'skills', 'call-pele-answer')).isSymbolicLink());
  const dh = mkdtempSync(join(tmpdir(), 'pe-inst-'));
  install({ home: dh, dry: true, log: () => {} });
  t('--dry-run 不写文件', !existsSync(join(dh, '.claude')));
}

console.log(`\nskill: ${pass} passed, ${fail} failed`);
export const result = { pass, fail };
if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = fail ? 1 : 0;
