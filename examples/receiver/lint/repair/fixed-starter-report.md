# Starter Report Outline: fixed repair

This fixture is a fixed starter-style receiver report for receiver lint repair.

Human anchor: `pass` or `fail`

`wait for user confirmation`: yes

```text
receiver_task_status: completed
repository_state_status: match
declared_checks_status: skipped
handoff_acceptance: pass

current_goal:
Show the repaired starter receiver report shape.

receiver_entry_task:
Read the reviewed starter handoff before implementation.

risk_boundaries:
- No provider request.
- No runtime integration.

source_window_inherited_facts:
- inherited starter fact only
- do not rewrite inherited facts as live observations

live_repo_state:
- branch: main
- head: public-example-head
- worktree_changed_files: []

receiver_window_rechecks:
- checked the starter fields
- kept receiver-window rechecks separate from inherited facts

inherited_fact_differences:
- none
- historical `commits_in_range` drift remains non-blocking when refreshed
  branch, HEAD, and worktree facts still match
- if verification completed and a mismatch was found, difference_found is a
  completed verification result, not an agent failure

hard_boundaries:
- wait for user confirmation before implementation
- No provider request.
- No runtime integration.

next_narrow_slice:
- continue only after the user confirms the repaired receiver report
```
