# BaseBrief Cache Evolution Log

This log records why each cache-ready generation exists and whether it has benchmark evidence.

## BB1 Cache-ready Lite

- Purpose: readable stable-prefix experiment for cache-aware continuation.
- Evidence: local proxy evidence and MiMo samples showed higher absolute `cached_tokens`.
- Limitation: normalized testing did not prove better cache ratio or estimated cost.

## BB2 Cache Capsule

- Purpose: compact deterministic capsule with fixed field order and dynamic tail after `--`.
- Evidence: deterministic and shorter than BB1 in static tests.
- Limitation: large samples did not make it the best cost candidate.

## BB3 Cache Anchor

- Purpose: register tail options in the stable prefix and vary only a final selector.
- Evidence: provider benchmarked as an intermediate candidate.
- Limitation: did not become the strongest cost result.

## BB4 Anchor Pad

- Purpose: add a short stable PAD before the selector to test provider cache-boundary behavior.
- Evidence: MiMo and DeepSeek PAD sweep showed `PAD=4` as a small improvement over the earlier 8-token baseline.
- Limitation: improvements were not large enough to declare a new universal best template.

## BB5 Cache Sidecar

- Purpose: split human-readable Full/Lite continuation from a compact cache-economics sidecar.
- Evidence: MiMo `mimo-v2.5` showed `bb5SidecarLite` best evidence; DeepSeek showed `bb5SidecarFull` promising signal.
- Limitation: provider behavior diverged, so one sidecar variant was not enough.

## BB6 Hybrid Anchor

- Purpose: keep a more natural stable project snapshot while still anchoring tail options and changing only final `CHOICE`.
- Evidence: DeepSeek improved in some cases but did not cross the strict `15/18` threshold.
- Limitation: longer natural context helped some samples and hurt others.

## BB7 Block Pad Lite

- Purpose: align stable prompt length with provider cache blocks, especially for DeepSeek cases where natural already hit a strong cache boundary.
- Evidence: DeepSeek blockpad reached promising signal and fixed several block-boundary cases.
- Limitation: fixed padding regressed other projects and did not become a universal format.

## BB8 Aligned Block Pad Lite

- Purpose: tune block padding by scenario after BB7 showed boundary sensitivity.
- Evidence: smoke tests showed extra padding can help one scenario while hurting another.
- Limitation: scenario-level padding still overfits; it is not a robust standalone mechanism.

## BB9 Adaptive Selector

- Purpose: stop assuming one prompt format is best; calibrate candidate variants and select the lowest estimated-cost candidate per project-scenario.
- Candidate pool: `natural`, `bb5SidecarLite`, `bb6HybridLite`, `bb7BlockPadLite`.
- Evidence: MiMo `18/18` wins vs natural and DeepSeek `17/18` wins plus `18/18` no-worse-than-natural in local real-project samples.
- Current status: strongest mechanism so far, but still provider- and sample-specific estimated-cost evidence.
- Productization POC: `scripts/generate_bb9_handoff.js` keeps readable `full` / `lite` as the primary handoff and emits `cacheSidecar` only when `scripts/bb9_provider_profiles.json` marks cache usage as observable.
- Fallback rule: providers without visible cache-cost evidence return `selectedVariant=natural` and no sidecar.
