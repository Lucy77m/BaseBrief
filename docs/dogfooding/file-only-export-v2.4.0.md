# File-only Export Dogfooding v2.4.0

Date: 2026-06-08

This public-safe record captures one local dogfooding pass for the v2.4
File-only Adapter / MCP-friendly Export line.

It records summarized acceptance evidence only. It does not copy raw generated
pack bodies, private absolute paths, provider details, secrets, `.env` content,
API keys, tokens, credentials, or raw private output.

## Goal

Verify that the four-file export bundle can support a receiver-style
continuation review while preserving the existing Context Pack Lite, Context
Pack Check, and Resume boundaries.

The dogfooding target is:

```text
node scripts/basebrief.js export --input <context-pack-dir> --output-dir <dir> [--json]
```

## Source Inputs

The source window generated a real current-repo Context Pack Lite bundle into
ignored private test output:

```text
node scripts/basebrief.js context-pack --repo . --output-dir tests/outputs/private/v2.4-file-export-dogfooding/context-pack --json
```

The local live recheck before generation found the BaseBrief public repo on
branch `main`, local commits ahead of `origin/main`, and the expected v2.4
working tree changes from the File-only Export implementation slice.

The generated Context Pack Lite source was checked before export:

```text
source_pack_check_status: pass
source_pack_error_count: 0
source_pack_warning_count: 0
```

## Acceptance Summary

```text
clean_export_status: pass
export_bundle_check_status: pass
receiver_style_acceptance: pass
public_safety_status: pass
provider_probe_status=skipped
```

The export bundle contained exactly:

```text
manifest.json
context-pack.md
context.json
adapter-notes.md
```

The export check returned `status: passed`, `errorCount: 0`, and
`warningCount: 0`.

## Receiver-style Review

Reviewing only the four exported files was enough to recover:

- project identity: BaseBrief-public
- source kind: Context Pack Lite
- contract version: `basebrief-file-export-v1`
- seven source files and their established reading order
- high-level repo facts, including branch, head, dirty worktree status, and
  changed-file count
- live repo fact recheck requirement before implementation
- warning/error distinction from Context Pack Check
- risk boundaries and forbidden scope
- MCP-friendly file-consumption boundary

The readable export preserves the `RISK_BOUNDARIES.md` section, and
`adapter-notes.md` repeats the no-provider, no-runtime, no-plugin, no MCP
server, no schema-v2, and no Workflow Runner boundaries.

## Observed Friction

- The four-file bundle is enough for a continuation review, but the receiver
  still needs to recheck live repo state because the export is a snapshot.
- `context.json` is intentionally high-level. It is useful for tool intake, but
  not a replacement for reading `context-pack.md`.
- The current dogfooding pass was clean. Warning-only export behavior remains
  covered by automated tests rather than this real-repo pass.

## Boundaries Confirmed

- No provider request.
- No runtime integration.
- No plugin.
- No MCP server.
- No IDE integration.
- No hosted service.
- No cloud-memory behavior.
- No schema-v2.
- No Workflow Runner.
- No Context Pack Lite generator output change.
- No `check --input <dir> --json` top-level shape change.
- No `resume --input <context-pack-dir>` behavior change.
- No push, tag, release, pull request, npm publish, or global CLI install.

## Local Validation Gate

The local validation gate for this dogfooding record is:

```text
node scripts/basebrief.js context-pack --repo . --output-dir tests/outputs/private/v2.4-file-export-dogfooding/context-pack --json
node scripts/basebrief.js export --input tests/outputs/private/v2.4-file-export-dogfooding/context-pack --output-dir tests/outputs/private/v2.4-file-export-dogfooding/export --json
node scripts/basebrief.js check --input tests/outputs/private/v2.4-file-export-dogfooding/export --json
node --test tests/basebrief.test.js --test-name-pattern "Export|v2.4|Dogfooding"
npm test
npm run release-check
git diff --check
```

When provider environment variables are absent, release checks must keep:

```text
provider_probe_status=skipped
```
