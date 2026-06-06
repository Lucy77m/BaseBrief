# v0.8.x Sidecar Test Matrix

This matrix covers the local v0.8 sidecar handoff work.

## v0.8.0 Sidecar Build

- `sidecar-build --repo <target-repo>` reads an existing valid
  `basebrief-project-state-v1` state.
- `generic` and `openclaw` targets are supported.
- Output is a local sidecar bundle only.
- No provider request, no raw private output, no runtime integration, and no
  schema change.

## v0.8.1 Sidecar Check

- `sidecar-check --input <sidecar-dir>` is a read-only structure gate.
- It validates the six required files, sidecar metadata, Project State schema
  marker, current goal, receiver task, risk boundaries, and receiver prompt
  confirmation language.
- It reuses the artifact checker for secret-like strings, private absolute
  paths, and raw provider output.

## v0.8.2 Receiver Acceptance Evidence

- Generate ignored private `generic` and `openclaw` bundles.
- Run `sidecar-check` against both bundles.
- Run artifact `check --input` against both bundles.
- Confirm both targets pass with 0 errors and 0 warnings.
- Confirm root `.basebrief/` is removed after validation.

## v0.8.3 Discoverability Polish

- README and README.en expose `sidecar-build` and `sidecar-check`.
- Docs index links v0.8.0, v0.8.1, v0.8.2, and v0.8.3 records.
- Release checks assert Sidecar docs preserve `generic`, `openclaw`,
  `provider_probe_status=skipped`, and the public-safe boundaries.
- `basebrief-project-state-v1` and `basebrief-sidecar-v1` remain unchanged.

## v0.8.4 External Receiver Smoke Evidence

- Generate ignored private `generic` and `openclaw` smoke bundles.
- Run `sidecar-check` and artifact `check --input` against both bundles.
- Record OpenCode and Claude Code CLI availability without invoking receiver
  prompts from Codex.
- Mark external receiver execution `manual_required`; do not claim pass until a
  user-approved external runner smoke returns public-safe acceptance evidence.
- Preserve `basebrief-project-state-v1` and `basebrief-sidecar-v1`.

## v0.8.5 Manual Receiver Smoke Result Intake

- Define the public-safe intake format for user-supplied OpenCode and Claude
  Code receiver smoke summaries.
- Keep all receiver smoke rows `not_run` until a user-approved external run
  provides a complete public-safe acceptance summary.
- Require acceptance fields for BaseBrief, v0.8.x, current commit,
  `current_goal`, receiver entry task, at least two risk boundaries, wait for
  user confirmation, no auto-advance, no provider, and no runtime.
- Do not copy raw output, private paths, secrets, provider endpoints, model
  values, token output, or API keys into tracked docs.
- Preserve `basebrief-project-state-v1` and `basebrief-sidecar-v1`.

## v0.8.6 Manual Receiver Smoke Result Intake Evidence

- Accept public-safe summaries for `opencode + generic` and
  `claude-code + generic`.
- Record OpenCode generic as `passed` only after a complete public-safe intake
  summary confirms all required fields.
- Record Claude Code generic as `passed` only after a complete public-safe
  intake summary confirms all required fields.
- Keep OpenClaw-target rows `not_run` with `manual_required` unless the user
  supplies lightweight public-safe summaries.
- Do not mark any receiver smoke row `passed` without all required intake fields.
- Preserve `basebrief-project-state-v1` and `basebrief-sidecar-v1`.

## OpenClaw/Hermes Manual Receiver Smoke Follow-up

- Record `hermes-agent` as `passed` from a public-safe first-response
  acceptance summary.
- Record `openclaw-agent` as `passed` only after a strict six-file
  absolute-path recheck against the historical `openclaw` bundle.
- Keep the `v0.8.5` / `v0.8.6` checkpoint tables unchanged; this is follow-up
  evidence, not a historical row rewrite.
- Treat the result as manual first-response acceptance closure only, not proof
  of the latest freshly rebuilt `openclaw` bundle and not provider/runtime
  integration.
- Preserve `basebrief-project-state-v1` and `basebrief-sidecar-v1`.

## v0.8.7 Copyable New-Window Starter

- `sidecar-build` writes `new-window-starter.md` as the copyable block for a
  user to paste into a new chat.
- `manifest.json` exposes `output_files.newWindowStarter`.
- `sidecar-check` validates the starter when the manifest declares it, including
  target repository cue, sidecar bundle instruction, current goal, receiver
  task, at least two risk boundaries, report pass/fail, wait for user
  confirmation, No provider request, No raw private output, No runtime
  integration, No schema change, and No auto-advance.
- Old v0.8 bundles without `output_files.newWindowStarter` remain compatible.
- Preserve `basebrief-project-state-v1` and `basebrief-sidecar-v1`.

## v0.8.8 Starter Language Routing

- `sidecar-build --starter-language auto|zh-CN|en|ja` localizes only the
  user-facing `new-window-starter.md` shell.
- `auto` detects Chinese, English, and Japanese from the natural-language
  handoff body; mixed or unclear input falls back to `zh-CN`.
- Explicit `zh-CN`, `en`, and `ja` templates keep paths, file names, schema
  names, and protocol fields such as `current_goal`, `receiver_entry_task`, and
  `risk_boundaries` literal.
- Localized hard stops preserve the English anchors: No provider request, No
  raw private output, No runtime integration, No schema change, and No
  auto-advance.
- Localized first-response instructions preserve `pass/fail` as a literal
  receiver acceptance anchor.
- `sidecar-check` accepts localized starter shells while preserving the same
  required content and old-bundle compatibility.
- Preserve `basebrief-project-state-v1` and `basebrief-sidecar-v1`.

## Standard Local Commands

```text
node --test tests/basebrief.test.js
node scripts/run_release_checks.js
npm run check
git diff --check
```

## Boundaries

- No provider request.
- No raw private output.
- No runtime integration.
- No schema change.
- No Auto Flow.
- Wait for user confirmation before continuing from a sidecar bundle.
- OpenClaw target is safety wording only; it does not write
  profile/config/memory/workspace files.

When provider environment variables are absent, release checks must keep
`provider_probe_status=skipped`.
