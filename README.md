# BaseBrief

BaseBrief 是一个中文优先的 AI 项目阶段基线与交接工具。

它解决一个具体问题：当你换窗口、换模型、换 AI 工具或隔天继续开发时，让下一个接手者知道项目做到哪里、哪些事实已经确认、哪些范围不能乱动，以及下一步该做什么。

BaseBrief 保持一个公开 Skill 入口，并提供可选的零依赖 CLI Lite。普通项目接续默认只在 `full` 和 `lite` 之间选择；`cache-ready` 只保留为显式 prompt-cache 实验路线。

English README: [README.en.md](README.en.md)

## Start Here

1. [5 分钟上手](docs/quickstart-5min.md)
2. [Handoff 契约与产物](docs/handoff.md)
3. [Seal/Diff 阶段变化对比](docs/seal-diff.md)

完整文档与实验历史见 [文档索引](docs/index.md)。

## 30 秒理解

AI 接续项目时经常缺少这些信息：

- 当前目标与项目状态
- 已验证事实和已确认决策
- 假设与待确认问题
- 风险边界和禁止范围
- 下一步任务与期望输出

BaseBrief 将这些信息整理成可读的 Full 或 Lite brief。需要本地重复生成、检查或阶段对比时，可以使用 CLI Lite。

## 最短用法

让 AI 读取 BaseBrief Skill：

```text
请读取 BaseBrief 的 skills/basebrief/SKILL.md。
根据当前任务选择 full 或 lite，整理项目阶段基线。
不要把推测写成事实；如果边界不清，先列 open_questions。
```

小范围接续使用 Lite；完整阶段收口、复杂任务或风险边界不清时使用 Full。

也可以从公开 structured example 构建本地产物：

```text
node scripts/basebrief.js build --input examples/structured-handoff-lite.md --output-dir tests/outputs/private/quickstart/build --check
```

CLI Lite 是可选的本地脚本，不是安装式 CLI、插件或 provider integration。

本仓库也提供最小 npm scripts 作为本地验证快捷入口：

```text
npm test
npm run release-check
npm run check
```

这些 scripts 只包装本地 Node 命令；BaseBrief 仍不是发布到 npm 的 package、全局命令、插件或 provider integration。

## Seal/Diff

Seal/Diff 用来回答：阶段前后，事实、决策、风险边界和下一步任务发生了什么变化？

```text
node scripts/basebrief.js seal --input examples/seal-before-input.json --output tests/outputs/private/quickstart/before.json
node scripts/basebrief.js diff --before tests/outputs/private/quickstart/before.json --after examples/seal-after-input.json
```

它只处理显式输入文件，不扫描或修改其他项目。

## 核心边界

- `full`：完整阶段基线、复杂交接、风险较高或边界不清的任务。
- `lite`：短接续、只读交接、1 到 2 个文件的明确小范围任务。
- `cache-ready`：仅用于明确的稳定前缀或 prompt-cache 实验，不是普通第三模式。
- readable brief 是普通用户的主产物；provider-facing artifacts 属于显式高级后处理。
- provider-specific estimated-cost evidence 不是跨 provider 证明，也不是真实账单审计。

## 安全边界

- 不把 `.env`、API key、token、secret 写入公开产物。
- 不把私人绝对路径写入公开文档。
- 不把假设写成已验证事实。
- 不自动修改外部项目或宿主工具配置。

## 当前能力

- 单一公开 Skill 入口，内部路由到 Full / Lite
- BB9 structured handoff contract
- Handoff Builder 与 Codex / Claude 文件型 Adapter
- Artifact Checker
- 可选、只读的 Receiver Safe Check v1
- 零依赖 CLI Lite：`init`、`build`、`check`、`receiver-init`、`receiver-check`、`receiver-flow`、`review-draft`、`state-init`、`state-read`、`seal`、`diff`
- 本地、文件型 Seal/Diff v1

BaseBrief 不是聊天客户端、Agent runtime、托管平台、密钥管理器、项目管理系统或 provider gateway。

## 继续阅读

- [5 分钟上手](docs/quickstart-5min.md)
- [工具集成](docs/integrations.md)
- [模式选择](docs/mode-selection.md)
- [CLI Lite](docs/cli-lite.md)
- [Receiver Safe Check](docs/receiver-check.md)
- [Receiver Flow Draft](docs/receiver-flow.md)
- [Project State](docs/project-state.md)
- [Project State model](docs/design/project-state-model.md)
- [Project State validation rules](docs/design/project-state-validation-rules.md)
- [Receiver friction log](docs/dogfooding/receiver-friction-log.md)
- [Receiver Flow dogfooding evidence](docs/dogfooding/receiver-flow-dogfooding.md)
- [Receiver Flow guided dogfooding](docs/dogfooding/receiver-flow-guided-dogfooding.md)
- [Receiver Flow review-draft dogfooding](docs/dogfooding/receiver-flow-review-draft-dogfooding.md)
- [Receiver Flow extract dogfooding](docs/dogfooding/receiver-flow-extract-dogfooding.md)
- [Receiver Flow v0.5.x closure dogfooding](docs/dogfooding/receiver-flow-v0.5.x-closure.md)
- [Project State dogfooding](docs/dogfooding/project-state-dogfooding.md)
- [Project State self-dogfooding v0.6.x](docs/dogfooding/project-state-self-dogfooding-v0.6.x.md)
- [Project State self-dogfooding v0.6.2](docs/dogfooding/project-state-self-dogfooding-v0.6.2.md)
- [v0.6.0 post-release baseline](docs/baselines/v0.6.0-post-release-baseline.md)
- [v0.6.x test matrix](docs/testing-v0.6.x-test-matrix.md)
- [v0.6.2 Self-Dogfooding Evidence Candidate](docs/releases/v0.6.2.md)
- [v0.6.0 Project State Directory Release](docs/releases/v0.6.0.md)
- [v0.5.3 Receiver Flow Review Closure](docs/releases/v0.5.3.md)
- [v0.5.2 Receiver Flow Extract Candidate](docs/releases/v0.5.2.md)
- [v0.5.1 Review Draft Gate Candidate](docs/releases/v0.5.1.md)
- [v0.5.0 Guided Receiver Flow Candidate](docs/releases/v0.5.0.md)
- [v0.4.1 Stabilization Candidate](docs/releases/v0.4.1.md)
- [v0.4.0 Release Candidate](docs/releases/v0.4.0.md)
- [v0.3.3 Release Candidate](docs/releases/v0.3.3.md)
- [v0.3.2 Release Candidate](docs/releases/v0.3.2.md)
- [v0.3.1 Release Candidate](docs/releases/v0.3.1.md)
- [v0.3.0 Receiver workflow baseline](docs/releases/v0.3.0.md)
- [已知限制](docs/known-limitations.md)
- [完整文档索引](docs/index.md)
- [公开最小示例](examples/minimal/README.md)

## License

见 [LICENSE](LICENSE)。
