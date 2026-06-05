# BaseBrief Receiver Flow Draft

handoff_status: draft_needs_review
generated_at: 2026-06-05T00:00:00.000Z
review_required: true

This draft is not receiver-ready. Review before sharing.

## Repository State

expected_branch: main
expected_head: 2222222222222222222222222222222222222222

## current_changed_files

- docs/safe.md
- new.txt

## expected_changed_files

- docs/safe.md
- new.txt

## receiver_check_config

receiver-check.json

## receiver_entry_task_draft

- Confirm the current working directory and target repository relationship.
- Recheck branch, HEAD, and changed files before implementation work.
- Run `receiver-check` only after this draft and config are reviewed.
- Report `receiver_task_status`, `repository_state_status`, `declared_checks_status`, and `handoff_acceptance`.

## Non-Goals

- No provider request.
- No receiver thread creation.
- No final handoff generation.
- No automatic promotion to `ready_for_receiver`.
