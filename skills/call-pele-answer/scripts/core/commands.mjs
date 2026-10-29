// The one command table. pe --help is generated from it; test/skill.mjs checks docs, dispatch and
// every opts.* read against it. Add a command or flag here first.
export const COMMANDS = [
  { name: 'answer', usage: 'pe answer <answer.md|-> [-o page.html] [--router …] [--audit] [--strict]', about: 'route + derive + render', flags: ['o', 'router', 'audit', 'strict', 'device', 'theme', 'output', 'ste', 'lean'] },
  { name: 'options', usage: 'pe options <answer.md|-> [--json]', about: 'per block: components whose admission conditions pass, with evidence', flags: ['json', 'router', 'device'] },
  { name: 'assemble', usage: 'pe assemble <draft.md> --block <n|title> --use a,b[,c] [--as views|stack] [-o out.md]', about: 'insert their skeletons', flags: ['block', 'use', 'as', 'o'] },
  { name: 'render', usage: 'pe render <draft.md|-> [-o out] [--output html|markdown|json] [--theme pele] [--ste flavored|strict|off] [--lean]', about: 'render an authored draft', flags: ['o', 'output', 'theme', 'ste', 'lean', 'strict', 'device'] },
  { name: 'check', usage: 'pe check <draft.md|->', about: 'lint only, writes nothing', flags: ['strict'] },
  { name: 'route', usage: 'pe route <answer.md|-> [-o draft.md] [--render out.html] [--router auto|…] [--device desktop|mobile] [--json]', about: 'split and pick a form per block', flags: ['o', 'render', 'router', 'device', 'json'] },
  { name: 'tune', usage: 'pe tune', about: 'adjust admission thresholds from what was offered vs used', flags: [] },
  { name: 'stats', usage: 'pe stats [--last 50] [--json]', about: 'where the time goes (runs + agent hooks) and what to change', flags: ['last', 'json'] },
  { name: 'patch', usage: 'pe patch <page.html> --panel "<title>" < section.md', about: 'replace one panel of a built page', flags: ['panel', 'o'] },
  { name: 'info', usage: 'pe info', about: 'forms, routers, adapters, themes, outputs, rules, plugins', flags: [] },
  { name: 'config', usage: 'pe config [get | set <key> <value> | reset]', about: 'user config (~/.call-pele-answer/config.json)', flags: [] },
];
export const GLOBAL_FLAGS = [
  { name: 'annotate', usage: '--annotate on|off', about: '批注开关（默认开；配置 "annotate": false、PE_ANNOTATE=0 或稿件 annotate: off）' },
  { name: 'color', usage: '--color auto|plain', about: '自动配色（默认 auto；plain 恢复素色；配置 "color"、PE_COLOR 或稿件 color:）' },
  { name: 'palette', usage: '--palette on|off', about: '调色器开关（默认开；配置 "palette": false、PE_PALETTE=0 或稿件 palette: off）' },
  { name: 'render-check', usage: '--render-check on|off', about: '渲染检查：用本机 Chrome 截图找被裁掉的图、横向溢出、脚本报错（默认关，开了每页多 1–4 秒；--render-check on、配置 "renderCheck": true 或 PE_RENDER_CHECK=1 打开；没有浏览器就跳过）' },
  { name: 'trace', usage: '--trace', about: '打印各阶段耗时（总是写入 runs.jsonl，PE_TRACE=0 关闭）' },
];
export function helpText() {
  return ['pe — call-pele-answer CLI', '',
    ...COMMANDS.flatMap(c => [`  ${c.usage}`, `      ${c.about}`]), '',
    ...GLOBAL_FLAGS.map(f => `  ${f.usage.padEnd(20)}${f.about}`)].join('\n');
}
