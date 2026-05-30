# BaseBrief

BaseBrief 是一个中文优先、Skill-first、缓存友好的 AI 项目阶段基线工具。

English README: [README.en.md](README.en.md)

对外只有一个入口：`BaseBrief`。  
安装一次，用一个 Skill；内部按任务自动落到 `full`、`lite`、`cache-ready` 三种模式。

## 它适合谁

- 需要跨窗口继续项目的 AI 辅助开发者
- 需要给下一个 Agent 做安全交接的人
- 想把项目状态整理成稳定 Markdown 基线的人

## 它不是什么

- 不是聊天客户端
- 不是完整平台或 Agent runtime
- 不是密钥管理器
- 不是 CLI、Web UI、MCP、VS Code 插件
- 不是用来接入真实 API、provider、部署链路的工具

## 最简单用法

1. 让 AI 读取 `skills/basebrief/SKILL.md`
2. 给出你当前任务
3. 让 BaseBrief 自动选择：
   - `full`：完整阶段基线
   - `lite`：轻量接续
   - `cache-ready`：缓存友好实验

常见输出模板都在 `templates/zh-CN/`。

## 三种模式

### Full

适合：

- 复杂项目阶段总结
- 新窗口开场
- Agent 任务说明
- 风险红线集中整理
- 复杂项目归档

默认会围绕完整 `BASEBRIEF.md` 工作，必要时再派生：

- `NEXT_CHAT_PROMPT.md`
- `AGENT_TASK.md`
- `RISK_NOTES.md`
- `CACHE_PREFIX.md`

### Lite

适合：

- 轻量接续
- 简短交接
- 只读接续
- 1 到 2 个文件的小范围任务说明

Lite 明显短于 Full，不写长历史，不接高风险工程。

### Cache-ready

适合：

- 明确提到 `prompt cache`
- 明确提到 `cache-ready`
- 稳定前缀或缓存代理实验

它是实验模式。  
它只能证明“稳定前缀更可控”或“精确共享前缀更长”，不能宣称真实 `cached_tokens`、费用或延迟收益已经被证明。

## 什么时候不要用 Lite

以下情况不要硬用 Lite，直接走 Full 或先补信息：

- 任务碰 backend、provider、`.env`、API key、部署
- 任务碰 state、memory、gateway、真实 Agent runtime
- 一开始就要跨 3 个以上业务文件
- 边界不清，只能靠猜
- 用户说“帮我整体优化一下”但没给清楚范围

## 当前形态

- Phase 1：Skill-first + Markdown templates
- 暂无 CLI
- 暂无 Web UI
- 暂无 MCP / 插件
- 暂无真实 API 接入

## 安全注意

- 不要把 `.env`、API key、token、secret 写进模板、README 或 Git
- 不要把私人绝对路径写进公开文档
- 不要把 `cache-ready` 写成已证明真实缓存收益

## 仓库结构

```text
BaseBrief/
├─ skills/
│  └─ basebrief/
│     ├─ SKILL.md
│     ├─ agents/openai.yaml
│     └─ modes/
│        ├─ full.md
│        ├─ lite.md
│        └─ cache-ready.md
├─ templates/
│  └─ zh-CN/
│     ├─ BASEBRIEF.md
│     ├─ BASEBRIEF_LITE.md
│     ├─ NEXT_CHAT_PROMPT.md
│     ├─ AGENT_TASK.md
│     ├─ RISK_NOTES.md
│     ├─ CACHE_PREFIX.md
│     └─ CACHE_READY_LITE_INPUT.json
├─ docs/
│  ├─ usage.md
│  ├─ mode-selection.md
│  ├─ testing.md
│  └─ experiments/cache-ready-lite.md
└─ scripts/
   ├─ mode_router.js
   ├─ generate_cache_ready_lite.js
   ├─ prompt_stability_probe.js
   └─ run_release_checks.js
```

## 文档入口

- 使用示例：[docs/usage.md](docs/usage.md)
- 模式选择：[docs/mode-selection.md](docs/mode-selection.md)
- 测试矩阵：[docs/testing.md](docs/testing.md)
- Cache-ready 实验说明：[docs/experiments/cache-ready-lite.md](docs/experiments/cache-ready-lite.md)
- 公开示例：[examples](examples)
