# Context Pack Release-Check Maintainability v2.6.14

Date: 2026-06-09

This public-safe maintenance note repairs release-check fragility observed while
editing v2.6.x adoption notes. It is a local release-check maintainability
repair, not a release closeout, push, tag, release, pull request, command line,
contract, schema, Status command, Workflow Runner, Continuation Harness
implementation, runtime integration, provider request, MCP server, MCP tools,
plugin, daemon, watcher, hosted memory behavior, or feature implementation.

## Repair

```text
repair_status: implemented
repair_scope: release-check whitespace-normalized phrase matching
release_closeout_status: not_started
push_status: not_started
tag_status: not_started
release_status: not_started
provider_probe_status=skipped
```

The repair adds a release-check helper for whitespace-normalized phrase
matching. It is intended for long prose assertions where Markdown wrapping
should not change the contract.

Use it for prose contracts such as:

- `not a release closeout, feature implementation, CLI behavior change`
- `context-pack -> check -> resume -> live recheck`
- `local adoption sedimentation, not a frequent release line`

Do not use it to weaken exact technical literals such as rule IDs, command
names, contract versions, JSON keys, or status values.

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
