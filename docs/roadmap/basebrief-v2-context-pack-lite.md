# BaseBrief v2 Context Pack Lite

Date: 2026-06-08

This document freezes the public direction for the next BaseBrief product line.
It is a planning baseline, not a release, not a command implementation, not a
schema change, and not a provider, runtime, plugin, MCP, IDE, hosted, or
workflow-runner claim.

## Direction

BaseBrief v2.0 is Context Pack Lite.

The public subtitle can be Local Context Compiler POC, but the public product
name should stay Context Pack Lite. The goal is to compile a repository, recent
delta, receiver state, key docs, and risk boundaries into a local, reviewable,
file-based context pack that a new AI window or coding agent can read before
continuing work.

This extends the existing handoff compiler direction without turning BaseBrief
into a repo dump tool. The value is not to include more code. The value is to
package the minimum continuation context with review status, source, trust, and
staleness made explicit.

## Relationship To v1.x

The v1.x Delta Receiver line is frozen as the baseline:

```text
v1.0 Delta Handoff
v1.1 Delta Receiver Acceptance
v1.2 Delta Receiver Report Kit
v1.3 Delta Receiver Starter Integration
v1.4 Delta Receiver Usage Pack
v1.5 Delta Receiver Lint Mini
v1.6 Delta Receiver Lint Fixture Pack
v1.7 Delta Receiver Lint Repair Pack
v1.8 Delta Receiver Lint Dogfooding Evidence
v1.9 Delta Receiver Lint Discoverability / Adoption
v1.9.1 Final Closure / Freeze
```

That line already defines how changed work is handed off, how receivers report
live facts versus inherited facts, and how receiver lint examples are made
public-safe. v2.0 should use that line as input context, not keep extending it
through unlimited v1.9.x navigation patches.

In short:

```text
v1.x answers: what changed, and how should a receiver accept it?
v2.0 answers: what local context pack should a new window read before acting?
```

## Why Context Pack Lite Before Resume And Runner

Context Pack Lite should lead v2.x because it gives later user-facing commands
something stable to read. One-command Resume is valuable, but a resume prompt is
only useful when the underlying pack is complete, public-safe, bounded, and
honest about missing inputs.

Workflow Runner Lite remains a later possibility, but it should not lead v2.x.
A runner only chains existing steps. If the central artifact and resume surface
are not clear yet, the runner mostly wraps old commands and creates more
workflow surface.

The recommended order is:

```text
v2.0 Context Pack Lite
v2.1 Context Pack Check
v2.2 One-command Resume / New-window Prompt
v2.3 BaseBrief Format
v2.4 File-only Adapter / MCP-friendly Export
v2.5 Context Pack Doctor
v3.x Workflow Runner Lite or watcher/dashboard work, only after local usage proves need
```

Context Pack Lite gives resume and later runner work something meaningful to
produce. Context Pack Check should come first so the resume surface does not
copy an incomplete or unsafe pack into a new window.

## Non-Goals

v2.0-A does not implement a new command. The next implementation phase may add
a small local generator only after this direction and artifact contract are
reviewed.

The v2.0 line is also not:

- a provider request path
- an AI auto-summary feature
- a vector, embedding, or semantic-index system
- an agent runtime
- a daemon or background workflow
- a watcher, dashboard, or prediction engine
- a plugin, MCP server, IDE integration, hosted service, or cloud-memory layer
- a schema-v2 project
- `basebrief-project-state-v2`
- `basebrief-sidecar-v2`
- a Workflow Runner
- a Repomix or Gitingest replacement
- an npm publish, global CLI install, push, tag, release, or pull request

## Context Pack Lite Artifacts

The recommended public artifact set is:

```text
MANIFEST.md
REPO_MAP.md
KEY_FILES.md
RECENT_DELTA.md
RISK_BOUNDARIES.md
RECEIVER_STATE.md
NEXT_WINDOW_STARTER.md
```

Each file should be readable, reviewable, and safe to omit or replace when the
input is missing.

### MANIFEST.md

Defines pack identity, generation facts, reading order, and safety notes.

Expected roles:

- name the project and pack mode
- record branch, HEAD, worktree status, and optional since commit
- explain the file reading order
- state that the pack is not complete proof of repository state

### REPO_MAP.md

Gives a small repository map, not a full repo dump.

Expected roles:

- list top-level directories and their roles
- identify source, docs, scripts, tests, templates, and examples entry points
- explicitly exclude `.git`, dependency folders, generated output, `.env`, and
  private notes

### KEY_FILES.md

Lists the files a receiver or new AI window should inspect first.

Expected roles:

- group key files by project entry, current cycle, scripts, checks, templates,
  examples, and specs
- prefer public docs and stable entry points over exhaustive file lists
- mark unknown or missing sections as `not_available` or `not_applicable`

### RECENT_DELTA.md

Connects the v1.x delta line to the context pack.

Expected roles:

- record commit range, recent commits, and changed files when available
- preserve `reviewed` and `needs-review` separation
- mark stale inherited facts as stale instead of refreshing them silently

### RISK_BOUNDARIES.md

Centralizes the boundaries that must be read before edits are proposed.

Expected roles:

- list hard no-go areas
- list actions requiring explicit approval
- keep secrets, raw private output, private absolute paths, provider requests,
  runtime work, plugin work, MCP work, IDE work, schema-v2, publication, and
  repo-dump behavior out of scope

### RECEIVER_STATE.md

Summarizes receiver-side status without requiring every repository to have a
complete receiver history.

Expected roles:

- record current receiver contract when known
- record acceptance, lint, fixture, repair, and dogfooding status when known
- allow `not_applicable` when the target repo has no receiver history
- allow a minimal shell when receiver facts are unavailable

### NEXT_WINDOW_STARTER.md

Gives a copyable starter for the next AI window.

Expected roles:

- tell the receiver which context pack files to read first
- require live repo fact checks before implementation
- preserve the risk boundaries and frozen v1.x status
- ask the receiver to report gaps instead of inventing missing context

## Review Semantics

Every generated section should make its evidence quality explicit when the
answer is not obvious from the file name.

Use these statuses:

- `reviewed`: human-reviewed or accepted from an already reviewed BaseBrief
  artifact
- `needs-review`: generated or inferred from local commands and not yet accepted
  by a human
- `generated`: mechanically produced from local repository files or git facts
- `not_available`: the source was expected but not found
- `not_applicable`: the field does not apply to this repository or stage
- `stale`: inherited from an older handoff and not verified against the live
  repository in the current run

Use these metadata fields where useful:

- `source`: file, command, or artifact that provided the claim
- `trust`: `high`, `medium`, or `low`
- `stale`: `true` or `false`

Do not turn missing inputs into invented facts. If `.basebrief/state.json`,
`delta-handoff.md`, receiver output, or git range data is absent, the pack
should say so with `not_available`, `not_applicable`, or `needs-review`.

## Phase Plan

### v2.0-A Direction Freeze

Freeze the public-safe roadmap, release plan, and artifact spec for Context
Pack Lite.

Expected files:

- `docs/roadmap/basebrief-v2-context-pack-lite.md`
- `docs/releases/v2.0.0-plan.md`
- `docs/specs/context-pack-lite.md`

### v2.0-B Minimal Generator

After review, add a small rule-based, file-based generator under the existing
`scripts/` surface. Avoid a large `src/` migration for the POC.

Minimal command:

```text
node scripts/basebrief.js context-pack --repo <target-repo> --output-dir <dir> [--since <commit>] [--max-files <n>] [--json]
```

This command should generate the seven Context Pack Lite Markdown artifacts
from local repository facts, fixed public-safe entry files, and recent git
facts. It should not add schema-v2, provider requests, AI summaries, vector
indexes, runtime behavior, plugin surfaces, MCP, IDE integration, or Workflow
Runner behavior.

### v2.1 Context Pack Check

Prefer integrating checks into the existing `check` family before adding more
top-level commands. v2.1-A freezes the check contract in
`docs/releases/v2.1.0-plan.md` and `docs/specs/context-pack-check.md`; it does
not implement a checker rule family yet.

The eventual checker should verify missing files, shared review metadata,
unsafe content, conservative thickness limits, explicit stale semantics, and
missing-input degradation. It should not prove every live fact is true; the
receiver still has to recheck branch, HEAD, worktree, and relevant file state
before edits.

### v2.2 One-command Resume / New-window Prompt

After Context Pack Lite exists and can be checked, add a narrow resume surface
that reads the latest context pack and prepares a copyable new-window prompt.

The first command surface is:

```text
node scripts/basebrief.js resume --input <context-pack-dir> [--json]
```

The command should print prompt text only. It should reuse the existing Context
Pack Check result, allow warning-only packs with review notes, and stop when
checker errors are present. It should not send provider requests, create
external sessions, call AI, run a daemon, introduce a `new-window` alias in the
first slice, or modify files.

v2.2-A is frozen in `docs/releases/v2.2.0-plan.md` and
`docs/specs/context-pack-resume.md`.

v2.2-C is closed in `docs/releases/v2.2.0.md` with dogfooding evidence in
`docs/dogfooding/context-pack-resume-v2.2.0.md`.

### v2.3 BaseBrief Format

After resume proves useful, define a stable local-first handoff format for AI
coding agents. Use restrained wording: BaseBrief can provide a local handoff
format, not claim to be an industry standard or universal protocol.

Likely artifacts belong to a later format line, not v2.1:

```text
context.json
context-pack.md
context-pack/
```

This should not be schema-v2 and should not change
`basebrief-project-state-v1` or `basebrief-sidecar-v1`.

v2.3-A is docs-first only. It is frozen in `docs/releases/v2.3.0-plan.md` and
`docs/specs/basebrief-format.md`; it does not implement a command, generator,
JSON schema file, format emission, provider request, runtime integration,
plugin, MCP, IDE, hosted service, cloud-memory feature, or Workflow Runner.

### v2.4 File-only Adapter / MCP-friendly Export

Export files that other tools can consume, without implementing plugins,
runtime integrations, or an MCP server. This is adapter output only.

v2.4-A is docs-first only. It is frozen in
`docs/releases/v2.4.0-plan.md` and `docs/specs/file-only-export.md`; it does
not implement a command, generator, exporter, JSON schema file, schema-v2,
provider request, runtime integration, plugin, MCP server, IDE, hosted service,
cloud-memory feature, or Workflow Runner.

The planned file-only export family is:

```text
exports/
exports/manifest.json
exports/context-pack.md
exports/context.json
exports/adapter-notes.md
```

v2.4-B is the minimal local implementation. It is closed in
`docs/releases/v2.4.0.md` and adds only:

```text
node scripts/basebrief.js export --input <context-pack-dir> --output-dir <dir> [--json]
```

The command reads checked Context Pack Lite directories and writes file-only
export artifacts. It does not change Context Pack Lite generator output,
Context Pack Check JSON shape, or Resume behavior.

v2.4-C is dogfooding evidence. It is recorded in
`docs/dogfooding/file-only-export-v2.4.0.md` and verifies that the four-file
export bundle is enough for a receiver-style continuation review while still
requiring live repo fact rechecks before implementation.

v2.4-D is example-kit and contract-wording polish. It adds
`examples/file-only-export/` and clarifies that `exports/` is a recommended
example output directory name, while the CLI writes files directly under the
explicit `--output-dir`.

### v2.5 Status / Doctor / Change-sensing Lite

Add manual diagnostics only after the pack, check, resume, format, and
file-only export surfaces are stable. v2.5 chooses `doctor` first and leaves a
broader `status` command for a later slice because `state-status` already
belongs to Project State.

v2.5 is closed in `docs/releases/v2.5.0.md`, with contract docs in
`docs/releases/v2.5.0-plan.md` and `docs/specs/context-pack-doctor.md`,
dogfooding evidence in `docs/dogfooding/context-pack-doctor-v2.5.0.md`, and a
public-safe sample in `examples/context-pack-doctor/`.

The local command is:

```text
node scripts/basebrief.js doctor --repo <target-repo> --context-pack <context-pack-dir> [--json]
```

Doctor is manually triggered, conservative, source-backed, and read-only. It
reports dirty worktrees, stale pack HEADs, branch mismatches, Context Pack
Check findings, missing local-only boundary wording, and live-recheck reminders.
It does not write files, auto-fix, auto-discover packs, call providers, create
a watcher, run a daemon, add runtime behavior, create plugins, create an MCP
server/tools, add schema-v2, or become a Workflow Runner.

### v2.6 First-Run / Adoption Polish

v2.6 is closed in `docs/releases/v2.6.0.md`. It is adoption polish only:
quickstart first-run guidance, minimal examples, clean/warning/broken Context
Pack examples, Check vs Doctor guidance, and documentation-index information
architecture.

It does not add a command, change Context Pack Lite generator output, change
`check --input <dir> --json`, change resume/export/doctor contracts, add a
status command, call providers, add runtime behavior, create plugins, create an
MCP server/tools, add schema-v2, or become a Workflow Runner.

### v2.6.x Local Adoption Notes

After v2.6.0, adoption feedback should accumulate as v2.6.x local notes before
opening another minor-version line. This is dogfooding feedback, not a new
command or contract line.
The first public-safe record is
`docs/dogfooding/context-pack-adoption-notes-v2.6.1.md`.

The loop records real first-run friction from README, quickstart, minimal
examples, Context Pack Check, Resume, and Doctor. It classifies observations as
`blocking`, `confusing`, or `nice-to-have`, then fixes only blocking or repeated
confusing docs/examples friction.

It does not add a status command, change Context Pack Lite generator output,
change `check --input <dir> --json`, change Doctor JSON, call providers, add
runtime behavior, create plugins, create an MCP server/tools, add schema-v2, or
become a Workflow Runner.

### v2.6.4 External Reference Alignment

`docs/dogfooding/context-engineering-reference-notes-v2.6.4.md` maps external
context engineering, handoff artifact, memory hygiene, stateless reducer, and
context compression guidance to the existing BaseBrief Context Pack line.

This is not a new feature line or contract. It is direction-setting evidence for
later v3 discussion only. v3 Continuation Harness or Workflow Runner Lite should
wait until repeated real adoption friction points to the same missing capability.

`docs/dogfooding/context-pack-adoption-scenario-matrix-v2.6.5.md` turns the
adoption notes into a check/resume/doctor decision matrix. It is adoption
evidence, not a new command line, Status command, Workflow Runner, or contract.

`docs/dogfooding/context-pack-first-run-fixture-lab-v2.6.6.md` maps the
scenario matrix back to existing public example kits and dogfooding notes. It
is a first-run fixture-reading lab, not new fixture generation, not a command
line, and not a JSON contract change.

`docs/dogfooding/context-pack-first-run-rehearsal-audit-v2.6.7.md` records a
real first-run rehearsal through README, quickstart, minimal examples,
Context Pack generation, Check, Resume, Doctor, and public example kits. It is
adoption evidence only; no blocking friction was found, and it does not justify
a Status command, Workflow Runner, or JSON contract change.

`docs/dogfooding/context-pack-first-run-friction-repair-v2.6.8.md` repairs the
confusing first-run items from v2.6.7 by clarifying the quickstart route and
documenting Windows/PowerShell UTF-8 display handling. It is docs/examples
polish only, not a new command, Status surface, Workflow Runner, or JSON
contract change.

`docs/dogfooding/context-pack-adoption-decision-checkpoint-v2.6.9.md`
summarizes v2.6.1 through v2.6.8 and decides to continue v2.6.x local adoption
incubation. Current evidence does not justify Status, Workflow Runner Lite,
v3 Continuation Harness, provider/runtime integration, MCP server/tools,
schema-v2, hosted memory, daemon, watcher, or new public fixture generation.

`docs/dogfooding/context-pack-pre-release-bundle-audit-v2.6.10.md` audits the
ahead-7 local adoption bundle before any push, tag, release, or pull request.
It confirms the bundle is docs/examples/release-check/adoption polish only.
It is not a release closeout, feature implementation, CLI behavior change, Status command, Workflow Runner, or JSON contract change.

`docs/dogfooding/context-pack-feature-feasibility-spike-v2.6.11.md` evaluates
Continuation Harness Lite as a feasibility spike with implementation_status: not_started.
It asks whether real users need a narrower helper around `context-pack -> check -> resume -> live recheck`.
It is not a feature implementation, new command, Status command, Workflow Runner, or JSON contract change.

`docs/dogfooding/context-pack-local-bundle-review-rehearsal-v2.6.12.md` reviews
the ahead-9 local adoption bundle and rehearses `context-pack -> check -> resume -> live recheck`.
The rehearsal passed with `check_status: passed`, `resume_status: ready`, and
`doctor_info_findings: doctor.live-recheck-required`; it keeps
Continuation Harness Lite, Status, Workflow Runner, and JSON contract changes
not started.

`docs/dogfooding/context-pack-local-bundle-compression-v2.6.13.md` compresses
the ahead-10 local adoption bundle into a future major-release candidate
narrative. It is not a release closeout, feature implementation, new command,
Status command, Workflow Runner, Continuation Harness implementation, or JSON
contract change.

`docs/dogfooding/context-pack-release-check-maintainability-v2.6.14.md` repairs
release-check fragility by adding whitespace-normalized phrase matching for
long prose assertions. It is release-check maintainability only, not a command,
feature implementation, Status command, Workflow Runner, or JSON contract
change.

`docs/dogfooding/context-pack-major-release-candidate-shape-v2.6.15.md` shapes
the local v2.6.x bundle into a future major-release candidate outline. It is a
staging outline only, not a release closeout, publish action, feature
implementation, Status command, Workflow Runner, Continuation Harness
implementation, or JSON contract change.

`docs/dogfooding/context-pack-continuation-harness-decision-spec-v2.6.16.md`
defines the evidence thresholds for considering Continuation Harness Lite. It is
a decision spec only with implementation_status: not_started; it does not add a
command, Status command, Workflow Runner, provider request, runtime integration,
MCP server/tools, plugin, schema-v2, hosted memory, or JSON contract change.

`docs/dogfooding/context-pack-ahead14-bundle-review-v2.6.17.md` reviews the
ahead-14 local adoption bundle and separates release-note candidates,
dogfooding-only evidence, and future feature gates. It is not a release
closeout, push/tag/release action, feature implementation, Continuation Harness
implementation, Status command, Workflow Runner, or JSON contract change.

`docs/dogfooding/context-pack-minimal-feature-candidate-decision-v2.6.18.md`
keeps Continuation Harness Lite as a design-sketch candidate only and rejects
Status, Workflow Runner, Doctor expansion, and JSON contract changes for now.
It requires repeated real handoff friction before any implementation, and does
not add a command, provider request, runtime integration, MCP server/tools,
plugin, schema-v2, hosted memory, or release action.

`docs/dogfooding/context-pack-first-run-handoff-validation.md` records a local
README/quickstart validation pass through `context-pack -> check -> resume ->
doctor`. It observed clean `check`, preserved `Continuation rules:`, confirmed
`basebrief-doctor-v1` with `doctor.live-recheck-required`, and did not meet the
feature trigger for Continuation Harness Lite, Status, Workflow Runner, or JSON
contract changes.

`docs/dogfooding/context-pack-continuation-harness-lite-design-sketch.md`
defines a paper Continuation Harness Lite sketch only. It proposes a five-step
human flow, a state machine from `pack_missing` to `user_goal_required`, and
entry criteria before implementation, while keeping command_status:
not_started, implementation_status: not_started, Status, Workflow Runner,
provider/runtime/MCP/plugin/schema-v2/hosted-memory scope, and JSON contract
changes closed.

`docs/dogfooding/context-pack-continuation-harness-lite-paper-rehearsal.md`
rehearses the sketch against clean pack, too-thick warning, broken pack,
stale/live drift, and missing pack scenarios. The paper rehearsal covers
`check_passed + live_match -> resume_ready -> user_goal_required`,
`check_warning -> human_review`, `check_failed -> repair_pack`,
`check_passed + live_drift -> doctor_or_refresh`, and
`pack_missing -> blocked`. It does not trigger implementation and keeps
implementation_status: not_started, command_status: not_started, Status,
Workflow Runner, provider/runtime/MCP/plugin/schema-v2/hosted-memory scope, and
JSON contract changes closed.

`docs/dogfooding/context-pack-local-bundle-compression-v2.6.20.md` compresses
the ahead-19 local adoption and design bundle into future release-note
candidates, dogfooding-only evidence, release-check / contract protections, and
feature gates / deferred candidates. It is local bundle compression only, not a
release closeout, push/tag/release action, PR, feature implementation, new
command, Continuation Harness Lite implementation, Status command, Workflow
Runner, or JSON contract change.

`docs/dogfooding/context-pack-implementation-gate-decision-v2.6.21.md` keeps
Continuation Harness Lite as a future candidate but closes the implementation
gate for now. The paper rehearsal explains clean pack, too-thick warning,
broken pack, stale/live drift, and missing pack scenarios, but current evidence
does not show repeated real blocking or high-frequency confusing friction. The
decision adds no new CLI command, no JSON shape change, no Status, no Workflow
Runner, no Doctor expansion, no provider/runtime integration, no MCP
server/tools, no plugin, no schema-v2, no daemon, no watcher, and no hosted
memory.

`docs/dogfooding/context-pack-release-check-maintainability-plan-v2.6.22.md`
selects release-check maintainability modularization as the next near-term
direction after the ahead-19 compression and implementation gate decision. It
is a plan only, not implementation. The recommended first slice starts with the
v2.x dogfooding/documentation assertion cluster inside
`scripts/run_release_checks.js`, keeps release-check output unchanged, and
defers a separate helper file until internal grouping is proven useful. It
does not add a command, change JSON contracts, start CI, or open Status,
Workflow Runner, Continuation Harness Lite implementation, provider/runtime
integration, MCP, plugin, schema-v2, daemon, watcher, hosted memory, publish,
push, tag, release, or PR work.

`docs/dogfooding/context-pack-runnable-recipes-plan-v2.6.23.md` selects
examples as runnable recipes as the next small usability direction after the
release-check maintainability slice. It tightens the existing minimal,
Context Pack Lite, Context Pack Doctor, and File-only Export README paths with
copyable command chains: `README -> quickstart -> examples/minimal`,
`context-pack -> check -> resume -> doctor`, `check -> doctor`, and
`check -> export`. It does not add a command, change package scripts, change
release-check output, change JSON contracts, alter the Context Pack seven-file
structure, start CI, or open Status, Workflow Runner, provider/runtime
integration, MCP, plugin, schema-v2, daemon, watcher, hosted memory, publish,
push, tag, release, or PR work.

`docs/dogfooding/context-pack-first-run-smoke-path-consolidation-v2.6.24.md`
consolidates the canonical first-run smoke path after the runnable recipe pass:
`README -> docs/index.md -> docs/quickstart-5min.md -> examples/minimal ->
examples/context-pack-lite`, followed by `npm run check`. It keeps Doctor and
File-only Export as follow-up recipes, not mandatory first-run steps. It does
not add a command, change package scripts, change release-check output, change
JSON contracts, alter the Context Pack seven-file structure, start CI, or open
Status, Workflow Runner, Doctor expansion, provider/runtime integration, MCP,
plugin, schema-v2, daemon, watcher, hosted memory, publish, push, tag, release,
or PR work.

`docs/dogfooding/context-pack-output-ux-polish-v2.6.25.md` polishes generated
Context Pack Lite text without changing contracts. It clarifies that live repo
facts are stale-prone and must be rechecked before edits, that `not_available`,
`not_applicable`, and `needs-review` are
missing-input semantics rather than failure states, and that the expected first
response should report live repo facts, separate inherited pack facts from live
rechecks, and list gaps before implementation. It does not add a command, change
package scripts, change
release-check output, change JSON contracts, alter the Context Pack seven-file
structure, start CI, or open Status, Workflow Runner, Doctor expansion,
provider/runtime integration, MCP, plugin, schema-v2, daemon, watcher, hosted
memory, publish, push, tag, release, or PR work.

`docs/dogfooding/context-pack-test-file-split-plan-v2.6.26.md` plans the first
safe split path for the large `tests/basebrief.test.js` file without changing
test-runner behavior or contracts. It identifies current clusters across
docs/release-line assertions, quickstart examples, BB9 handoff, CLI Lite,
Receiver workflows, Project State, Sidecar, Context Pack v2, cache-ready
generators, benchmark summaries, and relay usage audit. The recommended first
implementation slice is `tests/context-pack.test.js` for Context Pack v2 tests,
with cache-ready / benchmark tests and Receiver / Project State workflow tests
deferred until the first split proves useful. It does not split tests yet,
change package scripts, change release-check output, change JSON contracts,
alter the Context Pack seven-file structure, start CI, or open Status, Workflow
Runner, Doctor expansion, provider/runtime integration, MCP, plugin, schema-v2,
daemon, watcher, hosted memory, publish, push, tag, release, or PR work.

`docs/dogfooding/context-pack-test-file-split-v2.6.27.md` implements the first
test-file split from the v2.6.26 plan. Context Pack v2, File-only Export,
Doctor, and Resume tests now live in `tests/context-pack.test.js`; broader
release-line, receiver, project state, sidecar, delta, Seal/Diff, ContextOps,
cache-ready, benchmark, and relay audit coverage remains in
`tests/basebrief.test.js`. The public validation entry remains `npm test`, now
running `node --test tests/basebrief.test.js tests/context-pack.test.js`, with
expected test count still 175 and `independent_test_files=2`. It does not add a
CLI command, change release-check output shape, change JSON contracts, alter
the Context Pack seven-file structure, start CI, or open Status, Workflow
Runner, Doctor expansion, provider/runtime integration, MCP, plugin, schema-v2,
daemon, watcher, hosted memory, publish, push, tag, release, or PR work.

`docs/dogfooding/context-pack-test-file-split-second-candidate-v2.6.28.md`
reviews the stable two-file baseline and selects
`tests/cache-ready-benchmark.test.js` as the second split candidate without
moving tests yet. The selected scope is cache-ready generators, benchmark prompt
variants, benchmark summaries, provider profiles, and relay usage audit
assertions. Receiver, Project State, Sidecar, and docs/release-line assertion
splits remain deferred. The public validation entry remains
`node --test tests/basebrief.test.js tests/context-pack.test.js`, with expected
test count still 175 and `independent_test_files=2`. It does not add a CLI
command, add a new test file, change package scripts, change release-check
output shape, change JSON contracts, alter the Context Pack seven-file
structure, start CI, or open Status, Workflow Runner, Doctor expansion,
provider/runtime integration, MCP, plugin, schema-v2, daemon, watcher, hosted
memory, publish, push, tag, release, or PR work.

`docs/dogfooding/context-pack-cache-ready-benchmark-test-split-v2.6.29.md`
implements the second test-file split from the v2.6.28 candidate decision.
Cache-ready generators, benchmark prompt variants, benchmark summaries,
provider profiles, and relay usage audit tests now live in
`tests/cache-ready-benchmark.test.js`; broader release-line, quickstart,
handoff, adapter, artifact checker, CLI Lite, Receiver, Project State, Sidecar,
Delta, Seal/Diff, ContextOps, template, and receiver-ready coverage remains in
`tests/basebrief.test.js`. Context Pack v2, File-only Export, Doctor, and Resume
coverage remains in `tests/context-pack.test.js`. The public validation entry
remains `npm test`, now running
`node --test tests/basebrief.test.js tests/context-pack.test.js tests/cache-ready-benchmark.test.js`,
with expected test count still 175 and `independent_test_files=3`. It does not
add a CLI command, change release-check output shape, change JSON contracts,
alter the Context Pack seven-file structure, start CI, or open Status, Workflow
Runner, Doctor expansion, provider/runtime integration, MCP, plugin, schema-v2,
daemon, watcher, hosted memory, publish, push, tag, release, or PR work.

`docs/dogfooding/context-pack-test-split-stability-check-v2.6.30.md` checks
the three-file test baseline after the Context Pack and cache-ready benchmark
splits. The current distribution is `tests/basebrief.test.js` with 118 tests,
`tests/context-pack.test.js` with 11 tests, and
`tests/cache-ready-benchmark.test.js` with 46 tests. The public validation entry
remains `node --test tests/basebrief.test.js tests/context-pack.test.js tests/cache-ready-benchmark.test.js`,
with expected test count still 175 and `independent_test_files=3`. The
three-file baseline is kept as useful, while Receiver, Project State, Sidecar,
and docs/release-line assertion splits remain deferred until this baseline
proves stable across more local slices. It does not add a CLI command, add a
new test file, change package scripts, change release-check output shape,
change JSON contracts, alter the Context Pack seven-file structure, start CI,
or open Status, Workflow Runner, Doctor expansion, provider/runtime integration,
MCP, plugin, schema-v2, daemon, watcher, hosted memory, publish, push, tag,
release, or PR work.

`docs/dogfooding/context-pack-v2.6x-local-closeout-gate-v2.6.31.md` closes the
current local v2.6.x dogfooding and maintainability line for now. It records
the three recommended items as completed: cache-ready benchmark test split
implementation, post-split stability check, and release-check maintainability
helper refactor. The next work should move to either a v2.7
planning/implementation line or a release-candidate decision instead of more
small v2.6.x adoption notes. Continuation Harness Lite remains a future
candidate only, while Status, Workflow Runner, Doctor expansion,
provider/runtime integration, MCP, plugin, schema-v2, daemon, watcher, hosted
memory, publish, push, tag, release, and PR work stay closed.

`docs/dogfooding/context-pack-release-candidate-decision-v2.6.32.md` chooses
the release-candidate decision path before v2.7 implementation. It compresses
the ahead-28 local bundle into future release-note candidates, dogfooding-only
evidence, release-check / contract protections, and deferred feature gates. It
records `release_candidate_status: decision_ready_not_published`, keeps v2.7
implementation deferred until the decision explains any remaining user-facing
gap, and keeps new commands, package scripts, release-check output shape,
Context Pack structure, JSON contracts, Status, Workflow Runner, Doctor
expansion, provider/runtime integration, MCP, plugin, schema-v2, daemon,
watcher, hosted memory, publish, push, tag, release, and PR work closed.

`docs/dogfooding/context-pack-release-candidate-summary-draft-v2.6.33.md`
drafts the release-candidate story without starting release closeout. It
separates a public release-note draft from dogfooding-only evidence, keeping the
public story focused on first-run discoverability, runnable recipes,
receiver-facing Context Pack wording, maintained `provider_probe_status=skipped`
semantics, three independent test files, and release-check assertions that
protect docs, examples, commands, and contracts. The next decision remains
release closeout prep versus a narrow v2.7 implementation plan if review finds
one concrete usability gap; no command, package script, release-check output,
Context Pack structure, JSON contract, Status, Workflow Runner, Doctor
expansion, provider/runtime integration, MCP, plugin, schema-v2, daemon,
watcher, hosted memory, publish, push, tag, release, or PR work starts here.

`docs/dogfooding/context-pack-release-closeout-go-no-go-plan-v2.6.34.md`
reviews the release-candidate decision and summary draft, then records
`release_closeout_go_no_go_status: go_to_release_closeout_prep`. It recommends
release closeout prep because the public story is coherent and no concrete
user-facing v2.7 gap has been found. The next slice should convert the public
release-note draft into closeout-ready wording, keep dogfooding-only evidence in
references, record exact validation commands and results, and keep publish,
push, tag, release, and PR actions not_started until separately confirmed. No
command, package script, release-check output, Context Pack structure, JSON
contract, Status, Workflow Runner, Doctor expansion, provider/runtime
integration, MCP, plugin, schema-v2, daemon, watcher, hosted memory, publish,
push, tag, release, or PR work starts here.

`docs/dogfooding/context-pack-release-closeout-prep-draft-v2.6.35.md` converts
the public summary draft and go/no-go decision into closeout-prep wording. It
keeps the release-candidate story focused on first-run discoverability,
runnable examples, receiver-facing Context Pack wording, and validation
confidence while preserving commands, package scripts, JSON contracts, Context
Pack structure, and provider boundaries. It records the validation command set,
expected current-slice results, preserved release-check metric lines, and a
release action checklist with publish, push, tag, release, and PR actions
not_started. No command, package script, release-check output, Context Pack
structure, JSON contract, Status, Workflow Runner, Doctor expansion,
provider/runtime integration, MCP, plugin, schema-v2, daemon, watcher, hosted
memory, publish, push, tag, release, or PR work starts here.

### Later Workflow Runner Lite

Only after Context Pack Lite, Context Pack Check, One-command Resume,
BaseBrief Format, and File-only Export prove useful in local dogfooding,
consider a narrow runner that chains state, delta, context pack generation,
check, and starter output.

## Acceptance Criteria

v2.0-A is acceptable when:

- public docs state that v2.0 equals Context Pack Lite
- the frozen v1.x baseline remains intact
- the roadmap explains why Workflow Runner is later than pack, check, resume,
  and format work
- the docs explicitly reject provider, runtime, plugin, MCP, IDE, hosted,
  cloud-memory, schema-v2, vector, embedding, AI auto-summary, and repo-dump
  work
- the seven recommended artifacts have clear roles
- review, status, source, trust, and stale semantics are defined
- missing input degradation is explicit
- release checks, independent tests, and whitespace checks pass

v2.1-A is acceptable when:

- `docs/releases/v2.1.0-plan.md` freezes the check contract and non-goals
- `docs/specs/context-pack-check.md` defines required files, metadata,
  public-safety, stale, and thickness semantics
- docs keep the preferred surface as existing `check --input <context-pack-dir>`
- docs state that v2.1-A does not implement checker rules, new commands, or
  JSON shape changes
- v2.2 remains One-command Resume / New-window Prompt, while Workflow Runner
  stays later
- release checks, independent tests, and whitespace checks pass

v2.4-A is acceptable when:

- `docs/releases/v2.4.0-plan.md` freezes the file-only export contract and
  non-goals
- `docs/specs/file-only-export.md` defines the future file-only export family
  and MCP-friendly boundary
- docs state that v2.4-A does not implement commands, exporters, JSON schemas,
  schema-v2, provider requests, runtime integrations, plugins, MCP servers,
  IDE integrations, hosted services, cloud-memory behavior, or Workflow Runner
- docs preserve Context Pack Lite generator output, Context Pack Check JSON
  shape, and existing resume behavior
- release checks, independent tests, and whitespace checks pass

v2.4-B is acceptable when:

- CLI Lite exposes `export --input <context-pack-dir> --output-dir <dir>`
- clean packs write exactly `manifest.json`, `context-pack.md`, `context.json`,
  and `adapter-notes.md`
- warning-only packs still export and record warnings
- errored packs stop before export files are written
- exported JSON contains public file names and check metadata, not private
  absolute paths
- release checks, independent tests, and whitespace checks pass

v2.4-C is acceptable when:

- a public-safe dogfooding record summarizes a real current-repo export pass
- source pack check and export bundle check both pass
- receiver-style review can recover project identity, reading order, live
  recheck requirement, warning/error semantics, and risk boundaries from the
  four exported files
- docs preserve no-provider, no-runtime, no-plugin, no MCP server, no schema-v2,
  and no Workflow Runner boundaries
- release checks, independent tests, and whitespace checks pass

v2.4-D is acceptable when:

- `examples/file-only-export/` contains a public-safe four-file export bundle
- docs clearly state that `exports/` is a recommended explicit output directory
  name, not an auto-created nested directory
- example JSON uses public file names and fixed example metadata
- release checks, independent tests, and whitespace checks pass

v2.5-A/B/C/D is acceptable when:

- `docs/releases/v2.5.0-plan.md` freezes the doctor contract and non-goals
- `docs/specs/context-pack-doctor.md` defines `basebrief-doctor-v1`, top-level
  JSON shape, finding fields, and rule ids
- CLI Lite exposes `doctor --repo <target-repo> --context-pack <context-pack-dir>`
- doctor is read-only and requires explicit repo plus context pack inputs
- checker errors propagate as doctor errors without changing Context Pack Check
  JSON shape
- dirty worktree, stale HEAD, branch mismatch, boundary wording, and live
  recheck findings are covered
- public JSON uses relative paths and short public-safe evidence only
- `examples/context-pack-doctor/` contains a fixed public-safe sample JSON
- docs preserve no-provider, no-runtime, no-plugin, no MCP server/tools,
  no schema-v2, and no Workflow Runner boundaries
- release checks, independent tests, and whitespace checks pass
