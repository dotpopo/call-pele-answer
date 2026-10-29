// node test/run.mjs — offline: remote adapters are tested against a local mock server.
process.env.PE_NO_LOG = '1';
// the render check launches a browser; CLI tests turn it off unless they test it (PE_RENDER_CHECK_TEST_ON)
if (!process.env.PE_RENDER_CHECK_TEST_ON) process.env.PE_RENDER_CHECK = '0';
import { lintProse, lintRouting, stripSpans } from '../skills/call-pele-answer/scripts/lint/rules.mjs';
import { createEngine } from '../skills/call-pele-answer/scripts/core/engine.mjs';
import { createRegistry } from '../skills/call-pele-answer/scripts/core/registry.mjs';
import { nativeAdapter, shimAdapter } from '../skills/call-pele-answer/scripts/routers/systemone.mjs';
import { compose, scaffold, splitAnswer } from '../skills/call-pele-answer/scripts/core/compose.mjs';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
// tests never write to the user's logs or routing cache: re-run in an isolated log dir
if (!process.env.PE_TEST_ISOLATED) {
  const { spawnSync } = await import('node:child_process'); const { mkdtempSync } = await import('node:fs'); const { tmpdir } = await import('node:os');
  const iso = mkdtempSync(join(tmpdir(), 'pe-test-'));
  const r = spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env: { ...process.env, PE_TEST_ISOLATED: '1', PE_LOG_DIR: join(iso, 'logs') } });
  process.exit(r.status ?? 1);
}
const HERE = dirname(fileURLToPath(import.meta.url));
const PE = join(HERE, '../skills/call-pele-answer/scripts/pe.mjs');
let pass = 0, fail = 0;
const t = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
const rules = (units, o) => lintProse(units, o).map(f => f[1]);
const para = (text, kind = 'desc') => [{ text, line: 1, kind, para: true }];
const long = '这是一个非常非常长的段落句子它包含了远远超过四十五个汉字的内容用来测试检查器到底会不会对普通段落里的长句报警呢我们看看。';

console.log('— 文字规则（agentmore 的缺陷回归）');
t('普通段落长句会报', rules(para(long)).includes('sentence-length'));
t('声明 zh-CN 后仍检查', rules(para(long), { lang: 'zh' }).includes('sentence-length'));
t('“的”链按句计数', rules(para('我的朋友的老师的同事的孩子来了。')).includes('de-chain'));
t('“制作出来”不误报轻动词', !rules(para('他把模型制作出来以后发布。')).includes('light-verb'));
t('“进行优化”报轻动词', rules(para('我们对查询模块进行优化。')).includes('light-verb'));
t('引号里的词是元提及，不报', !rules(para('不要写“赋能”这种词。')).includes('filler'));
t('“可能/大约”是语气，不报', rules(para('请求可能失败，大约需要 3 秒。')).length === 0);
t('开场白报 preamble', rules(para('下面我来介绍一下 TCP。')).includes('preamble'));
t('列表以“等”结尾', rules(para('支持 Redis、MySQL 等。')).includes('open-list'));
t('英文 hedge 不报', rules(para('The request may have failed.'), { lang: 'en' }).length === 0);
t('strict 报分号', rules(para('Open the file; read line 3.'), { lang: 'en', mode: 'strict' }).includes('semicolon'));
t('stripSpans 去掉行内代码', !stripSpans('用 `赋能` 举例').includes('赋能'));

console.log('— 组合器');
const B = (text, scores) => ({ text, family: Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0], confidence: Math.max(...Object.values(scores)), scores });
const long2 = '这是一段足够长的文字，用来避免短文本惩罚，描述某个流程或结构的细节，内容长度超过四十个字符没有问题。';
const c1 = compose([B(long2, { slider: 0.9 }), B(long2, { slider: 0.9, chart: 0.6 })], { budget: { interactive: 1 } });
t('交互预算：第二个 slider 让位给 chart', c1[1].family === 'chart' && /交互预算/.test(c1[1].recomposed));
const c2 = compose([B('短句。', { steps: 0.9 })]);
t('一句话能说清 → 不升级', c2[0].family === 'prose');
const c3 = compose([B(long2, { timeline: 0.7, table: 0.3 })]);
t('备选形式进入 alternatives', c3[0].alternatives.includes('table'));

const c4 = compose([{ ...B(long2, { chart: 0.51 }), family: 'prose' }]);
t('组合器不把路由器留作文字的块升级（0.51 < 0.55）', c4[0].family === 'prose');
const { admit, assemble, usedComponents } = await import('../skills/call-pele-answer/scripts/core/admit.mjs');
const { BUILTIN_COMPONENTS: COMPS } = await import('../skills/call-pele-answer/scripts/core/components.mjs');
const fakeJev = p => ({ ask: async (texts, qs) => texts.map(() => Object.fromEntries(Object.keys(qs).map(k => [k, { noul: p[k.slice(4)] ?? 0.99 }]))) });
const ab = [{ title: '份额', text: '甲占 40%，乙占 35%，丙占 25%。' }, { title: '流程', text: '客户端发送请求给网关，网关调用服务后返回结果。' }];
await admit(ab, COMPS, fakeJev({}), { overrides: {}, log: false });
t('准入：硬条件挡住没有百分比的饼图', ab[0].options.some(o => o.name === 'pie') && !ab[1].options.some(o => o.name === 'pie'));
t('准入：有来回传递才提供时序图', ab[1].options.some(o => o.name === 'sequenceDiagram') && !ab[0].options.some(o => o.name === 'sequenceDiagram'));
const ab2 = [{ title: 'x', text: '客户端发送请求给网关，网关调用服务后返回结果。' }];
await admit(ab2, COMPS, fakeJev({ sequenceDiagram: 0.5 }), { overrides: {}, log: false });
t('准入：JEV 低于门槛不提供', !ab2[0].options.some(o => o.name === 'sequenceDiagram'));
await admit(ab2, COMPS, fakeJev({ sequenceDiagram: 0.5 }), { overrides: { sequenceDiagram: 0.4 }, log: false });
t('准入：门槛可被调参覆盖', ab2[0].options.some(o => o.name === 'sequenceDiagram'));
const ab3 = [{ title: 'x', text: '客户端发送请求给网关，网关调用服务后返回结果。' }];
await admit(ab3, COMPS, null, { overrides: {}, log: false });
t('准入：离线只提供脚本能担保的组件', ab3[0].options.length > 0 && !ab3[0].options.some(o => o.name === 'flowchart'));
const dr = '# T\n\n## 甲\n正文一句。\n\n## 乙\n另一句。\n';
const av = assemble(dr, { block: 1, use: ['sequenceDiagram', 'table'], as: 'views' }, COMPS);
t('拼装 views：组件在前，原文在最后', /```views\n=== sequenceDiagram\n~~~mermaid\nsequenceDiagram[\s\S]*=== table[\s\S]*=== 原文\n正文一句。/.test(av) && av.includes('## 乙\n另一句。'));
const as = assemble(dr, { block: '乙', use: ['callout'], as: 'stack' }, COMPS);
t('拼装 stack：正文后追加组件', /## 乙\n<!-- pe:use callout -->\n另一句。\n\n```callout\n/.test(as));
const ab4 = [{ title: 'x', text: '客户端发送请求给网关，网关调用服务后返回结果。' }];
await admit(ab4, COMPS, fakeJev({}), { overrides: {}, log: false });
t('准入：JEV 通过的组件超过 3 个时不丢，挪到可选', ab4[0].recommended.length <= 3 && ab4[0].options.length === ab4[0].recommended.length + ab4[0].possible.length && ab4[0].options.length > 3);
{ const { DERIVERS } = await import('../skills/call-pele-answer/scripts/core/compose.mjs');
  const d = DERIVERS.steps.map(f => f({ text: '先登录，然后提交，失败则重试，最后退出。' })).filter(Boolean);
  t('派生：带“失败则”的步骤不画成直线流程图', !d.some(v => v.label === '流程图'));
  const days = '**第1天：** 读文档\n\n**第2天：** 写代码\n\n**第3天：** 复盘';
  const tl = DERIVERS.timeline.map(f => f({ text: days })).filter(Boolean);
  t('派生：逐天计划成时间线，标签按天数', tl[0]?.label === '3 天计划' && !/学习计划/.test(tl[0].md)); }
{ const { createEngine } = await import('../skills/call-pele-answer/scripts/core/engine.mjs');
  const eg = await createEngine({});
  const doc = '# T\n\n结论一句。\n\n## 只有文字\n就一句话。\n';
  const loose = eg.build(doc, { output: 'markdown' }), tight = eg.build(doc, { output: 'markdown', strict: true });
  t('--strict：有 route 警告就不出页，平时照常出', !loose.errors.length && tight.errors.length > 0 && tight.errors.every(e => e[1].startsWith('route/'))); }
console.log('— 表格不再是安全默认');
const { tableShape, deformat, tablesIn } = await import('../skills/call-pele-answer/scripts/core/tableshape.mjs');
const shp = md => tableShape(tablesIn(md)[0]).kind;
t('表格形状：首列是步骤 → sequence', shp('| 步骤 | 做什么 |\n|---|---|\n| 1 | 写稿 |\n| 2 | 渲染 |\n| 3 | 检查 |') === 'sequence');
t('表格形状：有“拦在哪一步”列 → placed', shp('| 规则 | 拦在哪一步 | 原因 |\n|---|---|---|\n| 无标题 | 解析 | 缺 |\n| 超长 | lint | 太长 |\n| 无数据 | 渲染 | 空 |') === 'placed');
t('表格形状：两列全是数字 → numbers', shp('| 项 | 数字 |\n|---|---|\n| 超时 | 20 分钟 |\n| 命中率 | 70% |\n| 上限 | 8 |') === 'numbers');
t('表格形状：3 项 × 2 属性、值短 → comparison', shp('| 方案 | 速度 | 成本 |\n|---|---|---|\n| 甲 | 快 | 高 |\n| 乙 | 中 | 中 |\n| 丙 | 慢 | 低 |') === 'comparison');
t('去格式：表格行还原成列表项', /^- 甲：速度 快，成本 高$/m.test(deformat('| 方案 | 速度 | 成本 |\n|---|---|---|\n| 甲 | 快 | 高 |')));
const tb = [{ text: '| 规则 | 拦在哪一步 | 原因 |\n|---|---|---|\n| 无标题 | 解析 | 缺 |\n| 超长 | lint | 太长 |\n| 无数据 | 渲染 | 空 |' }, { text: '| 方案 | 速度 | 成本 |\n|---|---|---|\n| 甲 | 快 | 高 |\n| 乙 | 中 | 中 |\n| 丙 | 慢 | 低 |' }];
await admit(tb, COMPS, null, { overrides: {}, log: false });
t('准入：沿流程分布的规则表不提供 table；真对照才提供', !tb[0].options.some(o => o.name === 'table') && tb[1].options.some(o => o.name === 'table'));
const heavy = '---\ntitle: T\n---\n结论。\n\n## 甲\n| 规则 | 拦在哪一步 | 原因 |\n|---|---|---|\n| 无标题 | 解析 | 缺 |\n| 超长 | lint | 太长 |\n\n## 乙\n| 项 | 数字 |\n|---|---|\n| 超时 | 20 分钟 |\n| 命中率 | 70% |\n\n## 丙\n正文提到 20 分钟。\n';
const engT = await createEngine({ cwd: mkdtempSync(join(tmpdir(), "pe-t-")) });
const rh = engT.build(heavy);
t('lint：两块只有表格且无标记 → table-heavy 报错不出页', rh.errors.some(e => e[1] === 'route/table-heavy'));
t('lint：同一数字出现在两块 → dup-fact', engT.build(heavy.replace('## 乙', '## 乙\n<!-- pe:use table -->').replace('## 甲', '## 甲\n<!-- pe:use table -->')).warnings.some(w => w[1] === 'route/dup-fact'));
t('lint：用 pe:use table 标记后放行', !engT.build(heavy.replace('## 乙', '## 乙\n<!-- pe:use table -->').replace('## 甲', '## 甲\n<!-- pe:use table -->')).errors.length);
t('使用识别：mermaid 首词、表格、围栏', usedComponents('~~~mermaid\nstateDiagram-v2\n  a-->b\n~~~\n| a | b |\n|---|---|\n| 1 | 2 |\n```callout\nx\n```', COMPS).sort().join() === 'callout,stateDiagram,table');
{ const sa = splitAnswer('---\ntitle: T\nsubtitle: S\n---\n结论。\n\n## 运行\n\n```steps\n第一拍，客户端调用。\n---\n第二拍，返回结果。\n```\n');
  const d = scaffold({ title: sa.title, frontMatter: sa.frontMatter, lead: sa.lead, blocks: sa.blocks.map(b => ({ ...b, family: 'steps', confidence: 0.9, alternatives: [] })), auto: true });
  t('pe answer：已写成围栏的块原样保留、不重复', (d.match(/```steps/g) || []).length === 1 && !/^1\. ```/m.test(d));
  t('pe answer：保留原 front matter（subtitle）', /subtitle: S/.test(d)); }
console.log('— 注册表与插件');
const reg = createRegistry();
let threw = false; try { reg.use({ name: 'x', apiVersion: 99, setup() {} }); } catch { threw = true; }
t('apiVersion 不匹配的插件被拒绝', threw);
reg.api.form({ name: 'a', fences: ['z'], render: {} }); reg.api.form({ name: 'b', fences: ['z'], render: {} });
t('后注册的 form 覆盖同名围栏', reg.formFor('z').name === 'b');

// the plugin and adapter tests use a project config, so this test directory opts in as trusted
process.env.PE_TRUST_PROJECT = '1';
const dir = mkdtempSync(join(tmpdir(), 'pe-test-'));
writeFileSync(join(dir, 'p.mjs'), `export default { name: 'hello', apiVersion: 1, setup(api) { api.form({ name: 'hello', fences: ['hello'], render: { html: n => '<b class="hi">' + n.body.join('') + '</b>', markdown: n => 'HI ' + n.body.join('') } }); } };`);
writeFileSync(join(dir, '.call-pele-answer.json'), JSON.stringify({ plugins: ['./p.mjs'], routers: [{ name: 'only-local', strategy: 'local' }] }));
const eng = await createEngine({ cwd: dir });
const draft = '---\ntitle: t\n---\n结论一句。\n\n## 块\n\n```hello\nworld\n```\n\n```mermaid\nflowchart LR\n  A[开始] --> B[结束]\n```\n';
const out = eng.build(draft);
t('配置里的代码插件被加载并渲染', out.text.includes('<b class="hi">world</b>'));
t('html 只内联用到的形式资源', !out.text.includes('.pe-tablist button{') && out.text.includes('class="pele'));
t('markdown 输出走插件的 markdown 渲染', eng.build(draft, { output: 'markdown' }).text.includes('HI world'));
const ir = JSON.parse(eng.build(draft, { output: 'json', lean: true }).text);
t('json 输出是 IR v1，lean 去掉 SVG', ir.ir === 1 && !JSON.stringify(ir).includes('<svg'));
t('配置里声明的 router 可用', eng.info().routers.some(r => r.name === 'only-local'));

console.log('— System One 适配器（本地 mock）');
const srv = createServer((req, res) => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => {
  const j = JSON.parse(b); res.setHeader('content-type', 'application/json');
  if (req.url === '/v1/systemone') {
    const answers = {}; for (const [id, q] of Object.entries(j.questions)) answers[id] = q.type === 'choice' ? { type: 'choice', choice: Object.keys(q.criteria)[id === 'family' && /年/.test(j.state) ? Object.keys(q.criteria).indexOf('timeline') : 0], confidence: 0.95, probabilities: {} } : q.type === 'noul' ? { type: 'noul', noul: 0.9 } : { type: 'score', score: 1.5 };
    return res.end(JSON.stringify({ model: 'mock-s1', answers }));
  }
  if (req.url === '/v1/classify') return res.end(JSON.stringify({ model: 'mock-cls', results: j.inputs.map(x => ({ label: /年/.test(x) && j.labels.includes('timeline') ? 'timeline' : j.labels[0], confidence: 0.9, scores: { [j.labels[0]]: 0.9 } })) }));
  res.statusCode = 404; res.end('{}');
}); });
await new Promise(r => srv.listen(0, r));
const base = `http://127.0.0.1:${srv.address().port}`;
const qs = { family: { type: 'choice', instructions: 'f', criteria: { prose: 'p', timeline: 't' } }, n: { type: 'noul', instructions: 'x' }, s: { type: 'score', instructions: 'y', criteria: ['a', 'b', 'c'] } };
const nat = await nativeAdapter({ name: 'm1', url: `${base}/v1/systemone`, anonymousKey: 'unused' }).ask(['2019 年上线', '一句话'], qs);
t('native 适配器：每个 state 一份答案', nat.length === 2 && nat[0].family.choice === 'timeline' && nat[1].n.noul === 0.9);
const sh = await shimAdapter({ name: 'm2', url: `${base}/v1/classify` }).ask(['2019 年上线', '一句话'], qs);
t('shim 适配器：用批量分类模拟 choice/noul/score', sh[0].family.choice === 'timeline' && typeof sh[1].n.noul === 'number' && typeof sh[0].s.score === 'number');
writeFileSync(join(dir, '.call-pele-answer.json'), JSON.stringify({ adapters: [{ name: 'mock', kind: 'native', url: `${base}/v1/systemone`, anonymousKey: 'unused' }, { name: 'dead', kind: 'native', url: 'http://127.0.0.1:9/v1/systemone', anonymousKey: 'u' }], routers: [{ name: 'via-mock', strategy: 'full', adapter: 'mock' }, { name: 'broken', strategy: 'full', adapter: 'dead', fallback: 'via-mock' }] }));
const eng2 = await createEngine({ cwd: dir });
const rr = await eng2.route('结论。\n\n## 历史\n2019 年上线单体版本，2021 年拆分成微服务，2023 年接入海外支付。', { router: 'broken' });
t('router 失败沿 fallback 链降级', rr.by.startsWith('mock') && rr.notes.some(n => n.startsWith('broken')));
t('路由结果被组合并派生成多视图', rr.draft.includes('```views') && rr.draft.includes('=== 时间线')); if (!rr.draft.includes('```views')) console.log(rr.draft, JSON.stringify(rr.blocks));
srv.close();

console.log('— CLI');
const run = (args, input) => { try { return { code: 0, out: execFileSync('node', [PE, ...args], { input, encoding: 'utf8', cwd: dir }) }; } catch (e) { return { code: e.status, out: e.stdout + e.stderr }; } };
const bad = '---\ntitle: t\n---\n结论。\n\n## 图\n\n```mermaid\nflowchart LR\n  A -->\n```\n';
const r1 = run(['render', '-', '-o', join(dir, 'a.html')], bad);
t('Mermaid 语法错：不出页面，报草稿行号', r1.code === 1 && /L1[01] \[mermaid\/syntax\]/.test(r1.out));
const good = '---\ntitle: t\n---\n结论一句。\n\n## 流程\n\n```mermaid\nflowchart LR\n  A[开始] --> B[结束]\n```\n\n## 对比\n\n| 项 | A | B |\n|---|---|---|\n| 速度 | ok 快 | no 慢 |\n';
const page = join(dir, 'b.html');
t('render 成功', run(['render', '-', '-o', page], good).out.startsWith('✓'));
const r3 = run(['patch', page, '--panel', '流程'], '## 流程\n\n```mermaid\nflowchart LR\n  A[开始] --> C[中间] --> B[结束]\n```\n');
t('patch 只替换一个块', r3.code === 0 && readFileSync(page, 'utf8').includes('中间') && readFileSync(page, 'utf8').includes('速度'));
console.log('— 计时');
const { agentStats, cliStats } = await import('../skills/call-pele-answer/scripts/core/stats.mjs');
const ev = [{ ev: 'UserPromptSubmit', t: 0 }, { ev: 'PreToolUse', t: 1000, id: 'a', tool: 'Bash', cmd: 'node pe.mjs answer x', pe: true }, { ev: 'PostToolUse', t: 1300, id: 'a' }, { ev: 'PreToolUse', t: 2000, id: 'b', tool: 'WebSearch' }, { ev: 'PostToolUse', t: 4000, id: 'b' }, { ev: 'Stop', t: 10000 }];
const at = agentStats(ev)[0];
t('hook 事件 → 回合：模型 7.7 s、工具 2.3 s、pe 0.3 s', at.total === 10000 && at.tool === 2300 && at.pe === 300 && at.model === 7700);
const mk = agentStats([{ ev: 'Mark', step: 'research', t: 0 }, { ev: 'Mark', step: 'write', t: 3000 }, { ev: 'Mark', step: 'end', t: 5000 }])[0];
t('手动 mark → 每步耗时', mk.steps[0].ms === 3000 && mk.steps[1].ms === 2000);
const traceFile = join(dir, 'runs.jsonl');
execFileSync('node', [PE, 'render', '-', '-o', join(dir, 'c.html')], { input: good, env: { ...process.env, PE_TRACE_FILE: traceFile } });
const rec = JSON.parse(readFileSync(traceFile, 'utf8').trim().split('\n').pop());
t('每次运行写一行分阶段计时', rec.cmd === 'render' && rec.phases.parse > 0 && rec.phases['form:mermaid'] > 0 && cliStats([rec]).phases.length > 3);
const hookLog = join(dir, 'agent.jsonl');
execFileSync('node', [join(HERE, '../skills/call-pele-answer/scripts/hooks/agent-hook.mjs')], { input: JSON.stringify({ hook_event_name: 'PreToolUse', session_id: 's', tool_name: 'Bash', tool_input: { command: 'node pe.mjs render a.md' } }), env: { ...process.env, PE_AGENT_LOG: hookLog } });
t('hook 脚本读 stdin 记一行，识别 pe 调用', JSON.parse(readFileSync(hookLog, 'utf8')).pe === true);
console.log('— 调色器');
const { parsePalette } = await import('../skills/call-pele-answer/scripts/core/../themes/palette-ui.mjs');
t('palette 行解析', JSON.stringify(parsePalette('page=warm s2.1=cobalt, s4=mint')) === '{"page":"warm","s2.1":"cobalt","s4":"mint"}');
t('palette 细粒度键：背景 ~bg、段落、单元格、图形', JSON.stringify(parsePalette('lead.p1~bg=mustard s4.h=tomato s4.1.r2c1~bg=mint s5.1.g3=tomato')) === '{"lead.p1~bg":"mustard","s4.h":"tomato","s4.1.r2c1~bg":"mint","s5.1.g3":"tomato"}');
execFileSync('node', [PE, 'render', '-', '-o', join(dir, 'pal.html')], { input: good.replace('---\n', '---\npalette: page=warm s1=tomato\n') }); const palHtml = readFileSync(join(dir, 'pal.html'), 'utf8');
t('烘焙配色：data-pal 与 data-palette 写进页面，色板 CSS 在内', /data-pal="warm"/.test(palHtml) && /data-palette="page=warm s1=tomato"/.test(palHtml) && /\[data-pk\]/.test(palHtml) && /class="pe-pal"/.test(palHtml));
execFileSync('node', [PE, 'render', '-', '-o', join(dir, 'off.html')], { input: good.replace('---\n', '---\npalette: off\n') }); const offHtml = readFileSync(join(dir, 'off.html'), 'utf8');
t('palette: off 不带调色器', !/class="pe-pal"/.test(offHtml) && !/pe-studio/.test(offHtml));
console.log('— 自动配色');
{
  const e = await createEngine({});
  const md = '---\ntitle: 配色测试\n---\n结论。\n\n## 一\n甲。\n\n## 二\n乙。\n\n## 三\n丙。\n\n## 四\n丁。\n';
  const pal = h => (h.match(/data-palette="([^"]*)"/) || [])[1] || '';
  const on = e.build(md).text, again = e.build(md).text;
  const keys = parsePalette(pal(on));
  t('默认开启自动配色：每个块都有背景色', /data-color="auto"/.test(on) && [1, 2, 3, 4].every(k => keys['s' + k + '~bg'] && keys['s' + k] === keys['s' + k + '~bg']));
  t('自动配色可复现：同一稿件两次渲染颜色相同', pal(on) === pal(again));
  t('相邻块颜色不同', [1, 2, 3].every(k => keys['s' + k] !== keys['s' + (k + 1)]));
  t('自动配色素雅：不用灰、粉、桃红', !Object.values(keys).some(v => ['graphite', 'blush', 'tomato', 'cyan'].includes(v)));
  const plainFm = e.build(md.replace('title: 配色测试', 'title: 配色测试\ncolor: plain')).text, plainCli = e.build(md, { color: 'plain' }).text;
  t('color: plain / --color plain 关掉自动配色，恢复原样', !/data-color="auto"/.test(plainFm) && !pal(plainFm) && !/data-color="auto"/.test(plainCli) && !pal(plainCli));
  const fmOn = e.build(md.replace('title: 配色测试', 'title: 配色测试\ncolor: auto'), { color: 'plain' }).text;
  t('稿件 color: auto 优先于命令行', /data-color="auto"/.test(fmOn));
  const hand = e.build(md.replace('title: 配色测试', 'title: 配色测试\npalette: s2=tomato')).text;
  t('手写 palette 行时不叠加自动配色', pal(hand) === 's2=tomato');
  const noStudio = e.build(md.replace('title: 配色测试', 'title: 配色测试\npalette: off')).text;
  t('关掉调色器时自动配色照样生效（只上色，不出调色器）', /data-color="auto"/.test(noStudio) && /\[data-pb\]/.test(noStudio) && !/class="pe-pal"/.test(noStudio) && !/pe-studio/.test(noStudio));
  const prev = process.env.PE_COLOR; process.env.PE_COLOR = 'plain';
  const envCfg = (await import('../skills/call-pele-answer/scripts/core/engine.mjs')).loadConfig?.(process.cwd());
  if (prev === undefined) delete process.env.PE_COLOR; else process.env.PE_COLOR = prev;
  t('PE_COLOR=plain 关掉自动配色', envCfg?.color === 'plain');
  const r = run(['render', '-', '--color', 'plain', '-o', join(dir, 'plain.html')], md);
  t('CLI --color plain', r.out.startsWith('✓') && !/data-color="auto"/.test(readFileSync(join(dir, 'plain.html'), 'utf8')));
}
console.log('— 批注');
{
  const e = await createEngine({});
  const md = '---\ntitle: 批注测试\n---\n导语一句。\n\n## 一节\n第一段。\n\n- 甲\n- 乙\n';
  const on = e.build(md).text, off = e.build(md.replace('title: 批注测试', 'title: 批注测试\nannotate: off')).text, cli = e.build(md, { annotate: false }).text;
  t('默认开启批注', on.includes('pe-an-bar') && on.includes('疑问'));
  t('稿件 annotate: off 关闭', !off.includes('pe-an-bar'));
  t('CLI/配置关闭', !cli.includes('pe-an-bar'));
  t('稿件 annotate: on 压过配置', e.build(md.replace('title: 批注测试', 'title: 批注测试\nannotate: on'), { annotate: false }).text.includes('pe-an-bar'));
  const reg = createRegistry(); reg.api.annotation({ name: 'typo', label: '错字', color: '#C26A84' }); t('批注类型可注册', reg.annotations()[0].label === '错字');
}
console.log('— 路由缓存');
{
  const { withCache } = await import('../skills/call-pele-answer/scripts/core/cache.mjs');
  let calls = 0; const fake = { name: 'fake', ask: async (st) => { calls += st.length; return Object.assign(st.map(x => ({ q: { type: 'noul', noul: x.length / 10 } })), { model: 'm1' }); } };
  const tr = { span: (n, f) => f(), count() {} };
  const c = withCache(fake, tr); await c.ask(['a', 'bb'], { q: 1 }); const r2 = await c.ask(['a', 'bb', 'ccc'], { q: 1 });
  t('没变的块不再请求，只问新块', calls === 3 && r2[2].q.noul === 0.3 && r2.model === 'm1');
  await c.ask(['a'], { q: 2 }); t('问题集变了就重新请求', calls === 4);
}

{ // 路由覆盖 Pele 全部图型：每个骨架都能渲染，离线路由能选到新图型
  const { TYPES } = await import('../skills/call-pele-answer/scripts/routers/catalog.mjs');
  const { render: peleR } = await import('../skills/call-pele-answer/scripts/vendor/pele.mjs');
  const skels = Object.values(TYPES).flatMap(t => Object.values(t)).filter(v => v.skel);
  t('全部图型骨架可渲染（≥ 34）', skels.length >= 34 && skels.every(v => { try { peleR(v.skel); return true; } catch { return false; } }));
  const { routeLocal } = await import('../skills/call-pele-answer/scripts/routers/engine.mjs');
  const S = { mindmap: '一个好的产品经理要具备几个方面的能力：用户洞察、数据分析、项目管理、沟通协调和技术理解。', kanban: '这周看板上：待办有写需求文档、设计评审；进行中有开发支付接口；已完成有上线登录功能。', usecase: '在这个商城里，顾客可以浏览商品、下单、申请退款；客服角色可以处理退款和回复咨询；管理员可以上架商品。', cynefin: '用 Cynefin 看这些问题：退款有标准做法属于清晰域，数据库调优属于繁杂，新市场定价属于复杂域，线上事故属于混沌。', railroad: '手机号的格式为：以 1 开头，第二位是 3 到 9 的数字，后面跟 9 位数字；用正则写就是 1[3-9]\\d{9}，语法很简单。', packet: 'TCP 报文头前 16 位是源端口，接着 16 位是目的端口，然后 32 位序列号和 32 位确认号，每个字段占固定的比特数。' };
  const { blocks: rb } = await routeLocal(Object.values(S));
  t('离线路由选到脑图/看板/用例/Cynefin/语法图/包结构', Object.keys(S).every((k, i) => rb[i].type === k));
  const { blocks: nb } = await routeLocal(['用户可以在设置里修改密码。', 'Redis 是一个内存数据库，读写很快。']);
  t('一句话的短块仍是文字', nb.every(b => b.family === 'prose'));
}

{ // 语义类 + 图例：不写固定色也能分类上色
  const md = '# t\n\n## 状态\n```mermaid\nstateDiagram-v2\n  %% 图例: bad=违反规则; fixed=已修复\n  [*] --> A\n  A --> B: 出错\n  B --> C: 修复后\n  class B bad\n  class C fixed\n```\n';
  const { renderMarkdown } = await import('../skills/call-pele-answer/scripts/core/engine.mjs').catch(() => ({}));
  const { render: peleR } = await import('../skills/call-pele-answer/scripts/vendor/pele.mjs');
  const svg = peleR('stateDiagram-v2\n  [*] --> A\n  A --> B\n  class B bad').svg;
  const css = (await import('fs')).readFileSync(new URL('../skills/call-pele-answer/scripts/themes/pele.css', import.meta.url), 'utf8');
  t('语义类进入 SVG，主题 CSS 给它上色', /pele-state bad/.test(svg) && /\.pe-svg g\[class\]:is\(\.bad/.test(css) && /\.pe-legend/.test(css));
}
console.log('— 安全（ClawHub 审查回归）');
{
  const { spawnSync } = await import('node:child_process');
  const env = { ...process.env }; delete env.PE_TRUST_PROJECT;
  const r = spawnSync(process.execPath, [join(HERE, 'security.mjs')], { encoding: 'utf8', env });
  for (const l of r.stdout.split('\n')) { const m = /^([✓✗]) (.*)$/.exec(l); if (m) t(m[2], m[1] === '✓'); }
}

console.log('— JEV 原子判断路由（一次请求，代码决定）');
{
  const { routeFacets } = await import('../skills/call-pele-answer/scripts/routers/engine.mjs');
  const { FACETS } = await import('../skills/call-pele-answer/scripts/core/facets.mjs');
  const { admit } = await import('../skills/call-pele-answer/scripts/core/admit.mjs');
  const { BUILTIN_COMPONENTS } = await import('../skills/call-pele-answer/scripts/core/components.mjs');
  let calls = 0;
  const yes = { 0: ['messages', 'steps'], 1: ['percentages'], 2: [] };
  const fake = { name: 'fake', ask: async (texts, qs) => { calls++; return Object.assign(texts.map((_, i) => Object.fromEntries(Object.keys(qs).map(k => [k, { noul: yes[i].includes(k) ? 0.95 : 0.05 }]))), { model: 'jev-x' }); } };
  const texts = ['浏览器发送 ClientHello，服务器返回 ServerHello，浏览器再发送 Finished。', '收入构成：云 55%，广告 30%，硬件 15%。', '我建议先小流量上线再全量。'];
  const r = await routeFacets(texts, fake);
  t('所有块的全部原子题只发一次请求', calls === 1);
  t('问的是原子是非题，不是“选什么形式”', Object.values(FACETS).every(q => q.type === 'noul'));
  t('双方往来 → 时序图', r.blocks[0].family === 'sequence' && r.blocks[0].type === 'sequenceDiagram');
  t('通用的分步被专用形式覆盖，不进候选', !r.blocks[0].cands.includes('steps'));
  t('百分比 → 饼图（代码核对至少两个百分数）', r.blocks[1].type === 'pie');
  t('没有命中 → 文字', r.blocks[2].family === 'prose' && r.blocks[2].cands.length === 0);
  t('by 标明模型和策略', /jev-x · facets/.test(r.by));
  calls = 0;
  await admit(r.blocks, BUILTIN_COMPONENTS, fake, { log: false, overrides: {} });
  t('组件准入复用路由的判断，不再发第二次请求', calls === 0);
  t('准入候选来自原子判断', r.blocks[0].options.some(o => o.name === 'sequenceDiagram') && !r.blocks[2].options.some(o => o.name === 'sequenceDiagram'));
  t('候选按代码优先级排，首选在前', r.blocks[0].options[0]?.name === r.blocks[0].proposed);
  const failing = { name: 'down', ask: async () => { throw new Error('timeout'); } };
  let threw = false; try { await routeFacets(texts, failing); } catch { threw = true; }
  t('请求失败要报错，不能当成“否”', threw);
  const { createEngine: ce } = await import('../skills/call-pele-answer/scripts/core/engine.mjs');
  const eng = await ce({ cwd: mkdtempSync(join(tmpdir(), 'pe-jev-')) });
  t('auto 路由默认走 jev', eng.resolveRouter('auto').name === 'jev');
}

{ // 0.5.16 (from diagram-design): route never draws what admission rejected; accessible SVG; complexity budget
  const { admit } = await import('../skills/call-pele-answer/scripts/core/admit.mjs');
  const eg = await createEngine({});
  const para = 'diagram-design 让 Agent 先读约 80 KB 的规范和模板，再手写 SVG，最后跑 self_check.py 检查。Pele 让 Agent 只写 Markdown，pe answer 在本地渲染。';
  const bs = [{ title: '两者怎么出图', text: para, family: 'steps', type: 'numbered', proposed: 'steps', cands: ['steps'] }];
  await admit(bs, eg.registry.components(), null, { log: false });
  t('准入没通过的组件不自动画（两段工具描述不被拆成一条步骤链）', bs[0].family === 'prose' && !bs[0].type && /准入/.test(bs[0].gated || ''));
  const ok = [{ title: '安装', text: '1. 下载安装包\n2. 双击运行\n3. 登录账号\n4. 连接打印机', family: 'steps', type: 'numbered', proposed: 'steps', cands: ['steps'] }];
  await admit(ok, eg.registry.components(), null, { log: false });
  t('准入通过的组件照常画', ok[0].family === 'steps');
  const r = eg.build('# t\n\n## 下单流程\n\n```mermaid\nflowchart LR\n  A[下单] --> B[付款] --> C[发货]\n```\n', {});
  const svgs = r.text.match(/<svg[^>]*class="pele[^"]*"[^>]*>/g) || [];
  t('每张图的 SVG 带 role="img" 和 aria-labelledby', svgs.length > 0 && svgs.every(x => /role="img"/.test(x) && /aria-labelledby="[^"]+"/.test(x)));
  t('图的 <title> 是块标题，<desc> 说明图的类型和规模', /<title id="[^"]+">下单流程<\/title>/.test(r.text) && /<desc id="[^"]+">[^<]*流程图[^<]*3 个节点[^<]*2 条连线/.test(r.text));
  const big = '# t\n\n## 大图\n\n```mermaid\nflowchart LR\n' + Array.from({ length: 11 }, (_, i) => `  N${i} --> N${i + 1}`).join('\n') + '\n```\n';
  const rb = eg.build(big, {});
  t('超过 9 个节点或 12 条连线时提示拆成总览加细节', rb.warnings.some(([, rule, msg]) => rule === 'route/too-complex' && /12 个节点/.test(msg)));
  const small = eg.build('# t\n\n## 小图\n\n```mermaid\nflowchart LR\n  A --> B\n  B --> C\n```\n', {});
  t('SVG 只有一个 role 属性', svgs.every(x => (x.match(/\srole="/g) || []).length === 1));
  const { geometry } = await import('../skills/call-pele-answer/scripts/core/geometry.mjs');
  const node = (id, x, y) => `<g class="pele-node pele-shape-rect" data-id="${id}" transform="translate(${x},${y})"><rect x="-34" y="-24" width="68" height="48"/><text class="pele-label" x="0" y="5">${id}</text></g>`;
  const plate = (id, x, y) => `<g class="pele-edge-label" data-id="${id}"><rect x="${x}" y="${y}" width="36" height="21" rx="3"/><text x="0" y="0">成功</text></g>`;
  t('几何检查：两个方框重叠时报出', geometry(node('A', 40, 40) + node('B', 80, 40)).some(([r]) => r === 'overlap'));
  t('几何检查：连线标签压在无关节点上时报出', geometry(plate('L_A_B_0', 200, 30) + node('A', 40, 40) + node('B', 400, 40) + node('C', 210, 40)).some(([r]) => r === 'label-node'));
  t('几何检查：正常排版不报', !geometry(plate('L_A_B_0', 100, 30) + node('A', 40, 40) + node('B', 200, 40)).length);
  const real = eg.build('# t\n\n## 下单\n\n```mermaid\nflowchart LR\n  A[下单] -->|成功| B[付款]\n  B --> C{库存?}\n  C -->|有| D[发货]\n  C -->|无| E[退款]\n```\n', {});
  t('几何检查：渲染器真实输出不报', !real.warnings.some(([, r]) => /geometry/.test(r)));
  t('小图不提示复杂度', !small.warnings.some(([, rule]) => rule === 'route/too-complex'));
}
{ console.log('— 对比度（文字 4.5:1，关键图形 3:1，亮暗两套）');
  const { check, ratio } = await import('../skills/call-pele-answer/scripts/core/contrast.mjs');
  const eng = await createEngine({ config: { router: 'auto', theme: 'pele', output: 'html', plugins: [], adapters: [], routers: [], policy: {} } });
  const pages = eng.registry.palettes('page'), sw = eng.registry.palettes('swatch');
  t('对比度：比值算法与 WCAG 一致（黑白 21:1）', Math.abs(ratio('#000000', '#FFFFFF') - 21) < 0.01);
  t('对比度：内置主题、全部页面配色和色块都达标', !check({ pages, swatches: sw }).length);
  t('对比度：调色器染色后也达标', !check({ pages, swatches: sw, studio: true }).length);
  const pale = [{ kind: 'swatch', name: 'pale', label: '浅黄', l: '#FFF6C0', m: '#E8D46A', d: '#4A4420' }];
  t('对比度：太浅的色块会被报出（块编号/表头）', check({ swatches: pale }).some(f => f.what === '块编号/表头'));
  t('对比度：太浅的次要文字会被报出', check({ pages: [{ name: 'x', light: { '--pe-muted': '#BBBBBB' }, dark: {} }] }).some(f => f.what.startsWith('次要文字')));
  t('对比度：太浅的系列色会被报出（3:1）', check({ pages: [{ name: 'x', light: { '--pe-orange': '#F5C9A0' }, dark: {} }] }).some(f => f.kind === 'mark' && /orange/.test(f.what)));
  const ui = readFileSync(join(HERE, '../skills/call-pele-answer/scripts/themes/palette-ui.mjs'), 'utf8'), css = readFileSync(join(HERE, '../skills/call-pele-answer/scripts/themes/pele.css'), 'utf8');
  t('对比度：检查模型与样式一致（色块里的次要文字和强调文字加深）', /--pe-muted:color-mix\(in srgb,var\(--pe-muted-0\) 65%/.test(ui) && /--pe-muted:color-mix\(in srgb,var\(--pe-muted-0\) 55%/.test(ui) && /--pe-accent-text:color-mix\(in srgb,var\(--pk-m\) 55%/.test(ui) && /--pe-muted-0:var\(--pe-muted\)/.test(css));
}
{ console.log('— 渲染检查（截图对比，默认开，可关）');
  const { renderCheck, findBrowser } = await import('../skills/call-pele-answer/scripts/core/rendercheck.mjs');
  const { loadConfig } = await import('../skills/call-pele-answer/scripts/core/engine.mjs');
  const saved = process.env.PE_RENDER_CHECK; delete process.env.PE_RENDER_CHECK;
  const iso = mkdtempSync(join(tmpdir(), 'pe-rc-cfg-'));
  t('渲染检查：默认开启', loadConfig(iso).renderCheck === true);
  process.env.PE_RENDER_CHECK = '0';
  t('渲染检查：PE_RENDER_CHECK=0 关闭', loadConfig(iso).renderCheck === false);
  writeFileSync(join(iso, '.call-pele-answer.json'), JSON.stringify({ renderCheck: false })); delete process.env.PE_RENDER_CHECK;
  t('渲染检查：配置 "renderCheck": false 关闭', loadConfig(iso).renderCheck === false);
  if (saved === undefined) delete process.env.PE_RENDER_CHECK; else process.env.PE_RENDER_CHECK = saved;
  t('渲染检查：PE_CHROME 指向不存在的路径时不猜别的浏览器', findBrowser({ PE_CHROME: '/nonexistent/chrome', PATH: '' }) === null);
  const none = await renderCheck('/tmp/x.html', { browser: null });
  t('渲染检查：没有浏览器时跳过并说明，不报错', !!none.skipped && !none.findings.length);
  const md = join(iso, 'a.md'); writeFileSync(md, '---\ntitle: 测试\n---\n\n## 一\n\n一段话。\n');
  const cli = (args, env) => execFileSync(process.execPath, [PE, ...args], { env: { ...process.env, PE_TEST_ISOLATED: '1', ...env }, encoding: 'utf8' });
  t('渲染检查：--render-check off 时不跑', !/render-check|渲染检查/.test(cli(['render', md, '-o', join(iso, 'a.html'), '--render-check', 'off'], { PE_RENDER_CHECK: '', PE_CHROME: '/nonexistent' })));
  t('渲染检查：默认开启，没浏览器时打印跳过', /render-check 跳过/.test(cli(['render', md, '-o', join(iso, 'a.html')], { PE_RENDER_CHECK: '', PE_CHROME: '/nonexistent' })));
  const browser = findBrowser();
  if (!browser) console.log('  （本机没有 Chrome，跳过真实渲染的两项；设 PE_CHROME 可跑）');
  else {
    const bad = join(iso, 'bad.html');
    writeFileSync(bad, '<html><body><section><h2>坏图</h2><div style="padding:40px"><svg width="200" height="100" viewBox="0 0 200 100"><rect x="10" y="10" width="100" height="50" fill="#ccc"/><text x="150" y="50" font-size="20">超出边界的文字</text></svg></div></section><script>boom()</script></body></html>');
    const rb = await renderCheck(bad, { browser });
    if (!rb.findings.some(f => f.rule === 'render/clipped')) console.log('  browser:', browser, JSON.stringify(rb));
    t('渲染检查：画到边界外的文字被报出', rb.findings.some(f => f.rule === 'render/clipped' && f.panel === '坏图'));
    t('渲染检查：页面脚本报错被报出', rb.findings.some(f => f.rule === 'render/script-error'));
    const good = join(iso, 'good.md'); writeFileSync(good, '---\ntitle: 好图\n---\n\n## 流程\n\n```mermaid\nflowchart LR\n  A[开始] -->|下一步| B[检查] --> C[发布]\n```\n\n## 表\n\n| a | b |\n|---|---|\n| 1 | 2 |\n');
    cli(['render', good, '-o', join(iso, 'good.html'), '--render-check', 'off']);
    const rg = await renderCheck(join(iso, 'good.html'), { browser });
    t('渲染检查：正常页面不报', !rg.findings.length);
  }
}
{ // static skill contracts live in test/skill.mjs (run alone for a focused check)
  const { result } = await import('./skill.mjs');
  pass += result.pass; fail += result.fail;
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
