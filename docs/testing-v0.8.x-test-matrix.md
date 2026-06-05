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
