# BaseBrief 使用示例

如果你是第一次使用，先看：

- 工具集成：[integrations.md](integrations.md)
- 完整 walkthrough：[walkthrough.md](walkthrough.md)

本页只保留模式级示例索引。

## 1. Full 示例

适合：

- 刚完成一个阶段
- 需要完整基线
- 需要给新窗口或下一个 Agent 接续

示例请求：

```text
请用 BaseBrief 帮我整理当前项目阶段基线。
我需要完整版本，并额外准备新窗口开场白和 Agent 任务说明。
```

预期：

- 走 `full`
- 生成 `BASEBRIEF.md`
- 按需派生 `NEXT_CHAT_PROMPT.md`、`AGENT_TASK.md`
- 可参考：[examples/full-example.md](../examples/full-example.md)

## 2. Lite 示例

适合：

- 只读接续
- 1 到 2 个文件的小范围任务说明

示例请求：

```text
请用 BaseBrief 做一个 lite 接续。
本轮只看一个前端组件，确认边界后给下一步，不要展开长历史。
```

预期：

- 走 `lite`
- 只使用 `BASEBRIEF_LITE.md`
- 可参考：[examples/lite-example.md](../examples/lite-example.md)

## 3. Cache-ready 示例

适合：

- 明确要做稳定前缀或缓存代理实验

示例请求：

```text
请用 BaseBrief 的 cache-ready 模式生成一个稳定前缀输入，
我要做 prompt cache 代理实验，不要宣称真实缓存命中已经提升。
```

预期：

- 走 `cache-ready`
- 使用 `CACHE_READY_LITE_INPUT.json`
- 配合脚本生成固定顺序输出
- 可参考：
  - [examples/cache-ready-input.json](../examples/cache-ready-input.json)
  - [examples/cache-ready-output.md](../examples/cache-ready-output.md)

## 4. 新窗口开场白示例

- 参考：[examples/next-chat-example.md](../examples/next-chat-example.md)

## 5. Agent 任务说明示例

- 参考：[examples/agent-task-example.md](../examples/agent-task-example.md)
- BB2 Cache Capsule notes: [docs/experiments/cache-ready-capsule.md](experiments/cache-ready-capsule.md)
- BB2 example input: [examples/cache-ready-capsule-input.json](../examples/cache-ready-capsule-input.json)
- BB2 example output: [examples/cache-ready-capsule-output.md](../examples/cache-ready-capsule-output.md)
- BB3 Cache Anchor notes: [docs/experiments/cache-ready-anchor.md](experiments/cache-ready-anchor.md)
- BB3 example input: [examples/cache-ready-anchor-input.json](../examples/cache-ready-anchor-input.json)
- BB3 example output: [examples/cache-ready-anchor-output.md](../examples/cache-ready-anchor-output.md)
- BB4 Anchor Pad notes: [docs/experiments/cache-ready-anchor-pad.md](experiments/cache-ready-anchor-pad.md)
- BB4 example input: [examples/cache-ready-anchor-pad-input.json](../examples/cache-ready-anchor-pad-input.json)
- BB4 example output: [examples/cache-ready-anchor-pad-output.md](../examples/cache-ready-anchor-pad-output.md)
- Readable Full/Lite POC notes: [docs/experiments/cache-ready-readable-poc.md](experiments/cache-ready-readable-poc.md)
