# Context Pack Continuation Harness Lite Design Sketch

status: local design sketch only, not an implementation

- design_sketch_status: draft_only
- implementation_status: not_started
- command_status: not_started
- release_closeout_status: not_started
- push_status: not_started
- tag_status: not_started
- release_status: not_started
- provider_probe_status=skipped
- continuation_harness_lite_status: design_sketch_only
- status_command_status: not_started
- workflow_runner_status: not_started
- json_contract_change_status: not_started

## Summary

This sketch describes the smallest possible Continuation Harness Lite shape for
BaseBrief. It is a paper harness, not a CLI command or product surface.

The goal is to narrow the human handoff sequence from inherited Context Pack
material to live repo recheck, while keeping the existing Context Pack, Check,
Resume, Doctor, and Export contracts unchanged.

## Design Principles

- Own the context window: treat the Context Pack as inherited context, not as
  the current task by itself.
- Keep the reducer stateless: each receiver window must recheck live repo facts
  instead of trusting stale source-window state.
- Prefer handoff artifacts: use the seven Context Pack files and the existing
  resume prompt instead of hidden memory.
- Practice memory hygiene: do not introduce hosted memory, vector memory,
  embeddings, provider calls, or runtime automation.
- Compress by decision: carry only the facts needed to decide continue,
  refresh, run Doctor, or stop.

## Proposed Five-Step Flow

1. Read the Context Pack as inherited context.
2. Run the existing pack validity gate with `check`.
3. Generate or point to the existing copyable `resume` prompt.
4. Recheck live repo facts: cwd, branch, HEAD, and worktree status.
5. Decide: continue, refresh pack, run Doctor, or stop.

Doctor remains conditional. It is used when the pack may be stale, broken, or
in conflict with live repo facts; it is not an always-on Status command.

## State Machine Sketch

- `pack_missing -> blocked`
- `check_failed -> repair_pack`
- `check_warning -> human_review`
- `check_passed + live_match -> resume_ready`
- `check_passed + live_drift -> doctor_or_refresh`
- `resume_ready -> user_goal_required`

The final state is not automatic implementation. A receiver still needs the
latest user instruction as the real current goal.

## Future Human Output Shape

If this ever becomes implementation work, the smallest useful output would be a
human-readable checklist:

- `pack_status`: missing, failed, warning, passed.
- `resume_status`: unavailable, available.
- `live_recheck_status`: pending, matched, drift_found.
- `recommended_next_step`: continue, refresh_pack, run_doctor, stop.
- `reason`: short public-safe explanation.

This sketch does not define a new JSON shape.

## Entry Criteria Before Implementation

Do not implement Continuation Harness Lite unless all of these are true:

- At least three public-safe real handoffs show the same blocking or
  high-frequency confusing friction.
- The friction survives a docs/examples/release-check repair attempt.
- The friction is specifically about sequencing `context-pack -> check ->
  resume -> live recheck`.
- The helper can remain review-only, local-first, public-safe, and
  contract-preserving.
- The helper does not become Status, Workflow Runner, provider integration,
  hosted memory, daemon, watcher, or schema-v2.

## Current Decision

Do not implement from the current evidence. The latest first-run/handoff
validation passed without blocking or repeated confusing friction, so the design
sketch stays as planning material only.

## Boundaries

- No new CLI command.
- No Context Pack seven-file structure change.
- No `check --input <dir> --json` top-level shape change.
- No Resume JSON contract change.
- No Doctor JSON contract change.
- No Export JSON contract change.
- No Status command.
- No Workflow Runner.
- No Continuation Harness Lite implementation.
- No provider request.
- No runtime integration.
- No MCP server.
- No MCP tools.
- No plugin.
- No schema-v2.
- No daemon.
- No watcher.
- No hosted memory.
- No push, tag, release, or PR.

## Validation Gate

Keep the local gate unchanged:

```text
npm run release-check
npm test
git diff --check
provider_probe_status=skipped
```
