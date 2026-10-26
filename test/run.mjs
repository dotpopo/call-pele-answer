// node test/run.mjs — offline: remote adapters are tested against a local mock server.
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
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
