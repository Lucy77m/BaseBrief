# BaseBrief ContextOps Boundary

ContextOps is a long-term framing for BaseBrief, not a product surface in this repository yet.

The idea is simple: project context should be captured, transformed, checked, sealed, and handed off with enough structure that humans and coding agents can continue work without guessing.

## What Exists Now

BaseBrief currently has local, file-based building blocks:

- readable `full` / `lite` handoff templates
- BB9 handoff contract
- provider profile metadata
- file-based Codex and Claude adapters
- artifact checks
- CLI Lite
- Seal/Diff v1

These pieces are enough to support a local context handoff workflow. They are not yet a platform.

## What ContextOps May Mean Later

ContextOps may become useful if real usage shows that the current local workflow needs a broader framing:

- consistent context capture across phases
- adapter outputs for more AI coding tools
- seal/diff review before major handoffs
- quality gates that prevent secret leaks and provider-claim drift
- clear separation between human-readable context and provider-facing active prompts

## Current Non-Goals

BaseBrief should not turn ContextOps into a large implementation scope yet.

Do not treat ContextOps as:

- a hosted service
- an account system
- a plugin ecosystem
- a project-management suite
- a provider gateway
- an automatic secret manager
- a real billing or latency audit system
- a promise that cache-aware prompts are provider-general

## Promotion Criteria

ContextOps should move from vision label to implementation scope only when there is concrete evidence:

- adapter outputs are used outside the original examples
- artifact checks prevent real sharing mistakes
- CLI Lite improves repeated local workflows
- seal/diff helps real multi-phase continuation decisions
- multiple providers support any provider-facing claims that would be described as general

Until then, ContextOps remains a boundary document and vocabulary anchor. The implementation priority stays with small, local, verifiable handoff improvements.
