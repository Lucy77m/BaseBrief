# Delta Receiver Lint Dogfooding v1.8

Date: 2026-06-07

This document records a public-safe receiver lint dogfooding pass for the v1.6
fixture pack and v1.7 repair pack.

It is evidence only. It is not a push, tag, release, provider request, runtime
integration, plugin, MCP, IDE flow, Auto Flow behavior, command output format
change, JSON schema claim, schema-v2 claim, or checker rule change.

## Dogfooding Scope

Checked public-safe inputs:

- v1.6 clean fixture:
  `examples/receiver/lint/clean-pass-receiver-report.md`
- v1.6 intentional failure fixture:
  `examples/receiver/lint/delta-missing-section-receiver-report.md`
- v1.7 fixed Delta report:
  `examples/receiver/lint/repair/fixed-delta-receiver-report.md`
- v1.7 fixed starter report:
  `examples/receiver/lint/repair/fixed-starter-report.md`
- v1.7 fixed receiver result JSON:
  `examples/receiver/lint/repair/fixed-result.json`
- existing receiver examples:
  `examples/receiver/language-routing/receiver-report.md`,
  `examples/receiver/difference-found/receiver-check-result.json`, and
  `examples/receiver/usage-pack/starter-report-outline.md`

## Public-Safe Results

```text
receiver_lint_dogfooding_status: completed
provider_request_performed: false
runtime_integration_performed: false
checker_rule_changed: false
schema_changed: false
command_output_changed: false
raw_private_output_copied: false
```

Expected checker outcomes:

| Input family | Expected result |
| --- | --- |
| v1.6 clean fixture | passed with zero findings |
| v1.6 intentional error fixture | failed with `receiver.missing-report-section` |
| v1.6 intentional warning fixtures | passed with documented warning findings |
| v1.7 fixed Delta report | passed with zero findings |
| v1.7 fixed starter report | passed with zero findings |
| v1.7 fixed receiver result JSON | passed with zero findings |
| existing receiver examples | passed with zero findings |

## Observed Friction

- The fixture pack is good for learning rule names.
- The repair pack is needed because rule names alone do not tell authors which
  section or anchor to restore.
- Warning-only repairs need explicit wording so `difference_found` stays a
  completed verification result, not an agent failure.
- Historical `commits_in_range` drift needs the non-blocking condition stated
  near the drift mention: refreshed branch, HEAD, and worktree facts still
  match live repository state.

## Acceptance

```text
receiver_task_status: completed
repository_state_status: match
declared_checks_status: pass
handoff_acceptance: pass
blocking_or_repair_notes: none
```

This evidence supports closing the receiver lint usability line at fixtures,
repairs, and public-safe dogfooding. It does not justify new CLI commands,
schemas, command output changes, provider work, runtime work, plugins, MCP,
IDE work, hosted service, Auto Flow, or publication actions.

`provider_probe_status=skipped`
