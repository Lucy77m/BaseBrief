# Receiver Lint Fixture Pack

This directory contains public-safe fixtures for the v1.5 receiver lint rules.
It is a learning and copy/reference pack, not a new CLI command, schema,
runtime integration, provider request, plugin, MCP, IDE flow, or Auto Flow.

Run any fixture explicitly:

```text
node scripts/basebrief.js check --input examples/receiver/lint/clean-pass-receiver-report.md --json
```

The intentionally broken fixtures are supposed to report findings. They are
examples of what the checker catches, not examples to copy into a handoff.

## Fixtures

| Fixture | Expected status | Primary rule |
| --- | --- | --- |
| `clean-pass-receiver-report.md` | passed, 0 warnings | none |
| `delta-missing-section-receiver-report.md` | failed | `receiver.missing-report-section` |
| `starter-missing-pass-fail-starter-report.md` | failed | `receiver.missing-human-anchor` |
| `starter-missing-wait-starter-report.md` | failed | `receiver.missing-human-anchor` |
| `starter-missing-fact-layer-starter-report.md` | failed | `receiver.missing-fact-layer` |
| `json-invalid-result-consistency.json` | failed | `receiver.invalid-result-consistency` |
| `difference-found-warning-receiver-report.md` | passed, 1 warning | `receiver.missing-difference-semantics` |
| `historical-drift-warning-starter-report.md` | passed, 1 warning | `receiver.missing-drift-semantics` |

## How To Use

- Start from the clean fixture when writing a new receiver report.
- Compare a failing fixture with the clean fixture when a rule name is unclear.
- Keep source-window inherited facts, live repo facts, and receiver-window
  rechecks separate.
- Treat `difference_found` as a completed verification result, not an agent
  failure.
- Treat historical `commits_in_range` drift as non-blocking when refreshed
  branch, HEAD, and worktree facts still match live repository state.

`provider_probe_status=skipped`
