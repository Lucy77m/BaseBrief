# BaseBrief CLI Lite

CLI Lite is an optional local script wrapper around the existing BaseBrief handoff builder, adapter builder, and artifact checker.

It is not a published npm package, not a globally installed `basebrief` command, not a plugin, and not a provider integration. It does not read `.env` files or manage credentials.

Run it through Node:

```text
node scripts/basebrief.js --help
node scripts/basebrief.js init --output-dir tests/outputs/private/starter
node scripts/basebrief.js build --input examples/structured-handoff-full.md --output-dir tests/outputs/private/cli-build --adapters all --check
node scripts/basebrief.js check --input examples/adapter-codex-task.md --json
node scripts/basebrief.js receiver-init --repo . --output tests/outputs/private/receiver-check.json --json
node scripts/basebrief.js receiver-check --config examples/receiver-check-config.json --repo . --json
node scripts/basebrief.js receiver-flow --repo . --output-dir tests/outputs/private/receiver-flow --json
node scripts/basebrief.js seal --input examples/seal-before-input.json --output tests/outputs/private/seal-before.json
node scripts/basebrief.js diff --before examples/seal-before-input.json --after examples/seal-after-input.json --json
```

The repository also includes minimal local npm scripts:

```text
npm test
npm run release-check
npm run check
```

These scripts are only validation shortcuts. They do not add a published package, global install flow, or new CLI surface.

## Commands

Run `node scripts/basebrief.js`, `node scripts/basebrief.js --help`, or `node scripts/basebrief.js -h` to print the current command list and Quickstart link.

### init

```text
node scripts/basebrief.js init --output-dir <dir>
```

Writes `basebrief-handoff-input.json` to the explicit output directory. The starter is public-safe placeholder data that follows `schemas/bb9-handoff.schema.json`.

`init` does not inspect the current project, does not write tool configuration, and does not infer provider settings.

### build

```text
node scripts/basebrief.js build --input <markdown-or-json> --output-dir <dir> [--mode full|lite] [--provider-profile <profile>] [--adapters codex|claude|all|none] [--check] [--json]
```

Build always writes the standard handoff artifacts:

- `readableBrief.md`
- `activeProviderPrompt.md`
- `handoff.meta.json`
- `cacheSidecar.md` only when the selected provider profile supports sidecar output

Adapter output is opt-in. Use `--adapters codex`, `--adapters claude`, or `--adapters all` to write adapter artifacts under `adapters/`. Use `--adapters none` or omit the flag to skip adapters.

`--check` runs the artifact checker against the output directory after generation. Errors make the command exit nonzero.

In human-readable output, `build --check` lists each error or warning after the summary so the finding can be reviewed directly.

### check

```text
node scripts/basebrief.js check --input <file-or-dir> [--json]
```

This command delegates to the Phase 6 artifact checker. It does not duplicate the rule set.

Human-readable output lists each finding with severity, rule id, file, line, and explanation. Warnings keep a zero exit code; errors exit nonzero. JSON output keeps the stable checker result shape.

### receiver-check

```text
node scripts/basebrief.js receiver-check --config <json> --repo <target-repo> [--json]
```

This optional command runs Receiver Safe Check v1. It compares branch, HEAD, and changed files, then runs only explicitly declared `node_syntax`, `artifact_check`, or `file_tokens` checks.

`pass` and `difference_found` exit zero because both mean the receiver task completed. `blocked` exits nonzero. The config must not contain a private repository path; the user supplies `--repo` in the private startup command.

See [Receiver Safe Check](receiver-check.md) for the independent config/result contracts and safety boundaries.

### receiver-init

```text
node scripts/basebrief.js receiver-init --repo <target-repo> --output <receiver-check.json> [--json]
```

This command generates a state-only `basebrief-receiver-check-v1` config from the explicitly selected repository. It records the current branch, exact HEAD, and stable changed-file list, with no declared behavioral checks.

The explicit non-sensitive `.json` output directory is created when needed. The command never overwrites a file or writes a tracked target-repository file. When the output is inside the target repository and visible to Git status, its relative path is included in `expected_changed_files`; ignored output stays out of the manifest. Detached HEAD is represented as `(detached)`.

Review the generated config before adding any optional declared checks, then run `receiver-check`.

### receiver-flow

```text
node scripts/basebrief.js receiver-flow --repo <target-repo> --output-dir <dir> [--json]
```

This command writes a review-only receiver flow draft:

- `flow-summary.json`
- `receiver-check.json`
- `draft-context.md`

The draft always uses `handoff_status: draft_needs_review`. It is not Auto Flow, does not create receiver threads, does not call providers, and does not promote the draft to `ready_for_receiver`.

See [Receiver Flow Draft](receiver-flow.md) for boundaries and review requirements.
The v0.3.2 release-candidate boundary is documented in [v0.3.2 Release Candidate](releases/v0.3.2.md).

### seal

```text
node scripts/basebrief.js seal --input <markdown-json-or-seal> --output <seal-json> [--json]
```

This command delegates to Seal/Diff v1 and writes a local `basebrief-seal-v1` JSON snapshot.

### diff

```text
node scripts/basebrief.js diff --before <seal-or-input> --after <seal-or-input> [--json]
```

This command compares two BB9 inputs or seals and reports changes in facts, decisions, risks, open questions, and task boundaries.

## JSON Output

`--json` prints a stable summary with command metadata, output file names, and check status. It does not copy full prompt text into the summary.

## Boundary

CLI Lite exists to make the proven local workflow easier to repeat. It should stay thin: no package publishing, no global install, no account system, no hosted service, no automatic secret management, and no raw-command execution.
