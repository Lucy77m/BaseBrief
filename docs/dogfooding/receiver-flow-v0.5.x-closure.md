# Receiver Flow v0.5.x Closure Dogfooding

Date: 2026-06-05

This public-safe record closes the `v0.5.x` receiver-flow review line. It records
the workflow shape, not private output.

## Workflow Shape

- `draft_shape`: `receiver-flow --guided` or `receiver-flow --extract --source <file>` writes `handoff_status: draft_needs_review`
- `candidate_shape`: extracted values use `[CANDIDATE]`; missing values use `[NEEDS_REVIEW]`
- `empty_shape`: empty guided answers use `[EMPTY]`
- `review_shape`: `review-draft` accepts only checked, marker-free drafts
- `ready_shape`: accepted output uses `handoff_status: ready_for_receiver`

## Public-Safe Case Summary

- `case_id`: `v0.5.x-review-closure`
- `project_class`: local BaseBrief maintenance checkout
- `runner_class`: local CLI Lite
- `provider_request_performed`: false
- `api_key_written`: false
- `raw_output_recorded`: false
- `private_absolute_path_recorded`: false
- `result`: valid-ready, rejected-candidate, and rejected-empty examples document the gate
- `next_fix_candidate`: introduce `.basebrief/` project state only after these gates stay stable

## Boundaries

- No provider request.
- No receiver thread creation.
- No Auto Flow.
- No `.basebrief/` project state directory in `v0.5.x`.
- No external runner raw output.
- No API key, token, secret, `.env` content, or private absolute path in this record.

