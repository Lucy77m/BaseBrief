# Receiver Example: difference_found

This example shows a completed receiver check where repository state differs from the reviewed handoff config.

`difference_found` means the receiver task completed and reported the difference. It does not mean the agent failed.

In starter-style receiver prose, this would usually be reported as a
human-facing `fail`, while the machine result stays `difference_found` to show
that the acceptance check completed safely and accurately.

Expected report shape:

```text
receiver_task_status: completed
repository_state_status: difference_found
declared_checks_status: skipped
handoff_acceptance: difference_found
missing_expected_files: []
unexpected_files: ["docs/unreviewed-change.md"]
```

Use this outcome when branch, head, or changed files do not match the handoff. The receiver should report the exact difference and wait for the user to decide whether the handoff is still usable.
