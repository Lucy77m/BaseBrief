# BB6 Hybrid Anchor

`BB6 Hybrid Anchor` tests a natural-context cache sidecar:

- keep a more natural project snapshot in the stable prefix
- register both tail options before the dynamic boundary
- change only the final `CHOICE=A/B`

This is a response to the BB5 result: MiMo favored the compact Lite sidecar, while DeepSeek favored the Full sidecar but missed the strict `15/18` threshold by one scenario.

## Protocol

```text
# BaseBrief BB6 Hybrid Anchor
FORMAT: bb6-hybrid-full
RULE: Keep everything before CHOICE stable across repeats; only CHOICE may change.

## Project Identity
projectA/scenario: local real-project benchmark snapshot

## Current Goal
...

## Stable Project Snapshot
README 摘要：...
package 摘要：...
入口与配置文件：...
文件样本：...

## Safety Boundary
- Source project is read-only.
- Sensitive files and generated directories are excluded.
- Do not read or output env files, tokens, secrets, or credentials.

## Expected Output
readable Full-style BaseBrief continuation answer

## Stable Tail Options
A=...
B=...

<!-- BASEBRIEF_CACHE_PAD: p p p p -->
--
CHOICE=A
```

`bb6HybridFull` keeps more context. `bb6HybridLite` uses a shorter project snapshot. Both are still experimental cache-economics prompts, not ordinary user-facing handoff templates.

## Benchmark

Full command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode hybrid --output tests/outputs/private/provider-cache-benchmark-hybrid.raw.json
```

Smoke command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode hybrid --repeat-count 2 --project-limit 1 --scenario-limit 2 --output tests/outputs/private/provider-cache-benchmark-hybrid-smoke.raw.json --summary-output tests/outputs/provider-cache-benchmark-hybrid-smoke.latest.json
```

Hybrid mode compares:

- `natural`
- `bb4AnchorPad`
- `bb5SidecarFull`
- `bb5SidecarLite`
- `bb6HybridFull`
- `bb6HybridLite`

Default scale is 1080 requests: 3 projects x 6 scenarios x 6 variants x 10 repeats.

## Evidence Rules

BB6 best evidence requires:

- valid request rate `>= 90%`
- cache field visibility `>= 95%`
- estimated cost wins `>= 15/18` against `natural`
- overall median estimated cost at least `5%` lower than `natural`
- no weaker than the matching BB5 sidecar on overall median estimated cost
- at least `9/18` estimated-cost wins against the matching BB5 sidecar

If BB6 wins natural but loses BB5, it is not a new best candidate. Do not claim provider-general savings or real billing savings.
