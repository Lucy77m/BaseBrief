# BaseBrief CLI Lite

CLI Lite is an optional local script wrapper around the existing BaseBrief handoff builder, adapter builder, and artifact checker.

It is not an npm package, not a globally installed `basebrief` command, not a plugin, and not a provider integration. It does not read `.env` files or manage credentials.

Run it through Node:

```text
node scripts/basebrief.js init --output-dir tests/outputs/private/starter
node scripts/basebrief.js build --input examples/structured-handoff-full.md --output-dir tests/outputs/private/cli-build --adapters all --check
node scripts/basebrief.js check --input examples/adapter-codex-task.md --json
node scripts/basebrief.js seal --input examples/seal-before-input.json --output tests/outputs/private/seal-before.json
node scripts/basebrief.js diff --before examples/seal-before-input.json --after examples/seal-after-input.json --json
```

## Commands

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

### check

```text
node scripts/basebrief.js check --input <file-or-dir> [--json]
```

This command delegates to the Phase 6 artifact checker. It does not duplicate the rule set.

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

CLI Lite exists to make the proven local workflow easier to repeat. It should stay thin: no package publishing, no global install, no account system, no hosted service, and no automatic secret management.
