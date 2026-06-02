# BaseBrief 工具集成说明

BaseBrief 当前是 Skill-first Markdown 工具，不是 CLI、插件、MCP、Web UI 或 provider 接入工具。

使用方式只有一个核心动作：

```text
让你的 AI 工具读取 skills/basebrief/SKILL.md，然后按你的任务自动选择 full / lite / cache-ready。
```

## 通用安装方式

1. 下载或复制本仓库。
2. 在你的 AI 工具里打开目标项目。
3. 让 AI 读取本仓库的 `skills/basebrief/SKILL.md`。
4. 给出当前任务和边界。
5. 检查输出是否区分了 `verified_facts`、`confirmed_decisions`、`assumptions`、`open_questions`、`risk_boundaries`。

推荐起手句：

```text
请读取 BaseBrief 的 skills/basebrief/SKILL.md。
根据我接下来的任务自动选择 full、lite 或 cache-ready。
不要把推测写成事实；如果边界不清，先列 open_questions。
```

## Codex

适合场景：

- 给一个代码仓库整理阶段基线
- 给下一轮 Codex 窗口准备接续说明
- 在实现前固定事实、决策和风险边界

推荐做法：

1. 在 Codex 工作区里打开目标项目。
2. 明确告诉 Codex 去读取 BaseBrief 的 `skills/basebrief/SKILL.md`。
3. 说明本轮目标、允许范围、禁止范围。

Full 示例：

```text
请读取 BaseBrief 的 skills/basebrief/SKILL.md。
我需要整理当前项目的完整阶段基线，并生成新窗口开场白和 Agent 任务说明。
先检查真实文件和 git 状态，不要猜。
```

Lite 示例：

```text
请用 BaseBrief lite 模式做一个短接续。
本轮只涉及 1 到 2 个文件，只需要下一步说明，不要展开完整项目历史。
如果发现 backend、provider、.env、部署、state、memory 或 gateway 相关内容，升级 full。
```

Cache-ready 示例：

```text
请用 BaseBrief cache-ready 模式生成稳定前缀。
这是 prompt cache 实验，只能说明稳定前缀和绝对 cached tokens 证据。
不要宣称缓存比例、成本或延迟已经稳定胜出。
```

常见误用：

- 让 Codex 一边大改代码一边生成基线，导致事实和变更混在一起。
- 用 lite 处理 backend、provider、部署或真实 Agent runtime。
- 把 cache-ready 写成已证明省钱。

## Claude Code

适合场景：

- 长任务前先整理项目状态
- 多窗口协作前生成 handoff
- 把已有代码审查结果整理成下一轮任务

推荐起手句：

```text
Read BaseBrief's skills/basebrief/SKILL.md first.
Use it to prepare a Chinese project baseline for this repository.
Separate verified facts, confirmed decisions, assumptions, open questions, and risk boundaries.
```

如果任务较大，优先 full：

```text
Use BaseBrief full mode.
Prepare BASEBRIEF.md plus a short next-chat opener.
Do not edit files while preparing the baseline.
```

如果任务很小，才用 lite：

```text
Use BaseBrief lite mode.
This is a read-only continuation for one or two files.
Do not include long history.
```

常见误用：

- 只让 Claude Code 总结聊天记录，不让它检查仓库事实。
- 让 lite 接手模糊的大任务。
- 把 `assumptions` 写成 `verified_facts`。

## Cursor

适合场景：

- 在 IDE 内对当前项目生成交接文档
- 给后续编辑任务固定范围
- 在改代码前让 AI 明确不该碰的文件和配置

推荐做法：

1. 在 Cursor 中打开目标项目。
2. 把 BaseBrief 仓库作为可读参考，或把 `skills/basebrief/SKILL.md` 粘贴给 AI。
3. 让 AI 先输出基线，再决定是否进入代码修改。

推荐起手句：

```text
请按 BaseBrief 的 skills/basebrief/SKILL.md 工作。
先生成项目接续基线，不要直接改代码。
本轮必须写清楚允许修改范围和不得修改范围。
```

常见误用：

- 在 Composer 里直接要求“帮我优化项目”，但不给边界。
- 让 AI 同时改多个无关模块。
- 忽略 `.env`、API key、部署配置等高风险边界。

## 其他 AI 工具

只要工具能读取 Markdown，就可以手动使用 BaseBrief。

最低要求：

- 能读取 `skills/basebrief/SKILL.md`
- 能读取目标项目的必要文件
- 能按任务边界选择 full / lite / cache-ready
- 能把不确定内容放进 `open_questions`

如果工具不能访问本地文件，就把必要事实手动提供给它，不要让它编造仓库状态。

## 选择模式

- 用 `full`：完整阶段基线、新窗口开场、Agent 任务说明、复杂项目归档、风险红线整理。
- 用 `lite`：只读接续、简短交接、1 到 2 个文件的小范围任务。
- 用 `cache-ready`：明确要做稳定前缀或 prompt cache 实验。

不要用 lite 的情况：

- backend
- provider
- `.env`
- API key
- 部署
- state / memory / gateway
- 真实 Agent runtime
- 边界不清的大任务

## Cache-ready 表述边界

可以说：

- 稳定前缀更可控。
- 在 MiMo `mimo-v2.5` 的本地真实项目样本中，cache-ready 报告了更高的绝对 cached tokens。

不要说：

- cache-ready 已证明更省钱。
- cache-ready 已证明缓存比例更高。
- cache-ready 已证明延迟稳定下降。
- 不同 provider 或模型也一定成立。
