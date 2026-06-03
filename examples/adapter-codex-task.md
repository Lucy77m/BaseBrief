# BaseBrief Codex Task

## Goal
Prepare a complete handoff that keeps the readable brief clean while also carrying structured BB9 handoff input.

## Verified Facts
- BaseBrief has one public skill entry.
- Normal continuation uses full or lite.
- Cache-ready remains an explicit experiment route.

## Confirmed Decisions
- Keep readable briefs as the human-facing surface.
- Generate provider-facing sidecar artifacts through BB9 handoff post-processing.

## Risk Boundaries
- Do not write secrets or local absolute paths.
- Do not describe estimated cost as a billing audit.
- Do not generalize MiMo evidence to all providers.

## Forbidden Scope
- .env files
- API keys
- private local paths

## Next Task
Generate BB9 handoff artifacts from the structured block.

## Open Questions
- Whether a future adapter should use the same handoff source data directly.

