# Context Pack Adoption Scenario Matrix v2.6.5

Date: 2026-06-09

This public-safe matrix summarizes when a receiver should use `check`,
`resume`, or `doctor` during BaseBrief Context Pack continuation.

It is local adoption evidence, not a release closeout, command line, contract,
schema, Status command, Workflow Runner, runtime integration, provider request,
MCP server, MCP tools, plugin, or hosted memory behavior.

## Command Roles

- `check` is the pack validity gate. Use it to decide whether a Context Pack
  directory is structurally reviewable.
- `resume` is the copyable next-window prompt surface. Use it after a pack is
  clean or warning-only and the next receiver needs a starter prompt.
- `doctor` is the live repo comparison surface. Use it when the receiver needs
  to compare inherited pack facts with current branch, HEAD, worktree, and pack
  check results.
- Doctor is not an always-on Status command.

## Scenario Matrix

| Scenario | User symptom | Recommended command | Expected status/findings | Receiver decision | Not a signal |
| --- | --- | --- | --- | --- | --- |
| clean pack | The pack was just generated or refreshed and the receiver only needs to know if it is reviewable. | `check --input <context-pack-dir> --json` | `status: passed`, `errorCount: 0`, `warningCount: 0` | Continue after live repo recheck and latest user instruction review. | Not proof that inherited facts are current forever. |
| too-thick warning | The pack is valid but feels bulky or hard to scan. | `check --input <context-pack-dir> --json` | `status: passed` with `context-pack.too-thick` warning | Continue if the warning is understood; improve docs/examples before adding commands. | Not a failure and not a reason to open Status or Workflow Runner scope. |
| stale HEAD | The pack may describe an older commit than the live repo. | `doctor --repo <target-repo> --context-pack <context-pack-dir> --json` | warning findings such as `doctor.pack-head-stale` and `doctor.pack-branch-mismatch` | Treat inherited facts as stale until live repo facts are rechecked. | Not a provider problem, not a schema problem, and not a Doctor JSON contract change. |
| broken pack | The pack is missing required files or violates Context Pack Check rules. | `doctor --repo <target-repo> --context-pack <context-pack-dir> --json` | failed status with `doctor.pack-check-error` plus underlying check findings | Stop before resume prompt usage; repair or regenerate the pack. | Not a reason to change `check --input <dir> --json` top-level shape. |
| doctor live-recheck info | Doctor reports no stale or broken pack problem but reminds the receiver to verify live facts. | `doctor --repo <target-repo> --context-pack <context-pack-dir> --json` | passed status with `doctor.live-recheck-required` info | Proceed, but still recheck cwd, branch, HEAD, and worktree before implementation. | Not a warning or failure. |
| starter inherited-context handoff | A receiver opens `NEXT_WINDOW_STARTER.md` and needs to know whether the starter text is the true task. | `resume --input <context-pack-dir>` | copyable prompt containing `Continuation rules:` and latest-user-goal guidance | Treat the pack as inherited context, then follow the latest user instruction after live recheck. | Not permission to continue historical release slices or frozen lines. |

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
- No Context Pack Lite generator output contract change.
- No `check --input <dir> --json` top-level shape change.
- No Resume JSON contract change.
- No Doctor JSON contract change.
- No Export JSON contract change.
- No npm publish, push, tag, release, or pull request in this implementation
  slice.

## Validation Gate

The local validation gate for this scenario-matrix slice is:

```text
npm test
npm run release-check
git diff --check
```

When provider environment variables are absent, release checks must keep:

```text
provider_probe_status=skipped
```
