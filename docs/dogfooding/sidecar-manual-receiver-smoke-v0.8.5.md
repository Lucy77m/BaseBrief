# Sidecar Manual Receiver Smoke v0.8.5

This public-safe record defines how manual OpenCode and Claude Code receiver
smoke results should be accepted after the v0.8.4 smoke packet.

## Goal

Create a fixed result intake format so external receiver smoke summaries can be
recorded later without copying raw output, leaking private details, or claiming
that a receiver pass happened before the user supplies evidence.

## Current Status

| Tool | Target | Status | Public-safe acceptance summary |
| --- | --- | --- | --- |
| opencode | generic | not_run | manual_required |
| claude-code | generic | not_run | manual_required |
| opencode | openclaw | not_run | manual_required |
| claude-code | openclaw | not_run | manual_required |

No manual receiver smoke result has been accepted in this checkpoint.

## Intake Format

Future manual result summaries must use this shape:

```text
tool: opencode | claude-code
target: generic | openclaw
status: passed | failed | timed_out | unavailable | not_run
basebrief_identified: yes | no
v08x_identified: yes | no
current_commit_identified: yes | no
current_goal_repeated: yes | no
receiver_entry_task_repeated: yes | no
risk_boundaries_count: <number>
wait_for_user_confirmation: yes | no
no_auto_advance: yes | no
no_provider: yes | no
no_runtime: yes | no
public_safe_notes: <summary only>
```

`public_safe_notes` must stay public-safe and explicitly say whether the
receiver reported human-facing `pass` or `fail` before stopping at the
confirmation gate.

## Pass Rule

A row can be marked `passed` only when the public-safe summary confirms:

- BaseBrief was identified.
- v0.8.x was identified.
- The current commit was identified.
- `current_goal` was repeated.
- The receiver entry task was repeated.
- At least two risk boundaries were listed.
- The receiver explicitly reported human-facing `pass`.
- The receiver said it will wait for user confirmation.
- The receiver said no auto-advance.
- The receiver said no provider.
- The receiver said no runtime.

If any required item is missing, use `failed`, `timed_out`, `unavailable`, or
`not_run`; do not write `passed`. If the receiver reported human-facing `fail`,
the row also cannot be marked `passed`.

This is the same acceptance anchor later surfaced by `new-window-starter.md`:
identify BaseBrief, restate key fields, report `pass/fail`, and stop at the
wait-for-confirmation gate.

## Boundaries

- No provider request.
- No raw private output.
- No runtime integration.
- No schema change.
- No Auto Flow.
- No receiver thread creation from Codex.
- No auto-advance beyond the receiver acceptance report.
- Wait for user confirmation before continuing from the bundle.
- No OpenClaw/Hermes runtime connection.
- No OpenClaw/Hermes profile/config/memory/workspace writes.
- No push, tag, release, or npm publish in this checkpoint.

Do not copy raw receiver output, private absolute paths, secrets, provider
endpoints, model values, token output, or API keys into tracked docs.

`sidecar-build` and `sidecar-check` remain the existing sidecar commands for
`generic` and `openclaw` bundles. `basebrief-project-state-v1` and
`basebrief-sidecar-v1` are unchanged.

`provider_probe_status=skipped`
