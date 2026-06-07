# Delta Receiver Report Example: difference warning

This fixture intentionally mentions `difference_found` without the required
semantics explanation.

```text
receiver_task_status: completed
repository_state_status: difference_found
handoff_acceptance: difference_found
blocking_or_repair_notes: live HEAD differed from inherited HEAD

current_goal:
Show how receiver lint reports missing difference_found explanation.

live_repo_state:
- branch: main
- head: public-example-head
- worktree_changed_files: []

inherited_fact_differences:
- inherited HEAD differed from live HEAD

hard_boundaries:
- No provider request.
- No runtime integration.

next_narrow_slice:
Explain the machine result before copying this report.
```
