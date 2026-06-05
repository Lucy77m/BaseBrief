# Receiver Flow Extract Dogfooding

Date: 2026-06-05

This public-safe record captures first-use evidence for `receiver-flow --extract`.
It is not a raw transcript, not a provider request log, and not an external
runner trace.

## Observation Shape

- `command_shape`: `receiver-flow --repo <target-repo> --output-dir <dir> --extract --source <draft-or-context.md> [--json]`
- `input_shape`: one explicit local Markdown source file
- `output_shape`: `flow-summary.json`, `receiver-check.json`, `draft-context.md`, and `extract-candidates.json`
- `status_shape`: `handoff_status: draft_needs_review`
- `candidate_shape`: extracted values are marked `[CANDIDATE]`; missing fields are marked `[NEEDS_REVIEW]`

## Public-Safe Case Summary

- `case_id`: `extract-self-smoke`
- `project_class`: local BaseBrief maintenance checkout
- `runner_class`: local CLI Lite
- `provider_request_performed`: false
- `api_key_written`: false
- `raw_output_recorded`: false
- `private_absolute_path_recorded`: false
- `result`: source Markdown sections were copied into candidate-only receiver fields
- `observed_friction`: candidates are intentionally blocked by `review-draft`
- `next_fix_candidate`: add a stabilization pass with examples for accepted and blocked extract review

## Boundaries

- No provider request.
- No automatic promotion to `ready_for_receiver`.
- No receiver thread creation.
- No Auto Flow.
- No `.basebrief/` project state directory.
- No external runner raw output.
- No API key, token, secret, `.env` content, or private absolute path in this record.

