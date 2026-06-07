# Golden Path Example Kit

This directory is a public-safe companion to the `v0.9.x` integrated local
handoff line. It does not contain raw Sidecar bundle output, private absolute
paths, provider requests, runtime traces, or `.env` data.

Read in this order:

1. [Reviewed receiver-ready sample](receiver-ready.md)
2. [Project State shape reference](state-reference.md)
3. [First-pass receiver first response](first-pass-receiver-report.md)
4. [Follow-up receiver first response](follow-up-receiver-report.md)
5. [Sidecar output boundary note](sidecar-output-boundary.md)

Use the first-pass branch when the target repo does not yet have a valid
`.basebrief/state.json`.

Use the follow-up branch when the target repo already has a valid
`.basebrief/state.json` and a newer reviewed `receiver-ready.md` should replace
the current local state.

Command shapes:

```text
node scripts/basebrief.js state-init --repo <target-repo> --source <receiver-ready.md> --json
node scripts/basebrief.js state-advance --repo <target-repo> --source <receiver-ready.md> --json
node scripts/basebrief.js sidecar-build --repo <target-repo> --target generic --starter-language zh-CN --output-dir <sidecar-dir> --json
node scripts/basebrief.js sidecar-check --input <sidecar-dir> --json
```

Optional read-only checks stay outside the required path:

```text
node scripts/basebrief.js state-status --repo <target-repo> --json
node scripts/basebrief.js state-validate --repo <target-repo> --json
node scripts/basebrief.js state-history --repo <target-repo> --json
```

Both receiver first-response samples assume that `sidecar-build` wrote
`new-window-starter.md` and that the receiver must report `pass/fail` before
any project work continues.

They also keep `wait for user confirmation` and show how a starter-facing
receiver report can borrow the v1.2 Delta Receiver Report Kit fields:
`current_goal`, `live_repo_state`, `inherited_fact_differences`,
`hard_boundaries`, and `next_narrow_slice`.

The samples keep source-window inherited facts separate from live repo facts
and receiver-window rechecks. If live facts stop matching the inherited
handoff, human-facing `fail` can coexist with
`handoff_acceptance: difference_found`; that is a completed receiver outcome,
not an execution failure.

For the full report contract, see
[v1.2 Delta Receiver Report Kit dogfooding](../../docs/dogfooding/delta-receiver-report-kit-v1.2.md).
