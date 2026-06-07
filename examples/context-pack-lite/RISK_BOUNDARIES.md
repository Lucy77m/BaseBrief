# Risk Boundaries

Review status: reviewed
Source: v2.0-A Context Pack Lite planning baseline
Trust: high
Stale: false

## Do Not Touch

- No provider request.
- No AI automatic summary.
- No vector database, embedding, or semantic index.
- No runtime integration.
- No plugin, MCP, IDE, hosted service, or cloud-memory work.
- No schema-v2, basebrief-project-state-v2, or basebrief-sidecar-v2.
- No repo dump behavior.
- No push, tag, release, pull request, npm publish, or global CLI install without explicit approval.
- Do not read, write, or expose `.env`, API keys, tokens, credentials, raw private output, or private notes.
- Keep the v1.x Delta Receiver line frozen unless explicitly reopened by the user.

## Requires Explicit User Approval

- New top-level command beyond `context-pack`.
- New schema, schema-v2, or command output format change.
- Checker rule family changes.
- Push, tag, release, pull request, npm publish, or global CLI install.
