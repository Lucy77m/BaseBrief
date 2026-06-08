# Context Pack Adoption Notes v2.6.1

Date: 2026-06-09

This public-safe record captures the first local adoption-notes pass after the
v2.6.0 First-Run / Adoption Polish release.

It is not a new minor-version line, contract, command, schema, or release
closeout. It records what a real first-run path exposed so later patches can
fix repeated adoption friction without expanding BaseBrief into Status,
Workflow Runner, runtime, or provider work.

## Goal

Dogfood the current public first-run route from homepage-level guidance through
the existing local CLI surfaces:

```text
README -> docs/quickstart-5min.md -> examples/minimal/README.md
context-pack -> check -> resume -> doctor
```

The purpose is to sort observed friction into:

- `blocking`: prevents a new user or receiver from completing the path.
- `confusing`: path completes, but wording or ordering can steer a receiver
  toward the wrong interpretation.
- `nice-to-have`: polish that may help, but should not drive a contract or
  command change.

Only `blocking` and repeated `confusing` items should become implementation
work. Single `nice-to-have` items stay as notes.

## Public-Safe Smoke Summary

The local smoke used ignored output under `tests/outputs/private/` and did not
copy raw generated pack bodies into this public record.

```text
build_status: passed
build_error_count: 0
build_warning_count: 0
context_pack_status: generated
context_pack_worktree_status: clean
context_pack_check_status: passed
context_pack_check_error_count: 0
context_pack_check_warning_count: 0
resume_status: ready
doctor_contract_version: basebrief-doctor-v1
doctor_status: passed
doctor_error_count: 0
doctor_warning_count: 0
doctor_info_findings: doctor.live-recheck-required
provider_probe_status=skipped
```

## Observed Friction

| Severity | Observation | Current action |
| --- | --- | --- |
| blocking | None observed in the first local smoke. | No command or contract change. |
| confusing | The generated `NEXT_WINDOW_STARTER.md` still contains an old default task phrase: `Continue only the user-approved v2.0 Context Pack Lite implementation slice.` | Record as adoption feedback. Do not treat inherited starter text as the true next-window goal. |
| confusing | New users may still need to learn when `check` is enough and when `doctor` is worth running. | Keep using the v2.6 example kits and Check vs Doctor guidance before adding any status surface. |
| nice-to-have | The README-to-quickstart route is short enough, but adoption evidence now lives in the archive-style docs area. | Link this record from the docs index and testing summary only. |

repair_candidate: v2.6.2 starter wording repair

## Local Repair Closeout

`v2.6.2 starter wording repair` is now landed locally as an adoption wording
fix. Generated and public example `NEXT_WINDOW_STARTER.md` content now uses
`Continuation rules:` and tells receivers to treat the pack as inherited
context, then use the latest user instruction as the real current goal.

This repair did not add a command, change the Context Pack seven-file
structure, change `check --input <dir> --json`, or change Resume, Doctor, or
Export JSON contracts.

## Fix Policy

For this slice, the default fix policy is:

- Fix only high-frequency docs/examples friction.
- Prefer shorter labels, expected outputs, and example links over new command
  behavior.
- Keep `context-pack.too-thick`, `doctor.pack-head-stale`, and
  `doctor.pack-check-error` as example-driven interpretation rules.
- Keep `doctor.live-recheck-required` as an info finding, not a failure.
- Do not turn Doctor into an always-on Status command.
- Do not infer live repo truth from inherited source-window context.

## Boundaries Confirmed

- No provider request.
- No runtime integration.
- No plugin.
- No MCP server.
- No MCP tools.
- No IDE integration.
- No hosted service.
- No cloud-memory behavior.
- No schema-v2.
- No Workflow Runner.
- No daemon.
- No watcher.
- No Status command.
- No Context Pack Lite generator output contract change.
- No `check --input <dir> --json` top-level shape change.
- No Doctor JSON contract change.
- No npm publish, push, tag, release, or pull request in this implementation
  slice.

## Validation Gate

The local validation gate for post-v2.6 adoption notes remains:

```text
npm test
npm run release-check
git diff --check
```

When provider environment variables are absent, release checks must keep:

```text
provider_probe_status=skipped
```
