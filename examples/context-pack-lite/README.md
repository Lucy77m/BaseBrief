# Context Pack Lite Example Kit

This directory is a public-safe companion to the v2.0 Context Pack Lite line.
It shows the shape of a reviewed seven-file context pack without copying raw
private output, private absolute paths, provider traces, secrets, or `.env`
content.

The example was derived from one real local BaseBrief self-run and then
normalized for public review. Treat it as a shape reference, not as live repo
state.

Read in this order:

1. [Manifest](MANIFEST.md)
2. [Recent delta](RECENT_DELTA.md)
3. [Risk boundaries](RISK_BOUNDARIES.md)
4. [Repo map](REPO_MAP.md)
5. [Key files](KEY_FILES.md)
6. [Receiver state](RECEIVER_STATE.md)
7. [Next window starter](NEXT_WINDOW_STARTER.md)

Command shape:

```text
node scripts/basebrief.js context-pack --repo <target-repo> --output-dir <dir> [--since <commit>] [--max-files <n>] [--json]
```

The generator is rule-based and file-based. It does not call a provider, run an
AI summary, build a vector index, connect a runtime, add plugin or MCP
behavior, change schema, or run a Workflow Runner.

This example intentionally includes `not_available` and `not_applicable`
receiver-state cases. A Context Pack Lite bundle must show missing inputs as
missing instead of inventing receiver history.
