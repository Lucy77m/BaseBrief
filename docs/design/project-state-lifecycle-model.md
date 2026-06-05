# Project State Lifecycle Model

`v0.7.0` turns the v0.6.x readiness gate into a small local lifecycle surface:
inspect, validate, list history, and advance reviewed state. It does not turn
BaseBrief into an agent runtime or Auto Flow system.

## Commands

- `state-status --repo <target-repo>` reports whether `.basebrief/state.json`
  exists and whether it validates.
- `state-validate --repo <target-repo>` is the strict read-only gate; failed
  validation exits nonzero in CLI mode.
- `state-history --repo <target-repo>` lists archived prior state snapshots
  under `.basebrief/history/`.
- `state-advance --repo <target-repo> --source <receiver-ready.md>` requires an
  existing valid state and a reviewed receiver-ready source, archives the
  previous state, and writes the next state.

## Data Flow

1. `receiver-flow --guided` creates a draft with
   `handoff_status: draft_needs_review`.
2. `review-draft` promotes only fully reviewed drafts to
   `handoff_status: ready_for_receiver`.
3. `state-init` creates the first `.basebrief/state.json`.
4. `state-status` and `state-validate` inspect the current state without writes.
5. `state-advance` archives the previous state to `.basebrief/history/` and
   writes the next `.basebrief/state.json` from a reviewed source.
6. `state-history` exposes archived metadata for continuity checks.

## Model Rules

- The schema remains `basebrief-project-state-v1`.
- `state-advance` preserves the original `generated_at` and updates
  `updated_at`.
- History entries are complete previous state snapshots, not diffs.
- History filenames are derived from timestamp plus reviewed source basename.
- `.env` and `.git` paths are rejected for state sources and state outputs.

## Non-Goals

- No Auto Flow.
- No provider request.
- No schema change.
- No receiver thread creation.
- No memory store.
- No task queue.
- No automatic draft promotion.
- No provider gateway or sidecar adapter.
