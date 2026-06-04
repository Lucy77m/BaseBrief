# Receiver Safe Check v1

Receiver Safe Check 是可选、显式启用、零依赖的本地接收核验。它在接收窗口中机械比对目标仓库状态，并按来源窗口声明运行少量只读检查。

它不是 BB9 handoff 字段，不由 Builder、Adapter、Seal/Diff 自动生成，也不等同于重跑来源窗口的完整测试。

## 使用

来源窗口准备公开安全的仓库相对配置路径，用户在私有启动命令中提供目标仓库：

```text
node scripts/basebrief.js receiver-check --config <receiver-check-config.json> --repo <target-repo> --json
```

也可以直接运行独立脚本：

```text
node scripts/basebrief_receiver_check.js --config <receiver-check-config.json> --repo <target-repo> --json
```

公开示例见 [`examples/receiver-check-config.json`](../examples/receiver-check-config.json)。示例中的 branch 和 HEAD 是占位值，直接对其他仓库运行通常会得到 `difference_found`。

## 配置契约

`schemas/basebrief-receiver-check.schema.json` 定义独立的 `basebrief-receiver-check-v1` 配置：

- `expected_branch`
- `expected_head`
- 稳定排序且唯一的 `expected_changed_files`
- 可选 `declared_checks`

首版只允许：

- `node_syntax`：对单个 `.js`、`.cjs` 或 `.mjs` 文件运行 `node --check`
- `artifact_check`：直接调用现有 Artifact Checker 检查单个 `.md`、`.json` 或 `.txt` 文件
- `file_tokens`：只报告缺失 token 数量，不输出文件内容

配置不得包含目标仓库绝对路径。`--repo` 由用户在私有启动命令中提供。

## 结果与退出码

`schemas/basebrief-receiver-check-result.schema.json` 定义 `basebrief-receiver-check-result-v1` 结果：

- `receiver_task_status`
- `repository_state_status`
- `declared_checks_status`
- `handoff_acceptance`

固定语义：

- `pass`：仓库状态匹配，声明检查通过或未声明。
- `difference_found`：核验已完成，并准确报告仓库状态或声明检查差异。
- `blocked`：配置无效、目标仓库不可定位，或必要核验无法安全执行。

`pass` 与 `difference_found` 退出码均为 `0`。只有 `blocked` 或无效调用退出非零。

## 安全边界

- 不接受原始 Shell 命令、自定义参数或自定义环境变量。
- 不发起 provider 请求；声明检查不得读取 `.env`、`.env.*` 或 `.git/**`，仓库状态只通过固定 Git 命令读取。
- 所有声明检查路径必须是仓库相对路径；绝对路径、`..` 和 symlink 越界会阻塞。
- Safe Check 在检查前后重新读取 Git 状态；若检查改变目标仓库状态，结果为 `blocked`。
- Safe Check 只提供轻量来源声明核验，不提供文件内容完整性、运行时行为或完整测试证明。
