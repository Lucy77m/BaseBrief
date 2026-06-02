# BB5 Cache Sidecar

`BB5 Cache Sidecar` tests a two-track workflow:

- `humanBrief`: readable Full/Lite-style continuation for people.
- `cacheSidecar`: compact cache-economics prompt derived from the same facts.

This does not put cache-ready formatting inside the readable Full/Lite Markdown body.

## Protocol

BB5 sidecar prompts use compact fields and a short dynamic selector:

```text
BB5S
S=full
P=project identity
G=current goal
F=verified facts
D=confirmed decisions
R=risk boundaries
X=forbidden scope
O=expected output
QAA=request option A
QAB=request option B
PAD=p p p p
--
Q=A
```

`S=full` and `S=lite` indicate which human-readable track the sidecar was derived from. Only `Q=` should change between repeated calls.

## Benchmark

Smoke command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode sidecar --repeat-count 2 --project-limit 1 --scenario-limit 2 --output tests/outputs/private/provider-cache-benchmark-sidecar-smoke.raw.json --summary-output tests/outputs/provider-cache-benchmark-sidecar-smoke.latest.json
```

Full command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode sidecar --output tests/outputs/private/provider-cache-benchmark-sidecar.raw.json
```

Sidecar mode compares:

- `natural`
- `readableFull`
- `readableLite`
- `bb4AnchorPad`
- `bb5SidecarFull`
- `bb5SidecarLite`

Default scale is 1080 requests: 3 projects x 6 scenarios x 6 variants x 10 repeats.

## Evidence Rules

BB5 sidecar cost evidence requires:

- valid request rate `>= 90%`
- cache field visibility `>= 95%`
- estimated cost wins `>= 15/18` against `natural`
- overall median estimated cost at least `5%` lower than `natural`

To be considered better than the current BB4 baseline, a sidecar variant should also be no worse than `bb4AnchorPad` on overall median estimated cost and win at least `9/18` comparisons against it.

Do not claim provider-general savings. Do not claim real billing savings; this is estimated from token usage and the configured price profile.

## Latest Evidence

MiMo `mimo-v2.5`, 1080-request local real-project sample:

- valid requests: `1080/1080`
- cache field visibility: `1080/1080`
- `bb5SidecarFull`: `16/18` estimated-cost wins vs natural, `-11.59%` overall estimated-cost delta vs natural, `+1.42%` vs BB4
- `bb5SidecarLite`: `15/18` estimated-cost wins vs natural, `-27.39%` overall estimated-cost delta vs natural, `-16.70%` vs BB4
- conclusion: `bb5_sidecar_best_evidence`

DeepSeek `deepseek-v4-flash`, 1080-request local real-project sample:

- valid requests: `1080/1080`
- cache field visibility: `1080/1080`
- `bb5SidecarFull`: `14/18` estimated-cost wins vs natural, `-17.16%` overall estimated-cost delta vs natural, `-8.14%` vs BB4
- `bb5SidecarLite`: `2/18` estimated-cost wins vs natural, `+6.36%` overall estimated-cost delta vs natural, `+17.94%` vs BB4
- conclusion: `bb5_sidecar_promising_signal`

Interpretation: BB5 Sidecar is stronger than the readable Markdown POC. MiMo supports the Lite sidecar as a best-evidence candidate. DeepSeek prefers the Full sidecar but does not cross the strict evidence threshold yet.
