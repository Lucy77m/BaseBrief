# Context Pack Cache-Ready Benchmark Test Split v2.6.29

status: local test maintainability implementation, not a product or contract change

- plan_status: implemented
- implementation_status: completed
- test_split_status: completed
- release_closeout_status: not_started
- push_status: not_started
- tag_status: not_started
- release_status: not_started
- pr_status: not_started
- provider_probe_status=skipped
- command_status: unchanged
- package_script_status: updated_for_test_entry_only
- json_contract_change_status: not_started
- context_pack_structure_status: unchanged

## Summary

`v2.6.29` implements the second test-file split selected in `v2.6.28`.
Cache-ready generators, provider-profile coverage, benchmark prompt variants,
benchmark summaries, and relay usage audit tests now live in:

```text
tests/cache-ready-benchmark.test.js
```

The public validation entry remains `npm test`. The package script now runs
three independent test files through Node's built-in test runner:

```text
node --test tests/basebrief.test.js tests/context-pack.test.js tests/cache-ready-benchmark.test.js
```

This is a test maintainability slice only. It does not add CLI behavior, change
release-check output shape, change JSON contracts, alter the Context Pack
seven-file structure, or change `check --input <dir> --json`.

## Moved Test Scope

The second split moved these tests as one coherent cluster:

- cache-ready generator stability and required-field coverage
- cache-ready capsule v2 coverage
- cache-ready anchor v3 and anchor pad v4 coverage
- benchmark prompt variant coverage for anchorpad, readablePoc, sidecar, hybrid,
  blockpad, and blockalign
- BB9 handoff generator and provider-profile coverage
- BB10 active prompt, BB11 trim, and BB12 guard prompt coverage
- handoffPoc, activePromptPoc, activePromptTrimPoc, and bb12GuardPoc benchmark
  summary coverage
- benchmark summary coverage for absolute, normalized, capsule, anchor,
  anchorpad, padSweep, readablePoc, sidecar, hybrid, blockpad, and blockalign
- provider profile and relay usage audit coverage

`tests/basebrief.test.js` keeps broader release-line, quickstart, handoff,
adapter, artifact checker, CLI Lite, Receiver, Project State, Sidecar, Delta,
Seal/Diff, ContextOps, template, and receiver-ready coverage.

`tests/context-pack.test.js` keeps Context Pack v2, File-only Export, Doctor,
and Resume coverage.

## Non-Goals / Protected Areas

- No new CLI command.
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

Expected test count remains 175 tests. `npm run release-check` should continue
to print existing metric lines such as `mode_cases`, `checked_links`,
`cli_lite_commands`, and `independent_test_files`; `independent_test_files`
should now report `3`.

## Follow-Up Candidates

The next useful slice is a post-split stability check. It should verify that
the three-file baseline lowers navigation pressure before deciding whether to
split Receiver, Project State, Sidecar, or docs/release-line assertions.
