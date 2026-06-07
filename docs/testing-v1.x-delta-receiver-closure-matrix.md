# v1.x Delta Receiver Closure Matrix

This matrix covers the public v1.x Delta Handoff / Receiver line.

## Shared Path

```text
delta-handoff.md -> receiver usage pack -> receiver report examples -> receiver lint fixtures -> repair references -> final receiver response
```

## v1.0 Delta Handoff

- Adds local `delta` output as reviewable handoff material.
- Keeps `basebrief-project-state-v1`, `basebrief-delta-handoff-v1`, and
  `basebrief-delta-baseline-v1` unchanged.
- Keeps `provider_probe_status=skipped` as the correct no-provider gate.

## v1.1 Delta Receiver Acceptance

- Defines receiver acceptance as a receiver contract, not an automated runtime.
- Requires live repository facts to stay separate from inherited handoff facts.
- Records both stale-handout `difference_found` and refreshed `pass` outcomes.

## v1.2 Delta Receiver Report Kit

- Adds public-safe Markdown/text receiver report examples.
- Keeps `pass`, `difference_found`, fact-layer separation, and historical drift
  semantics explicit.
- Does not add a report schema or command output format.

## v1.3 Delta Receiver Starter Integration

- Connects the report-kit fields to starter-facing receiver replies.
- Preserves human-facing `pass/fail` and `wait for user confirmation`.
- Keeps source-window inherited facts, live repo facts, and receiver-window
  rechecks separate.

## v1.4 Delta Receiver Usage Pack

- Adds `docs/receiver-usage-pack.md` as the concentrated receiver entry guide.
- Routes receivers among Delta pass, Delta `difference_found`, blocked,
  language-routing, and starter-facing examples.
- Keeps the line public-facing and documentation-only.

## v1.5 Delta Receiver Lint Mini

- Extends Artifact Checker for explicit receiver Markdown and
  `basebrief-receiver-check-result-v1` JSON.
- Keeps receiver lint shape-based rather than repository-wide keyword-based.
- Adds no new CLI command, schema, runtime, provider, plugin, MCP, IDE, or Auto
  Flow behavior.

## v1.6 Delta Receiver Lint Fixture Pack

- Adds clean, error, and warning fixtures for existing receiver lint rule
  families.
- Treats intentionally broken fixtures as learning inputs, not handoff copy
  targets.
- Verifies expected fixture status, severity, and rule IDs.

## v1.7 Delta Receiver Lint Repair Pack

- Adds fixed public-safe Delta Markdown, starter Markdown, and receiver result
  JSON references.
- Shows the smallest correct replacement shapes after receiver lint findings.
- Keeps checker behavior unchanged.

## v1.8 Delta Receiver Lint Dogfooding Evidence

- Records public-safe dogfooding over v1.6 fixtures, v1.7 repairs, and existing
  receiver examples.
- Records command shapes and checker summaries, not raw private output.
- Keeps fixed examples clean and intentional fixtures expected.

## v1.9 Delta Receiver Lint Discoverability / Adoption

- Routes public readers through usage pack -> usage-pack router -> lint
  fixtures -> repair references -> existing receiver examples.
- Makes fixture, repair, and existing receiver-example mapping easier to find.
- Adds no checker rule, rule family, CLI command, schema, or command output
  change.

## v1.9.1 Final Closure / Freeze

- Records the v1.x Delta Receiver line as locally closed and frozen for review.
- Adds this aggregate matrix and the final closure doc.
- Keeps future work out of provider, runtime, plugin, MCP, IDE, hosted,
  schema-v2, Auto Flow, and publication scope unless the user separately
  approves a new line.

## Standard Local Commands

```text
node scripts/run_release_checks.js
npm run check
git diff --check
```

## Shared Boundaries

- No provider request.
- No raw private output.
- No runtime integration.
- No schema-v2 work.
- No new CLI command.
- No command output format change.
- No checker rule change.
- No new rule family.
- No Auto Flow.
- No plugin, MCP, IDE, hosted, or cloud-memory work.
- No push, tag, release, pull request, npm publish, or global CLI install.
- `difference_found` remains a completed verification result, not an agent
  failure.
- Historical `commits_in_range` drift remains non-blocking when refreshed
  branch, HEAD, and worktree facts still match live repository state.
- `cache-ready` remains experimental and is not part of the default receiver
  path.

When provider environment variables are absent, release checks must keep
`provider_probe_status=skipped`.
