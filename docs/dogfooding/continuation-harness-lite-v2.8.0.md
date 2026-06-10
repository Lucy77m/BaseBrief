# Continuation Harness Lite Dogfooding v2.8.0

Date: 2026-06-10

Status: local self-dogfooding evidence

This dogfooding pass validates the v2.8 Continuation Harness Lite command on
the BaseBrief repository while the implementation worktree is intentionally
dirty. The generated continuation package stays under the ignored
`tests/outputs/private/` tree and is not copied into public docs.

## Command

```text
node scripts/basebrief.js continue --repo . --output-dir tests/outputs/private/v280-dogfooding/continue --json
node scripts/basebrief.js check --input tests/outputs/private/v280-dogfooding/continue --json
```

## Observed Result

- command_status: pass
- continuation_status: needs_review
- reason: local implementation worktree was dirty during dogfooding
- context_pack_step: generated
- check_step: passed
- resume_step: ready
- doctor_step: skipped
- export_step: skipped
- continuation_package_check_status: passed
- continuation_package_check_errors: 0
- continuation_package_check_warnings: 0
- json_prompt_leak_status: absent
- json_next_step_leak_status: absent
- copied_starter_private_path_status: absent
- report_private_path_status: absent
- metadata_private_path_status: absent

`needs_review` is the expected status for this dogfooding pass because the
worktree contains the v2.8 implementation and documentation changes being
validated. The inner Context Pack check still passed and the resume starter was
ready.

## Files Reviewed

- `CONTINUATION_REPORT.md`
- `CHECK_SUMMARY.md`
- `NEXT_WINDOW_STARTER.md`
- `continuation.meta.json`
- `context-pack/MANIFEST.md`
- `context-pack/RISK_BOUNDARIES.md`
- `context-pack/RECEIVER_STATE.md`

## Boundary Check

- No provider request.
- No raw private output.
- No runtime integration.
- No plugin.
- No MCP server.
- No MCP tools.
- No schema-v2.
- No Workflow Runner.
- No Doctor expansion.
- No Export expansion.
- No daemon.
- No watcher.
- No automatic project task implementation.
- No automatic commit, push, tag, release, pull request, npm publish, or global
  CLI install from the harness command.
- No Context Pack seven-file structure change.

## Validation Gate

The final v2.8 gate remains:

```text
node --test tests/continuation-harness.test.js
npm run release-check
npm test
git diff --check
```

Release-check metric lines expected after the v2.8 test split:

```text
mode_cases
checked_links
cli_lite_commands
independent_test_files=4
provider_probe_status=skipped
```

## Interpretation

This dogfooding pass proves that `continue` can assemble the local
`context-pack -> check -> resume` path into a reviewable continuation package
without leaking the copied prompt body into JSON and without exposing private
absolute paths in the reviewed top-level outputs.
