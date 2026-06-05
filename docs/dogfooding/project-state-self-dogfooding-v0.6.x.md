# Project State Self-Dogfooding v0.6.x

Dogfooding scope: BaseBrief uses its own receiver-flow and project-state tools
to validate the post-`v0.6.0` continuation path.

## Public-Safe Run Shape

The private run writes ignored artifacts under `tests/outputs/private/` and uses
this command sequence:

```text
receiver-flow --guided
review-draft
state-init
state-read --json
```

No provider request is required. No provider key, endpoint value, raw provider
response, or private absolute path is recorded in this public summary.

## Expected Evidence

- guided draft remains `handoff_status: draft_needs_review`
- reviewed handoff becomes `handoff_status: ready_for_receiver`
- `state-init` accepts only the reviewed handoff
- `state-read --json` reads back `basebrief-project-state-v1`
- generated public-safe summary passes Artifact Checker

## Observed Friction

- A useful state file depends on a reviewed receiver-ready source; mechanical
  repo facts are not enough.
- `state.json` should remain a small continuity summary until self-dogfooding
  shows a real lifecycle need.
- Provider smoke belongs in a private matrix and should not become public
  release proof for v0.6.x.

## Next Fix Candidates

- Keep the state model documented before adding lifecycle commands.
- Track exception paths in the v0.6.x matrix before implementing
  `state-advance`.
- Use friction records to decide whether future automation saves review effort
  or merely creates more candidate text.
