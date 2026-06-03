# BB9 Handoff Lite Output Example

This is a public-safe excerpt from:

```text
node scripts/generate_bb9_handoff.js --input examples/bb9-handoff-lite-input.json --mode lite --provider-profile deepseek
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

## cacheSidecar

```text
# BaseBrief BB9 Cache Sidecar
FORMAT: bb9-blockpad-lite-sidecar
RULE: Keep everything before TAIL_REQUEST stable across repeats; only TAIL_REQUEST may change.
PROFILE: deepseek
SELECTED_VARIANT: bb7BlockPadLite
MODE: lite

## Stable Project Snapshot
P=BaseBrief public sample project
G=Create a short continuation brief for one small documentation edit.
F=The task is bounded to docs wording. ; The repository keeps cache-ready evidence separate from normal usage claims.
D=Use lite for this small continuation. ; Attach BB9 sidecar only when the provider profile supports cache usage visibility.
R=Do not modify release tags. ; Do not expose secrets or private paths.
X=release ; tag ; API key
O=Short lite handoff plus BB9 cache sidecar.

<!-- BASEBRIEF_CACHE_BLOCK_PAD: p p p p ... p -->
--
TAIL_REQUEST=Give the next agent a compact task statement.
```

## selector

- selectedVariant: `bb7BlockPadLite`
- recommendedPromptType: `cacheSidecar`
- providerProfile: `deepseek`
- fallbackReason: `null`
- boundary: DeepSeek-specific estimated-cost evidence only.
- use policy: do not concatenate `readableBrief` and `cacheSidecar` into the same provider request.
