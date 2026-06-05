# Receiver Flow Example: clean repo draft

This example shows a receiver-flow draft for a clean repository.

The draft is review-only. `handoff_status: draft_needs_review` means a human must review it before sharing or rewriting it into a receiver-ready handoff.

Expected shape:

```text
handoff_status: draft_needs_review
expected_changed_files: []
output_files:
- flow-summary.json
- receiver-check.json
- draft-context.md
```

This is not Auto Flow and does not create a receiver thread, call a provider, or mark the handoff as final.
