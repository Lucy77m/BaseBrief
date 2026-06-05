# Project State Lifecycle Readiness v0.6.3

This dogfooding record uses `v0.6.2` friction to decide whether BaseBrief is
ready to implement Project State Lifecycle commands. The conclusion is no:
`v0.6.3` should create a readiness gate, not lifecycle behavior.

## Evidence Inputs

- `state-init-duplicate-rejected`: duplicate state is real friction, but
  overwriting or advancing state still needs explicit user intent.
- `state-read-missing-state`: missing state is real friction, but automatic
  creation would bypass the reviewed source requirement.
- `review-draft-unchecked`: the review gate is intentional friction that should
  not be automated away.
- `.env` and `.git` source rejections are testable safety behavior, not
  lifecycle design pressure.

## Classification

- Testable friction: unsafe paths, missing fields, duplicate state, missing
  state.
- Documentable friction: explaining why state is not created or advanced
  automatically.
- Not automated yet: draft promotion, state advancement, state history, state
  status inference, or Auto Flow.

## Decision

`v0.6.3` records the readiness gate for future lifecycle work. It does not add
`state-advance`, `state-status`, `state-validate`, `state-history`, or any other
new CLI command.

The manual sequence remains:

```text
receiver-flow --guided
review-draft
state-init
state-read --json
```

## Boundaries

- No state lifecycle commands.
- No Auto Flow.
- No provider request.
- No schema change.
- No provider gateway.
- No sidecar adapter.
- No automatic `ready_for_receiver` promotion.
- `provider_probe_status=skipped` remains the expected no-provider gate.
