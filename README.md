# BaseBrief

BaseBrief 是一个中文优先的 AI 项目阶段基线与交接工具。

它解决一个具体问题：当你换窗口、换模型、换 AI 工具或隔天继续开发时，让下一个接手者知道项目做到哪里、哪些事实已经确认、哪些范围不能乱动，以及下一步该做什么。

BaseBrief 保持一个公开 Skill 入口，并提供可选的零依赖 CLI Lite。普通项目接续默认只在 `full` 和 `lite` 之间选择；`cache-ready` 只保留为显式 prompt-cache 实验路线。

English README: [README.en.md](README.en.md)

## Start Here

1. [5 分钟上手](docs/quickstart-5min.md)
2. [Handoff 契约与产物](docs/handoff.md)
3. [Integrated Handoff Golden Path](docs/golden-path.md)
4. [Seal/Diff 阶段变化对比](docs/seal-diff.md)
5. [v2.2.0 One-command Resume / New-window Prompt Plan](docs/releases/v2.2.0-plan.md)

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

## Project State Sidecar

当仓库里已有有效的 `.basebrief/state.json` 时，可以用 Sidecar 把 Project State 打包成新窗口可接手的本地 bundle：

```text
node scripts/basebrief.js sidecar-build --repo . --target generic --starter-language zh-CN --output-dir tests/outputs/private/sidecar-generic --json
node scripts/basebrief.js sidecar-check --input tests/outputs/private/sidecar-generic --json
```

`sidecar-build` 生成 `generic` 或 `openclaw` handoff bundle，并额外写出可复制的新窗口开场白 `new-window-starter.md`，要求 receiver 复述关键字段、报告 `pass/fail` 并等待确认；`--starter-language auto|zh-CN|en|ja` 只控制开场白外壳语言，协议字段、路径、文件名和英文 hard-stop 锚点保持原文。`sidecar-check` 只读验收 bundle 结构、接手边界和新开场白。v0.8.x Sidecar 是 `basebrief-project-state-v1` 的本地消费层，不改变 schema，不是 Auto Flow，不创建新会话，不调用 provider，也不接入 OpenClaw/Hermes runtime。Sidecar 公开边界保持 No provider request / No raw private output / No runtime integration / No schema change；未注入 provider 环境变量时 release checks 保持 `provider_probe_status=skipped`。公开记录见 [v0.8.0](docs/releases/v0.8.0.md)、[v0.8.1](docs/releases/v0.8.1.md)、[v0.8.2](docs/releases/v0.8.2.md)、[v0.8.3](docs/releases/v0.8.3.md)、[v0.8.6](docs/releases/v0.8.6.md)、[v0.8.7](docs/releases/v0.8.7.md)、[v0.8.8](docs/releases/v0.8.8.md) 与 [v0.8.x test matrix](docs/testing-v0.8.x-test-matrix.md)。

`v0.9.0` 是 Integrated Handoff Readiness / public hardening candidate：它把 receiver-ready handoff、Project State、Sidecar bundle 和 receiver 首条回复整理成一条本地 readiness 线，不是 provider、runtime、schema、Auto Flow、插件、平台化或 v1.0 工作。见 [v0.9.0 Integrated Handoff Readiness](docs/releases/v0.9.0.md)。
`v0.9.1` 则把这条 readiness 线收敛成更好跟走的 public golden path：`receiver-ready.md -> state-init/state-advance -> sidecar-build -> sidecar-check -> new-window-starter.md -> receiver first response`。它只做 docs/usability hardening，不新增命令、不改 schema。入口见 [Integrated Handoff Golden Path](docs/golden-path.md) 与 [v0.9.1 Golden Path Closure Candidate](docs/releases/v0.9.1.md)。
`v0.9.2` 再补上一套 public-safe 的 [Golden Path example kit](examples/golden-path/README.md)，让用户不只知道该走哪条路径，也拿得到 first-pass / follow-up 的公开样例闭环。见 [v0.9.2 Golden Path Example Closure Candidate](docs/releases/v0.9.2.md)。
`v0.9.3` 最后把 `v0.9.x` 收成一条可发布前审看的 local closure/freeze line：`v0.9.0` 定义，`v0.9.1` 指路，`v0.9.2` 给样例，`v0.9.3` 收口冻结。它只补聚合测试矩阵、路线文案和最终 release doc，不新增命令、不改 schema，也不引入 runtime/provider 行为。见 [v0.9.x Integrated Handoff Closure Matrix](docs/testing-v0.9.x-test-matrix.md) 与 [v0.9.3 Final Closure / Freeze Candidate](docs/releases/v0.9.3.md)。

`v1.0.0` 用 Delta Handoff RC hardening 开启这条线：新增本地 `delta` 命令，把当前 Project State、git range facts、changed-file facts 和 Seal/Diff 状态变化整理成 reviewable `delta-handoff.md`。到 `v1.9.1`，这条 public v1.x Delta Handoff / Receiver line 已本地收口并冻结，覆盖 Delta Handoff、Receiver Acceptance、Report Kit、Starter Integration、Usage Pack、Lint Mini、Fixture Pack、Repair Pack、Dogfooding Evidence 和 Discoverability / Adoption。它始终保持 local-first，不推进 provider、runtime、plugin、MCP、IDE、schema-v2 或平台化工作；`basebrief-project-state-v1` 保持不变，未注入 provider 环境变量时 release checks 仍保持 `provider_probe_status=skipped`。入口见 [v1.9.1 Delta Receiver Final Closure / Freeze](docs/releases/v1.9.1.md)、[v1.x Delta Receiver Closure Matrix](docs/testing-v1.x-delta-receiver-closure-matrix.md)、[v1.0.0 Delta Handoff RC Candidate](docs/releases/v1.0.0.md)、[Delta Handoff Spec](docs/specs/delta-handoff.md)、[Delta Handoff fresh receiver dogfooding v1.0](docs/dogfooding/delta-handoff-fresh-receiver-v1.0.md) 与 [Delta Handoff baseline-advance dogfooding v1.0](docs/dogfooding/delta-handoff-baseline-advance-v1.0.md)。

`v2.0.0` 开启并本地收口 Context Pack Lite：新增本地 `context-pack` 命令，把 repo live facts、固定 public-safe 入口文件、近期 git 信息、风险边界和 receiver state presence checks 编译成 7 个 reviewable Markdown artifacts。它不是 provider/runtime/plugin/MCP/IDE/schema-v2/Workflow Runner，也不是 repo dump；缺输入时用 `not_available`、`not_applicable` 或 `needs-review` 明示。入口见 [v2.0.0 Context Pack Lite Local Closeout](docs/releases/v2.0.0.md)、[Context Pack Lite Spec](docs/specs/context-pack-lite.md)、[Context Pack Lite example kit](examples/context-pack-lite/README.md) 与 [Context Pack Lite fresh receiver dogfooding v2.0.0](docs/dogfooding/context-pack-lite-fresh-receiver-v2.0.0.md)。

`v2.1.0` 本地收口 Context Pack Check：继续复用 `check --input <context-pack-dir>`，对 Context Pack Lite 目录检查 7 文件完整性、共享 review metadata、manifest live facts、风险边界、receiver state 缺输入语义、starter 指令、public safety 与保守厚度 warning。它不新增 `context-pack-check` 顶层命令，不改 CLI JSON 顶层 shape，也不改 `context-pack` generator 输出。入口见 [v2.1.0 Context Pack Check Local Closeout](docs/releases/v2.1.0.md)、[v2.1.0 Context Pack Check Plan](docs/releases/v2.1.0-plan.md)、[Context Pack Check Spec](docs/specs/context-pack-check.md) 与 [Context Pack Check Acceptance v2.1.0](docs/dogfooding/context-pack-check-acceptance-v2.1.0.md)。
`v2.2.0` starts the docs-first One-command Resume / New-window Prompt line. The narrow surface is `resume --input <context-pack-dir>`: it reuses the existing Context Pack Check result, prints a copyable new-window prompt, carries warning-only findings as review notes, and stops on error findings. It does not change Context Pack Lite generator output or the `check --input <dir> --json` shape, and it does not add provider, runtime, plugin, MCP, IDE, hosted, cloud-memory, schema-v2, or Workflow Runner behavior. Entry points: [v2.2.0 One-command Resume / New-window Prompt Plan](docs/releases/v2.2.0-plan.md) and [Context Pack Resume Spec](docs/specs/context-pack-resume.md).
`v2.2.0` is locally closed by [v2.2.0 One-command Resume / New-window Prompt Local Closeout](docs/releases/v2.2.0.md) and [Context Pack Resume Dogfooding v2.2.0](docs/dogfooding/context-pack-resume-v2.2.0.md). The next docs-first line is `v2.3.0` BaseBrief Format: it freezes the future local packaging direction around `context-pack/`, `context-pack.md`, and `context.json` without adding a command, generator, JSON schema file, schema-v2, provider, runtime, plugin, MCP, IDE, hosted, cloud-memory, or Workflow Runner behavior. Entry points: [v2.3.0 BaseBrief Format Plan](docs/releases/v2.3.0-plan.md) and [BaseBrief Format Spec](docs/specs/basebrief-format.md).
`v2.4.0` starts the File-only Adapter / MCP-friendly Export line. It adds the local `export --input <context-pack-dir> --output-dir <dir>` command, which turns a checked Context Pack Lite directory into `manifest.json`, `context-pack.md`, `context.json`, and `adapter-notes.md`. It does not change Context Pack Lite generator output, `check --input <dir> --json`, or `resume`; it does not add provider, runtime, plugin, MCP server, IDE, hosted, cloud-memory, schema-v2, or Workflow Runner behavior. MCP-friendly means future tool-consumable files, not an MCP server or runtime integration. Entry points: [v2.4.0 File-only Adapter / MCP-friendly Export Plan](docs/releases/v2.4.0-plan.md), [v2.4.0 File-only Adapter / MCP-friendly Export Local Closeout](docs/releases/v2.4.0.md), and [File-only Export Spec](docs/specs/file-only-export.md).
`v2.4.0` dogfooding records that the four-file export bundle is enough for a receiver-style continuation review while still requiring live repo fact rechecks before implementation. Evidence: [File-only Export Dogfooding v2.4.0](docs/dogfooding/file-only-export-v2.4.0.md).
`v2.4.0` also includes a public-safe [File-only Export example kit](examples/file-only-export/README.md). In that kit, `exports/` is a recommended example output directory name; the CLI writes the four files directly under the explicit `--output-dir` directory.
`v2.5.0` adds the local read-only `doctor --repo <target-repo> --context-pack <context-pack-dir>` diagnostic. It compares live repo facts with an explicit Context Pack Lite snapshot, propagates Context Pack Check errors and warnings, reports stale HEAD, branch mismatch, dirty worktree, live-recheck, and boundary wording findings, and writes nothing. It does not add `status`, watcher, daemon, auto-fix, provider, runtime, plugin, MCP server/tools, IDE, hosted, cloud-memory, schema-v2, or Workflow Runner behavior. Entry points: [v2.5.0 Context Pack Doctor Plan](docs/releases/v2.5.0-plan.md), [v2.5.0 Context Pack Doctor Local Closeout](docs/releases/v2.5.0.md), [Context Pack Doctor Spec](docs/specs/context-pack-doctor.md), [Context Pack Doctor Dogfooding v2.5.0](docs/dogfooding/context-pack-doctor-v2.5.0.md), and [Context Pack Doctor example kit](examples/context-pack-doctor/README.md).

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
- 零依赖 CLI Lite：`init`、`build`、`check`、`receiver-init`、`receiver-check`、`receiver-flow`、`review-draft`、`state-init`、`state-read`、`state-status`、`state-validate`、`state-history`、`state-advance`、`sidecar-build`、`sidecar-check`、`seal`、`diff`、`delta`、`context-pack`、`resume`、`export`
- Project State Sidecar：从本地 `basebrief-project-state-v1` 生成 `generic` / `openclaw` bundle 和 `new-window-starter.md`，并用 `basebrief-sidecar-v1` 做只读结构验收
- 本地、文件型 Seal/Diff v1

BaseBrief 不是聊天客户端、Agent runtime、托管平台、密钥管理器、项目管理系统或 provider gateway。

## 继续阅读

- [5 分钟上手](docs/quickstart-5min.md)
- [工具集成](docs/integrations.md)
- [模式选择](docs/mode-selection.md)
- [Integrated Handoff Golden Path](docs/golden-path.md)
- [Golden Path example kit](examples/golden-path/README.md)
- [CLI Lite](docs/cli-lite.md)
- [Receiver Safe Check](docs/receiver-check.md)
- [Receiver Flow Draft](docs/receiver-flow.md)
- [Project State](docs/project-state.md)
- [Project State model](docs/design/project-state-model.md)
- [Project State validation rules](docs/design/project-state-validation-rules.md)
- [Project State lifecycle readiness](docs/design/project-state-lifecycle-readiness.md)
- [Project State lifecycle model](docs/design/project-state-lifecycle-model.md)
- [v0.9.0 Integrated Handoff Readiness](docs/releases/v0.9.0.md)
- [v0.9.1 Golden Path Closure Candidate](docs/releases/v0.9.1.md)
- [v0.9.2 Golden Path Example Closure Candidate](docs/releases/v0.9.2.md)
- [v0.9.3 Final Closure / Freeze Candidate](docs/releases/v0.9.3.md)
- [v1.9.1 Delta Receiver Final Closure / Freeze](docs/releases/v1.9.1.md)
- [v1.x Delta Receiver Closure Matrix](docs/testing-v1.x-delta-receiver-closure-matrix.md)
- [v1.0.0 Delta Handoff RC Candidate](docs/releases/v1.0.0.md)
- [Delta Handoff Spec](docs/specs/delta-handoff.md)
- [Delta Handoff fresh receiver dogfooding v1.0](docs/dogfooding/delta-handoff-fresh-receiver-v1.0.md)
- [Delta Handoff baseline-advance dogfooding v1.0](docs/dogfooding/delta-handoff-baseline-advance-v1.0.md)
- [v2.0.0 Context Pack Lite Local Closeout](docs/releases/v2.0.0.md)
- [Context Pack Lite Spec](docs/specs/context-pack-lite.md)
- [v2.1.0 Context Pack Check Local Closeout](docs/releases/v2.1.0.md)
- [v2.1.0 Context Pack Check Plan](docs/releases/v2.1.0-plan.md)
- [Context Pack Check Spec](docs/specs/context-pack-check.md)
- [Context Pack Check Acceptance v2.1.0](docs/dogfooding/context-pack-check-acceptance-v2.1.0.md)
- [v2.2.0 One-command Resume / New-window Prompt Plan](docs/releases/v2.2.0-plan.md)
- [v2.2.0 One-command Resume / New-window Prompt Local Closeout](docs/releases/v2.2.0.md)
- [Context Pack Resume Spec](docs/specs/context-pack-resume.md)
- [Context Pack Resume Dogfooding v2.2.0](docs/dogfooding/context-pack-resume-v2.2.0.md)
- [v2.3.0 BaseBrief Format Plan](docs/releases/v2.3.0-plan.md)
- [BaseBrief Format Spec](docs/specs/basebrief-format.md)
- [v2.4.0 File-only Adapter / MCP-friendly Export Plan](docs/releases/v2.4.0-plan.md)
- [v2.4.0 File-only Adapter / MCP-friendly Export Local Closeout](docs/releases/v2.4.0.md)
- [File-only Export Spec](docs/specs/file-only-export.md)
- [File-only Export Dogfooding v2.4.0](docs/dogfooding/file-only-export-v2.4.0.md)
- [File-only Export example kit](examples/file-only-export/README.md)
- [v2.5.0 Context Pack Doctor Plan](docs/releases/v2.5.0-plan.md)
- [v2.5.0 Context Pack Doctor Local Closeout](docs/releases/v2.5.0.md)
- [Context Pack Doctor Spec](docs/specs/context-pack-doctor.md)
- [Context Pack Doctor Dogfooding v2.5.0](docs/dogfooding/context-pack-doctor-v2.5.0.md)
- [Context Pack Doctor example kit](examples/context-pack-doctor/README.md)
- [Context Pack Lite example kit](examples/context-pack-lite/README.md)
- [Context Pack Lite fresh receiver dogfooding v2.0.0](docs/dogfooding/context-pack-lite-fresh-receiver-v2.0.0.md)
- [v0.9.x Integrated Handoff Closure Matrix](docs/testing-v0.9.x-test-matrix.md)
- [v0.8.x sidecar test matrix](docs/testing-v0.8.x-test-matrix.md)
- [v0.8.7 Copyable New-Window Starter](docs/releases/v0.8.7.md)
- [v0.8.6 Manual Receiver Smoke Result Intake Evidence](docs/releases/v0.8.6.md)
- [v0.8.3 Sidecar Discoverability Polish](docs/releases/v0.8.3.md)
- [v0.8.2 Sidecar Receiver Acceptance Evidence](docs/releases/v0.8.2.md)
- [v0.8.1 Sidecar Check Hardening](docs/releases/v0.8.1.md)
- [v0.8.0 Sidecar Handoff Bundle](docs/releases/v0.8.0.md)
- [Sidecar receiver acceptance v0.8.2](docs/dogfooding/sidecar-receiver-acceptance-v0.8.2.md)
- [Receiver friction log](docs/dogfooding/receiver-friction-log.md)
- [Receiver Flow dogfooding evidence](docs/dogfooding/receiver-flow-dogfooding.md)
- [Receiver Flow guided dogfooding](docs/dogfooding/receiver-flow-guided-dogfooding.md)
- [Receiver Flow review-draft dogfooding](docs/dogfooding/receiver-flow-review-draft-dogfooding.md)
- [Receiver Flow extract dogfooding](docs/dogfooding/receiver-flow-extract-dogfooding.md)
- [Receiver Flow v0.5.x closure dogfooding](docs/dogfooding/receiver-flow-v0.5.x-closure.md)
- [Project State dogfooding](docs/dogfooding/project-state-dogfooding.md)
- [Project State self-dogfooding v0.6.x](docs/dogfooding/project-state-self-dogfooding-v0.6.x.md)
- [Project State self-dogfooding v0.6.2](docs/dogfooding/project-state-self-dogfooding-v0.6.2.md)
- [Project State lifecycle readiness v0.6.3](docs/dogfooding/project-state-lifecycle-readiness-v0.6.3.md)
- [Project State lifecycle v0.7.0](docs/dogfooding/project-state-lifecycle-v0.7.0.md)
- [v0.6.0 post-release baseline](docs/baselines/v0.6.0-post-release-baseline.md)
- [v0.6.x test matrix](docs/testing-v0.6.x-test-matrix.md)
- [v0.7.x test matrix](docs/testing-v0.7.x-test-matrix.md)
- [v0.7.0 Project State Lifecycle Candidate](docs/releases/v0.7.0.md)
- [v0.6.3 Lifecycle Readiness Gate Candidate](docs/releases/v0.6.3.md)
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
