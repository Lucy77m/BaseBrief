# BaseBrief

BaseBrief is a Chinese-first project baseline and handoff tool for AI-assisted development.

It solves one specific problem: when you switch chats, models, AI tools, or resume work later, the next agent should know the current project state, verified facts, confirmed decisions, risk boundaries, and next task.

BaseBrief keeps one public skill entry and provides an optional zero-dependency CLI Lite; normal continuation routes to `full` or `lite`, while `cache-ready` is reserved for explicit prompt-cache experiments.

[中文说明](README.md)

## Start Here

1. [5-minute quickstart](docs/quickstart-5min.md)
2. [Handoff contract and artifacts](docs/handoff.md)
3. [Seal/Diff phase comparison](docs/seal-diff.md)

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
- zero-dependency CLI Lite: `init`, `build`, `check`, `receiver-init`, `receiver-check`, `seal`, `diff`
- local file-based Seal/Diff v1

BaseBrief is not a chat client, agent runtime, hosted platform, secret manager, project-management system, or provider gateway.

## Continue Reading

- [5-minute quickstart](docs/quickstart-5min.md)
- [Integrations](docs/integrations.md)
- [Mode selection](docs/mode-selection.md)
- [CLI Lite](docs/cli-lite.md)
- [Receiver Safe Check](docs/receiver-check.md)
- [Known limitations](docs/known-limitations.md)
- [Documentation index](docs/index.md)
- [Public minimal example](examples/minimal/README.md)

## License

See [LICENSE](LICENSE).
