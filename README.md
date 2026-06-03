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
它可以用于稳定前缀和缓存经济实验。当前证据分层很明确：早期 normalized benchmark 没有证明缓存比例或估算成本优势；BB5 Cache Sidecar 在 MiMo 上给出了单格式证据；BB9 Adaptive Selector 在 MiMo `mimo-v2.5` 和 DeepSeek `deepseek-v4-flash` 的本地真实项目样本下都给出了估算成本优势证据。不要把它写成跨 provider 通用证明，也不要宣称真实账单费用或延迟已经稳定胜出。

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
│     ├─ cache-ready-anchor-pad.md
│     ├─ cache-ready-readable-poc.md
│     ├─ cache-ready-sidecar.md
│     ├─ cache-ready-hybrid-anchor.md
│     └─ cache-ready-adaptive-selector.md
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
- Readable Full/Lite POC: [docs/experiments/cache-ready-readable-poc.md](docs/experiments/cache-ready-readable-poc.md)
- BB5 Cache Sidecar notes: [docs/experiments/cache-ready-sidecar.md](docs/experiments/cache-ready-sidecar.md)
- BB6 Hybrid Anchor notes: [docs/experiments/cache-ready-hybrid-anchor.md](docs/experiments/cache-ready-hybrid-anchor.md)
- BB9 Adaptive Selector notes: [docs/experiments/cache-ready-adaptive-selector.md](docs/experiments/cache-ready-adaptive-selector.md)
- BB11 Active Prompt Trim notes: [docs/experiments/cache-ready-active-prompt-trim.md](docs/experiments/cache-ready-active-prompt-trim.md)
- BB12 Size-band Guard notes: [docs/experiments/cache-ready-bb12-guard.md](docs/experiments/cache-ready-bb12-guard.md)
- BB evolution log: [docs/evolution/bb-evolution-log.md](docs/evolution/bb-evolution-log.md)
- GPT-5.5 relay usage audit: [docs/experiments/cache-ready-relay-gpt55.md](docs/experiments/cache-ready-relay-gpt55.md)

## BB9 双轨省钱 POC

BB9 现在有一个可用的 handoff POC：普通接续仍然输出可读的 `full` / `lite` brief；如果 provider profile 有可见的缓存 usage 证据，再额外附加 `cacheSidecar`。

关键规则：`readableBrief` 给人和接续边界看；`cacheSidecar` 给支持缓存证据的 provider 作为 active prompt。不要把两者直接拼进同一个 provider 请求，否则会把 prompt 变长，可能抵消缓存收益。

BB10 active prompt workflow 在这个规则上再推进一步：生成结果会直接给出 `activeProviderPrompt`。普通用户看 `readableBrief`，省钱实验或重复 provider 调用只发送 `activeProviderPrompt`。

普通接续触发语：

```text
请用 BaseBrief 生成 full 或 lite 项目接续，优先保证 readable brief 的事实、决策和风险边界清楚。
```

省钱实验触发语：

```text
请用 BaseBrief BB9 handoff 生成 readable brief，并在 MiMo 或 DeepSeek profile 支持时附加 cache sidecar。不要把 estimated cost 写成真实账单审计。
发给 provider 的 active prompt 按 recommendedPromptType 选择，不要把 readableBrief 和 cacheSidecar 拼接。
```

脚本入口：

```text
node scripts/generate_bb9_handoff.js --input examples/bb9-handoff-full-input.json --mode full --provider-profile mimo
node scripts/generate_bb9_handoff.js --input examples/bb9-handoff-lite-input.json --mode lite --provider-profile deepseek
node scripts/generate_bb9_handoff.js --input examples/bb9-handoff-full-input.json --mode full --provider-profile mimo --print activeProviderPrompt
```

公开示例：

- [BB9 full input](examples/bb9-handoff-full-input.json)
- [BB9 full output](examples/bb9-handoff-full-output.md)
- [BB9 lite input](examples/bb9-handoff-lite-input.json)
- [BB9 lite output](examples/bb9-handoff-lite-output.md)
- [BB9 unsupported provider fallback](examples/bb9-handoff-fallback-output.md)
