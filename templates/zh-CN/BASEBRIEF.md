# 【项目名称】项目阶段基线

## 0. 文件说明

这是完整阶段基线，不是聊天总结。

本文件应明确区分：

- `verified_facts`
- `confirmed_decisions`
- `assumptions`
- `open_questions`
- `risk_boundaries`
- `receiver_entry_task`
- `post_acceptance_next_action`
- `expected_changed_files`
- `receiver_check_config`
- `receiver_task_status`
- `repository_state_status`
- `declared_checks_status`
- `handoff_acceptance`

交接保存前必须完成 receiver-ready 收口：

- `handoff_status: ready_for_receiver`
- `handoff_protocol_version: receiver-ready-v1`
- `generated_at: 【ISO-8601-with-timezone】`
- `preferred_language: zh-CN`
- `response_language: match_latest_user_message`
- 将“生成交接、检查交接、准备开启新窗口”等事项从“正在进行”移入“已完成”
- 将来源窗口已验证结果标为“来源窗口已验证”
- 接收窗口未重跑的检查不得写成“接收窗口本轮已验证”

---

## 1. 项目身份

| 项 | 内容 |
|---|---|
| 项目名称 | 【填写】 |
| 项目类型 | 【填写】 |
| 当前阶段 | 【填写】 |
| 当前重点 | 【填写】 |
| 主要使用对象 | 【ChatGPT / Codex / Claude / 其他 Agent】 |
| 当前形态 | 【例如：Skill-first + Markdown templates】 |
| handoff_status | `ready_for_receiver` |
| handoff_protocol_version | `receiver-ready-v1` |
| generated_at | `【ISO-8601-with-timezone】` |
| preferred_language | `zh-CN` |
| response_language | `match_latest_user_message` |
| receiver_check_config | `【仓库相对配置路径或 not_applicable】` |

---

## 2. 长期定位

【项目名称】是：

> 【用 1 到 3 句话说明长期定位】

它不是：

- 【不是事项 1】
- 【不是事项 2】
- 【不是事项 3】

---

## 3. 当前阶段

当前处于：**【填写阶段】**

本阶段目标：

- 【目标 1】
- 【目标 2】
- 【目标 3】

本阶段不做：

- 【不做事项 1】
- 【不做事项 2】
- 【不做事项 3】

---

## 4. verified_facts / 已验证事实

只写有依据的事实。

### 4.1 项目事实

- 【事实 1】
- 【事实 2】
- 【事实 3】

### 4.2 路径与版本事实

- 项目路径：`【相对路径或通用路径】`
- 当前分支：`【填写；无仓库则写 不适用】`
- 当前 HEAD：`【填写；未验证则写 待确认】`
- git status：`【填写】`
- 构建状态：`【来源窗口已验证 / 接收窗口本轮已验证 / 未验证；填写结果】`
- 测试状态：`【来源窗口已验证 / 接收窗口本轮已验证 / 未验证；填写结果】`
- 运行方式：`【填写；未验证则写 待确认】`

### 4.3 文件事实

- 【关键文件 1】：【状态 / 用途】
- 【关键文件 2】：【状态 / 用途】
- 【关键文件 3】：【状态 / 用途】

### 4.4 expected_changed_files / 预期变更文件

Git 工作树存在计划内未提交修改时，按稳定顺序精确列出仓库相对路径：

- `【relative/path/one】`
- `【relative/path/two】`

工作树干净或不适用时写：

- `not_applicable`

类别描述只能用于解释，不得替代精确文件清单。接收窗口必须机械比对实际变更列表，并单独报告新增、缺失或意外文件。

### 4.5 receiver_check_config / 可选轻量核验

- `receiver_check_config`: `【仓库相对配置路径或 not_applicable】`
- 默认写 `not_applicable`，接收窗口继续执行 state-only 手动核验。
- 如提供配置，接收窗口运行：`node scripts/basebrief.js receiver-check --config <receiver_check_config> --repo <target-repo> --json`
- `--repo` 由用户在私有启动命令中提供；公开交接不得写私人绝对路径。
- Safe Check 是来源窗口声明的轻量只读核验，不等同于重跑来源窗口完整测试。

---

## 5. confirmed_decisions / 用户已确认决策

### 5.1 已确认采用

- 【确认决策 1】
- 【确认决策 2】
- 【确认决策 3】

### 5.2 已确认暂缓

- 【暂缓事项 1】
- 【暂缓事项 2】
- 【暂缓事项 3】

### 5.3 已确认不做

- 【不做事项 1】
- 【不做事项 2】
- 【不做事项 3】

---

## 6. assumptions / 模型推测

只能写判断、推测和建议，不能冒充事实。

- 【推测 1】
- 【推测 2】
- 【推测 3】

---

## 7. 当前工程状态

### 7.1 已完成

- 【已完成 1】
- 【已完成 2】
- 【已完成 3】

### 7.2 正在进行

- 【仅填写交接保存后仍会继续进行的事项；没有则写 无】

交接保存前，不得继续把“生成交接、检查交接、准备开启新窗口”列为正在进行。

### 7.3 尚未开始

- 【未开始 1】
- 【未开始 2】

---

## 8. risk_boundaries / 风险红线

### 8.1 项目边界

- 【边界 1】
- 【边界 2】

### 8.2 文件 / 配置边界

未经确认，不得修改：

- `【文件或目录 1】`
- `【文件或目录 2】`
- `【文件或目录 3】`

### 8.3 高影响操作

未经确认，不得执行：

- 删除
- 覆盖
- 重构
- 提交 commit
- 部署
- 修改 API key
- 修改运行环境

---

## 9. 未完成事项

- 【未完成事项 1】
- 【未完成事项 2】
- 【未完成事项 3】

---

## 10. 接收任务与验收后动作

- `receiver_entry_task`：**【接收窗口现在必须执行的核验或接手任务】**
- 接收任务期望输出：**【填写】**
- 接收任务停止条件：**【填写】**
- `post_acceptance_next_action`：**【接力验收完成后，项目真正应推进的动作】**

`receiver_entry_task` 不得再次写成“开启新窗口”。接收窗口已经是新窗口时，应直接完成入口任务并报告结果。

接收报告必须给出：

- `receiver_task_status: completed | blocked`
- `repository_state_status: match | difference_found | not_applicable`
- `declared_checks_status: passed | difference_found | skipped | blocked`
- `handoff_acceptance: pass | difference_found | blocked`

语义固定为：

- `pass`：入口任务完成，且仓库状态与交接一致。
- `difference_found`：入口任务正确完成，并准确报告状态差异；这不是 Agent 执行失败。
- `blocked`：无法读取交接、定位目标或完成必要核验。

---

## 11. 新窗口开场白建议

> 【填写新窗口的一段简洁开场说明，强调定位、当前阶段、风险边界和本轮目标】

新窗口开场白必须包含语言路由：

- 用户明确指定语言时优先遵守。
- 否则按用户最新消息的自然语言主体回复，忽略代码、路径、命令和字段名。
- 混合语言且无法判断时使用 `preferred_language`；zh-CN 模板未声明时默认中文。
- Agent 自己生成的第一句、进度说明和最终报告都必须遵守该语言。
- 路径、命令、代码和协议字段保留原文。
- 平台自动显示的工具日志不纳入语言保证。

---

## 12. Agent 任务说明建议

- 角色定位：【填写】
- 任务范围：【填写】
- 不做事项：【填写】
- 必须保护的红线：【填写】

---

## 13. 缓存前缀建议

稳定前缀应优先包含：

- 长期定位
- 当前阶段边界
- 已确认稳定决策
- 低变化风险边界

动态后缀再放：

- 当前任务
- 当轮备注
- 最新时间信息

---

## 14. open_questions / 待确认问题

- 【问题 1】
- 【问题 2】
- 【问题 3】
