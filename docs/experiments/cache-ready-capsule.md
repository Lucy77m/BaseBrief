# Cache-ready v2: BB2 Cache Capsule

`BB2 Cache Capsule` is an experimental cache-ready v2 protocol. It does not replace `full`, `lite`, or the readable cache-ready v1 format.

## Purpose

v1 keeps a readable stable-prefix shape. BB2 is more aggressive: it compresses the stable project state into fixed short fields and puts all request-specific variation after `T=`.

```text
BB2
P=project identity
G=current goal
F=verified facts
D=confirmed decisions
R=risk boundaries
X=forbidden scope
O=expected output
--
T=tail request
```

## Boundaries

BB2 can be used to test whether a smaller stable prefix improves cache ratio or estimated cost on a specific provider.

BB2 must not be described as proven cheaper until provider data supports it. Current MiMo evidence for v1 shows higher absolute cached tokens, but the normalized v1 benchmark did not prove cache-ratio or estimated-cost advantage.

## Benchmark

The local benchmark supports a capsule mode:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode capsule --output tests/outputs/private/provider-cache-benchmark-capsule.raw.json
```

Public output is written to `tests/outputs/provider-cache-benchmark-capsule.latest.json`. Raw output remains under `tests/outputs/private/`.

Capsule mode compares:

- `natural`
- `cacheReady`
- `capsuleV2`

Because three variants are tested, the default request count is 540 requests: 3 projects x 6 scenarios x 3 variants x 10 repeats.

## Evidence Rules

Use cautious wording:

- `capsuleV2` cache ratio wins at least 12/18: say "promising cache-ratio signal".
- `capsuleV2` estimated cost wins at least 12/18 and median cost drops at least 3%: say "initial cost signal".
- `capsuleV2` estimated cost wins at least 15/18 and median cost drops at least 5%: say "MiMo mimo-v2.5 local real-project sample shows estimated-cost advantage".

Do not generalize to other providers without separate tests.

## Latest MiMo Result

Latest capsule benchmark:

- Provider: MiMo official direct API
- Model: `mimo-v2.5`
- Mode: `capsule`
- Requests: `540`
- Valid requests: `540`
- Cache field visibility: `539/540`
- Public summary: `tests/outputs/provider-cache-benchmark-capsule.latest.json`

Median repeat metrics:

| variant | cached tokens | cache ratio | estimated cost CNY |
|---|---:|---:|---:|
| natural | 1472 | 0.9755 | 0.0001096 |
| cacheReady v1 | 1472 | 0.9715 | 0.0001176 |
| capsuleV2 | 1088 | 0.9552 | 0.0001122 |

Capsule v2 result:

- cache ratio wins: `6/18`
- estimated cost wins: `10/18`
- overall estimated cost delta: `+0.0000026` CNY
- overall estimated cost delta percent: `+2.37%`
- conclusion level: `capsule_inconclusive`

Allowed wording: BB2 is meaningfully shorter and remains worth iterating as an experimental protocol.

Disallowed wording: BB2 has proven a MiMo cache-ratio or estimated-cost advantage.
