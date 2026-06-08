# Context Pack Resume Spec

Status: v2.2-A contract freeze

Context Pack Resume is the planned v2.2 command surface for turning a checked
Context Pack Lite directory into copyable new-window prompt text.

This spec defines a local prompt assembly contract only. It does not define a
new JSON schema, provider request, runtime behavior, MCP server, plugin, IDE
integration, hosted service, cloud-memory layer, or Workflow Runner.

## Command

```text
node scripts/basebrief.js resume --input <context-pack-dir> [--json]
```

The command is intentionally singular. The first v2.2 slice does not add a
separate `new-window` alias.

## Input

The input is a Context Pack Lite directory containing:

```text
MANIFEST.md
REPO_MAP.md
KEY_FILES.md
RECENT_DELTA.md
RISK_BOUNDARIES.md
RECEIVER_STATE.md
NEXT_WINDOW_STARTER.md
```

Resume does not generate this pack. It reads a pack created by
`context-pack` or an equivalent reviewed local source.

## Validation

Resume must reuse the existing Artifact Checker:

```text
node scripts/basebrief.js check --input <context-pack-dir> --json
```

Required behavior:

- zero errors: produce a prompt
- warning-only findings: produce a prompt and include warning lines as review
  notes
- one or more errors: stop before prompt output

The checker remains the source of validation truth. Resume does not change
checker rule IDs, checker severity, or the `check --input <dir> --json`
top-level shape.

## Prompt Content

The prompt should include:

- the context pack reading order
- the input directory
- instructions to recheck cwd, branch, HEAD, and worktree state
- a reminder that inherited pack facts are not reverified in the new window
- risk boundaries from the pack
- checker notes, including warning-only findings
- the original `NEXT_WINDOW_STARTER.md` content

The prompt is copyable text only. It does not send the prompt anywhere.

## JSON Output

`--json` should return a command result with:

- `command: "resume"`
- `contractVersion: "basebrief-resume-v1"`
- `input`
- `status: "ready"`
- `prompt`
- `promptLength`
- `check`

The nested `check` object may include the existing checker status, counts, and
findings. This does not change the checker command's own JSON shape.

## Boundaries

Resume must not:

- call providers or AI APIs
- create a session, thread, pull request, tag, release, or external write
- run a daemon, watcher, Workflow Runner, hosted service, or runtime adapter
- read or expose `.env`, secrets, tokens, credentials, API keys, or raw private
  output
- modify Context Pack Lite generator output
- introduce schema-v2, `basebrief-project-state-v2`, or
  `basebrief-sidecar-v2`
- add plugin, MCP, IDE, hosted, or cloud-memory behavior

