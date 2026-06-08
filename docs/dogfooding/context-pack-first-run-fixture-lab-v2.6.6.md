# Context Pack First-Run Fixture Lab v2.6.6

Date: 2026-06-09

This public-safe lab turns the v2.6.5 adoption scenario matrix into a
fixture-reading guide for first-run receivers. It explains which existing
example kit or dogfooding note to inspect when a user sees a clean pack,
warning pack, stale pack, broken pack, Doctor live-recheck reminder, or starter
handoff question.

It is local adoption evidence, not a release closeout, command line, contract,
schema, Status command, Workflow Runner, runtime integration, provider request,
MCP server, MCP tools, plugin, hosted memory behavior, or fixture-generation
contract.

## Lab Sources

- `examples/context-pack-lite/README.md` is the first-run example kit for the
  seven-file Context Pack shape, clean pack checks, warning checks, broken pack
  checks, and `Continuation rules:` starter wording.
- `examples/context-pack-doctor/README.md` is the Doctor example kit for
  `basebrief-doctor-v1`, stale pack warnings, broken pack failures, and
  live-recheck info findings.
- `docs/dogfooding/context-pack-adoption-scenario-matrix-v2.6.5.md` is the
  check/resume/doctor decision matrix.
- `docs/dogfooding/context-pack-check-acceptance-v2.1.0.md` is the check
  acceptance record for pack validity gates.
- `docs/dogfooding/context-pack-doctor-v2.5.1.md` is the public-safe Doctor
  dogfooding summary for stale and broken pack interpretation.

## Fixture Reading Lab

| Scenario | Existing lab source | Command to rehearse | Expected signal | Receiver reading |
| --- | --- | --- | --- | --- |
| clean pack | Context Pack Lite example kit | `check --input <context-pack-dir> --json` | `status=passed`, `errorCount=0`, `warningCount=0` | The pack is structurally reviewable; read the seven files, live-recheck repo facts, then follow the latest user instruction. |
| warning / too-thick | Context Pack Lite example kit and v2.6.5 matrix | `check --input <context-pack-dir> --json` | `status=passed` with `context-pack.too-thick` | The pack is still usable, but receivers should treat the warning as adoption friction and prefer docs/examples polish before new commands. |
| stale HEAD | Doctor example kit and v2.5.1 dogfooding | `doctor --repo <target-repo> --context-pack <context-pack-dir> --json` | `status=warning` with `doctor.pack-head-stale` | Inherited pack facts may be old; recheck current branch, HEAD, and worktree before acting. |
| branch mismatch | Doctor example kit and v2.5.1 dogfooding | `doctor --repo <target-repo> --context-pack <context-pack-dir> --json` | `status=warning` with `doctor.pack-branch-mismatch` | The pack may describe a different line of work; report the mismatch and decide whether to refresh the pack. |
| broken pack | Context Pack Check acceptance and Doctor example kit | `doctor --repo <target-repo> --context-pack <context-pack-dir> --json` | `status=failed` with `doctor.pack-check-error` | Do not use the pack as a handoff input until the underlying check errors are fixed. |
| doctor live-recheck info | Doctor example kit and v2.6.5 matrix | `doctor --repo <target-repo> --context-pack <context-pack-dir> --json` | `status=passed` with `doctor.live-recheck-required` | This is an info reminder, not a warning or failure; still recheck cwd, branch, HEAD, and worktree. |
| starter inherited-context handoff | Context Pack Lite example kit | `resume --input <context-pack-dir>` | Starter text includes `Continuation rules:` | Treat the pack as inherited context, not this window's task by itself, and use the latest user instruction as the real current goal. |

## Command Roles

- `check` answers whether a Context Pack directory is structurally reviewable.
- `resume` produces a copyable next-window prompt after the pack is clean or
  warning-only.
- `doctor` compares inherited pack facts with live repo facts and pack check
  results.
- Doctor is not an always-on Status command.

## Not Signals

- `context-pack.too-thick` is not a failed pack.
- `doctor.live-recheck-required` is not drift by itself.
- `doctor.pack-head-stale` and `doctor.pack-branch-mismatch` are not provider
  failures.
- `doctor.pack-check-error` is not a reason to change the
  `check --input <dir> --json` top-level shape.
- `Continuation rules:` is not permission to continue historical release slices
  or frozen lines without an explicit latest user instruction.

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

The local validation gate for this fixture-lab slice is:

```text
npm test
npm run release-check
git diff --check
```

When provider environment variables are absent, release checks must keep:

```text
provider_probe_status=skipped
```
