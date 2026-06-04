# BaseBrief Full Mode

## Use Full When

- 用户要完整阶段基线
- 用户要新窗口开场白
- 用户要 Agent 任务说明
- 用户要集中整理风险红线
- 项目复杂，边界多，不能压成 Lite

## Full Must Cover

至少覆盖：

- 项目身份
- 当前阶段
- `verified_facts`
- `confirmed_decisions`
- `assumptions`
- 路径 / 版本 / commit / 运行方式
- `risk_boundaries`
- 未完成事项
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

按需派生：

- `NEXT_CHAT_PROMPT.md`
- `AGENT_TASK.md`
- `RISK_NOTES.md`
- `CACHE_PREFIX.md`

## Default Output Order

1. 先写 `BASEBRIEF.md`
2. 再判断是否需要新窗口开场白
3. 再判断是否需要 Agent 任务说明
4. 风险密度高时再单独写 `RISK_NOTES.md`
5. 长期重复复用时再整理 `CACHE_PREFIX.md`

## Full Safety Rules

- 缺信息就列 `open_questions`
- 不要为了“完整”而编造路径、commit、构建状态
- 复杂项目默认优先 Full，不要硬压成 Lite

## Receiver-ready Finalization

保存 Full 交接前：

- 将交接生成与检查工作移入“已完成”，不要留在“正在进行”
- 将已有测试结果标为“来源窗口已验证”
- 写入最小协议元数据，并要求第一句、进度说明和最终报告跟随用户最新消息的自然语言主体
- 工作树存在计划内未提交修改时，精确列出稳定排序的仓库相对路径 `expected_changed_files`
- 明确接收窗口应立即执行的 `receiver_entry_task`
- 明确接力验收完成后的 `post_acceptance_next_action`
- 明确三项验收状态；正确报告差异属于 `difference_found`，不是执行失败
- 默认写 `receiver_check_config: not_applicable`；如来源窗口显式准备了 Safe Check 配置，则只写仓库相对路径并要求运行固定 `receiver-check` 命令
- 明确 Safe Check 是来源窗口声明的轻量核验，不是完整测试重跑
- 要求接收窗口报告工作目录关系、重新核验目标仓库状态并记录实际摩擦
- 不得让已经开始的接收窗口再次建议“开启新窗口”

## Handoff Sidecar Rule

Full 的主产物始终是人类可读 brief。需要 provider 侧缓存实验时，先保留 readable brief，再通过 BB9 handoff 后处理生成 `cacheSidecar` / `activeProviderPrompt`。

不要把 sidecar 字段或 PAD 结构塞进普通 `BASEBRIEF.md` 正文。

如果用户明确要求 handoff builder 或 provider active prompt，可以在可读 brief 末尾追加结构化 JSON 附录块：

````text
<!-- BASEBRIEF_HANDOFF_JSON_BEGIN -->
```json
{ ...bb9 handoff schema input... }
```
<!-- BASEBRIEF_HANDOFF_JSON_END -->
````

该块必须满足 `schemas/bb9-handoff.schema.json`，并且只作为后处理输入。
