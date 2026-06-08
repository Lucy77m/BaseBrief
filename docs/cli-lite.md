# BaseBrief CLI Lite

CLI Lite is an optional local script wrapper around the existing BaseBrief handoff builder, adapter builder, and artifact checker.

It is not a published npm package, not a globally installed `basebrief` command, not a plugin, and not a provider integration. It does not read `.env` files or manage credentials.

In v0.4.0, CLI Lite remains part of the local integrated toolchain. It is still run through `node scripts/basebrief.js` and does not become a published package or installed command.

Run it through Node:

```text
node scripts/basebrief.js --help
node scripts/basebrief.js init --output-dir tests/outputs/private/starter
node scripts/basebrief.js build --input examples/structured-handoff-full.md --output-dir tests/outputs/private/cli-build --adapters all --check
node scripts/basebrief.js check --input examples/adapter-codex-task.md --json
node scripts/basebrief.js receiver-init --repo . --output tests/outputs/private/receiver-check.json --json
node scripts/basebrief.js receiver-check --config examples/receiver-check-config.json --repo . --json
node scripts/basebrief.js receiver-flow --repo . --output-dir tests/outputs/private/receiver-flow --json
node scripts/basebrief.js receiver-flow --repo . --output-dir tests/outputs/private/receiver-flow-extract --extract --source tests/outputs/private/source-context.md --json
node scripts/basebrief.js review-draft --draft tests/outputs/private/receiver-flow/draft-context.md --output tests/outputs/private/receiver-ready.md --json
node scripts/basebrief.js state-init --repo . --source tests/outputs/private/receiver-ready.md --json
node scripts/basebrief.js state-read --repo . --json
node scripts/basebrief.js state-status --repo . --json
node scripts/basebrief.js state-validate --repo . --json
node scripts/basebrief.js state-history --repo . --json
node scripts/basebrief.js state-advance --repo . --source tests/outputs/private/receiver-ready.md --json
node scripts/basebrief.js sidecar-build --repo . --target generic --starter-language zh-CN --output-dir tests/outputs/private/sidecar-generic --json
node scripts/basebrief.js sidecar-check --input tests/outputs/private/sidecar-generic --json
node scripts/basebrief.js seal --input examples/seal-before-input.json --output tests/outputs/private/seal-before.json
node scripts/basebrief.js diff --before examples/seal-before-input.json --after examples/seal-after-input.json --json
node scripts/basebrief.js delta --repo . --output-dir tests/outputs/private/delta --json
node scripts/basebrief.js context-pack --repo . --output-dir tests/outputs/private/context-pack --json
```

The repository also includes minimal local npm scripts:

```text
npm test
npm run release-check
npm run check
```

These scripts are only validation shortcuts. They do not add a published package, global install flow, or new CLI surface.

## Golden Path Grouped Flow

For the integrated local handoff path, keep the commands grouped by intent
instead of treating them as one flat list:

```text
node scripts/basebrief.js state-init --repo <target-repo> --source <receiver-ready.md> --json
node scripts/basebrief.js state-advance --repo <target-repo> --source <receiver-ready.md> --json
node scripts/basebrief.js sidecar-build --repo <target-repo> --target generic --starter-language zh-CN --output-dir <ignored-private-dir> --json
node scripts/basebrief.js sidecar-check --input <sidecar-dir> --json
```

- first reviewed handoff into local continuity: `state-init`
- later reviewed handoff update for the same repo: `state-advance`
- package current local state for the next chat: `sidecar-build`
- validate the bundle before handing off the starter: `sidecar-check`

The receiver-facing line is:

```text
receiver-ready.md -> state-init/state-advance -> sidecar-build -> sidecar-check -> new-window-starter.md -> receiver first response
```

`state-status`, `state-validate`, and `state-history` stay as optional read-only
inspection commands. See [Integrated Handoff Golden Path](golden-path.md) for
the public walkthrough.

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
node scripts/basebrief.js receiver-flow --repo <target-repo> --output-dir <dir> --guided [--json]
node scripts/basebrief.js receiver-flow --repo <target-repo> --output-dir <dir> --extract --source <draft-or-context.md> [--json]
```

This command writes a review-only receiver flow draft:

- `flow-summary.json`
- `receiver-check.json`
- `draft-context.md`

The draft always uses `handoff_status: draft_needs_review`. It is not Auto Flow, does not create receiver threads, does not call providers, and does not promote the draft to `ready_for_receiver`.

`--guided` is an explicit human-input mode. It records six handoff fields in the
draft, writes empty answers as `[EMPTY]`, and adds a review checklist. It is not
Auto Flow and does not produce `ready_for_receiver`.

`--extract` is an explicit candidate-extraction mode. It reads only the local
Markdown file passed through `--source`, writes `extract-candidates.json`, marks
extracted values as `[CANDIDATE]`, and marks missing fields as `[NEEDS_REVIEW]`.
Extracted drafts remain blocked until a human reviews and rewrites them.

See [Receiver Flow Draft](receiver-flow.md) for boundaries and review requirements.
The v0.3.2 release-candidate boundary is documented in [v0.3.2 Release Candidate](releases/v0.3.2.md).
The v0.3.3 dogfooding evidence keeps this command draft-only and is documented in [v0.3.3 Release Candidate](releases/v0.3.3.md).
The v0.5.2 extract candidate boundary is documented in [v0.5.2 Receiver Flow Extract Candidate](releases/v0.5.2.md).

### review-draft

```text
node scripts/basebrief.js review-draft --draft <draft-context.md> --output <receiver-ready.md> [--json]
```

This command is the explicit human review gate after `receiver-flow --guided`.
It requires `handoff_status: draft_needs_review`, all six guided human fields,
no `[EMPTY]`, `[NEEDS_REVIEW]`, or `[CANDIDATE]` markers, and six checked
review checklist lines in the form `- [x] <field> reviewed`.

Successful output uses `handoff_status: ready_for_receiver` and
`handoff_protocol_version: receiver-ready-v1`. The command does not call
providers, does not run `receiver-flow --extract`, does not create receiver
threads, and does not write `.env` or `.git` paths.

The v0.5.1 release-candidate boundary is documented in
[v0.5.1 Review Draft Gate Candidate](releases/v0.5.1.md).

### state-init / state-read / state-status / state-validate / state-history / state-advance

```text
node scripts/basebrief.js state-init --repo <target-repo> --source <receiver-ready.md> [--json]
node scripts/basebrief.js state-read --repo <target-repo> [--json]
node scripts/basebrief.js state-status --repo <target-repo> [--json]
node scripts/basebrief.js state-validate --repo <target-repo> [--json]
node scripts/basebrief.js state-history --repo <target-repo> [--json]
node scripts/basebrief.js state-advance --repo <target-repo> --source <receiver-ready.md> [--json]
```

`state-init` writes `<target-repo>/.basebrief/state.json` from an explicit
reviewed source with `handoff_status: ready_for_receiver`. It refuses overwrite
and rejects `.env` or `.git` paths.

`state-read` reads the existing local project state and validates
`schemaVersion: basebrief-project-state-v1`.

`state-status` reports whether `.basebrief/state.json` exists and validates.
Missing state is reported as `validation_status: missing` without writing a
file.

`state-validate` is the stricter read-only gate. It exits nonzero when state is
missing or invalid.

`state-history` lists archived state snapshots under `.basebrief/history/`.

`state-advance` requires an existing valid state and a reviewed
`receiver-ready.md` source. It archives the previous state under
`.basebrief/history/` and writes the next state to `.basebrief/state.json`.

These commands do not call providers, do not create receiver threads, do not
run Auto Flow, and do not change `basebrief-project-state-v1`.

Boundary shorthand: No provider request, No Auto Flow, No schema change.

The v0.6.0 project-state boundary is documented in
[v0.6.0 Project State Directory Candidate](releases/v0.6.0.md).
The v0.7.0 lifecycle boundary is documented in
[v0.7.0 Project State Lifecycle Candidate](releases/v0.7.0.md).

### sidecar-build

```text
node scripts/basebrief.js sidecar-build --repo <target-repo> [--target generic|openclaw] [--starter-language auto|zh-CN|en|ja] [--output-dir <dir>] [--json]
```

`sidecar-build` reads the existing valid
`<target-repo>/.basebrief/state.json` and writes a receiver handoff bundle. It
does not create or advance Project State. It is a consumer of
`basebrief-project-state-v1`; it does not change the schema.

Default target is `generic`. Default output is
`<target-repo>/.basebrief/sidecar/<target>/`. Tests and dogfooding should pass
an ignored private `--output-dir`. The command refuses a non-empty output
directory and does not provide a force overwrite flag.

Generated files:

- `handoff.md`
- `next-chat-prompt.md`
- `new-window-starter.md`
- `receiver-entry-task.md`
- `risk-boundaries.md`
- `state-summary.json`
- `manifest.json`

`new-window-starter.md` is the short copyable block for opening a new chat. It
points the receiver to the sidecar bundle, asks for a `pass/fail` report, and
keeps `next-chat-prompt.md` as the contract file the receiver must validate.

`--starter-language` controls only the user-facing starter shell. `auto` is the
default: it uses the natural-language body of the Project State handoff and
falls back to `zh-CN` when mixed or unclear, matching BaseBrief's
Chinese-first default. When the source window knows the user's language, pass
`zh-CN`, `en`, or `ja` explicitly. Protocol fields, paths, file names, schema
names, and the English hard-stop anchors remain literal.

The `openclaw` target only adds stronger safety wording. It does not connect
OpenClaw or Hermes runtime, does not write profile/config/memory/workspace
files, and does not call providers.

Boundary shorthand: No provider request, No raw private output, No runtime
integration, No schema change, No Auto Flow, wait for user confirmation.

The v0.8.0 sidecar boundary is documented in
[v0.8.0 Sidecar Handoff Bundle Candidate](releases/v0.8.0.md).

### sidecar-check

```text
node scripts/basebrief.js sidecar-check --input <sidecar-dir> [--json]
```

`sidecar-check` is the v0.8.1 read-only acceptance gate for generated sidecar
bundles. It validates the six required contract files, parses `manifest.json`
and `state-summary.json`, checks the `basebrief-sidecar-v1` and
`basebrief-project-state-v1` markers, and verifies that `next-chat-prompt.md`
contains the current goal, receiver task, at least two risk boundaries, wait
for user confirmation, No provider request, No raw private output, No runtime
integration, and No auto-advance.

For v0.8.7-and-later bundles, if `manifest.json` declares
`output_files.newWindowStarter`, `sidecar-check` also requires
`new-window-starter.md` to contain the target repository cue, sidecar bundle
instruction, current goal, receiver task, at least two risk boundaries, a
`pass/fail` report instruction, wait for user confirmation, No provider
request, No raw private output, No runtime integration, No schema change, and
No auto-advance. Older v0.8 bundles that do not declare this file remain
accepted by this compatibility gate.

For `openclaw` bundles it also requires explicit wording that OpenClaw/Hermes
runtime, profile, config, memory, and workspace integration are out of scope.
The command reuses the artifact checker and fails on secret-like strings,
private absolute paths, or raw provider output. It does not create files, does
not mutate `.basebrief/state.json`, does not change schema, does not call
providers, and does not connect any runtime.

The v0.8.1 hardening boundary is documented in
[v0.8.1 Sidecar Check Hardening Candidate](releases/v0.8.1.md).

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

### delta

```text
node scripts/basebrief.js delta --repo <target-repo> --output-dir <dir> [--since <commit>] [--advance-baseline] [--json]
```

This command writes `<output-dir>/delta-handoff.md` from the current valid
`<target-repo>/.basebrief/state.json`, git range facts, worktree changed-file
facts, and the local delta baseline when present.

By default it does not advance the baseline. Passing `--advance-baseline`
writes `<target-repo>/.basebrief/delta-baseline.json` after generation. That
baseline is delta-local and does not change `basebrief-project-state-v1`.

The output separates `reviewed` project-state continuity from `needs-review`
generated git and diff summaries. See [Delta Handoff Spec](specs/delta-handoff.md).

### context-pack

```text
node scripts/basebrief.js context-pack --repo <target-repo> --output-dir <dir> [--since <commit>] [--max-files <n>] [--json]
```

This command writes a seven-file Context Pack Lite bundle:

- `MANIFEST.md`
- `REPO_MAP.md`
- `KEY_FILES.md`
- `RECENT_DELTA.md`
- `RISK_BOUNDARIES.md`
- `RECEIVER_STATE.md`
- `NEXT_WINDOW_STARTER.md`

It reads local git facts, a fixed public-safe file list, and receiver-state
presence checks. It refuses non-empty output directories and unsafe output
paths. Missing inputs are represented as `not_available`, `not_applicable`, or
`needs-review`; the command does not invent receiver history.

See [Context Pack Lite Spec](specs/context-pack-lite.md),
[Context Pack Lite example kit](../examples/context-pack-lite/README.md), and
[v2.0.0 Context Pack Lite Local Closeout](releases/v2.0.0.md).

### resume

```text
node scripts/basebrief.js resume --input <context-pack-dir> [--json]
```

This command reads a Context Pack Lite directory, reuses the existing Artifact
Checker result, and prints a copyable new-window prompt. Clean packs produce a
prompt. Warning-only packs also produce a prompt and include the warning
findings as review notes. Error findings stop the command before prompt output.

`resume` is read-only and stdout-only in the first v2.2 slice. It does not
change Context Pack Lite generator output, does not change
`check --input <dir> --json`, and does not create sessions, call providers,
call AI, run a daemon, or write output files.

See [v2.2.0 One-command Resume / New-window Prompt Plan](releases/v2.2.0-plan.md)
and [Context Pack Resume Spec](specs/context-pack-resume.md).

## JSON Output

`--json` prints stable command metadata, output file names, and check status
where relevant. `resume --json` includes the copyable prompt because the prompt
is that command's primary output.

## Boundary

CLI Lite exists to make the proven local workflow easier to repeat. It should stay thin: no package publishing, no global install, no account system, no hosted service, no automatic secret management, no provider request, and no raw-command execution.
