# Structured Full Handoff Example

## project_identity

BaseBrief public sample project.

## current_goal

Prepare a complete handoff that keeps the readable brief clean while also carrying structured BB9 handoff input.

## verified_facts

- BaseBrief has one public skill entry.
- Normal continuation uses full or lite.
- Cache-ready remains an explicit experiment route.

## confirmed_decisions

- Keep readable briefs as the human-facing surface.
- Generate provider-facing sidecar artifacts through BB9 handoff post-processing.

## assumptions

- The next agent can inspect repository files before editing.
- No release or tag is planned in this phase.

## open_questions

- Whether a future adapter should use the same handoff source data directly.

## risk_boundaries

- Do not write secrets or local absolute paths.
- Do not describe estimated cost as a billing audit.
- Do not generalize MiMo evidence to all providers.

## expected_output

Readable full handoff plus structured JSON block for BB9 handoff generation.

## tail_request

Generate BB9 handoff artifacts from the structured block.

<!-- BASEBRIEF_HANDOFF_JSON_BEGIN -->
```json
{
  "mode": "full",
  "provider_profile": "mimo",
  "project_identity": "BaseBrief public sample project",
  "current_goal": "Prepare a complete handoff that keeps the readable brief clean while also carrying structured BB9 handoff input.",
  "verified_facts": [
    "BaseBrief has one public skill entry.",
    "Normal continuation uses full or lite.",
    "Cache-ready remains an explicit experiment route."
  ],
  "confirmed_decisions": [
    "Keep readable briefs as the human-facing surface.",
    "Generate provider-facing sidecar artifacts through BB9 handoff post-processing."
  ],
  "assumptions": [
    "The next agent can inspect repository files before editing.",
    "No release or tag is planned in this phase."
  ],
  "open_questions": [
    "Whether a future adapter should use the same handoff source data directly."
  ],
  "risk_boundaries": [
    "Do not write secrets or local absolute paths.",
    "Do not describe estimated cost as a billing audit.",
    "Do not generalize MiMo evidence to all providers."
  ],
  "forbidden_scope": [
    ".env files",
    "API keys",
    "private local paths"
  ],
  "expected_output": "Readable full handoff plus structured JSON block for BB9 handoff generation.",
  "tail_request": "Generate BB9 handoff artifacts from the structured block."
}
```
<!-- BASEBRIEF_HANDOFF_JSON_END -->
