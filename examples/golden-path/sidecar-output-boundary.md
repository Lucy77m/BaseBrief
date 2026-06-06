# Sidecar Output Boundary

This public example kit does not include raw Sidecar bundle files copied from a
real private build directory.

That means the kit does not publish raw `handoff.md`, `next-chat-prompt.md`,
`new-window-starter.md`, `receiver-entry-task.md`, `risk-boundaries.md`,
`state-summary.json`, or `manifest.json` from a real `sidecar-build` run.

Use ignored private directories such as `tests/outputs/private/...` when
exercising `sidecar-build` or `sidecar-check`.

Public examples may name those files and explain their role, but they must keep
the same boundaries:

- No provider request.
- No raw private output.
- No runtime integration.
- No schema change.
- No Auto Flow.
