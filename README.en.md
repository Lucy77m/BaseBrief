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
The evidence is tiered: early normalized benchmarks did not prove better cache ratio or estimated cost; BB5 Cache Sidecar produced single-format evidence on MiMo; BB9 Adaptive Selector now shows estimated-cost evidence on both MiMo `mimo-v2.5` and DeepSeek `deepseek-v4-flash` local real-project samples. Do not market this as provider-general proof, real billing proof, or stable latency evidence.

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
- [BB2 cache capsule notes](docs/experiments/cache-ready-capsule.md)
- [BB3 cache anchor notes](docs/experiments/cache-ready-anchor.md)
- [BB4 anchor-pad notes](docs/experiments/cache-ready-anchor-pad.md)
- [Readable Full/Lite POC](docs/experiments/cache-ready-readable-poc.md)
- [BB5 cache sidecar notes](docs/experiments/cache-ready-sidecar.md)
- [BB6 hybrid anchor notes](docs/experiments/cache-ready-hybrid-anchor.md)
- [BB9 adaptive selector notes](docs/experiments/cache-ready-adaptive-selector.md)
- [Examples](examples)

## Cache-ready v2

`BB2 Cache Capsule` is the compact v2 experiment for cache-ratio and estimated-cost testing. It is not the recommended path for ordinary project continuation.

`BB3 Cache Anchor` pre-registers tail request options in the stable prefix and changes only a short selector in the dynamic tail.

`BB4 Anchor Pad` adds a required stable pad before the selector. Current MiMo `mimo-v2.5` local real-project samples show estimated-cost evidence for BB4, but this is not a cross-provider claim.
