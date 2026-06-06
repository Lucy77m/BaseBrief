# Receiver Example: language-routing

This example shows how receiver reports apply `response_language: match_latest_user_message`
inside the Sidecar starter acceptance flow.

The latest user's natural-language body chooses the response language. Code, paths, commands, JSON keys, schema names, and status fields stay literal.

The receiver still needs to identify BaseBrief, restate `current_goal` and
`receiver_entry_task`, list at least two risk boundaries, report `pass/fail`,
and wait for user confirmation before any project work.

Expected first sentence in a Chinese receiver window:

```text
我识别到这是 BaseBrief 接力任务；当前工作目录是目标仓库，我会先执行只读接力验收。
```

Expected acceptance cues in the same reply:

```text
BaseBrief: identified
current_goal: repeated
receiver_entry_task: repeated
risk_boundaries:
- No provider request
- No runtime integration
receiver_acceptance_report: pass
wait_for_user_confirmation: yes
```

Expected status fields remain unchanged:

```text
receiver_task_status: completed
repository_state_status: match
declared_checks_status: skipped
handoff_acceptance: pass
```

If the latest user's natural-language body is English, the narration should
switch to English while preserving the same technical literals and the literal
`pass/fail` acceptance anchor.
