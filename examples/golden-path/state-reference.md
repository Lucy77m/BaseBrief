# Project State Shape Reference

This example kit reuses the public-safe Project State shape from
[`../project-state/state.json`](../project-state/state.json).

What to carry forward from that reference:

- `schemaVersion: basebrief-project-state-v1`
- `source.handoff_status: ready_for_receiver`
- repository branch, HEAD, and changed-file snapshot stay local continuity
  evidence only
- the follow-up branch archives prior state under `.basebrief/history/`

This is a shape guide, not a raw Sidecar bundle dump, not runtime integration,
and not a schema change.
