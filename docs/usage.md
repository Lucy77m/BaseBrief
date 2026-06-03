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
- BB5 Cache Sidecar notes: [docs/experiments/cache-ready-sidecar.md](experiments/cache-ready-sidecar.md)
- BB6 Hybrid Anchor notes: [docs/experiments/cache-ready-hybrid-anchor.md](experiments/cache-ready-hybrid-anchor.md)
- BB9 Adaptive Selector notes: [docs/experiments/cache-ready-adaptive-selector.md](experiments/cache-ready-adaptive-selector.md)
- BB evolution log: [docs/evolution/bb-evolution-log.md](evolution/bb-evolution-log.md)
- GPT-5.5 relay usage audit: [docs/experiments/cache-ready-relay-gpt55.md](experiments/cache-ready-relay-gpt55.md)

## 6. BB9 Handoff POC 示例

普通接续仍然优先使用 `full` 或 `lite`：

```text
请用 BaseBrief 生成 lite 项目接续。只保留事实、决策、风险边界和下一步，不要展开长历史。
```

如果明确要做省钱实验，可以使用 BB9 handoff：

```text
请用 BaseBrief BB9 handoff 生成 readable brief，并在 provider profile 支持时附加 cache sidecar。保留 natural/readable fallback，不要声明真实账单已经下降。
发给 provider 的 active prompt 按 recommendedPromptType 选择；不要把 readableBrief 和 cacheSidecar 拼接到同一个请求里。
```

脚本示例：

```text
node scripts/generate_bb9_handoff.js --input examples/bb9-handoff-full-input.json --mode full --provider-profile mimo
node scripts/generate_bb9_handoff.js --input examples/bb9-handoff-lite-input.json --mode lite --provider-profile deepseek
node scripts/generate_bb9_handoff.js --input examples/bb9-handoff-lite-input.json --mode lite --provider-profile relay-openai-gpt55-codex-oauth
```

参考：

- [BB9 full output](../examples/bb9-handoff-full-output.md)
- [BB9 lite output](../examples/bb9-handoff-lite-output.md)
- [BB9 fallback output](../examples/bb9-handoff-fallback-output.md)
