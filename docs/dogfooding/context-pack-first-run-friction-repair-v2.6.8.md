# Context Pack First-Run Friction Repair v2.6.8

Date: 2026-06-09

This public-safe repair note closes the small confusing items recorded in the
v2.6.7 first-run rehearsal audit. It keeps the repair docs-first: no command,
contract, schema, fixture generation, runtime behavior, provider request, MCP
server/tools, Status command, or Workflow Runner was added.

## Source Evidence

The repair is based on
`docs/dogfooding/context-pack-first-run-rehearsal-audit-v2.6.7.md`.

The v2.6.7 rehearsal found no blocking adoption friction. It did record two
confusing items:

- On some Windows terminals, Chinese markdown may render incorrectly when the
  console is not reading UTF-8.
- The 5-minute quickstart has several paths, so first-run users benefit from a
  clearer "start here first" route before optional advanced paths.

## Repairs Landed

- `docs/quickstart-5min.md` now states the first-run route explicitly:
  `最短闭环 -> 路径 B -> 路径 B3`.
- The quickstart now labels `路径 B2`, `路径 C`, and `路径 D` as optional
  routes for already-reviewed handoffs, phase comparison, or source-window safe
  checks.
- The quickstart now includes a Windows/PowerShell UTF-8 display note:
  use `Get-Content -Encoding UTF8 <file>` or an editor before treating terminal
  mojibake as a document defect.
- `scripts/run_release_checks.js` now protects the v2.6.8 repair note, the
  quickstart wording, the docs entry points, and the local-only boundaries.

## Acceptance

```text
source_audit: docs/dogfooding/context-pack-first-run-rehearsal-audit-v2.6.7.md
blocking_friction: none
confusing_friction_repaired: quickstart route choice, Windows UTF-8 display note
quickstart_primary_route: 最短闭环 -> 路径 B -> 路径 B3
windows_utf8_note: Get-Content -Encoding UTF8 <file>
behavior_change: none
provider_probe_status=skipped
```

## Boundaries

- No provider request.
- No runtime integration.
- No hosted memory.
- No plugin.
- No MCP server.
- No MCP tools.
- No schema-v2.
- No Status command.
- No Workflow Runner.
- No new CLI command.
- No new public fixture files in this slice.
- No Context Pack seven-file structure change.
- No `check --input <dir> --json` top-level shape change.
- No Resume JSON contract change.
- No Doctor JSON contract change.
- No Export JSON contract change.
- No npm publish, push, tag, release, or pull request in this implementation
  slice.

## Validation Gate

The local validation gate for this repair slice is:

```text
npm test
npm run release-check
git diff --check
```

When provider environment variables are absent, release checks must keep:

```text
provider_probe_status=skipped
```
