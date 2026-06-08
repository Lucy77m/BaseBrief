# Context Pack Check Acceptance v2.1.0

This public-safe record captures one local acceptance summary for the v2.1
Context Pack Check line.

It records checker outcomes and rule coverage only. It does not copy raw
generated pack bodies, private absolute paths, provider details, secrets,
`.env` content, API keys, tokens, credentials, or raw private checker output.

## Goal

Verify that the existing `check --input <context-pack-dir>` surface can:

- pass a clean seven-file Context Pack Lite directory
- fail broken packs with the expected `context-pack.*` findings
- emit warning-only thickness findings without turning a pack into an error
- keep existing public-safety rules responsible for private-path and
  secret-like failures

## Source Inputs

The acceptance line uses the existing command shape:

```text
node scripts/basebrief.js check --input <context-pack-dir> --json
```

The checked pack shape remains:

```text
MANIFEST.md
REPO_MAP.md
KEY_FILES.md
RECENT_DELTA.md
RISK_BOUNDARIES.md
RECEIVER_STATE.md
NEXT_WINDOW_STARTER.md
```

The clean fixture is generated locally from the existing Context Pack Lite
builder. Broken cases are normalized test fixtures that mutate one property at
a time. Unsafe private-path and secret-like cases are synthesized at runtime so
public source files do not contain raw unsafe strings.

## Acceptance Summary

```text
clean_pack_status: pass
broken_pack_status: pass
thickness_warning_status: pass
public_safety_passthrough_status: pass
provider_probe_status=skipped
```

## Checked Cases

- Clean pack: `check --input <context-pack-dir>` returned `status: passed`,
  `errorCount: 0`, and no `context-pack.*` findings.
- Broken pack coverage: missing required file, missing metadata, invalid
  metadata, missing manifest field, missing risk boundary, missing receiver
  state semantics, and missing starter instruction all failed through the
  existing `findings` array with their expected `context-pack.*` rule ids.
- Thickness coverage: an over-limit artifact produced
  `context-pack.too-thick` as a warning while the overall check still stayed
  `passed`.
- Public-safety passthrough: fake private-path and fake secret-like mutations
  still failed through existing public-safety rules such as
  `private.absolute-path` and secret-string findings, not through a new command
  and not through a new JSON result shape.

## Observed Friction

- The checker is intentionally conservative: it verifies pack shape and safety
  anchors, not the truth of every repo claim.
- Thickness is still character-based, not token-based. The current warning
  contract is enough for local review, but not a complex pack-budget model.
- Public docs need to describe the checker as an extension of the existing
  Artifact Checker, otherwise readers may assume a separate command exists.

## Next Fix Candidate

The next narrow candidate after v2.1.0 is v2.2 One-command Resume /
New-window Prompt:

- reuse the checked pack as input
- keep live repo fact recheck explicit
- keep gap reporting explicit before edits
- avoid reopening checker shape, generator shape, or JSON shape

This is a candidate only. It is not implemented by this evidence record.

## Boundaries

- No provider request.
- No raw private output.
- No runtime integration.
- No plugin, MCP, IDE, hosted, or cloud-memory work.
- No schema-v2 work.
- No `basebrief-project-state-v2`.
- No `basebrief-sidecar-v2`.
- No Workflow Runner.
- No new top-level checker command.
- No push, tag, release, pull request, npm publish, or global CLI install.
