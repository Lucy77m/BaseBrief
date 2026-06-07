# Starter Report Outline: missing fact layer

This fixture intentionally omits `receiver_window_rechecks`.

Human anchor: `pass` or `fail`

`wait for user confirmation`: yes

```text
receiver_task_status: completed
repository_state_status: match
declared_checks_status: skipped
handoff_acceptance: pass

current_goal:
Show how starter receiver lint catches missing fact-layer separation.

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

inherited_fact_differences:
- none

hard_boundaries:
- wait for user confirmation before implementation

next_narrow_slice:
- add receiver_window_rechecks before copying this report
```
