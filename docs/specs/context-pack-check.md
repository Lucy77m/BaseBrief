# Context Pack Check Spec

Status: v2.1-A contract freeze

Context Pack Check is the planned v2.1 validation layer for Context Pack Lite.
It verifies a local seven-file context pack before a user hands it to a new AI
window or coding agent.

This spec defines the check contract only. It does not implement checker rules,
define a new CLI command, change the `context-pack` generator output, define a
JSON schema, call a provider, integrate with a runtime, create an MCP server,
add a plugin, add an IDE extension, or introduce Workflow Runner behavior.

## Input Shape

The expected input is a Context Pack Lite directory:

```text
MANIFEST.md
REPO_MAP.md
KEY_FILES.md
RECENT_DELTA.md
RISK_BOUNDARIES.md
RECEIVER_STATE.md
NEXT_WINDOW_STARTER.md
```

The preferred future command shape is the existing Artifact Checker surface:

```text
node scripts/basebrief.js check --input <context-pack-dir> --json
```

If context-pack-specific detection is added later, it should stay under this
surface before BaseBrief adds another top-level command.

## Required Files

The checker should fail when any of these files are missing:

- `MANIFEST.md`
- `REPO_MAP.md`
- `KEY_FILES.md`
- `RECENT_DELTA.md`
- `RISK_BOUNDARIES.md`
- `RECEIVER_STATE.md`
- `NEXT_WINDOW_STARTER.md`

The checker should not require extra files such as `context.json` or
`context-pack.md` in v2.1. Those may belong to a later BaseBrief Format line.

## Shared Metadata

Every artifact should include these labels:

```text
Review status:
Source:
Trust:
Stale:
```

Allowed review status values:

- `reviewed`
- `needs-review`
- `generated`
- `not_available`
- `not_applicable`
- `stale`

Allowed trust values:

- `high`
- `medium`
- `low`

`Stale` should be `true` or `false`. The check only verifies the metadata is
present and shaped consistently. It does not prove that the underlying fact is
fresh.

## MANIFEST.md Rules

`MANIFEST.md` should contain:

- branch
- HEAD
- worktree status
- reading order
- safety notes
- known gaps or missing input semantics

The checker should distinguish missing fields from stale fields. A stale field
is acceptable when it is explicitly marked stale and the starter requires a
live repo fact recheck.

## RISK_BOUNDARIES.md Rules

`RISK_BOUNDARIES.md` should preserve these boundaries:

- no provider request
- no runtime integration
- no plugin, MCP, IDE, hosted service, or cloud-memory behavior
- no schema-v2
- no repo dump
- no secrets, `.env`, token, API key, credential, or bearer string
- no raw private output
- no push, tag, release, pull request, npm publish, or global CLI install
  without explicit approval

These are content-contract checks, not permission enforcement. The checker
does not prevent a user from doing those actions outside BaseBrief.

## RECEIVER_STATE.md Rules

`RECEIVER_STATE.md` should allow missing or irrelevant receiver history:

- `not_available`
- `not_applicable`
- `needs-review`

The checker should reject wording that invents receiver acceptance, lint,
fixture, repair, or dogfooding history when the pack marks those sources as
absent.

## NEXT_WINDOW_STARTER.md Rules

`NEXT_WINDOW_STARTER.md` should instruct the receiver to:

- read the context pack in order
- recheck live repo facts before edits
- report gaps before implementation
- preserve risk boundaries
- keep the v1.x Delta Handoff / Receiver line frozen unless the user explicitly
  reopens it

The starter should be copyable text only. It should not create a new thread,
send a provider request, call an external tool, or run a workflow.

## Public Safety

Context Pack Check should reuse Artifact Checker public-safety behavior:

- reject secret-like strings
- reject private absolute paths
- reject raw private output
- reject provider-general savings claims when evidence is provider-specific

It should keep the existing checker narrow. This is not a complete secret
scanner, compliance audit, or content moderation system.

## Thickness

v2.1 should start with conservative file-size or character-count limits. It
should not add a complex token estimator in the first implementation slice.

A too-thick pack should fail or warn because Context Pack Lite is meant to be a
bounded continuation input, not a repo dump.

## Stale Semantics

The check should accept stale or generated facts only when the pack makes that
state explicit:

- `Stale: true`
- `Review status: stale`
- `Review status: generated`
- `Review status: needs-review`

The check should not attempt to prove the truth of branch, HEAD, worktree,
changed-file, or receiver facts. Receivers must still recheck live repo facts
before edits.

## Future Implementation Notes

The v2.1-B implementation should:

- add context-pack detection under the existing `check --input` path
- keep the result shape compatible with Artifact Checker JSON
- add clean and broken fixtures
- keep checks read-only
- keep v1.x Delta Receiver checker behavior unchanged
- avoid new commands until the existing check surface proves insufficient
