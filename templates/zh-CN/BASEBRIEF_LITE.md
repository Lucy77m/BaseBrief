# 【项目名称】Lite 接续基线

## 0. 使用说明

这是轻量接续模板，只用于：

- 简短交接
- 只读接续
- 1 到 2 个文件的小范围任务说明

如果任务碰 backend、provider、`.env`、部署、state、memory、gateway，或一开始就跨 3 个以上业务文件，停止使用本模板并升级 Full。

交接保存前必须满足：

- `handoff_status: ready_for_receiver`
- `handoff_protocol_version: receiver-ready-v1`
- `generated_at: 【ISO-8601-with-timezone】`
- `preferred_language: zh-CN`
- `response_language: match_latest_user_message`
- `receiver_check_config: 【仓库相对配置路径或 not_applicable】`
- 来源窗口验证结果明确标注为“来源窗口已验证”
- 接收窗口未重跑的检查不得写成“接收窗口本轮已验证”

---

## 1. 项目定位

> 【项目名称】是【一句话定位】。它不是【最容易被误解成的东西】。

---

## 2. 当前目标

- 当前阶段：**【填写】**
- 本轮目标：**【填写】**
- 本轮不做：**【填写】**
- `handoff_status`：`ready_for_receiver`
- `handoff_protocol_version`：`receiver-ready-v1`
- `generated_at`：`【ISO-8601-with-timezone】`
- `preferred_language`：`zh-CN`
- `response_language`：`match_latest_user_message`
- `receiver_check_config`：`【仓库相对配置路径或 not_applicable】`

---

## 3. verified_facts / 已验证事实

- 【事实 1】
- 【事实 2】
- 【事实 3】
- 【事实 4】

---

## 4. confirmed_decisions / 用户已确认决策

- 【确认决策 1】
- 【确认决策 2】
- 【确认决策 3】

---

## 5. assumptions / 模型推测

- 【推测 1】
- 【推测 2】

---

## 6. risk_boundaries / 风险边界

- 允许范围：【填写】
- 不得修改：【填写】
- 不得擅自进入：【填写】
- 超界即停：【填写】

---

## 7. 接收任务与验收后动作

- `receiver_entry_task`：**【接收窗口现在必须执行的核验或接手任务】**
- 接收任务期望输出：**【填写】**
- `post_acceptance_next_action`：**【接力验收完成后，项目真正应推进的动作】**

接收窗口已经开始后，不得再次把“开启新窗口”作为下一步。

接收报告必须输出：

- `receiver_task_status: completed | blocked`
- `repository_state_status: match | difference_found | not_applicable`
- `declared_checks_status: passed | difference_found | skipped | blocked`
- `handoff_acceptance: pass | difference_found | blocked`

`difference_found` 表示接收任务正确完成并准确报告差异，不等于 Agent 执行失败。

---

## 8. expected_changed_files / 预期变更文件

- 工作树存在计划内未提交修改时，按稳定顺序精确列出仓库相对路径。
- 工作树干净或不适用时写 `not_applicable`。
- 接收窗口必须机械比对实际清单，并报告新增、缺失或意外文件。

---

## 9. 响应语言

- 用户明确指定语言时优先遵守。
- 否则按用户最新消息的自然语言主体回复，忽略代码、路径、命令和字段名。
- 混合语言且无法判断时使用 `preferred_language`；本 zh-CN 模板默认中文。
- Agent 自己生成的第一句、进度说明和最终报告均遵守该语言。
- 路径、命令、代码和协议字段保留原文；平台自动工具日志不纳入语言保证。

---

## 10. 可选 Receiver Safe Check

- 默认 `receiver_check_config: not_applicable`，继续执行 state-only 手动核验。
- 如提供仓库相对配置路径，运行：`node scripts/basebrief.js receiver-check --config <receiver_check_config> --repo <target-repo> --json`
- Safe Check 是来源窗口声明的轻量只读核验，不等同于重跑来源窗口完整测试。

---

## 11. open_questions / 待确认问题

- 【问题 1】
- 【问题 2】
