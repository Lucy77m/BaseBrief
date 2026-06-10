# BaseBrief

> 我会带着上下文，一万次回到那个项目现场。

BaseBrief 是一个 local-first 的 AI 项目接续工具。

当一个 AI 聊天窗口快结束、模型要切换、或者你要把项目交给另一个 AI 时，BaseBrief 可以把当前 repo 整理成一个可审阅、可检查、可复制给下一窗口的接续包。

English README: [README.en.md](README.en.md)

## 什么时候用

- 你和 AI 做了一个项目，但窗口快爆了。
- 你想从 OpenCode 切到 Codex、Claude、Cursor 或另一个工具。
- 你不想每次手写项目背景、已完成内容和下一步。
- 你希望下一个 AI 先理解现状、边界和风险，再继续动手。

## 先跑这一条

```text
node scripts/basebrief.js continue --repo . --output-dir tests/outputs/private/continue
```

`tests/outputs/private/` 已被本仓库忽略，适合放本地生成物。

## 你会得到什么

- `NEXT_WINDOW_STARTER.md`：复制给下一个 AI 窗口的开场白。
- `CHECK_SUMMARY.md`：这份接续包是否可用，有没有需要人工看的问题。
- `CONTINUATION_REPORT.md`：本次 repo 状态、变更和风险摘要。
- `context-pack/`：更完整的项目上下文资料包。

第一次只想看懂流程，可以先读 [simple continuation 示例](examples/simple-continuation/README.md)。

## BaseBrief 不做什么

- 不调用模型或 provider。
- 不自动写代码。
- 不自动 commit、push、tag、release 或开 PR。
- 不读取或保存密钥。
- 不连接云服务、MCP server、runtime 或后台 daemon。
- 不替代项目管理系统、Agent runtime 或完整 spec framework。

## 普通路径和高级路径

普通用户先记住一个命令：

```text
continue = 生成下一窗口接续包
```

如果你用 `skills/basebrief/SKILL.md`，普通项目接续默认只在 `full` 和 `lite` 之间选择；`cache-ready` 只保留为显式 prompt-cache 实验路线。

更细的 `context-pack`、`check`、`resume`、Project Profile、Workflow Runner Lite、Export、Doctor、Seal/Diff 和 Project State 都放在 [高级用法](docs/advanced.md)。它们不是第一次跑通的主路径。

## 继续阅读

- [为什么需要 BaseBrief](docs/why-basebrief.md)
- [核心概念，用人话解释](docs/concepts-simple.md)
- [5 分钟上手](docs/quickstart-5min.md)
- [高级用法](docs/advanced.md)
- [完整文档索引与历史档案](docs/index.md)

## 本地验证

```text
npm test
npm run release-check
npm run check
```

这些 npm scripts 只是本地验证快捷入口；BaseBrief 不是发布到 npm 的 package 或全局命令。未配置 provider 环境变量时，release check 应保持 `provider_probe_status=skipped`。

## License

MIT
