# Context Pack Release-Check Maintainability Plan v2.6.22

status: local maintainability plan only, not implementation

- plan_status: drafted
- implementation_status: not_started
- release_closeout_status: not_started
- push_status: not_started
- tag_status: not_started
- release_status: not_started
- pr_status: not_started
- provider_probe_status=skipped
- command_status: unchanged
- json_contract_change_status: not_started
- test_split_status: deferred
- ci_status: not_started

## Summary

`v2.6.22` freezes the next near-term direction after the ahead-19 bundle
compression and implementation gate decision. The next useful slice is
release-check maintainability modularization, because `run_release_checks.js`
has become the clearest maintenance pressure point while the product contracts
remain stable enough.

This note is a plan only. It does not implement the split, add commands, change
release-check output, change JSON contracts, or start CI, MCP, plugin,
runtime, daemon, watcher, hosted-memory, or publish work.

## Goal

Make release-check assertions easier to maintain without weakening the
coverage that protects public docs, examples, contracts, and local-only
boundaries.

The first implementation slice should reduce navigation pressure in
`run_release_checks.js` while preserving the same observable validation
behavior.

## Scope

The recommended first slice is narrow:

- group long document assertions by release line or topic
- introduce local helper functions only when they remove repeated assertion
  boilerplate
- keep exact technical literals exact
- keep whitespace-normalized phrase matching for prose-only assertions
- keep all validation reachable from the existing `npm run release-check`

Likely touched area:

```text
scripts/run_release_checks.js
```

Optional follow-up docs may record the completed maintainability slice, but the
first implementation does not need new user-facing behavior.

## Recommended First Implementation Slice

Start with the v2.x dogfooding/documentation assertion cluster, because recent
v2.6.x work added the most new assertions there.

Preferred shape:

```text
checkContentContracts()
  -> checkV2ContextPackDocs(...)
  -> checkV26DogfoodingDocs(...)
```

This can stay inside `scripts/run_release_checks.js` for the first slice. A
separate helper file should wait until the internal grouping is proven useful.

## Non-Goals / Protected Areas

- No new CLI command.
- No release-check output shape change.
- No test command change.
- No Context Pack seven-file structure change.
- No `check --input <dir> --json` top-level shape change.
- No Resume JSON contract change.
- No Doctor JSON contract change.
- No Export JSON contract change.
- No Status command.
- No Workflow Runner.
- No Continuation Harness Lite implementation.
- No provider request.
- No runtime integration.
- No MCP server.
- No MCP tools.
- No plugin.
- No schema-v2.
- No daemon.
- No watcher.
- No hosted memory.
- No GitHub Actions CI in this slice.
- No npm publish, push, tag, release, or pull request.

## Verification

The implementation slice must keep the local gate unchanged:

```text
npm run release-check
npm test
git diff --check
provider_probe_status=skipped
```

`npm run release-check` should continue to print the same metric lines. The
maintainability work should be judged by lower local edit risk and clearer
assertion grouping, not by new product behavior.

## Rollback

Rollback should be simple: revert the release-check grouping changes and keep
the existing assertions in their previous inline location. No generated
artifacts, schemas, examples, command outputs, or public contracts should need
rollback.

## Longer-Term Direction

After the first slice passes, consider later planning for:

- examples as runnable recipes
- first-run smoke path consolidation
- Context Pack output UX polish without JSON shape change
- test-file split planning

Keep CI, MCP, plugin, npm publishing, watcher, daemon, hosted memory, and
runtime integration as long-term candidates only until a separate explicit gate
opens them.
