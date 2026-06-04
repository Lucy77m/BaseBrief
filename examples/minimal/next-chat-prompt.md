# 下一窗口开场白

请先读取同目录下的 `output-basebrief-lite.md`。

`handoff_status: ready_for_receiver`

`handoff_protocol_version: receiver-ready-v1`

`preferred_language: zh-CN`

`response_language: match_latest_user_message`

`receiver_check_config: not_applicable`

请按用户最新消息的自然语言主体回复；判断时忽略路径、命令、代码和字段名。你自己生成的第一句、进度说明和最终报告都使用选定语言，技术内容保持原文。

`receiver_entry_task`：

- 先报告当前工作目录与目标仓库是否一致。
- 确认当前文件状态，并区分来源窗口已验证与接收窗口本轮已验证。
- 机械比对 `expected_changed_files`；如有差异，报告新增、缺失或意外文件。
- `receiver_check_config` 不是 `not_applicable` 时运行固定 `receiver-check` 命令；本示例未启用，继续 state-only 手动核验。
- 单独记录实际接力摩擦。

`post_acceptance_next_action`：

- 检查移动端导航间距；不修改页面文案、构建配置或部署配置。

直接执行入口任务，不要再次建议开启新窗口。如果发现任务范围或事实已经变化，先列入 open questions，不要直接扩大修改范围。

最后输出：

- `receiver_task_status: completed | blocked`
- `repository_state_status: match | difference_found | not_applicable`
- `declared_checks_status: skipped`
- `handoff_acceptance: pass | difference_found | blocked`
