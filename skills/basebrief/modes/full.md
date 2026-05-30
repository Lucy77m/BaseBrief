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
