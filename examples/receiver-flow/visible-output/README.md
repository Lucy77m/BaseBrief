# Receiver Flow Example: visible output draft

This example shows a receiver-flow draft when the output directory is inside the target repository and visible to Git.

In this case the generated files are included in `expected_changed_files` so a receiver can distinguish reviewed draft outputs from unexpected files.

Expected shape:

```text
handoff_status: draft_needs_review
expected_changed_files:
- flow/draft-context.md
- flow/flow-summary.json
- flow/receiver-check.json
```

Ignored output directories stay out of the manifest. Visible output is still draft output, not a final receiver-ready handoff.
