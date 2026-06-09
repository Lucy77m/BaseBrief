# BaseBrief

> 我会带着上下文，一万次回到那个项目现场。

BaseBrief 是一个中文优先、local-first 的 AI 项目交接工具。

它把 repo 当前状态、已确认事实、风险边界和下一步任务整理成一个可审阅的 Context Pack，让新窗口、新模型或新的 coding agent 能接着干，而不是从“这项目是啥”开始考古。

English README: [README.en.md](README.en.md)

## 什么时候用

- 换 AI 窗口、换模型、换工具，项目还得继续。
- 想把当前 repo 状态打包成下一个接手者能读懂的 Context Pack。
- 想检查旧 Context Pack 是否已经跟 live repo 脱节。
- 想把“不能碰什么”写清楚，而不是让接手者靠猜。

BaseBrief 保持一个公开 Skill 入口和一个零依赖 CLI Lite。普通项目接续默认只在 `full` 和 `lite` 之间选择；`cache-ready` 只保留为显式 prompt-cache 实验路线。

## 2 分钟开始

让 AI 读取 BaseBrief Skill：

```text
请读取 skills/basebrief/SKILL.md。
根据当前任务选择 full 或 lite，整理项目阶段基线。
不要把推测写成事实；如果边界不清，先列 open_questions。
```

或者用 CLI Lite 生成 Context Pack：

```text
node scripts/basebrief.js context-pack --repo . --output-dir tests/outputs/private/context-pack --json
node scripts/basebrief.js check --input tests/outputs/private/context-pack --json
node scripts/basebrief.js resume --input tests/outputs/private/context-pack
```

`tests/outputs/private/` 是本仓库忽略的本地输出目录，适合放生成物。

## 常用命令

```text
node scripts/basebrief.js context-pack --repo <target-repo> --output-dir <dir> [--json]
node scripts/basebrief.js check --input <context-pack-dir> [--json]
node scripts/basebrief.js resume --input <context-pack-dir> [--json]
node scripts/basebrief.js export --input <context-pack-dir> --output-dir <dir> [--json]
node scripts/basebrief.js doctor --repo <target-repo> --context-pack <context-pack-dir> [--json]
```

主线能力是 Context Pack / Check / Resume / Export / Doctor。File-only Export 的 “MCP-friendly means future tool-consumable files”，不是 MCP server、runtime integration 或 provider integration。

## 本地验证

```text
npm test
npm run release-check
npm run check
```

这些 npm scripts 只是本地验证快捷入口；BaseBrief 不是发布到 npm 的 package、全局命令、聊天客户端、Agent runtime、托管平台、密钥管理器、项目管理系统或 provider gateway。

## 安全边界

- No provider request.
- No raw private output.
- No runtime integration.
- No schema change / No schema-v2.
- No MCP server.
- No Workflow Runner.
- 不把 `.env`、API key、token、secret 写入公开产物。
- 不把私人绝对路径写入公开文档。
- 不把假设写成已验证事实。

未配置 provider 环境变量时，release check 应保持 `provider_probe_status=skipped`。

## 继续阅读

- [5 分钟上手](docs/quickstart-5min.md)：第一次只想跑通时，走这里的 first-run smoke path；Doctor 和 File-only Export 是后续 recipe。
- [CLI Lite](docs/cli-lite.md)
- [完整文档索引与历史档案](docs/index.md)

## License

MIT
