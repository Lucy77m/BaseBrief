# Delta Handoff Spec

`delta` is the v1.0 Reviewable Delta Handoff Compiler path.

It turns the current local project state plus git facts into a receiver-facing
`delta-handoff.md`. It is local-only, zero-provider, and does not change
`basebrief-project-state-v1`.

## Command Shape

```text
node scripts/basebrief.js delta --repo <target-repo> --output-dir <dir> [--since <commit>] [--advance-baseline] [--json]
```

Inputs:

- `<target-repo>/.basebrief/state.json`
- optional `<target-repo>/.basebrief/delta-baseline.json`
- optional explicit `--since <commit>`
- git branch, HEAD, commit range, and changed-file facts

Output:

- `<output-dir>/delta-handoff.md`
- optional `<target-repo>/.basebrief/delta-baseline.json` only when
  `--advance-baseline` is passed

## Review Semantics

The delta artifact uses two review markers:

- `reviewed`: copied from the current valid `.basebrief/state.json`
- `needs-review`: generated from git facts, worktree status, or state diff

The receiver should treat `reviewed` sections as accepted continuity and
`needs-review` sections as generated summary content to inspect before acting.

## Baseline Lifecycle

`delta-baseline.json` is a local delta baseline, not public history.

Minimum shape:

```json
{
  "schemaVersion": "basebrief-delta-baseline-v1",
  "repo": {
    "branch": "main",
    "head": "<commit>"
  },
  "state": {
    "updated_at": "<project-state timestamp>"
  },
  "last_delta_at": "<timestamp>"
}
```

The implementation may also store a local `basebrief-seal-v1` snapshot inside
`state.seal` so the next delta can reuse the existing Seal/Diff v1 logic.

Default behavior is read-only against the baseline: generating a delta does not
advance the baseline. `--advance-baseline` writes the next baseline after the
handoff is generated.

## Boundaries

`delta` does not:

- call providers
- create receiver threads
- read `.env` files
- publish raw private output
- modify `basebrief-project-state-v1`
- introduce `basebrief-sidecar-v2`
- perform runtime, plugin, MCP, IDE, cloud, or hosted-memory integration

