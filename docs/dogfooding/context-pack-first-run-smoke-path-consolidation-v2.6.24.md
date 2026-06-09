# Context Pack First-Run Smoke Path Consolidation v2.6.24

status: local first-run path consolidation, not a command or contract change

- plan_status: implemented
- smoke_path_status: documented
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

`v2.6.24` consolidates the first-run smoke path after the runnable recipes
pass. The goal is to make the initial route obvious before a new user drops
into historical release notes, optional diagnostics, or advanced handoff
flows.

The canonical first-run smoke path is:

```text
README -> docs/index.md -> docs/quickstart-5min.md -> examples/minimal -> examples/context-pack-lite
npm run check
```

This is a documentation and example usability slice only. It does not add CLI
behavior, change package scripts, change release-check output, change JSON
contracts, or alter the Context Pack seven-file structure.

## Path Roles

- `README.md` gives the short product promise and points to the smoke path.
- `docs/index.md` separates first-run docs from archives and advanced topics.
- `docs/quickstart-5min.md` is the canonical first-run guide.
- `examples/minimal/README.md` is the manual Lite handoff smoke.
- `examples/context-pack-lite/README.md` is the first Context Pack smoke.
- `npm run check` is the local validation gate after reading or trying the
  recipe.

The path intentionally keeps Doctor and File-only Export as follow-up recipes,
not mandatory first-run steps.

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

After this consolidation, the next small candidates remain:

- Context Pack output UX polish without JSON shape change
- test-file split planning
- major-release candidate compression of local v2.6.x material

Keep Status, Workflow Runner, Doctor expansion, provider/runtime integration,
MCP, plugin, schema-v2, daemon, watcher, hosted memory, CI, and publish work
behind separate explicit gates.
