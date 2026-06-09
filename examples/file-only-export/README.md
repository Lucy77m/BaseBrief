# File-only Export Example Kit

This public-safe example shows the v2.4 File-only Adapter / MCP-friendly Export
bundle shape.

It was normalized from `examples/context-pack-lite` with this command shape:

```text
node scripts/basebrief.js export --input examples/context-pack-lite --output-dir examples/file-only-export/exports --json
```

`exports/` is a recommended example output directory name. The CLI writes the
four export files directly under the explicit `--output-dir` you provide; it
does not create or discover a nested `exports/` directory by itself.

## Runnable Recipe

Shortest file-only export path:

```text
node scripts/basebrief.js check --input examples/context-pack-lite --json
node scripts/basebrief.js export --input examples/context-pack-lite --output-dir examples/file-only-export/exports --json
```

Recipe chain: `check -> export`. First verify the source Context Pack, then
write the four file-only export artifacts directly under the explicit
`--output-dir`.

## Files

```text
exports/manifest.json
exports/context-pack.md
exports/context.json
exports/adapter-notes.md
```

## What To Check

- `manifest.json` records `basebrief-file-export-v1`, source kind, source
  files, output file names, check status, and review metadata.
- `context-pack.md` is the readable single-file export and preserves source
  labels for the seven Context Pack Lite files.
- `context.json` is a high-level machine-readable summary with public file
  names and review/check metadata.
- `adapter-notes.md` repeats the file-only and MCP-friendly boundaries.

## Boundaries

- No provider request.
- No runtime integration.
- No plugin.
- No MCP server.
- No IDE integration.
- No hosted service.
- No cloud-memory behavior.
- No schema-v2.
- No Workflow Runner.
- No private absolute paths.
- No raw private output.
- No `.env`, secrets, tokens, credentials, API keys, or bearer strings.

## Local Check

```text
node scripts/basebrief.js check --input examples/file-only-export --json
```

When provider environment variables are absent, release checks must keep:

```text
provider_probe_status=skipped
```
