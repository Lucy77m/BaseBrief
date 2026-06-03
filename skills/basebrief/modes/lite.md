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
- 下一步
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

## Handoff Sidecar Rule

Lite 的主产物始终是短、硬、可读的接续 brief。需要 provider 侧缓存实验时，先保留 readable brief，再通过 BB9 handoff 后处理生成 `cacheSidecar` / `activeProviderPrompt`。

不要为了缓存实验把 Lite 正文改成 provider-only sidecar 格式。
