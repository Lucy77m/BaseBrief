# BaseBrief

> I’ll return to the project scene with context in hand, every time.

BaseBrief is a Chinese-first, local-first handoff tool for AI-assisted project work.

It turns live repo state, verified facts, risk boundaries, and next steps into a reviewable Context Pack so the next AI window, model, or coding agent can continue from the actual project state instead of rediscovering it.

中文 README: [README.md](README.md)

## When To Use It

- You are continuing work in a new AI window, model, or tool.
- You want to package the current repo state into a readable Context Pack.
- You want to check whether an older Context Pack is stale against the live repo.
- You want risk boundaries written down before the next receiver guesses.

BaseBrief keeps one public skill entry and a zero-dependency CLI Lite. The normal continuation path routes to `full` or `lite`; `cache-ready` remains an explicit prompt-cache experiment route.

## Start In 2 Minutes

Ask the AI to read the BaseBrief skill:

```text
Please read skills/basebrief/SKILL.md.
Choose full or lite for the current task and produce a project-stage baseline.
Do not turn assumptions into verified facts; list open_questions when boundaries are unclear.
```

Or use CLI Lite to prepare a continuation package; run the Context Pack steps
manually only when you want the lower-level flow:

```text
node scripts/basebrief.js continue --repo . --output-dir tests/outputs/private/continue
node scripts/basebrief.js context-pack --repo . --output-dir tests/outputs/private/context-pack --json
node scripts/basebrief.js check --input tests/outputs/private/context-pack --json
node scripts/basebrief.js resume --input tests/outputs/private/context-pack
```

`tests/outputs/private/` is ignored by this repo and is the recommended place for local generated artifacts.

## Common Commands

```text
node scripts/basebrief.js continue --repo <target-repo> --output-dir <dir> [--json]
node scripts/basebrief.js profile-init --repo <target-repo> --output <profile.json> [--json]
node scripts/basebrief.js continue --profile <profile.json> --output-dir <dir> [--json]
node scripts/basebrief.js context-pack --repo <target-repo> --output-dir <dir> [--json]
node scripts/basebrief.js check --input <context-pack-dir> [--json]
node scripts/basebrief.js resume --input <context-pack-dir> [--json]
node scripts/basebrief.js export --input <context-pack-dir> --output-dir <dir> [--json]
node scripts/basebrief.js doctor --repo <target-repo> --context-pack <context-pack-dir> [--json]
```

The main line is Continue / Project Profile / Context Pack / Check / Resume / Export / Doctor. `profile-init` only stores public-safe local recipe defaults; `continue` prepares a reviewable continuation package and does not execute project work automatically. For File-only Export, “MCP-friendly means future tool-consumable files”; it does not mean an MCP server, runtime integration, or provider integration.

## Local Validation

```text
npm test
npm run release-check
npm run check
```

These npm scripts are local validation shortcuts only. BaseBrief is not a published npm package, global command, chat client, Agent runtime, hosted platform, key manager, project management system, or provider gateway.

## Safety Boundaries

- No provider request.
- No raw private output.
- No runtime integration.
- No schema change / No schema-v2.
- No MCP server.
- No Workflow Runner; `continue` is a local continuation-package preparer, not a runner.
- Project Profile is not global config, a secret store, or an automation system.
- Do not publish `.env`, keys, tokens, private absolute paths, or assumptions as verified facts.

When provider environment variables are absent, release checks should keep reporting `provider_probe_status=skipped`.

## Keep Reading

- [5-minute Quickstart](docs/quickstart-5min.md)
- [CLI Lite](docs/cli-lite.md)
- [Full documentation index and archive](docs/index.md)

## License

MIT
