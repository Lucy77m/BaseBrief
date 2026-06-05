# Receiver Flow Example: dirty repo draft

This example shows a receiver-flow draft for a repository with reviewed local changes.

Dirty state is not a failure. The important requirement is a stable, sorted `expected_changed_files` list that a receiver can compare mechanically.

Expected shape:

```text
handoff_status: draft_needs_review
expected_changed_files:
- docs/safe.md
- new.txt
```

The draft still needs human review before it can become receiver-ready.
