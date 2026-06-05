# Receiver Flow Review Example: Rejected Empty

This example shows why guided drafts with empty answers must not pass
`review-draft`.

## Expected Result

```text
review-draft input still contains blocked review markers: [EMPTY]
```

The fix is a human edit, not automatic promotion.

