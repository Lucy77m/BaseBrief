# Full Example: BaseBrief Public Release Baseline

## Scenario

BaseBrief has a public `v0.1.0` release and needs a complete phase baseline before the next iteration. The repository is a Skill-first Markdown package with scripts, examples, docs, and cache-ready fixtures.

## Request

```text
请用 BaseBrief 整理当前公开仓库的完整阶段基线。
我需要 full 模式，并额外准备新窗口开场白和 Agent 任务说明。
不要扩大到 CLI、Web UI、MCP 或真实 provider 接入实现。
```

## Route Decision

- Expected mode: `full`
- Reason: the task asks for a complete phase baseline, next-chat opener, agent handoff, and risk boundaries.
- Lite is not enough because the output must preserve project identity, release state, decisions, risks, and next iteration scope.

## Input Facts

- Project identity: BaseBrief is a Chinese-first, Skill-first project baseline tool.
- Public entry: one `skills/basebrief/SKILL.md` entry routes internally to `full`, `lite`, and `cache-ready`.
- Current public release: `v0.1.0`.
- Current shape: Markdown templates, docs, examples, validation scripts, and cache-ready fixtures.
- Explicit non-goals for this round: CLI, Web UI, MCP, plugin packaging, deployment, and secret management.

## Expected Output Excerpt

```md
# BaseBrief 项目阶段基线

## verified_facts / 已验证事实

- BaseBrief 对外只有一个 Skill 入口：`skills/basebrief/SKILL.md`。
- 内部模式包括 `full`、`lite`、`cache-ready`。
- `cache-ready` 只能作为稳定前缀实验，不宣称真实费用或延迟收益已经被证明。

## confirmed_decisions / 用户已确认决策

- 保持中文优先。
- 保持 Skill-first。
- 保持单入口三模式结构。
- 下一轮优先加强示例、测试和 MiMo provider probe。

## risk_boundaries / 风险红线

- 不写入 `.env`、API key、token 或 secret。
- 不把私有绝对路径放进公开文档。
- 不把 cache-ready 写成已稳定证明的 provider 级收益。
```

## Acceptance Checks

- The baseline separates facts, decisions, assumptions, open questions, and risk boundaries.
- The next-chat opener is short enough to paste into a new window.
- The agent task handoff states what to change, what not to change, and when to stop.
- No private path, secret, or overclaimed cache benefit appears in the output.
