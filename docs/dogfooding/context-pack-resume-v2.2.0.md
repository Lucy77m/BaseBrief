# Context Pack Resume Dogfooding v2.2.0

Date: 2026-06-08

This document records public-safe local dogfooding for BaseBrief v2.2
One-command Resume / New-window Prompt.

It is not a provider request, runtime integration, plugin, MCP, IDE
integration, hosted service, cloud-memory feature, schema-v2 change, Workflow
Runner, release, tag, push, pull request, npm publish, or global CLI install.

## Scope

The dogfooding target is:

```text
node scripts/basebrief.js resume --input <context-pack-dir> [--json]
```

The command reuses the existing Context Pack Check behavior and prints a
copyable new-window prompt. It does not change Context Pack Lite generator
output and does not change the `check --input <dir> --json` top-level shape.

## Acceptance Summary

clean_resume_status: pass
warning_only_resume_status: pass
error_resume_status: pass
public_safety_status: pass
provider_probe_status: skipped

## Evidence Classes

### Clean Pack

Input shape: complete public-safe Context Pack Lite directory.

Expected behavior:

- `resume` returns `status: ready`
- checker result has zero errors
- prompt includes Context Pack reading order
- prompt requires live repo fact recheck before implementation
- prompt preserves risk boundaries

Observed status: pass

### Warning-only Pack

Input shape: complete Context Pack Lite directory with conservative thickness
warning.

Expected behavior:

- `resume` returns `status: ready`
- checker result has zero errors and one or more warnings
- prompt includes the warning finding as a review note
- prompt is still copyable

Observed status: pass

### Errored Pack

Input shape: Context Pack Lite directory with checker error findings.

Expected behavior:

- `resume` stops before prompt output
- the error summary points back to Context Pack Check failure
- no continuation prompt is printed for an unsafe or incomplete pack

Observed status: pass

## Boundaries Confirmed

- No provider request.
- No runtime integration.
- No plugin, MCP, IDE, hosted service, or cloud-memory behavior.
- No schema-v2, `basebrief-project-state-v2`, or `basebrief-sidecar-v2`.
- No Workflow Runner.
- No Context Pack Lite generator output change.
- No `check --input <dir> --json` top-level shape change.
- No `new-window` alias.
- No output file path.
- No raw private output.
- No private absolute paths.
- No `.env`, secrets, tokens, credentials, API keys, or bearer strings.

## Local Validation Gate

The local validation gate for this dogfooding record is:

```text
node scripts/basebrief.js resume --input examples/context-pack-lite --json
node scripts/basebrief.js check --input examples/context-pack-lite --json
npm test
npm run release-check
git diff --check
```

When provider environment variables are absent, release checks must keep:

```text
provider_probe_status=skipped
```

