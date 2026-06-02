# Cache-ready v4: BB4 Anchor Pad

`BB4 Anchor Pad` is an experimental cache-economics protocol. It does not replace `full`, `lite`, or readable cache-ready v1.

## Protocol

BB4 reuses BB3's pre-registered request options and adds a required stable pad before the dynamic selector:

```text
BB3
P=project identity
G=current goal
F=verified facts
D=confirmed decisions
R=risk boundaries
X=forbidden scope
O=expected output
QAA=request option A
QAB=request option B
PAD=p p p p p p p p
--
Q=A
```

Only `Q=` should change between repeated requests. `PAD` is not semantic content; it is a provider-specific cache alignment experiment.

## BB3 vs BB4 Ablation

Existing MiMo local real-project summaries show the important distinction:

- BB3 Anchor summary: `tests/outputs/provider-cache-benchmark-anchor.latest.json`
- BB4 Anchor Pad summary: `tests/outputs/provider-cache-benchmark-anchorpad.latest.json`

BB3 alone was inconclusive in the saved MiMo run. BB4 added the stable pad and reached estimated-cost evidence in the saved MiMo run. This suggests PAD is the key variable to investigate, but it does not prove a provider-documented cache-line mechanism.

## Latest MiMo Result

- Provider: MiMo official direct API
- Model: `mimo-v2.5`
- Mode: `anchorpad`
- Requests: `900`
- Valid requests: `897`
- Cache field visibility: `897/897`
- AnchorPadV4 cache ratio wins: `10/18`
- AnchorPadV4 estimated cost wins: `16/18`
- Overall estimated cost delta percent vs natural: `-14.65%`
- Conclusion level: `anchorpad_cost_large_sample_evidence`

Allowed wording: MiMo `mimo-v2.5` local real-project samples show estimated-cost evidence for BB4 anchor-pad.

Disallowed wording: BB4 is proven cheaper across all providers, all models, all project shapes, or real billing statements.

## PAD Sweep

`scripts/provider_cache_benchmark.js --mode padSweep` tests PAD lengths `4`, `8`, `16`, `32`, and `64` using the same anchor structure. The baseline variant is `anchorPad8`, matching the saved BB4 run.

Example command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode padSweep --output tests/outputs/private/provider-cache-benchmark-padsweep.raw.json
```

Smoke command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode padSweep --repeat-count 2 --project-limit 1 --scenario-limit 2 --output tests/outputs/private/provider-cache-benchmark-padsweep-smoke.raw.json --summary-output tests/outputs/provider-cache-benchmark-padsweep-smoke.latest.json
```

Public summary output is redacted. Raw output remains under `tests/outputs/private/`.

Latest MiMo pad sweep:

- Provider: MiMo official direct API
- Model: `mimo-v2.5`
- Requests: `900`
- Valid requests: `900`
- Cache field visibility: `900/900`
- `anchorPad4` wins vs `anchorPad8`: `18/18`, overall estimated cost delta percent `-3.65%`
- `anchorPad64` wins vs `anchorPad8`: `17/18`, overall estimated cost delta percent `-1.06%`
- Conclusion level: `pad_sweep_no_better_candidate`
- Public summary: `tests/outputs/provider-cache-benchmark-padsweep.latest.json`

This does not justify changing BB4's default `8`-token pad, because no tested alternative beat `anchorPad8` by the required `5%` overall estimated-cost threshold.

## DeepSeek Profile

DeepSeek `deepseek-v4-flash` can be tested as a second provider profile after a smoke run confirms `cached_tokens` visibility. The pricing profile uses the 2026-06-02 Asia/Shanghai CNY per 1M tokens values confirmed by the user:

- input cache hit: `0.02`
- input cache miss: `1`
- output: `2`

Do not claim dual-provider evidence unless DeepSeek independently passes the benchmark thresholds.

Latest DeepSeek pad sweep:

- Provider: DeepSeek official API
- Model: `deepseek-v4-flash`
- Requests: `900`
- Valid requests: `900`
- Cache field visibility: `900/900`
- `anchorPad4` wins vs `anchorPad8`: `18/18`, overall estimated cost delta percent `-2.05%`
- `anchorPad64` wins vs `anchorPad8`: `7/18`, overall estimated cost delta percent `+28.78%`
- Conclusion level: `pad_sweep_no_better_candidate`
- Public summary: `tests/outputs/provider-cache-benchmark-padsweep-deepseek.latest.json`

This is provider-specific evidence that DeepSeek exposes cache metrics and that a shorter pad may reduce estimated cost in this sample, but it does not meet the BB5 candidate threshold.
