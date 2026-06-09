# Context Pack Test-File Split Plan v2.6.26

status: local test maintainability plan only, not a test-runner or contract change

- plan_status: drafted
- implementation_status: not_started
- test_split_status: planned
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

`v2.6.26` plans the first safe path for splitting the large
`tests/basebrief.test.js` file. The current single test file still passes, but
its navigation pressure is now high enough that future feature and maintenance
work risks landing assertions in the wrong area.

This is a planning slice only. It does not split test files yet, change
`npm test`, change package scripts, change release-check output, change JSON
contracts, or alter the Context Pack seven-file structure.

## Current Test Clusters

The single test file currently mixes several clusters:

- docs and release-line assertions
- quickstart and minimal examples
- BB9 handoff, adapter, and artifact checker coverage
- CLI Lite command routing and human output
- Receiver init, Receiver Safe Check, Receiver Flow, and Review Draft coverage
- Project State and Sidecar coverage
- Delta Handoff, Context Pack Lite, Check, Resume, Doctor, Export, Seal/Diff,
  and ContextOps coverage
- cache-ready generators, provider benchmark summaries, and relay usage audit

## Recommended Split Order

The first implementation should move one coherent cluster at a time while
keeping helper behavior stable.

Recommended order:

1. Context Pack v2 tests, because they already form a late-file cluster around
   Context Pack Lite, Check, Resume, Doctor, Export, and related docs.
2. cache-ready and benchmark summary tests, because they have distinct helper
   dependencies and stable provider-boundary assertions.
3. Receiver and Project State workflow tests, only after the first two splits
   prove that shared fixture helpers can be reused without churn.
4. Docs/release-line assertions last, because they are broad and easiest to
   disturb accidentally.

## First Implementation Gate

Before moving any tests, the next slice should decide the exact helper shape:

- keep public helper names stable or local to the test files
- avoid changing fixture repository behavior
- avoid changing expected test names unless the move requires path-specific
  wording
- keep `npm test` as the user-facing gate
- preserve 175 passing tests unless a later implementation intentionally adds
  coverage

The likely first moved file is:

```text
tests/context-pack.test.js
```

That first split should move only Context Pack v2 and directly adjacent
File-only Export / Doctor tests if the shared helpers make the boundary cleaner.

## Non-Goals / Protected Areas

- No new CLI command.
- No package script change in this planning slice.
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

After this plan, the next useful slice is a minimal first split that extracts
Context Pack v2 tests while preserving the same `npm test` behavior. If that
split proves too noisy, keep the tests in one file and instead extract only
shared fixture helpers.
