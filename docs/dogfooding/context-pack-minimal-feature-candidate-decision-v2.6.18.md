# Context Pack Minimal Feature Candidate Decision v2.6.18

status: local feature-candidate decision only, not an implementation

- feature_candidate_status: design_sketch_candidate
- implementation_status: not_started
- release_closeout_status: not_started
- push_status: not_started
- tag_status: not_started
- release_status: not_started
- provider_probe_status=skipped
- continuation_harness_lite_status: design_sketch_candidate
- status_command_status: not_started
- workflow_runner_status: not_started
- json_contract_change_status: not_started

## Summary

`v2.6.18` chooses the next smallest feature candidate to keep watching. The
decision is not to implement anything yet. The only candidate worth a future
design sketch is Continuation Harness Lite, because it maps to the narrowest
observed uncertainty: how a receiver moves from inherited Context Pack material
through `check`, `resume`, and live recheck without treating the pack itself as
the current task.

Status, Workflow Runner, provider/runtime integration, MCP tools, hosted memory,
and JSON contract changes remain closed.

## Candidate Ranking

1. Continuation Harness Lite design sketch: keep watching.
2. Status command: reject for now.
3. Workflow Runner Lite: reject for now.
4. Doctor expansion: reject for now.
5. JSON contract change: reject for now.

## Why Continuation Harness Lite Is The Smallest Candidate

Continuation Harness Lite is the only candidate that directly matches the
current adoption evidence:

- It could narrow the human sequence from inherited Context Pack to live repo
  recheck.
- It could preserve the current `check`, `resume`, and `doctor` contracts.
- It could stay review-only and local without provider requests or runtime
  automation.
- It could make first-run handoff less confusing without creating an always-on
  Status surface.

The candidate is still not strong enough for implementation. It is only strong
enough to keep as a future design sketch if the same handoff friction repeats.

## Rejected For Now

- Status command: rejected because Doctor already provides conservative live
  repo comparison, and the current evidence does not justify an always-on status
  command.
- Workflow Runner Lite: rejected because the current evidence is about
  sequencing clarity, not automation.
- Doctor expansion: rejected because current Doctor semantics are stable enough
  and should not be stretched into Status.
- JSON contract change: rejected because the existing `check --input <dir>
  --json`, Resume, Doctor, and Export contracts still cover the observed
  adoption path.

## Entry Criteria Before Any Implementation

Do not implement Continuation Harness Lite unless all of these become true:

- At least three public-safe real handoffs show the same blocking or
  high-frequency confusing friction.
- The friction survives a docs/examples/release-check repair attempt.
- The failure is specifically about sequencing `context-pack -> check -> resume
  -> live recheck`.
- The future helper can remain review-only, local-first, public-safe, and
  contract-preserving.
- The future helper does not become Status, Workflow Runner, provider
  integration, hosted memory, daemon, watcher, or schema-v2.

## Current Decision

Keep developing evidence, not functionality. The next acceleration move should
be a real first-run/handoff validation pass. If that pass repeats the same
blocking or high-frequency confusing issue, draft a Continuation Harness Lite
design sketch. If it does not, continue with docs/examples/release-check polish.

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
