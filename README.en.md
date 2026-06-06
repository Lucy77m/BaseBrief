# BaseBrief

BaseBrief is a Chinese-first project baseline and handoff tool for AI-assisted development.

It solves one specific problem: when you switch chats, models, AI tools, or resume work later, the next agent should know the current project state, verified facts, confirmed decisions, risk boundaries, and next task.

BaseBrief keeps one public skill entry and provides an optional zero-dependency CLI Lite; normal continuation routes to `full` or `lite`, while `cache-ready` is reserved for explicit prompt-cache experiments.

[中文说明](README.md)

## Start Here

1. [5-minute quickstart](docs/quickstart-5min.md)
2. [Handoff contract and artifacts](docs/handoff.md)
3. [Integrated Handoff Golden Path](docs/golden-path.md)
4. [Seal/Diff phase comparison](docs/seal-diff.md)

See the [documentation index](docs/index.md) for the complete reference and experiment history.

## Understand It In 30 Seconds

AI project continuation often loses:

- the current goal and project state
- verified facts and confirmed decisions
- assumptions and open questions
- risk boundaries and forbidden scope
- the next task and expected output

BaseBrief turns those details into a readable Full or Lite brief. For repeatable local builds, checks, and phase comparison, use the optional CLI Lite.

## Shortest Path

Ask your AI tool to read the BaseBrief skill:

```text
Please read BaseBrief's skills/basebrief/SKILL.md.
Choose full or lite for the current task and prepare a project baseline.
Do not turn assumptions into facts; list open_questions when boundaries are unclear.
```

Use Lite for a small bounded continuation. Use Full for phase closure, complex work, or unclear risk boundaries.

You can also build local artifacts from the public structured example:

```text
node scripts/basebrief.js build --input examples/structured-handoff-lite.md --output-dir tests/outputs/private/quickstart/build --check
```

CLI Lite is an optional local script, not an installed CLI, plugin, or provider integration.

This repository also provides minimal npm scripts as local validation shortcuts:

```text
npm test
npm run release-check
npm run check
```

These scripts only wrap local Node commands. BaseBrief is still not a published npm package, global command, plugin, or provider integration.

## Project State Sidecar

When a repository already has a valid `.basebrief/state.json`, Sidecar can package that Project State into a local bundle for the next chat:

```text
node scripts/basebrief.js sidecar-build --repo . --target generic --starter-language en --output-dir tests/outputs/private/sidecar-generic --json
node scripts/basebrief.js sidecar-check --input tests/outputs/private/sidecar-generic --json
```

`sidecar-build` creates a `generic` or `openclaw` handoff bundle and writes a copyable new-window starter at `new-window-starter.md` that asks the receiver to restate key fields, report `pass/fail`, and wait for confirmation; `--starter-language auto|zh-CN|en|ja` controls only the starter shell language, while protocol fields, paths, file names, and English hard-stop anchors stay literal. `sidecar-check` is a read-only structure gate for the bundle, receiver boundaries, and the starter. The v0.8.x Sidecar is a local consumer layer for `basebrief-project-state-v1`; it does not change the schema, is not Auto Flow, does not create sessions, does not call providers, and does not integrate with the OpenClaw/Hermes runtime. Sidecar public boundaries stay No provider request / No raw private output / No runtime integration / No schema change; when provider environment variables are absent, release checks keep `provider_probe_status=skipped`. Public records: [v0.8.0](docs/releases/v0.8.0.md), [v0.8.1](docs/releases/v0.8.1.md), [v0.8.2](docs/releases/v0.8.2.md), [v0.8.3](docs/releases/v0.8.3.md), [v0.8.6](docs/releases/v0.8.6.md), [v0.8.7](docs/releases/v0.8.7.md), [v0.8.8](docs/releases/v0.8.8.md), and the [v0.8.x test matrix](docs/testing-v0.8.x-test-matrix.md).

`v0.9.0` is an Integrated Handoff Readiness / public hardening candidate. It aligns receiver-ready handoff, Project State, Sidecar bundle, and the receiver first response as one local readiness line; it is not provider, runtime, schema, Auto Flow, plugin, platform, or v1.0 work. See [v0.9.0 Integrated Handoff Readiness](docs/releases/v0.9.0.md).
`v0.9.1` turns that readiness line into a clearer public golden path: `receiver-ready.md -> state-init/state-advance -> sidecar-build -> sidecar-check -> new-window-starter.md -> receiver first response`. It is docs/usability hardening only, with no new command and no schema change. Entry points: [Integrated Handoff Golden Path](docs/golden-path.md) and [v0.9.1 Golden Path Closure Candidate](docs/releases/v0.9.1.md).
`v0.9.2` adds a public-safe [Golden Path example kit](examples/golden-path/README.md) so users can follow the same line with concrete first-pass and follow-up examples in hand. See [v0.9.2 Golden Path Example Closure Candidate](docs/releases/v0.9.2.md).

## Seal/Diff

Seal/Diff answers: what changed in facts, decisions, risks, and task boundaries between two phases?

```text
node scripts/basebrief.js seal --input examples/seal-before-input.json --output tests/outputs/private/quickstart/before.json
node scripts/basebrief.js diff --before tests/outputs/private/quickstart/before.json --after examples/seal-after-input.json
```

It only processes explicit input files and does not scan or modify other projects.

## Core Boundaries

- `full`: complete phase baselines, complex handoffs, or unclear and risky work.
- `lite`: short continuation, read-only handoff, or clearly bounded work across one or two files.
- `cache-ready`: explicit stable-prefix or prompt-cache experiments only; it is not a normal third mode.
- The readable brief is the normal user-facing artifact. Provider-facing artifacts are explicit advanced post-processing.
- Provider-specific estimated-cost evidence is not provider-general proof or a real billing audit.

## Safety Boundaries

- Do not put `.env`, API keys, tokens, or secrets in public artifacts.
- Do not publish private absolute paths.
- Do not turn assumptions into verified facts.
- Do not automatically modify external projects or host-tool configuration.

## Current Capabilities

- one public skill entry with internal Full / Lite routing
- BB9 structured handoff contract
- handoff builder and file-based Codex / Claude adapters
- artifact checker
- optional read-only Receiver Safe Check v1
- zero-dependency CLI Lite: `init`, `build`, `check`, `receiver-init`, `receiver-check`, `receiver-flow`, `review-draft`, `state-init`, `state-read`, `state-status`, `state-validate`, `state-history`, `state-advance`, `sidecar-build`, `sidecar-check`, `seal`, `diff`
- Project State Sidecar: builds `generic` / `openclaw` bundles and `new-window-starter.md` from local `basebrief-project-state-v1` state, then checks them with `basebrief-sidecar-v1`
- local file-based Seal/Diff v1

BaseBrief is not a chat client, agent runtime, hosted platform, secret manager, project-management system, or provider gateway.

## Continue Reading

- [5-minute quickstart](docs/quickstart-5min.md)
- [Integrations](docs/integrations.md)
- [Mode selection](docs/mode-selection.md)
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
- [v0.3.0 receiver workflow baseline](docs/releases/v0.3.0.md)
- [Known limitations](docs/known-limitations.md)
- [Documentation index](docs/index.md)
- [Public minimal example](examples/minimal/README.md)

## License

See [LICENSE](LICENSE).
