# Context Pack Doctor Example Kit

This public-safe example shows the v2.5 Context Pack Doctor JSON shape.

It uses fixed example metadata and relative paths only. It is not copied from
private dogfooding output.

Command shape:

```text
node scripts/basebrief.js doctor --repo examples/example-repo --context-pack examples/context-pack-lite --json
```

## Check vs Doctor

Run `check` first when the question is whether a Context Pack directory is
complete and structurally reviewable. Run `doctor` when the question is whether
that pack still matches the live repository facts.

- Clean/current pack: `contractVersion=basebrief-doctor-v1`,
  `status=passed`, `errorCount=0`, `warningCount=0`, and usually an
  informational `doctor.live-recheck-required` finding reminding receivers to
  recheck cwd, branch, HEAD, and worktree status.
- Stale pack: `status=warning` with findings such as
  `doctor.pack-head-stale` or `doctor.pack-branch-mismatch`. This means the
  receiver should report the drift and refresh or regenerate before continuing
  if the stale fact affects the task.
- Broken pack: `status=failed` with `doctor.pack-check-error`. This means the
  underlying Context Pack Check found structural errors; do not use that pack as
  the receiver handoff input until it is fixed.

Doctor is not an always-on `status` command. It is a read-only diagnostic for a
specific `--repo` and `--context-pack` pair, and it keeps the v2.5
`basebrief-doctor-v1` JSON contract.

## Sample JSON

```json
{
  "command": "doctor",
  "contractVersion": "basebrief-doctor-v1",
  "repo": "examples/example-repo",
  "contextPack": "examples/context-pack-lite",
  "status": "warning",
  "summary": {
    "errorCount": 0,
    "warningCount": 1,
    "infoCount": 1
  },
  "findings": [
    {
      "severity": "warning",
      "ruleId": "doctor.pack-head-stale",
      "message": "Context pack HEAD differs from live repository HEAD.",
      "source": "context-pack",
      "evidence": "pack=example-head live=example-live"
    },
    {
      "severity": "info",
      "ruleId": "doctor.live-recheck-required",
      "message": "Receivers must recheck cwd, branch, HEAD, and worktree status before implementation.",
      "source": "git",
      "evidence": "branch=main head=example-live"
    }
  ]
}
```

## Boundaries

- No `status` command.
- No provider request.
- No runtime integration.
- No plugin.
- No MCP server.
- No MCP tools.
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
node scripts/basebrief.js doctor --repo . --context-pack examples/context-pack-lite --json
```

When provider environment variables are absent, release checks must keep:

```text
provider_probe_status=skipped
```
