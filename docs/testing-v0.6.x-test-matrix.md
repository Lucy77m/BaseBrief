# BaseBrief v0.6.x Test Matrix

This matrix covers the `v0.6.x` project-state stabilization line. It is
provider-free by default and keeps private outputs under ignored local
directories.

## Local Required Gates

```text
node --test tests/basebrief.test.js
node scripts/run_release_checks.js
npm run check
git diff --check
```

Expected no-provider release-check output:

```text
provider_probe_status=skipped
```

## Project State Normal Path

- `receiver-flow --guided` creates `handoff_status: draft_needs_review`.
- `review-draft` creates `handoff_status: ready_for_receiver` only after review.
- `state-init` writes `.basebrief/state.json` from the reviewed source.
- `state-read --json` reads the same state without modifying the repo.
- Artifact Checker passes on public examples and public dogfooding summaries.

## Exception Paths

- reject `draft_needs_review` as project-state input
- reject missing required handoff sections
- reject `.env` and `.git` source or output paths
- reject overwrite of existing `.basebrief/state.json`
- report missing state clearly during `state-read`
- keep private output under `tests/outputs/private/`
- keep public docs free of private absolute paths and credential-like values

## v0.6.2 Self-Dogfooding Evidence

Normal path evidence:

- `receiver-flow --guided` creates `handoff_status: draft_needs_review`.
- `review-draft` creates `handoff_status: ready_for_receiver`.
- `state-init` writes `basebrief-project-state-v1`.
- `state-read --json` reads the state back.

Exception evidence:

- `review-draft-unchecked`
- `state-init-draft-rejected`
- `state-read-missing-state`
- `state-init-env-source-rejected`
- `state-init-git-source-rejected`
- `state-init-missing-field-rejected`
- `state-init-duplicate-rejected`

These cases are evidence for `v0.6.x` stabilization only. They do not add Auto
Flow, lifecycle commands, schema changes, sidecar adapters, or provider calls.

## v0.6.3 Lifecycle Readiness Gate

Readiness evidence:

- duplicate state, missing state, and review-gate friction are lifecycle design
  signals
- unsafe paths, missing fields, duplicate state, and missing state are testable
- reviewed-input requirements and non-automatic repair are documentable
- draft promotion, state advancement, state history, state status inference, and
  Auto Flow are not automated yet

`v0.6.3` does not add state lifecycle commands, does not change
`basebrief-project-state-v1`, and does not run provider requests.

## Path And Runner Coverage

- PowerShell local path smoke
- paths with spaces or non-ASCII characters when using temporary fixtures
- WSL or external runner smoke only after local checks pass
- long-stale project dogfooding as a later evidence task, not a v0.6.1 gate

## Provider Matrix Design

Provider testing is not part of the public v0.6.1 gate. If a later private
smoke is explicitly approved, it should use only process-local environment
variables:

```text
BASEBRIEF_PROVIDER_BASE_URL
BASEBRIEF_PROVIDER_API_KEY
BASEBRIEF_PROVIDER_MODEL
```

Private smoke results may be stored only under `tests/outputs/private/`. Public
docs may record that the smoke was skipped, blocked, or privately executed, but
must not record endpoint values, keys, raw provider responses, or provider
claims as release proof.
