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

最近一次真实 provider probe 已运行。测试环境为 Xiaomi MiMo official direct API，模型为 `mimo-v2.5`，环境变量只在当前终端临时注入，未写入仓库文件。

本次 provider 不支持 `/responses` endpoint，探针自动回退到 `/chat/completions`。provider 返回了 `cached_tokens` 指标，脱敏摘要如下：

| variant | phase | prompt_tokens | total_tokens | cached_tokens | latency_ms |
|---|---|---:|---:|---:|---:|
| natural | warmup | 328 | 392 | 320 | 4816 |
| natural | repeat | 329 | 393 | 320 | 7003 |
| cacheReady | warmup | 636 | 700 | 576 | 4177 |
| cacheReady | repeat | 636 | 700 | 576 | 2854 |

这组数据可以说明：

- 该 provider 暴露了 `cached_tokens`。
- 在这组样本中，cache-ready 样例报告了更高的 cached token 绝对值。

这组数据不能说明：

- 真实费用已经下降。
- 真实延迟已经下降。
- 缓存收益在不同 provider、模型、负载或更大样本中稳定成立。

如果未注入 provider 环境变量，发布检查会报告 `provider_probe_status=skipped`。这只是说明当前检查没有执行真实 provider 请求，不会覆盖已保存的脱敏样本。

## 本地真实项目大样本计划

为避免长期停留在小样本冒烟测试，仓库提供 `scripts/provider_cache_benchmark.js`。它会在本地真实项目的只读快照上构造 natural 与 cacheReady 两类 prompt，并用 MiMo `mimo-v2.5` 执行 360 次级别的 benchmark。

公开结论只记录脱敏 summary：

- 项目以 `projectA` / `projectB` / `projectC` 表示
- raw 本地项目细节写入 `tests/outputs/private/`
- API key 只通过临时环境变量传入
- 原项目不写入、不修改

判定重点是 repeat 阶段的 cached token 表现，而不是单次 latency。

解释大样本结果时必须保留两个口径：

- absolute cached tokens：缓存住的 token 绝对数量
- cache ratio：`cachedTokens / promptTokens`

如果 cacheReady 绝对 cached tokens 更高但 cache ratio 更低，结论应写成“稳定前缀缓存量更高”，不要写成“缓存效率或成本已经更优”。

## 缓存比例与成本估算

成本估算使用 MiMo `mimo-v2.5` 在 2026-06-02 北京时间确认的官方直连 API 价格，单位为元人民币 / 1M tokens：

- 输入命中缓存：`0.02`
- 输入未命中缓存：`1`
- 输出：`2`

公式：

```text
uncachedInputTokens = promptTokens - cachedTokens
estimatedTotalCostCny =
  cachedTokens / 1_000_000 * 0.02
  + uncachedInputTokens / 1_000_000 * 1
  + completionTokens / 1_000_000 * 2
```

`scripts/provider_cache_benchmark.js --mode normalized` 会尽量让 natural 和 cacheReady 的 `promptTokens` 接近。只有长度差异不超过 `±5%` 的场景，才纳入 cache ratio 与 estimated cost 胜负统计。

这仍然是估算成本，不是账单审计；它验证的是在当前价格模型下，两种 prompt 结构的理论成本差异。

最新一次 360 请求 benchmark 结果：

| metric | natural | cacheReady |
|---|---:|---:|
| request_count | 180 | 180 |
| valid_request_count | 180 | 180 |
| repeat_request_count | 162 | 162 |
| repeat_median_cached_tokens | 1344 | 1472 |
| repeat_median_cache_ratio | 0.9851 | 0.9837 |
| median_latency_ms | 1723.5 | 1689 |

总体结果：

- 有效请求：`360/360`
- cache 字段可见：`360/360`
- cacheReady 绝对 cached token 胜出：`18/18` 场景
- cacheReady cache ratio 胜出：`0/18` 场景
- 结论等级：`large_sample_evidence`

可写结论：MiMo `mimo-v2.5` 在这组本地真实项目样本中稳定报告更高的 cacheReady 绝对 cached token。  
不可写结论：cacheReady 已证明缓存比例、成本或延迟稳定优于 natural。

最新一次 360 请求 normalized benchmark 结果：

| metric | natural | cacheReady |
|---|---:|---:|
| request_count | 180 | 180 |
| valid_request_count | 180 | 180 |
| repeat_request_count | 162 | 162 |
| repeat_median_cached_tokens | 1472 | 1472 |
| repeat_median_cache_ratio | 0.9755 | 0.9712 |
| repeat_median_estimated_cost_cny | 0.0001266 | 0.0001336 |

总体结果：

- 有效请求：`360/360`
- cache 字段可见：`360/360`
- 长度归一化有效场景：`18/18`
- cacheReady cache ratio 胜出：`4/18` 场景
- cacheReady estimated cost 胜出：`4/18` 场景
- overall cost delta：`+0.000007` 元
- overall cost delta percent：`+5.53%`
- 比例结论：`ratio_not_proven`
- 成本结论：`cost_not_proven`

可写结论：长度归一化后，cacheReady 没有在 MiMo `mimo-v2.5` 当前样本中证明缓存比例或估算成本优势。  
不可写结论：cacheReady 已经比 natural 更省钱。

最近一次 probe 状态已脱敏保存到：

- `tests/outputs/provider-cache-probe.latest.json`
