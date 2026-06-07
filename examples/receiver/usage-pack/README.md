# Receiver Usage Pack Example Router

This directory is a public-safe router for the Delta Receiver Usage Pack. It
does not duplicate large example bodies; it points receivers to the closest
copyable public-safe shape.

## Which One Should I Copy Now?

- If you are unsure which receiver family applies, start with
  [the public usage guide](../../../docs/receiver-usage-pack.md), then return
  here for the copy target.
- If live branch, HEAD, and worktree facts match refreshed Delta facts, copy
  [Delta Receiver pass report](../delta-report-pass/README.md).
- If verification completed and a live mismatch was found, copy
  [Delta Receiver difference_found report](../delta-report-difference-found/README.md).
  Human `fail` can coexist with machine `difference_found`.
- If necessary verification cannot be completed safely, copy
  [Receiver blocked example](../blocked/README.md).
- If the latest user message changes the narrative language, check
  [language-routing](../language-routing/README.md).
- If the receiver entered through starter-facing golden-path first-pass
  continuity, copy
  [Golden Path first-pass receiver report](../../golden-path/first-pass-receiver-report.md).
- If the receiver entered through starter-facing golden-path follow-up
  continuity, copy
  [Golden Path follow-up receiver report](../../golden-path/follow-up-receiver-report.md).
- If you need a blank starter skeleton instead of a full example, copy
  [Starter report outline](starter-report-outline.md).

## If A Receiver Lint Finding Sent You Here

1. Open [Receiver Lint Fixture Pack](../lint/README.md) to understand the rule
   family. The broken fixtures are learning inputs, not copy targets.
2. Open [Receiver Lint Repair Pack](../lint/repair/README.md) to find the
   smallest fixed Delta, starter, or result JSON reference.
3. Return to the route list above and copy the existing public receiver example
   that matches the final outcome.

## Route Notes

- Delta reports should keep `source-window inherited facts`, `live repo facts`,
  and `receiver-window rechecks` separate.
- `difference_found` is a completed verification result, not an agent failure.
- historical `commits_in_range` drift remains non-blocking when refreshed
  branch, HEAD, and worktree facts still match live repo state.
- keep `pass/fail` and `wait for user confirmation` when you are in a
  starter-facing reply.

`provider_probe_status=skipped`
