# Starter Report Outline: missing pass fail

This fixture intentionally omits the human result anchor.

Human anchor: result only

`wait for user confirmation`: yes

```text
receiver_task_status: completed
repository_state_status: match
declared_checks_status: skipped
handoff_acceptance: pass

current_goal:
Show how starter receiver lint catches a missing human result anchor.

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
- none

hard_boundaries:
- wait for user confirmation before implementation

next_narrow_slice:
- restore the human result anchor
```
