# Delta Receiver Usage Pack

This guide is the public-facing entry for the BaseBrief Delta Receiver line. It
does not add a new CLI command, JSON schema, command output format, provider
request, runtime integration, plugin, MCP, IDE, Auto Flow behavior, hosted
service, or schema-v2 work.

## What This Pack Is For

Use this guide when a receiver window already has a reviewed handoff or starter
prompt and needs one answer to three questions:

- what should I read first
- which receiver report shape should I copy
- when should I report `pass`, `difference_found`, or `blocked`

The pack keeps the existing machine fields stable:

- `receiver_task_status`
- `repository_state_status`
- `declared_checks_status`
- `handoff_acceptance`

It also keeps the existing human-facing anchors stable:

- `pass/fail`
- `wait for user confirmation`

## Minimum Read Order

1. Read the entry artifact that sent you here.
   - Delta continuity: refreshed ignored local `delta-handoff.md`
   - Starter continuity: reviewed `receiver-ready.md` or `new-window-starter.md`
2. Read this Usage Pack for routing and decision rules.
3. Copy the closest public-safe shape from
   `examples/receiver/usage-pack/README.md`.
4. If you need a starter-facing skeleton, copy
   `examples/receiver/usage-pack/starter-report-outline.md`.
5. If a checker rule is unclear, compare against
   `examples/receiver/lint/README.md`.
6. If you need the smallest fixed shape for a checker rule, compare against
   `examples/receiver/lint/repair/README.md`.
7. If you need the underlying contract details, read
   `docs/dogfooding/delta-receiver-report-kit-v1.2.md`.

## Decision Matrix

- Use `handoff_acceptance: pass` when entry verification completed and live
  branch, HEAD, and worktree facts match refreshed handoff facts. Human-facing
  anchor: `pass`.
- Use `handoff_acceptance: difference_found` when entry verification completed
  and a live mismatch was found. Human-facing `fail` can coexist with machine `difference_found`.
- Use `handoff_acceptance: blocked` only when necessary verification cannot be
  completed safely. Human-facing anchor is usually `fail`.

`difference_found` is a completed receiver outcome, not an execution failure.
`blocked` is reserved for unsafe paths, missing required state, or checks that
cannot be completed without breaking boundaries.

## Which Report Shape To Copy

Use the Delta report kit when the current task is Delta continuity acceptance:
compare inherited handoff facts with live repository state, then report the
fixed fields.

Use the golden-path starter report when the current task comes from
`new-window-starter.md` or another starter-facing continuity handoff and must
preserve `current_goal`, `receiver_entry_task`, `risk_boundaries`,
`declared_checks_status`, `pass/fail`, and `wait for user confirmation`.

The Delta report kit is documented in
`docs/dogfooding/delta-receiver-report-kit-v1.2.md`.

The golden-path starter report examples live in:

- `examples/golden-path/first-pass-receiver-report.md`
- `examples/golden-path/follow-up-receiver-report.md`

## Fact Layers

Every receiver report in this pack should keep these layers separate:

- source-window inherited facts
- live repo facts
- receiver-window rechecks

Do not rewrite inherited facts as if they were freshly rechecked. Do not
describe receiver-window rechecks as if they came from the source window.

## Historical Count Drift

Historical `commits_in_range` drift remains non-blocking when refreshed branch,
HEAD, and worktree facts still match live repository state. Historical dry-run
or pre-commit numbers can remain in public evidence as time-stamped facts from
the earlier run; current receiver acceptance should still key off refreshed
branch, HEAD, and worktree facts.

## Checker Coverage

v1.5 connects this receiver contract to the existing artifact checker.

Receiver-specific lint only applies to explicit receiver artifacts:

- receiver result JSON with
  `schemaVersion: basebrief-receiver-check-result-v1`
- starter-style Markdown that exposes receiver machine fields and starter
  report sections
- delta-style Markdown that exposes receiver machine fields and delta report
  sections

It does not activate on ordinary docs just because they mention field names.

Errors cover missing machine fields, missing required report sections, missing
starter `pass/fail`, missing `wait for user confirmation`, missing fact-layer
separation, and contradictory receiver result JSON.

Warnings cover missing `difference_found` semantics explanation and missing
non-blocking historical `commits_in_range` drift explanation.

For copyable examples of each pass, error, and warning family, use the receiver
lint fixture pack in `examples/receiver/lint/`.

For fixed replacement shapes after a receiver lint finding, use
`examples/receiver/lint/repair/`. Public-safe dogfooding evidence for the
fixture and repair packs is recorded in
`docs/dogfooding/delta-receiver-lint-dogfooding-v1.8.md`.

## Boundaries

- No provider request.
- No runtime integration.
- No plugin, MCP, IDE, hosted, or cloud-memory work.
- No schema-v2 work.
- No new CLI command.
- No new npm script.
- No machine-readable JSON schema.
- No command output format change.
- No Auto Flow.
- No push, tag, release, pull request, npm publish, or global CLI install.
- No raw private output copied into public docs.
- No `.env`, API key, token, credential, or secret content copied into public
  docs.

`provider_probe_status=skipped`
