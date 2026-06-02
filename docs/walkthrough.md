# BaseBrief Walkthrough

这个 walkthrough 演示一次完整、公开、安全的 BaseBrief 使用流程。

示例项目是一个普通前端展示站。它没有真实 provider 接入，不涉及 `.env`、API key、部署密钥或私有路径。

## 1. 起手

先让 AI 读取 BaseBrief：

```text
请读取 BaseBrief 的 skills/basebrief/SKILL.md。
我接下来要整理一个项目的阶段基线。
请先选择 full / lite / cache-ready，再生成内容。
不要把推测写成事实。
```

## 2. 判断模式

本轮任务：

```text
这个项目刚完成一个展示页阶段。
我需要给下一个窗口准备完整接续说明，并补一个 Agent 任务说明。
```

路由结果：

- 需要完整阶段基线
- 需要新窗口接续
- 需要 Agent 任务说明
- 所以走 `full`

不走 `lite`，因为 lite 只适合短接续。

## 3. 收集事实

AI 应该先检查真实上下文，至少包括：

- README 或项目说明
- 关键入口文件
- 当前 git 状态
- 已确认的目标和不做事项
- 高风险边界

如果不能访问文件，就必须把缺口写进 `open_questions`。

不要写：

```text
项目已经完成部署。
```

除非真的检查到部署状态。

应该写：

```text
部署状态：待确认。
```

## 4. 生成 full 基线

输出应围绕 `templates/zh-CN/BASEBRIEF.md`。

关键区块：

```md
## verified_facts / 已验证事实

- 项目是一个前端展示站。
- 当前任务需要整理阶段基线。
- 本轮不涉及 provider、.env、API key 或部署密钥。

## confirmed_decisions / 用户已确认决策

- 使用 BaseBrief full 模式。
- 需要新窗口开场白。
- 需要 Agent 任务说明。

## assumptions / 模型推测

- 下一轮可能会进入小范围文档或 UI 调整。

## risk_boundaries / 风险红线

- 不读取或输出 .env、token、secret。
- 不擅自改部署配置。
- 不把推测写成事实。

## open_questions / 待确认问题

- 是否需要把本基线保存为仓库文件？
```

## 5. 派生新窗口开场白

如果用户需要接续，可以派生 `NEXT_CHAT_PROMPT.md`：

```text
我们正在继续一个前端展示站项目。
当前阶段是整理阶段基线，不做 provider、.env、API key 或部署改动。
请先读取已有 BaseBrief 基线，再按其中的 verified_facts、confirmed_decisions、risk_boundaries 接续。
如果发现信息不足，列 open_questions，不要猜。
```

## 6. 派生 Agent 任务说明

如果用户要交给下一个 Agent：

```md
## Role

Scoped implementation assistant

## Goal

基于 BaseBrief 阶段基线继续下一步，不扩大范围。

## Allowed Scope

- 读取基线
- 检查指定文件
- 给出下一步建议或小范围修改计划

## Forbidden Scope

- 不读取或输出 .env、token、secret
- 不改 provider、部署、运行环境
- 不重写已确认定位
```

## 7. 什么时候改用 lite

如果下一轮只剩一个很小的接续：

```text
请用 BaseBrief lite 模式。
本轮只读检查一个组件和一个文档文件。
只需要短接续，不要展开完整历史。
```

lite 输出应短，重点是：

- 当前目标
- 已验证事实
- 已确认决策
- 风险边界
- 下一步
- open questions

如果任务突然涉及 backend、provider、`.env`、部署、state、memory、gateway，就停止 lite，升级 full。

## 8. 什么时候用 cache-ready

只有用户明确要做稳定前缀或 prompt cache 实验时才用：

```text
请用 BaseBrief cache-ready 模式。
我要比较稳定前缀下的 cached token 表现。
不要宣称缓存比例、成本或延迟已经稳定胜出。
```

cache-ready 可以表达：

- 稳定前缀更可控
- 固定字段顺序更适合缓存实验
- 在 MiMo `mimo-v2.5` 的本地真实项目样本中，绝对 cached tokens 更高

cache-ready 不能表达：

- 已经证明更省钱
- 已经证明缓存比例更高
- 已经证明延迟稳定下降

## 9. 最终检查

交付前检查：

- `verified_facts` 只写已验证内容
- `confirmed_decisions` 只写用户已确认内容
- `assumptions` 不冒充事实
- `open_questions` 明确列出信息缺口
- `risk_boundaries` 包含 `.env`、API key、token、secret、部署等边界
- 没有私有路径或敏感内容
- 没有把 cache-ready 写成成本优势已证明
