# BaseBrief Lite Mode

## Use Lite When

- 任务是轻量接续
- 任务是只读接续
- 任务边界已经清楚
- 任务只落在 1 到 2 个业务文件

## Lite Must Stay Short

默认只保留：

- 项目定位
- 当前目标
- `verified_facts`
- `confirmed_decisions`
- `assumptions`
- `risk_boundaries`
- `handoff_status: ready_for_receiver`
- `handoff_protocol_version: receiver-ready-v1`
- `generated_at`
- `preferred_language`
- `response_language: match_latest_user_message`
- `receiver_entry_task`
- `post_acceptance_next_action`
- `expected_changed_files`
- 可选 `receiver_check_config`
- `receiver_task_status`
- `repository_state_status`
- `declared_checks_status`
- `handoff_acceptance`
- `open_questions`

## Lite Must Not Become Full

Lite 不应：

- 写长历史
- 写完整 changelog
- 代替高风险工程基线
- 处理 backend、provider、`.env`、部署、state、memory、gateway

## Stop And Upgrade

出现以下情况就停止 Lite，升级 Full：

- 一开始就要跨 3 个以上业务文件
- 任务碰 backend、provider、`.env`、API key、部署
- 需要写新窗口开场白、Agent 任务说明、复杂归档
- 继续推进只能靠猜

## Default Output

默认使用：

- `templates/zh-CN/BASEBRIEF_LITE.md`

## Receiver-ready Finalization

保存 Lite 交接前，必须写入最小协议元数据，将入口核验任务与验收后项目动作分开，并在脏工作树中提供精确的 `expected_changed_files`。默认写 `receiver_check_config: not_applicable`；只有来源窗口显式准备仓库相对 Safe Check 配置时，才要求运行固定 `receiver-check` 命令。Safe Check 是轻量来源声明核验，不等同于完整测试重跑。来源窗口已有检查只能标为“来源窗口已验证”；接收窗口需要跟随用户最新消息的自然语言主体回复，机械比对文件清单，报告工作目录关系、重新核验目标状态、输出三项验收状态、记录实际摩擦，并且不得再次建议“开启新窗口”。

## Handoff Sidecar Rule

Lite 的主产物始终是短、硬、可读的接续 brief。需要 provider 侧缓存实验时，先保留 readable brief，再通过 BB9 handoff 后处理生成 `cacheSidecar` / `activeProviderPrompt`。

不要为了缓存实验把 Lite 正文改成 provider-only sidecar 格式。

如果用户明确要求 handoff builder 或 provider active prompt，可以在可读 brief 末尾追加结构化 JSON 附录块：

````text
<!-- BASEBRIEF_HANDOFF_JSON_BEGIN -->
```json
{ ...bb9 handoff schema input... }
```
<!-- BASEBRIEF_HANDOFF_JSON_END -->
````

该块必须满足 `schemas/bb9-handoff.schema.json`，并且只作为后处理输入。
