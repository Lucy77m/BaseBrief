# Receiver Lint Repair Pack

This directory contains public-safe fixed references for the v1.5 receiver lint
rule families. It complements `examples/receiver/lint/`, which contains clean,
error, and warning fixtures.

It is repair guidance, not a new CLI command, JSON schema, command output
format, checker rule, runtime integration, provider request, plugin, MCP, IDE
flow, or Auto Flow.

Run the fixed examples explicitly:

```text
node scripts/basebrief.js check --input examples/receiver/lint/repair/fixed-delta-receiver-report.md --json
node scripts/basebrief.js check --input examples/receiver/lint/repair/fixed-starter-report.md --json
node scripts/basebrief.js check --input examples/receiver/lint/repair/fixed-result.json --json
```

## After Repair

The fixed files in this directory are compact references. After choosing the
smallest repair shape, return to `../README.md` for the rule family and
`../../usage-pack/README.md` for the final public receiver example:

- Delta `pass`: `../../delta-report-pass/README.md`
- Delta `difference_found`: `../../delta-report-difference-found/README.md`
- blocked receiver: `../../blocked/README.md`
- language routing: `../../language-routing/README.md`
- starter-facing continuity: `../../../golden-path/first-pass-receiver-report.md`
  or `../../../golden-path/follow-up-receiver-report.md`

## Rule Repairs

| Rule | Repair action | Fixed reference |
| --- | --- | --- |
| `receiver.missing-report-section` | Restore the missing required Delta or starter report section. | `fixed-delta-receiver-report.md` |
| `receiver.missing-human-anchor` | Preserve both `pass/fail` and `wait for user confirmation` in starter-facing reports. | `fixed-starter-report.md` |
| `receiver.missing-fact-layer` | Keep source-window inherited facts, live repo facts, and receiver-window rechecks separate. | `fixed-starter-report.md` |
| `receiver.invalid-result-consistency` | Align `receiver_task_status`, `repository_state_status`, and `handoff_acceptance`. | `fixed-result.json` |
| `receiver.missing-difference-semantics` | Explain that `difference_found` is a completed verification result, not an agent failure. | `fixed-delta-receiver-report.md` |
| `receiver.missing-drift-semantics` | Explain that historical `commits_in_range` drift is non-blocking when refreshed branch, HEAD, and worktree facts still match. | `fixed-starter-report.md` |

## Copy Rule

Copy from the fixed references, not from the intentionally broken fixtures.
When a checker finding appears, identify the rule ID, compare the nearest bad
fixture with the fixed reference, and repair the report shape without changing
machine field names or receiver outcome semantics.

`provider_probe_status=skipped`
