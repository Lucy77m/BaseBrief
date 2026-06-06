# Sidecar Manual Receiver Smoke v0.8.6

This public-safe record accepts manual receiver smoke result summaries after
the v0.8.5 intake format. It records observed results only; it does not mark a
receiver smoke as `passed` unless the intake fields satisfy the pass rule.

## Goal

Record user-approved generic receiver smoke evidence for OpenCode and Claude
Code without copying raw runner output, leaking private details, or expanding
the v0.8.x Sidecar work into v0.9.

## Current Status

| Tool | Target | Status | Public-safe acceptance summary |
| --- | --- | --- | --- |
| opencode | generic | passed | Receiver read the v0.8.4 sidecar bundle, identified BaseBrief, restated `current_goal`, `receiver_entry_task`, and seven risk boundaries, reported `pass`, and waited for user confirmation without auto-advancing or touching provider/runtime boundaries. |
| claude-code | generic | passed | Receiver identified BaseBrief, carried and restated the sidecar fields, reported `pass`, and stopped at the user-confirmation gate without provider or runtime activity. |
| opencode | openclaw | not_run | manual_required |
| claude-code | openclaw | not_run | manual_required |

Only the two generic rows are marked `passed` in this checkpoint.

## Intake Evidence

The accepted public-safe summaries map to the v0.8.5 intake fields:

```text
tool: opencode
target: generic
status: passed
basebrief_identified: yes
v08x_identified: yes
current_commit_identified: yes
current_goal_repeated: yes
receiver_entry_task_repeated: yes
risk_boundaries_count: 7
wait_for_user_confirmation: yes
no_auto_advance: yes
no_provider: yes
no_runtime: yes
public_safe_notes: Receiver read the v0.8.4 sidecar bundle, identified BaseBrief, restated `current_goal`, `receiver_entry_task`, and seven risk boundaries, reported `pass`, and waited for user confirmation without auto-advancing or touching provider/runtime boundaries.
```

```text
tool: claude-code
target: generic
status: passed
basebrief_identified: yes
v08x_identified: yes
current_commit_identified: yes
current_goal_repeated: yes
receiver_entry_task_repeated: yes
risk_boundaries_count: 7
wait_for_user_confirmation: yes
no_auto_advance: yes
no_provider: yes
no_runtime: yes
public_safe_notes: Receiver identified BaseBrief, carried and restated the sidecar fields, reported `pass`, and stopped at the user-confirmation gate without provider or runtime activity.
```

## Interpretation

The generic receiver path now has public-safe acceptance evidence from both
OpenCode and Claude Code. Both summaries satisfy the v0.8.5 pass rule: BaseBrief,
v0.8.x, the current commit, `current_goal`, `receiver_entry_task`, at least two
risk boundaries, human-facing `pass`, wait-for-confirmation, no auto-advance,
no provider, and no runtime were all confirmed. This is the same receiver
acceptance anchor later surfaced by `new-window-starter.md`.

OpenClaw-target rows remain `not_run` with `manual_required`; no OpenClaw/Hermes
runtime or profile/config/memory/workspace writes were attempted.

## Boundaries

- No provider request.
- No raw private output.
- No runtime integration.
- No schema change.
- No Auto Flow.
- No receiver thread creation.
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
