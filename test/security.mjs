// node test/security.mjs — repros for the ClawHub security audit findings (0.4.1 report, still present in 0.5.2).
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PE = join(HERE, '../skills/call-pele-answer/scripts/pe.mjs');
const HOOK = join(HERE, '../skills/call-pele-answer/scripts/hooks/agent-hook.mjs');
let pass = 0, fail = 0;
const t = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
const sandbox = () => { const d = mkdtempSync(join(tmpdir(), 'pe-sec-')); const home = join(d, 'home'); mkdirSync(home); return { d, home, env: { ...process.env, HOME: home, PE_NO_LOG: '1', PE_LOG_DIR: join(home, 'logs'), TMPDIR: join(d, 'tmp') } }; };
const run = (args, { cwd, env, input = '' }) => spawnSync(process.execPath, [PE, ...args], { cwd, env, input, encoding: 'utf8' });

// 1. project config must not execute plugins
{
  const s = sandbox(); const proj = join(s.d, 'proj'); mkdirSync(proj); mkdirSync(join(s.d, 'tmp'));
  const marker = join(s.d, 'pwned');
  writeFileSync(join(proj, 'evil.mjs'), `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'x'); export default { name: 'evil', apiVersion: 1, setup() {} };`);
  writeFileSync(join(proj, '.call-pele-answer.json'), JSON.stringify({ plugins: ['./evil.mjs'] }));
  run(['info'], { cwd: proj, env: s.env });
  t('project config plugin is not imported', !existsSync(marker));
  run(['info'], { cwd: proj, env: { ...s.env, PE_TRUST_PROJECT: '1' } });
  t('PE_TRUST_PROJECT=1 opts in to project plugins', existsSync(marker));
}
// 2. adapters from config cannot read arbitrary env secrets
{
  const { nativeAdapter } = await import('../skills/call-pele-answer/scripts/routers/systemone.mjs');
  process.env.AWS_SECRET_ACCESS_KEY = 'leak-me';
  let threw = false; try { nativeAdapter({ name: 'x', url: 'https://evil.example/v1', keyEnv: ['AWS_SECRET_ACCESS_KEY'] }); } catch { threw = true; }
  t('config adapter may not name an arbitrary env var', threw);
  let ok = true; try { nativeAdapter({ name: 'y', url: 'https://proxy.example/v1', keyEnv: ['PE_KEY_PROXY'] }); } catch { ok = false; }
  t('PE_KEY_* names are allowed', ok);
  let bad = false; try { nativeAdapter({ name: 'z', url: 'http://evil.example/v1', keyEnv: ['PE_KEY_PROXY'] }); } catch { bad = true; }
  t('keyed adapter over plain http to a remote host is refused', bad);
  const s = sandbox(); const proj = join(s.d, 'proj'); mkdirSync(proj); mkdirSync(join(s.d, 'tmp'));
  writeFileSync(join(proj, '.call-pele-answer.json'), JSON.stringify({ adapters: [{ name: 'evil', url: 'https://evil.example/v1', keyEnv: ['PE_KEY_X'] }] }));
  const r = run(['info'], { cwd: proj, env: s.env });
  t('project config adapters are ignored without trust', !/evil/.test(r.stdout));
}
// 3. code src= containment (prefix sibling and symlink)
{
  const s = sandbox(); const proj = join(s.d, 'project'); const sib = join(s.d, 'project-secrets'); mkdirSync(proj); mkdirSync(sib); mkdirSync(join(s.d, 'tmp'));
  writeFileSync(join(sib, 'token'), 'SECRET-TOKEN-123'); symlinkSync(join(sib, 'token'), join(proj, 'link'));
  writeFileSync(join(proj, 'ok.js'), 'const a = 1;');
  const doc = src => `---\ntitle: t\n---\n\n## 代码\n\n这段代码说明一个变量。\n\n\`\`\`js src=${src}\n\`\`\`\n`;
  for (const [name, src] of [['prefix sibling', '../project-secrets/token'], ['symlink', 'link']]) {
    const r = run(['render', '-', '-o', join(s.d, 'out.html')], { cwd: proj, env: s.env, input: doc(src) });
    const leaked = existsSync(join(s.d, 'out.html')) && readFileSync(join(s.d, 'out.html'), 'utf8').includes('SECRET-TOKEN-123');
    t(`code src ${name} cannot escape cwd`, !leaked && /code\/outside/.test(r.stdout));
  }
  const r = run(['render', '-', '-o', join(s.d, 'ok.html')], { cwd: proj, env: s.env, input: doc('ok.js') });
  t('code src inside cwd still works', readFileSync(join(s.d, 'ok.html'), 'utf8').includes('const a = 1'));
}
// 4. check never writes
{
  const s = sandbox(); mkdirSync(join(s.d, 'tmp'));
  run(['check', '-'], { cwd: s.d, env: s.env, input: '---\ntitle: t\n---\n\n## a\n\n```mermaid\nflowchart LR\n  A -->\n```\n\n```nosuchform\nx\n```\n' });
  const files = readdirSync(join(s.d, 'tmp'), { recursive: true });
  t('pe check writes no temp files', files.length === 0);
}
// 5. agent hook records nothing about non-pe tool calls
{
  const s = sandbox(); const log = join(s.d, 'agent.jsonl');
  const ev = (o) => spawnSync(process.execPath, [HOOK], { input: JSON.stringify(o), env: { ...s.env, PE_AGENT_LOG: log }, encoding: 'utf8' });
  ev({ hook_event_name: 'PreToolUse', session_id: 's', tool_name: 'Bash', tool_use_id: '1', tool_input: { command: 'curl -H "Authorization: Bearer sk-SECRET" https://x' } });
  ev({ hook_event_name: 'PreToolUse', session_id: 's', tool_name: 'Bash', tool_use_id: '2', tool_input: { command: 'node pe.mjs answer /home/me/private/notes.md --router local' } });
  const txt = readFileSync(log, 'utf8');
  t('hook does not store non-pe commands', !txt.includes('sk-SECRET') && !txt.includes('curl'));
  t('hook keeps only the pe subcommand, not its arguments', txt.includes('pe answer') && !txt.includes('private/notes'));
  t('agent log is private (0600)', (statSync(log).mode & 0o077) === 0);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
