# BaseBrief 测试矩阵

## 命令

使用 Node 运行：

```text
node scripts/run_release_checks.js
```

独立逻辑测试：

```text
node --test tests/basebrief.test.js
```

本地快捷入口：

```text
npm test
npm run release-check
npm run check
```

这些 npm scripts 只包装上面的本地 Node 命令；它们不表示 BaseBrief 已成为发布 npm package 或安装式 CLI。

## v0.9.0 Integrated Handoff Readiness Candidate

`v0.9.0` is a public hardening line for the integrated local handoff path:
receiver-ready handoff -> Project State -> Sidecar bundle -> receiver first
response. It adds no provider request, runtime integration, schema change, Auto
Flow, Web UI, plugin/platform work, published npm package, global CLI, v1.0
claim, cross-provider cache claim, or real billing audit claim.

This candidate keeps the v0.8.x Sidecar receiver closure connected to the
readiness docs and release checks. Expected release-check output without
provider env remains:

```text
provider_probe_status=skipped
```

## v0.9.1 Golden Path Closure Candidate

`v0.9.1` is a docs/usability hardening patch on top of the `v0.9.0` readiness
line. It keeps the same integrated local path:
receiver-ready.md -> state-init/state-advance -> sidecar-build ->
sidecar-check -> new-window-starter.md -> receiver first response.

This patch adds one public `Integrated Handoff Golden Path` guide and keeps the
receiver first-response contract explicit: restate key fields, report
`pass/fail`, and wait for confirmation. It adds no new command, no provider
request, no runtime integration, no schema change, and no Auto Flow behavior.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v0.9.2 Golden Path Example Closure Candidate

`v0.9.2` is an example-driven usability patch on top of the `v0.9.1` golden
path line. It keeps the same integrated local path:
receiver-ready.md -> state-init/state-advance -> sidecar-build ->
sidecar-check -> new-window-starter.md -> receiver first response.

This patch adds a public-safe example kit for first-pass and follow-up usage:
reviewed handoff shape, Project State shape reference, receiver first response
examples, and an explicit boundary note that raw Sidecar output still belongs
in ignored private directories. It adds no new command, no provider request,
no runtime integration, no schema change, and no Auto Flow behavior.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v0.9.3 Final Closure / Freeze Candidate

`v0.9.3` closes the public `v0.9.x` line without adding a new command,
schema, provider request, runtime line, or Auto Flow behavior.

This patch treats the release line as one closed summary:
`v0.9.0` define, `v0.9.1` guide, `v0.9.2` example, `v0.9.3` close/freeze.
It adds [the v0.9.x Integrated Handoff Closure Matrix](testing-v0.9.x-test-matrix.md)
and aligns the roadmap/current-cycle wording with that closed line.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v1.0 Delta Handoff RC Candidate

`v1.0.0` adds a local Delta Handoff line: `delta` reads current Project State,
git range facts, changed-file facts, and Seal/Diff state changes to write a
reviewable `delta-handoff.md`.

This candidate includes the adopted planning baseline, the Delta Handoff spec,
a public-safe delta example, CLI Lite `delta`, and fresh receiver dogfooding.
It keeps `basebrief-project-state-v1` unchanged and does not add provider
requests, runtime integration, plugin, MCP, IDE, schema-v2, Auto Flow, hosted
service, global CLI, or npm publishing.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v1.0 Delta Handoff Fresh Receiver Dogfooding

The first v1.0 Delta Handoff fresh receiver check is recorded in
[Delta Handoff Fresh Receiver Dogfooding v1.0](dogfooding/delta-handoff-fresh-receiver-v1.0.md).

The receiver checked `delta-handoff.md`, the adopted v1.0 planning baseline,
and `git status --short --branch` in read-only mode. It did not rerun the
source-window test suite and did not write files. The acceptance result was:

```text
receiver_task_status: completed
repository_state_status: match
handoff_acceptance: pass
blocking_or_repair_notes: none
```

This evidence supports the Phase 3 goal that a fresh window can restate the
current goal, key decisions, risk boundaries, recent changes, and a narrow next
implementation slice without widening into provider, runtime, plugin, MCP, IDE,
or schema-v2 work.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v1.0 Delta Handoff Baseline-Advance Dogfooding

The baseline-advance closure is recorded in
[Delta Handoff Baseline-Advance Dogfooding v1.0](dogfooding/delta-handoff-baseline-advance-v1.0.md).

This evidence uses one real local repo lifecycle:

- first `delta --advance-baseline` writes `.basebrief/delta-baseline.json`
- second `delta` becomes baseline-present instead of `baseline_source: missing`
- second delta may still report `commits_in_range: 0` and `stateDiff.status: unchanged`
  when no reviewed-state or commit baseline change happened between runs

It keeps `.basebrief/` local-only, keeps `basebrief-project-state-v1`
unchanged, does not rerun source-window tests in the receiver thread, and does
not widen into provider, runtime, plugin, MCP, IDE, or schema-v2 work.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v1.1 Delta Receiver Acceptance Local Closeout

`v1.1.0` closes the local Delta Receiver Acceptance line. It does not add a new
CLI command, schema, provider request, runtime integration, plugin, MCP, IDE,
Auto Flow behavior, hosted service, global CLI, or npm publishing.

The closeout records that stale inherited handoff facts produced
`handoff_acceptance: difference_found`, while a refreshed ignored local
`delta-handoff.md` matched live repository state and produced
`handoff_acceptance: pass`.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v1.2 Delta Receiver Report Kit Plan

`v1.2.0` keeps the Delta Receiver line local-first and review-based by turning
the v1.1 acceptance discipline into a small Markdown/text report kit. It does
not add a CLI command, JSON schema, command output format, provider request,
runtime integration, plugin, MCP, IDE, Auto Flow behavior, hosted service,
global CLI, or npm publishing.

The report kit records the fixed receiver report fields, `pass` and
`difference_found` examples, source-window inherited facts versus
receiver-window rechecks, and non-blocking historical `commits_in_range` drift.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v1.2 Delta Receiver Report Kit Local Closeout

`v1.2.0` locally closes the Delta Receiver Report Kit line. It keeps the work as
a Markdown/text report kit and does not add a CLI command, JSON schema, command
output format, provider request, runtime integration, plugin, MCP, IDE, Auto
Flow behavior, hosted service, global CLI, or npm publishing.

The closeout keeps the fixed receiver report fields, public-safe `pass` and
`difference_found` examples, source-window inherited facts versus
receiver-window rechecks, and non-blocking historical `commits_in_range` drift.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v1.3 Delta Receiver Starter Integration Plan

`v1.3.0` is the recommended next planning direction after v1.2. It should
connect the v1.2 report kit into starter-facing docs and examples without adding
provider requests, runtime integration, plugins, MCP, IDE, schema-v2 work, new
CLI commands, JSON schemas, command output changes, or Auto Flow behavior.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v1.3 Delta Receiver Starter Integration Local Closeout

`v1.3.0` locally closes the Delta Receiver Starter Integration line. It keeps
the work in starter-facing docs, golden-path examples, and the copyable
receiver starter contract without adding provider requests, runtime integration,
plugins, MCP, IDE, schema-v2 work, new CLI commands, JSON schemas, command
output changes, or Auto Flow behavior.

The closeout keeps human-facing `pass/fail`, `wait for user confirmation`, and
`declared_checks_status`, while connecting the v1.2 report-kit fields
`current_goal`, `live_repo_state`, `inherited_fact_differences`,
`hard_boundaries`, and `next_narrow_slice` to starter-facing examples. It also
keeps source-window inherited facts, live repo facts, and receiver-window
rechecks separate, and treats historical `commits_in_range` drift as
non-blocking when refreshed branch, HEAD, and worktree facts still match.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v1.4 Delta Receiver Usage Pack Plan

`v1.4.0` is the recommended next planning direction after v1.3. It should
collect the Delta Receiver line into one public usage guide, one example
router, and one copyable starter outline without adding a CLI command, JSON
schema, command output format, provider request, runtime integration, plugin,
MCP, IDE, Auto Flow behavior, hosted service, or npm publication.

The plan keeps `receiver_task_status`, `repository_state_status`,
`declared_checks_status`, and `handoff_acceptance` stable while preserving
`pass/fail`, `wait for user confirmation`, source-window inherited facts, live
repo facts, receiver-window rechecks, and non-blocking historical
`commits_in_range` drift.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v1.4 Delta Receiver Usage Pack Local Closeout

`v1.4.0` locally closes the Delta Receiver Usage Pack line. It keeps the work
as a public-facing guide, example router, and copyable outline without adding a
CLI command, JSON schema, command output format, provider request, runtime
integration, plugin, MCP, IDE, Auto Flow behavior, hosted service, or npm
publication.

The closeout adds `docs/receiver-usage-pack.md`,
`examples/receiver/usage-pack/README.md`, and
`examples/receiver/usage-pack/starter-report-outline.md`. It routes receivers
between Delta `pass`, Delta `difference_found`, `blocked`, language-routing,
and golden-path first-pass or follow-up examples without duplicating raw
example bodies.

The local validation gate for this closeout is:

```text
node scripts/basebrief.js check --input docs/receiver-usage-pack.md --json
node scripts/basebrief.js check --input examples/receiver/usage-pack --json
node scripts/run_release_checks.js
npm run check
git diff --check
```

Historical `commits_in_range` drift remains non-blocking when refreshed branch,
HEAD, and worktree facts still match live repository state. Human-facing `fail`
can coexist with machine `difference_found` when the receiver completed entry
verification and accurately reported a mismatch.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v1.5 Delta Receiver Lint Mini Plan

`v1.5.0` is the recommended next planning direction after v1.4. It should
connect the receiver report contract to the existing artifact checker without
adding a new CLI command, JSON schema, command output format, provider request,
runtime integration, plugin, MCP, IDE, Auto Flow behavior, hosted service, or
npm publication.

The plan keeps explicit receiver detection narrow: receiver result JSON,
starter-style receiver Markdown, and delta-style receiver Markdown only. Core
contract gaps become errors; missing `difference_found` or historical drift
explanations become warnings.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v1.5 Delta Receiver Lint Mini Local Closeout

`v1.5.0` locally closes the Delta Receiver Lint Mini line. It extends the
existing artifact checker so explicit receiver Markdown/text reports and
`basebrief-receiver-check-result-v1` JSON outputs can fail on missing receiver
contract pieces without changing schema, CLI shape, or runtime scope.

The closeout adds receiver-specific rule families for missing machine fields,
missing report sections, missing starter anchors, missing fact-layer
separation, invalid result consistency, missing `difference_found` semantics,
and missing non-blocking historical `commits_in_range` drift explanation.

The local validation gate for this closeout is:

```text
node scripts/basebrief.js check --input examples/receiver/language-routing/receiver-report.md --json
node scripts/basebrief.js check --input examples/receiver/difference-found/receiver-check-result.json --json
node scripts/run_release_checks.js
npm run check
git diff --check
```

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v1.6 Delta Receiver Lint Fixture Pack Plan

`v1.6.0` is the recommended next planning direction after v1.5. It should turn
the receiver lint line into a public fixture pack that is easy to learn, copy,
and explain without adding commands, schemas, command output changes, provider
requests, runtime integration, plugins, MCP, IDE work, hosted service, or npm
publication.

The fixture pack lives in `examples/receiver/lint/` and covers one clean pass,
five error families, and two warning-only families. Expected release checks
verify both the clean fixture and the intentionally broken fixtures.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v1.6 Delta Receiver Lint Fixture Pack Local Closeout

`v1.6.0` locally closes the Delta Receiver Lint Fixture Pack line. It adds the
public-safe `examples/receiver/lint/` guide and fixtures without changing
checker rules, CLI commands, schemas, command output, provider behavior,
runtime behavior, plugins, MCP, IDE work, hosted service, Auto Flow behavior,
or publication scope.

The closeout verifies one clean fixture, five error fixtures, and two
warning-only fixtures through release checks and independent tests. Expected
release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v1.7 Delta Receiver Lint Repair Pack Plan

`v1.7.0` is the recommended next planning direction after v1.6. It should add
public-safe repair guidance for receiver lint rule families without changing
checker rules, CLI commands, schemas, command output, provider behavior,
runtime behavior, plugins, MCP, IDE work, hosted service, Auto Flow behavior,
or publication scope.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v1.7 Delta Receiver Lint Repair Pack Local Closeout

`v1.7.0` locally closes the Delta Receiver Lint Repair Pack line. It adds
`examples/receiver/lint/repair/` with fixed Delta Markdown, starter Markdown,
and receiver result JSON references. The fixed examples must pass Artifact
Checker with zero findings.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v1.8 Delta Receiver Lint Dogfooding Evidence Plan

`v1.8.0` is the recommended next planning direction after v1.7. It should record
public-safe dogfooding evidence for the receiver lint fixture and repair packs
without changing checker rules, CLI commands, schemas, command output,
provider behavior, runtime behavior, plugins, MCP, IDE work, hosted service,
Auto Flow behavior, or publication scope.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v1.8 Delta Receiver Lint Dogfooding Evidence Local Closeout

`v1.8.0` locally closes the Delta Receiver Lint Dogfooding Evidence line. It
records public-safe command shapes, checker expectations, and friction notes in
`docs/dogfooding/delta-receiver-lint-dogfooding-v1.8.md` without copying raw
private output.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v1.9 Delta Receiver Lint Discoverability / Adoption Plan

`v1.9.0` is the recommended next planning direction after v1.8. It should make
the existing fixture, repair, dogfooding, and receiver example surfaces easier
to find and copy in the right order without adding checker rules, rule
families, CLI commands, schemas, command output changes, provider behavior,
runtime behavior, plugins, MCP, IDE work, hosted service, Auto Flow behavior,
or publication scope.

The adoption path is:

```text
docs/receiver-usage-pack.md
examples/receiver/usage-pack/README.md
examples/receiver/lint/README.md
examples/receiver/lint/repair/README.md
existing receiver examples
```

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v1.9 Delta Receiver Lint Discoverability / Adoption Local Closeout

`v1.9.0` locally closes the Delta Receiver Lint Discoverability / Adoption
line. It records the public read order from usage pack to example router to
lint fixtures to repair references to existing receiver examples.

The closeout keeps this as navigation and adoption polish only: no checker
rules, rule families, CLI commands, schemas, command output changes, provider
behavior, runtime behavior, plugins, MCP, IDE work, hosted service, Auto Flow
behavior, or publication scope.

The local validation gate for this closeout is:

```text
node scripts/run_release_checks.js
npm run check
git diff --check
```

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v1.9.1 Delta Receiver Final Closure / Freeze

`v1.9.1` closes and freezes the public v1.x Delta Handoff / Receiver line for
local release review. It adds
[the v1.x Delta Receiver Closure Matrix](testing-v1.x-delta-receiver-closure-matrix.md)
as the aggregate local acceptance record for `v1.0` through `v1.9.1`.

This closure adds no checker rules, rule families, CLI commands, schemas,
command output changes, provider behavior, runtime behavior, plugins, MCP, IDE
work, hosted service, Auto Flow behavior, or publication scope.

The local validation gate for this final closeout is:

```text
node scripts/run_release_checks.js
npm run check
git diff --check
```

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.0.0 Context Pack Lite Local Closeout

`v2.0.0` opens and locally closes the Context Pack Lite line. It includes the
v2.0-A direction freeze, v2.0-B minimal `context-pack` generator, and v2.0-C
example kit, fresh-receiver dogfooding evidence, and closeout record.

The public command surface is:

```text
node scripts/basebrief.js context-pack --repo <target-repo> --output-dir <dir> [--since <commit>] [--max-files <n>] [--json]
```

The expected artifact shape is:

```text
MANIFEST.md
REPO_MAP.md
KEY_FILES.md
RECENT_DELTA.md
RISK_BOUNDARIES.md
RECEIVER_STATE.md
NEXT_WINDOW_STARTER.md
```

Evidence and examples:

- [Context Pack Lite example kit](../examples/context-pack-lite/README.md)
- [Context Pack Lite fresh receiver dogfooding v2.0.0](dogfooding/context-pack-lite-fresh-receiver-v2.0.0.md)
- [v2.0.0 Context Pack Lite Local Closeout](releases/v2.0.0.md)

This closeout adds no new CLI flags, no checker rule family, no schema-v2, no
provider request, no runtime integration, no plugin, MCP, IDE, hosted service,
Workflow Runner, AI automatic summary, vector index, embedding, or repo-dump
behavior.

The local validation gate for this closeout is:

```text
node scripts/run_release_checks.js
npm run check
git diff --check
```

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.1.0 Context Pack Check Local Closeout

`v2.1.0` locally closes the Context Pack Check line. It keeps the existing
Artifact Checker surface and adds Context Pack Lite directory checks for seven
required artifacts, shared review metadata, manifest live-fact fields,
risk-boundary coverage, receiver-state missing-input semantics, next-window
starter instructions, public safety, and conservative thickness warnings.

The public command surface remains:

```text
node scripts/basebrief.js check --input <context-pack-dir> --json
```

This closeout adds no new top-level command, no CLI JSON top-level shape
change, no `context-pack` generator output change, no provider request, no
runtime integration, no plugin, MCP, IDE, hosted service, Workflow Runner,
schema-v2, AI automatic summary, vector index, embedding, watcher, daemon,
dashboard, prediction engine, push, tag, release, pull request, npm publish,
or global CLI install.

Evidence, contract, and closeout docs:

- [v2.1.0 Context Pack Check Local Closeout](releases/v2.1.0.md)
- [v2.1.0 Context Pack Check Plan](releases/v2.1.0-plan.md)
- [Context Pack Check Spec](specs/context-pack-check.md)
- [Context Pack Check Acceptance v2.1.0](dogfooding/context-pack-check-acceptance-v2.1.0.md)

The local validation gate for this closeout is:

```text
node scripts/run_release_checks.js
npm run check
git diff --check
```

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

The closeout keeps three acceptance classes explicit:

- clean Context Pack directory => `status: passed`, zero errors
- broken Context Pack directory => expected `context-pack.*` error findings
- thick Context Pack directory => `context-pack.too-thick` warning while the
  overall result remains `passed`

## v2.2.0 One-command Resume / New-window Prompt Plan

`v2.2.0` starts the docs-first resume line. It adds the narrow local surface:

```text
node scripts/basebrief.js resume --input <context-pack-dir> [--json]
```

The command reuses the existing Context Pack Check behavior, prints copyable
new-window prompt text, carries warning-only findings as review notes, and
stops before prompt output when checker errors are present.

Evidence and contract docs:

- [v2.2.0 One-command Resume / New-window Prompt Plan](releases/v2.2.0-plan.md)
- [v2.2.0 One-command Resume / New-window Prompt Local Closeout](releases/v2.2.0.md)
- [Context Pack Resume Spec](specs/context-pack-resume.md)
- [Context Pack Resume Dogfooding v2.2.0](dogfooding/context-pack-resume-v2.2.0.md)

The local validation gate for this line is:

```text
node --test tests/basebrief.test.js --test-name-pattern "resume"
node scripts/basebrief.js resume --input examples/context-pack-lite --json
node scripts/basebrief.js check --input examples/context-pack-lite --json
npm test
npm run release-check
git diff --check
```

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

The closeout keeps three acceptance classes explicit:

- clean Context Pack directory => `resume` returns `status: ready`
- warning-only Context Pack directory => `resume` returns `status: ready` and
  carries warning findings as review notes
- errored Context Pack directory => `resume` stops before prompt output

## v2.3.0 BaseBrief Format Plan

`v2.3.0` freezes BaseBrief Format as a docs-first contract. It defines the
future local-first packaging family:

```text
context-pack/
context-pack.md
context.json
```

This line is planning only. It adds no command, generator, JSON schema file,
schema-v2, format emission, provider request, runtime integration, plugin, MCP,
IDE, hosted service, cloud-memory behavior, or Workflow Runner.

Evidence and contract docs:

- [v2.3.0 BaseBrief Format Plan](releases/v2.3.0-plan.md)
- [BaseBrief Format Spec](specs/basebrief-format.md)

The local validation gate for this planning line is:

```text
npm test
npm run release-check
git diff --check
```

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.4.0 File-only Adapter / MCP-friendly Export Plan

`v2.4.0` freezes File-only Adapter / MCP-friendly Export as a docs-first
contract. It defines the future local export family:

```text
exports/
exports/manifest.json
exports/context-pack.md
exports/context.json
exports/adapter-notes.md
```

This line is planning only. It adds no command, generator, exporter, JSON
schema file, schema-v2, format emission, provider request, runtime integration,
plugin, MCP server, IDE, hosted service, cloud-memory behavior, or Workflow
Runner. MCP-friendly means future tool-consumable files, not an MCP server.

Evidence and contract docs:

- [v2.4.0 File-only Adapter / MCP-friendly Export Plan](releases/v2.4.0-plan.md)
- [v2.4.0 File-only Adapter / MCP-friendly Export Local Closeout](releases/v2.4.0.md)
- [File-only Export Spec](specs/file-only-export.md)
- [File-only Export Dogfooding v2.4.0](dogfooding/file-only-export-v2.4.0.md)
- [File-only Export example kit](../examples/file-only-export/README.md)

The local validation gate for the implementation closeout is:

```text
node --test tests/basebrief.test.js --test-name-pattern "Export|v2.4"
node scripts/basebrief.js export --input examples/context-pack-lite --output-dir tests/outputs/private/file-export --json
node scripts/basebrief.js check --input tests/outputs/private/file-export --json
node scripts/basebrief.js check --input examples/file-only-export --json
npm test
npm run release-check
git diff --check
```

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

The example kit validation is:

```text
node scripts/basebrief.js check --input examples/file-only-export --json
node scripts/basebrief.js export --input examples/context-pack-lite --output-dir tests/outputs/private/v2.4-file-export-example-smoke/exports --json
node scripts/basebrief.js check --input tests/outputs/private/v2.4-file-export-example-smoke/exports --json
```

`examples/file-only-export/exports/` is a recommended example output directory
name. The CLI writes directly under explicit `--output-dir`.

The local dogfooding gate for the receiver-style export acceptance record is:

```text
node scripts/basebrief.js context-pack --repo . --output-dir tests/outputs/private/v2.4-file-export-dogfooding/context-pack --json
node scripts/basebrief.js export --input tests/outputs/private/v2.4-file-export-dogfooding/context-pack --output-dir tests/outputs/private/v2.4-file-export-dogfooding/export --json
node scripts/basebrief.js check --input tests/outputs/private/v2.4-file-export-dogfooding/export --json
node --test tests/basebrief.test.js --test-name-pattern "Export|v2.4|Dogfooding"
```

Expected acceptance summary:

```text
clean_export_status: pass
export_bundle_check_status: pass
receiver_style_acceptance: pass
public_safety_status: pass
provider_probe_status=skipped
```

## v2.5.0 Context Pack Doctor

`v2.5.0` adds a local read-only doctor command:

```text
node scripts/basebrief.js doctor --repo <target-repo> --context-pack <context-pack-dir> [--json]
```

Doctor compares live repository facts with an explicit Context Pack Lite
snapshot, reuses Context Pack Check, reports stale or dirty maintenance gaps,
and reminds receivers to recheck live facts before implementation. It does not
add `status`, watcher, daemon, auto-fix, provider request, runtime integration,
plugin, MCP server/tools, IDE integration, hosted service, cloud-memory
behavior, schema-v2, or Workflow Runner.

Evidence and contract docs:

- [v2.5.0 Context Pack Doctor Plan](releases/v2.5.0-plan.md)
- [v2.5.0 Context Pack Doctor Local Closeout](releases/v2.5.0.md)
- [Context Pack Doctor Spec](specs/context-pack-doctor.md)
- [Context Pack Doctor Dogfooding v2.5.0](dogfooding/context-pack-doctor-v2.5.0.md)
- [Context Pack Doctor Dogfooding v2.5.1](dogfooding/context-pack-doctor-v2.5.1.md)
- [Context Pack Doctor example kit](../examples/context-pack-doctor/README.md)

The local validation gate is:

```text
node scripts/basebrief.js doctor --repo . --context-pack examples/context-pack-lite --json
node --test tests/basebrief.test.js --test-name-pattern "Doctor|v2.5|Context Pack"
npm test
npm run release-check
git diff --check
```

The dogfooding gate is:

```text
node scripts/basebrief.js context-pack --repo . --output-dir tests/outputs/private/v2.5-doctor-dogfooding/context-pack --json
node scripts/basebrief.js doctor --repo . --context-pack tests/outputs/private/v2.5-doctor-dogfooding/context-pack --json
```

Expected acceptance summary:

```text
doctor_contract_version: basebrief-doctor-v1
checker_error_propagation_status: pass
public_safety_status: pass
read_only_status: pass
provider_probe_status=skipped
```

The v2.5.1 post-commit continuation evidence confirms:

```text
post_commit_doctor_status: passed
no_provider_boundary_warning_status: absent
stale_pack_findings: doctor.pack-head-stale, doctor.pack-branch-mismatch, doctor.live-recheck-required
broken_pack_findings: doctor.pack-check-error, doctor.live-recheck-required
export_bundle_check_status: passed
provider_probe_status=skipped
```

## v2.6.0 First-Run / Adoption Polish Local Closeout

`v2.6.0` closes a docs/examples/release-check adoption polish line. It makes
the first-run path easier to scan, explains clean/warning/broken Context Pack
inputs, clarifies Check vs Doctor, and turns `docs/index.md` into a
documentation map before the historical archive.

This closeout is recorded in
[v2.6.0 First-Run / Adoption Polish Local Closeout](releases/v2.6.0.md). It
adds no command, no JSON shape change, no provider request, no runtime
integration, no plugin, no MCP server/tools, no schema-v2, no Workflow Runner,
and no always-on status command.

The local validation gate for this closeout is:

```text
npm test
npm run release-check
git diff --check
```

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.6.1 Context Pack Adoption Notes

`v2.6.1` is local post-v2.6 adoption-notes work, not a new minor-version line.
It records a public-safe first-run smoke from README and quickstart guidance
through `context-pack`, `check`, `resume`, and `doctor`, then sorts friction as
`blocking`, `confusing`, or `nice-to-have`.

The evidence is recorded in
[Context Pack Adoption Notes v2.6.1](dogfooding/context-pack-adoption-notes-v2.6.1.md).
This is not a new feature line or contract. It keeps adoption fixes limited to
docs/examples/release-check polish, keeps `doctor.live-recheck-required` as an
info finding, and keeps Doctor out of always-on Status scope.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.6.4 Context Engineering Reference Notes

`v2.6.4` is local reference/adoption planning notes, not a release closeout or
new feature line. It maps external context engineering themes such as own your
context window, stateless reducer, handoff artifact, memory hygiene, and
context compression to BaseBrief Context Pack, Check, Resume, Doctor,
File-only Export, live recheck, and risk boundaries.

The evidence is recorded in
[Context Engineering Reference Notes v2.6.4](dogfooding/context-engineering-reference-notes-v2.6.4.md).
It keeps v3 Continuation Harness or Workflow Runner Lite behind repeated real
friction, and adds no Status command, provider request, runtime integration,
MCP server/tools, schema-v2, or JSON contract change.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.6.5 Context Pack Adoption Scenario Matrix

`v2.6.5` is local adoption evidence, not a release closeout or new feature
line. It records a scenario matrix for clean packs, `context-pack.too-thick`
warnings, stale HEAD doctor findings, broken pack doctor findings,
`doctor.live-recheck-required`, and starter inherited-context handoff wording.

The evidence is recorded in
[Context Pack Adoption Scenario Matrix v2.6.5](dogfooding/context-pack-adoption-scenario-matrix-v2.6.5.md).
It keeps `check` as the pack validity gate, `resume` as the copyable
next-window prompt surface, and `doctor` as live repo comparison rather than an
always-on Status command.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.6.6 Context Pack First-Run Fixture Lab

`v2.6.6` is local adoption evidence, not a release closeout or new feature
line. It maps existing example kits and dogfooding notes into a first-run
fixture-reading lab for clean packs, `context-pack.too-thick`, stale HEAD,
branch mismatch, broken pack, `doctor.live-recheck-required`, and
`Continuation rules:` starter handoff wording.

The evidence is recorded in
[Context Pack First-Run Fixture Lab v2.6.6](dogfooding/context-pack-first-run-fixture-lab-v2.6.6.md).
It keeps `check` as the structural review gate, `resume` as the copyable
next-window prompt, and `doctor` as live repo comparison rather than an
always-on Status command.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.6.7 Context Pack First-Run Rehearsal Audit

`v2.6.7` is local adoption evidence, not a release closeout or new feature
line. It records a real first-run rehearsal from README and quickstart through
minimal examples, Context Pack generation, `check`, `resume`, `doctor`, and the
public example kits.

The evidence is recorded in
[Context Pack First-Run Rehearsal Audit v2.6.7](dogfooding/context-pack-first-run-rehearsal-audit-v2.6.7.md).
It confirms a clean generated pack, `Continuation rules:` in the resume prompt,
`doctor.live-recheck-required` as an info finding, and `doctor.pack-head-stale`
as the stale public-example warning. No blocking adoption friction was found.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.6.8 Context Pack First-Run Friction Repair

`v2.6.8` is local adoption repair, not a release closeout or new feature line.
It closes the confusing items from the v2.6.7 rehearsal by clarifying the
quickstart first-run route as `最短闭环 -> 路径 B -> 路径 B3` and adding a
Windows/PowerShell UTF-8 display note with `Get-Content -Encoding UTF8 <file>`.

The evidence is recorded in
[Context Pack First-Run Friction Repair v2.6.8](dogfooding/context-pack-first-run-friction-repair-v2.6.8.md).
It does not add a command, Status surface, Workflow Runner, provider request,
runtime integration, MCP server/tools, schema-v2, fixture generation, or JSON
contract change.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.6.9 Context Pack Adoption Decision Checkpoint

`v2.6.9` is a local decision checkpoint, not a release closeout or new feature
line. It summarizes v2.6.1 through v2.6.8 adoption evidence and keeps the next
default as v2.6.x local adoption incubation.

The evidence is recorded in
[Context Pack Adoption Decision Checkpoint v2.6.9](dogfooding/context-pack-adoption-decision-checkpoint-v2.6.9.md).
It concludes that current evidence does not justify Status, Workflow Runner
Lite, v3 Continuation Harness, provider integration, runtime integration, MCP
server/tools, schema-v2, hosted memory, daemon, watcher, or new public fixture
generation.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.6.10 Context Pack Pre-Release Bundle Audit

`v2.6.10` is a local bundle audit, not a release closeout or new feature line.
It reviews the ahead-7 local adoption bundle from starter wording repair through
the v2.6.9 decision checkpoint.

The evidence is recorded in
[Context Pack Pre-Release Bundle Audit v2.6.10](dogfooding/context-pack-pre-release-bundle-audit-v2.6.10.md).
It confirms the bundle is docs/examples/release-check/adoption polish only, with
no CLI behavior change, no Status command, no Workflow Runner, and no JSON
contract change.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.6.11 Context Pack Feature Feasibility Spike

`v2.6.11` is a local feasibility spike, not a release closeout or feature
implementation. It evaluates whether Continuation Harness Lite is worth
considering later, with `implementation_status: not_started`.

The evidence is recorded in
[Context Pack Feature Feasibility Spike v2.6.11](dogfooding/context-pack-feature-feasibility-spike-v2.6.11.md).
It asks whether real users need a narrower helper around
`context-pack -> check -> resume -> live recheck`, while keeping Status,
Workflow Runner, provider request, runtime integration, MCP server/tools,
schema-v2, daemon, watcher, hosted memory, and JSON contract changes out of
scope.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.6.12 Context Pack Local Bundle Review / Handoff Rehearsal

`v2.6.12` is local adoption evidence, not a release closeout or feature
implementation. It reviews the ahead-9 local adoption bundle and rehearses the
current `context-pack -> check -> resume -> live recheck` chain.

The evidence is recorded in
[Context Pack Local Bundle Review / Handoff Rehearsal v2.6.12](dogfooding/context-pack-local-bundle-review-rehearsal-v2.6.12.md).
The rehearsal records `context_pack_status: generated`, `check_status: passed`,
`resume_status: ready`, and `doctor_info_findings: doctor.live-recheck-required`.
It keeps Continuation Harness Lite, Status, Workflow Runner, provider request,
runtime integration, MCP server/tools, schema-v2, daemon, watcher, hosted
memory, and JSON contract changes out of scope.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.6.13 Context Pack Local Bundle Compression

`v2.6.13` is local adoption sedimentation, not a release closeout or feature
implementation. It compresses the ahead-10 local adoption bundle into four
groups: starter wording repair, adoption examples/evidence, external
alignment/feature gates, and bundle audit + rehearsal verification.

The evidence is recorded in
[Context Pack Local Bundle Compression v2.6.13](dogfooding/context-pack-local-bundle-compression-v2.6.13.md).
It drafts future major-release candidate wording while keeping Continuation
Harness Lite, Status, Workflow Runner, provider request, runtime integration,
MCP server/tools, schema-v2, daemon, watcher, hosted memory, and JSON contract
changes out of scope.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.6.14 Context Pack Release-Check Maintainability

`v2.6.14` is a release-check maintainability repair, not a release closeout or
feature implementation. It adds whitespace-normalized phrase matching for long
prose assertions so Markdown wrapping does not break stable docs contracts.

The evidence is recorded in
[Context Pack Release-Check Maintainability v2.6.14](dogfooding/context-pack-release-check-maintainability-v2.6.14.md).
It keeps exact technical literals exact, including rule IDs, command names,
contract versions, JSON keys, and status values.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.6.15 Context Pack Major-Release Candidate Shape

`v2.6.15` is a future major-release candidate outline, not a release closeout or
feature implementation. It separates public release-note material from details
that should remain dogfooding evidence.

The evidence is recorded in
[Context Pack Major-Release Candidate Shape v2.6.15](dogfooding/context-pack-major-release-candidate-shape-v2.6.15.md).
It keeps the public story focused on first-run adoption polish, Context Pack
interpretation, diagnostics confidence, and release-check maintainability while
leaving per-slice chronology, commit hashes, private output paths, raw generated
handoff contents, and assertion wording out of front-page release notes.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.6.16 Context Pack Continuation Harness Decision Spec

`v2.6.16` is a local decision spec for Continuation Harness Lite, not a feature
implementation. It records implementation_status: not_started and defines the
evidence thresholds that must be met before any future harness work begins.

The evidence is recorded in
[Context Pack Continuation Harness Decision Spec v2.6.16](dogfooding/context-pack-continuation-harness-decision-spec-v2.6.16.md).
The gate focuses on repeated real handoff friction across `context-pack ->
check -> resume -> live recheck`, while keeping Status, Workflow Runner,
provider request, runtime integration, MCP server/tools, plugin, schema-v2,
hosted memory, and JSON contract changes out of scope.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.6.17 Context Pack Ahead-14 Bundle Review

`v2.6.17` is a local ahead-14 bundle review, not a release closeout or feature
implementation. It separates release-note candidates, dogfooding-only evidence,
and future feature gates so the local bundle can inform a larger future release
without becoming frequent push/tag/release churn.

The evidence is recorded in
[Context Pack Ahead-14 Bundle Review v2.6.17](dogfooding/context-pack-ahead14-bundle-review-v2.6.17.md).
It keeps Continuation Harness Lite, Status, Workflow Runner, provider request,
runtime integration, MCP server/tools, plugin, schema-v2, hosted memory, and
JSON contract changes out of scope.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.6.18 Context Pack Minimal Feature Candidate Decision

`v2.6.18` is a local feature-candidate decision, not an implementation. It keeps
Continuation Harness Lite as a design-sketch candidate only, rejects Status,
Workflow Runner, Doctor expansion, and JSON contract changes for now, and points
the next acceleration move toward real first-run/handoff validation.

The evidence is recorded in
[Context Pack Minimal Feature Candidate Decision v2.6.18](dogfooding/context-pack-minimal-feature-candidate-decision-v2.6.18.md).
It keeps provider request, runtime integration, MCP server/tools, plugin,
schema-v2, hosted memory, daemon, watcher, push, tag, release, and PR actions
out of scope.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## Context Pack First-Run / Handoff Validation

The local first-run/handoff validation pass follows the documented
`context-pack -> check -> resume -> doctor` path from README and quickstart. It
records clean `check`, preserved `Continuation rules:`, no old v2.0 starter
task wording, `basebrief-doctor-v1`, and `doctor.live-recheck-required`.

The evidence is recorded in
[Context Pack First-Run / Handoff Validation](dogfooding/context-pack-first-run-handoff-validation.md).
The pass did not observe blocking or repeated confusing friction, so it does not
trigger Continuation Harness Lite implementation, Status, Workflow Runner, or
JSON contract changes.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## Context Pack Continuation Harness Lite Design Sketch

The Continuation Harness Lite design sketch is planning material only, not an
implementation. It proposes a five-step human flow from inherited Context Pack
to live recheck, plus a small state machine ending at `user_goal_required`.

The sketch is recorded in
[Context Pack Continuation Harness Lite Design Sketch](dogfooding/context-pack-continuation-harness-lite-design-sketch.md).
It keeps command_status: not_started, implementation_status: not_started,
Status, Workflow Runner, provider request, runtime integration, MCP
server/tools, plugin, schema-v2, hosted memory, and JSON contract changes out
of scope.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## Context Pack Continuation Harness Lite Paper Rehearsal

The Continuation Harness Lite paper rehearsal is planning validation only, not
an implementation. It tests whether the design sketch can explain clean pack,
too-thick warning, broken pack, stale/live drift, and missing pack scenarios
using existing BaseBrief surfaces.

The rehearsal is recorded in
[Context Pack Continuation Harness Lite Paper Rehearsal](dogfooding/context-pack-continuation-harness-lite-paper-rehearsal.md).
It covers `check_passed + live_match -> resume_ready -> user_goal_required`,
`check_warning -> human_review`, `check_failed -> repair_pack`,
`check_passed + live_drift -> doctor_or_refresh`, and
`pack_missing -> blocked`, while keeping implementation_status: not_started,
command_status: not_started, Status, Workflow Runner, provider request, runtime
integration, MCP server/tools, plugin, schema-v2, hosted memory, and JSON
contract changes out of scope.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.6.20 Context Pack Local Bundle Compression

`v2.6.20` compresses the ahead-19 local adoption and design bundle into
future release-note candidates, dogfooding-only evidence, release-check /
contract protections, and feature gates / deferred candidates. It is local
bundle compression only, not a release closeout, push, tag, release, PR, or
feature implementation.

The evidence is recorded in
[Context Pack Local Bundle Compression v2.6.20](dogfooding/context-pack-local-bundle-compression-v2.6.20.md).
It keeps Continuation Harness Lite as a design-sketch candidate, preserves
Context Pack seven-file structure, `check --input <dir> --json`, Resume,
Doctor, and Export JSON contracts, and keeps Status, Workflow Runner,
provider/runtime integration, MCP server/tools, plugin, schema-v2, daemon,
watcher, hosted memory, and JSON contract changes out of scope.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.6.21 Context Pack Implementation Gate Decision

`v2.6.21` closes the current implementation gate for Continuation Harness Lite.
The paper rehearsal can explain clean pack, too-thick warning, broken pack,
stale/live drift, and missing pack scenarios, but current evidence still lacks
repeated real blocking or high-frequency confusing friction that survives a
docs/examples/release-check repair attempt.

The decision is recorded in
[Context Pack Implementation Gate Decision v2.6.21](dogfooding/context-pack-implementation-gate-decision-v2.6.21.md).
It keeps Harness Lite as a future candidate only: no new CLI command, no JSON
shape change, no Status, no Workflow Runner, no Doctor expansion, no provider
request, no runtime integration, no MCP server/tools, no plugin, no schema-v2,
no daemon, no watcher, and no hosted memory.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.6.22 Context Pack Release-Check Maintainability Plan

`v2.6.22` is a local maintainability plan, not an implementation. It selects
release-check maintainability modularization as the next near-term direction
after the ahead-19 bundle compression and implementation gate decision.

The plan is recorded in
[Context Pack Release-Check Maintainability Plan v2.6.22](dogfooding/context-pack-release-check-maintainability-plan-v2.6.22.md).
It recommends starting with the v2.x dogfooding/documentation assertion cluster
inside `scripts/run_release_checks.js`, keeping `npm run release-check` output
unchanged and deferring a separate helper file until internal grouping is
proven useful.

It does not add a command, change release-check output, change test commands,
change Context Pack structure, change `check --input <dir> --json`, change
Resume/Doctor/Export JSON contracts, start CI, or open Status, Workflow Runner,
Continuation Harness Lite implementation, provider/runtime integration, MCP,
plugin, schema-v2, daemon, watcher, hosted memory, push, tag, release, or PR
work.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.6.23 Context Pack Runnable Recipes

`v2.6.23` is a local examples recipe enhancement, not a command or contract
change. It turns the existing minimal, Context Pack Lite, Context Pack Doctor,
and File-only Export examples into more copyable runnable recipes using only
existing commands and files.

The plan is recorded in
[Context Pack Runnable Recipes Plan v2.6.23](dogfooding/context-pack-runnable-recipes-plan-v2.6.23.md).
It documents the short paths `README -> quickstart -> examples/minimal`,
`context-pack -> check -> resume -> doctor`, `check -> doctor`, and
`check -> export`.

It does not add a CLI command, change package scripts, change release-check
output, change Context Pack structure, change `check --input <dir> --json`,
change Resume/Doctor/Export JSON contracts, start CI, or open Status, Workflow
Runner, provider/runtime integration, MCP, plugin, schema-v2, daemon, watcher,
hosted memory, push, tag, release, or PR work.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.6.24 Context Pack First-Run Smoke Path Consolidation

`v2.6.24` is a local first-run path consolidation, not a command or contract
change. It makes the canonical route explicit before optional diagnostics,
advanced handoff flows, or historical release archives:

```text
README -> docs/index.md -> docs/quickstart-5min.md -> examples/minimal -> examples/context-pack-lite
npm run check
```

The plan is recorded in
[Context Pack First-Run Smoke Path Consolidation v2.6.24](dogfooding/context-pack-first-run-smoke-path-consolidation-v2.6.24.md).
It keeps Doctor and File-only Export as follow-up recipes, not mandatory
first-run steps.

It does not add a CLI command, change package scripts, change release-check
output, change Context Pack structure, change `check --input <dir> --json`,
change Resume/Doctor/Export JSON contracts, start CI, or open Status, Workflow
Runner, Doctor expansion, provider/runtime integration, MCP, plugin,
schema-v2, daemon, watcher, hosted memory, push, tag, release, or PR work.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.6.25 Context Pack Output UX Polish

`v2.6.25` is local output UX polish only, not a command or contract change. It
clarifies generated Context Pack Lite text for receiver windows without
changing file names, reading order, metadata fields, JSON contracts, or command
outputs.

The plan is recorded in
[Context Pack Output UX Polish v2.6.25](dogfooding/context-pack-output-ux-polish-v2.6.25.md).
The polish clarifies that live repo facts are stale-prone and must be rechecked
before edits, that `not_available`, `not_applicable`, and `needs-review` are
missing-input semantics rather than failure states, and that the expected first
response should report live repo facts, separate inherited pack facts from live
rechecks, and list gaps before implementation.

It does not add a CLI command, change package scripts, change release-check
output, change Context Pack structure, change `check --input <dir> --json`,
change Resume/Doctor/Export JSON contracts, start CI, or open Status, Workflow
Runner, Doctor expansion, provider/runtime integration, MCP, plugin,
schema-v2, daemon, watcher, hosted memory, push, tag, release, or PR work.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.6.26 Context Pack Test-File Split Plan

`v2.6.26` is a local test maintainability plan only, not a test-runner or
contract change. It plans the first safe split path for the large
`tests/basebrief.test.js` file while keeping the current `npm test` behavior
unchanged.

The plan is recorded in
[Context Pack Test-File Split Plan v2.6.26](dogfooding/context-pack-test-file-split-plan-v2.6.26.md).
It identifies current test clusters across docs/release-line assertions,
quickstart examples, BB9 handoff, CLI Lite, Receiver workflows, Project State,
Sidecar, Context Pack v2, cache-ready generators, benchmark summaries, and
relay usage audit.

The recommended first implementation slice is `tests/context-pack.test.js` for
Context Pack v2 tests, with cache-ready / benchmark tests and Receiver /
Project State workflow tests deferred until the first split proves useful.

It does not split tests yet, add a CLI command, change package scripts, change
release-check output, change Context Pack structure, change
`check --input <dir> --json`, change Resume/Doctor/Export JSON contracts, start
CI, or open Status, Workflow Runner, Doctor expansion, provider/runtime
integration, MCP, plugin, schema-v2, daemon, watcher, hosted memory, push, tag,
release, or PR work.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v2.6.27 Context Pack Test-File Split

`v2.6.27` implements the first test-file split planned in `v2.6.26`. Context
Pack v2, File-only Export, Doctor, and Resume tests now live in
`tests/context-pack.test.js`; the broader suite remains in
`tests/basebrief.test.js`.

The implementation is recorded in
[Context Pack Test-File Split v2.6.27](dogfooding/context-pack-test-file-split-v2.6.27.md).
The public validation entry remains `npm test`, now backed by:

```text
node --test tests/basebrief.test.js tests/context-pack.test.js
```

Expected test count remains 175 tests. `npm run release-check` should report
`independent_test_files=2` while keeping `provider_probe_status=skipped`.

It does not add a CLI command, change release-check output shape, change
Context Pack structure, change `check --input <dir> --json`, change
Resume/Doctor/Export JSON contracts, start CI, or open Status, Workflow
Runner, Doctor expansion, provider/runtime integration, MCP, plugin,
schema-v2, daemon, watcher, hosted memory, push, tag, release, or PR work.

## v2.6.28 Context Pack Test-File Split Second Candidate

`v2.6.28` reviews the two-file baseline after `v2.6.27` and selects the next
test-file split candidate without moving tests yet. The plan is recorded in
[Context Pack Test-File Split Second Candidate v2.6.28](dogfooding/context-pack-test-file-split-second-candidate-v2.6.28.md).

The selected second candidate is `tests/cache-ready-benchmark.test.js`, covering
cache-ready generators, benchmark prompt variants, benchmark summaries, provider
profiles, and relay usage audit assertions. Receiver, Project State, Sidecar,
and docs/release-line assertion splits remain deferred.

The public validation entry remains:

```text
node --test tests/basebrief.test.js tests/context-pack.test.js
```

Expected test count remains 175 tests. `npm run release-check` should continue
to report `independent_test_files=2` and `provider_probe_status=skipped`.

It does not add a CLI command, add a new test file, change package scripts,
change release-check output shape, change Context Pack structure, change
`check --input <dir> --json`, change Resume/Doctor/Export JSON contracts,
start CI, or open Status, Workflow Runner, Doctor expansion, provider/runtime
integration, MCP, plugin, schema-v2, daemon, watcher, hosted memory, push, tag,
release, or PR work.

## v2.6.29 Context Pack Cache-Ready Benchmark Test Split

`v2.6.29` implements the second split selected in `v2.6.28`. Cache-ready
generators, benchmark prompt variants, benchmark summaries, provider profiles,
and relay usage audit tests now live in `tests/cache-ready-benchmark.test.js`.
The implementation is recorded in
[Context Pack Cache-Ready Benchmark Test Split v2.6.29](dogfooding/context-pack-cache-ready-benchmark-test-split-v2.6.29.md).

The public validation entry remains `npm test`, now backed by:

```text
node --test tests/basebrief.test.js tests/context-pack.test.js tests/cache-ready-benchmark.test.js
```

Expected test count remains 175 tests. `npm run release-check` should report
`independent_test_files=3` while keeping `provider_probe_status=skipped`.

`tests/basebrief.test.js` keeps release-line, quickstart, handoff, adapter,
artifact checker, CLI Lite, Receiver, Project State, Sidecar, Delta, Seal/Diff,
ContextOps, template, and receiver-ready coverage. `tests/context-pack.test.js`
keeps Context Pack v2, File-only Export, Doctor, and Resume coverage.

It does not add a CLI command, change release-check output shape, change
Context Pack structure, change `check --input <dir> --json`, change
Resume/Doctor/Export JSON contracts, start CI, or open Status, Workflow
Runner, Doctor expansion, provider/runtime integration, MCP, plugin,
schema-v2, daemon, watcher, hosted memory, push, tag, release, or PR work.

## v2.6.30 Context Pack Test Split Stability Check

`v2.6.30` checks the three-file test baseline after `v2.6.27` and `v2.6.29`.
The stability check is recorded in
[Context Pack Test Split Stability Check v2.6.30](dogfooding/context-pack-test-split-stability-check-v2.6.30.md).

The current distribution is:

```text
tests/basebrief.test.js: 118 tests
tests/context-pack.test.js: 11 tests
tests/cache-ready-benchmark.test.js: 46 tests
```

The public validation entry remains:

```text
node --test tests/basebrief.test.js tests/context-pack.test.js tests/cache-ready-benchmark.test.js
```

Expected test count remains 175 tests. `npm run release-check` should continue
to report `independent_test_files=3` and `provider_probe_status=skipped`.

The three-file baseline is kept as useful. Receiver, Project State, Sidecar,
and docs/release-line assertion splits remain deferred until this baseline
proves stable across more local slices.

It does not add a CLI command, add a new test file, change package scripts,
change release-check output shape, change Context Pack structure, change
`check --input <dir> --json`, change Resume/Doctor/Export JSON contracts,
start CI, or open Status, Workflow Runner, Doctor expansion, provider/runtime
integration, MCP, plugin, schema-v2, daemon, watcher, hosted memory, push, tag,
release, or PR work.

## v2.6.31 Context Pack v2.6.x Local Closeout Gate

`v2.6.31` closes the current local v2.6.x dogfooding and maintainability line
for now. The closeout gate is recorded in
[Context Pack v2.6.x Local Closeout Gate v2.6.31](dogfooding/context-pack-v2.6x-local-closeout-gate-v2.6.31.md).

The gate records that the three recommended items are completed: cache-ready
benchmark test split implementation, post-split stability check, and
release-check maintainability helper refactor.

The v2.6.x local line can stop here. Further work should move to either a v2.7
planning/implementation line or a release-candidate decision, rather than
continuing to add small v2.6.x adoption notes.

The public validation entry remains:

```text
node --test tests/basebrief.test.js tests/context-pack.test.js tests/cache-ready-benchmark.test.js
```

Expected test count remains 175 tests. `npm run release-check` should continue
to report `independent_test_files=3` and `provider_probe_status=skipped`.

It does not add a CLI command, change package scripts, change release-check
output shape, change Context Pack structure, change `check --input <dir>
--json`, change Resume/Doctor/Export JSON contracts, start CI, publish, push,
tag, release, or PR work. It keeps Continuation Harness Lite as a future
candidate only and keeps Status, Workflow Runner, Doctor expansion,
provider/runtime integration, MCP, plugin, schema-v2, daemon, watcher, and
hosted memory closed.

## v2.6.32 Context Pack Release-Candidate Direction Decision

`v2.6.32` selects the release-candidate decision path after the v2.6.x local
closeout gate, rather than starting v2.7 implementation immediately. The
decision is recorded in
[Context Pack Release-Candidate Direction Decision v2.6.32](dogfooding/context-pack-release-candidate-decision-v2.6.32.md).

The decision compresses the ahead-28 local bundle into future release-note
candidates, dogfooding-only evidence, release-check / contract protections, and
deferred feature gates. It records
`release_candidate_status: decision_ready_not_published` and keeps v2.7
implementation deferred until the release-candidate decision explains any
remaining user-facing gap.

The public validation entry remains:

```text
npm run release-check
npm test
git diff --check
```

`npm run release-check` should continue to report
`provider_probe_status=skipped`, `mode_cases`, `checked_links`,
`cli_lite_commands`, and `independent_test_files`.

It does not add a CLI command, change package scripts, change release-check
output shape, change Context Pack structure, change `check --input <dir>
--json`, change Resume/Doctor/Export JSON contracts, start CI, publish, push,
tag, release, or PR work. It keeps Continuation Harness Lite as a future
candidate only and keeps Status, Workflow Runner, Doctor expansion,
provider/runtime integration, MCP, plugin, schema-v2, daemon, watcher, and
hosted memory closed.

## v2.6.33 Context Pack Release-Candidate Summary Draft

`v2.6.33` drafts the release-candidate story after the v2.6.32 direction
decision. The draft is recorded in
[Context Pack Release-Candidate Summary Draft v2.6.33](dogfooding/context-pack-release-candidate-summary-draft-v2.6.33.md).

The summary separates a public release-note draft from dogfooding-only evidence.
It keeps the public story focused on first-run discoverability, runnable
recipes, receiver-facing Context Pack wording, maintained
`provider_probe_status=skipped` semantics, three independent test files, and
release-check assertions that protect docs, examples, commands, and contracts.

The open decision after this draft is release closeout prep versus a narrow
v2.7 implementation plan if review finds one concrete usability gap. Until that
decision is made, the bundle remains `decision_ready_not_published`.

The public validation entry remains:

```text
npm run release-check
npm test
git diff --check
```

`npm run release-check` should continue to report
`provider_probe_status=skipped`, `mode_cases`, `checked_links`,
`cli_lite_commands`, and `independent_test_files`.

It does not add a CLI command, change package scripts, change release-check
output shape, change Context Pack structure, change `check --input <dir>
--json`, change Resume/Doctor/Export JSON contracts, start CI, publish, push,
tag, release, or PR work. It keeps Continuation Harness Lite as a future
candidate only and keeps Status, Workflow Runner, Doctor expansion,
provider/runtime integration, MCP, plugin, schema-v2, daemon, watcher, and
hosted memory closed.

## v2.6.34 Context Pack Release Closeout Go/No-Go Plan

`v2.6.34` reviews the v2.6.32 direction decision and v2.6.33
release-candidate summary draft. The plan is recorded in
[Context Pack Release Closeout Go/No-Go Plan v2.6.34](dogfooding/context-pack-release-closeout-go-no-go-plan-v2.6.34.md).

The go/no-go result is `go_to_release_closeout_prep`: the current story is
coherent enough to prepare a release closeout draft, and no concrete
user-facing gap has been identified that would justify starting v2.7 first.

The recommended next slice is release closeout prep. It should convert the
public release-note draft into closeout-ready wording, keep dogfooding-only
evidence in references, record exact validation commands and results, and keep
publish, push, tag, release, and PR actions `not_started` until separately
confirmed.

The public validation entry remains:

```text
npm run release-check
npm test
git diff --check
```

`npm run release-check` should continue to report
`provider_probe_status=skipped`, `mode_cases`, `checked_links`,
`cli_lite_commands`, and `independent_test_files`.

It does not add a CLI command, change package scripts, change release-check
output shape, change Context Pack structure, change `check --input <dir>
--json`, change Resume/Doctor/Export JSON contracts, start CI, publish, push,
tag, release, or PR work. It keeps Continuation Harness Lite as a future
candidate only and keeps Status, Workflow Runner, Doctor expansion,
provider/runtime integration, MCP, plugin, schema-v2, daemon, watcher, and
hosted memory closed.

## v2.6.35 Context Pack Release Closeout Prep Draft

`v2.6.35` converts the v2.6.33 public summary draft and v2.6.34 go/no-go
decision into closeout-prep wording. The prep draft is recorded in
[Context Pack Release Closeout Prep Draft v2.6.35](dogfooding/context-pack-release-closeout-prep-draft-v2.6.35.md).

The prep draft keeps the release-candidate story focused on first-run
discoverability, runnable examples, receiver-facing Context Pack wording, and
validation confidence while preserving commands, package scripts, JSON
contracts, Context Pack structure, and provider boundaries.

The current-slice validation capture remains:

```text
npm run release-check
npm test
git diff --check
```

Expected results are `release_check_status: passed_current_slice`,
`provider_probe_status=skipped`, `npm_test_status:
passed_175_tests_current_slice`, and
`git_diff_check_status: passed_existing_crlf_warnings_only`. Release-check
metric lines such as `mode_cases`, `checked_links`, `cli_lite_commands`, and
`independent_test_files` remain preserved.

It does not add a CLI command, change package scripts, change release-check
output shape, change Context Pack structure, change `check --input <dir>
--json`, change Resume/Doctor/Export JSON contracts, start CI, publish, push,
tag, release, or PR work. It keeps Continuation Harness Lite as a future
candidate only and keeps Status, Workflow Runner, Doctor expansion,
provider/runtime integration, MCP, plugin, schema-v2, daemon, watcher, and
hosted memory closed.

## v2.6.36 Context Pack Formal Local Release Closeout Draft

`v2.6.36` drafts the formal local release closeout text for the Context Pack
Lite v2.6.x local bundle. The draft is recorded in
[Context Pack Formal Local Release Closeout Draft v2.6.36](dogfooding/context-pack-formal-local-release-closeout-draft-v2.6.36.md).

The draft keeps the local release-candidate story focused on first-run
discoverability, runnable examples, receiver-facing Context Pack wording, and
validation confidence while preserving commands, package scripts, JSON
contracts, Context Pack structure, and provider boundaries.

Current local validation remains:

```text
npm run release-check
npm test
git diff --check
```

Recorded result is `release_check_status: passed_current_slice`,
`provider_probe_status=skipped`, `npm_test_status:
passed_175_tests_current_slice`, `git_diff_check_status:
passed_existing_crlf_warnings_only`, and `independent_test_files=3`.
Release-check metric lines such as `mode_cases`, `checked_links`,
`cli_lite_commands`, and `independent_test_files` remain preserved.

It does not add a CLI command, change package scripts, change release-check
output shape, change Context Pack structure, change `check --input <dir>
--json`, change Resume/Doctor/Export JSON contracts, start CI, publish, push,
tag, release, or PR work. Any actual publication action still requires separate
explicit confirmation.

## v2.6.37 Context Pack Release Closeout Review Packet

`v2.6.37` prepares a local review packet for the Context Pack Lite v2.6.x
release closeout. The packet is recorded in
[Context Pack Release Closeout Review Packet v2.6.37](dogfooding/context-pack-release-closeout-review-packet-v2.6.37.md).

The packet packages the release story, validation evidence, protected
boundaries, and remaining external actions into one reviewable reference. The
release story remains focused on first-run discoverability, runnable examples,
receiver-facing Context Pack wording, and validation confidence.

Current local validation remains:

```text
npm run release-check
npm test
git diff --check
```

Recorded result is `release_check_status: passed_current_slice`,
`provider_probe_status=skipped`, `npm_test_status:
passed_175_tests_current_slice`, `git_diff_check_status:
passed_existing_crlf_warnings_only`, and `independent_test_files=3`.
Release-check metric lines such as `mode_cases`, `checked_links`,
`cli_lite_commands`, and `independent_test_files` remain preserved.

It does not add a CLI command, change package scripts, change release-check
output shape, change Context Pack structure, change `check --input <dir>
--json`, change Resume/Doctor/Export JSON contracts, start CI, publish, push,
tag, release, or PR work. Any actual publication action still requires separate
explicit confirmation.

## v2.7.0 Context Pack Human Next-Step Hints Plan

`v2.7.0` opens a narrow human-output usability line after the v2.6.x local
closeout review packet. The plan is recorded in
[v2.7.0 Context Pack Human Next-Step Hints Plan](releases/v2.7.0-plan.md).

The planned implementation should add concise next-step hints to existing
non-JSON CLI output for `context-pack`, `check`, `export`, and `doctor` so a
user can see the next recommended local command after running the current
workflow. The hints are guidance text only.

The plan preserves `--json` output shape, command exit semantics, Context Pack
Lite's seven-file structure, Context Pack Check, Resume, Export, and Doctor JSON
contracts, and all provider/runtime/plugin/MCP/schema-v2 boundaries. It does
not add Status, Workflow Runner, Doctor expansion, Continuation Harness Lite,
daemon, watcher, hosted memory, CI, publish, push, tag, release, or PR work.

The planned validation gate remains:

```text
npm run release-check
npm test
git diff --check
```

Provider-free release checks must continue to print
`provider_probe_status=skipped`. Implementation should additionally verify that
non-JSON output contains next-step hints while `--json` output remains
unchanged for the same command results.

## v2.7.0 Context Pack Human Next-Step Hints Local Closeout

`v2.7.0` closes the first human-output next-step hints implementation slice.
The closeout is recorded in
[v2.7.0 Context Pack Human Next-Step Hints Local Closeout](releases/v2.7.0.md).

The implementation adds `next_step=` guidance to existing non-JSON CLI output
for `context-pack`, `check`, `export`, and `doctor`, plus `optional_next_step=`
guidance where a clean or warning-only `check` result can continue with
`resume` or live repository comparison through `doctor`.

Tests verify that human output contains the new hints and that `--json` output
does not gain a `next_step` field. The change preserves command exit semantics,
Context Pack Lite's seven-file structure, Context Pack Check, Resume, Export,
and Doctor JSON contracts, and all provider/runtime/plugin/MCP/schema-v2
boundaries.

The local validation gate remains:

```text
node --test tests/context-pack.test.js --test-name-pattern "Context Pack|Export|Doctor"
npm run release-check
npm test
git diff --check
```

Provider-free release checks must continue to print
`provider_probe_status=skipped`.

## v2.7.1 Context Pack Human Next-Step Hints Dogfooding

`v2.7.1` records a dogfooding and reality-check pass for the human-only
next-step hints. The evidence is recorded in
[Context Pack Human Next-Step Hints Dogfooding v2.7.1](dogfooding/context-pack-human-next-step-hints-dogfooding-v2.7.1.md).

The pass exercises `context-pack -> check -> resume`,
`context-pack -> check -> doctor`, `export -> check`, warning-only pack, and
broken pack paths. It found one concrete misleading hint: a clean check of a
four-file File-only Export directory should not suggest
`resume --input <export-dir>` or `doctor --context-pack <export-dir>`.

The v2.7.1 repair narrows human `check` hints by input kind. Seven-file Context
Pack Lite directories keep `resume` and optional `doctor` guidance. Four-file
File-only Export directories now ask the user to review the checked export files
before sharing or tool intake. Generic checked files or directories ask the user
to review check results before sharing.

Tests verify that the hidden input-kind helper does not appear in `--json`
output and that `export -> check` human output no longer recommends `resume` or
`doctor`. The change preserves command exit semantics, Context Pack Lite's
seven-file structure, Context Pack Check, Resume, Export, and Doctor JSON
contracts, and all provider/runtime/plugin/MCP/schema-v2 boundaries.

The local validation gate remains:

```text
node --test tests/context-pack.test.js --test-name-pattern "Context Pack|Export|Doctor"
npm run release-check
npm test
git diff --check
```

Provider-free release checks must continue to print
`provider_probe_status=skipped`.

## v2.8.0 Continuation Harness Lite

`v2.8.0` opens and closes the first Continuation Harness Lite implementation.
The plan is recorded in
[v2.8.0 Continuation Harness Lite Plan](releases/v2.8.0-plan.md), and the
local closeout is recorded in
[v2.8.0 Continuation Harness Lite Local Closeout](releases/v2.8.0.md).
Self-dogfooding evidence is recorded in
[Continuation Harness Lite Dogfooding v2.8.0](dogfooding/continuation-harness-lite-v2.8.0.md).

The new local command is:

```text
node scripts/basebrief.js continue --repo <target-repo> --output-dir <dir> [--since <commit>] [--max-files <n>] [--json]
```

It runs the existing `context-pack -> check -> resume` path and writes a
reviewable continuation package with `CONTINUATION_REPORT.md`,
`CHECK_SUMMARY.md`, `NEXT_WINDOW_STARTER.md`, `continuation.meta.json`, and a
seven-file `context-pack/` directory. The example shape is documented in
[Continuation Harness Lite example kit](../examples/context-pack-continuation/README.md).

Tests verify `ready_for_receiver` for clean repos, `needs_review` for dirty
repos, unsafe and non-empty output rejection, public-safe `continue --json`
metadata, and removal of private absolute Context Pack paths from the copied
starter. The command does not change Context Pack Check, Resume, Export, or
Doctor JSON contracts.

Expected test count is 180 tests across `independent_test_files=4`.

The local validation gate is:

```text
node --test tests/continuation-harness.test.js
npm run release-check
npm test
git diff --check
```

Provider-free release checks must continue to print
`provider_probe_status=skipped`.

## v0.4.1 Stabilization Candidate

`v0.4.1` is a stabilization-only cycle after the `v0.4.0` public release. It uses
[the v0.4.x test matrix](testing-v0.4.x-test-matrix.md) and
[the v0.4.0 post-release baseline](baselines/v0.4.0-post-release-baseline.md)
to keep scale testing public-safe.

This cycle may add checker rules, edge tests, local sandbox summaries, and docs fixes.
It does not add `receiver-flow --guided`, `receiver-flow --extract`, `review-draft`,
`.basebrief/`, Auto Flow, Web UI, adapter expansion, provider requests, provider
benchmark claims, npm publishing, push, tag, or formal release.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v0.8.7 Copyable New-Window Starter

`v0.8.7` adds `new-window-starter.md` to generated Sidecar bundles. This is a
copyable starter block for users opening a new chat; `next-chat-prompt.md`
remains the receiver contract.

The starter must point to the target repository and Sidecar bundle, restate
`current_goal` and `receiver_entry_task`, include at least two risk boundaries,
report `pass/fail`, and preserve wait for user confirmation, No provider
request, No raw private output, No runtime integration, No schema change, and
No auto-advance.
`sidecar-check` validates the starter only when `manifest.json` declares
`output_files.newWindowStarter`, so old v0.8 bundles remain compatible.

The v0.8.x matrix is tracked in
[testing-v0.8.x-test-matrix.md](testing-v0.8.x-test-matrix.md). This patch does
not require provider smoke, receiver thread creation, Auto Flow runs, runtime
integration, OpenClaw/Hermes runtime connection, or provider benchmarks.

## v0.8.8 Starter Language Routing

`v0.8.8` adds `--starter-language auto|zh-CN|en|ja` for Sidecar
`new-window-starter.md`. The flag localizes only the copyable starter shell:
protocol fields, paths, file names, schema names, and English hard-stop anchors
remain literal, including the `pass/fail` receiver acceptance anchor. `auto`
falls back to `zh-CN` for mixed or unclear language, and this is not an
automatic translation service.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v0.8.5 Manual Receiver Smoke Result Intake

`v0.8.5` adds a public-safe result intake layer for manual OpenCode and Claude
Code receiver smoke summaries. It does not run external receiver prompts from
Codex and does not change CLI/API/schema behavior.

The initial intake status is `not_run` for OpenCode and Claude Code. A future
manual result may only be marked `passed` after the user supplies a public-safe
acceptance summary that covers BaseBrief, v0.8.x, current commit,
`current_goal`, receiver entry task, at least two risk boundaries, wait for
user confirmation, no auto-advance, no provider, and no runtime.

The v0.8.x matrix is tracked in
[testing-v0.8.x-test-matrix.md](testing-v0.8.x-test-matrix.md). This closure
does not require provider smoke, receiver thread creation, Auto Flow runs,
runtime integration, OpenClaw/Hermes runtime connection, or provider
benchmarks. No raw private output is copied into public docs.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v0.8.6 Manual Receiver Smoke Result Intake Evidence

`v0.8.6` records public-safe result summaries for the generic OpenCode and
Claude Code receiver smoke rows. It does not open v0.9, change CLI/API/schema
behavior, create receiver threads, copy raw runner output, or record provider
details in public docs.

The accepted summaries mark OpenCode generic and Claude Code generic as
`passed`, because both public-safe intake summaries confirmed BaseBrief, v0.8.x,
the current commit, `current_goal`, receiver entry task, seven risk boundaries,
wait for user confirmation, no auto-advance, no provider, and no runtime.
OpenClaw-target rows remain `not_run` with `manual_required`.

A future OpenClaw-target pass still requires all v0.8.5 intake fields:
BaseBrief, v0.8.x, current commit, `current_goal`, receiver entry task, at
least two risk boundaries, wait for user confirmation, no auto-advance, no
provider, and no runtime.

The v0.8.x matrix is tracked in
[testing-v0.8.x-test-matrix.md](testing-v0.8.x-test-matrix.md). No raw private
output, private paths, secrets, provider endpoints, model values, token output,
or API keys are copied into public docs.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## OpenClaw/Hermes Manual Receiver Smoke Follow-up

A later public-safe follow-up closes the remaining OpenClaw/Hermes manual
first-response gap. It records `hermes-agent` as `passed` and
`openclaw-agent` as `passed` only after a strict six-file absolute-path
recheck against a historical `openclaw` Sidecar bundle.

This follow-up does not rewrite the `v0.8.5` / `v0.8.6` checkpoint tables. It
is manual gap closure only, not proof of provider/runtime integration and not
proof that the latest freshly rebuilt `openclaw` bundle was exercised end to
end by an external agent.

## v0.5.0 Guided Receiver Flow Candidate

`v0.5.0` adds `receiver-flow --guided` as an explicit human-input mode. It keeps
`handoff_status: draft_needs_review`, writes empty answers as `[EMPTY]`, and adds a
review checklist. It does not add `review-draft`, `receiver-flow --extract`,
`.basebrief/`, Auto Flow, Web UI, adapter expansion, provider requests, npm
publishing, push, tag, or formal release.

## v0.5.1 Review Draft Gate Candidate

`v0.5.1` adds `review-draft` as the explicit gate between a reviewed guided draft
and `handoff_status: ready_for_receiver`. It requires checked review checklist
lines, all six human fields, and no `[EMPTY]`, `[NEEDS_REVIEW]`, or `[CANDIDATE]`
markers. It does not add `receiver-flow --extract`, `.basebrief/`, Auto Flow, Web
UI, adapter expansion, provider requests, npm publishing, push, tag, or formal
release.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v0.5.2 Receiver Flow Extract Candidate

`v0.5.2` adds `receiver-flow --extract --source <draft-or-context.md>` as an
explicit local candidate-extraction mode. Extracted values are marked
`[CANDIDATE]`, missing values are marked `[NEEDS_REVIEW]`, and output remains
`handoff_status: draft_needs_review`. It does not add `.basebrief/`, Auto Flow,
Web UI, adapter expansion, provider requests, npm publishing, push, tag, or
formal release.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v0.5.3 Receiver Flow Review Closure

`v0.5.3` closes the `v0.5.x` receiver-flow review line with examples for a
valid reviewed draft, a rejected extracted candidate draft, and a rejected empty
guided draft. It does not add a new CLI command, `.basebrief/`, Auto Flow, Web
UI, adapter expansion, provider requests, npm publishing, push, tag, or formal
release.

## v0.6.0 Project State Directory Release

`v0.6.0` adds `state-init` and `state-read` for local `.basebrief/state.json`
continuity state. `state-init` requires a reviewed source with
`handoff_status: ready_for_receiver`; it does not accept draft output and does
not promote receiver-flow content automatically. It does not add Auto Flow, Web
UI, adapter expansion, provider requests, npm publishing, hosted service,
provider gateway, or global CLI.

## v0.6.1 Stability And Self-Dogfooding

`v0.6.1` is a stabilization target after the `v0.6.0` release. It tightens
public release wording, the project-state model and validation docs, the
v0.6.x test matrix, and BaseBrief self-dogfooding evidence. It does not change
`basebrief-project-state-v1`, add lifecycle commands, run provider requests, or
start Auto Flow.

The v0.6.x matrix is tracked in
[testing-v0.6.x-test-matrix.md](testing-v0.6.x-test-matrix.md). Provider smoke
is a private matrix item only; public docs may name the env var shapes but must
not record their values.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v0.7.0 Project State Lifecycle Candidate

`v0.7.0` adds `state-status`, `state-validate`, `state-history`, and
`state-advance` for the existing local `.basebrief/state.json` lifecycle.
It keeps `basebrief-project-state-v1` unchanged and keeps `review-draft` as the
required gate before state creation or advancement.

The v0.7.x matrix is tracked in
[testing-v0.7.x-test-matrix.md](testing-v0.7.x-test-matrix.md). Provider smoke
remains private design-only evidence for this candidate; public release checks
must still allow:

```text
provider_probe_status=skipped
```

## Receiver 测试额度

Receiver-ready 验证默认采用低额度策略：

- 普通文档和静态契约改动只运行本地自动检查，不创建 Codex 接收线程。
- 只有 Receiver 行为发生变化，且静态检查无法验证该行为时，才运行最多 `1` 个 low-reasoning smoke case。
- Smoke case 通过后立即停止，不追加便利性或“顺便验证”用例。
- 完整矩阵测试必须由用户明确批准。
- 已有 private 与用户提供的外部证据应优先复用，不为重复确认重新消耗接收线程额度。
- v0.3.1 receiver stabilization 文档与示例改动默认只跑本地自动检查，不创建新的 receiver 矩阵。

这项预算规则不降低发布检查标准。单元测试、release checks、Artifact Checker、`git diff --check` 和受保护接口检查仍按改动范围执行。

如需真实 provider 缓存测试框架：

```text
node scripts/provider_cache_probe.js --output tests/outputs/provider-cache-probe.latest.json
```

真实 provider probe 需要临时注入 `BASEBRIEF_PROVIDER_BASE_URL`、`BASEBRIEF_PROVIDER_MODEL`、`BASEBRIEF_PROVIDER_NAME` 和 provider key。key 只放在当前进程环境变量中，不写入仓库文件。

如需 MiMo 本地真实项目大样本 benchmark：

```text
node scripts/provider_cache_benchmark.js --local-projects --output tests/outputs/private/provider-cache-benchmark.raw.json
```

大样本 benchmark 额外需要临时注入 `BASEBRIEF_BENCHMARK_PROJECTS`，用分号分隔本地项目路径。raw 输出写入 `tests/outputs/private/`，该目录被 `.gitignore` 忽略；公开结果只写入 `tests/outputs/provider-cache-benchmark.latest.json`。

如需缓存比例与估算成本的长度归一化 benchmark：

```text
node scripts/provider_cache_benchmark.js --local-projects --mode normalized --output tests/outputs/private/provider-cache-benchmark-normalized.raw.json
```

normalized 模式的公开结果默认写入 `tests/outputs/provider-cache-benchmark-normalized.latest.json`。

## 测试矩阵

| 编号 | 类型 | 通过标准 |
|---|---|---|
| A | Full 正向 | 复杂项目阶段总结应路由到 `full` |
| B | Lite 正向 | 1 到 2 文件小范围接续应路由到 `lite` |
| C | Lite 负向 | `.env`、真实 API provider、backend+frontend+deploy、state/memory/gateway、边界不清等场景不得继续用 `lite` |
| D | Cache-ready | 多次相似输入保持字段顺序稳定，共享前缀比自然 Lite 样例更稳定 |
| E | Provider probe | 若未提供环境变量，则明确标记为 skipped；若提供，则记录真实 provider 指标可见性 |
| F | 安全扫描 | 无密钥、无 `.env` 文件、无私人绝对路径、无 `node_modules` / `dist` / 缓存污染 |
| G | 链接检查 | README / docs / Skill / 模板中的相对链接有效 |
| H | 发布示例 | Full / Lite / Cache-ready / Next-chat / Agent-task 公开示例存在 |
| I | 英文 README | `README.en.md` 存在，且说明单入口三模式 |
| J | 独立逻辑测试 | 路由、cache-ready 生成器、模板关键字段有实质断言 |
| K | 大样本 benchmark | 普通 release check 不触发 API；若公开 summary 存在，则验证脱敏结构和结论等级 |
| L | 成本估算 | 按 MiMo `mimo-v2.5` 价格模型计算 cached input、uncached input 与 output 的估算成本 |

## 当前发布准备结论

本轮发布准备要求的是：

- 一个公开 Skill 入口
- 三模式并存
- Lite 不膨胀
- Cache-ready 不夸大
- 无私有路径与临时污染

最新本地 release check 和独立测试通过后，才可视为发布准备完成。

## 最新一次本地结果

`v0.3.1` receiver stabilization 收口验证应使用：

```text
git diff --check
node --test tests/basebrief.test.js
node scripts/run_release_checks.js
npm run check
```

该收口不需要 provider 请求、外部 receiver 矩阵、OpenCode smoke、Claude Code smoke 或 Auto Flow run。未注入 provider 环境变量时，release check 必须保持 `provider_probe_status=skipped`。

上一轮 `v0.3.0` 发布候选本地验证未注入 provider 环境变量。`node scripts/run_release_checks.js` 已通过，关键结果为：

- 模式路由用例：`11` 条通过
- 安全扫描文件数：`136`
- 相对链接检查：`122` 条有效
- 公开示例文件：`28` 个存在
- artifact checker 输入：`37` 个通过
- CLI Lite 命令：`11` 条通过
- 首次使用闭环命令：`6` 条通过
- Seal/Diff 命令：`3` 条通过
- 独立测试文件：`1` 个通过
- 独立逻辑测试：`99/99` 通过
- provider probe 状态：`skipped`
- 已保存的公开 benchmark summaries：通过脱敏结构和结论等级检查；本轮未重新运行真实 provider benchmark
- `cache-ready` 同项目不同轮次共享前缀：`492`
- 自然 Lite 同项目不同轮次共享前缀：`70`
- `cache-ready` 跨项目共享前缀：`357`
- 自然 Lite 跨项目共享前缀：`16`
- `cache-ready` 同一基线不同尾部追问共享前缀：`1524`
- 自然 Lite 同一基线不同尾部追问共享前缀：`212`
- follow-up 动态后缀大小：`42,43`
- follow-up 变化区段：`TAIL_REQUEST`
- cache-ready 字段顺序一致：`true`
- cache-ready 缺字段输入拒绝：`true`

本轮还完成了 Quickstart 的 `build -> check -> seal -> diff` 与 `receiver-init -> receiver-check` 首次使用闭环、公开产物安全检查和独立逻辑测试。公开首次使用示例没有 error 或 warning，发布候选未发现 key、Bearer、`.env` 内容或私有绝对路径。

Receiver 逻辑由临时 Git 仓库自动测试覆盖。本轮未创建 Codex 接收线程，也未运行完整模型矩阵。

本轮额外执行了两个有界外部 Agent 文档 smoke case：

- OpenCode 只读 smoke 完成，并发现 Quickstart 中来源窗口连续 smoke 与接收窗口正式验收的角色表述不够清楚；文档已修正。
- Claude Code smoke 在限定时间内未返回结果，因此未重试，也没有形成可解释结论。

这些结果仅是补充执行记录，不构成跨模型稳定性证明。原始输出保存在 ignored private 测试目录，不进入公开仓库。

`provider_probe_status=skipped` 表示本轮未注入 provider 环境变量且没有发起真实 provider 请求；这不等同于真实 provider probe 失败。下方保存的 provider probe 和 benchmark 结果是历史 provider-specific 证据，本轮只验证其公开摘要结构，没有重新运行。

## 本地真实项目大样本 benchmark

`provider_cache_benchmark.js` 用于 MiMo 专用大样本测试。默认目标是：

- 3 个本地真实项目
- 6 类 BaseBrief 场景
- natural / cacheReady 两种写法
- 每种写法 10 次请求
- 合计 360 次请求

主结论只看缓存指标：

- repeat median `cachedTokens`
- repeat median `cacheRatio`
- cacheReady 胜过 natural 的场景数
- cache 字段可见率

latency 只记录，不作为主胜负依据。公开文档只能写成“MiMo `mimo-v2.5` + 当前本地真实项目样本下的证据”，不能写成跨 provider、跨模型或费用/延迟稳定下降的通用结论。

解释结果时必须同时看 `cachedTokens` 和 `cacheRatio`。如果 cacheReady 的绝对 cached tokens 更高，但 cache ratio 更低，只能说明它稳定缓存了更多前缀内容，不能说明 token 使用效率或成本一定更好。

### MiMo 价格模型

本仓库成本估算使用 2026-06-02 北京时间确认的 MiMo `mimo-v2.5` 官方直连 API 价格，单位为元人民币 / 1M tokens：

- 输入命中缓存：`0.02`
- 输入未命中缓存：`1`
- 输出：`2`

估算公式：

```text
uncachedInputTokens = promptTokens - cachedTokens
estimatedInputHitCostCny = cachedTokens / 1_000_000 * 0.02
estimatedInputMissCostCny = uncachedInputTokens / 1_000_000 * 1
estimatedOutputCostCny = completionTokens / 1_000_000 * 2
estimatedTotalCostCny = hit + miss + output
```

这是按 token usage 与价格表推导的估算成本，不是 provider 账单扣费审计。除非 provider 返回逐请求真实扣费字段，否则不能写成真实扣费证明。

### Normalized 判定标准

normalized 模式只在 prompt 长度差异不超过 `±5%` 的场景里比较比例和成本：

- 有效请求数至少 `324/360`
- cache 字段可见率至少 `95%`
- 长度归一化有效场景至少 `15/18`
- cacheReady cache ratio 胜出至少 `15/18`，才可说比例胜出
- cacheReady estimated cost 胜出至少 `15/18`，且总体 median estimated cost 至少低 `5%`，才可说估算成本胜出

最新一次本地真实项目 benchmark 已完成：

- 请求数：`360`
- 有效请求数：`360`
- cache 字段可见率：`100%`
- cacheReady 绝对 cached token 胜出场景：`18/18`
- cacheReady cache ratio 胜出场景：`0/18`
- natural repeat median cached tokens：`1344`
- cacheReady repeat median cached tokens：`1472`
- natural repeat median cache ratio：`0.9851`
- cacheReady repeat median cache ratio：`0.9837`
- conclusion level：`large_sample_evidence`

这组结果支持的结论是：在 MiMo `mimo-v2.5` + 当前 3 个本地真实项目 × 6 类场景下，cacheReady 稳定缓存了更多绝对 token；但它没有提升缓存比例，因此不能把结果写成 token 使用效率或成本已经更优。

最新一次 normalized benchmark 也已完成：

- 请求数：`360`
- 有效请求数：`360`
- cache 字段可见率：`100%`
- 长度归一化有效场景：`18/18`
- cacheReady cache ratio 胜出场景：`4/18`
- cacheReady estimated cost 胜出场景：`4/18`
- natural repeat median cache ratio：`0.9755`
- cacheReady repeat median cache ratio：`0.9712`
- natural repeat median estimated cost：`0.0001266` 元
- cacheReady repeat median estimated cost：`0.0001336` 元
- overall cost delta：`+0.000007` 元
- overall cost delta percent：`+5.53%`
- ratio conclusion level：`ratio_not_proven`
- cost conclusion level：`cost_not_proven`

这组 normalized 结果支持的结论是：在长度已归一化的真实项目样本下，cacheReady 没有证明缓存比例优势，也没有证明估算成本优势；按当前价格模型，median estimated cost 反而略高。

## 真实 provider 测试结论

最近一次真实 provider probe 已运行。测试环境为 Xiaomi MiMo official direct API，模型为 `mimo-v2.5`，环境变量只在当前终端临时注入，未写入仓库文件。

本次 provider 不支持 `/responses` endpoint，探针自动回退到 `/chat/completions`。provider 返回了 `cached_tokens` 指标，脱敏摘要如下：

| variant | phase | endpoint | prompt_tokens | completion_tokens | total_tokens | cached_tokens | latency_ms |
|---|---|---|---:|---:|---:|---:|---:|
| natural | warmup | chat/completions | 328 | 64 | 392 | 320 | 4816 |
| natural | repeat | chat/completions | 329 | 64 | 393 | 320 | 7003 |
| cacheReady | warmup | chat/completions | 636 | 64 | 700 | 576 | 4177 |
| cacheReady | repeat | chat/completions | 636 | 64 | 700 | 576 | 2854 |

样本限制：

- 只覆盖一个 provider、一个模型、四次请求，不能代表所有负载。
- 未测流式首 token 延迟，`firstTokenLatencyMs` 为 `null`。
- 本次数据说明 provider 暴露了 `cached_tokens`，且 cache-ready 样例在该样本中报告了更高的 cached token 绝对值；不能据此声称费用或延迟已经稳定下降。

最近一次 probe 状态已脱敏保存到：

- `tests/outputs/provider-cache-probe.latest.json`
- BB2 capsule benchmark command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode capsule --output tests/outputs/private/provider-cache-benchmark-capsule.raw.json
```

Capsule mode compares `natural`, `cacheReady`, and `capsuleV2`. With the default 3 projects x 6 scenarios x 3 variants x 10 repeats, it runs 540 requests. Public summary output is `tests/outputs/provider-cache-benchmark-capsule.latest.json`.

Capsule cost wording remains gated: 12/18 wins plus at least 3% lower median estimated cost is only an initial signal; 15/18 wins plus at least 5% lower median estimated cost is the stronger MiMo local real-project evidence threshold.

Latest capsule benchmark result:

- request count: `540`
- valid request count: `540`
- cache field visibility: `539/540`
- capsuleV2 cache ratio wins: `6/18`
- capsuleV2 estimated cost wins: `10/18`
- capsuleV2 median cache ratio: `0.9552`
- capsuleV2 median estimated cost: `0.0001122` CNY
- capsuleV2 overall cost delta percent vs natural: `+2.37%`
- conclusion level: `capsule_inconclusive`

This supports only a format/length finding, not a cost or cache-ratio win.

BB3 anchor benchmark command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode anchor --output tests/outputs/private/provider-cache-benchmark-anchor.raw.json
```

Anchor mode compares `natural`, `cacheReady`, `capsuleV2`, and `anchorV3`. With the default 3 projects x 6 scenarios x 4 variants x 10 repeats, it runs 720 requests.

BB4 anchor-pad benchmark command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode anchorpad --output tests/outputs/private/provider-cache-benchmark-anchorpad.raw.json
```

Latest anchor-pad benchmark result:

- request count: `900`
- valid request count: `897`
- cache field visibility: `897/897`
- anchorPadV4 cache ratio wins: `10/18`
- anchorPadV4 estimated cost wins: `16/18`
- anchorPadV4 median cache ratio: `0.9808`
- anchorPadV4 median estimated cost: `0.00009354` CNY
- anchorPadV4 overall cost delta percent vs natural: `-14.65%`
- conclusion level: `anchorpad_cost_large_sample_evidence`

This supports a MiMo `mimo-v2.5` local real-project estimated-cost advantage for BB4 anchor-pad. It does not prove cross-provider savings.

BB4 PAD sweep command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode padSweep --output tests/outputs/private/provider-cache-benchmark-padsweep.raw.json
```

Smoke command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode padSweep --repeat-count 2 --project-limit 1 --scenario-limit 2 --output tests/outputs/private/provider-cache-benchmark-padsweep-smoke.raw.json --summary-output tests/outputs/provider-cache-benchmark-padsweep-smoke.latest.json
```

PAD sweep compares `anchorPad4`, `anchorPad8`, `anchorPad16`, `anchorPad32`, and `anchorPad64`. `anchorPad8` is the BB4 baseline. A different PAD length is only a BB5 candidate if it beats `anchorPad8` on estimated cost in at least `12/18` project-scenario pairs and lowers overall median estimated cost by at least `5%`.

DeepSeek `deepseek-v4-flash` can be tested through the same script after temporarily setting provider env vars. Its price profile uses the same 2026-06-02 CNY per 1M tokens values as MiMo in this repository: input cache hit `0.02`, input cache miss `1`, output `2`. Do not write provider keys into repository files.

Latest MiMo pad sweep result:

- request count: `900`
- valid request count: `900`
- cache field visibility: `900/900`
- best cost delta vs anchorPad8 by wins: `anchorPad4`, `18/18`, `-3.65%`
- conclusion level: `pad_sweep_no_better_candidate`

Latest DeepSeek pad sweep result:

- request count: `900`
- valid request count: `900`
- cache field visibility: `900/900`
- best cost delta vs anchorPad8 by wins: `anchorPad4`, `18/18`, `-2.05%`
- conclusion level: `pad_sweep_no_better_candidate`

## Readable Full/Lite POC benchmark

Readable POC command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode readablePoc --output tests/outputs/private/provider-cache-benchmark-readable-poc.raw.json
```

Smoke command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode readablePoc --repeat-count 2 --project-limit 1 --scenario-limit 2 --output tests/outputs/private/provider-cache-benchmark-readable-poc-smoke.raw.json --summary-output tests/outputs/provider-cache-benchmark-readable-poc-smoke.latest.json
```

`readablePoc` compares `natural`, `readableFull`, `readableFullPad4`, `readableLite`, and `readableLitePad4`. The padded variants use the hidden Markdown comment `<!-- BASEBRIEF_CACHE_PAD: p p p p -->` before the dynamic tail request.

Readable Markdown cost evidence requires `>= 15/18` estimated-cost wins against the matching non-padded readable baseline and at least `5%` lower overall median estimated cost. Anything below that stays POC-only.

Latest MiMo readable POC result:

- request count: `900`
- valid request count: `900`
- cache field visibility: `900/900`
- `readableFullPad4`: `6/18` estimated-cost wins, `-0.04%` overall estimated-cost delta
- `readableLitePad4`: `5/18` estimated-cost wins, `-7.04%` overall estimated-cost delta
- conclusion level: `readable_poc_inconclusive`

Latest DeepSeek readable POC result:

- request count: `900`
- valid request count: `900`
- cache field visibility: `900/900`
- `readableFullPad4`: `0/18` estimated-cost wins, `+10.56%` overall estimated-cost delta
- `readableLitePad4`: `0/18` estimated-cost wins, `+15.04%` overall estimated-cost delta
- conclusion level: `readable_poc_inconclusive`

## BB5 Cache Sidecar benchmark

BB5 sidecar command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode sidecar --output tests/outputs/private/provider-cache-benchmark-sidecar.raw.json
```

Smoke command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode sidecar --repeat-count 2 --project-limit 1 --scenario-limit 2 --output tests/outputs/private/provider-cache-benchmark-sidecar-smoke.raw.json --summary-output tests/outputs/provider-cache-benchmark-sidecar-smoke.latest.json
```

`sidecar` compares `natural`, `readableFull`, `readableLite`, `bb4AnchorPad`, `bb5SidecarFull`, and `bb5SidecarLite`. The readable variants are the human track. The sidecar variants are compact cache-economics prompts derived from the same facts.

BB5 evidence requires `>= 15/18` estimated-cost wins against `natural` and at least `5%` lower overall median estimated cost. To be considered better than BB4, it also needs to be no worse than `bb4AnchorPad` on overall median estimated cost.

Latest MiMo sidecar result:

- request count: `1080`
- valid request count: `1080`
- cache field visibility: `1080/1080`
- `bb5SidecarFull`: `16/18` estimated-cost wins vs natural, `-11.59%` overall estimated-cost delta vs natural, `+1.42%` vs BB4, conclusion `bb5_sidecar_full_cost_evidence`
- `bb5SidecarLite`: `15/18` estimated-cost wins vs natural, `-27.39%` overall estimated-cost delta vs natural, `-16.70%` vs BB4, conclusion `bb5_sidecar_lite_best_evidence`
- conclusion level: `bb5_sidecar_best_evidence`

Latest DeepSeek sidecar result:

- request count: `1080`
- valid request count: `1080`
- cache field visibility: `1080/1080`
- `bb5SidecarFull`: `14/18` estimated-cost wins vs natural, `-17.16%` overall estimated-cost delta vs natural, `-8.14%` vs BB4, conclusion `bb5_sidecar_full_promising_signal`
- `bb5SidecarLite`: `2/18` estimated-cost wins vs natural, `+6.36%` overall estimated-cost delta vs natural, `+17.94%` vs BB4, conclusion `bb5_sidecar_lite_inconclusive`
- conclusion level: `bb5_sidecar_promising_signal`

Current interpretation: BB5 Sidecar is the strongest cache-economics line so far, but provider behavior differs. MiMo favors the Lite sidecar. DeepSeek favors the Full sidecar but missed the strict `15/18` evidence threshold by one scenario, so it remains promising rather than proven.

## BB6 Hybrid Anchor benchmark

BB6 hybrid command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode hybrid --output tests/outputs/private/provider-cache-benchmark-hybrid.raw.json
```

Smoke command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode hybrid --repeat-count 2 --project-limit 1 --scenario-limit 2 --output tests/outputs/private/provider-cache-benchmark-hybrid-smoke.raw.json --summary-output tests/outputs/provider-cache-benchmark-hybrid-smoke.latest.json
```

`hybrid` compares `natural`, `bb4AnchorPad`, `bb5SidecarFull`, `bb5SidecarLite`, `bb6HybridFull`, and `bb6HybridLite`. The BB6 variants keep a natural project snapshot stable, register both tail options before the dynamic boundary, and change only final `CHOICE=A/B`.

BB6 evidence requires `>= 15/18` estimated-cost wins against `natural`, at least `5%` lower overall median estimated cost, and no weaker than the matching BB5 sidecar.

Latest DeepSeek hybrid result:

- request count: `1080`
- valid request count: `1080`
- cache field visibility: `1080/1080`
- `bb6HybridLite`: `14/18` estimated-cost wins vs natural, `-18.04%` overall estimated-cost delta vs natural, conclusion `bb6_hybrid_lite_promising_signal`
- conclusion level: `bb6_hybrid_promising_signal`

## BB7 Block Pad and BB9 Adaptive Selector benchmark

Blockpad command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode blockpad --output tests/outputs/private/provider-cache-benchmark-blockpad.raw.json
```

`blockpad` compares `natural`, `bb5SidecarLite`, `bb6HybridLite`, and `bb7BlockPadLite`. It also reports `bb9AdaptiveSelector`, which selects the lowest estimated-cost candidate per project-scenario comparison.

Latest MiMo blockpad / selector result:

- request count: `720`
- valid request count: `716`
- cache field visibility: `714/716`
- `bb7BlockPadLite`: `10/18` estimated-cost wins vs natural, conclusion `bb7_blockpad_inconclusive`
- `bb9AdaptiveSelector`: `18/18` estimated-cost wins vs natural, `18/18` no-worse-than-natural, `-40.59%` median estimated-cost delta, conclusion `bb9_adaptive_selector_best_evidence`
- conclusion level: `bb9_adaptive_selector_best_evidence`

Latest DeepSeek blockpad / selector result:

- request count: `720`
- valid request count: `720`
- cache field visibility: `720/720`
- `bb7BlockPadLite`: `12/18` estimated-cost wins vs natural, conclusion `bb7_blockpad_promising_signal`
- `bb9AdaptiveSelector`: `17/18` estimated-cost wins vs natural, `18/18` no-worse-than-natural, `-26.54%` median estimated-cost delta, conclusion `bb9_adaptive_selector_best_evidence`
- conclusion level: `bb9_adaptive_selector_best_evidence`

Current interpretation: the strongest mechanism is not one universal cache-ready prompt. It is calibrated selection among natural, BB5 Lite, BB6 Lite, and BB7 block-pad Lite variants. This is still provider- and sample-specific estimated-cost evidence.

## GPT-5.5 relay usage audit

Relay usage audit command:

```bash
node scripts/provider_relay_usage_audit.js --output tests/outputs/private/provider-relay-usage-audit.raw.json --summary-output tests/outputs/provider-relay-usage-audit.latest.json
```

This audit is for `GPT-5.5 via third-party Codex OAuth relay` style routes. It uses synthetic prompts and does not send local project content.

The audit must run before any relay benchmark. It checks:

- whether `/chat/completions` returns stable usage fields
- whether `cached_tokens` is visible
- whether repeated identical prompts change provider-visible input token accounting
- whether the route should be treated as `cache_tokens_visible`, `input_tokens_may_reflect_billing_or_relay_accounting`, `token_length_observation_only`, or `usage_unusable`

Stop before benchmark if the result is `token_length_observation_only` or `usage_unusable`, or if valid request rate is below `90%`. Relay results are `relay_specific_observation`; they must not be described as OpenAI official API evidence.

Latest `sanye.mom` GPT-5.5 relay audit result:

- request count: `6`
- valid request count: `6`
- usage visible: `6/6`
- cache field visibility: `0/6`
- repeated identical prompt token values: `[70]`
- usage interpretation: `token_length_observation_only`
- benchmark recommended: `false`
- stop reason: `cache_cost_not_observable`

Because cache-aware cost is not observable from this relay response, no relay smoke benchmark or larger benchmark was run.

## BB9 handoff POC checks

BB9 handoff generation is local-only and does not call a provider:

```bash
node scripts/generate_bb9_handoff.js --input examples/bb9-handoff-full-input.json --mode full --provider-profile mimo
node scripts/generate_bb9_handoff.js --input examples/bb9-handoff-lite-input.json --mode lite --provider-profile deepseek
node scripts/generate_bb9_handoff.js --input examples/bb9-handoff-lite-input.json --mode lite --provider-profile relay-openai-gpt55-codex-oauth
node scripts/generate_bb9_handoff.js --input examples/bb9-handoff-full-input.json --mode full --provider-profile mimo --print activeProviderPrompt
```

Expected behavior:

- MiMo and DeepSeek profiles emit both `readableBrief` and `cacheSidecar`.
- Supported profiles set `recommendedPromptType=cacheSidecar`; unsupported profiles set `recommendedPromptType=readableBrief`.
- `activeProviderPrompt` equals `cacheSidecar` for supported profiles and `readableBrief` for unsupported profiles.
- The relay profile emits `readableBrief`, sets `cacheSidecar` to `null`, selects `natural`, and reports `fallbackReason=cache_cost_not_observable`.
- No provider API key is needed for this generator.
- The generator does not prove new provider savings; it only applies the already recorded BB9 provider-profile evidence.
- Do not concatenate `readableBrief` and `cacheSidecar` into one provider request; use the artifact named by `recommendedPromptType`.

BB9 handoff POC provider benchmark:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode handoffPoc --output tests/outputs/private/provider-cache-benchmark-handoff-poc.raw.json
```

Smoke command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode handoffPoc --repeat-count 2 --project-limit 1 --scenario-limit 2 --output tests/outputs/private/provider-cache-benchmark-handoff-poc-smoke.raw.json --summary-output tests/outputs/provider-cache-benchmark-handoff-poc-smoke.latest.json
```

`handoffPoc` compares `readableFull`, `readableFullSidecar`, `readableLite`, `readableLiteSidecar`, and `bb9Best`. It answers a negative-control question: whether directly concatenating readable handoff plus sidecar still improves estimated cost.

Handoff POC evidence requires:

- valid request rate `>= 90%`
- cache field visibility `>= 95%`
- `readableFullSidecar` or `readableLiteSidecar` wins estimated cost against the matching readable baseline in at least `15/18` comparisons
- overall median estimated cost is at least `5%` lower than the matching readable baseline

If it misses this threshold, keep BB9 as an experimental sidecar and do not merge it into ordinary `full` / `lite`.

BB10 active prompt POC provider benchmark:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode activePromptPoc --output tests/outputs/private/provider-cache-benchmark-active-prompt-poc.raw.json
```

Smoke command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode activePromptPoc --repeat-count 2 --project-limit 1 --scenario-limit 2 --output tests/outputs/private/provider-cache-benchmark-active-prompt-poc-smoke.raw.json --summary-output tests/outputs/provider-cache-benchmark-active-prompt-poc-smoke.latest.json
```

`activePromptPoc` compares `readableFull`, `readableLite`, `cacheSidecarFullOnly`, `cacheSidecarLiteOnly`, and `bb9Best`. It tests the single-active-prompt policy, not the concatenation policy.

BB10 active prompt evidence requires:

- valid request rate `>= 90%`
- cache field visibility `>= 95%`
- sidecar-only estimated cost wins against the matching readable baseline in at least `15/18` comparisons
- overall median estimated cost is at least `5%` lower than the matching readable baseline
- sidecar-only is no worse than `bb9Best` in all `18/18` comparisons before it can be called a merge candidate

Latest MiMo active prompt POC result:

- request count: `360`
- valid request count: `340`
- cache field visibility: `340/340`
- `cacheSidecarFullOnly`: `1/18` estimated-cost wins vs readable Full, `+20.47%` overall estimated-cost delta, conclusion `bb10_active_prompt_full_inconclusive`
- `cacheSidecarLiteOnly`: `17/18` estimated-cost wins vs readable Lite, `-4.25%` overall estimated-cost delta, `11/18` no-worse-than-`bb9Best`, conclusion `bb10_active_prompt_lite_promising_signal`
- conclusion level: `bb10_active_prompt_promising_signal`

Interpretation: BB10 Lite sidecar-only is promising on MiMo, but it missed the strict merge-candidate threshold because the median estimated-cost reduction was below `5%` and it was not no-worse than `bb9Best` in all comparisons. Do not merge it into ordinary `full` / `lite` yet.

Latest DeepSeek active prompt smoke result:

- request count: `20`
- valid request count: `20`
- cache field visibility: `20/20`
- sidecar-only was more expensive than the readable baselines and worse than `bb9Best`
- conclusion: stop before DeepSeek large sample for this variant

## v0.3.2 Receiver Flow Draft Skeleton

`v0.3.2` receiver flow draft skeleton closure should use:

```text
git diff --check
node --test tests/basebrief.test.js
node scripts/run_release_checks.js
npm run check
```

This closure does not require provider requests, external receiver matrices, OpenCode smoke, Claude Code smoke, Auto Flow runs, Web UI checks, Cursor adapter tests, or provider benchmarks. When provider environment variables are absent, release checks must keep `provider_probe_status=skipped`.

`receiver-flow` generates draft-only output: `handoff_status: draft_needs_review`. The generated `flow-summary.json`, `receiver-check.json`, and `draft-context.md` must be reviewed before they are shared or rewritten into a `ready_for_receiver` handoff.

## v0.3.3 Receiver Flow Dogfooding Evidence

`v0.3.3` receiver-flow dogfooding evidence closure should use:

```text
git diff --check
node --test tests/basebrief.test.js
node scripts/run_release_checks.js
npm run check
```

This closure is evidence-only. It does not require provider requests, receiver thread creation, external receiver matrices, OpenCode smoke, Claude Code smoke, Auto Flow runs, Web UI checks, Cursor adapter tests, or provider benchmarks. When provider environment variables are absent, release checks must keep `provider_probe_status=skipped`.

Receiver-flow examples must pass Artifact Checker with zero errors and warnings. Examples may show `handoff_status: draft_needs_review`; they must not present a draft as `handoff_status: ready_for_receiver`.

## v0.4.0 Integrated Local Toolchain Release Candidate

`v0.4.0` release-candidate closure should use:

```text
git diff --check
node --test tests/basebrief.test.js
node scripts/run_release_checks.js
npm run check
```

This closure integrates the existing local toolchain: BB9 handoff, CLI Lite, Artifact Checker, Receiver Safe Check, Receiver Flow Draft, Seal/Diff, local npm validation scripts, and public-safe evidence. It does not require provider requests, receiver thread creation, external receiver matrices, OpenCode smoke, Claude Code smoke, Auto Flow runs, Web UI checks, Cursor adapter tests, CI matrix, internationalization work, or provider benchmarks.

When provider environment variables are absent, release checks must keep `provider_probe_status=skipped`. v0.4.0 must not be described as a hosted platform, provider gateway, published npm package, installed CLI, or Auto Flow release.

## v0.8.2 Sidecar Receiver Acceptance Evidence

`v0.8.2` closes a local sidecar receiver-acceptance evidence pass. It uses the
existing `sidecar-build` and `sidecar-check` commands for both `generic` and
`openclaw` targets, then verifies both generated bundles with Artifact Checker.

The v0.8.x matrix is tracked in
[testing-v0.8.x-test-matrix.md](testing-v0.8.x-test-matrix.md). This closure
does not require provider smoke, receiver thread creation, external receiver
matrices, OpenCode smoke, Claude Code smoke, Auto Flow runs, runtime
integration, or provider benchmarks.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## v0.8.4 External Receiver Smoke Evidence

`v0.8.4` prepares a public-safe external receiver smoke packet for the v0.8.x
Sidecar flow. It generates `generic` and `openclaw` sidecar bundles, validates
both with `sidecar-check`, and checks both with Artifact Checker.

OpenCode and Claude Code CLI availability was recorded, but Codex did not pass
the receiver prompts into those tools because that would be an external
runner/model invocation. The receiver execution status is therefore
`manual_required`, not `passed`.

The v0.8.x matrix is tracked in
[testing-v0.8.x-test-matrix.md](testing-v0.8.x-test-matrix.md). This closure
does not require provider smoke, receiver thread creation, Auto Flow runs,
runtime integration, OpenClaw/Hermes runtime connection, or provider
benchmarks. No raw private output is copied into public docs.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```
