# Readable Full/Lite Cache POC

This POC tests whether readable Markdown-style BaseBrief prompts can keep part of the cache-economics benefit observed in BB4 Anchor Pad.

It does not merge cache-ready into `full` or `lite`. It only benchmarks a readable prompt shape.

## Variants

`readablePoc` compares five variants:

- `natural`
- `readableFull`
- `readableFullPad4`
- `readableLite`
- `readableLitePad4`

The readable variants keep a stable Markdown section order and place the dynamic request at the end. The padded variants insert a hidden Markdown comment immediately before the dynamic tail:

```text
<!-- BASEBRIEF_CACHE_PAD: p p p p -->
## Dynamic Tail Request
```

`PAD=4` is used because MiMo and DeepSeek pad sweep results showed stable small cost improvements for 4-token PAD, but not enough to justify a BB5 change.

## Benchmark

Smoke command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode readablePoc --repeat-count 2 --project-limit 1 --scenario-limit 2 --output tests/outputs/private/provider-cache-benchmark-readable-poc-smoke.raw.json --summary-output tests/outputs/provider-cache-benchmark-readable-poc-smoke.latest.json
```

Full command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode readablePoc --output tests/outputs/private/provider-cache-benchmark-readable-poc.raw.json
```

Raw output remains under `tests/outputs/private/`. Public summary output is redacted.

## Evidence Rules

For `readableFullPad4` or `readableLitePad4` to count as readable Markdown cost evidence, the provider run must meet all of these:

- valid request rate `>= 90%`
- cache field visibility `>= 95%`
- estimated cost wins `>= 15/18` against its non-padded readable baseline
- overall median estimated cost delta `<= -5%`

If wins are `>= 12/18` and cost delta is `<= -3%`, the result is only a promising signal.

Do not claim provider-general savings. Do not claim real billing savings; this is estimated from token usage and the configured price profile.

## Latest MiMo Result

- Provider: MiMo official direct API
- Model: `mimo-v2.5`
- Requests: `900`
- Valid requests: `900`
- Cache field visibility: `900/900`
- `readableFullPad4` estimated cost wins: `6/18`
- `readableFullPad4` overall estimated cost delta percent: `-0.04%`
- `readableLitePad4` estimated cost wins: `5/18`
- `readableLitePad4` overall estimated cost delta percent: `-7.04%`
- Conclusion level: `readable_poc_inconclusive`
- Public summary: `tests/outputs/provider-cache-benchmark-readable-poc.latest.json`

MiMo did not meet the `15/18` win threshold for readable Markdown cost evidence.

## Latest DeepSeek Result

- Provider: DeepSeek official API
- Model: `deepseek-v4-flash`
- Requests: `900`
- Valid requests: `900`
- Cache field visibility: `900/900`
- `readableFullPad4` estimated cost wins: `0/18`
- `readableFullPad4` overall estimated cost delta percent: `+10.56%`
- `readableLitePad4` estimated cost wins: `0/18`
- `readableLitePad4` overall estimated cost delta percent: `+15.04%`
- Conclusion level: `readable_poc_inconclusive`
- Public summary: `tests/outputs/provider-cache-benchmark-readable-poc-deepseek.latest.json`

DeepSeek did not show readable Markdown PAD cost advantage in this sample.
