# Receiver Friction Log

Date: 2026-06-05

This log records public-safe receiver workflow friction for BaseBrief v0.3.1. It is not a raw transcript, not a private output archive, and not cross-tool proof. Its purpose is to keep repeated receiver issues visible without exposing private paths, credentials, tool traces, or provider-specific request data.

## Log Shape

Each receiver observation should keep to this shape:

```text
actual_handoff_friction:
- cwd_match:
- receiver_check_result:
- changed_files_match:
- source_vs_receiver_verification_clear:
- language_match:
- scope_drift:
- overreach_or_unwanted_automation:
- notes:

automation_decision:
- should_become_automated_test: yes / no / unsure
- test_case_id_if_added:
- resolved_in_commit:
- resolved_in_version:
- still_open: yes / no
```

Use short status words such as `yes`, `no`, `partial`, `not_applicable`, `pass`, `difference_found`, or `blocked`. Put details in `notes` only when they are public-safe and useful for improving the workflow.

## Current Findings

- `cwd_match`: receivers can report whether the current working directory is the target repository before doing project work.
- `receiver_check_result`: `receiver-check` gives a stable machine result for `pass`, `difference_found`, and `blocked`.
- `changed_files_match`: an exact `expected_changed_files` list turns dirty-worktree review into a mechanical comparison.
- `source_vs_receiver_verification_clear`: receiver reports are clearer when inherited source-window facts are separated from current-window rechecks.
- `language_match`: `response_language: match_latest_user_message` works best when code, paths, commands, and field names are explicitly excluded from language detection.
- `scope_drift`: receivers should stop after acceptance unless the user explicitly asks for implementation work.
- `overreach_or_unwanted_automation`: automation should be recorded as friction when it confirms, edits, or publishes beyond the reviewed handoff.
- `automation_decision`: a `yes` recommendation is not the same as an added automated test; keep test IDs and resolution fields explicit.

## Stabilization Decisions

- Keep `difference_found` as a completed receiver task, not an agent failure.
- Keep `blocked` for invalid config, unsafe paths, missing target repositories, or checks that cannot run safely.
- Keep private receiver artifacts under ignored local output directories.
- Do not add raw commands, provider requests, file-content hashes, or automatic stale-handoff policy in v0.3.1.
- Use local automated checks for documentation and examples; run at most one low-reasoning receiver smoke only when behavior changes and static checks cannot validate it.

## Deferred Friction

- file-content integrity beyond changed-file paths
- stale handoff policy based on `generated_at`
- merging readable brief and next-chat prompt
- broad receiver matrices across tools or model families
- automatic workflow generation beyond `receiver-init` and reviewed `receiver-check`
