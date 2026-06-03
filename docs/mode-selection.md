# BaseBrief 模式选择

## 快速决策树

普通项目接续默认只在 `full` 和 `lite` 之间选择。`cache-ready` 是显式实验路线，不是普通第三路线。

1. 用户明确提到 `prompt cache`、`cache-ready`、`稳定前缀`、`缓存代理实验`？
   - 是：走 `cache-ready`
   - 否：继续
2. 任务是否需要完整阶段基线、新窗口开场白、Agent 任务说明、风险红线整理或复杂项目归档？
   - 是：走 `full`
   - 否：继续
3. 任务是否只属于轻量接续、简短交接、只读接续、1 到 2 个文件的小范围任务？
   - 是：继续判断 Lite 风险
   - 否：走 `full`
4. 任务是否碰 backend、provider、`.env`、API key、部署、state、memory、gateway、真实 Agent runtime？
   - 是：不要用 Lite，走 `full`
   - 否：继续
5. 边界是否清楚？
   - 是：走 `lite`
   - 否：列 `open_questions`，不要编造

## 简化原则

- `full` 负责完整、复杂、风险高
- `lite` 负责短、硬、边界清楚
- `cache-ready` 只负责显式稳定前缀 / prompt-cache 实验，不负责普通接续，也不负责证明真实缓存收益

## Handoff 规则

- `full` / `lite` 的主产物是人类可读 brief
- provider 侧 `cacheSidecar` / `activeProviderPrompt` 由 BB9 handoff 后处理生成
- 不要把 sidecar 或 PAD 结构塞进普通 Markdown brief

## 负向路由提醒

以下表达默认不应继续硬用 Lite：

- `帮我优化一下`
- `先随便推进`
- `顺便把 backend、frontend 和 deploy 一起看了`
- `把 provider 和 .env 一起配好`
- `这个运行时还有 state / memory / gateway`
