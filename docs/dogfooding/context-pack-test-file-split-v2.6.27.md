# Context Pack Test-File Split v2.6.27

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

`v2.6.27` implements the first test-file split planned in `v2.6.26`.
Context Pack v2, File-only Export, Doctor, and Resume tests now live in
`tests/context-pack.test.js`; the rest of the suite remains in
`tests/basebrief.test.js`.

The public validation entry remains `npm test`. The package script now runs
both independent test files through Node's built-in test runner:

```text
node --test tests/basebrief.test.js tests/context-pack.test.js
```

This is a test maintainability slice only. It does not add CLI behavior, change
release-check output shape, change JSON contracts, alter the Context Pack
seven-file structure, or change `check --input <dir> --json`.

## Moved Test Scope

The first split moved these tests as one coherent cluster:

- v2.0.0 Context Pack Lite docs/example closeout
- v2.1.0 Context Pack Check closeout
- v2.2.0 Context Pack Resume contract
- v2.3.0 BaseBrief Format contract
- v2.4.0 File-only Export plan, closeout, example, and runtime coverage
- v2.5.0 Context Pack Doctor plan, closeout, example, and runtime coverage
- Context Pack Lite generation
- Context Pack Check validation
- Context Pack Resume prompt generation

`tests/basebrief.test.js` keeps broader release-line, receiver, project state,
sidecar, delta, Seal/Diff, ContextOps, cache-ready, benchmark, and relay audit
coverage.

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
should now report `2`.

## Follow-Up Candidates

The next split candidate is cache-ready and benchmark summary tests. Defer
Receiver, Project State, Sidecar, and docs/release-line assertion splits until
the two-file test baseline proves stable.
