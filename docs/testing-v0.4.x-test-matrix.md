# BaseBrief v0.4.x Test Matrix

Purpose: validate BaseBrief v0.4.x as a local handoff toolchain before adding v0.5.0
guided draft behavior.

This matrix records public-safe test intent and summarized results only. Raw local
outputs belong in an ignored local sandbox, not in this repository.

## Matrix

| ID | Wave | Module | Scenario | Expected | Current Result |
|---|---|---|---|---|---|
| T001 | 1 | npm | `npm test` | all local tests pass | tracked by release check |
| T002 | 1 | release | `npm run release-check` | release gate passes | tracked by release check |
| T003 | 1 | npm | `npm run check` | test and release-check pass | tracked by release check |
| T004 | 1 | cli | all CLI help entries | help prints without uncaught error | covered by local CLI tests |
| T005 | 2 | path | Unicode and space paths | receiver-flow writes draft safely | covered by local unit test |
| T006 | 2 | repo-state | no git repository | receiver-flow fails with clear repository error | covered by local unit test |
| T007 | 2 | repo-state | detached HEAD | receiver checks keep detached sentinel stable | covered by local unit test |
| T008 | 2 | artifact | broken Markdown and unusual characters | checker does not crash or invent findings | covered by local unit test |
| T009 | 2 | artifact | skipped noisy directories | checker skips configured noise directories | covered by local unit test |
| T010 | 2 | security | fake GitHub token | checker blocks the fake secret pattern | covered by local unit test |
| T011 | 2 | security | fake AWS key | checker blocks the fake secret pattern | covered by local unit test |
| T012 | 2 | security | fake Slack token | checker blocks the fake secret pattern | covered by local unit test |
| T013 | 2 | security | fake Google API key | checker blocks the fake secret pattern | covered by local unit test |
| T014 | 2 | security | fake private key block | checker blocks the fake secret pattern | covered by local unit test |
| T015 | 2 | scale | 100 / 1000 / 5000 file fixture tiers | commands complete without scanning ignored noise | local private smoke passed |
| T016 | 3 | dogfooding | BaseBrief self handoff | draft shows missing human fields clearly | public-safe summary only |
| T017 | 3 | runner | OpenCode availability | runner can be probed without writing secrets | executable and config presence confirmed |
| T018 | 3 | runner | Claude Code availability | runner is included only after a stable probe | pending |

## External Runner Rules

- External runner tests may use temporary process-level provider env vars.
- Test keys must not be written to files, logs, public docs, or committed output.
- Public records may mention runner class, command shape, and outcome category.
- Public records must not include private absolute paths, raw prompts, raw completions, or tool-internal traces.

## v0.4.1 Closure Criteria

- `git diff --check` has no whitespace errors.
- `node --test tests/basebrief.test.js` passes.
- `node scripts/run_release_checks.js` passes with `provider_probe_status=skipped` when provider env vars are absent.
- `npm run check` passes.
- Artifact Checker reports zero errors and warnings for new public v0.4.x documents.
