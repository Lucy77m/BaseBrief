# BaseBrief 5 分钟上手

BaseBrief 用于在换窗口、换模型、换工具或隔天继续开发时，保留项目当前状态和任务边界。

第一次使用时，不需要理解 BB 实验、provider profile 或 cache sidecar。先完成一次可读的 Full 或 Lite 交接即可。

## 路径 A：让 AI 生成 Lite 交接

适用于只读接续或 1 到 2 个文件的明确小任务。

```text
请读取 BaseBrief 的 skills/basebrief/SKILL.md。
请用 lite 整理当前任务的短接续。
先检查真实文件，不要把推测写成事实。
请明确 verified_facts、confirmed_decisions、risk_boundaries、open_questions 和下一步。
```

如果任务涉及 backend、provider、`.env`、部署、运行时状态，或者边界不清，改用 Full。

可以先查看 [公开最小示例](../examples/minimal/README.md)。

## 路径 B：构建并检查 Handoff 产物

仓库包含零依赖 CLI Lite。它只处理你显式传入的文件和输出目录。

```text
node scripts/basebrief.js build --input examples/structured-handoff-lite.md --output-dir tests/outputs/private/quickstart/build --check
node scripts/basebrief.js check --input tests/outputs/private/quickstart/build
```

输出包括：

- `readableBrief.md`：给人和下一个 AI 窗口阅读
- `activeProviderPrompt.md`：根据显式 profile 选择的 provider-facing 产物
- `handoff.meta.json`：不复制完整 prompt 的 metadata

普通接续直接使用 `readableBrief.md`。不需要 provider-aware 后处理时，不必处理其他产物。

## 路径 B2：已有 reviewed handoff 时走 Golden Path

如果你手上已经有 `receiver-ready.md`，而目标仓库要进入本地连续性链路，就不要自己在 `Project State`、`CLI Lite` 和 Sidecar 文档之间来回拼步骤。直接走 [Integrated Handoff Golden Path](golden-path.md)：

- 首次写入本地连续性状态：`receiver-ready.md -> state-init -> sidecar-build -> sidecar-check -> new-window-starter.md -> receiver first response`
- 已有有效 `.basebrief/state.json` 时更新连续性状态：`receiver-ready.md -> state-advance -> sidecar-build -> sidecar-check -> new-window-starter.md -> receiver first response`

`state-status`、`state-validate` 和 `state-history` 仍然只是一组可选只读检查，不抬升为每次都必须走的主路径。

## 路径 C：用 Seal/Diff 对比阶段变化

```text
node scripts/basebrief.js seal --input examples/seal-before-input.json --output tests/outputs/private/quickstart/before.json
node scripts/basebrief.js diff --before tests/outputs/private/quickstart/before.json --after examples/seal-after-input.json
```

Seal/Diff 对比事实、决策、风险边界、open questions 和任务边界。它不会扫描或修改其他项目。

`tests/outputs/private/` 已被仓库忽略，可用于本地演练；完成后可以直接删除其中的 `quickstart/` 目录。

## 路径 D：来源窗口准备 Receiver Safe Check

来源窗口先生成 state-only 配置，并可立即做一次本地 smoke，确认配置能够被读取：

```text
node scripts/basebrief.js receiver-init --repo . --output tests/outputs/private/quickstart/receiver-check.json --json
node scripts/basebrief.js receiver-check --config tests/outputs/private/quickstart/receiver-check.json --repo . --json
```

`receiver-init` 只记录 branch、精确 HEAD 和当前 changed files，默认不声明行为检查，不覆盖已有文件，也不写 tracked files。来源窗口可以审阅配置后手动加入允许的 `node_syntax`、`artifact_check` 或 `file_tokens`。

上面的连续两条命令是来源窗口的本地准备与 smoke，不是接收窗口验收。实际交接时，接收窗口使用用户私下提供的目标仓库路径重新运行第二条 `receiver-check` 命令，并报告 receiver statuses。

## Full 和 Lite 怎么选

- 使用 Full：完整阶段收口、复杂交接、风险较高、范围不清。
- 使用 Lite：短接续、只读交接、1 到 2 个文件的明确范围。
- 不确定时使用 Full，或者先补充 `open_questions`。

`cache-ready` 只用于明确的 prompt-cache 实验，不是普通第三模式。

## 下一窗口怎么接手

保存交接前，先确认：

- `handoff_status` 已是 `ready_for_receiver`
- `handoff_protocol_version`、带时区的 `generated_at`、`preferred_language` 和 `response_language` 已填写
- `response_language` 默认使用 `match_latest_user_message`
- `receiver_entry_task` 是接收窗口现在要做的核验
- `post_acceptance_next_action` 是核验完成后项目真正要做的动作
- 已有测试结果标明为“来源窗口已验证”
- 工作树有计划内未提交修改时，`expected_changed_files` 已按稳定顺序精确列出仓库相对路径
- 可选 `receiver_check_config` 已明确为仓库相对路径；未启用时写 `not_applicable`

把可读 brief 交给下一个窗口，并使用相同的接收要求。当前工作目录与目标仓库一致时，可以使用相对路径；从其他工作目录启动时，由用户在私有启动提示中提供交接文件路径。公开 brief 本身不要写私人绝对路径。

```text
请先读取这份 BaseBrief。
以其中的 verified_facts、confirmed_decisions 和 risk_boundaries 为准。
请按 response_language: match_latest_user_message 回复：
- 用户明确指定语言时优先遵守；
- 否则按这条用户消息的自然语言主体回复，忽略路径、命令、代码和字段名；
- 第一条说明、进度更新和最终报告均使用选定语言。
先报告当前工作目录与目标仓库是否一致，再检查目标仓库状态。
请区分“来源窗口已验证”和“接收窗口本轮已验证”；未重跑的测试不要写成本轮验证。
如果存在 expected_changed_files，请机械比对并报告新增、缺失或意外文件。
如果 receiver_check_config 不是 not_applicable，请运行固定 receiver-check 命令；它是来源窗口声明的轻量核验，不等同于重跑来源窗口完整测试。
直接执行 receiver_entry_task，不要再次建议开启新窗口。
入口核验完成后给出 post_acceptance_next_action，并单独记录实际接力摩擦。
最后输出 receiver_task_status、repository_state_status、declared_checks_status 和 handoff_acceptance；未启用 Safe Check 时 declared_checks_status 为 skipped。
如果事实已经变化，先指出差异，不要猜。
```

可选 Receiver Safe Check 命令：

```text
node scripts/basebrief.js receiver-check --config <receiver_check_config> --repo <target-repo> --json
```

可先用 `receiver-init` 生成 state-only 配置。`--repo` 由用户在私有启动命令中提供；公开交接与配置不得写私人绝对路径。未提供 `receiver_check_config` 时，继续执行当前 state-only 手动核验。详见 [Receiver Safe Check](receiver-check.md)。

验收状态语义：

- `handoff_acceptance: pass`：入口任务完成，且仓库状态与交接一致。
- `handoff_acceptance: difference_found`：入口任务正确完成，并准确报告状态差异；这不是 Agent 执行失败。
- `handoff_acceptance: blocked`：无法读取交接、定位目标或完成必要核验。
- `declared_checks_status`：声明检查为 `passed | difference_found | skipped | blocked`；未启用 Safe Check 时为 `skipped`。

## 下一步

- [Handoff 契约](handoff.md)
- [Integrated Handoff Golden Path](golden-path.md)
- [Seal/Diff](seal-diff.md)
- [模式选择](mode-selection.md)
- [完整文档索引](index.md)
