# Delta Receiver Report Example: fixed repair

This fixture is a fixed Delta Receiver report for receiver lint repair.

```text
receiver_task_status: completed
repository_state_status: difference_found
handoff_acceptance: difference_found
blocking_or_repair_notes: live HEAD differed from inherited HEAD

current_goal:
Show the repaired Delta receiver report shape.

live_repo_state:
- branch: main
- head: public-example-head
- worktree_changed_files: []

inherited_fact_differences:
- inherited HEAD differed from live HEAD
- difference_found is a completed verification result, not an agent failure
- historical `commits_in_range` drift remains non-blocking when refreshed
  branch, HEAD, and worktree facts still match

hard_boundaries:
- No provider request.
- No runtime integration.
- No plugin, MCP, IDE, hosted, or cloud-memory work.
- No schema-v2 work.

next_narrow_slice:
Report the mismatch and wait for user confirmation before implementation.
```
