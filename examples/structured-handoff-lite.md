# Structured Lite Handoff Example

## project_identity

BaseBrief public sample project.

## current_goal

Prepare a short handoff with structured BB9 input attached as an appendix.

## verified_facts

- Lite stays short and readable.
- Provider prompts are generated as post-processing artifacts.
- Relay profiles fall back to readable output when cache cost is not observable.

## confirmed_decisions

- Do not place sidecar fields in the visible Lite body.
- Use the marked JSON block as the only machine-readable source for builder tests.

## risk_boundaries

- Do not write secrets.
- Do not publish private absolute paths.
- Do not claim provider-general cache savings.

## next_step

Build handoff artifacts from the JSON appendix.

<!-- BASEBRIEF_HANDOFF_JSON_BEGIN -->
```json
{
  "mode": "lite",
  "provider_profile": "relay-openai-gpt55-codex-oauth",
  "project_identity": "BaseBrief public sample project",
  "current_goal": "Prepare a short handoff with structured BB9 input attached as an appendix.",
  "verified_facts": [
    "Lite stays short and readable.",
    "Provider prompts are generated as post-processing artifacts.",
    "Relay profiles fall back to readable output when cache cost is not observable."
  ],
  "confirmed_decisions": [
    "Do not place sidecar fields in the visible Lite body.",
    "Use the marked JSON block as the only machine-readable source for builder tests."
  ],
  "risk_boundaries": [
    "Do not write secrets.",
    "Do not publish private absolute paths.",
    "Do not claim provider-general cache savings."
  ],
  "forbidden_scope": [
    ".env files",
    "API keys",
    "private local paths"
  ],
  "expected_output": "Readable lite handoff plus active provider prompt fallback.",
  "tail_request": "Build handoff artifacts from the JSON appendix."
}
```
<!-- BASEBRIEF_HANDOFF_JSON_END -->
