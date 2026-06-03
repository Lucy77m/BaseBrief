---
name: basebrief
description: Use when you need a Chinese-first project baseline for AI-assisted development, cross-window continuation, or agent handoff. BaseBrief normally routes between full and lite based on task scope and risk; cache-ready is reserved for explicit prompt-cache or stable-prefix experiments.
---

# BaseBrief

BaseBrief 是中文优先、Skill-first、缓存友好的 AI 项目阶段基线工具。

它做的是：

- 整理项目当前阶段
- 固定 `verified_facts`
- 固定 `confirmed_decisions`
- 标出 `assumptions`
- 标出 `open_questions`
- 保护 `risk_boundaries`
- 帮下一轮 AI / Agent 安全接续

它不是：

- 聊天客户端
- 完整平台
- App
- Agent runtime
- 密钥管理器
- 真实 API 接入工具

## Route First

总是先选模式，再生成内容。

普通项目接续默认只在 `full` 和 `lite` 之间选择。`cache-ready` 不是普通第三路线；只有用户明确要求 prompt cache、cache-ready、稳定前缀或缓存代理实验时才进入。

### Route To Full

以下任务默认走 `full`：

- 完整阶段基线
- 新窗口开场
- Agent 任务说明
- 风险红线整理
- 复杂项目归档
- 项目定位和阶段边界还不稳

读取：

- `modes/full.md`

### Route To Lite

以下任务默认走 `lite`：

- 轻量接续
- 简短交接
- 只读接续
- 1 到 2 个文件的小范围任务说明

读取：

- `modes/lite.md`

### Route To Cache-ready

以下任务才走 `cache-ready`：

- 明确提到 `prompt cache`
- 明确提到 `cache-ready`
- 明确提到 `稳定前缀`
- 明确提到 `缓存代理实验`

读取：

- `modes/cache-ready.md`

普通 `full` / `lite` 输出保持人类可读。BB9 的 `cacheSidecar` / `activeProviderPrompt` 是 provider 侧后处理产物，不要塞进普通 Markdown 正文，也不要和 `readableBrief` 拼进同一个 provider 请求。

## Lite Upgrade Rules

如果任务涉及以下任一类内容，不要继续用 Lite，直接升级到 Full 或先补信息：

- backend
- provider
- `.env`
- API key
- 部署
- state
- memory
- gateway
- 真实 Agent runtime
- 高风险系统修改

如果信息不足：

- 列出 `open_questions`
- 不编造
- 不假装边界已经清楚

## Shared Rules

三种模式都必须遵守：

1. 先区分 `verified_facts`、`confirmed_decisions`、`assumptions`、`open_questions`
2. 不把推测写成事实
3. 不把建议写成用户已确认决策
4. 不擅自扩大任务范围
5. 不改写用户已确认内容原意
6. 风险边界必须明确

## Templates

统一模板在：

- `templates/zh-CN/BASEBRIEF.md`
- `templates/zh-CN/BASEBRIEF_LITE.md`
- `templates/zh-CN/NEXT_CHAT_PROMPT.md`
- `templates/zh-CN/AGENT_TASK.md`
- `templates/zh-CN/RISK_NOTES.md`
- `templates/zh-CN/CACHE_PREFIX.md`
- `templates/zh-CN/CACHE_READY_LITE_INPUT.json`
- `templates/zh-CN/CACHE_READY_CAPSULE_INPUT.json`
- `templates/zh-CN/CACHE_READY_ANCHOR_INPUT.json`
- `templates/zh-CN/CACHE_READY_ANCHOR_PAD_INPUT.json`

## Scripts

需要轻量验证时可用：

- `scripts/mode_router.js`
- `scripts/generate_cache_ready_lite.js`
- `scripts/generate_cache_ready_capsule.js`
- `scripts/generate_cache_ready_anchor.js`
- `scripts/generate_bb9_handoff.js`
- `scripts/basebrief_build_handoff.js`
- `scripts/basebrief_build_adapters.js`
- `scripts/bb9_provider_profiles.json`
- `scripts/prompt_stability_probe.js`
- `scripts/provider_cache_probe.js`
- `scripts/provider_cache_benchmark.js`
- `scripts/run_release_checks.js`

## Handoff Contract

BB9 handoff 契约见：

- `docs/handoff.md`
- `schemas/bb9-handoff.schema.json`

标准产物是：

- `readableBrief`
- `cacheSidecar`
- `activeProviderPrompt`
- `handoff.meta.json`

MiMo / DeepSeek 的 BB9 sidecar 证据只能写成 provider-specific estimated-cost evidence。BB12 只记录为 MiMo-specific selector candidate，不作为默认 handoff contract。

## Cache-ready Experimental Variants

- v1: readable stable-prefix experiment; normal users should still prefer `full` or `lite`.
- v2 / BB2 Cache Capsule: compact cache-ratio and estimated-cost experiment.
- v3 / BB3 Cache Anchor: pre-registers tail options and changes only a selector.
- v4 / BB4 Anchor Pad: BB3 plus required `cache_pad`; current evidence is limited to MiMo `mimo-v2.5` local real-project samples.
- BB9 Adaptive Selector handoff POC: keeps readable `full` / `lite` as the primary handoff and attaches a cache sidecar only for provider profiles with visible cache usage evidence.
- BB10 Active Prompt Workflow: uses `activeProviderPrompt` as the single provider prompt and avoids concatenating readable handoff text with sidecar text.

BB2 到 BB4 为了缓存经济实验，会省略 `assumptions`、`open_questions` 等可读交接字段。这个例外只适用于 `cache-ready` 实验线，不适用于 `full` 或 `lite`。
