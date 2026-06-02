# BaseBrief

BaseBrief is a Chinese-first, skill-first project baseline tool for AI-assisted development.

One install, one entry: `BaseBrief`.  
Inside that single skill, it routes to `full`, `lite`, or `cache-ready`.

[中文说明](README.md)

## Quick Start

BaseBrief is not a CLI or plugin yet. Ask your AI tool to read the skill entry:

```text
Please read BaseBrief's skills/basebrief/SKILL.md.
Choose full, lite, or cache-ready based on my next task.
Do not turn assumptions into facts; if the boundary is unclear, list open_questions first.
```

Then give your task:

```text
Use BaseBrief to prepare a full project baseline.
Also prepare a short next-chat opener and an agent task handoff.
```

Start here:

- [Integrations](docs/integrations.md)
- [Walkthrough](docs/walkthrough.md)
- [Usage](docs/usage.md)
- [Mode selection](docs/mode-selection.md)

## What It Is

BaseBrief helps you turn the current state of a project into a stable Markdown baseline that another window or agent can continue safely.

It focuses on:

- verified facts
- confirmed decisions
- assumptions
- open questions
- risk boundaries

## What It Is Not

- not a chat client
- not a full platform
- not an agent runtime
- not a secret manager
- not a real API or provider integration tool
- not a CLI, Web UI, MCP, or plugin yet

## One Entry, Three Modes

### Full

Use `full` for:

- complete phase baselines
- new chat openings
- agent task handoff
- risk-heavy project snapshots

### Lite

Use `lite` for:

- short continuation
- read-only handoff
- 1 to 2 file scoped work

Do not use Lite when the task touches backend, provider, `.env`, deployment, state, memory, gateway, or a real agent runtime.

### Cache-ready

Use `cache-ready` only when you explicitly want a stable-prefix experiment.

It is experimental.  
Current MiMo `mimo-v2.5` benchmark evidence supports higher absolute cached tokens in local real-project samples, but does not prove better cache ratio, cost, or latency.

## Security Notes

- do not commit `.env`, API keys, tokens, or secrets
- do not publish private absolute paths
- do not market `cache-ready` as proven provider-level cache improvement

## Docs

- [Integrations](docs/integrations.md)
- [Walkthrough](docs/walkthrough.md)
- [Usage](docs/usage.md)
- [Mode selection](docs/mode-selection.md)
- [Testing](docs/testing.md)
- [Cache-ready experiment notes](docs/experiments/cache-ready-lite.md)
- [Examples](examples)
