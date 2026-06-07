# Delta Receiver Report Example: difference_found

This example shows a public-safe Delta Receiver report where inherited handoff
facts are stale against live repository state.

`difference_found` means the receiver task completed and accurately reported the
difference. It does not mean the agent failed.

It is a Markdown/text reporting example, not a JSON schema, CLI command output,
runtime integration, provider request, plugin, MCP, IDE flow, or Auto Flow.

```text
receiver_task_status: completed
repository_state_status: difference_found
handoff_acceptance: difference_found
blocking_or_repair_notes: inherited handoff HEAD no longer matches live HEAD

current_goal:
Verify the local Delta Handoff state before implementation resumes.

live_repo_state:
- branch: main
- head: live-receiver-head
- worktree_changed_files: []

inherited_fact_differences:
- inherited_head: stale-handoff-head
- live_head: live-receiver-head
- changed_files_match: yes
- blocking: yes, because HEAD mismatch changes the continuation point

hard_boundaries:
- No provider request.
- No runtime integration.
- No plugin, MCP, IDE, hosted, or cloud-memory work.
- No schema-v2 work.
- No raw private output.

next_narrow_slice:
Stop before implementation and ask the user whether to refresh the handoff.
```

Use this outcome when receiver-window rechecks find a branch, HEAD, worktree, or
changed-file mismatch against inherited handoff facts.

Historical dry-run `commits_in_range` drift alone is non-blocking when it is
explained and refreshed branch, HEAD, and worktree facts match live repository
state. This example is blocking because the inherited HEAD itself is stale.

`provider_probe_status=skipped`
