# Lite Example: One Bounded BaseBrief Follow-up

## Scenario

BaseBrief already has a public release baseline. The next window only needs a short continuation for one bounded follow-up: review the public examples and decide whether they are concrete enough.

## Request

```text
请用 BaseBrief lite 模式做一个短接续。
本轮只读检查 `examples/full-example.md` 和 `examples/lite-example.md`，
判断它们是否已经像真实端到端样例，不要展开完整项目历史。
```

## Route Decision

- Expected mode: `lite`
- Reason: the task is read-only, limited to two files, and asks for a short handoff.
- Upgrade to `full` if the task expands into release planning, provider testing, CLI design, deployment, or repository-wide changes.

## Input Facts

- BaseBrief is a public Skill-first Markdown package.
- The files under review are limited to two public example files.
- The goal is quality judgment, not implementation.

## Expected Output Excerpt

```md
# BaseBrief Lite 接续基线

## verified_facts / 已验证事实

- 本轮只读检查两个公开示例文件。
- 不需要重新整理完整 release baseline。
- 不涉及 provider、`.env`、部署、state、memory 或 gateway。

## risk_boundaries / 风险边界

- 允许范围：只评价两个 example 文件的真实感和端到端完整度。
- 不得擅自进入：CLI、package 发布、provider probe、全仓库重写。
- 超界即停：如果需要修改多个目录或重新定义项目定位，升级 full。
```

## Acceptance Checks

- The output is shorter than the full baseline.
- It does not repeat long project history.
- It names the exact allowed files and the upgrade condition.
