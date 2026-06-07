# Starter Report Outline: historical drift warning

This fixture intentionally mentions historical `commits_in_range` drift without
the required severity explanation.

Human anchor: `pass` or `fail`

`wait for user confirmation`: yes

```text
receiver_task_status: completed
repository_state_status: match
declared_checks_status: skipped
handoff_acceptance: pass

current_goal:
Show how receiver lint reports missing historical drift explanation.

receiver_entry_task:
Read the reviewed starter handoff before implementation.

risk_boundaries:
- No provider request.
- No runtime integration.

source_window_inherited_facts:
- inherited starter fact only

live_repo_state:
- branch: main
- head: public-example-head

receiver_window_rechecks:
- checked the starter fields

inherited_fact_differences:
- historical `commits_in_range` drift was observed

hard_boundaries:
- wait for user confirmation before implementation

next_narrow_slice:
- explain drift before copying this report
```
