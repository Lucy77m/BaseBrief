# BB12 Size-band Guard

`BB12 Size-band Guard` is a MiMo-focused follow-up to BB11. BB11 trim crossed the readable Lite cost threshold, but it was not reliably no-worse-than `bb9Best`. BB12 keeps the useful BB11 path for small and medium prompts, then falls back to BB9 for larger prompt bands where BB11 lost a cache block.

This is still provider-specific estimated-cost evidence. It is not a billing audit and not a cross-provider proof.

## Protocol

`bb12GuardPoc` compares:

- `readableLite`
- `cacheSidecarLiteTrimOnly`
- `bb9Best`
- `bb11SelectorGuard`
- `bb12SizeBandGuard`

The BB12 guard rule is intentionally narrow:

```text
if BB11 trimmed prompt has 3200 or more characters:
  use bb9Best
else:
  use BB11 selector guard
```

The 3200-character boundary comes from the BB11 MiMo failure analysis: the larger project band lost to `bb9Best` even though BB11 was shorter, because it received fewer cached tokens.

## Benchmark

Smoke command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode bb12GuardPoc --project-limit 1 --scenario-limit 2 --repeat-count 2 --json
```

Medium-sample command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode bb12GuardPoc --project-limit 3 --scenario-limit 6 --repeat-count 4 --json
```

Default summary output:

```text
tests/outputs/provider-cache-benchmark-bb12-guard-poc.latest.json
```

## Evidence Rules

BB12 selector-candidate evidence requires:

- valid request count at least the benchmark large-sample threshold
- cache field visibility `>= 95%`
- estimated-cost wins `>= 15/18` against readable Lite
- no-worse-than-`bb9Best` in every project-scenario comparison
- overall median estimated cost at least `5%` lower than readable Lite
- overall median estimated cost no higher than `bb9Best`

## Latest Evidence

MiMo `mimo-v2.5`, 360-request local real-project sample:

- valid requests: `360/360`
- cache field visibility: `360/360`
- `bb12SizeBandGuard`: `18/18` estimated-cost wins vs readable Lite
- `bb12SizeBandGuard`: `18/18` no-worse-than-`bb9Best`
- `bb12SizeBandGuard`: `18/18` no-worse-than BB11 selector guard
- `bb12SizeBandGuard`: `-28.70%` overall estimated-cost delta vs readable Lite
- `bb12SizeBandGuard`: `-11.37%` overall estimated-cost delta vs `bb9Best`
- `bb12SizeBandGuard`: `-13.90%` overall estimated-cost delta vs BB11 selector guard
- conclusion: `bb12_size_band_guard_selector_candidate`

DeepSeek `deepseek-v4-flash`, 20-request smoke:

- valid requests: `20/20`
- cache field visibility: `20/20`
- `bb12SizeBandGuard`: `0/2` estimated-cost wins vs readable Lite
- `bb12SizeBandGuard`: `1/2` no-worse-than-`bb9Best`
- `bb12SizeBandGuard`: `+14.57%` overall estimated-cost delta vs readable Lite
- conclusion: `bb12_size_band_guard_inconclusive`

Interpretation: BB12 reaches the requested MiMo selector-candidate bar on this local real-project sample. It should not be generalized beyond MiMo `mimo-v2.5`, the tested project set, and the configured CNY price profile.

DeepSeek should not be expanded to a large sample for this variant based on the smoke result.

## Current Status

BB12 is the first active-prompt guard POC in this line that simultaneously clears the readable Lite cost target and the no-worse-than-`bb9Best` target on MiMo.

The default public recommendation remains conservative:

- BB9 adaptive selector is still the broadly documented provider-cache mechanism.
- BB12 is a MiMo-specific active-prompt guard candidate.
- readable `full` / `lite` remain the primary human handoff formats.
