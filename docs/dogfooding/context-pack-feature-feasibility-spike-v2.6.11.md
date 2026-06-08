# Context Pack Feature Feasibility Spike v2.6.11

Date: 2026-06-09

This public-safe spike evaluates whether BaseBrief should later consider
Continuation Harness Lite. It is a feasibility spike only, not a release
closeout, command line, contract, schema, Status command, Workflow Runner,
runtime integration, provider request, MCP server, MCP tools, plugin, daemon,
watcher, hosted memory behavior, or feature implementation.

```text
feature_candidate: Continuation Harness Lite
implementation_status: not_started
release_closeout_status: not_started
push_status: not_started
tag_status: not_started
release_status: not_started
provider_probe_status=skipped
```

## Feasibility Question

The only question for this spike is:

```text
Do real users need a narrower helper around context-pack -> check -> resume -> live recheck?
```

The current v2.6.x evidence says the existing flow can be explained with
docs/examples/release-check polish.
The candidate remains unimplemented until real handoffs repeatedly show the same blocking or high-frequency confusing friction after docs/examples repairs.

## Candidate Shape To Evaluate Later

If repeated evidence eventually justifies the feature, Continuation Harness Lite
should still be narrow:

- Help users remember the order: `context-pack -> check -> resume -> live recheck`.
- Keep `check` as the pack validity gate.
- Keep `resume` as the copyable next-window prompt surface.
- Keep `doctor` as live repo comparison, not always-on Status.
- Keep live recheck as an explicit receiver-window responsibility.

This spike does not define a command name, output format, JSON shape, schema, or runtime behavior.

## Not Implemented

This spike does not implement:

- Status.
- Workflow Runner.
- Workflow Runner Lite.
- Continuation Harness Lite.
- Provider request.
- Runtime integration.
- MCP server.
- MCP tools.
- Plugin.
- Schema-v2.
- Daemon.
- Watcher.
- Hosted memory.
- Automation platform behavior.

## Future Gate

Only open a feature implementation if multiple real handoffs reproduce the same
blocking or high-frequency confusing friction.

Potential qualifying evidence:

- Receiver windows repeatedly skip `check` before `resume` and continue broken
  packs.
- Receiver windows repeatedly treat inherited pack facts as current live state
  even after the starter says to live-recheck.
- Users repeatedly cannot decide when `doctor` is needed after reading the
  scenario matrix and example kits.
- Users repeatedly ask for a single narrow local helper because the manual chain
  remains confusing after docs/examples repairs.

Non-qualifying evidence:

- A general desire for orchestration.
- External agent articles mentioning memory, workflows, or harnesses.
- One-off nice-to-have friction.
- Release-prep pressure alone.

## Public Interface Boundaries

- No new CLI command.
- No Context Pack seven-file structure change.
- No `check --input <dir> --json` top-level shape change.
- No Resume JSON contract change.
- No Doctor JSON contract change.
- No Export JSON contract change.
- No Status command.
- No Workflow Runner.
- No provider request.
- No runtime integration.
- No MCP server.
- No MCP tools.
- No plugin.
- No schema-v2.
- No daemon.
- No watcher.
- No hosted memory.
- No push, tag, release, npm publish, or pull request in this spike.

## Validation Gate

The local gate for this spike is:

```text
npm run release-check
npm test
git diff --check
```

When provider environment variables are absent, release checks must keep:

```text
provider_probe_status=skipped
```
