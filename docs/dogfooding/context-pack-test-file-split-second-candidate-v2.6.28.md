# Context Pack Test-File Split Second Candidate v2.6.28

status: local test maintainability planning, not a test-runner or contract change

- plan_status: drafted
- implementation_status: not_started
- test_split_status: candidate_selected
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

`v2.6.28` reviews the two-file baseline after `v2.6.27` and selects the next
test-file split candidate. This is a planning and gate slice only. It does not
move tests, add a new test file, change `npm test`, change release-check output,
change JSON contracts, or alter the Context Pack seven-file structure.

The current baseline remains:

```text
node --test tests/basebrief.test.js tests/context-pack.test.js
```

Expected test count remains 175 tests. `npm run release-check` should continue
to report `independent_test_files=2` and `provider_probe_status=skipped`.

## Evidence From Current Test Layout

`tests/context-pack.test.js` now contains the coherent Context Pack v2 cluster:
Context Pack Lite, Check, Resume, File-only Export, Doctor, and directly
adjacent runtime coverage.

`tests/basebrief.test.js` still contains several broad clusters. The clearest
second split candidate is the cache-ready, benchmark summary, and relay usage
audit cluster near the tail of the file. It includes cache-ready generators,
capsule, anchor, anchor pad, prompt variants, benchmark summaries, provider
profiles, and relay usage audit assertions.

## Second Candidate Decision

Selected second candidate:

```text
tests/cache-ready-benchmark.test.js
```

Recommended moved scope:

- cache-ready generator stability tests
- cache-ready capsule, anchor, and anchor pad tests
- benchmark prompt variant tests
- handoffPoc, activePromptPoc, activePromptTrimPoc, bb12GuardPoc summary tests
- provider profile assertions
- relay usage audit assertions

The next implementation slice should keep helper movement minimal. If shared
helpers become awkward, keep the tests in `tests/basebrief.test.js` and record
that the second split gate is deferred.

## Deferred Clusters

Receiver, Project State, Sidecar, and docs/release-line assertion splits remain
deferred. They are broader, fixture-heavy clusters and should wait until the
Context Pack and cache-ready splits prove the multi-file baseline is stable.

## Non-Goals / Protected Areas

- No new CLI command.
- No new test file in this planning slice.
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
