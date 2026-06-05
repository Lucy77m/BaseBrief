# Project State Validation Rules

These rules describe how `basebrief-project-state-v1` should be validated and
documented in the `v0.6.x` stabilization line. They do not change the schema.

## Required Source Rule

`state-init` may only read a reviewed receiver-ready Markdown source containing:

```text
handoff_status: ready_for_receiver
```

It must reject `draft_needs_review` and any source that still contains
unreviewed markers such as `[EMPTY]`, `[NEEDS_REVIEW]`, or `[CANDIDATE]`.

## Required Field Rule

The source must include the reviewed handoff sections used by project state:

- `current_goal`
- `verified_facts`
- `confirmed_decisions`
- `risk_boundaries`
- `receiver_entry_task`
- `open_questions`

Missing sections should fail clearly instead of producing partial state.

## Safety Rule

Project state must not read from or write into `.env` or `.git` paths. Public
examples and public docs must not include real credentials, provider keys,
private absolute paths, raw provider responses, or raw private output.

## Promotion Rule

`state-init` records reviewed state; it does not perform review. It must not
turn extracted candidates, guided draft answers, or inferred text into verified
facts.

## Provider Rule

Provider smoke testing is optional and private. The public release gate remains
valid when provider settings are absent:

```text
provider_probe_status=skipped
```

If a private provider smoke is run later, the matrix may name only environment
variable shapes such as `BASEBRIEF_PROVIDER_BASE_URL`,
`BASEBRIEF_PROVIDER_API_KEY`, and `BASEBRIEF_PROVIDER_MODEL`; it must not record
their values.
