# BaseBrief Self-Validation Pre-v0.8

This document records public-safe evidence for the Pre-v0.8 self-validation
checkpoint after the `v0.7.0` Project State Lifecycle release.

Private raw outputs stay under ignored `tests/outputs/private/` paths. This
record intentionally does not publish raw private output, private absolute
paths, provider endpoints, API keys, model values, raw responses, or token
output.

## Scope

The checkpoint validates whether BaseBrief can use its own receiver-flow and
project-state commands to create a real, non-empty, receiver-ready project
state before v0.8.0 Sidecar work begins.

This is not a release, not v0.8 implementation, not Sidecar implementation, not
Auto Flow, and not an agent runtime integration.

## Public-Safe Run Shape

```text
receiver-flow --guided
review-draft
state-init
state-read --json
state-status --json
state-validate --json
```

The guided draft used reviewed human judgment fields for `current_goal`,
`verified_facts`, `confirmed_decisions`, `risk_boundaries`,
`receiver_entry_task`, and `open_questions`.

## Evidence

| Check | Evidence | Result |
| --- | --- | --- |
| `guided-fields-non-empty` | The guided draft contained non-empty values for all six human judgment fields. | passed |
| `review-draft-gate` | `review-draft` accepted only after the review checklist was complete and blocked markers were absent. | passed |
| `state-init-self-bootstrap` | `state-init` created a local `basebrief-project-state-v1` state from the reviewed receiver-ready source. | passed |
| `state-read-non-empty` | `state-read --json` returned non-empty `current_goal`, `receiver_entry_task`, and `risk_boundaries`. | passed |
| `state-status-validation` | `state-status --json` reported `validation_status: passed`. | passed |
| `state-validate-gate` | `state-validate --json` reported `validation_status: passed`. | passed |
| `receiver-window-acceptance-initial` | A separate receiver-window check understood the state but rejected the first output because it did not explicitly say to wait for user confirmation. | failed |
| `receiver-window-acceptance-retry` | The receiver task was regenerated with explicit user-confirmation language, and the separate receiver-window check passed all five acceptance items. | passed |

## Observations

- The checkpoint proves that the v0.7.0 lifecycle can produce a non-empty
  local self-bootstrap state for BaseBrief.
- The review gate remains useful friction: guided content did not become
  durable project state until the checklist was explicitly reviewed.
- The initial receiver-window failure was useful: "do not advance" was not
  enough; the receiver task must explicitly say to wait for user confirmation.
- The next v0.8.0 Sidecar work should treat non-empty `current_goal`,
  `receiver_entry_task`, and `risk_boundaries` as content-level acceptance
  requirements, not just file-existence checks.

## Boundaries

- No provider request.
- No raw private output in public docs.
- No v0.8 implementation yet.
- No Sidecar command yet.
- No Auto Flow.
- No schema change.
- No receiver thread creation.
- No OpenClaw or Hermes runtime integration.
- No push, tag, release, or npm publish.
- `provider_probe_status=skipped` remains the public release-check posture.

The root `.basebrief/` state generated during this checkpoint is a local
validation artifact. It is copied to ignored private output for evidence and is
not committed as a public repository file.
