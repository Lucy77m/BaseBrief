# BaseBrief

> Stop losing context between AI coding sessions.

BaseBrief is a local-first continuation tool for AI-assisted project work.

When an AI chat window is almost full, you want to switch models, or another AI tool needs to continue the same repo, BaseBrief packages the current project state into a reviewable continuation bundle that the next window can read.

中文 README: [README.md](README.md)

## When To Use It

- Your AI coding session is getting long and you need a fresh window.
- You want to move from ChatGPT to Codex, Claude, Cursor, or another tool.
- You do not want to rewrite the project background by hand every time.
- You want the next AI to see current state, boundaries, and risks before acting.

## Run This First

```text
node scripts/basebrief.js continue --repo . --output-dir tests/outputs/private/continue
```

`tests/outputs/private/` is ignored by this repo and is safe for local generated artifacts.

## What You Get

- `NEXT_WINDOW_STARTER.md`: copy this into the next AI window.
- `CHECK_SUMMARY.md`: whether the continuation package is usable.
- `CONTINUATION_REPORT.md`: a short report of repo state, changes, and risks.
- `context-pack/`: a fuller project context bundle.

For the smallest walk-through, start with the [simple continuation example](examples/simple-continuation/README.md).

## What BaseBrief Does Not Do

- It does not call models or providers.
- It does not automatically write code.
- It does not automatically commit, push, tag, release, or open pull requests.
- It does not read or store keys.
- It does not connect cloud services, an MCP server, a runtime, or a daemon.
- It is not a project manager, Agent runtime, or full spec framework.

## Simple Path And Advanced Path

For first use, remember one command:

```text
continue = create the next-window continuation package
```

If you use `skills/basebrief/SKILL.md`, the normal continuation path routes to `full` or `lite`; `cache-ready` remains an explicit prompt-cache experiment route.

Lower-level `context-pack`, `check`, `resume`, Project Profile, Workflow Runner Lite, Export, Doctor, Seal/Diff, and Project State are documented in [Advanced Usage](docs/advanced.md). They are not the first-run path.

## Keep Reading

- [Why BaseBrief](docs/why-basebrief.md)
- [Simple Concepts](docs/concepts-simple.md)
- [5-minute Quickstart](docs/quickstart-5min.md)
- [Advanced Usage](docs/advanced.md)
- [Full documentation index and archive](docs/index.md)

## Local Validation

```text
npm test
npm run release-check
npm run check
```

These npm scripts are local validation shortcuts only. BaseBrief is not a published npm package or global command. When provider environment variables are absent, release checks should keep reporting `provider_probe_status=skipped`.

## License

MIT
