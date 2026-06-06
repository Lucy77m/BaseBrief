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

## Receiver-ready Finalization

生成新窗口交接时，保存前必须完成 receiver-ready 收口：

1. 将 `handoff_status` 设为 `ready_for_receiver`
2. 写入 `handoff_protocol_version: receiver-ready-v1`、带时区的 `generated_at`、`preferred_language` 和 `response_language: match_latest_user_message`
3. 将“生成交接、检查交接、准备开启新窗口”等事项从“正在进行”移入“已完成”
4. 将 `receiver_entry_task` 与 `post_acceptance_next_action` 分开
5. 将测试和检查结果标明为“来源窗口已验证”；接收窗口未重跑时不得写成本轮验证
6. 工作树有计划内未提交修改时，提供稳定排序的仓库相对路径 `expected_changed_files`；干净或不适用时写 `not_applicable`
7. 要求接收窗口机械比对文件清单、报告当前工作目录与目标仓库关系、重新核验目标仓库状态并单独记录接力摩擦
8. 要求接收报告输出 `receiver_task_status`、`repository_state_status`、`declared_checks_status` 和 `handoff_acceptance`
9. 接收窗口已经开始后，不得再次把“开启新窗口”作为下一步

如果本次交接生成了 Sidecar bundle 或 `new-window-starter.md`，最终回复必须额外给出一个代码块：

```text
新窗口开场白（可复制）：
<contents of new-window-starter.md>
```

不要让用户从长报告里手动截取开场白；`next-chat-prompt.md` 继续作为接收窗口的契约文件，不作为主要复制入口。这个开场白必须保留 `pass/fail` receiver acceptance anchor，让接收窗口首条回复明确报告验收结果。

生成 Sidecar 时，来源窗口应按用户最新消息的自然语言显式传入 `--starter-language auto|zh-CN|en|ja`；已知中文用 `zh-CN`，已知英文用 `en`，已知日文用 `ja`，混合且无法判断时用 `zh-CN`。这个参数只控制 `new-window-starter.md` 的用户可读外壳；路径、命令、文件名、schema 名、`current_goal`、`receiver_entry_task`、`risk_boundaries` 和英文 hard-stop 锚点保持原文。

可选 Receiver Safe Check：

- 普通交接默认写 `receiver_check_config: not_applicable`，继续执行 state-only 手动核验
- 需要生成 state-only 配置时，先运行：`node scripts/basebrief.js receiver-init --repo <target-repo> --output <receiver-check-config.json> --json`
- 来源窗口需要声明轻量只读核验时，写入仓库相对配置路径，并要求接收窗口运行固定命令：`node scripts/basebrief.js receiver-check --config <receiver_check_config> --repo <target-repo> --json`
- Safe Check 只允许 `node_syntax`、`artifact_check` 和 `file_tokens`，不等同于重跑来源窗口完整测试
- Builder、Adapter、Seal/Diff 和普通 BB9 handoff 不自动生成 Safe Check 配置

公开交接文件继续使用相对路径或通用路径。跨工作目录启动时，由用户在私有启动提示中提供目标交接文件路径。

响应语言规则：

- 用户明确指定语言时优先遵守
- 否则按用户最新消息的自然语言主体回复；忽略代码、路径、命令和字段名
- 混合语言且无法判断时使用 `preferred_language`；zh-CN 模板默认中文
- Agent 自己生成的第一句、进度说明和最终报告均使用选定语言
- 路径、命令、代码和协议字段保持原文；平台自动工具日志不纳入保证

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
- `scripts/basebrief_receiver_init.js`
- `scripts/basebrief_receiver_check.js`
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
