# BaseBrief 使用示例

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
