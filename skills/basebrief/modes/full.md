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
- 下一步
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
