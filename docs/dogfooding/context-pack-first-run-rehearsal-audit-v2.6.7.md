# Context Pack First-Run Rehearsal Audit v2.6.7

Date: 2026-06-09

This public-safe audit records a real first-run rehearsal through the current
BaseBrief adoption path. It checks whether a new receiver can move from the
homepage and quickstart guidance into minimal examples, Context Pack generation,
pack check, resume prompt generation, and Doctor diagnostics without relying on
historical release notes.

It is local adoption evidence, not a release closeout, command line, contract,
schema, Status command, Workflow Runner, runtime integration, provider request,
MCP server, MCP tools, plugin, hosted memory behavior, or fixture-generation
contract.

## Rehearsal Path

The rehearsal followed this route:

```text
README.md
docs/quickstart-5min.md
examples/minimal/README.md
examples/context-pack-lite/README.md
examples/context-pack-doctor/README.md
context-pack -> check -> resume -> doctor
```

Generated artifacts were kept in ignored local output directories and were not
copied into this public record.

## Result Summary

```text
live_recheck_status: clean
build_status: passed
build_check_status: passed
build_error_count: 0
build_warning_count: 0
context_pack_status: generated
context_pack_worktree_status: clean
context_pack_check_status: passed
context_pack_check_error_count: 0
context_pack_check_warning_count: 0
resume_status: ready
resume_starter_contains: Continuation rules:
doctor_contract_version: basebrief-doctor-v1
doctor_status: passed
doctor_error_count: 0
doctor_warning_count: 0
doctor_info_findings: doctor.live-recheck-required
example_pack_check_status: passed
example_pack_doctor_status: warning
example_pack_doctor_warning_findings: doctor.pack-head-stale
example_pack_doctor_info_findings: doctor.live-recheck-required
provider_probe_status=skipped
```

## Step Notes

| Step | Observation | Receiver decision |
| --- | --- | --- |
| README route | The homepage points to the 2-minute command path, common commands, safety boundaries, and the 5-minute quickstart. | Clear enough for first-run entry. |
| 5-minute quickstart | The quickstart separates skill-first Lite handoff, CLI Lite build/check, Context Pack Check/Resume/Doctor, Seal/Diff, and Receiver Safe Check. | Clear enough; no new command is needed. |
| minimal example | The minimal example explains source-window input, Lite output, next-window prompt, and receiver first-response expectations. | Clear enough for users who want to read before running commands. |
| generated Context Pack | A live local pack generated on a clean worktree with seven reviewable artifacts. | Continue to `check` before using it as handoff input. |
| generated pack check | `check --input <context-pack-dir> --json` returned `status=passed`, no errors, and no warnings. | The generated pack is structurally reviewable. |
| generated resume prompt | `resume --input <context-pack-dir>` returned a copyable prompt with `Continuation rules:` and live-recheck instructions. | Treat the pack as inherited context, then follow the latest user instruction. |
| generated pack Doctor | `doctor --repo <target-repo> --context-pack <context-pack-dir> --json` returned `status=passed` with `doctor.live-recheck-required`. | This is an info reminder, not a warning or failure. |
| public example check | `examples/context-pack-lite` returned `check` passed with zero warnings. | The example kit remains a clean shape reference. |
| public example Doctor | Doctor on the public example returned warning with `doctor.pack-head-stale` and info with `doctor.live-recheck-required`. | The stale example remains useful for explaining inherited-pack drift. |

## Friction Log

| Severity | Observation | Current action |
| --- | --- | --- |
| blocking | None observed in this rehearsal. | No command, contract, or schema change. |
| confusing | On some Windows terminals, direct PowerShell reads of Chinese markdown can render incorrectly if the console encoding is not UTF-8. | Record as environment display friction only; do not rewrite docs or CLI behavior from this single observation. |
| confusing | Quickstart has several paths because BaseBrief now includes Lite handoff, Context Pack, Doctor, Seal/Diff, and Receiver Safe Check. | Keep using the first-run route and examples before opening any Status or Workflow Runner scope. |
| nice-to-have | The v2.6.x adoption evidence is useful but lives in the archive-style docs area. | Keep it linked from docs index, roadmap, testing, and release-check only. |

## Acceptance

- First-run route completed.
- Generated pack check completed with `status=passed`.
- Generated resume prompt included `Continuation rules:`.
- Generated Doctor completed with `doctor.live-recheck-required` info.
- Public example pack check completed with `status=passed`.
- Public example Doctor explained stale inherited metadata with
  `doctor.pack-head-stale`.
- No blocking adoption friction was found.

## Boundary Checks

- No provider request.
- No runtime integration.
- No hosted memory.
- No plugin.
- No MCP server.
- No MCP tools.
- No schema-v2.
- No Status command.
- No Workflow Runner.
- No new CLI command.
- No new public fixture files in this slice.
- No Context Pack seven-file structure change.
- No `check --input <dir> --json` top-level shape change.
- No Resume JSON contract change.
- No Doctor JSON contract change.
- No Export JSON contract change.
- No npm publish, push, tag, release, or pull request in this implementation
  slice.

## Validation Gate

The local validation gate for this rehearsal-audit slice is:

```text
npm test
npm run release-check
git diff --check
```

When provider environment variables are absent, release checks must keep:

```text
provider_probe_status=skipped
```
