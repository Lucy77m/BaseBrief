# Delta Receiver Report Kit Dogfooding v1.2

This public-safe record defines the first v1.2 Delta Receiver Report Kit
exercise for the BaseBrief Delta Handoff line.

It records expected receiver behavior and public-safe local facts only. It does
not copy raw receiver output, private absolute paths, provider details, secrets,
`.env` content, API keys, tokens, or credentials.

## Goal

Make the receiver acceptance response easy to repeat. A receiver should be able
to read `delta-handoff.md`, compare inherited handoff facts with live repository
state, and produce a standard report before implementation resumes.

## Report Contract

A Delta Receiver report should include these fields exactly:

- `receiver_task_status`
- `repository_state_status`
- `handoff_acceptance`
- `blocking_or_repair_notes`
- `current_goal`
- `live_repo_state`
- `inherited_fact_differences`
- `hard_boundaries`
- `next_narrow_slice`

The report should explicitly separate:

- source-window inherited facts
- receiver-window rechecks
- live repository facts
- blocking differences versus non-blocking differences

## Public-Safe Examples

The kit includes two public-safe examples:

- `examples/receiver/delta-report-pass/README.md`
- `examples/receiver/delta-report-difference-found/README.md`

The `pass` example shows a refreshed ignored local `delta-handoff.md` whose
branch, HEAD, and worktree facts match live repository state.

The `difference_found` example shows a stale inherited handoff whose HEAD or
worktree facts no longer match live repository state. This is a completed
receiver outcome, not an agent failure.

## Historical Count Drift

Historical dry-run or pre-commit `commits_in_range` values may stay in public
evidence as facts from the time they were recorded. A later receiver should not
treat an explainable historical count drift as blocking when the refreshed
`delta-handoff.md` branch, HEAD, and worktree facts match live repository state.

## Acceptance Semantics

```text
handoff_acceptance: pass
```

Use `pass` when the entry verification completed and live branch, HEAD, and
worktree facts match refreshed handoff facts.

```text
handoff_acceptance: difference_found
```

Use `difference_found` when the entry verification completed and accurately
reported a live-state difference. It is not an agent failure.

```text
handoff_acceptance: blocked
```

Use `blocked` only when the receiver cannot safely complete necessary
verification.

## Boundaries

- No provider request.
- No runtime integration.
- No plugin, MCP, IDE, hosted, or cloud-memory work.
- No schema-v2 work.
- No `basebrief-project-state-v2`.
- No `basebrief-sidecar-v2`.
- No new CLI command.
- No new npm script.
- No machine-readable JSON schema for receiver reports.
- No command output format change.
- No Auto Flow.
- No push, tag, release, publish, pull request, npm publish, or global CLI
  install.
- No raw private output copied into public docs.
- No `.env`, API key, token, credential, or secret content copied into public
  docs.

`provider_probe_status=skipped`
