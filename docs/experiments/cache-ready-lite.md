# Cache-ready Lite 实验说明

## 测了什么

本实验只测代理指标：

- 字段顺序是否稳定
- 精确共享前缀是否更长
- 动态尾部变化是否被后置
- 总长度是否受控
- 动态后缀大小是否可观察
- 变化是否主要集中在尾部字段

## 没测什么

- 没测真实费用
- 没测流式首 token 延迟
- 没测不同 provider 的真实命中差异

## 能得出什么结论

如果 `cache-ready` 产物比自然 Lite 样例共享更长的精确前缀，可以说：

- 它更像缓存友好设计
- 它的稳定前缀更可控

当前仓库内这轮公开代理样例的最近一次本地结果是：

- 同项目不同轮次：自然 Lite `70`，Cache-ready `492`
- 跨项目不同任务：自然 Lite `16`，Cache-ready `357`
- 同一基线不同尾部追问：自然 Lite `212`，Cache-ready `1524`

这些数字只说明：

- `cache-ready` 在固定字段顺序和动态尾部后置上更稳定
- 它值得保留为实验模式

此外，扩展版本地探针还会输出：

- `totalLengthChars`
- `dynamicSuffixChars`
- `changedSections`
- `fieldOrderConsistent`
- `missingSectionsByFile`

这轮最新公开样例里还能进一步看到：

- follow-up 动态后缀大小：`42,43`
- follow-up 变化区段：`TAIL_REQUEST`
- 字段顺序一致：`true`
- 缺字段输入会被拒绝：`true`

## 不能得出什么结论

不能说：

- 缓存命中已经提升
- 费用已经下降
- 延迟已经下降

## 真实 provider probe

最近一次真实 provider probe 已运行。测试环境为 OpenAI-compatible provider，模型为 `mimo-v2.5`，环境变量只在当前终端临时注入，未写入仓库文件。

本次 provider 不支持 `/responses` endpoint，探针自动回退到 `/chat/completions`。provider 返回了 `cached_tokens` 指标，脱敏摘要如下：

| variant | phase | prompt_tokens | total_tokens | cached_tokens | latency_ms |
|---|---|---:|---:|---:|---:|
| natural | warmup | 328 | 392 | 320 | 3281 |
| natural | repeat | 329 | 393 | 320 | 1924 |
| cacheReady | warmup | 636 | 700 | 576 | 3119 |
| cacheReady | repeat | 636 | 700 | 576 | 4053 |

这组数据可以说明：

- 该 provider 暴露了 `cached_tokens`。
- 在这组样本中，cache-ready 样例报告了更高的 cached token 绝对值。

这组数据不能说明：

- 真实费用已经下降。
- 真实延迟已经下降。
- 缓存收益在不同 provider、模型、负载或更大样本中稳定成立。

最近一次 probe 状态已脱敏保存到：

- `tests/outputs/provider-cache-probe.latest.json`
