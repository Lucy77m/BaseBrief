# BaseBrief Handoff Contract

This document defines the current BB9 handoff contract. It is the bridge between human-readable BaseBrief outputs and provider-facing active prompts.

## Status

BB9 is the standard handoff-contract direction for BaseBrief.

It is not a claim that every provider will reduce real billing cost. It is provider-specific estimated-cost evidence and must remain benchmark-gated.

BB12 is a MiMo-specific selector candidate. It is not part of the default BB9 contract and must not be described as cross-provider proof.

## Standard Artifacts

`readableBrief`

- Human-readable `full` or `lite` continuation.
- Primary surface for review, project state, decisions, risks, and open questions.
- Must remain useful without provider-only fields.

`cacheSidecar`

- Compact provider-oriented sidecar.
- Present only when the provider profile exposes cache usage evidence.
- Must not be concatenated with `readableBrief` in one provider request unless a future benchmark explicitly proves that shape.

`activeProviderPrompt`

- Exact text to send to the provider.
- Equals `cacheSidecar` for supported cache-observable profiles.
- Equals `readableBrief` for relay, unknown, or unsupported profiles.

`handoff.meta.json`

- Machine-readable metadata for selected strategy, provider profile, fallback reason, prompt-use policy, and evidence boundary.
- Must not contain API keys, bearer tokens, private paths, or `.env` contents.

## Input Contract

The schema source is:

```text
schemas/bb9-handoff.schema.json
```

Required input fields:

- `project_identity`
- `current_goal`
- `verified_facts`
- `confirmed_decisions`
- `risk_boundaries`
- `expected_output`
- `tail_request`

Optional input fields:

- `mode`
- `provider_profile`
- `assumptions`
- `open_questions`
- `forbidden_scope`
- `audience`

`mode` must be `full` or `lite`. Normal BaseBrief usage should choose one of these first, then run handoff post-processing only when provider-side repetition is needed.

## Structured Markdown Block

Full and Lite can optionally carry schema-backed handoff input at the end of the readable brief.

Only use this block when the user explicitly asks for a handoff builder flow or provider active prompt. It is not part of the ordinary visible brief.

The exact markers are:

````text
<!-- BASEBRIEF_HANDOFF_JSON_BEGIN -->
```json
{ ...bb9 handoff schema input... }
```
<!-- BASEBRIEF_HANDOFF_JSON_END -->
````

Builder behavior:

- `.json` input is read directly as BB9 handoff input.
- Markdown input is accepted only when the marked fenced JSON block exists.
- Free-form Markdown is not parsed.
- Invalid JSON or missing schema-required fields must fail before artifacts are written.

Examples:

```text
examples/structured-handoff-full.md
examples/structured-handoff-lite.md
```

## Minimal Builder

Builder command:

```text
node scripts/basebrief_build_handoff.js --input examples/structured-handoff-full.md --output-dir tests/outputs/private/structured-full --provider-profile mimo
```

Output files:

- `readableBrief.md`
- `activeProviderPrompt.md`
- `handoff.meta.json`
- `cacheSidecar.md` only when the selected provider profile supports sidecar output

`handoff.meta.json` contains only metadata: selected variant, recommended prompt type, provider profile projection, fallback reason, prompt-use policy, warnings, and artifact names. It must not copy full prompt text.

## Provider Profile Rules

Provider profiles expose strategy metadata:

- `defaultPromptStrategy`: the default contract-level strategy, such as `bb9_sidecar` or `readable_fallback`.
- `activePromptStrategy`: the artifact used as the active provider prompt, such as `cacheSidecar` or `readableBrief`.
- `fallbackStrategy`: the explicit fallback behavior when cache usage or provider support is missing.
- `evidenceScope`: the provider, model, sample, and evidence boundary for the current strategy.
- `experimentalCandidates`: non-default candidate strategies recorded for audit and future testing.

MiMo and DeepSeek:

- BB9 sidecar can be selected because cache usage is observable in the current profile data.
- The evidence wording must stay provider-specific and estimated-cost only.

Relay and unknown providers:

- Use readable fallback.
- Do not create provider-cache conclusions when cached-token or cache-cost fields are not observable.

BB12:

- Record as MiMo-specific selector-candidate evidence.
- Keep it in MiMo `experimentalCandidates` metadata only.
- Do not make it the default BB9 contract or builder strategy.
- Do not generalize it to DeepSeek, relay, or unknown providers.

## Safety Rules

- Do not write API keys, bearer tokens, secrets, or `.env` contents to any handoff artifact.
- Do not publish private absolute paths.
- Do not turn assumptions into verified facts.
- Do not hide open questions as decisions.
- Do not describe estimated cost as a billing audit.
- Do not describe MiMo evidence as provider-general evidence.

## Current Implementation

Current implementation source:

```text
scripts/generate_bb9_handoff.js
scripts/basebrief_build_handoff.js
```

Example inputs and outputs:

```text
examples/bb9-handoff-full-input.json
examples/bb9-handoff-full-output.md
examples/bb9-handoff-lite-input.json
examples/bb9-handoff-lite-output.md
examples/bb9-handoff-fallback-output.md
examples/structured-handoff-full.md
examples/structured-handoff-lite.md
```
