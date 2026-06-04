# Receiver-ready v1 Evidence Closure

Date: 2026-06-05

This record closes the current receiver-ready v1 evidence pass. It summarizes existing results without starting another receiver matrix. It is evidence about the tested workflows, not proof across all tools, models, repositories, or languages.

## Evidence Classes

Repository-controlled evidence:

- A four-case working-directory and reasoning-effort matrix.
- An eight-case response-language and reasoning-effort matrix.
- Local static tests, release checks, and Artifact Checker results.

User-provided external evidence:

- Fourteen receiver reports produced across several coding tools and model families.
- Seven review reports and several aggregate analyses.

The repository-controlled evidence can be rechecked from local artifacts and repository state. The external evidence was supplied by the user and cannot be independently reproduced or audited from this public repository.

## Repeated Findings

The existing evidence supports these scoped findings:

- Receivers can report whether their current working directory matches the target repository and can locate the target under the tested cross-directory conditions.
- Receivers can keep inherited source-window verification separate from facts reverified in the receiver window.
- An exact `expected_changed_files` manifest turns dirty-worktree scope review into a mechanical comparison.
- `receiver_task_status`, `repository_state_status`, and `handoff_acceptance` distinguish task completion from repository-state matching.
- `response_language: match_latest_user_message` routed the first agent-authored sentence, progress updates, and final report to the expected language in the tested cases.
- Receivers stayed read-only in the repository-controlled cases.

## Evidence Boundaries

- The four-case matrix controlled working-directory and reasoning-effort conditions; it did not prove behavior across model families.
- The eight-case language matrix used one Codex environment and does not prove behavior across all tools or languages.
- The fourteen external receiver reports are user-provided observations, not repository-reproducible tests.
- Receiver state verification is not the same as rerunning source-window behavioral tests.
- Exact changed-file paths do not prove file-content integrity.
- `generated_at` gives a receiver a time reference but does not automatically decide whether a handoff is stale.

## Resolved Friction

The current receiver-ready P0 addresses repeated ambiguity around:

- receiver entry work versus the project's post-acceptance next action
- inherited verification versus current-window verification
- exact dirty-worktree file scope
- acceptance status semantics
- response-language routing
- minimal handoff protocol metadata

## Deferred Friction

The following topics remain intentionally deferred:

- LF-to-CRLF warning noise and any repository-wide `.gitattributes` change
- file-content hashes or diff-integrity anchors
- receiver-side lightweight behavioral checks
- automatic stale-handoff policy
- merging the next-chat prompt with the readable brief

These topics require separate design decisions or stronger repeated evidence. They are not blockers for the current receiver-ready v1 human-readable protocol.

## Low-budget Validation Rule

Future documentation and static-contract changes should use local automated checks without creating receiver threads. If receiver behavior changes and static checks cannot validate it, run at most one low-reasoning smoke case and stop after it passes. Full matrices require explicit user approval.

See [Known Limitations](../known-limitations.md) and [Testing](../testing.md) for the maintained boundaries and validation budget.
