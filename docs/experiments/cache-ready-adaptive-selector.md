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

## Provider Profile

A provider profile defines:

- provider or route identity
- model name
- route type, such as direct provider or third-party relay
- evidence level
- pricing basis
- whether billing is audited

MiMo and DeepSeek results are direct provider evidence. Third-party relay routes must be recorded separately as relay-specific observations.

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
