# Context Pack Doctor Dogfooding v2.5.1

Date: 2026-06-08

This public-safe record captures the post-commit continuation evidence for the
v2.5.1 Context Pack Doctor boundary polish.

It records summarized evidence only. It does not copy raw generated pack
bodies, private absolute paths, provider details, secrets, `.env` content, API
keys, tokens, credentials, or raw private output.

## Goal

Verify that the v2.5.1 Context Pack Lite boundary polish removes the clean-pack
`doctor.no-provider-boundary` warning without changing command surfaces or
expanding scope.

The confirmed command surfaces remain:

```text
node scripts/basebrief.js context-pack --repo <target-repo> --output-dir <dir> [--json]
node scripts/basebrief.js doctor --repo <target-repo> --context-pack <context-pack-dir> [--json]
node scripts/basebrief.js resume --input <context-pack-dir> [--json]
node scripts/basebrief.js export --input <context-pack-dir> --output-dir <dir> [--json]
```

## Source Inputs

The source window generated fresh current-repo Context Pack Lite bundles into
ignored private test output and reviewed only summarized command results.

The post-commit clean smoke used:

```text
node scripts/basebrief.js context-pack --repo . --output-dir tests/outputs/private/v2.5.1-post-commit-smoke/context-pack --json
node scripts/basebrief.js doctor --repo . --context-pack tests/outputs/private/v2.5.1-post-commit-smoke/context-pack --json
node scripts/basebrief.js check --input tests/outputs/private/v2.5.1-post-commit-smoke/context-pack --json
node scripts/basebrief.js resume --input tests/outputs/private/v2.5.1-post-commit-smoke/context-pack --json
```

The receiver-style continuation pass used:

```text
node scripts/basebrief.js context-pack --repo . --output-dir tests/outputs/private/v2.5.1-real-continuation/context-pack --json
node scripts/basebrief.js check --input tests/outputs/private/v2.5.1-real-continuation/context-pack --json
node scripts/basebrief.js doctor --repo . --context-pack tests/outputs/private/v2.5.1-real-continuation/context-pack --json
node scripts/basebrief.js resume --input tests/outputs/private/v2.5.1-real-continuation/context-pack --json
```

## Acceptance Summary

```text
doctor_contract_version: basebrief-doctor-v1
post_commit_doctor_status: passed
post_commit_doctor_error_count: 0
post_commit_doctor_warning_count: 0
post_commit_doctor_info_count: 1
post_commit_doctor_findings: doctor.live-recheck-required
no_provider_boundary_warning_status: absent
context_pack_check_status: passed
resume_status: ready
export_bundle_check_status: passed
provider_probe_status=skipped
```

The post-commit clean smoke confirmed that a freshly generated current-repo
Context Pack Lite no longer triggers `doctor.no-provider-boundary`. The only
doctor finding was `doctor.live-recheck-required`, which is intentional receiver
guidance.

## Stress Findings

The continuation evidence also checked controlled private fixtures:

```text
stale_pack_status: warning
stale_pack_findings: doctor.pack-head-stale, doctor.pack-branch-mismatch, doctor.live-recheck-required
broken_pack_status: failed
broken_pack_findings: doctor.pack-check-error, doctor.live-recheck-required
```

This confirms stale context remains warning-level and readable, while a broken
Context Pack Lite directory reports checker errors through the doctor JSON.

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
- No Context Pack Lite file count or read-order change.
- No Context Pack Check JSON top-level shape change.
- No `resume --input <context-pack-dir>` behavior change.
- No `export --input <context-pack-dir> --output-dir <dir>` contract change.
- No push, tag, release, pull request, npm publish, or global CLI install.

## Local Validation Gate

The local validation gate for this evidence record is:

```text
node --test tests/basebrief.test.js --test-name-pattern "Doctor|v2.5|Context Pack|Export|Dogfooding"
npm test
npm run release-check
git diff --check
```

When provider environment variables are absent, release checks must keep:

```text
provider_probe_status=skipped
```
