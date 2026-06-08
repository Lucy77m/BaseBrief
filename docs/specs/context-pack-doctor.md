# Context Pack Doctor Spec

Status: v2.5-A contract freeze

Implemented surface:

```text
node scripts/basebrief.js doctor --repo <target-repo> --context-pack <context-pack-dir> [--json]
```

Context Pack Doctor is a local read-only diagnostic for checking whether a
Context Pack Lite snapshot still looks safe to use as receiver input for a live
repository.

It is not `state-status`, not a replacement for Context Pack Check, not a
generator, not an exporter, and not a Workflow Runner.

## Inputs

Doctor requires explicit inputs:

- `--repo <target-repo>`
- `--context-pack <context-pack-dir>`

It does not auto-discover a repository or context pack. It refuses missing
paths, non-directory context packs, `.env` paths, `.git` paths, and inputs that
do not satisfy the Context Pack Lite checker.

## JSON Shape

`doctor --json` returns:

```json
{
  "command": "doctor",
  "contractVersion": "basebrief-doctor-v1",
  "repo": "<public relative path>",
  "contextPack": "<public relative path>",
  "status": "passed|warning|failed",
  "summary": {
    "errorCount": 0,
    "warningCount": 0,
    "infoCount": 0
  },
  "findings": []
}
```

`status` is `failed` when one or more findings have severity `error`, `warning`
when there are no errors and one or more warnings, and `passed` when only info
findings remain.

## Findings

Each finding is:

```json
{
  "severity": "error|warning|info",
  "ruleId": "doctor.<rule>",
  "message": "...",
  "source": "git|context-pack|check|docs",
  "evidence": "public-safe short text"
}
```

Evidence must stay short and public-safe. It may include relative file names,
counts, branch names, short commit ids, and checker rule ids. It must not
include raw private output, private absolute paths, `.env`, secrets, tokens,
credentials, API keys, bearer strings, or provider details.

## Rules

- `doctor.worktree-dirty`: live repo has changed files; warning.
- `doctor.pack-head-stale`: pack `MANIFEST.md` HEAD differs from live HEAD;
  warning.
- `doctor.pack-branch-mismatch`: pack branch differs from live branch; warning.
- `doctor.pack-check-error`: Context Pack Check reports an error; error.
- `doctor.pack-check-warning`: Context Pack Check reports a warning; warning.
- `doctor.live-recheck-required`: receivers must recheck live repo facts before
  implementation; info.
- `doctor.no-provider-boundary`: risk/starter docs are missing required
  local-only boundary wording; warning.

The required local-only boundary wording covers no provider request, no runtime
integration, no MCP server, no schema-v2, and no Workflow Runner.

## Compatibility

Doctor must not change:

- Context Pack Lite generator output
- Context Pack Check JSON top-level shape
- `resume --input <context-pack-dir>` behavior
- `export --input <context-pack-dir> --output-dir <dir>` behavior
- `basebrief-project-state-v1`
- `basebrief-sidecar-v1`

## Boundaries

Context Pack Doctor is not:

- a provider request path
- a runtime integration
- a plugin
- an MCP server
- MCP tools
- an IDE integration
- a hosted connector
- cloud memory
- schema-v2
- a status dashboard
- a watcher, daemon, or background monitor
- an auto-fix command
- a Workflow Runner
- an npm package, global CLI install, push, tag, release, or pull request
