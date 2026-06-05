# Pre-v0.8 Friction Log

This log records public-safe friction from the BaseBrief Pre-v0.8
self-validation checkpoint. It is not a raw transcript, not a provider trace,
not v0.8 implementation evidence, and not proof that Sidecar exists.

Private raw outputs remain under ignored `tests/outputs/private/` paths.

## Friction Entries

| Friction ID | Observation | Decision |
| --- | --- | --- |
| `review-checklist-required` | `receiver-flow --guided` correctly produced `draft_needs_review`; `review-draft` required the checklist to be explicitly reviewed before promotion. | Keep the manual review gate before durable state. |
| `state-artifact-local-only` | `state-init` writes `.basebrief/state.json` at the repo root, which is useful for local validation but should not become a public committed artifact. | Copy raw state evidence to ignored private output and remove the root `.basebrief/` directory after validation. |
| `release-ui-not-authenticated` | Git refs verify `main` and `v0.7.0`, but GitHub Release UI latest status was not rechecked with authenticated tooling in this checkpoint. | Treat the user's release statement as accepted unless authenticated tooling is used later. |
| `receiver-acceptance-explicit-confirmation` | The first receiver-window check failed because the state said not to advance but did not explicitly say to wait for user confirmation. | Regenerate receiver_entry_task with explicit user-confirmation language before accepting the checkpoint. |
| `receiver-acceptance-retry-passed` | After regenerating the state with explicit user-confirmation language, the separate receiver-window check passed all five acceptance items. | Allow v0.8.0 Sidecar planning to start after this checkpoint, while preserving the explicit-confirmation requirement. |

## Follow-Up Rules

- If receiver-window acceptance fails, fix `receiver-flow --guided`,
  `review-draft`, or `state-read` presentation before Sidecar work.
- If `current_goal`, `receiver_entry_task`, or `risk_boundaries` are empty in a
  future run, block v0.8.0 Sidecar and repair the state-generation path first.
- If v0.8.0 adds `sidecar-build`, its acceptance must include content checks,
  not just output file existence.

## Boundaries

- No provider request.
- No raw private output.
- No v0.8 implementation yet.
- No Sidecar command yet.
- No Auto Flow.
- No schema change.
- No OpenClaw or Hermes runtime integration.
- No push, tag, release, or npm publish.
- `provider_probe_status=skipped` remains the public release-check posture.
