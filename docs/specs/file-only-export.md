# File-only Export Spec

Status: v2.4-A contract freeze

Implemented surface: `node scripts/basebrief.js export --input <context-pack-dir> --output-dir <dir> [--json]`

File-only Export is a planned local artifact contract for making BaseBrief
Context Pack Lite and future BaseBrief Format outputs easier for other local
tools to consume.

This spec started as docs-first in v2.4-A. v2.4-B adds the local file-only
export command above, without adding a provider request, runtime behavior, MCP
server, plugin, IDE integration, hosted service, cloud-memory behavior,
schema-v2, or Workflow Runner.

## Artifact Family

The planned artifact family is:

```text
exports/
exports/manifest.json
exports/context-pack.md
exports/context.json
exports/adapter-notes.md
```

`exports/` is a recommended explicit output directory name. The CLI writes
these four files directly under the `--output-dir <dir>` path supplied by the
caller; it does not create an additional nested `exports/` directory.

## Roles

`exports/` is an explicit local output directory when the caller chooses that
directory name. It must not be implied, auto-discovered, or written into
host-tool configuration.

`exports/manifest.json` records the export contract version, source file list,
export kind, generator identity, and review status. It is not schema-v2 and is
not a replacement for `basebrief-project-state-v1` or
`basebrief-sidecar-v1`.

`exports/context-pack.md` is the readable single-file export. It should be easy
to inspect, copy, diff, and hand to another local tool.

`exports/context.json` is the machine-readable summary export. It should carry
only reviewed or explicitly marked generated facts.

`exports/adapter-notes.md` is the human review and boundary note. It should
tell consumers what was checked, what remains stale or `needs-review`, and
which actions remain out of scope.

## Required Semantics

File-only Export should preserve:

- source labels
- trust labels
- review status labels
- stale semantics
- `not_available`
- `not_applicable`
- `needs-review`
- risk boundaries
- live repo fact recheck requirements
- warning and error distinctions from Context Pack Check

Missing inputs must stay explicit. The export must not invent facts, turn
generated facts into verified facts, call a provider, or refresh live state
silently.

## MCP-friendly Boundary

MCP-friendly means a future local MCP server or another local tool could read
the files without scraping a conversational transcript.

It does not mean this spec creates:

- an MCP server
- MCP tools
- a plugin
- a runtime integration
- host-tool configuration
- a hosted connector
- cloud memory
- automatic tool execution

## Compatibility

The file-only export direction must not change:

- Context Pack Lite generator output
- Context Pack Check JSON top-level shape
- `resume --input <context-pack-dir>` behavior
- BaseBrief Format v2.3-A docs-first status
- `basebrief-project-state-v1`
- `basebrief-sidecar-v1`

## Boundaries

File-only Export is not:

- a provider request path
- an AI automatic summary feature
- a runtime integration
- a plugin, MCP server, IDE integration, hosted service, or cloud-memory layer
- schema-v2
- `basebrief-project-state-v2`
- `basebrief-sidecar-v2`
- a Workflow Runner
- a universal standard or protocol claim
- an npm package, global CLI install, push, tag, release, or pull request
