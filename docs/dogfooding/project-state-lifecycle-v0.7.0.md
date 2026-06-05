# Project State Lifecycle v0.7.0

This document records public-safe dogfooding evidence for the `v0.7.0` Project
State Lifecycle candidate. Private raw outputs stay under ignored
`tests/outputs/private/` paths.

## Scope

`v0.7.0` adds lifecycle commands on top of the existing
`basebrief-project-state-v1` local state file:

- `state-status`
- `state-validate`
- `state-history`
- `state-advance`

The implementation does not change `state-init`, `state-read`, or the state
schema.

## Evidence

| Test case ID | Evidence | Result |
| --- | --- | --- |
| `state-status-missing` | Missing `.basebrief/state.json` reports `validation_status: missing` without writes. | passed |
| `state-validate-invalid` | Corrupt state returns `validation_status: failed` and a nonzero CLI exit. | passed |
| `state-advance-archives-history` | Advancing from one reviewed source archives the previous state under `.basebrief/history/` and writes the next state. | passed |
| `state-advance-draft-rejected` | Draft-only sources with `draft_needs_review` are rejected. | passed |
| `state-history-after-advance` | History lists one valid archived entry after the first advance. | passed |

## Observations

- The v0.6.3 readiness signals were sufficient for lifecycle inspection and
  explicit reviewed advancement.
- `state-status` is useful as a low-friction entry point for stalled projects
  because it does not fail hard on missing state.
- `state-validate` is useful as a release/check gate because missing or invalid
  state should be visible to automation.
- `state-advance` must stay behind `review-draft`; direct draft promotion would
  recreate the overreach that v0.6.x intentionally avoided.

## Boundaries

- No Auto Flow.
- No provider request.
- No schema change.
- No receiver thread creation.
- No provider gateway.
- No raw response capture.
- `provider_probe_status=skipped` remains the default public release-check
  posture.

Provider private validation remains design-only in public docs. Public material
may name only these env var shapes: `BASEBRIEF_PROVIDER_BASE_URL`,
`BASEBRIEF_PROVIDER_API_KEY`, and `BASEBRIEF_PROVIDER_MODEL`.
