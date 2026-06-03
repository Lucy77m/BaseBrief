# BaseBrief

BaseBrief is a Chinese-first, skill-first project baseline tool for AI-assisted development.

One install, one entry: `BaseBrief`.  
Inside that single skill, normal continuation routes to `full` or `lite`; `cache-ready` is reserved for explicit prompt-cache experiments.

[中文说明](README.md)

## Quick Start

BaseBrief is not a CLI or plugin yet. Ask your AI tool to read the skill entry:

```text
Please read BaseBrief's skills/basebrief/SKILL.md.
Choose full or lite based on my next task. Use cache-ready only when I explicitly ask for prompt cache, cache-ready, or stable-prefix experiments.
Do not turn assumptions into facts; if the boundary is unclear, list open_questions first.
```

Then give your task:

```text
Use BaseBrief to prepare a full project baseline.
Also prepare a short next-chat opener and an agent task handoff.
```

Start here:

- [Integrations](docs/integrations.md)
- [Adapters](docs/adapters.md)
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

## Normal Modes And Experimental Route

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

Normal `full` / `lite` briefs stay human-readable. Provider-facing `cacheSidecar` / `activeProviderPrompt` artifacts are BB9 handoff post-processing outputs and should not be inserted into normal Markdown briefs.

## Security Notes

- do not commit `.env`, API keys, tokens, or secrets
- do not publish private absolute paths
- do not market `cache-ready` as proven provider-level cache improvement

## Docs

- [Integrations](docs/integrations.md)
- [Adapters](docs/adapters.md)
- [Walkthrough](docs/walkthrough.md)
- [Usage](docs/usage.md)
- [Mode selection](docs/mode-selection.md)
- [Handoff contract](docs/handoff.md)
- [Testing](docs/testing.md)
- [Long-term baseline](docs/roadmap/basebrief-long-term-baseline.md)
- [Cache-ready experiment notes](docs/experiments/cache-ready-lite.md)
- [BB2 cache capsule notes](docs/experiments/cache-ready-capsule.md)
- [BB3 cache anchor notes](docs/experiments/cache-ready-anchor.md)
- [BB4 anchor-pad notes](docs/experiments/cache-ready-anchor-pad.md)
- [Readable Full/Lite POC](docs/experiments/cache-ready-readable-poc.md)
- [BB5 cache sidecar notes](docs/experiments/cache-ready-sidecar.md)
- [BB6 hybrid anchor notes](docs/experiments/cache-ready-hybrid-anchor.md)
- [BB9 adaptive selector notes](docs/experiments/cache-ready-adaptive-selector.md)
- [BB11 active prompt trim notes](docs/experiments/cache-ready-active-prompt-trim.md)
- [BB12 size-band guard notes](docs/experiments/cache-ready-bb12-guard.md)
- [BB evolution log](docs/evolution/bb-evolution-log.md)
- [GPT-5.5 relay usage audit](docs/experiments/cache-ready-relay-gpt55.md)
- [Examples](examples)

## BB9 Handoff Contract

BB9 is now the standard handoff-contract direction for BaseBrief. It keeps the normal readable `full` / `lite` brief as the primary continuation surface. When the selected provider profile exposes cache usage evidence, it adds a separate `cacheSidecar` for estimated-cost experiments.

Important: use `readableBrief` for human review and continuation boundaries. Use `cacheSidecar` as the active provider prompt only when `recommendedPromptType` says so. Do not concatenate both into one provider request.

BB10 active prompt workflow makes that explicit by returning `activeProviderPrompt`. For repeated cache-aware provider calls, send only `activeProviderPrompt`.

Artifact boundaries are documented in [docs/handoff.md](docs/handoff.md). The input schema is [schemas/bb9-handoff.schema.json](schemas/bb9-handoff.schema.json).

Commands:

```text
node scripts/generate_bb9_handoff.js --input examples/bb9-handoff-full-input.json --mode full --provider-profile mimo
node scripts/generate_bb9_handoff.js --input examples/bb9-handoff-lite-input.json --mode lite --provider-profile deepseek
node scripts/generate_bb9_handoff.js --input examples/bb9-handoff-full-input.json --mode full --provider-profile mimo --print activeProviderPrompt
```

Examples:

- [BB9 full input](examples/bb9-handoff-full-input.json)
- [BB9 full output](examples/bb9-handoff-full-output.md)
- [BB9 lite input](examples/bb9-handoff-lite-input.json)
- [BB9 lite output](examples/bb9-handoff-lite-output.md)
- [BB9 unsupported provider fallback](examples/bb9-handoff-fallback-output.md)
- [Structured full handoff example](examples/structured-handoff-full.md)
- [Structured lite handoff example](examples/structured-handoff-lite.md)
- [Adapter Codex task example](examples/adapter-codex-task.md)
- [Adapter Claude context example](examples/adapter-claude-project-context.md)

Minimal builder:

```text
node scripts/basebrief_build_handoff.js --input examples/structured-handoff-full.md --output-dir tests/outputs/private/structured-full --provider-profile mimo
node scripts/basebrief_build_adapters.js --input examples/structured-handoff-full.md --output-dir tests/outputs/private/adapters --target all
```

Boundary: this is provider-specific estimated-cost evidence, not a billing audit and not a provider-general cache claim.

## Cache-ready v2

`BB2 Cache Capsule` is the compact v2 experiment for cache-ratio and estimated-cost testing. It is not the recommended path for ordinary project continuation.

`BB3 Cache Anchor` pre-registers tail request options in the stable prefix and changes only a short selector in the dynamic tail.

`BB4 Anchor Pad` adds a required stable pad before the selector. Current MiMo `mimo-v2.5` local real-project samples show estimated-cost evidence for BB4, but this is not a cross-provider claim.
