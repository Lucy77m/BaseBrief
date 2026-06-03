# GPT-5.5 Relay Usage Audit

This document defines the third-path relay test boundary for BaseBrief cache experiments.

## Route Identity

- provider id: `relay-openai-gpt55-codex-oauth`
- route type: `third_party_relay`
- model: `gpt-5.5`
- evidence level: `relay_specific_observation`
- pricing basis: `openai_official_reference_price`
- billing audited: `false`

This route must not be described as OpenAI official API evidence. It is only an observation of a third-party relay path that claims an upstream GPT-5.5 model.

## Usage Audit First

Before any benchmark, run:

```bash
node scripts/provider_relay_usage_audit.js --output tests/outputs/private/provider-relay-usage-audit.raw.json --summary-output tests/outputs/provider-relay-usage-audit.latest.json
```

The audit sends synthetic prompts only. It checks whether `/chat/completions` returns enough usage data for cache-aware cost comparison:

- `prompt_tokens` or `input_tokens`
- `completion_tokens` or `output_tokens`
- `cached_tokens` through a direct or nested usage field
- whether repeated identical prompts change provider-visible input token accounting

If no cache field is visible and repeated identical prompts do not change input token accounting, the relay result is only `token_length_observation_only`. In that case, do not run a cache-cost benchmark.

## Stop Conditions

Stop before benchmark if:

- `/chat/completions` has 5 consecutive failures
- valid request rate is below `90%`
- usage fields are missing or inconsistent
- cache cost cannot be observed from returned usage fields
- 429 or 5xx errors are frequent
- output summary cannot be kept redacted

## Evidence Levels

| Level | Meaning |
|---|---|
| `cache_tokens_visible` | Relay returns cached token data; cache-aware estimated cost can be computed. |
| `input_tokens_may_reflect_billing_or_relay_accounting` | No cache field, but repeated identical prompts change input token accounting; benchmark may be exploratory only. |
| `token_length_observation_only` | Usage exists, but cache cost is not observable; do not claim cache savings. |
| `usage_unusable` | Required usage fields are missing or inconsistent. |

## Pricing Boundary

OpenAI GPT-5.5 official reference pricing may be used only as reference pricing. This does not audit relay billing and does not prove OpenAI official API billing behavior.

## Latest Audit Result

Route: `https://sanye.mom/v1`, model `gpt-5.5`, provider profile `relay-openai-gpt55-codex-oauth`.

- request count: `6`
- valid request count: `6`
- usage visible: `6/6`
- cache field visible: `0/6`
- repeated identical prompt token values: `[70]`
- usage interpretation: `token_length_observation_only`
- benchmark recommended: `false`
- stop reason: `cache_cost_not_observable`

Interpretation: this relay returned ordinary usage token counts but did not expose cached token data, and repeated identical prompts did not show any provider-visible input-token accounting change. Under the BaseBrief evidence rules, this route must not be used for cache-aware cost benchmark claims. It can only be recorded as a relay-specific token-length observation unless the relay later exposes cache usage or billing-adjusted input token accounting.
