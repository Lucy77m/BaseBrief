# BaseBrief Format Spec

Status: v2.3-A contract freeze

BaseBrief Format is a planned local-first packaging contract for BaseBrief
handoff artifacts.

This spec is docs-first. It does not implement a command, generator, JSON
schema file, schema-v2, provider request, runtime behavior, MCP server, plugin,
IDE integration, hosted service, cloud-memory behavior, or Workflow Runner.

## Artifact Family

The planned artifact family is:

```text
context-pack/
context-pack.md
context.json
```

## Roles

`context-pack/` is the directory form. It preserves the existing Context Pack
Lite reading model and remains the most reviewable shape.

`context-pack.md` is a future single-file readable form. It should be easy to
copy into a new window, inspect in a text editor, and compare in review.

`context.json` is a future machine-readable summary form. It should support
tool consumption without claiming schema-v2 or replacing existing v1 project
state and sidecar contracts.

## Required Semantics

BaseBrief Format should preserve:

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

Missing inputs must stay explicit. The format must not invent facts or convert
generated facts into verified facts.

## Boundaries

BaseBrief Format is not:

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

## Compatibility

The format direction must not change:

- Context Pack Lite generator output
- Context Pack Check JSON top-level shape
- `basebrief-project-state-v1`
- `basebrief-sidecar-v1`
- existing `resume --input <context-pack-dir>` behavior

