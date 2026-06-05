# Project State Model

`basebrief-project-state-v1` is a minimal local continuity summary. It records
the most recent reviewed receiver-ready handoff, the mechanical repository
snapshot, and the review boundaries needed by the next receiver.

## Model Purpose

The state file answers one question:

```text
What reviewed BaseBrief handoff should this project continue from?
```

It is intentionally small, explicit, and file-based. It is not a memory store,
agent runtime state, task queue, provider configuration, project database, or
Auto Flow state machine.

## Current Shape

The current schema keeps these sections:

- `schemaVersion`: fixed to `basebrief-project-state-v1`
- `state_status`: fixed to `local_project_state`
- `generated_at` and `updated_at`
- `source`: receiver-ready source basename and `handoff_status`
- `repository`: branch, HEAD, and changed-file list at initialization time
- `handoff`: reviewed continuation fields copied from the receiver-ready source
- `review`: explicit review-required markers
- `non_goals`: local safety boundaries

The public example in `examples/project-state/state.json` is the canonical
public-safe example for this shape.

## Deliberate Omissions

The state file must not store:

- raw provider requests or responses
- API keys, tokens, credentials, or `.env` content
- full conversation logs
- full repository diffs
- private absolute paths in public examples
- unreviewed `[CANDIDATE]`, `[NEEDS_REVIEW]`, or `[EMPTY]` content as fact
- history arrays or sidecar adapter output

History and lifecycle commands are deferred until self-dogfooding shows what
state transitions are actually needed.
