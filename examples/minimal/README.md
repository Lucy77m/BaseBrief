# BaseBrief 最小示例

这个目录展示一次不涉及 provider 或实验概念的 Lite 接续。

## 2 分钟读法

1. 先读 [项目笔记](input-project-notes.md)，把它当作来源窗口已经收集到的公开输入。
2. 再读 [Lite 交接输出](output-basebrief-lite.md)，确认事实、决策、风险边界和 open questions 没有混在一起。
3. 最后读 [下一窗口开场白](next-chat-prompt.md)，看接收窗口第一条回复应该先 recheck 什么。

这个示例的预期闭环是：

- 来源窗口只整理短接续，不新增 provider、runtime 或部署行为。
- 接收窗口先报告当前工作目录与目标仓库是否一致。
- 接收窗口区分“来源窗口已验证”和“接收窗口本轮已验证”。
- `receiver_entry_task` 完成后，才进入 `post_acceptance_next_action`。

## Runnable Recipe

Shortest first-run path:

```text
README -> docs/quickstart-5min.md -> examples/minimal
npm run check
```

Use the three files in this directory as the manual handoff recipe: read
`input-project-notes.md`, review `output-basebrief-lite.md`, then copy the
receiver-facing shape from `next-chat-prompt.md`. `npm run check` is the local
repo validation gate; it does not call a provider or add runtime behavior.

Canonical first-run smoke path:

```text
README -> docs/index.md -> docs/quickstart-5min.md -> examples/minimal -> examples/context-pack-lite
npm run check
```

After this manual Lite smoke, continue to
[`examples/context-pack-lite`](../context-pack-lite/README.md) to see the
seven-file Context Pack reading order. Doctor and File-only Export are
follow-up recipes, not required first-run steps.

## 文件顺序

阅读顺序：

1. [项目笔记](input-project-notes.md)
2. [Lite 交接输出](output-basebrief-lite.md)
3. [下一窗口开场白](next-chat-prompt.md)

目标是让下一个 AI 窗口快速知道当前事实、边界和下一步，而不是复述完整项目历史。

## 常见判断

- `ready_for_receiver` 表示可以交给下一窗口做入口核验，不表示项目任务已经完成。
- `expected_changed_files: not_applicable` 表示本示例没有声明固定 dirty-file manifest。
- `receiver_check_config: not_applicable` 表示本示例不运行自动 Safe Check，只做 state-only 手动核验。
- `difference_found` 表示接收窗口正确报告了差异，不等于执行失败。
