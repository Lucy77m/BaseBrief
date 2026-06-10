# Continuation Harness Lite Example Kit

This public-safe example explains the v2.8 Continuation Harness Lite output
shape. It is a shape guide, not live repository state and not raw generated
private output.

Run the harness with:

```text
node scripts/basebrief.js continue --repo <target-repo> --output-dir <dir> [--since <commit>] [--max-files <n>] [--json]
```

The command prepares a local continuation package:

```text
CONTINUATION_REPORT.md
NEXT_WINDOW_STARTER.md
CHECK_SUMMARY.md
continuation.meta.json
context-pack/
```

Read in this order:

1. `CONTINUATION_REPORT.md`
2. `CHECK_SUMMARY.md`
3. `NEXT_WINDOW_STARTER.md`
4. `context-pack/MANIFEST.md`
5. `context-pack/RISK_BOUNDARIES.md`
6. `context-pack/RECEIVER_STATE.md`

## Status Semantics

- `ready_for_receiver`: clean pack, clean worktree, and starter ready
- `needs_review`: warning-only pack or dirty worktree; review before copying
  the starter
- `blocked`: Context Pack check errors or resume generation failure; repair and
  rerun

## Receiver Rule

The receiver must recheck live cwd, branch, HEAD, and worktree status before
implementation. The continuation package is inherited context, not proof that
the receiver window has verified current repository facts.

## Boundaries

Continuation Harness Lite does not call providers, does not run a Workflow
Runner, does not expand Doctor or Export, does not create an MCP server or
plugin, does not add schema-v2, and does not perform git or release actions.
