# Context Pack Continuation Harness Decision Spec v2.6.16

status: local decision spec only, not a feature implementation

- decision_spec_status: draft_only
- implementation_status: not_started
- release_closeout_status: not_started
- push_status: not_started
- tag_status: not_started
- release_status: not_started
- provider_probe_status=skipped
- continuation_harness_lite_status: not_started
- status_command_status: not_started
- workflow_runner_status: not_started
- json_contract_change_status: not_started

## Summary

`v2.6.16` defines when BaseBrief should consider a future Continuation Harness
Lite. It does not implement the harness, add a command, change Context Pack
structure, or change any JSON contract.

The current decision is to keep collecting adoption evidence. The v2.6.x local
bundle has enough evidence to improve docs, examples, and release-check
coverage, but not enough repeated blocking friction to justify a new workflow
surface.

## Decision Questions

Use these questions before opening a future implementation line:

1. Did a real handoff fail even though the Context Pack was complete enough to
   run `check --input <dir> --json`?
2. Was the failure caused by sequencing confusion across `context-pack -> check
   -> resume -> live recheck`, instead of missing documentation?
3. Did the same blocking or high-frequency confusing friction repeat across
   multiple handoffs?
4. Would a narrower helper reduce user decisions without hiding the live
   recheck step?
5. Can the problem still be fixed with first-run docs, example kits, starter
   wording, or release-check coverage instead?

## Evidence Thresholds

Do not start Continuation Harness Lite unless the evidence crosses all of these
thresholds:

- blocking_threshold: at least three public-safe real handoff observations show
  the same blocking friction.
- confusion_threshold: repeated confusing friction survives a docs/examples
  repair attempt.
- command_threshold: the user cannot reliably choose between `check`, `resume`,
  and `doctor` from the current quickstart and examples.
- safety_threshold: the proposed helper can preserve live recheck, inherited
  context boundaries, and public-safe output without becoming Status or Workflow
  Runner.

## Future Narrow Shape

If the threshold is met later, the smallest candidate shape is a review-only
guided flow for the existing sequence:

1. Read a Context Pack as inherited context.
2. Run the existing pack validity gate.
3. Produce or point to the copyable resume prompt.
4. Remind the receiver to live-recheck `cwd`, branch, HEAD, and git status.
5. Stop before runtime automation, provider calls, or hosted memory.

This candidate shape is not started in v2.6.16.

## Current Decision

Do not implement Continuation Harness Lite yet. Continue with adoption evidence,
public-safe dogfooding notes, scenario examples, and release-check guards. Start
an implementation only if repeated real handoff evidence shows that the current
docs/examples path cannot repair the same blocking or high-frequency confusing
friction.

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
