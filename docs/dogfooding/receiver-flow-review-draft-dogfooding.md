# Receiver Flow Review Draft Dogfooding

Date: 2026-06-05

This public-safe record captures first-use evidence for the `review-draft` gate.
It is not a raw transcript, not a provider request log, and not an external
runner trace.

## Observation Shape

- `command_shape`: `review-draft --draft <draft-context.md> --output <receiver-ready.md> [--json]`
- `input_shape`: reviewed guided draft with six human fields and checked review checklist entries
- `blocked_marker_shape`: `[EMPTY]`, `[NEEDS_REVIEW]`, and `[CANDIDATE]` are rejected
- `output_shape`: one explicit Markdown file with `handoff_status: ready_for_receiver`
- `review_gate_shape`: checklist text is the explicit human confirmation mechanism

## Public-Safe Case Summary

- `case_id`: `review-draft-self-smoke`
- `project_class`: local BaseBrief maintenance checkout
- `runner_class`: local CLI Lite
- `provider_request_performed`: false
- `api_key_written`: false
- `raw_output_recorded`: false
- `private_absolute_path_recorded`: false
- `result`: reviewed guided draft converted to receiver-ready Markdown
- `observed_friction`: unchecked checklist state is easy to miss during manual review
- `next_fix_candidate`: add `review-draft` diagnostics that name only missing field ids and marker classes

## Boundaries

- No provider request.
- No receiver-flow --extract.
- No receiver thread creation.
- No Auto Flow.
- No `.basebrief/` project state directory.
- No external runner raw output.
- No API key, token, secret, `.env` content, or private absolute path in this record.

