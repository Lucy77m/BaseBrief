# BB9 Adaptive Selector

`BB9 Adaptive Selector` is the current strongest cache-economics design.

It does not assume one prompt format is best everywhere. Instead, it selects the lowest estimated-cost candidate per project-scenario calibration result.

Current candidates:

- `natural`
- `bb5SidecarLite`
- `bb6HybridLite`
- `bb7BlockPadLite`

The selector is evaluated from provider-visible token usage and the configured CNY price profile. It is not a real billing audit.

## Mechanism

BB9 has four steps:

1. Build candidate prompts for the same project-scenario pair.
2. Run calibration requests through the selected provider profile.
3. Compute estimated cost from provider-visible usage fields and the configured price profile.
4. Select the candidate with the lowest median estimated cost.

The selector always keeps `natural` in the candidate pool. If every cache-aware candidate is more expensive than `natural`, the selector should fall back to `natural` and must not claim a savings win.

## Handoff POC

BB9 now has a productization POC:

```text
node scripts/generate_bb9_handoff.js --input examples/bb9-handoff-full-input.json --mode full --provider-profile mimo
node scripts/generate_bb9_handoff.js --input examples/bb9-handoff-lite-input.json --mode lite --provider-profile deepseek
```

The output is JSON:

- `readableBrief`: the normal human-readable Full/Lite handoff.
- `cacheSidecar`: a stable BB9 sidecar when the provider profile exposes cache usage evidence.
- `selectedVariant`: the selected cache-economics variant, or `natural` for fallback.
- `recommendedPromptType`: which artifact should be used as the active provider prompt.
- `promptUsePolicy`: warns that readable and sidecar artifacts must not be concatenated into the same provider request.
- `providerProfile`: public provider/model/evidence/pricing metadata with no API key.
- `fallbackReason`: why no sidecar is emitted.
- `warnings`: wording boundaries for estimated-cost evidence.

The sidecar is a separate artifact, not a text block to append blindly. Ordinary project continuation still reads `readableBrief` first. Cache-aware repeated provider calls should use `cacheSidecar` as the active prompt only when `recommendedPromptType=cacheSidecar`.

Public examples:

- [full + cache sidecar](../../examples/bb9-handoff-full-output.md)
- [lite + cache sidecar](../../examples/bb9-handoff-lite-output.md)
- [unsupported provider fallback](../../examples/bb9-handoff-fallback-output.md)

Provider benchmark for the merged handoff prompt:

```text
node scripts/provider_cache_benchmark.js --local-projects --mode handoffPoc --output tests/outputs/private/provider-cache-benchmark-handoff-poc.raw.json
```

`handoffPoc` compares `readableFull`, `readableFullSidecar`, `readableLite`, `readableLiteSidecar`, and `bb9Best`. It is a safety check for the tempting but risky "concatenate readable + sidecar" design. If it is inconclusive or negative, keep the dual-artifact single-active-prompt policy.

## Provider Profile

A provider profile defines:

- provider or route identity
- model name
- route type, such as direct provider or third-party relay
- evidence level
- pricing basis
- whether billing is audited

MiMo and DeepSeek results are direct provider evidence. Third-party relay routes must be recorded separately as relay-specific observations.

The current POC profile config lives in `scripts/bb9_provider_profiles.json`. It contains public provider route metadata, pricing basis, evidence level, and latest redacted benchmark summary references. It does not contain API keys.

## When Not To Use BB9

Do not use BB9 as a savings claim when:

- the provider does not expose enough usage data to estimate cache-aware cost
- the task is a one-off call with no repeated stable prefix
- the calibration sample is too small to compare candidates
- the candidate pool would remove `natural` fallback
- the route is a third-party relay whose usage fields cannot distinguish cache cost from prompt length

## Why Selector

Single-format experiments exposed provider-specific and project-specific behavior:

- BB5 Sidecar was strong on MiMo, especially Lite.
- BB6 Hybrid improved some DeepSeek cases but still missed the strict threshold.
- BB7 Block Pad fixed several DeepSeek block-alignment cases but regressed other cases.
- BB8 scenario-aligned padding showed that extra padding can help one scenario while hurting another.

The practical mechanism is therefore calibration plus selection, not a universal cache-ready body.

## Evidence Rules

BB9 best evidence requires:

- valid request rate `>= 90%`
- cache field visibility `>= 95%`
- selected candidate is no worse than `natural` in every project-scenario comparison
- selected candidate beats `natural` in at least `15/18` comparisons
- selected median estimated cost is at least `5%` lower than natural

## Latest Evidence

MiMo `mimo-v2.5`, 720-request local real-project sample:

- valid requests: `716/720`
- cache field visibility: `714/716`
- selected candidate wins vs natural: `18/18`
- selected candidate no worse than natural: `18/18`
- median estimated cost delta vs natural: `-40.59%`
- conclusion: `bb9_adaptive_selector_best_evidence`

DeepSeek `deepseek-v4-flash`, 720-request local real-project sample:

- valid requests: `720/720`
- cache field visibility: `720/720`
- selected candidate wins vs natural: `17/18`
- selected candidate no worse than natural: `18/18`
- median estimated cost delta vs natural: `-26.54%`
- conclusion: `bb9_adaptive_selector_best_evidence`

Interpretation: BB9 is the first line with strong evidence on both MiMo and DeepSeek in the local real-project benchmark. Do not generalize this beyond these providers, these local project samples, and the 2026-06-02 CNY per 1M token price profile.
