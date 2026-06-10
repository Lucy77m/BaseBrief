# BaseBrief Concepts In Plain Language

BaseBrief has a lot of internal names. First-time users only need a few.

## Continue

The main command. It creates a continuation package for the next AI window.

```text
node scripts/basebrief.js continue --repo . --output-dir tests/outputs/private/continue
```

## Next Window Starter

`NEXT_WINDOW_STARTER.md` is the file you copy into the next AI window.

It tells the next assistant what to read first, what facts are inherited, what must be rechecked, and what the next narrow task is.

## Check Summary

`CHECK_SUMMARY.md` tells you whether the package is clean, needs review, or is blocked.

Warnings usually mean a human should read before copying the starter. Errors mean the package should be repaired first.

## Continuation Report

`CONTINUATION_REPORT.md` is the human-readable summary of the current repo state, recent changes, boundaries, and next step.

Read this before handing the package to another AI.

## Context Pack

`context-pack/` is the fuller project reference bundle behind the continuation package.

It is useful when the next AI needs more detail than the starter alone provides.

## Project Profile

A Project Profile is an optional reviewed config for repeated continuation runs on the same project.

You do not need it for your first run.

## Workflow Runner Lite

Workflow Runner Lite is an advanced wrapper around Project Profile and Continue. It is not the main public path and does not execute project work.

For first use, start with `continue`.

## Cache-ready

`cache-ready` is an explicit prompt-cache experiment route. It is not the normal continuation mode and does not prove cross-provider savings.
