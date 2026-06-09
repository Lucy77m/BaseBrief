# Context Pack Output UX Polish v2.6.25

status: local output UX polish only, not a command or contract change

- plan_status: implemented
- output_ux_status: documented
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

`v2.6.25` polishes the generated Context Pack Lite text so a receiver window
can interpret the seven-file bundle with less ambiguity. The change is limited
to human-facing wording in `MANIFEST.md`, `RECEIVER_STATE.md`, and
`NEXT_WINDOW_STARTER.md`.

This is an output UX polish slice only. It does not add CLI behavior, change
package scripts, change release-check output, change JSON contracts, or alter
the Context Pack seven-file structure.

## Output Polish

The polished output clarifies three receiver-facing points:

- live repo facts are stale-prone and must be rechecked before edits
- `not_available`, `not_applicable`, and `needs-review` are missing-input semantics, not failure states
- the expected first response must report live repo facts, separate inherited
  pack facts from live rechecks, and list gaps before implementation

The public example under `examples/context-pack-lite/` mirrors this generator
wording closely enough to stay useful as a public-safe shape reference.

## Non-Goals / Protected Areas

- No new CLI command.
- No package script change.
- No release-check output shape change.
- No Context Pack seven-file structure change.
- No `check --input <dir> --json` top-level shape change.
- No Resume JSON contract change.
- No Doctor JSON contract change.
- No Export JSON contract change.
- No Status command.
- No Workflow Runner.
- No Doctor expansion.
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

After this output UX pass, the next small candidates remain:

- test-file split planning
- major-release candidate compression of local v2.6.x material
- release-check helper extraction only if the current grouping keeps proving useful

Keep Status, Workflow Runner, Doctor expansion, provider/runtime integration,
MCP, plugin, schema-v2, daemon, watcher, hosted memory, CI, and publish work
behind separate explicit gates.
