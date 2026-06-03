# BaseBrief Claude Project Context

## Project Identity
BaseBrief public sample project

## Current Goal
Prepare a complete handoff that keeps the readable brief clean while also carrying structured BB9 handoff input.

## Verified Facts
- BaseBrief has one public skill entry.
- Normal continuation uses full or lite.
- Cache-ready remains an explicit experiment route.

## Confirmed Decisions
- Keep readable briefs as the human-facing surface.
- Generate provider-facing sidecar artifacts through BB9 handoff post-processing.

## Assumptions
- The next agent can inspect repository files before editing.
- No release or tag is planned in this phase.

## Risk Boundaries
- Do not write secrets or local absolute paths.
- Do not describe estimated cost as a billing audit.
- Do not generalize MiMo evidence to all providers.

## Open Questions
- Whether a future adapter should use the same handoff source data directly.

## Expected Output
Readable full handoff plus structured JSON block for BB9 handoff generation.

