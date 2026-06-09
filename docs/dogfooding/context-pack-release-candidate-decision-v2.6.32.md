# Context Pack Release-Candidate Direction Decision v2.6.32

status: local release-candidate direction decision only, not a release closeout or product change

- release_candidate_status: decision_ready_not_published
- local_bundle_status: ahead_28_compressed
- v2_7_implementation_status: deferred_until_after_release_candidate_decision
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
- continuation_harness_lite_status: future_candidate_only
- status_command_status: not_started
- workflow_runner_status: not_started

## Summary

`v2.6.32` chooses the release-candidate decision path after the local v2.6.x
closeout gate. This is a local direction decision, not a release closeout, not a
publish action, and not a product behavior change.

The current ahead-28 local bundle is ready to be compressed into a release
candidate story before any v2.7 implementation begins. The decision is:

- keep the current bundle as `decision_ready_not_published`
- defer v2.7 implementation until this release-candidate decision explains the
  remaining user-facing gap
- do not continue adding small v2.6.x adoption notes unless they directly
  support release-candidate readiness or the next v2.7 gate

## Bundle Compression

Future release-note candidates:

- First-run and adoption polish that makes the Context Pack path easier to
  follow.
- Runnable example recipes for minimal, Context Pack Lite, Doctor, and
  File-only Export usage.
- First-run smoke path consolidation from README and quickstart into examples.
- Context Pack output UX wording that tells receivers to recheck live repo facts
  and separate inherited pack facts from live rechecks.
- Test-file split and release-check maintainability work that improves local
  confidence without changing public command behavior.

Dogfooding-only evidence:

- Per-slice adoption notes, scenario matrices, fixture labs, paper rehearsals,
  and local bundle reviews.
- The detailed Continuation Harness Lite design sketch and paper rehearsal.
- The v2.6.x closeout gate and this direction decision.
- Internal assertion wording, chronology details, and local ahead-count evidence.

Release-check / contract protections:

- Required-file coverage for v2.6.x dogfooding records.
- Documentation assertions for index, testing, roadmap, and example recipe
  surfaces.
- Release-check helper grouping for v2.x docs and v2.6.x dogfooding assertions.
- Three independent test files with expected test count still 175 tests and
  `independent_test_files=3`.

Deferred feature gates:

- Continuation Harness Lite implementation.
- Status command.
- Workflow Runner.
- Doctor expansion.
- Provider request.
- Runtime integration.
- MCP server.
- MCP tools.
- Plugin.
- Schema-v2.
- Daemon.
- Watcher.
- Hosted memory.

## Decision

Release-candidate decision work should happen before v2.7 implementation. The
local bundle is coherent enough to evaluate as a release candidate, but no
public release action starts in this slice.

The recommended next step after this document is either:

- prepare a public release-candidate summary from the release-note candidates,
  with dogfooding-only details kept out of front-page release notes
- if release-candidate review finds a concrete user-facing gap, open a narrow
  v2.7 implementation plan using existing commands and contracts

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
- No GitHub Actions CI in this slice.
- No npm publish, push, tag, release, or pull request.

## Verification

The local decision gate remains:

```text
npm run release-check
npm test
git diff --check
provider_probe_status=skipped
```

`npm run release-check` should continue to print existing metric lines such as
`mode_cases`, `checked_links`, `cli_lite_commands`, and
`independent_test_files`.
