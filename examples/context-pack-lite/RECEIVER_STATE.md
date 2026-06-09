# Receiver State

Review status: needs-review
Source: normalized receiver-state presence checks
Trust: medium
Stale: false

## Current Receiver Contract

- v1.x Delta Receiver line: frozen baseline
- receiver history requirement: not_applicable for repositories without receiver artifacts

## Acceptance State

- Project State: not_available
- Delta baseline: not_available
- Receiver acceptance history: not_applicable
- Missing-input semantics: `not_available`, `not_applicable`, and `needs-review` are review cues, not failure states.

## Lint State

- Receiver lint fixtures and repairs remain part of the frozen v1.x baseline.
- Context Pack Check is a later v2.1 line, not part of this example.

## Known Receiver Limitations

- `.basebrief/state.json`: not_available
- `.basebrief/delta-baseline.json`: not_available
- prior receiver reports: not_applicable

## Receiver Next Action

- Recheck live repo facts before implementation.
- Report `not_available` or `not_applicable` gaps instead of inventing missing history.
- Wait for user confirmation before reopening the frozen v1.x receiver line.
