# BB9 Unsupported Provider Fallback Example

This is a public-safe excerpt from:

```text
node scripts/generate_bb9_handoff.js --input examples/bb9-handoff-lite-input.json --mode lite --provider-profile relay-openai-gpt55-codex-oauth
```

## readableBrief

```md
# BaseBrief Lite Handoff

## project_identity
BaseBrief public sample project

## current_goal
Create a short continuation brief for one small documentation edit.

## verified_facts
- The task is bounded to docs wording.
- The repository keeps cache-ready evidence separate from normal usage claims.

## confirmed_decisions
- Use lite for this small continuation.
- Attach BB9 sidecar only when the provider profile supports cache usage visibility.

## risk_boundaries
- Do not modify release tags.
- Do not expose secrets or private paths.

## expected_output
Short lite handoff plus BB9 cache sidecar.

## tail_request
Give the next agent a compact task statement.
```

## selector

- cacheSidecar: `null`
- selectedVariant: `natural`
- recommendedPromptType: `readableBrief`
- providerProfile: `relay-openai-gpt55-codex-oauth`
- fallbackReason: `cache_cost_not_observable`

The relay usage audit observed usage tokens but did not expose `cached_tokens`, so BaseBrief keeps the readable Lite handoff and does not claim cache-cost savings for this route.
