# BaseBrief 5 分钟上手

BaseBrief 用于在换窗口、换模型、换工具或隔天继续开发时，保留项目当前状态和任务边界。

第一次使用时，不需要理解 BB 实验、provider profile 或 cache sidecar。先完成一次可读的 Full 或 Lite 交接即可。

## 路径 A：让 AI 生成 Lite 交接

适用于只读接续或 1 到 2 个文件的明确小任务。

```text
请读取 BaseBrief 的 skills/basebrief/SKILL.md。
请用 lite 整理当前任务的短接续。
先检查真实文件，不要把推测写成事实。
请明确 verified_facts、confirmed_decisions、risk_boundaries、open_questions 和下一步。
```

如果任务涉及 backend、provider、`.env`、部署、运行时状态，或者边界不清，改用 Full。

可以先查看 [公开最小示例](../examples/minimal/README.md)。

## 路径 B：构建并检查 Handoff 产物

仓库包含零依赖 CLI Lite。它只处理你显式传入的文件和输出目录。

```text
node scripts/basebrief.js build --input examples/structured-handoff-lite.md --output-dir tests/outputs/private/quickstart/build --check
node scripts/basebrief.js check --input tests/outputs/private/quickstart/build
```

输出包括：

- `readableBrief.md`：给人和下一个 AI 窗口阅读
- `activeProviderPrompt.md`：根据显式 profile 选择的 provider-facing 产物
- `handoff.meta.json`：不复制完整 prompt 的 metadata

普通接续直接使用 `readableBrief.md`。不需要 provider-aware 后处理时，不必处理其他产物。

## 路径 C：用 Seal/Diff 对比阶段变化

```text
node scripts/basebrief.js seal --input examples/seal-before-input.json --output tests/outputs/private/quickstart/before.json
node scripts/basebrief.js diff --before tests/outputs/private/quickstart/before.json --after examples/seal-after-input.json
```

Seal/Diff 对比事实、决策、风险边界、open questions 和任务边界。它不会扫描或修改其他项目。

`tests/outputs/private/` 已被仓库忽略，可用于本地演练；完成后可以直接删除其中的 `quickstart/` 目录。

## Full 和 Lite 怎么选

- 使用 Full：完整阶段收口、复杂交接、风险较高、范围不清。
- 使用 Lite：短接续、只读交接、1 到 2 个文件的明确范围。
- 不确定时使用 Full，或者先补充 `open_questions`。

`cache-ready` 只用于明确的 prompt-cache 实验，不是普通第三模式。

## 下一窗口怎么接手

把可读 brief 交给下一个窗口，并使用类似开场：

```text
请先读取这份 BaseBrief。
以其中的 verified_facts、confirmed_decisions 和 risk_boundaries 为准。
开始前检查当前仓库状态；如果事实已经变化，先指出差异，不要猜。
```

## 下一步

- [Handoff 契约](handoff.md)
- [Seal/Diff](seal-diff.md)
- [模式选择](mode-selection.md)
- [完整文档索引](index.md)
