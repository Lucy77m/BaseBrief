# Integrated Handoff Golden Path

This guide closes the public usability gap after `v0.9.0` Integrated Handoff
Readiness. It does not add a new CLI command, schema, provider request,
runtime integration, or Auto Flow behavior. Its job is to make one existing
local line easier to follow:

```text
receiver-ready.md -> state-init/state-advance -> sidecar-build -> sidecar-check -> new-window-starter.md -> receiver first response
```

Use this guide only after you already have a reviewed handoff with:

```text
handoff_status: ready_for_receiver
```

## Main Rule

- First reviewed handoff for this repo: use `state-init`
- Later reviewed handoffs for the same repo: use `state-advance`
- `state-status`, `state-validate`, and `state-history` stay optional read-only
  checks; they are not required steps in the main path

## Branch A: First Local Continuity Pass

Use this when the target repo does not yet have a valid
`.basebrief/state.json`.

```text
node scripts/basebrief.js state-init --repo <target-repo> --source <receiver-ready.md> --json
node scripts/basebrief.js sidecar-build --repo <target-repo> --target generic --starter-language zh-CN --output-dir <sidecar-dir> --json
node scripts/basebrief.js sidecar-check --input <sidecar-dir> --json
```

What this branch means:

- `state-init` writes the first local `.basebrief/state.json`
- `sidecar-build` packages that reviewed state into a local Sidecar bundle
- `sidecar-check` validates the bundle structure and receiver boundaries before
  you hand the starter to the next chat

## Branch B: Advance Existing Local Continuity

Use this when the target repo already has a valid `.basebrief/state.json` and
you have a newer reviewed `receiver-ready.md`.

```text
node scripts/basebrief.js state-advance --repo <target-repo> --source <receiver-ready.md> --json
node scripts/basebrief.js sidecar-build --repo <target-repo> --target generic --starter-language zh-CN --output-dir <sidecar-dir> --json
node scripts/basebrief.js sidecar-check --input <sidecar-dir> --json
```

What this branch means:

- `state-advance` archives the previous state under `.basebrief/history/`
- the current `.basebrief/state.json` is replaced only with the newer reviewed
  handoff state
- `sidecar-build` and `sidecar-check` stay the same because the receiver-facing
  bundle is built from current local Project State, not from a new schema

## Optional Read-only Checks

These commands help inspection, but they do not replace the main path:

```text
node scripts/basebrief.js state-status --repo <target-repo> --json
node scripts/basebrief.js state-validate --repo <target-repo> --json
node scripts/basebrief.js state-history --repo <target-repo> --json
```

- `state-status` answers whether local state exists and validates
- `state-validate` is the stricter read-only gate
- `state-history` shows archived state snapshots after at least one
  `state-advance`

## Receiver First Response Contract

`new-window-starter.md` is the copyable opener for the next chat.
`next-chat-prompt.md` remains the receiver contract. The receiver first
response must:

- restate the key fields from the bundle
- report `pass/fail`
- wait for user confirmation before advancing the work

This keeps the public handoff line human-auditable. It does not create a
receiver thread automatically and does not auto-advance the workflow.

## Example Kit

If you want a public-safe walkthrough you can read like a kit instead of
reconstructing the path yourself, use
[examples/golden-path/README.md](../examples/golden-path/README.md).

The kit includes:

- a reviewed `receiver-ready.md` sample
- a first-pass receiver first response sample for `state-init`
- a follow-up receiver first response sample for `state-advance`
- a Project State shape reference that points back to the existing public-safe
  state example
- a boundary note explaining why raw Sidecar output stays in ignored private
  directories

## Boundaries

- No provider request.
- No raw private output.
- No runtime integration.
- No schema change.
- No Auto Flow.

`basebrief-project-state-v1`, `basebrief-sidecar-v1`, the BB9 handoff contract,
the Receiver Safe Check contract, existing CLI command names, and the
`new-window-starter.md` `pass/fail` anchor all remain unchanged.

## Related Docs

- [Project State](project-state.md)
- [CLI Lite](cli-lite.md)
- [5-minute quickstart](quickstart-5min.md)
- [Golden Path example kit](../examples/golden-path/README.md)
- [v0.9.0 Integrated Handoff Readiness](releases/v0.9.0.md)
- [v0.9.1 Golden Path Closure Candidate](releases/v0.9.1.md)
- [v0.9.2 Golden Path Example Closure Candidate](releases/v0.9.2.md)
