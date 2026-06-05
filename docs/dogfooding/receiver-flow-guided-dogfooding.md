# Receiver Flow Guided Dogfooding

Date: 2026-06-05

This public-safe record captures first-use evidence for `receiver-flow --guided`.
It is not a raw transcript, not a provider request log, and not an external runner trace.

## Observation Shape

- `command_shape`: `receiver-flow --repo <target-repo> --output-dir <dir> --guided [--json]`
- `input_shape`: six human-provided lines for `current_goal`, `verified_facts`, `confirmed_decisions`, `risk_boundaries`, `receiver_entry_task`, and `open_questions`
- `output_shape`: `flow-summary.json`, `receiver-check.json`, and `draft-context.md`
- `status_shape`: `handoff_status: draft_needs_review`
- `review_shape`: `review_checklist` marks every human-provided field as needing review

## Public-Safe Case Summary

- `case_id`: `guided-self-smoke`
- `project_class`: local BaseBrief maintenance checkout
- `runner_class`: local CLI Lite
- `provider_request_performed`: false
- `api_key_written`: false
- `raw_output_recorded`: false
- `private_absolute_path_recorded`: false
- `result`: guided draft generated with human fields and review checklist
- `hardest_field`: `verified_facts`, because it should contain only checked facts, not intent or assumptions
- `next_fix_candidate`: add a later `review-draft` gate before introducing extracted candidates

## Boundaries

- No provider request.
- No receiver thread creation.
- No Auto Flow.
- No `ready_for_receiver` output.
- No external runner raw output.
- No API key, token, secret, `.env` content, or private absolute path in this record.

