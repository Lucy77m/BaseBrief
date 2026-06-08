# Context Pack Doctor Dogfooding v2.5.0

Date: 2026-06-08

This public-safe record captures one local dogfooding pass for the v2.5
Context Pack Doctor line.

It records summarized acceptance evidence only. It does not copy raw generated
pack bodies, private absolute paths, provider details, secrets, `.env` content,
API keys, tokens, credentials, or raw private output.

## Goal

Verify that the read-only doctor command can inspect a live repository against
an explicit Context Pack Lite directory and produce receiver-friendly findings
without writing files or expanding scope.

The dogfooding target is:

```text
node scripts/basebrief.js doctor --repo <target-repo> --context-pack <context-pack-dir> [--json]
```

## Source Inputs

The source window generated a real current-repo Context Pack Lite bundle into
ignored private test output:

```text
node scripts/basebrief.js context-pack --repo . --output-dir tests/outputs/private/v2.5-doctor-dogfooding/context-pack --json
```

The generated pack was then inspected with:

```text
node scripts/basebrief.js doctor --repo . --context-pack tests/outputs/private/v2.5-doctor-dogfooding/context-pack --json
```

## Acceptance Summary

```text
doctor_contract_version: basebrief-doctor-v1
doctor_command_status: warning
doctor_error_count: 0
doctor_warning_count: 2
doctor_info_count: 1
checker_error_propagation_status: pass
public_safety_status: pass
read_only_status: pass
provider_probe_status=skipped
```

The dogfooding pass reported warnings, not errors. The warnings were expected:
the repository had v2.5 local changes in progress during the dogfooding run,
and the generated Context Pack Lite snapshot did not yet contain explicit
`No Workflow Runner` boundary wording.

## Receiver-style Review

Reviewing the doctor JSON was enough to recover:

- command identity: `doctor`
- contract version: `basebrief-doctor-v1`
- public-safe repo and context pack path labels
- status summary counts
- warning versus error semantics
- live repo recheck requirement
- source-backed stale or dirty findings
- no-provider, no-runtime, no MCP server, no schema-v2, and no Workflow Runner
  boundary coverage

## Observed Friction

- Doctor correctly reports dirty development state as a warning, so dogfooding
  during implementation should expect warning status.
- Doctor is intentionally not a proof that the pack is fresh enough to act on.
  It points the receiver to live rechecks instead.
- Boundary wording is deliberately literal. Missing wording produces a warning
  so docs can be tightened without inventing policy.

## Boundaries Confirmed

- No `status` command.
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
- No Context Pack Lite generator output change.
- No `check --input <dir> --json` top-level shape change.
- No `resume --input <context-pack-dir>` behavior change.
- No `export --input <context-pack-dir> --output-dir <dir>` contract change.
- No push, tag, release, pull request, npm publish, or global CLI install.

## Local Validation Gate

The local validation gate for this dogfooding record is:

```text
node scripts/basebrief.js context-pack --repo . --output-dir tests/outputs/private/v2.5-doctor-dogfooding/context-pack --json
node scripts/basebrief.js doctor --repo . --context-pack tests/outputs/private/v2.5-doctor-dogfooding/context-pack --json
node --test tests/basebrief.test.js --test-name-pattern "Doctor|v2.5|Context Pack"
npm test
npm run release-check
git diff --check
```

When provider environment variables are absent, release checks must keep:

```text
provider_probe_status=skipped
```
