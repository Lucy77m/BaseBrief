# BB11 Active Prompt Trim

`BB11 Active Prompt Trim` tests a shorter Lite-only active provider prompt after BB10 showed that the sidecar-only path was promising but still too long.

It is still a provider benchmark POC. It does not replace readable `full` / `lite`, and it does not replace the BB9 adaptive selector.

## Protocol

BB11 keeps the same single-active-prompt rule as BB10:

- send only one provider prompt for cache-aware repeated calls
- do not concatenate readable brief plus sidecar
- keep the stable fields before `TAIL_REQUEST`

The trimmed Lite prompt keeps only the core handoff fields:

```text
BB11L
FORMAT=bb11-lite-trim-sidecar
RULE=stable_before_tail;active_prompt_only;do_not_concat_readable
PROFILE=provider-profile
P=project identity
G=current goal
F=verified facts
D=confirmed decisions
R=risk boundaries
X=forbidden scope
O=expected output
PAD=p ...
--
TAIL_REQUEST=request
```

`bb11SelectorGuard` is a benchmark-only guard. It compares the static prompt length of BB11 trim and `bb9Best`, then uses BB9 when the trimmed prompt is longer. It is not a production selector and does not use provider cost feedback.

## Benchmark

Smoke command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode activePromptTrimPoc --project-limit 1 --scenario-limit 2 --repeat-count 2 --json
```

Medium-sample command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode activePromptTrimPoc --project-limit 3 --scenario-limit 6 --repeat-count 4 --json
```

`activePromptTrimPoc` compares:

- `readableLite`
- `cacheSidecarLiteOnly`
- `cacheSidecarLiteTrimOnly`
- `bb9Best`
- `bb11SelectorGuard`

## Evidence Rules

BB11 trim cost evidence requires:

- valid request count at least the benchmark large-sample threshold
- cache field visibility `>= 95%`
- estimated-cost wins `>= 15/18` against readable Lite
- overall median estimated cost at least `5%` lower than readable Lite

To become a selector replacement candidate, the guarded variant would also need to be no worse than `bb9Best` in every project-scenario comparison. The current MiMo sample does not meet that stronger bar.

Estimated cost is calculated from provider-visible usage fields and the configured CNY price profile. It is not a billing audit.

## Latest Evidence

MiMo `mimo-v2.5`, 360-request local real-project sample:

- valid requests: `360/360`
- cache field visibility: `360/360`
- `cacheSidecarLiteTrimOnly`: `16/18` estimated-cost wins vs readable Lite
- `cacheSidecarLiteTrimOnly`: `16/18` estimated-cost wins vs BB10 `cacheSidecarLiteOnly`
- `cacheSidecarLiteTrimOnly`: `10/18` no-worse-than-`bb9Best`
- `cacheSidecarLiteTrimOnly`: `-15.91%` overall estimated-cost delta vs readable Lite
- `cacheSidecarLiteTrimOnly`: `-11.97%` overall estimated-cost delta vs BB10 `cacheSidecarLiteOnly`
- `cacheSidecarLiteTrimOnly`: `-1.43%` overall estimated-cost delta vs `bb9Best`
- `bb11SelectorGuard`: `18/18` estimated-cost wins vs readable Lite
- `bb11SelectorGuard`: `12/18` no-worse-than-`bb9Best`
- `bb11SelectorGuard`: `-16.93%` overall estimated-cost delta vs readable Lite
- `bb11SelectorGuard`: `-2.63%` overall estimated-cost delta vs `bb9Best`
- conclusion: `bb11_active_prompt_trim_cost_evidence`

DeepSeek `deepseek-v4-flash`, 20-request smoke:

- valid requests: `20/20`
- cache field visibility: `20/20`
- `cacheSidecarLiteTrimOnly`: `0/2` estimated-cost wins vs readable Lite
- `cacheSidecarLiteTrimOnly`: `+18.65%` overall estimated-cost delta vs readable Lite
- conclusion: `bb11_active_prompt_trim_inconclusive`

Interpretation: BB11 trim clears the MiMo cost-evidence threshold and fixes the BB10 Lite sidecar-only cost target on this local sample. It still does not clear the stronger selector-replacement bar because it is no-worse-than-`bb9Best` in only `10/18` comparisons, and the guarded variant reaches only `12/18`.

DeepSeek should not be expanded to a large sample for this variant based on the smoke result.

## Current Status

BB11 is useful as MiMo-specific active-prompt trim evidence. It should remain a POC until the guarded path can match or beat BB9 more consistently.

The default public recommendation remains:

- use readable `full` / `lite` for human handoff
- use BB9 adaptive selection as the strongest provider-cache mechanism
- use BB11 only as an experimental MiMo active-prompt trim line
