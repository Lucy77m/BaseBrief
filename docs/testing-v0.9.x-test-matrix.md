# v0.9.x Integrated Handoff Closure Matrix

This matrix covers the public `v0.9.x` integrated local handoff line.

## Shared Path

```text
receiver-ready.md -> state-init/state-advance -> sidecar-build -> sidecar-check -> new-window-starter.md -> receiver first response
```

## v0.9.0 Integrated Handoff Readiness

- Defines the integrated local line as receiver-ready handoff -> Project State
  -> Sidecar bundle -> receiver first response.
- Keeps `basebrief-project-state-v1`, `basebrief-sidecar-v1`, BB9, and
  Receiver Safe Check unchanged.
- Keeps `provider_probe_status=skipped` as the correct no-provider gate.

## v0.9.1 Golden Path Closure

- Adds `docs/golden-path.md` as the single public walkthrough.
- Keeps `state-init` for first-pass, `state-advance` for follow-up, and
  `state-status` / `state-validate` / `state-history` as optional read-only
  checks.
- Keeps the receiver first response at `pass/fail` plus wait for confirmation.

## v0.9.2 Golden Path Example Closure

- Adds `examples/golden-path/` as the public-safe example kit.
- Covers both first-pass and follow-up branches with reviewed handoff shape,
  Project State shape reference, receiver first-response examples, and the
  Sidecar output boundary note.
- Keeps raw Sidecar output in ignored private directories.

## v0.9.3 Final Closure / Freeze

- Records `v0.9.x` as a closed release line rather than an open `v0.9.0`
  target.
- Adds this aggregate matrix and the final closure candidate doc.
- Aligns README, docs index, testing docs, roadmap wording, release checks, and
  tests around one stable summary:
  `v0.9.0` define, `v0.9.1` guide, `v0.9.2` example, `v0.9.3` close/freeze.
- Keeps `v1.0` out of scope for this line.

## Standard Local Commands

```text
node --test tests/basebrief.test.js
node scripts/run_release_checks.js
npm run check
git diff --check
```

## Shared Boundaries

- No provider request.
- No raw private output.
- No runtime integration.
- No schema change.
- No Auto Flow.
- No plugin or platform work.
- No v1.0 work.
- `cache-ready` remains experimental and is not part of the default path.

When provider environment variables are absent, release checks must keep
`provider_probe_status=skipped`.
