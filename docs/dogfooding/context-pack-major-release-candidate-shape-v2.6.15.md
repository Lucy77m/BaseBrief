# Context Pack Major-Release Candidate Shape v2.6.15

Date: 2026-06-09

This public-safe note shapes the local v2.6.x adoption bundle into a future
major-release candidate outline. It is release-candidate shape only, not a
release closeout, push, tag, release, pull request, command line, contract,
schema, Status command, Workflow Runner, Continuation Harness implementation,
runtime integration, provider request, MCP server, MCP tools, plugin, daemon,
watcher, hosted memory behavior, or feature implementation.

## Candidate Shape

```text
candidate_shape_status: draft_only
release_closeout_status: not_started
push_status: not_started
tag_status: not_started
release_status: not_started
provider_probe_status=skipped
```

If this local bundle later becomes part of a larger release, the public release
story should be:

- First-run adoption polish: quickstart, minimal path, starter wording, and
  2-5 minute run-through.
- Context Pack interpretation: clean, warning, stale, broken, live-recheck, and
  starter handoff scenarios.
- Diagnostics confidence: Check stays the pack validity gate, Resume stays the
  copyable prompt, and Doctor stays live repo comparison.
- Maintenance hardening: release-check protects public-safe docs and is less
  sensitive to Markdown wrapping.

## Keep In Dogfooding Evidence

These details should stay as evidence rather than front-page release notes:

- Per-slice v2.6.1 through v2.6.15 chronology.
- Individual local commit hashes.
- Private output paths or raw generated handoff contents.
- Detailed release-check assertion wording.
- Exploratory feature-gate reasoning that repeats the same conclusion.

## Release Note Draft

Future major release notes may reuse this concise shape:

```text
Context Pack adoption polish makes BaseBrief easier to try, continue, and
diagnose locally. The local bundle clarifies first-run commands, example
interpretation, inherited-context starter wording, Check vs Resume vs Doctor
roles, and release-check maintainability. It does not add hosted memory,
provider requests, runtime integration, MCP tools, Status, Workflow Runner,
Continuation Harness implementation, or JSON contract changes.
```

## Decision

This candidate shape is not enough to publish. It is a staging outline for a
larger version package after more local evidence and any future approved feature
work.

```text
publish_status: not_started
major_release_status: not_started
continuation_harness_lite_status: not_started
status_command_status: not_started
workflow_runner_status: not_started
json_contract_change_status: not_started
```

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
- No push, tag, release, npm publish, or pull request in this slice.

## Validation Gate

The local gate for this slice is:

```text
npm run release-check
npm test
git diff --check
```

When provider environment variables are absent, release checks must keep:

```text
provider_probe_status=skipped
```
