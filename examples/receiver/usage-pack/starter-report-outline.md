# Starter Report Outline

Copy and fill this outline when a receiver needs one public-safe starter report
shape that keeps both machine fields and human anchors.

Keep these three layers explicit:

- source-window inherited facts
- live repo facts
- receiver-window rechecks

Human anchor: `pass` or `fail`

`wait for user confirmation`: yes

```text
receiver_task_status: <completed|blocked>
repository_state_status: <match|difference_found|not_applicable>
declared_checks_status: <skipped|pass|blocked>
handoff_acceptance: <pass|difference_found|blocked>
blocking_or_repair_notes: <none or short reason>

current_goal:
<repeat from source-window handoff>

receiver_entry_task:
<repeat from source-window handoff>

risk_boundaries:
- <repeat preserved boundary 1>
- <repeat preserved boundary 2>

source_window_inherited_facts:
- <facts repeated from reviewed handoff or starter>
- <do not rewrite inherited facts as live observations>

live_repo_state:
- branch: <live branch>
- head: <live HEAD>
- worktree_changed_files: <live changed-file list>

receiver_window_rechecks:
- <what this receiver window actually read or reran>
- <keep rechecks separate from inherited facts>

inherited_fact_differences:
- none
- if verification completed and a mismatch was found, explain it here
- historical `commits_in_range` drift alone is non-blocking when refreshed
  branch, HEAD, and worktree facts still match

hard_boundaries:
- No provider request.
- No runtime integration.
- No plugin, MCP, IDE, hosted, or cloud-memory work.
- No schema-v2 work.
- wait for user confirmation before implementation

next_narrow_slice:
- <smallest next step after user confirmation>

actual_handoff_friction:
- <optional starter or golden-path notes>
```

If machine result is `handoff_acceptance: difference_found`, human-facing
`fail` can still be correct because `difference_found` is a completed receiver
outcome, not an execution failure.
