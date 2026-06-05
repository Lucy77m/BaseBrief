# Project State Lifecycle Readiness

This document defines the evidence gate before BaseBrief should implement
Project State Lifecycle commands. It is a design boundary, not a lifecycle
implementation.

## Current Position

`basebrief-project-state-v1` remains a small local continuity summary written by
`state-init` after a reviewed `ready_for_receiver` source and read by
`state-read`.

Lifecycle commands such as `state-advance`, `state-status`, `state-validate`,
and `state-history` are deferred until repeated dogfooding shows that the manual
step is both common and safe to automate.

## Readiness Criteria

Lifecycle implementation may be planned only when all of these are true:

- repeated friction appears in at least two public-safe dogfooding records
- the friction cannot be solved by clearer docs, examples, or tests
- automation would preserve the manual review gate
- the command can avoid secrets, `.env` content, private absolute paths, and
  provider request data
- the behavior can be validated without provider API calls
- the behavior does not require changing `basebrief-project-state-v1`

## Friction Classification

- Testable: unsafe source paths, missing required source sections, duplicate
  state writes, missing state reads.
- Documentable: when to run `state-init`, why reviewed input is required, and
  why missing or duplicate state is not automatically repaired.
- Not automated yet: promoting drafts to `ready_for_receiver`, advancing state
  after every task, generating history, or deciding lifecycle status without a
  reviewed handoff.

## Non-Goals

- No state lifecycle commands.
- No Auto Flow.
- No provider request.
- No schema change.
- No provider gateway.
- No sidecar adapter.
- No automatic `ready_for_receiver` promotion.

## Provider Matrix Position

Provider smoke remains private and optional. Public readiness evidence may name
only these environment variables, never their values:

```text
BASEBRIEF_PROVIDER_BASE_URL
BASEBRIEF_PROVIDER_API_KEY
BASEBRIEF_PROVIDER_MODEL
```

`provider_probe_status=skipped` remains the expected no-provider gate.
