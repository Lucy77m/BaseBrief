# Delta Receiver Report Example: pass

This example shows a public-safe Delta Receiver report where a refreshed ignored
local `delta-handoff.md` matches live repository state.

It is a Markdown/text reporting example, not a JSON schema, CLI command output,
runtime integration, provider request, plugin, MCP, IDE flow, or Auto Flow.

```text
receiver_task_status: completed
repository_state_status: match
handoff_acceptance: pass
blocking_or_repair_notes: none

current_goal:
Continue the local Delta Handoff line from the reviewed receiver handoff.

live_repo_state:
- branch: main
- head: refreshed-delta-head
- worktree_changed_files: []

inherited_fact_differences:
- none

hard_boundaries:
- No provider request.
- No runtime integration.
- No plugin, MCP, IDE, hosted, or cloud-memory work.
- No schema-v2 work.
- No raw private output.

next_narrow_slice:
Continue only after the user confirms the next local docs/examples/tests slice.
```

Use this outcome when receiver-window rechecks confirm that live branch, HEAD,
and worktree facts match the refreshed handoff facts.

Historical dry-run `commits_in_range` values may differ from the refreshed local
delta after later commits. That count drift is non-blocking when it is explained
and the refreshed branch, HEAD, and worktree facts match live repository state.

`provider_probe_status=skipped`
