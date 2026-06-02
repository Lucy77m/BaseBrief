# Cache-ready v3/v4: BB3 Cache Anchor and BB4 Anchor Pad

`BB3 Cache Anchor` is an experimental follow-up to BB2. It is designed around a different hypothesis: reducing total prompt length is less important than reducing uncached tail variation.

## Protocol

BB3 pre-registers request options inside the stable prefix:

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
--
Q=A
```

Only `Q=` changes across repeated calls. This is intentionally less flexible than BB2, but it tests whether MiMo rewards a nearly zero-length dynamic suffix.

BB4 adds a small stable pad before the dynamic selector:

```text
PAD=p p p p p p p p
--
Q=A
```

The pad is not semantic content. It is a cache-line alignment hint for MiMo-style token caching experiments.

## Benchmark

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode anchor --output tests/outputs/private/provider-cache-benchmark-anchor.raw.json
```

BB4 anchor-pad benchmark:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode anchorpad --output tests/outputs/private/provider-cache-benchmark-anchorpad.raw.json
```

Anchor mode compares:

- `natural`
- `cacheReady`
- `capsuleV2`
- `anchorV3`

Default scale is 720 requests: 3 projects x 6 scenarios x 4 variants x 10 repeats.

Anchor-pad scale is 900 requests: 3 projects x 6 scenarios x 5 variants x 10 repeats.

## Evidence Rules

Allowed wording depends on benchmark results:

- `anchorV3` estimated cost wins at least 12/18 and median cost drops at least 3%: initial cost signal.
- `anchorV3` estimated cost wins at least 15/18 and median cost drops at least 5%: MiMo local real-project estimated-cost evidence.

Do not claim provider-general savings.

## Latest MiMo Result

Latest BB4 anchor-pad benchmark:

- Provider: MiMo official direct API
- Model: `mimo-v2.5`
- Mode: `anchorpad`
- Requests: `900`
- Valid requests: `897`
- Cache field visibility: `897/897`
- Public summary: `tests/outputs/provider-cache-benchmark-anchorpad.latest.json`

Median repeat metrics:

| variant | cached tokens | cache ratio | estimated cost CNY |
|---|---:|---:|---:|
| natural | 1472 | 0.9755 | 0.0001096 |
| cacheReady v1 | 1472 | 0.9715 | 0.0001176 |
| capsuleV2 | 1088 | 0.9552 | 0.0001122 |
| anchorV3 | 1152 | 0.9655 | 0.00011582 |
| anchorPadV4 | 1152 | 0.9808 | 0.00009354 |

BB4 result:

- cache ratio wins: `10/18`
- estimated cost wins: `16/18`
- overall estimated cost delta: `-0.00001606` CNY
- overall estimated cost delta percent: `-14.65%`
- conclusion level: `anchorpad_cost_large_sample_evidence`

Allowed wording: MiMo `mimo-v2.5` local real-project samples show estimated-cost advantage for BB4 anchor-pad.

Disallowed wording: BB4 is proven cheaper across all providers or all project shapes.

BB4 now has a separate experiment note: [cache-ready-anchor-pad.md](cache-ready-anchor-pad.md).
