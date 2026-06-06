# Receiver Example: blocked

This example shows a receiver check that cannot run safely.

`blocked` is reserved for invalid config, missing repository state, unsafe paths, or checks that cannot be completed without violating Receiver Safe Check boundaries.

In starter-style receiver prose, this may still surface as a human-facing
`fail`, but the machine result must stay `blocked` so invalid, unsafe, and
impossible-to-run cases are not confused with ordinary differences.

Expected report shape:

```text
receiver_task_status: blocked
repository_state_status: not_applicable
declared_checks_status: blocked
handoff_acceptance: blocked
blocked_reason: declared check path must be repository-relative
```

The receiver should report the blocking reason without attempting a workaround
such as reading sensitive files, executing raw shell commands, or changing the
target repository.
