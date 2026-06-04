# BaseBrief 新窗口开场白

## 0. 使用说明

本模板用于开启新窗口继续项目。

优先顺序：

1. 长期稳定定位
2. 当前阶段
3. 已确认决策
4. 风险边界
5. 接收窗口入口任务
6. 接力验收后的项目动作

本模板只用于 `handoff_status: ready_for_receiver` 的交接。接收窗口已经是新窗口，不得再次把“开启新窗口”作为下一步。

---

## 1. 接收协议元数据

- `handoff_protocol_version`：`receiver-ready-v1`
- `generated_at`：`【ISO-8601-with-timezone】`
- `preferred_language`：`zh-CN`
- `response_language`：`match_latest_user_message`
- `receiver_check_config`：`【仓库相对配置路径或 not_applicable】`

响应语言规则：

1. 用户明确指定回复语言时优先遵守。
2. 否则按用户最新消息的自然语言主体回复；判断时忽略代码、路径、命令和字段名。
3. 混合语言且无法判断时使用 `preferred_language`；zh-CN 模板未声明时默认中文。
4. Agent 自己生成的第一句、进度说明和最终报告都必须使用选定语言。
5. 路径、命令、代码和协议字段保留原文。
6. 平台自动显示的 `Viewed`、`Ran command` 等工具日志不纳入语言保证。

Agent 自己生成的第一句必须直接使用选定语言确认已经开始接收任务。

---

## 2. 一句话定位

> 【项目名称】是【一句话定位】。它不是【最容易被误解成的东西】。

---

## 3. 当前阶段

- 当前阶段：**【填写】**
- `handoff_status`：`ready_for_receiver`
- `receiver_entry_task`：【接收窗口现在必须完成的核验任务】
- `post_acceptance_next_action`：【接力验收完成后项目真正应推进的动作】
- 本窗口不做：【填写】

---

## 4. confirmed_decisions / 已确认内容

- 【确认项 1】
- 【确认项 2】
- 【确认项 3】

---

## 5. risk_boundaries / 风险边界

- 【边界 1】
- 【边界 2】
- 【边界 3】

---

## 6. expected_changed_files / 预期变更文件

- 【存在计划内未提交修改时，按稳定顺序精确列出仓库相对路径】
- 【工作树干净或不适用时写 `not_applicable`】

接收窗口必须机械比对实际变更清单，并单独报告新增、缺失或意外文件。类别描述不能替代精确清单。

---

## 7. open_questions / 待确认问题

- 【问题 1】
- 【问题 2】

---

## 8. 接收窗口核验要求

接收窗口必须：

1. 报告当前工作目录，并说明它与目标仓库是否一致。
2. 重新检查目标仓库 Git 状态；目标仓库位置由交接文件位置或用户提供的私有启动路径确定。
3. 分开列出“来源窗口已验证”和“接收窗口本轮已验证”；未重跑的测试不得写成本轮验证。
4. 直接执行 `receiver_entry_task`，不得再次建议开启新窗口。
5. 完成入口核验后，给出 `post_acceptance_next_action`。
6. 单独记录本次接力实际发现的摩擦。
7. 输出 `receiver_task_status`、`repository_state_status`、`declared_checks_status` 和 `handoff_acceptance`；未启用 Safe Check 时 `declared_checks_status: skipped`。
8. 若 `receiver_check_config` 不是 `not_applicable`，运行固定命令：`node scripts/basebrief.js receiver-check --config <receiver_check_config> --repo <target-repo> --json`；否则继续 state-only 手动核验。

状态语义：

- `receiver_task_status: completed | blocked`
- `repository_state_status: match | difference_found | not_applicable`
- `declared_checks_status: passed | difference_found | skipped | blocked`
- `handoff_acceptance: pass | difference_found | blocked`
- `difference_found` 表示入口任务正确完成并准确报告差异，不等于 Agent 执行失败。

公开交接文件不得写私人绝对路径。跨工作目录启动时，由用户在私有启动提示中提供目标文件路径。

Safe Check 是来源窗口声明的轻量只读核验，不等同于重跑来源窗口完整测试。Builder、Adapter、Seal/Diff 和普通 BB9 handoff 不自动生成该配置。

---

## 9. 可直接复制的开场白

我们继续推进【项目名称】。

请先按 `response_language: match_latest_user_message` 选择回复语言。第一句、进度说明和最终报告均使用该语言；路径、命令、代码和协议字段保留原文。

项目定位已经确认：

【项目名称】是【一句话定位】。它不是【最容易被误解成的东西】。

当前处于：**【当前阶段】**

交接状态：`ready_for_receiver`

已确认：

- 【确认项 1】
- 【确认项 2】
- 【确认项 3】

风险边界：

- 【边界 1】
- 【边界 2】

本窗口只做：

- 先报告当前工作目录与目标仓库是否一致。
- 重新核验目标仓库状态，并区分来源窗口已验证与接收窗口本轮已验证。
- 机械比对 `expected_changed_files`，报告新增、缺失或意外文件。
- 如已提供 `receiver_check_config`，运行固定 `receiver-check` 命令；否则继续 state-only 手动核验。
- 执行 `receiver_entry_task`：【填写】。
- 单独记录实际接力摩擦。
- 输出 `receiver_task_status`、`repository_state_status`、`declared_checks_status` 和 `handoff_acceptance`。

如果信息不足，请把内容列入 `open_questions`，不要硬编，也不要擅自扩大范围。

入口核验完成后，项目下一步是 `post_acceptance_next_action`：【填写】。不要再次建议开启新窗口。
