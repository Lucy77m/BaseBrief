# Context Pack Test Split Stability Check v2.6.30

status: local test maintainability stability check, not a product or contract change

- plan_status: implemented
- implementation_status: completed
- test_split_status: stable_three_file_baseline
- receiver_project_state_split_status: deferred
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

`v2.6.30` checks the three-file test baseline after the Context Pack and
cache-ready benchmark splits. This is a stability and gate slice only. It does
not move tests, add a new test file, change `npm test`, change release-check
output, change JSON contracts, or alter the Context Pack seven-file structure.

The current public validation entry remains:

```text
node --test tests/basebrief.test.js tests/context-pack.test.js tests/cache-ready-benchmark.test.js
```

Expected test count remains 175 tests. `npm run release-check` should continue
to report `independent_test_files=3` and `provider_probe_status=skipped`.

## Current Test File Distribution

- `tests/basebrief.test.js`: 118 tests
- `tests/context-pack.test.js`: 11 tests
- `tests/cache-ready-benchmark.test.js`: 46 tests

The split now separates three distinct maintenance areas:

- broad release-line, quickstart, handoff, adapter, artifact checker, CLI Lite,
  Receiver, Project State, Sidecar, Delta, Seal/Diff, ContextOps, template, and
  receiver-ready coverage
- Context Pack v2, File-only Export, Doctor, and Resume coverage
- cache-ready generators, benchmark prompt variants, benchmark summaries,
  provider profiles, and relay usage audit coverage

## Stability Decision

The three-file baseline is useful enough to keep. It lowers navigation pressure
without changing behavior or contracts.

Do not immediately split Receiver, Project State, Sidecar, or docs/release-line
assertions. Those clusters are broader and fixture-heavy, and should wait until
the current three-file baseline proves stable across more local slices.

## Non-Goals / Protected Areas

- No new CLI command.
- No new test file in this stability slice.
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

The local gate remains:

```text
npm run release-check
npm test
git diff --check
provider_probe_status=skipped
```

`npm run release-check` should continue to print existing metric lines such as
`mode_cases`, `checked_links`, `cli_lite_commands`, and
`independent_test_files`.
