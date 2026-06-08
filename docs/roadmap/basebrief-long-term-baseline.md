# BaseBrief Long-term Baseline

Date: 2026-06-05

This document is the planning baseline for the next stages of BaseBrief. It is not a release promise, not a provider benchmark claim, and not a replacement for the current public README. Its job is to keep future work pointed at one coherent direction.

## Current Position

BaseBrief should continue as one public skill entry with internal modes and supporting tools.

Version `v0.2.0` completed the first local toolchain: structured handoff, provider profile metadata, file-based adapters, artifact checks, CLI Lite, and Seal/Diff v1. The receiver line then added Receiver Safe Check, Receiver Flow Draft, review-draft gates, and public receiver examples. The Project State line added local `.basebrief/state.json`, lifecycle inspection, and reviewed-state advancement; `v0.6.0` established that local Project State directory without changing `basebrief-project-state-v1`. The `v0.8.x` Sidecar line now consumes Project State into `generic` / `openclaw` bundles, validates `basebrief-sidecar-v1`, writes `new-window-starter.md`, preserves `pass/fail` receiver acceptance, and closes the public-safe OpenClaw/Hermes manual first-response gap. The `v0.9.x` closure line is frozen: v0.9.0 Integrated Handoff Readiness defines the local line, v0.9.1 Golden Path Closure explains it, v0.9.2 Golden Path Example Closure adds public-safe examples, and v0.9.3 Final Closure / Freeze closes the line without provider requests, runtime integration, schema changes, Auto Flow, plugins, or platform work. The public v1.x Delta Receiver line opened with `v1.0` Delta Handoff RC hardening: a local `delta` command compiles Project State, git facts, changed-file facts, and Seal/Diff state changes into reviewable `delta-handoff.md` while keeping `basebrief-project-state-v1` unchanged. That line is now locally closed and frozen through `v1.9.1`.

The useful product shape is no longer "choose a cache-ready mode for normal work." The stronger direction is:

- Human-facing continuation stays readable: `full` and `lite`.
- Provider-facing repetition uses a separate handoff artifact: sidecar or active prompt.
- Cache-aware evidence stays provider-specific and benchmark-gated.
- Public wording must not describe estimated-cost results as real billing evidence.

The BB experiment line has produced enough signal for productization work:

- BB9 established the dual-track handoff model: readable brief plus cache sidecar.
- BB10 made the active provider prompt explicit.
- BB11 showed trimmed Lite sidecar-only prompts can beat readable Lite on MiMo, but not reliably beat `bb9Best`.
- BB12 improved the MiMo path with a size-band guard and is a MiMo-specific selector candidate.
- DeepSeek evidence for BB11 and BB12 remains smoke-level and inconclusive, so it should not receive large-sample conclusions for these variants yet.

## North Star

BaseBrief should become a context handoff compiler for AI coding work.

It should turn project facts, current goals, decisions, constraints, risks, open questions, and next tasks into a small set of stable artifacts that are useful to both humans and AI tools.

The durable value is not "prompt cache tricks." The durable value is reliable context transfer:

- clear continuation state
- explicit risk boundaries
- repeatable handoff artifacts
- provider-aware active prompts when evidence supports them
- adapter outputs for different AI coding tools
- checks that prevent context drift, leaked secrets, and scope confusion

## Product Principles

1. Keep the public entry simple.

   Users should not need to understand BB numbers or provider cache behavior to use BaseBrief.

2. Separate human readability from provider economics.

   `readableBrief` is for review and continuation. `cacheSidecar` or `activeProviderPrompt` is for supported provider calls. Do not concatenate both unless a benchmark explicitly proves that shape.

3. Treat provider evidence as scoped evidence.

   MiMo evidence is MiMo evidence. DeepSeek smoke evidence is smoke evidence. Relay and unknown providers should keep readable fallback behavior unless cache usage visibility and cost evidence exist.

4. Prefer contracts over parsing.

   A structured handoff contract is more reliable than reverse-parsing free-form Markdown. Markdown-to-JSON conversion can exist as a fallback, but it should not be the main product path until proven stable.

5. Build adapters before building a large platform.

   BaseBrief becomes useful when it can produce context for real coding tools. A full CLI, seal system, or ContextOps specification should follow real adapter and lint needs, not precede them.

6. Keep security and publishability non-negotiable.

   Public outputs must not contain secrets, private absolute paths, `.env` contents, bearer tokens, API keys, or internal project details.

## Phase Roadmap

### Phase 0: Public Direction Reset

Goal: align public wording with the evidence.

Work:

- Update README, mode selection, and skill routing language so normal users see `full` and `lite` as the primary modes.
- Keep `cache-ready` as an experimental/developer route, not the ordinary third choice.
- Describe BB9 as the current general handoff mechanism.
- Describe BB12 as a MiMo-specific selector candidate, not a cross-provider default.
- Fill any missing evolution notes so the BB1 to BB12 evidence chain is understandable.

Exit criteria:

- Public docs no longer imply that ordinary users must choose `cache-ready`.
- BB9/BB10/BB11/BB12 statuses are differentiated clearly.
- Release checks pass and security scans remain clean.

### Phase 1: Handoff Contract

Goal: turn BB9 from an experiment script into the standard handoff contract.

Standard artifacts:

- `readableBrief`: human-readable Full or Lite continuation.
- `cacheSidecar`: compact provider-oriented sidecar when supported.
- `activeProviderPrompt`: the exact text to send to the provider.
- `handoff.meta.json`: selected strategy, provider profile, fallback reason, evidence level, and safety status.

Work:

- Define a JSON schema for the handoff input and output metadata.
- Keep `generate_bb9_handoff.js` as the proven mechanism, then wrap it rather than rewriting it from scratch.
- Record how provider profiles choose among readable fallback, BB9 sidecar, and BB12 MiMo guard.
- Design the schema so it can later map to a `.basebrief/` directory without another data-model rewrite.

Exit criteria:

- One schema-backed input can produce all standard artifacts.
- Unsupported provider profiles fall back to readable output.
- Tests cover the contract and summary redaction.

### Phase 2: Structured Output POC

Goal: avoid making Markdown parsing the primary bridge.

Work:

- Test whether Full/Lite generation can output readable Markdown plus a structured JSON block in the same handoff.
- Keep the visible brief clean for humans.
- Keep the JSON block small, deterministic, and suitable for the BB9 handoff contract.
- Treat Markdown-to-JSON parsing as fallback only if structured output is unstable.

Exit criteria:

- At least one realistic project flow produces readable Markdown plus valid JSON.
- The JSON can feed the handoff builder without manual repair.
- The readable brief remains useful without exposing implementation noise.

### Phase 3: Handoff Builder

Goal: provide a user-facing local build path.

Work:

- Add a minimal builder around the BB9 handoff path.
- Produce the standard artifacts into a clearly named output directory.
- Support provider profiles without writing provider credentials to disk.
- Keep other local projects read-only when used as samples.

Exit criteria:

- A command can build handoff artifacts from schema-backed input.
- MiMo can use the active prompt path under benchmark conditions.
- DeepSeek remains conservative unless evidence changes.
- No private paths, keys, or tokens appear in public summaries.

### Phase 4: Provider Profiles and Benchmark Discipline

Goal: make provider-specific behavior explicit and auditable.

Work:

- Record provider profile capabilities: cache usage visibility, recommended prompt strategy, fallback behavior, and evidence level.
- Keep MiMo BB12 guard behind a provider-specific profile.
- Keep DeepSeek BB11/BB12 as inconclusive until new evidence exists.
- Preserve `provider_probe_status=skipped` behavior when env vars are absent.

Exit criteria:

- Provider behavior is controlled by profile data, not hidden assumptions.
- Benchmark summaries are public-redacted.
- A new provider cannot silently inherit MiMo-only claims.

### Phase 5: Adapter v1

Goal: make BaseBrief useful outside its own templates.

First adapters should be simple, file-based, and dry-run friendly.

Candidate targets:

- Codex-style task handoff
- Claude-style project context
- Cursor or Cline/Roo task context

Work:

- Convert the same handoff contract into tool-specific context files.
- Preserve risk boundaries and open questions.
- Avoid overwriting user files by default.

Exit criteria:

- At least two adapters produce useful outputs from the same source data.
- Adapter outputs are tested.
- No adapter output weakens safety boundaries.

Current v1 status: Codex and Claude file-based adapters are the first targets. They export context files only and do not write official tool configuration.

### Phase 6: Lint Mini

Goal: create a small quality gate for handoff artifacts.

Initial checks:

- secret-like strings
- private absolute paths in public outputs
- missing risk boundaries
- unresolved open questions hidden as facts
- provider-specific claims written as general claims
- missing or contradictory scope constraints

Exit criteria:

- `check` can run locally against generated artifacts.
- Findings are deterministic and explainable.
- The rule set stays small enough that users do not ignore it.

Current v1 target: a local artifact checker runs against explicit files or directories only. It checks generated handoff and adapter artifacts for common publication hazards without becoming a full secret scanner or compliance audit.

### Phase 7: CLI Lite

Goal: provide a thin command wrapper only after the contract, builder, adapters, and lint mini have shaped the real workflow.

Potential commands:

```text
basebrief init
basebrief build
basebrief check
```

Non-goals in this phase:

- no platform
- no hosted service
- no account system
- no automatic secret management
- no broad plugin ecosystem

Exit criteria:

- CLI wraps existing stable behavior instead of inventing a parallel system.
- Zero-install skill usage remains documented.
- The CLI is optional, not required for normal template use.

Current v0.3.0 target: `scripts/basebrief.js` is a zero-dependency Node wrapper for init, build, check, receiver-init, receiver-check, seal, and diff. Local npm scripts may wrap validation commands, but BaseBrief stays optional and does not create a published npm package, global command, plugin, or provider integration.

### Phase 8: Seal and Diff

Goal: support longer projects where phase changes need traceability.

Work:

- Create a seal for a completed phase.
- Diff facts, decisions, risks, open questions, and task boundaries across seals.
- Use checksums or stable metadata to detect drift.

Exit criteria:

- Seals are useful for real multi-phase projects.
- Diff output helps continuation decisions.
- The feature does not become a heavy project-management system.

Current v1 target: local `basebrief-seal-v1` snapshots and diff summaries compare BB9 handoff state across phases. Seal/Diff remains file-based and optional.

### Phase 8B: Delta Handoff

Goal: help a fresh coding-agent window understand what changed since the last
accepted continuity point without widening BaseBrief into provider, runtime,
plugin, MCP, IDE, hosted, or schema-v2 work.

Closed v1.0-v1.2 Delta line:

- `delta` reads current Project State, git range facts, changed-file facts, and
  Seal/Diff state changes
- output is `delta-handoff.md`
- `reviewed` sections come from current `.basebrief/state.json`
- `needs-review` sections come from generated git and diff summaries
- `.basebrief/delta-baseline.json` is local delta state only
- `basebrief-project-state-v1` remains unchanged
- fresh receiver dogfooding has reported `handoff_acceptance: pass`

Exit criteria:

- a fresh receiver can restate the current goal, key decisions, risk
  boundaries, recent changes, and next narrow implementation slice
- release checks cover the delta CLI, public spec/example, and dogfooding
  evidence
- `provider_probe_status=skipped` remains the correct no-provider gate

v1.1 receiver acceptance closure:

- keep the v1.0 Delta Handoff line local-first and review-based
- define the Delta Receiver Acceptance Kit as a receiver contract, not an
  automated runtime
- require the receiver to separate live repository state from inherited handoff
  facts before proposing implementation work
- keep `basebrief-project-state-v1`, `basebrief-delta-handoff-v1`, and
  `basebrief-delta-baseline-v1` unchanged
- avoid provider requests, runtime integration, plugin, MCP, IDE, hosted,
  Auto Flow, npm publication, and schema-v2 work

Local v1.1 closeout status:

- stale inherited delta handoff facts were correctly reported as
  `difference_found`
- refreshed ignored local delta output matched live repository state and
  reported `handoff_acceptance: pass`
- `docs/releases/v1.1.0.md` records the local closeout without making a push,
  tag, release, package publication, platform, or provider claim

Local v1.2 closeout status:

- `docs/releases/v1.2.0-plan.md` defines the Delta Receiver Report Kit
- `docs/dogfooding/delta-receiver-report-kit-v1.2.md` records the public-safe
  report-kit dogfooding contract
- `examples/receiver/delta-report-pass/README.md` and
  `examples/receiver/delta-report-difference-found/README.md` give copyable
  report examples
- `docs/releases/v1.2.0.md` records the local closeout without making a push,
  tag, release, package publication, platform, provider, command-output, report
  schema, or schema-v2 claim

Local v1.3 closeout status:

- `docs/releases/v1.3.0-plan.md` defines the Delta Receiver Starter Integration
- `docs/releases/v1.3.0.md` records the local closeout without making a push,
  tag, release, package publication, platform, provider, command-output, report
  schema, or schema-v2 claim
- starter-facing docs and examples now point receivers to the v1.2 report kit
  field shape while keeping human-facing `pass/fail`
- source-window inherited facts, live repo facts, and receiver-window rechecks
  remain separate in starter-facing guidance
- historical `commits_in_range` drift remains non-blocking when refreshed
  branch, HEAD, and worktree facts match live repository state

Local v1.4 closeout status:

- `docs/releases/v1.4.0-plan.md` defines the Delta Receiver Usage Pack
- `docs/receiver-usage-pack.md` gives one concentrated receiver entry guide for
  reading order, routing, and acceptance outcomes
- `examples/receiver/usage-pack/README.md` and
  `examples/receiver/usage-pack/starter-report-outline.md` route receivers to
  public-safe examples without duplicating raw example bodies
- `docs/releases/v1.4.0.md` records the local closeout without making a push,
  tag, release, package publication, platform, provider, command-output, report
  schema, or schema-v2 claim
- `difference_found` remains a completed verification result and may coexist
  with human-facing `fail`
- source-window inherited facts, live repo facts, and receiver-window rechecks
  remain separate in usage-pack guidance
- historical `commits_in_range` drift remains non-blocking when refreshed
  branch, HEAD, and worktree facts match live repository state

Local v1.5 closeout status:

- `docs/releases/v1.5.0-plan.md` defines the Delta Receiver Lint Mini
- `docs/releases/v1.5.0.md` records the local closeout without making a push,
  tag, release, package publication, platform, provider, command-output, report
  schema, or schema-v2 claim
- `scripts/basebrief_check_artifacts.js` now checks explicit receiver Markdown
  and `basebrief-receiver-check-result-v1` JSON for receiver contract gaps
- receiver lint remains shape-based, not repository-wide keyword-based
- `difference_found` remains a completed verification result and historical
  `commits_in_range` drift remains non-blocking when refreshed branch, HEAD,
  and worktree facts still match

Planned v1.6 direction:

- `docs/releases/v1.6.0-plan.md` defines the Delta Receiver Lint Fixture Pack
- `examples/receiver/lint/` should make receiver lint rule families learnable
  and copyable through public-safe clean, error, and warning fixtures
- the line should not add new CLI commands, schemas, command output formats,
  provider requests, runtime integrations, plugins, MCP, IDE, hosted service,
  Auto Flow behavior, or publication scope

Local v1.6 closeout status:

- `docs/releases/v1.6.0.md` records the local closeout without making a push,
  tag, release, package publication, platform, provider, command-output,
  report-schema, or schema-v2 claim
- `examples/receiver/lint/` contains public-safe clean, error, and warning
  fixtures for the existing v1.5 receiver lint rule families
- release checks and independent tests verify expected fixture status,
  severity, and rule IDs

Local v1.7 closeout status:

- `docs/releases/v1.7.0-plan.md` defines the Delta Receiver Lint Repair Pack
- `docs/releases/v1.7.0.md` records the local closeout without making a push,
  tag, release, package publication, platform, provider, command-output,
  report-schema, schema-v2, or checker-rule claim
- `examples/receiver/lint/repair/` contains fixed public-safe Delta Markdown,
  starter Markdown, and receiver result JSON references for existing receiver
  lint rule families

Local v1.8 closeout status:

- `docs/releases/v1.8.0-plan.md` defines the Delta Receiver Lint Dogfooding
  Evidence line
- `docs/releases/v1.8.0.md` records the local closeout without making a push,
  tag, release, package publication, platform, provider, command-output,
  report-schema, schema-v2, or checker-rule claim
- `docs/dogfooding/delta-receiver-lint-dogfooding-v1.8.md` records public-safe
  dogfooding evidence for v1.6 fixtures, v1.7 repairs, and existing receiver
  examples

Planned v1.9 direction:

- `docs/releases/v1.9.0-plan.md` defines the Delta Receiver Lint
  Discoverability / Adoption line
- keep the work to public navigation and copy-order clarity across
  `docs/receiver-usage-pack.md`, `docs/checks.md`, `docs/testing.md`,
  `docs/index.md`, `examples/receiver/usage-pack/README.md`,
  `examples/receiver/lint/README.md`, and
  `examples/receiver/lint/repair/README.md`
- map fixture -> repair -> existing receiver examples without changing checker
  behavior, rule families, CLI commands, schemas, command output, provider
  behavior, runtime behavior, plugin, MCP, IDE, hosted, Auto Flow, or
  publication scope

Local v1.9 closeout status:

- `docs/releases/v1.9.0.md` records the local closeout without making a push,
  tag, release, package publication, platform, provider, command-output,
  report-schema, schema-v2, checker-rule, or new-rule-family claim
- the public read order is usage pack -> usage-pack router -> lint fixture
  guide -> repair guide -> existing receiver examples
- release checks and independent tests verify the v1.9 adoption path while
  preserving `difference_found`, historical drift, and
  `provider_probe_status=skipped` semantics

Local v1.x final closeout status:

- `docs/releases/v1.9.1.md` records the final local closure / freeze without
  making a push, tag, release, package publication, platform, provider,
  command-output, report-schema, schema-v2, checker-rule, new-rule-family, or
  v1.10 feature-line claim
- `docs/testing-v1.x-delta-receiver-closure-matrix.md` records the aggregate
  v1.0-v1.9.1 Delta Receiver closure matrix for release review
- the v1.x Delta Receiver line is now frozen at local-first, review-based
  behavior; future work should start a new product line only after the user
  separately approves scope

Local v2.0 Context Pack Lite closeout status:

- `docs/roadmap/basebrief-v2-context-pack-lite.md`,
  `docs/releases/v2.0.0-plan.md`, and `docs/specs/context-pack-lite.md`
  record the v2.0-A direction freeze
- `scripts/basebrief_context_pack.js` and CLI Lite `context-pack` implement the
  v2.0-B minimal rule-based generator without provider, runtime, plugin, MCP,
  IDE, schema-v2, Workflow Runner, AI summary, vector, embedding, or repo-dump
  behavior
- `examples/context-pack-lite/README.md`,
  `docs/dogfooding/context-pack-lite-fresh-receiver-v2.0.0.md`, and
  `docs/releases/v2.0.0.md` close v2.0-C with public-safe examples,
  dogfooding evidence, and local closeout

Local v2.1 Context Pack Check closeout status:

- `docs/releases/v2.1.0-plan.md` and `docs/specs/context-pack-check.md`
  record the v2.1-A contract freeze
- `scripts/basebrief_check_artifacts.js` and the existing CLI Lite `check`
  surface implement v2.1-B minimal checker integration without adding a
  top-level `context-pack-check` command
- `docs/dogfooding/context-pack-check-acceptance-v2.1.0.md` and
  `docs/releases/v2.1.0.md` close v2.1-C with public-safe checker acceptance
  evidence and local closeout
- v2.2 should prefer One-command Resume / New-window Prompt, then v2.3
  BaseBrief Format, while Workflow Runner Lite remains later

Local v2.2 One-command Resume / New-window Prompt contract status:

- `docs/releases/v2.2.0-plan.md` and `docs/specs/context-pack-resume.md`
  record the v2.2-A contract freeze
- `resume --input <context-pack-dir>` should reuse the existing Context Pack
  Check result and print copyable prompt text
- warning-only packs remain resumable with review notes; error findings block
  prompt output
- v2.2 must not change Context Pack Lite generator output or the existing
  `check --input <dir> --json` top-level shape

### Phase 8A: Receiver Workflow

Goal: make receiver acceptance explicit and locally verifiable without turning BaseBrief into an agent runtime.

Current v0.3.0 target:

- receiver-ready human-readable protocol
- explicit source-window versus receiver-window verification
- stable expected changed-file manifest
- optional Receiver Safe Check v1
- state-only `receiver-init` followed by reviewed `receiver-check`
- no raw commands, secrets, automatic working-directory switching, or full-test claims

Exit criteria:

- Receiver workflow is optional and backwards compatible.
- Config and result contracts remain independent from BB9.
- Temporary Git repositories prove pass, difference, blocked, and no-tracked-write behavior.
- Public docs keep limitations and evidence scope explicit.

Current v0.3.1 stabilization target:

- record public-safe receiver friction in dogfooding docs
- add examples for `difference_found`, `blocked`, and language routing
- add minimal local npm scripts for validation only
- document the v0.3.1 local release-candidate gate
- avoid Auto Flow, new adapters, Web UI, provider requests, and broad receiver matrices.

Completed v0.3.2 draft skeleton:

- add `receiver-flow` as a local draft skeleton only
- write `flow-summary.json`, `receiver-check.json`, and `draft-context.md`
- keep `handoff_status: draft_needs_review` until human review
- avoid receiver thread creation, provider requests, Auto Flow completion, and automatic promotion to `ready_for_receiver`
- document the v0.3.2 local release-candidate gate before any push, tag, or release

Current v0.3.3 evidence target:

- record public-safe receiver-flow dogfooding evidence
- add examples for clean, dirty, and Git-visible output drafts
- keep `handoff_status: draft_needs_review` as the only receiver-flow handoff status
- avoid new CLI commands, new npm scripts, schema changes, provider requests, receiver thread creation, and Auto Flow

Current v0.4.0 release-candidate target (historical, now completed):

- integrate BB9 handoff, CLI Lite, Artifact Checker, Receiver Safe Check, Receiver Flow Draft, Seal/Diff, local npm validation scripts, and public-safe evidence into one release-candidate line
- keep BaseBrief local-first and file-based
- keep `cache-ready` experimental and provider-specific
- keep Auto Flow, Web UI, Cursor adapter, hosted service, installed CLI, published npm package, CI matrix, and `.basebrief/` project state out of scope

Current v0.9.x closure line:

- v0.9.0 Integrated Handoff Readiness defines the local public hardening line
- v0.9.1 Golden Path Closure turns that line into one public golden path
- v0.9.2 Golden Path Example Closure adds the public-safe example kit for
  first-pass and follow-up usage
- v0.9.3 Final Closure / Freeze closes and freezes the line with aggregate
  matrix and final closure docs
- keep `basebrief-project-state-v1`, `basebrief-sidecar-v1`, BB9, and Receiver Safe Check schemas unchanged
- keep `provider_probe_status=skipped` as the correct no-provider gate
- avoid provider requests, runtime integration, Auto Flow, Web UI, plugins, platform work, npm publishing, global CLI, `v1.0` work, and cross-provider cache claims

### Phase 9: ContextOps Vision

Goal: keep the long-term direction visible without prematurely turning it into implementation scope.

ContextOps can become a broader framing only if earlier phases show real usage:

- adapters are used outside the original repo
- lint prevents real mistakes
- CLI Lite improves repeated workflows
- seal/diff helps long-running project handoffs

Until then, ContextOps remains a vision label, not a specification project.

Current v1 target: ContextOps is documented as a boundary and vocabulary anchor only. It does not introduce a platform, hosted service, plugin ecosystem, provider gateway, or new implementation surface.

## Experiment Freeze Rule

Do not add BB13 or later just because another prompt variant is imaginable.

A new BB experiment is allowed only when all of the following are true:

- A current productization phase is blocked by measured evidence.
- The problem cannot be solved by a provider profile, contract change, or fallback rule.
- The hypothesis is narrow and testable.
- The benchmark mode, success threshold, and rollback condition are defined before running.
- The result will not be described as provider-general unless multiple providers support it.

## Near-term Priority Order

1. Keep the locally closed and frozen v1.x Delta Handoff / Receiver / Starter / Usage Pack / Lint / Fixture / Repair / Dogfooding / Adoption line reviewable.
2. Keep push, tag, and formal release pending until the user separately approves them.
3. Choose any later Delta version only from repeated local receiver usage evidence.
4. Keep installed CLI, plugins, provider experiments, ContextOps expansion, and speculative features frozen unless measured usage creates a concrete blocker.
5. Choose later versions only from repeated, measured usage evidence.

## Success Metrics

BaseBrief is on track if:

- normal usage is simpler, not more complex
- `full` and `lite` remain readable
- handoff artifacts are repeatable
- provider prompts are selected by explicit profiles
- summaries stay redacted
- release checks remain strict
- benchmark claims stay scoped to their evidence
- adapters preserve the same facts, decisions, risks, and open questions as the source handoff

BaseBrief is off track if:

- users must understand BB numbers for ordinary use
- cache claims become marketing language
- Markdown becomes cluttered with provider-only fields
- CLI design grows before adapter and lint needs are proven
- new experiments are added without changing product behavior

## Current Strategic Decision

The current development cycle has locally closed and frozen the v1.x Delta Handoff /
Receiver line: Delta Handoff, Delta Receiver Acceptance, Delta Receiver Report
Kit, Delta Receiver Starter Integration, Delta Receiver Usage Pack, Delta
Receiver Lint Mini, Delta Receiver Lint Fixture Pack, Delta Receiver Lint
Repair Pack, Delta Receiver Lint Dogfooding Evidence, and Delta Receiver Lint
Discoverability / Adoption. `docs/releases/v1.9.1.md` and
`docs/testing-v1.x-delta-receiver-closure-matrix.md` are the final local
closure records for that line. The v2.0 Context Pack Lite line has now started
and locally closed its first slice: direction freeze, minimal `context-pack`
generator, public-safe example kit, fresh-receiver dogfooding evidence, and
`docs/releases/v2.0.0.md` closeout. The v2.1 Context Pack Check line is now
locally closed with contract freeze, minimal checker integration, public-safe
acceptance evidence, and `docs/releases/v2.1.0.md` closeout. The following
product surface should prefer v2.2 One-command Resume /
New-window Prompt and v2.3 BaseBrief Format before any Workflow Runner Lite
work, and should still avoid provider requests, runtime integration,
command-output changes, plugins, MCP, IDE, Auto Flow, schema-v2, watcher,
daemon, dashboard, prediction, or publication work unless repeated local usage
exposes a concrete blocker.

It should not chase a new benchmark variant, installed CLI, plugin, MCP, IDE,
runtime integration, provider request, schema-v2 work, hosted service, or
platform surface. BB12 remains a MiMo-specific optimization candidate, while
new experiments, speculative features, and broader platform work remain frozen.
