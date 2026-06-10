# BaseBrief Advanced Usage

Start with the README path first:

```text
node scripts/basebrief.js continue --repo . --output-dir tests/outputs/private/continue
```

This page collects the lower-level and advanced commands so they do not crowd the first-run path.

## Core Continuation Commands

Use these when you want to split the continuation flow into explicit steps:

```text
node scripts/basebrief.js context-pack --repo <target-repo> --output-dir <dir> [--json]
node scripts/basebrief.js check --input <context-pack-dir> [--json]
node scripts/basebrief.js resume --input <context-pack-dir> [--json]
```

- `context-pack`: build the seven-file project context bundle.
- `check`: validate a handoff, pack, export, or receiver artifact.
- `resume`: print a copyable next-window prompt from a checked Context Pack.

## Project Profile

Use Project Profile only after the simple `continue` command makes sense.

```text
node scripts/basebrief.js profile-init --repo <target-repo> --output <profile.json> [--recipe continuation-default|small-delta|review-heavy] [--json]
node scripts/basebrief.js continue --profile <profile.json> --output-dir <dir> [--repo <target-repo>] [--since <commit>] [--max-files <n>] [--json]
```

Project Profiles store public-safe defaults for repeated local runs. They are not global config, not a credential store, and not automation.

## Workflow Runner Lite

Workflow Runner Lite is an advanced local wrapper around Project Profile and Continuation Harness Lite:

```text
node scripts/basebrief.js workflow --profile <profile.json> --output-dir <dir> [--repo <target-repo>] [--since <commit>] [--max-files <n>] [--json]
```

It does not call providers, execute project tasks, run Doctor or Export automatically, or perform git and release actions.

## Export And Doctor

Use Export when another local tool needs files instead of the seven-file pack:

```text
node scripts/basebrief.js export --input <context-pack-dir> --output-dir <dir> [--json]
```

MCP-friendly means future tool-consumable files. It does not mean an MCP server, runtime integration, or provider integration.

Use Doctor when a Context Pack might be stale or inconsistent with the live repo:

```text
node scripts/basebrief.js doctor --repo <target-repo> --context-pack <context-pack-dir> [--json]
```

Doctor is read-only and diagnostic. It is not an always-on status command.

## Seal, Diff, Delta, And Project State

These commands support longer local handoff chains and reviewed state transitions:

```text
node scripts/basebrief.js seal --input <markdown-json-or-seal> --output <seal-json> [--json]
node scripts/basebrief.js diff --before <seal-or-input> --after <seal-or-input> [--json]
node scripts/basebrief.js delta --repo <target-repo> --output-dir <dir> [--since <commit>] [--advance-baseline] [--json]
node scripts/basebrief.js state-init --repo <target-repo> --source <receiver-ready.md> [--json]
node scripts/basebrief.js state-status --repo <target-repo> [--json]
node scripts/basebrief.js state-advance --repo <target-repo> --source <receiver-ready.md> [--json]
```

They are advanced continuity tools, not first-run requirements.

## Receiver And Sidecar Tools

Receiver, sidecar, and golden-path commands are for reviewed handoff workflows:

```text
node scripts/basebrief.js receiver-init --repo <target-repo> --output <receiver-check.json> [--json]
node scripts/basebrief.js receiver-check --config <receiver-check.json> --repo <target-repo> [--json]
node scripts/basebrief.js receiver-flow --repo <target-repo> --output-dir <dir> [--json]
node scripts/basebrief.js review-draft --draft <draft-context.md> --output <receiver-ready.md> [--json]
node scripts/basebrief.js sidecar-build --repo <target-repo> --target generic --output-dir <dir> [--json]
node scripts/basebrief.js sidecar-check --input <sidecar-dir> [--json]
```

Read [Integrated Handoff Golden Path](golden-path.md) before using these in a real handoff.

## Boundaries

Advanced does not mean automatic.

BaseBrief still does not call providers, connect a runtime, create an MCP server, run a daemon, publish npm packages, push code, tag releases, open pull requests, or execute project tasks automatically.
