# Context Pack Human Next-Step Hints Dogfooding v2.7.1

Date: 2026-06-10

This public-safe record captures a v2.7.1 dogfooding and reality-check pass for
the Context Pack human next-step hints added in v2.7.0.

It records summarized evidence only. It does not copy raw generated pack
bodies, private absolute paths, provider details, secrets, `.env` content, API
keys, tokens, credentials, or raw private output.

## Goal

Verify that the human-only `next_step=` and `optional_next_step=` hints are
useful and not misleading across the existing Context Pack workflow:

```text
context-pack -> check -> resume
context-pack -> check -> doctor
export -> check
warning-only pack
broken pack
```

This pass keeps v2.7.1 as dogfooding plus one small wording repair. It does not
add a new command or change JSON contracts.

## Source Inputs

The source window generated a current-repo Context Pack Lite bundle into
ignored private test output and reviewed only summarized command results:

```text
node scripts/basebrief.js context-pack --repo . --output-dir tests/outputs/private/v271-dogfooding/pack
node scripts/basebrief.js check --input tests/outputs/private/v271-dogfooding/pack
node scripts/basebrief.js resume --input tests/outputs/private/v271-dogfooding/pack
node scripts/basebrief.js doctor --repo . --context-pack tests/outputs/private/v271-dogfooding/pack
node scripts/basebrief.js export --input tests/outputs/private/v271-dogfooding/pack --output-dir tests/outputs/private/v271-dogfooding/export
node scripts/basebrief.js check --input tests/outputs/private/v271-dogfooding/export
```

The warning-only and broken-pack paths remain covered by focused automated
tests using controlled private fixtures.

## Acceptance Summary

```text
context_pack_hint_status: pass
clean_context_pack_check_hint_status: pass
resume_prompt_status: ready
doctor_clean_hint_status: pass
export_hint_status: pass
export_check_hint_status: repaired
warning_only_check_hint_status: pass
broken_pack_check_hint_status: pass
json_hint_leak_status: absent
provider_probe_status=skipped
```

Clean Context Pack checks correctly point to:

```text
next_step=node scripts/basebrief.js resume --input <context-pack-dir>
optional_next_step=node scripts/basebrief.js doctor --repo <target-repo> --context-pack <context-pack-dir>
```

`context-pack` and `export` success output correctly point to a local `check`
of the generated output directory.

## Observed Friction

The reality check found one concrete misleading hint:

```text
export -> check
```

Before v2.7.1, a clean check of a four-file File-only Export directory reused
the generic Context Pack hint and suggested `resume --input <export-dir>` and
`doctor --repo <target-repo> --context-pack <export-dir>`. That was misleading
because a file-only export directory is not a seven-file Context Pack Lite
directory.

## Repair

v2.7.1 narrows human `check` hints by checked input kind:

- seven-file Context Pack Lite directory: keep `resume` and optional `doctor`
  guidance
- four-file File-only Export directory: suggest reviewing the checked export
  files before sharing or tool intake
- generic checked file or directory: suggest reviewing check results before
  sharing

The detection is used only by the human formatter. The hidden input-kind helper
is not serialized into `--json` output.

## Boundaries Confirmed

- No new CLI command.
- No package script change.
- No release-check output shape change.
- No Context Pack seven-file structure change.
- No Context Pack Lite generator output change.
- No `check --input <dir> --json` top-level shape change.
- No Resume JSON contract change.
- No Doctor JSON contract change.
- No Export JSON contract change.
- No Status command.
- No Workflow Runner.
- No Doctor expansion.
- No Continuation Harness Lite implementation.
- No provider request.
- No runtime integration.
- No MCP server.
- No MCP tools.
- No plugin.
- No schema-v2.
- No daemon.
- No watcher.
- No hosted memory.
- No push, tag, release, pull request, npm publish, or global CLI install.

## Local Validation Gate

The local validation gate for this dogfooding record is:

```text
node --test tests/context-pack.test.js --test-name-pattern "Context Pack|Export|Doctor"
npm run release-check
npm test
git diff --check
```

When provider environment variables are absent, release checks must keep:

```text
provider_probe_status=skipped
```

`npm run release-check` should continue to print existing metric lines such as
`mode_cases`, `checked_links`, `cli_lite_commands`, and
`independent_test_files`.
