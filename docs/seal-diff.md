# BaseBrief Seal And Diff

Seal/Diff v1 is a small local traceability layer for BaseBrief handoff data.

It records a schema-backed snapshot of BB9 handoff input and compares two snapshots across phase changes. It is not a project-management system, hosted timeline, release system, or audit log.

## Commands

Create a seal:

```text
node scripts/basebrief_seal.js seal --input examples/seal-before-input.json --output tests/outputs/private/seal-before.json
node scripts/basebrief.js seal --input examples/seal-before-input.json --output tests/outputs/private/seal-before.json --json
```

Compare two inputs or seals:

```text
node scripts/basebrief_seal.js diff --before examples/seal-before-input.json --after examples/seal-after-input.json --json
node scripts/basebrief.js diff --before examples/seal-before-input.json --after examples/seal-after-input.json --json
```

Inputs can be:

- BB9 handoff JSON
- structured Markdown containing `BASEBRIEF_HANDOFF_JSON_BEGIN` / `BASEBRIEF_HANDOFF_JSON_END`
- existing `basebrief-seal-v1` JSON

## Seal Shape

A seal contains:

- `schemaVersion`
- `sourceSchema`
- `sealedAt`
- canonical `handoff` fields
- section checksums
- overall checksum

The seal schema is [schemas/basebrief-seal.schema.json](../schemas/basebrief-seal.schema.json).

## Diff Shape

Diff v1 compares the fields that matter for continuation:

- `verified_facts`
- `confirmed_decisions`
- `risk_boundaries`
- `open_questions`
- `forbidden_scope`
- `current_goal`
- `expected_output`
- `tail_request`

The summary reports whether task boundaries changed. A task boundary change means the current goal, expected output, tail request, risk boundaries, or forbidden scope changed.

## Boundary

Seal/Diff v1 is intentionally local and file-based. It does not read `.env`, call providers, publish artifacts, manage accounts, or modify external projects. Use the artifact checker before sharing generated seals or diff summaries.
