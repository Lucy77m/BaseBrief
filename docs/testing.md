# BaseBrief 测试矩阵

## 命令

使用 Node 运行：

```text
node scripts/run_release_checks.js
```

如需真实 provider 缓存测试框架：

```text
node scripts/provider_cache_probe.js --output tests/outputs/provider-cache-probe.latest.json
```

## 测试矩阵

| 编号 | 类型 | 通过标准 |
|---|---|---|
| A | Full 正向 | 复杂项目阶段总结应路由到 `full` |
| B | Lite 正向 | 1 到 2 文件小范围接续应路由到 `lite` |
| C | Lite 负向 | `.env`、真实 API provider、backend+frontend+deploy、state/memory/gateway、边界不清等场景不得继续用 `lite` |
| D | Cache-ready | 多次相似输入保持字段顺序稳定，共享前缀比自然 Lite 样例更稳定 |
| E | Provider probe | 若未提供环境变量，则明确标记为 skipped；若提供，则记录真实 provider 指标可见性 |
| F | 安全扫描 | 无密钥、无 `.env` 文件、无私人绝对路径、无 `node_modules` / `dist` / 缓存污染 |
| G | 链接检查 | README / docs / Skill / 模板中的相对链接有效 |
| H | 发布示例 | Full / Lite / Cache-ready / Next-chat / Agent-task 公开示例存在 |
| I | 英文 README | `README.en.md` 存在，且说明单入口三模式 |

## 当前发布准备结论

本轮发布准备要求的是：

- 一个公开 Skill 入口
- 三模式并存
- Lite 不膨胀
- Cache-ready 不夸大
- 无私有路径与临时污染

最新本地 release check 通过后，才可视为发布准备完成。

## 最新一次本地结果

最近一次 `node scripts/run_release_checks.js` 已通过，关键结果为：

- 模式路由用例：`11` 条通过
- 安全扫描文件数：`44`
- 相对链接检查：`18` 条有效
- 公开示例文件：`6` 个存在
- provider probe 状态：**已运行，provider 暴露 `cached_tokens` 指标**
- `cache-ready` 同项目不同轮次共享前缀：`492`
- 自然 Lite 同项目不同轮次共享前缀：`70`
- `cache-ready` 跨项目共享前缀：`357`
- 自然 Lite 跨项目共享前缀：`16`
- `cache-ready` 同一基线不同尾部追问共享前缀：`1524`
- 自然 Lite 同一基线不同尾部追问共享前缀：`212`
- follow-up 动态后缀大小：`42,43`
- follow-up 变化区段：`TAIL_REQUEST`
- cache-ready 字段顺序一致：`true`
- cache-ready 缺字段输入拒绝：`true`

## 真实 provider 测试结论

最近一次真实 provider probe 已运行。测试环境为 OpenAI-compatible provider，模型为 `mimo-v2.5`，环境变量只在当前终端临时注入，未写入仓库文件。

本次 provider 不支持 `/responses` endpoint，探针自动回退到 `/chat/completions`。provider 返回了 `cached_tokens` 指标，脱敏摘要如下：

| variant | phase | endpoint | prompt_tokens | completion_tokens | total_tokens | cached_tokens | latency_ms |
|---|---|---|---:|---:|---:|---:|---:|
| natural | warmup | chat/completions | 328 | 64 | 392 | 320 | 3281 |
| natural | repeat | chat/completions | 329 | 64 | 393 | 320 | 1924 |
| cacheReady | warmup | chat/completions | 636 | 64 | 700 | 576 | 3119 |
| cacheReady | repeat | chat/completions | 636 | 64 | 700 | 576 | 4053 |

样本限制：

- 只覆盖一个 provider、一个模型、四次请求。
- 未测流式首 token 延迟，`firstTokenLatencyMs` 为 `null`。
- 本次数据只能说明 provider 暴露了 `cached_tokens`，且 cache-ready 样例在该样本中报告了更高的 cached token 绝对值；不能据此声称费用或延迟已经稳定下降。

最近一次 probe 状态已脱敏保存到：

- `tests/outputs/provider-cache-probe.latest.json`
