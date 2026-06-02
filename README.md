# BaseBrief

BaseBrief 是一个中文优先、Skill-first、缓存友好的 AI 项目阶段基线工具。

English README: [README.en.md](README.en.md)

对外只有一个入口：`BaseBrief`。  
安装一次，用一个 Skill；内部按任务自动落到 `full`、`lite`、`cache-ready` 三种模式。

## 快速开始

BaseBrief 当前不是 CLI，也不是插件。最简单的使用方式是让你的 AI 工具读取这个 Skill：

```text
请读取 BaseBrief 的 skills/basebrief/SKILL.md。
根据我接下来的任务自动选择 full、lite 或 cache-ready。
不要把推测写成事实；如果边界不清，先列 open_questions。
```

然后给出你的任务，例如：

```text
请用 BaseBrief 整理当前项目阶段基线。
我需要完整版本，并额外准备新窗口开场白和 Agent 任务说明。
```

你应该检查输出是否明确区分：

- `verified_facts`
- `confirmed_decisions`
- `assumptions`
- `open_questions`
- `risk_boundaries`

更多入口：

- 工具集成：[docs/integrations.md](docs/integrations.md)
- 完整 walkthrough：[docs/walkthrough.md](docs/walkthrough.md)
- 模式示例：[docs/usage.md](docs/usage.md)
- 模式选择：[docs/mode-selection.md](docs/mode-selection.md)

## 它适合谁

- 需要跨窗口继续项目的 AI 辅助开发者
- 需要给下一个 Agent 做安全交接的人
- 想把项目状态整理成稳定 Markdown 基线的人

## 它不是什么

- 不是聊天客户端
- 不是完整平台或 Agent runtime
- 不是密钥管理器
- 不是 CLI、Web UI、MCP、VS Code 插件
- 不是用来接入真实 API、provider、部署链路的工具

## 三种模式

### Full

适合：

- 复杂项目阶段总结
- 新窗口开场
- Agent 任务说明
- 风险红线集中整理
- 复杂项目归档

默认会围绕完整 `BASEBRIEF.md` 工作，必要时再派生：

- `NEXT_CHAT_PROMPT.md`
- `AGENT_TASK.md`
- `RISK_NOTES.md`
- `CACHE_PREFIX.md`

### Lite

适合：

- 轻量接续
- 简短交接
- 只读接续
- 1 到 2 个文件的小范围任务说明

Lite 明显短于 Full，不写长历史，不接高风险工程。

### Cache-ready

适合：

- 明确提到 `prompt cache`
- 明确提到 `cache-ready`
- 稳定前缀或缓存代理实验

它是实验模式。  
它可以用于稳定前缀实验。当前 MiMo `mimo-v2.5` 本地真实项目样本显示 cache-ready 报告了更高的绝对 cached tokens；但 normalized benchmark 没有证明缓存比例或估算成本优势。不要宣称费用、比例或延迟收益已经稳定胜出。

## 什么时候不要用 Lite

以下情况不要硬用 Lite，直接走 Full 或先补信息：

- 任务碰 backend、provider、`.env`、API key、部署
- 任务碰 state、memory、gateway、真实 Agent runtime
- 一开始就要跨 3 个以上业务文件
- 边界不清，只能靠猜
- 用户说“帮我整体优化一下”但没给清楚范围

## 当前形态

- Phase 1：Skill-first + Markdown templates
- 暂无 CLI
- 暂无 Web UI
- 暂无 MCP / 插件
- 暂无真实 API 接入

## 安全注意

- 不要把 `.env`、API key、token、secret 写进模板、README 或 Git
- 不要把私人绝对路径写进公开文档
- 不要把 `cache-ready` 写成已证明真实缓存收益

## 仓库结构

```text
BaseBrief/
├─ skills/
│  └─ basebrief/
│     ├─ SKILL.md
│     ├─ agents/openai.yaml
│     └─ modes/
│        ├─ full.md
│        ├─ lite.md
│        └─ cache-ready.md
├─ templates/
│  └─ zh-CN/
│     ├─ BASEBRIEF.md
│     ├─ BASEBRIEF_LITE.md
│     ├─ NEXT_CHAT_PROMPT.md
│     ├─ AGENT_TASK.md
│     ├─ RISK_NOTES.md
│     ├─ CACHE_PREFIX.md
│     ├─ CACHE_READY_LITE_INPUT.json
│     ├─ CACHE_READY_CAPSULE_INPUT.json
│     ├─ CACHE_READY_ANCHOR_INPUT.json
│     └─ CACHE_READY_ANCHOR_PAD_INPUT.json
├─ docs/
│  ├─ integrations.md
│  ├─ walkthrough.md
│  ├─ usage.md
│  ├─ mode-selection.md
│  ├─ testing.md
│  └─ experiments/
│     ├─ cache-ready-lite.md
│     ├─ cache-ready-capsule.md
│     ├─ cache-ready-anchor.md
│     └─ cache-ready-anchor-pad.md
└─ scripts/
   ├─ mode_router.js
   ├─ generate_cache_ready_lite.js
   ├─ generate_cache_ready_capsule.js
   ├─ generate_cache_ready_anchor.js
   ├─ prompt_stability_probe.js
   ├─ provider_cache_probe.js
   ├─ provider_cache_benchmark.js
   └─ run_release_checks.js
```

## 文档入口

- 工具集成：[docs/integrations.md](docs/integrations.md)
- 完整 walkthrough：[docs/walkthrough.md](docs/walkthrough.md)
- 使用示例：[docs/usage.md](docs/usage.md)
- 模式选择：[docs/mode-selection.md](docs/mode-selection.md)
- 测试矩阵：[docs/testing.md](docs/testing.md)
- Cache-ready 实验说明：[docs/experiments/cache-ready-lite.md](docs/experiments/cache-ready-lite.md)
- 公开示例：[examples](examples)
- BB2 experiment notes: [docs/experiments/cache-ready-capsule.md](docs/experiments/cache-ready-capsule.md)
- BB2 example input: [examples/cache-ready-capsule-input.json](examples/cache-ready-capsule-input.json)
- BB2 example output: [examples/cache-ready-capsule-output.md](examples/cache-ready-capsule-output.md)
- BB3 experiment notes: [docs/experiments/cache-ready-anchor.md](docs/experiments/cache-ready-anchor.md)
- BB3 example input: [examples/cache-ready-anchor-input.json](examples/cache-ready-anchor-input.json)
- BB3 example output: [examples/cache-ready-anchor-output.md](examples/cache-ready-anchor-output.md)
- BB4 experiment notes: [docs/experiments/cache-ready-anchor-pad.md](docs/experiments/cache-ready-anchor-pad.md)
- BB4 example input: [examples/cache-ready-anchor-pad-input.json](examples/cache-ready-anchor-pad-input.json)
- BB4 example output: [examples/cache-ready-anchor-pad-output.md](examples/cache-ready-anchor-pad-output.md)
