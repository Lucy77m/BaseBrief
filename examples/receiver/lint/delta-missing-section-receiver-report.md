# Delta Receiver Report Example: missing section

This fixture intentionally omits `live_repo_state`.

```text
receiver_task_status: completed
repository_state_status: match
handoff_acceptance: pass
blocking_or_repair_notes: none

current_goal:
Show how receiver lint reports a missing Delta report section.

inherited_fact_differences:
- none

hard_boundaries:
- No provider request.
- No runtime integration.

next_narrow_slice:
Add `live_repo_state` before copying this shape into a real receiver report.
```
