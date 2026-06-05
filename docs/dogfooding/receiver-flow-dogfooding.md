# Receiver Flow Dogfooding Evidence

Date: 2026-06-05

This record captures public-safe evidence from using `receiver-flow` as a draft helper after v0.3.2. It is not a raw transcript, not an external agent trace, not private output, and not proof that Auto Flow exists.

## Record Shape

Use this shape for receiver-flow observations:

```text
receiver_flow_dogfooding:
- command_shape:
- output_shape:
- review_checkpoints:
- observed_friction:
- next_fix_candidate:
```

Keep each value short and public-safe. Do not include private absolute paths, credentials, raw ignored outputs, provider request data, or external tool internals.

## Current Observations

- `command_shape`: `receiver-flow --repo <target-repo> --output-dir <dir> [--json]` is explicit enough for local drafting.
- `output_shape`: `flow-summary.json`, `receiver-check.json`, and `draft-context.md` are easier to review than a single mixed handoff file.
- `review_checkpoints`: reviewers need to confirm branch, HEAD, changed files, generated output visibility, and whether optional declared checks should be added.
- `observed_friction`: the draft is intentionally not final, so docs and examples must repeat `handoff_status: draft_needs_review`.
- `next_fix_candidate`: improve examples and release checks before adding any workflow automation.

## Evidence Boundaries

- No provider request.
- No receiver thread creation.
- No Auto Flow.
- No final handoff generation.
- No automatic promotion to `ready_for_receiver`.
- No new CLI command.
- No schema change.

## Deferred Work

- converting a reviewed draft into a final receiver-ready handoff
- automatic receiver thread creation
- stale handoff policy based on `generated_at`
- file-content integrity beyond changed-file paths
- external receiver matrices across tools or model families
