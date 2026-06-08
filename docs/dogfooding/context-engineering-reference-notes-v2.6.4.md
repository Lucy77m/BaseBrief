# Context Engineering Reference Notes v2.6.4

Date: 2026-06-09

This public-safe note maps external agent handoff and context engineering
patterns to the current BaseBrief v2 Context Pack line.

It is not a release closeout, command, contract, schema, runtime, provider
integration, hosted memory system, MCP server, or Workflow Runner. It is a
local reference note for deciding when future v3 work is justified.

## External Reference Themes

Recent context engineering and agent-handoff guidance converges on a few
practical themes:

- `own your context window`: keep the context supplied to an agent explicit,
  curated, and inspectable instead of relying on opaque memory.
- `stateless reducer`: rebuild the next useful context from durable artifacts
  and current state rather than assuming an old chat transcript is live truth.
- `handoff artifact`: leave a compact, reviewable artifact that a later agent
  can read before acting.
- `memory hygiene`: keep persistent notes small, public-safe, and scoped to
  decisions, risks, and unresolved work.
- `context compression`: preserve high-signal facts, boundaries, and next
  actions while dropping repeated tool output and historical clutter.

Useful external references:

- Anthropic, Effective context engineering for AI agents:
  https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Anthropic, Effective harnesses for long-running agents:
  https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- OpenAI Agents SDK handoffs:
  https://openai.github.io/openai-agents-js/guides/handoffs/
- OpenAI Agents SDK memory:
  https://openai.github.io/openai-agents-js/guides/sandbox-agents/memory/
- 12-Factor Agents:
  https://github.com/humanlayer/12-factor-agents

## BaseBrief Mapping

BaseBrief already has a repo-local shape that matches these themes without
becoming an agent runtime:

- Context Pack is the handoff artifact.
- Context Pack Check is the review gate for missing files, public safety, and
  warning/error interpretation.
- Resume turns a checked pack into a copyable next-window prompt.
- Doctor compares inherited pack facts with live repo facts and keeps
  `doctor.live-recheck-required` as an info reminder.
- File-only Export makes the pack consumable as plain files without becoming an
  MCP server or hosted integration.
- `provider_probe_status=skipped` preserves the default local-only posture when
  provider environment variables are absent.
- Risk boundaries preserve the difference between inherited context and the
  latest user instruction.

## Future Direction Rule

Continue accumulating v2.6.x adoption evidence before opening a larger feature
line.

Only consider v3 Continuation Harness or Workflow Runner Lite after repeated
real friction points to the same missing capability. Candidate signals would
include repeated receiver confusion about which artifact to read first, repeated
manual command-order mistakes, or repeated stale-pack recovery work that docs
and examples cannot reduce.

Do not start v3 merely because external references mention agents, memory,
handoffs, context compression, or orchestration. BaseBrief should stay
repo-local and reviewable until local dogfooding proves a narrower automation
surface is needed.

## Boundaries Confirmed

- No provider request.
- No runtime integration.
- No hosted memory.
- No plugin.
- No MCP server.
- No MCP tools.
- No schema-v2.
- No Status command.
- No Workflow Runner.
- No Context Pack Lite generator output contract change.
- No `check --input <dir> --json` top-level shape change.
- No Resume JSON contract change.
- No Doctor JSON contract change.
- No Export JSON contract change.
- No npm publish, push, tag, release, or pull request in this implementation
  slice.

## Validation Gate

The local validation gate for this reference-note slice is:

```text
npm test
npm run release-check
git diff --check
```

When provider environment variables are absent, release checks must keep:

```text
provider_probe_status=skipped
```
