# Project State Dogfooding

Dogfooding scope: `v0.6.0` `.basebrief/state.json` local continuity state.

## Evidence Pattern

- command_shape: `state-init --repo <target-repo> --source <receiver-ready.md>`
- output_shape: `.basebrief/state.json`
- source_gate: requires `handoff_status: ready_for_receiver`
- review_checkpoints: source is reviewed before state creation; state is read
  back with `state-read`; generated file is checked by Artifact Checker
- observed_friction: receiver-ready source must exist before local state can be
  initialized
- next_fix_candidate: future state update commands should stay explicit and
  review-gated

## Boundaries

- No provider request.
- No Auto Flow.
- No receiver thread creation.
- No raw private output.
- No private absolute paths.
- No API key or credential material.
- `provider_probe_status=skipped` remains valid for the release gate.

The dogfooding record intentionally stores only public-safe shape information.
