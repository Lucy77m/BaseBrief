# Sidecar External Receiver Smoke v0.8.4

This public-safe record closes the v0.8.4 external receiver smoke preparation
pass for the Sidecar Handoff Bundle.

## Goal

Verify that the v0.8.x sidecar path can produce receiver-smoke inputs for
external tools without changing CLI/API/schema behavior or crossing the active
no-provider and no-runtime boundaries.

## Evidence

The evidence was generated under an ignored private output directory and is
summarized here without copying raw sidecar files or receiver output.

| Check | Result |
| --- | --- |
| `state-init` from reviewed receiver-ready source | passed |
| `sidecar-build --target generic` | passed |
| `sidecar-build --target openclaw` | passed |
| `sidecar-check` for generic bundle | passed |
| `sidecar-check` for openclaw bundle | passed |
| Artifact check for generic bundle | passed, 0 errors, 0 warnings |
| Artifact check for openclaw bundle | passed, 0 errors, 0 warnings |
| OpenCode CLI availability | available |
| Claude Code CLI availability | available |
| OpenCode generic receiver prompt execution | manual_required |
| Claude Code generic receiver prompt execution | manual_required |
| OpenClaw-target external receiver prompt execution | skipped |
| Cleanup of root `.basebrief/` | passed |

## Acceptance Meaning

This pass proves that a public-safe receiver smoke packet can be generated and
validated locally. It does not prove that OpenCode or Claude Code completed the
receiver task, because Codex did not invoke external receiver prompts.

External receiver execution should only be marked `passed` after a
user-approved runner smoke can restate BaseBrief, v0.8.x, the current commit,
`current_goal`, the receiver entry task, at least two risk boundaries, wait for
user confirmation, and state no auto-advance, no provider, and no runtime.
The receiver must wait for user confirmation before any follow-up action.

## Boundaries

- No provider request.
- No raw private output.
- No runtime integration.
- No schema change.
- No Auto Flow.
- No receiver thread creation from Codex.
- Wait for user confirmation before continuing from the bundle.
- OpenClaw target remains safety wording only.
- No OpenClaw/Hermes runtime connection.
- No OpenClaw/Hermes profile/config/memory/workspace writes.
- No push, tag, release, or npm publish in this checkpoint.

`sidecar-build` and `sidecar-check` were used for both `generic` and `openclaw`
targets. `basebrief-project-state-v1` and `basebrief-sidecar-v1` are unchanged.

`provider_probe_status=skipped`
