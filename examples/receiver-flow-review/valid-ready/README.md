# Receiver Flow Review Example: Valid Ready

This example shows a reviewed guided draft that can pass `review-draft`.

## Command Shape

```text
node scripts/basebrief.js review-draft --draft draft-context.md --output receiver-ready.md --json
```

## Expected Result

- `handoff_status: ready_for_receiver`
- all six human fields are present
- all six review checklist items are checked
- no `[EMPTY]`, `[NEEDS_REVIEW]`, or `[CANDIDATE]` marker remains

This is a local review gate example. It is not a provider request, not Auto
Flow, and not receiver thread creation.

