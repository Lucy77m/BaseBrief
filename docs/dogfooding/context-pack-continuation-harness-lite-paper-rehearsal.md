# Context Pack Continuation Harness Lite Paper Rehearsal

status: local paper rehearsal only, not implementation

- paper_rehearsal_status: completed
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
- covered_scenarios: clean pack, too-thick warning, broken pack, stale/live drift, missing pack

## Summary

This note rehearses the Continuation Harness Lite design sketch against five
existing Context Pack adoption scenarios. It is a paper exercise for explaining
state transitions, not a CLI command, not an implementation plan, and not a new
contract.

The goal is to check whether the sketch can describe current clean, warning,
broken, stale/live-drift, and missing-pack cases without changing BaseBrief's
existing Context Pack, Check, Resume, Doctor, or Export behavior.

## Scenario Rehearsal

### Clean Pack

- input signal: Context Pack Check passes, and the receiver live recheck matches
  the inherited pack facts closely enough to continue.
- state transition: `check_passed + live_match -> resume_ready -> user_goal_required`.
- recommended next step: use the existing `resume` prompt, then wait for or
  follow the latest user instruction as the real current goal.
- not-a-trigger: this is not a trigger for Doctor, Status, Workflow Runner,
  provider calls, or automatic implementation.

### Too-Thick Warning

- input signal: Context Pack Check still passes but reports
  `context-pack.too-thick` or similar review-warning pressure.
- state transition: `check_warning -> human_review`.
- recommended next step: have a human skim the thick section, decide whether to
  trim or accept it, and continue only after the warning is understood.
- not-a-trigger: this is not a trigger for JSON contract changes, schema-v2, a
  new command, or automatic pack rewriting.

### Broken Pack

- input signal: Context Pack Check fails because required artifacts, headings,
  or expected starter semantics are missing or invalid.
- state transition: `check_failed -> repair_pack`.
- recommended next step: repair or regenerate the pack, then rerun the existing
  Check gate before using `resume`.
- not-a-trigger: this is not a trigger for a hosted repair service, runtime
  integration, provider request, MCP server/tools, plugin, daemon, or watcher.

### Stale Or Live Drift

- input signal: Context Pack Check passes, but the receiver live recheck finds
  branch, HEAD, worktree, or repo-state drift against inherited source-window
  facts.
- state transition: `check_passed + live_drift -> doctor_or_refresh`.
- recommended next step: run the existing Doctor only when the drift needs a
  source-backed comparison, or refresh the pack before continuing.
- not-a-trigger: Doctor remains conditional and is not an always-on Status
  command, Workflow Runner, or automation surface.

### Missing Pack

- input signal: the receiver does not have the expected Context Pack directory
  or cannot locate the required seven reviewable artifacts.
- state transition: `pack_missing -> blocked`.
- recommended next step: ask for the pack path, regenerate the pack from the
  source repo, or switch to another user-approved context source.
- not-a-trigger: this is not a reason to infer hidden memory, inspect secrets,
  auto-discover private locations, or continue from historical release slices.

## Paper Rehearsal Result

The design sketch can explain the five current scenario families with existing
BaseBrief surfaces:

- `check` remains the pack validity gate.
- `resume` remains the copyable next-window prompt surface.
- live recheck remains a receiver-window responsibility.
- Doctor remains a conditional live repo comparison tool.
- the latest user instruction remains required before acting.

Current evidence still does not trigger implementation. Harness Lite remains
design sketch only, with `implementation_status: not_started` and
`command_status: not_started`.

## Boundaries

- No new CLI command.
- No Context Pack seven-file structure change.
- No `check --input <dir> --json` top-level shape change.
- No Resume JSON contract change.
- No Doctor JSON contract change.
- No Export JSON contract change.
- No JSON shape change.
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
