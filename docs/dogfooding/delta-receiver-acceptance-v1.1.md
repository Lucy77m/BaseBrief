# Delta Receiver Acceptance Dogfooding v1.1

This public-safe record defines the first v1.1 receiver acceptance exercise for
the BaseBrief Delta Handoff line.

It records expected receiver behavior only. It does not copy raw receiver
output, private absolute paths, provider details, secrets, `.env` content, API
keys, tokens, or credentials.

## Goal

Verify that a fresh receiver can read `delta-handoff.md`, compare it with live
repository state, and report whether the continuation is safe to accept before
starting the next implementation slice.

## Source Inputs

The receiver should inspect only:

- `.basebrief/out/v1.0-delta/delta-handoff.md`
- `docs/releases/v1.1.0-plan.md`
- `docs/releases/v1.0.1.md`
- `git status --short --branch`
- `git log --oneline -2`
- `git diff --name-status` only if live changed files need confirmation

The receiver should not rerun source-window test suites unless the current user
explicitly asks for validation. Source-window validation results should be
reported as inherited facts, not as receiver-window rechecks.

## Acceptance Checklist

The receiver response should include:

- `receiver_task_status`
- `repository_state_status`
- `handoff_acceptance`
- `blocking_or_repair_notes`
- current goal
- live repository state versus inherited handoff facts
- changed files and worktree state
- hard boundaries
- next narrow implementation slice

## Pass Criteria

```text
receiver_task_status: completed
repository_state_status: match
handoff_acceptance: pass
blocking_or_repair_notes: none
```

`repository_state_status` should be `difference_found` instead of `match` when
the live branch, HEAD, worktree state, or changed-file set conflicts with the
handoff facts.

## Interpretation

This v1.1 exercise extends v1.0 Delta Handoff from readable generated output to
receiver acceptance discipline. It keeps the work local-first and review-based:
the receiver proves understanding before implementation continues.

No new CLI command, schema, runtime, provider request, plugin, MCP, IDE, hosted
service, or Auto Flow behavior is introduced by this evidence record.

## Boundaries

- No provider request.
- No runtime integration.
- No plugin, MCP, IDE, hosted, or cloud-memory work.
- No schema-v2 work.
- No `basebrief-project-state-v2`.
- No `basebrief-sidecar-v2`.
- No push, tag, release, publish, pull request, npm publish, or global CLI
  install.
- No raw private output copied into public docs.
- No `.env`, API key, token, credential, or secret content copied into public
  docs.

`provider_probe_status=skipped`
