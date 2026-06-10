# Project Profile Lite Example Kit

This public-safe example explains the v2.9 Project Profile / Recipes Lite
shape. It is a reviewed local-defaults guide, not global config, not live
repository state, and not raw generated private output.

Create a profile with:

```text
node scripts/basebrief.js profile-init --repo <target-repo> --output <profile.json> [--recipe continuation-default|small-delta|review-heavy] [--json]
```

Use it with:

```text
node scripts/basebrief.js continue --profile <profile.json> --output-dir <dir> [--repo <target-repo>] [--since <commit>] [--max-files <n>] [--json]
```

Explicit `continue` flags override profile defaults.

## Files

- `basebrief-profile.json`: public-safe `basebrief-project-profile-v1` example

## Recipes

- `continuation-default`: normal next-window continuation packages
- `small-delta`: narrower recent-delta packages
- `review-heavy`: wider public-safe file review packages

## Receiver Rule

Project Profile defaults only choose local continuation-package inputs. The
receiver must still recheck live cwd, branch, HEAD, and worktree status before
implementation. A profile is inherited preference context, not proof that the
receiver window has verified current repository facts.

## Boundaries

Project Profile Lite does not call providers, does not store secrets, and
does not write global config. It does not run a Workflow Runner, does not
expand Doctor or Export, does not create an MCP server or plugin, does not
add schema-v2, and does not perform git or release actions.
