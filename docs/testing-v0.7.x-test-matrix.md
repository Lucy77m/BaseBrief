# BaseBrief v0.7.x Test Matrix

This matrix covers the `v0.7.0` Project State Lifecycle candidate. It extends
the v0.6.x state evidence without changing `basebrief-project-state-v1`.

## Local Matrix

| Test case ID | Path | Expected result |
| --- | --- | --- |
| `state-status-missing` | Run `state-status` before `.basebrief/state.json` exists. | Reports missing state without writing files. |
| `state-validate-missing` | Run `state-validate` before state exists. | Returns `validation_status: failed`; CLI exits nonzero. |
| `state-validate-invalid` | Corrupt `.basebrief/state.json`. | Reports schema/object validation errors. |
| `state-advance-archives-history` | Advance from one reviewed source to another. | Previous state is archived under `.basebrief/history/`; next state is written. |
| `state-history-after-advance` | Run `state-history` after the first advance. | Lists one valid archived state entry. |
| `state-advance-draft-rejected` | Use a `draft_needs_review` source. | Rejects the source before writing. |
| `state-advance-env-source-rejected` | Use a `.env` source path. | Rejects the path. |
| `state-advance-git-source-rejected` | Use a `.git` source path. | Rejects the path. |
| `artifact-check-public-docs` | Run Artifact Checker on v0.7.0 docs. | No warnings or errors. |

## External Runner Matrix

External runner checks are intended to validate repeatability from outside the
current Codex window without using provider APIs. They may use local tool
installations only when available.

| Runner | Scope | Provider use |
| --- | --- | --- |
| OpenCode local shell | Run CLI lifecycle smoke from a private ignored output directory. | none |
| Claude Code local shell | Optional repeat of lifecycle smoke when available. | none |
| OpenClaw or Hermes local workspace | Optional read-only lifecycle smoke when a safe local workspace is confirmed. | none |

If a runner is unavailable, record the skip reason in private evidence. Do not
write private absolute paths into public docs.

## Boundaries

- No Auto Flow.
- No provider request.
- No schema change.
- No receiver thread creation.

## Provider Matrix Design

Provider execution remains out of scope for `v0.7.0`. Public docs may record
only the env var shape:

- `BASEBRIEF_PROVIDER_BASE_URL`
- `BASEBRIEF_PROVIDER_API_KEY`
- `BASEBRIEF_PROVIDER_MODEL`

Release checks must continue to allow `provider_probe_status=skipped`. Real
endpoint, key, model value, raw response, and token output must stay out of
public docs and commits.

## Required Commands

```text
node --test tests/basebrief.test.js
node scripts/run_release_checks.js
npm run check
git diff --check
```
