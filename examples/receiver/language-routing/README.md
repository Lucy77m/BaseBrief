# Receiver Example: language-routing

This example shows how receiver reports apply `response_language: match_latest_user_message`.

The latest user's natural-language body chooses the response language. Code, paths, commands, JSON keys, schema names, and status fields stay literal.

Expected first sentence in a Chinese receiver window:

```text
当前工作目录是目标仓库；我会先执行只读接力验收，而不是直接开始改代码。
```

Expected status fields remain unchanged:

```text
receiver_task_status: completed
repository_state_status: match
declared_checks_status: skipped
handoff_acceptance: pass
```

If the latest user's natural-language body is English, the narration should switch to English while preserving the same technical literals.
