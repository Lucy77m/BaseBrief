# BB9 Adaptive Selector

`BB9 Adaptive Selector` is the current strongest cache-economics design.

It does not assume one prompt format is best everywhere. Instead, it selects the lowest estimated-cost candidate per project-scenario calibration result.

Current candidates:

- `natural`
- `bb5SidecarLite`
- `bb6HybridLite`
- `bb7BlockPadLite`

The selector is evaluated from provider-visible token usage and the configured CNY price profile. It is not a real billing audit.

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
