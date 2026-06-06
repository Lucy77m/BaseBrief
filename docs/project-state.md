# BaseBrief Project State

Project State is the local continuity layer for reviewed receiver handoffs.
`v0.6.0` introduced `.basebrief/state.json`; `v0.7.0` adds lifecycle
inspection and reviewed-state advancement without changing the
`basebrief-project-state-v1` schema. `v0.8.x` adds Sidecar as the local
consumer layer for Project State. `v0.9.0` is Integrated Handoff Readiness: a
public hardening line that connects receiver-ready handoff, Project State,
Sidecar bundle, and receiver first response without changing schema or adding
provider/runtime behavior.

```bash
node scripts/basebrief.js state-init --repo <target-repo> --source <receiver-ready.md> --json
node scripts/basebrief.js state-read --repo <target-repo> --json
node scripts/basebrief.js state-status --repo <target-repo> --json
node scripts/basebrief.js state-validate --repo <target-repo> --json
node scripts/basebrief.js state-history --repo <target-repo> --json
node scripts/basebrief.js state-advance --repo <target-repo> --source <receiver-ready.md> --json
node scripts/basebrief.js sidecar-build --repo <target-repo> --target generic --starter-language zh-CN --json
node scripts/basebrief.js sidecar-check --input <sidecar-dir> --json
```

`state-init` writes `<target-repo>/.basebrief/state.json` from an explicit
`receiver-ready.md` source. The source must already contain:

```text
handoff_status: ready_for_receiver
```

The state file records only local, mechanical state:

- `schemaVersion: basebrief-project-state-v1`
- repository branch, HEAD, and changed files
- source file basename and `handoff_status: ready_for_receiver`
- confirmed handoff fields: `current_goal`, `verified_facts`,
  `confirmed_decisions`, `risk_boundaries`, `receiver_entry_task`,
  `open_questions`
- non-goal markers for provider requests, Auto Flow, receiver thread creation,
  and secret storage

## Golden Path Role

Project State is the middle layer in the public integrated handoff path:

```text
receiver-ready.md -> state-init/state-advance -> sidecar-build -> sidecar-check -> new-window-starter.md -> receiver first response
```

Use `state-init` when the repo is entering local continuity for the first time.
Use `state-advance` when the repo already has a valid
`.basebrief/state.json` and you are promoting a newer reviewed
`receiver-ready.md` into the same local continuity line.

`state-status`, `state-validate`, and `state-history` remain optional
inspection commands. They help confirm local state, but they do not replace the
main path described in [Integrated Handoff Golden Path](golden-path.md).

## Lifecycle Commands

`state-read` reads the existing `.basebrief/state.json` and validates the full
project-state object. It does not modify the target repo.

`state-status` is a read-only inspection command. It reports whether local
state exists, whether it validates, the stored source metadata, and the stored
repository snapshot. Missing state is reported as `validation_status: missing`
instead of creating a file.

`state-validate` is a stricter read-only gate. It returns
`validation_status: passed` only when `.basebrief/state.json` exists and
conforms to the current local validator. The CLI exits nonzero when validation
fails.

`state-history` lists archived state snapshots under `.basebrief/history/`.
Before the first advancement it reports `history_status: not_initialized`.

`state-advance` requires an existing valid `.basebrief/state.json` and a new
reviewed `receiver-ready.md` source. It archives the previous state under
`.basebrief/history/` and overwrites `.basebrief/state.json` with the new
reviewed state. The schema remains `basebrief-project-state-v1`.

## Sidecar Bundle

`sidecar-build` is the v0.8.0 consumer layer for Project State. It reads an
existing valid `.basebrief/state.json` and writes a local receiver handoff
bundle without changing the Project State file or schema.

The command supports `generic` and `openclaw` targets. The `openclaw` target is
formatting and safety wording only: no runtime integration, no provider
request, no raw private output, no OpenClaw/Hermes profile/config/memory
writes, and no schema change.

The generated bundle includes `new-window-starter.md`, a short copyable block
for the user to paste into a new chat. It points the receiver to the Sidecar
bundle, asks for a `pass/fail` report, and keeps `next-chat-prompt.md` as the
receiver contract. The
optional `--starter-language auto|zh-CN|en|ja` flag localizes only that
copyable starter shell; protocol fields, paths, file names, schema names, and
English hard-stop anchors remain literal.

Default output is `.basebrief/sidecar/<target>/`. Public dogfooding records
should summarize the result only; raw sidecar output belongs in ignored private
directories.

`sidecar-check` is the v0.8.1 acceptance layer for the generated bundle. It is
a read-only consumer of sidecar output, not a Project State writer. It requires
the six contract files, validates `basebrief-sidecar-v1` and
`basebrief-project-state-v1` metadata, checks that `current_goal`,
`receiver_entry_task`, and at least two `risk_boundaries` are understandable in
`next-chat-prompt.md`, and reuses the artifact checker for public-safe output.
For v0.8.7-and-later bundles, it also validates `new-window-starter.md` when
`manifest.json` declares `output_files.newWindowStarter`, including its
`pass/fail` report instruction; older bundles without that manifest key remain
compatible.
It does not change `.basebrief/state.json`, does not change schema, does not
call providers, and does not connect runtime systems.

## Boundaries

- No provider request.
- No raw private output.
- No Auto Flow.
- No Web UI.
- No plugin or platform work.
- No receiver thread creation.
- No secret storage.
- No automatic promotion from draft to ready.
- No schema change.
- No runtime integration.
- No v1.0 claim.
- BB9 handoff schema is unchanged.
- Receiver Safe Check config and result schemas are unchanged.

`state-init` refuses to overwrite an existing state file and rejects `.env` or
`.git` source/output paths. `state-advance` uses the same reviewed-source guard
and also rejects advancement when the existing state is missing or invalid. The
state directory is intended for local continuity only; review the receiver-ready
source before creating or advancing it.
