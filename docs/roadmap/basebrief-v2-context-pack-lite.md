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

## Why Context Pack Lite Before Workflow Runner

Workflow Runner Lite remains a later possibility, but it should not lead v2.0.
A runner only chains existing steps. If the central artifact is not clear yet,
the runner mostly wraps old commands and creates more workflow surface.

The recommended order is:

```text
v2.0 Context Pack Lite
v2.1 Context Pack Check
v2.2 Workflow Runner Lite
```

Context Pack Lite gives Workflow Runner Lite something meaningful to produce.

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
top-level commands. Check for missing files, missing review metadata, unsafe
content, over-thick output, and live-fact drift.

### v2.2 Workflow Runner Lite

Only after Context Pack Lite exists and can be checked, consider a narrow runner
that chains state, delta, context pack generation, check, and starter output.

## Acceptance Criteria

v2.0-A is acceptable when:

- public docs state that v2.0 equals Context Pack Lite
- the frozen v1.x baseline remains intact
- the roadmap explains why Workflow Runner is later
- the docs explicitly reject provider, runtime, plugin, MCP, IDE, hosted,
  cloud-memory, schema-v2, vector, embedding, AI auto-summary, and repo-dump
  work
- the seven recommended artifacts have clear roles
- review, status, source, trust, and stale semantics are defined
- missing input degradation is explicit
- release checks, independent tests, and whitespace checks pass
