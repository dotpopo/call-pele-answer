## 4. 渲染、读输出、修

- `✓ <路径>`：成功。
- `✗ L<行> [规则] …  →  改法`：没有生成页面。逐条修完再渲染。从 stdin 渲染时，CLI 会把稿件存成文件并打印 `draft: <路径>`，行号对应那个文件；用文件编辑工具只改报错行，然后 `pe render <路径> -o <同一输出>`。
- `route n warnings`：形式选错了（正文里在描述流程、两列表格、图太密、数据图没来源、整页只有文字……）。**先修这一类**，它比措辞更影响理解。
- `STE n warnings`：按提示改写；最多改 2 轮，剩下的照常交付，并在回复里说一句“还有 n 条文字提示未改”。
- `embedded: …`：页面里含这些文件的代码。分享前告诉用户。
- 只改一块：`pe patch <page.html> --panel "块标题" <<'PE_EOF' … PE_EOF`，不重写整页。
- 只想检查不出页：`pe check <稿件>`。
- 看当前加载了哪些形式、路由器、适配器、主题、输出、规则、插件：`pe info`。

## 4.4 计时与自我优化

- 每次 `pe` 运行都把分阶段耗时追加到 `~/.call-pele-answer/logs/runs.jsonl`（`PE_TRACE=0` 关闭）。加 `--trace` 在终端打印。
- Agent 回合计时：Claude Code 装了插件就自动记录（`hooks/hooks.json`：提问 → 每次工具调用 → 结束）。其他 Agent 在每步开始时运行 `node ${SKILL_DIR}/scripts/hooks/agent-hook.mjs mark <步骤>`（如 research、write、pe-answer、verify），交付后 `mark end`。
- 路由按块缓存（`~/.call-pele-answer/cache/route.json`，`PE_CACHE=0` 关闭）：改稿后重渲染，只有改动的块会走网络。
- 日志目录可用 `PE_LOG_DIR` 指到持久位置（沙箱或 CI 里 home 目录会丢）。
- `pe stats` 汇总：每个阶段的 p50/p95，每个回合里模型生成、工具、pe 各占多少，最慢的调用，以及按规则给出的改法。
- 每累计约 20 次运行看一次 `pe stats`，按建议改：路由慢 → 换路由器；TODO 多 → 加派生器或在回答里直接写表格；模型占比高 → 少写一遍；非 pe 命令多 → 交付前只跑 `pe check`。

## 4.4.1 调色器

每个 html 页面头部有「调色」按钮：打开后点选任一组件（导语、整块、图、表、多视图、提示、步骤……），再点色板，只有这个组件换色；图表跟着变，不用重新渲染。顶部「页面」一行切整页风格（墨纸 / 暖纸 / 蓝图）。

- 读者点「复制配色」得到一行 `palette: page=warm s2=tomato s3.1=cobalt s4.h~bg=mint s5.1.g3=tomato`（键：`sN` 节、`sN.M` 组件、`.h` 标题、`.pK` 段落、`.hd` 表头、`.rK` 行、`.rKcJ` 格、`.gK` 图形；`~bg` 表示背景）。把这行放进稿件的 front matter，下次渲染就带着这套配色。读者把这行发回给你时，照放即可，不要改成别的颜色。
- 组件编号：`lead`、`s<块号>`、`s<块号>.<块内第几个组件>`。
- 开关：默认开启。关掉用稿件 `palette: off`、命令行 `--palette off`、环境变量 `PE_PALETTE=0`，或在配置文件写 `"palette": false`；稿件里写的优先。
- 色板只换强调色和底色，正文墨色不变，所以换色不会让文字对比度变差。

## 4.4.2 批注

每块内容左侧有 ✎：导语的每段、每块的标题（整块）、块里的每段 / 列表项 / 图 / 表 / 组件。读者选一种类型（疑问 / 建议 / 认可 / 顾虑），可写一句话，保存后这块会标上颜色。批注存在浏览器里，刷新不丢。底部的批注栏点「复制给 Agent」，得到一段 Markdown：

```
## 对《标题》的批注
1. [建议] §02 三种问题类型 › “choice 从你定义的选项里选一个…”（s2.1）
   > 这里能举个例子吗
```

- 读者把这段发回来时：按编号找到对应块（`s2.1` = 第 2 块第 1 个内容单元，`s2` = 整块，`lead.1` = 导语第 1 段）。疑问 → 在原块补解释；建议 → 照改；顾虑 → 核实后改或说明；认可 → 保留不动。只改被批注的块，用 `pe patch` 或改稿后重渲染（路由有缓存，没改的块不再请求）。
- 开关：默认开启。关掉用稿件 `annotate: off`、命令行 `--annotate off`、环境变量 `PE_ANNOTATE=0`，或配置 `"annotate": false`；稿件里写的优先。
- 批注类型可扩展：插件里 `api.annotation({ name, label, color })`。

## 4.5 路由器（入口 B）

| `--router` | 怎么问 | 需要 | 实测（20 块） |
|---|---|---|---|
| `auto`（默认） | 有 `TYPESAFE_API_KEY` 用 `typesafe`；没有就走 classifier.dev 免费转发的 System One（`systemone-free`，不用 key，按 IP 限额），失败再退到 `classifier`，最后离线 `local` | — | — |
| `classifier` | classifier.dev 批量，形式 + 图类型 | 不需要 key | 20/20，约 1.5 秒 |
| `typesafe` | TypeSafe System One，每块多问题并行 + 置信度门控 | `TYPESAFE_API_KEY` | 19/20，约 0.2 秒 |
| `systemone-free` | 同上，经 classifier.dev 匿名转发 | 不需要 key | 19/20，3–5 秒 |
| `hybrid` | classifier 批量定形式，System One 只复核数据图/流程/低置信度块 | 不需要 key | 20/20，1.3–4 秒 |
| `local` | 本地关键词规则 | 无，离线 | 14/20，约 0 ms |

- 失败自动沿降级链走到 `local`，输出里会注明。
- **隐私**：除 `local` 外，回答内容会发到第三方。内部代码、客户数据、未公开信息用 `local`，或在配置里接自建的 System One 端点（`references/plugins.md`）。
- 门控示例：没有具体数字的块不画数据图；一句话能说清的块不升级；带分支的流程不自动生成线性流程图。
- key 由代理注入（Node 不读 HTTPS_PROXY）时，命令前加 `NODE_USE_ENV_PROXY=1`。
- 设置默认：`pe config set router hybrid`。窄屏读者：`pe route … --device mobile`。

## 参考文件

- `references/routing.md` — 拆块方法、形状→形式细则、30+ 种 Pele 图怎么选、视频两级、反例
- `references/writing.md` — STE 风格（flavored / strict）、中文规则、保留语气、豁免写法
- `references/aesthetic.md` — 设计原则与设计令牌（改主题前读）
- `references/plugins.md` — 九个扩展点（form / adapter / router / deriver / theme / palette / annotation / output / rule）与配置
- 插件根目录 `examples/`：`learning-rate.md`（文字、流程图、滑块、表格、分步）、`raw-answer.md` → `raw-answer.routed.md`（入口 B 的输入与输出）、`plugins/kpi.mjs`（示例插件）
- 插件根目录的 `test/run.mjs`（回归测试，离线）与 `bench/`（路由基准）
