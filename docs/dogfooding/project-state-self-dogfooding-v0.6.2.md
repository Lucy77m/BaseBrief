# Project State Self-Dogfooding v0.6.2

Dogfooding scope: deepen BaseBrief's own `v0.6.x` project-state evidence after
the `v0.6.1` stabilization patch. This record focuses on exception paths,
review-gate friction, and state-model observations.

## Public-Safe Run Shape

Private artifacts were generated under an ignored local output directory. The
public evidence keeps only command shape, status names, and test-case IDs:

```text
receiver-flow --guided
review-draft
state-init
state-read --json
```

No provider request was made. No provider key, endpoint value, model value, raw
provider response, or private absolute path is recorded here.

## Normal Path Evidence

- `receiver-flow --guided` produced `handoff_status: draft_needs_review`.
- `review-draft` produced `handoff_status: ready_for_receiver` after explicit
  checklist review.
- `state-init` accepted only the reviewed receiver-ready source.
- `state-read --json` read back `basebrief-project-state-v1`.
- The public summary is designed to pass Artifact Checker without exposing
  private paths or credential-like values.

## Exception Path Evidence

- `review-draft-unchecked`: rejected an unchecked review checklist.
- `state-init-draft-rejected`: rejected `draft_needs_review` as a state source.
- `state-read-missing-state`: reported a missing project state.
- `state-init-env-source-rejected`: rejected a `.env` source path.
- `state-init-git-source-rejected`: rejected a `.git` source path.
- `state-init-missing-field-rejected`: rejected a receiver-ready source missing
  a required handoff section.
- `state-init-duplicate-rejected`: rejected overwriting an existing
  `.basebrief/state.json`.

## Review-Gate Friction

- The manual review gate is useful friction: it prevents candidate text from
  becoming durable project state without human confirmation.
- The current failure modes are clear enough for `v0.6.x`; they justify
  documentation and tests before new lifecycle commands.
- Duplicate state and missing state errors indicate a future need for lifecycle
  language, but not yet for `state-advance`, `state-status`, `state-validate`,
  `state-history`, or Auto Flow.

## State Model Observation

`basebrief-project-state-v1` should remain a small local continuity summary. It
is not memory, not runtime state, not a task queue, not provider state, and not
an Auto Flow state machine.

## Next Design Signal

Use the `v0.6.2` evidence to decide which lifecycle behaviors are repeatedly
needed in real continuation work. Do not add lifecycle commands until the
friction log shows a repeated manual step that automation would reduce without
removing review intent.
