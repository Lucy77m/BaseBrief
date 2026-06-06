# Sidecar OpenClaw/Hermes Manual Smoke Follow-up

This public-safe follow-up records the manual receiver smoke that closed the
remaining OpenClaw/Hermes first-response acceptance gap after the `v0.8.5` and
`v0.8.6` intake checkpoints. It does not rewrite those historical tables.

## Goal

Record current public-safe evidence that `hermes-agent` and `openclaw-agent`
can consume a historical `openclaw` Sidecar bundle by absolute path, restate
key fields, report `pass/fail`, and stop at the confirmation gate.

## Evidence Source

- Source material came from one user-supplied private summary file outside the
  tracked repository.
- This follow-up keeps only public-safe distilled results. It does not quote
  raw chat output, private desktop paths, or external tool traces.

## Bundle Under Test

- Historical `openclaw` Sidecar bundle from the ignored private output area.
- Smoke style: first-response acceptance only, read-only, six named files read by absolute path.
- This is not proof that the latest freshly rebuilt `openclaw` bundle was
  exercised end to end by an external agent.

## Results

| Tool | Status | Public-safe acceptance summary |
| --- | --- | --- |
| `hermes-agent` | passed | Read the named Sidecar files by absolute path, identified BaseBrief, restated `current_goal` and `receiver_entry_task`, listed multiple risk boundaries, reported `pass`, and waited for user confirmation without provider/runtime/profile writes. |
| `openclaw-agent` | passed | The initial OpenClaw run was treated as provisional after two named files were unreadable. A strict recheck then required all six named files to be read by absolute path before reporting `pass`, waiting for user confirmation, and preserving the OpenClaw/Hermes hard stops. |

## Acceptance Meaning

- `hermes-agent`: passed.
- `openclaw-agent`: passed after the strict six-file absolute-path recheck.
- Manual smoke gap closed for OpenClaw/Hermes first-response acceptance.
- This does not change the historical `v0.8.5` / `v0.8.6` row statuses.
- This closes the current `v0.8.x` follow-up gap only; it does not define or
  start `v0.9.0`.
- This does not prove provider or runtime integration.
- This does not prove the latest freshly rebuilt `openclaw` bundle behavior.

## Hard Stops Preserved

- No provider request.
- No raw private output.
- No runtime integration.
- No schema change.
- No auto-advance.
- Wait for user confirmation before continuing.
- Do not connect OpenClaw/Hermes runtime.
- Do not write OpenClaw/Hermes profile/config/memory/workspace files.

`provider_probe_status=skipped`
