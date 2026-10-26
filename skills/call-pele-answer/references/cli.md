# pe 命令、路由器与计时

## 目录
- 三个入口
- 其他命令
- 路由器
- 计时与自我优化

## 三个入口

- **`pe answer 回答.md -o 页面.html`**（默认）：路由、组合、派生、渲染一个进程完成，约 0.3 秒（6 块，TypeSafe）。
- **`pe render 稿件.md -o 页面.html`**：你已知道每块的形式，直接写稿件。可从 stdin 读：
  ```bash
  node "${SKILL_DIR}/scripts/pe.mjs" render - -o "<绝对路径>.html" <<'PE_EOF'
  …稿件…
  PE_EOF
  ```
- **建议组合**：路由器除了主形式（单选），还对 9 种形式各问一次“这块有没有这种内容”（独立是/否，≥0.8 才算，callout ≥0.7），输出“建议组合”最多 3 种，画法相同的（步骤和结构都是流程图）只算一次；没有真实数字时不建议数据图。`--json` 里是 `facets` 和 `combo`。
- **`pe route answer.md -o draft.md`**：形式拿不准时，路由器逐块给形式，组合器按整页调整；简单形状（时间线、占比、线性步骤、状态转移）直接生成，同一块有多种看法时生成 `views`。按 `<!-- TODO … -->` 补成真实内容、删注释，再 `pe render draft.md`。

## 其他命令

- `pe render 稿件 --output markdown`：压平成聊天 Markdown（分步 → 编号拍，多视图 → 首选视图，图保留 mermaid 围栏）。
- `pe patch <page.html> --panel "块标题" <<'PE_EOF' … PE_EOF`：只改一块。
- `pe check <稿件>`：只检查不出页。
- `pe info`：当前加载的形式、路由器、适配器、主题、输出、规则、插件。
- `pe config set router hybrid`：设默认路由器；`pe route … --device mobile`：窄屏读者。

## 路由器

| `--router` | 怎么问 | 需要 | 实测（20 块） |
|---|---|---|---|
| `auto`（默认） | 有 `TYPESAFE_API_KEY` 用 `typesafe`；否则 `systemone-free`，失败退 `classifier`，最后 `local` | — | — |
| `classifier` | classifier.dev 批量，形式 + 图类型 | 无 key | 20/20，约 1.5 秒 |
| `typesafe` | TypeSafe System One，每块多问题并行 + 置信度门控 | `TYPESAFE_API_KEY` | 19/20，约 0.2 秒 |
| `systemone-free` | 同上，经 classifier.dev 匿名转发，按 IP 限额 | 无 key | 19/20，3–5 秒 |
| `hybrid` | classifier 定形式，System One 复核数据图/流程/低置信度块 | 无 key | 20/20，1.3–4 秒 |
| `local` | 本地关键词规则 | 离线 | 14/20，约 0 ms |

- 失败自动沿降级链走到 `local`，输出会注明。
- **隐私**：除 `local` 外，内容会发到第三方。内部代码、客户数据、未公开信息用 `local` 或自建端点（`plugins.md`）。
- 门控：没有具体数字不画数据图；一句话能说清不升级；带分支的流程不自动生成线性流程图。
- key 由代理注入（Node 不读 HTTPS_PROXY）时，命令前加 `NODE_USE_ENV_PROXY=1`。
- 路由按块缓存（`~/.call-pele-answer/cache/route.json`，`PE_CACHE=0` 关闭）：改稿后只有改动的块走网络。

## 计时与自我优化

- 每次运行把分阶段耗时追加到 `~/.call-pele-answer/logs/runs.jsonl`（`PE_TRACE=0` 关闭；`--trace` 打印；`PE_LOG_DIR` 指到持久位置）。
- Agent 回合计时：Claude Code 装插件后自动记录（`hooks/hooks.json`）。其他 Agent 每步开始运行 `node ${SKILL_DIR}/scripts/hooks/agent-hook.mjs mark <步骤>`（如 research、write、pe-answer、verify），交付后 `mark end`。
- `pe stats`：各阶段 p50/p95、每回合模型/工具/pe 占比、最慢调用和改法。每约 20 次运行看一次：路由慢 → 换路由器；TODO 多 → 加派生器或直接写表格；模型占比高 → 少写一遍；非 pe 命令多 → 交付前只跑 `pe check`。
