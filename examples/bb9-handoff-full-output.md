# BB9 Handoff Full Output Example

This is a public-safe excerpt from:

```text
node scripts/generate_bb9_handoff.js --input examples/bb9-handoff-full-input.json --mode full --provider-profile mimo
```

## readableBrief

```md
# BaseBrief Full Handoff

## project_identity
BaseBrief public sample project

## current_goal
Prepare a complete phase handoff for improving onboarding docs.

## verified_facts
- The repository has one public skill entry under skills/basebrief/SKILL.md.
- The public modes are full, lite, and cache-ready.
- README and docs explain that cache-ready is experimental.

## confirmed_decisions
- Keep full and lite readable for normal project continuation.
- Use BB9 sidecar only as an estimated-cost experiment.

## assumptions
- The next agent can read repository files before editing.
- No release or tag is planned in this phase.

## open_questions
- Whether the sidecar will be merged into normal full/lite depends on later evidence.

## risk_boundaries
- Do not write API keys or private local paths.
- Do not claim cross-provider savings.
- Do not treat estimated cost as a billing audit.

## expected_output
Readable full handoff plus BB9 cache sidecar.

## tail_request
Generate the next-chat opener and keep the cache sidecar attached.
```

## cacheSidecar

```text
# BaseBrief BB9 Cache Sidecar
FORMAT: bb9-blockpad-lite-sidecar
RULE: Keep everything before TAIL_REQUEST stable across repeats; only TAIL_REQUEST may change.
PROFILE: mimo
SELECTED_VARIANT: bb7BlockPadLite
MODE: full

## Stable Project Snapshot
P=BaseBrief public sample project
G=Prepare a complete phase handoff for improving onboarding docs.
F=The repository has one public skill entry under skills/basebrief/SKILL.md. ; The public modes are full, lite, and cache-ready. ; README and docs explain that cache-ready is experimental.
D=Keep full and lite readable for normal project continuation. ; Use BB9 sidecar only as an estimated-cost experiment.
R=Do not write API keys or private local paths. ; Do not claim cross-provider savings. ; Do not treat estimated cost as a billing audit.
X=.env files ; API keys ; private local project paths
O=Readable full handoff plus BB9 cache sidecar.

<!-- BASEBRIEF_CACHE_BLOCK_PAD: p p p p ... p -->
--
TAIL_REQUEST=Generate the next-chat opener and keep the cache sidecar attached.
```

## selector

- selectedVariant: `bb7BlockPadLite`
- recommendedPromptType: `cacheSidecar`
- activeProviderPrompt: same as `cacheSidecar`
- providerProfile: `mimo`
- fallbackReason: `null`
- boundary: estimated-cost evidence only, not a billing audit.
- use policy: do not concatenate `readableBrief` and `cacheSidecar` into the same provider request.
