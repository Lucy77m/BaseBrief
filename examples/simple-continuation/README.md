# Simple Continuation Example

This example shows the first BaseBrief idea without advanced terms:

```text
I worked with AI on a small Todo app.
The chat is getting long.
I want the next AI window to continue the UI polish and README cleanup.
```

## Run

From a real repo, the normal command is:

```text
node scripts/basebrief.js continue --repo . --output-dir tests/outputs/private/continue
```

This directory is a public-safe shape example. It shows what a simple input and output can look like.

## Read Order

1. `input/PROJECT_STATE.md`
2. `input/NOTES.md`
3. `output/CONTINUATION_REPORT.md`
4. `output/CHECK_SUMMARY.md`
5. `output/NEXT_WINDOW_STARTER.md`

The file you copy into the next AI window is:

```text
output/NEXT_WINDOW_STARTER.md
```

## What This Example Proves

BaseBrief is not trying to develop the project for you. It is helping you turn project context into a small, reviewable handoff so the next AI can continue without guessing.

## Boundaries

This example does not call providers, does not run a runtime, does not read private files, and does not perform git or release actions.
