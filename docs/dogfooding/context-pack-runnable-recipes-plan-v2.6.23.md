# Context Pack Runnable Recipes Plan v2.6.23

status: local examples recipe enhancement, not a command or contract change

- plan_status: implemented
- recipe_status: documented
- release_closeout_status: not_started
- push_status: not_started
- tag_status: not_started
- release_status: not_started
- pr_status: not_started
- provider_probe_status=skipped
- command_status: unchanged
- package_script_status: unchanged
- json_contract_change_status: not_started
- context_pack_structure_status: unchanged

## Summary

`v2.6.23` turns the highest-value existing examples into more runnable
recipes. The goal is to reduce first-run and continuation friction by showing
the shortest existing command paths for minimal handoff review, Context Pack
Lite, Context Pack Doctor, and File-only Export.

This is a usability/documentation slice only. It does not add CLI behavior,
change release-check output, change package scripts, change JSON contracts,
or alter the Context Pack seven-file structure.

## Recipe Targets

The recipe pass covers these existing public examples:

```text
examples/minimal/README.md
examples/context-pack-lite/README.md
examples/context-pack-doctor/README.md
examples/file-only-export/README.md
```

The intended paths are:

- `README -> quickstart -> examples/minimal`, then `npm run check`.
- `context-pack -> check -> resume -> doctor`.
- `check -> doctor`.
- `check -> export`.

These recipes use only existing commands and existing files. They are not
generated scripts, not a new test runner, and not a new workflow command.

## Non-Goals / Protected Areas

- No new CLI command.
- No package script change.
- No release-check output shape change.
- No JSON contract change.
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
- No GitHub Actions CI in this slice.
- No npm publish, push, tag, release, or pull request.

## Verification

The local gate remains unchanged:

```text
npm run release-check
npm test
git diff --check
provider_probe_status=skipped
```

`npm run release-check` should continue to print existing metric lines such as
`mode_cases`, `checked_links`, `cli_lite_commands`, and
`independent_test_files`.

## Follow-Up Candidates

After this recipe pass, the next small candidates remain:

- first-run smoke path consolidation
- Context Pack output UX polish without JSON shape change
- test-file split planning

Keep Status, Workflow Runner, provider/runtime integration, MCP, plugin,
schema-v2, daemon, watcher, hosted memory, CI, and publish work behind
separate explicit gates.
