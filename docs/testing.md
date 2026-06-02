# BaseBrief 测试矩阵

## 命令

使用 Node 运行：

```text
node scripts/run_release_checks.js
```

独立逻辑测试：

```text
node --test tests/basebrief.test.js
```

如需真实 provider 缓存测试框架：

```text
node scripts/provider_cache_probe.js --output tests/outputs/provider-cache-probe.latest.json
```

真实 provider probe 需要临时注入 `BASEBRIEF_PROVIDER_BASE_URL`、`BASEBRIEF_PROVIDER_MODEL`、`BASEBRIEF_PROVIDER_NAME` 和 provider key。key 只放在当前进程环境变量中，不写入仓库文件。

如需 MiMo 本地真实项目大样本 benchmark：

```text
node scripts/provider_cache_benchmark.js --local-projects --output tests/outputs/private/provider-cache-benchmark.raw.json
```

大样本 benchmark 额外需要临时注入 `BASEBRIEF_BENCHMARK_PROJECTS`，用分号分隔本地项目路径。raw 输出写入 `tests/outputs/private/`，该目录被 `.gitignore` 忽略；公开结果只写入 `tests/outputs/provider-cache-benchmark.latest.json`。

如需缓存比例与估算成本的长度归一化 benchmark：

```text
node scripts/provider_cache_benchmark.js --local-projects --mode normalized --output tests/outputs/private/provider-cache-benchmark-normalized.raw.json
```

normalized 模式的公开结果默认写入 `tests/outputs/provider-cache-benchmark-normalized.latest.json`。

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
| J | 独立逻辑测试 | 路由、cache-ready 生成器、模板关键字段有实质断言 |
| K | 大样本 benchmark | 普通 release check 不触发 API；若公开 summary 存在，则验证脱敏结构和结论等级 |
| L | 成本估算 | 按 MiMo `mimo-v2.5` 价格模型计算 cached input、uncached input 与 output 的估算成本 |

## 当前发布准备结论

本轮发布准备要求的是：

- 一个公开 Skill 入口
- 三模式并存
- Lite 不膨胀
- Cache-ready 不夸大
- 无私有路径与临时污染

最新本地 release check 和独立测试通过后，才可视为发布准备完成。

## 最新一次本地结果

最近一次注入 MiMo provider 环境变量后运行 `node scripts/run_release_checks.js` 已通过，关键结果为：

- 模式路由用例：`11` 条通过
- 安全扫描文件数：`49`
- 相对链接检查：`18` 条有效
- 公开示例文件：`12` 个存在
- 独立测试文件：`1` 个通过
- provider probe 状态：**已运行，provider 暴露 `cached_tokens` 指标**
- benchmark summary 状态：`absolute:large_sample_evidence,normalized:normalized_inconclusive`
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

如果未注入 provider 环境变量，`run_release_checks.js` 会明确报告 `provider_probe_status=skipped`；这不等同于真实 provider probe 失败。

## 本地真实项目大样本 benchmark

`provider_cache_benchmark.js` 用于 MiMo 专用大样本测试。默认目标是：

- 3 个本地真实项目
- 6 类 BaseBrief 场景
- natural / cacheReady 两种写法
- 每种写法 10 次请求
- 合计 360 次请求

主结论只看缓存指标：

- repeat median `cachedTokens`
- repeat median `cacheRatio`
- cacheReady 胜过 natural 的场景数
- cache 字段可见率

latency 只记录，不作为主胜负依据。公开文档只能写成“MiMo `mimo-v2.5` + 当前本地真实项目样本下的证据”，不能写成跨 provider、跨模型或费用/延迟稳定下降的通用结论。

解释结果时必须同时看 `cachedTokens` 和 `cacheRatio`。如果 cacheReady 的绝对 cached tokens 更高，但 cache ratio 更低，只能说明它稳定缓存了更多前缀内容，不能说明 token 使用效率或成本一定更好。

### MiMo 价格模型

本仓库成本估算使用 2026-06-02 北京时间确认的 MiMo `mimo-v2.5` 官方直连 API 价格，单位为元人民币 / 1M tokens：

- 输入命中缓存：`0.02`
- 输入未命中缓存：`1`
- 输出：`2`

估算公式：

```text
uncachedInputTokens = promptTokens - cachedTokens
estimatedInputHitCostCny = cachedTokens / 1_000_000 * 0.02
estimatedInputMissCostCny = uncachedInputTokens / 1_000_000 * 1
estimatedOutputCostCny = completionTokens / 1_000_000 * 2
estimatedTotalCostCny = hit + miss + output
```

这是按 token usage 与价格表推导的估算成本，不是 provider 账单扣费审计。除非 provider 返回逐请求真实扣费字段，否则不能写成真实扣费证明。

### Normalized 判定标准

normalized 模式只在 prompt 长度差异不超过 `±5%` 的场景里比较比例和成本：

- 有效请求数至少 `324/360`
- cache 字段可见率至少 `95%`
- 长度归一化有效场景至少 `15/18`
- cacheReady cache ratio 胜出至少 `15/18`，才可说比例胜出
- cacheReady estimated cost 胜出至少 `15/18`，且总体 median estimated cost 至少低 `5%`，才可说估算成本胜出

最新一次本地真实项目 benchmark 已完成：

- 请求数：`360`
- 有效请求数：`360`
- cache 字段可见率：`100%`
- cacheReady 绝对 cached token 胜出场景：`18/18`
- cacheReady cache ratio 胜出场景：`0/18`
- natural repeat median cached tokens：`1344`
- cacheReady repeat median cached tokens：`1472`
- natural repeat median cache ratio：`0.9851`
- cacheReady repeat median cache ratio：`0.9837`
- conclusion level：`large_sample_evidence`

这组结果支持的结论是：在 MiMo `mimo-v2.5` + 当前 3 个本地真实项目 × 6 类场景下，cacheReady 稳定缓存了更多绝对 token；但它没有提升缓存比例，因此不能把结果写成 token 使用效率或成本已经更优。

最新一次 normalized benchmark 也已完成：

- 请求数：`360`
- 有效请求数：`360`
- cache 字段可见率：`100%`
- 长度归一化有效场景：`18/18`
- cacheReady cache ratio 胜出场景：`4/18`
- cacheReady estimated cost 胜出场景：`4/18`
- natural repeat median cache ratio：`0.9755`
- cacheReady repeat median cache ratio：`0.9712`
- natural repeat median estimated cost：`0.0001266` 元
- cacheReady repeat median estimated cost：`0.0001336` 元
- overall cost delta：`+0.000007` 元
- overall cost delta percent：`+5.53%`
- ratio conclusion level：`ratio_not_proven`
- cost conclusion level：`cost_not_proven`

这组 normalized 结果支持的结论是：在长度已归一化的真实项目样本下，cacheReady 没有证明缓存比例优势，也没有证明估算成本优势；按当前价格模型，median estimated cost 反而略高。

## 真实 provider 测试结论

最近一次真实 provider probe 已运行。测试环境为 Xiaomi MiMo official direct API，模型为 `mimo-v2.5`，环境变量只在当前终端临时注入，未写入仓库文件。

本次 provider 不支持 `/responses` endpoint，探针自动回退到 `/chat/completions`。provider 返回了 `cached_tokens` 指标，脱敏摘要如下：

| variant | phase | endpoint | prompt_tokens | completion_tokens | total_tokens | cached_tokens | latency_ms |
|---|---|---|---:|---:|---:|---:|---:|
| natural | warmup | chat/completions | 328 | 64 | 392 | 320 | 4816 |
| natural | repeat | chat/completions | 329 | 64 | 393 | 320 | 7003 |
| cacheReady | warmup | chat/completions | 636 | 64 | 700 | 576 | 4177 |
| cacheReady | repeat | chat/completions | 636 | 64 | 700 | 576 | 2854 |

样本限制：

- 只覆盖一个 provider、一个模型、四次请求，不能代表所有负载。
- 未测流式首 token 延迟，`firstTokenLatencyMs` 为 `null`。
- 本次数据说明 provider 暴露了 `cached_tokens`，且 cache-ready 样例在该样本中报告了更高的 cached token 绝对值；不能据此声称费用或延迟已经稳定下降。

最近一次 probe 状态已脱敏保存到：

- `tests/outputs/provider-cache-probe.latest.json`
- BB2 capsule benchmark command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode capsule --output tests/outputs/private/provider-cache-benchmark-capsule.raw.json
```

Capsule mode compares `natural`, `cacheReady`, and `capsuleV2`. With the default 3 projects x 6 scenarios x 3 variants x 10 repeats, it runs 540 requests. Public summary output is `tests/outputs/provider-cache-benchmark-capsule.latest.json`.

Capsule cost wording remains gated: 12/18 wins plus at least 3% lower median estimated cost is only an initial signal; 15/18 wins plus at least 5% lower median estimated cost is the stronger MiMo local real-project evidence threshold.

Latest capsule benchmark result:

- request count: `540`
- valid request count: `540`
- cache field visibility: `539/540`
- capsuleV2 cache ratio wins: `6/18`
- capsuleV2 estimated cost wins: `10/18`
- capsuleV2 median cache ratio: `0.9552`
- capsuleV2 median estimated cost: `0.0001122` CNY
- capsuleV2 overall cost delta percent vs natural: `+2.37%`
- conclusion level: `capsule_inconclusive`

This supports only a format/length finding, not a cost or cache-ratio win.

BB3 anchor benchmark command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode anchor --output tests/outputs/private/provider-cache-benchmark-anchor.raw.json
```

Anchor mode compares `natural`, `cacheReady`, `capsuleV2`, and `anchorV3`. With the default 3 projects x 6 scenarios x 4 variants x 10 repeats, it runs 720 requests.

BB4 anchor-pad benchmark command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode anchorpad --output tests/outputs/private/provider-cache-benchmark-anchorpad.raw.json
```

Latest anchor-pad benchmark result:

- request count: `900`
- valid request count: `897`
- cache field visibility: `897/897`
- anchorPadV4 cache ratio wins: `10/18`
- anchorPadV4 estimated cost wins: `16/18`
- anchorPadV4 median cache ratio: `0.9808`
- anchorPadV4 median estimated cost: `0.00009354` CNY
- anchorPadV4 overall cost delta percent vs natural: `-14.65%`
- conclusion level: `anchorpad_cost_large_sample_evidence`

This supports a MiMo `mimo-v2.5` local real-project estimated-cost advantage for BB4 anchor-pad. It does not prove cross-provider savings.

BB4 PAD sweep command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode padSweep --output tests/outputs/private/provider-cache-benchmark-padsweep.raw.json
```

Smoke command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode padSweep --repeat-count 2 --project-limit 1 --scenario-limit 2 --output tests/outputs/private/provider-cache-benchmark-padsweep-smoke.raw.json --summary-output tests/outputs/provider-cache-benchmark-padsweep-smoke.latest.json
```

PAD sweep compares `anchorPad4`, `anchorPad8`, `anchorPad16`, `anchorPad32`, and `anchorPad64`. `anchorPad8` is the BB4 baseline. A different PAD length is only a BB5 candidate if it beats `anchorPad8` on estimated cost in at least `12/18` project-scenario pairs and lowers overall median estimated cost by at least `5%`.

DeepSeek `deepseek-v4-flash` can be tested through the same script after temporarily setting provider env vars. Its price profile uses the same 2026-06-02 CNY per 1M tokens values as MiMo in this repository: input cache hit `0.02`, input cache miss `1`, output `2`. Do not write provider keys into repository files.

Latest MiMo pad sweep result:

- request count: `900`
- valid request count: `900`
- cache field visibility: `900/900`
- best cost delta vs anchorPad8 by wins: `anchorPad4`, `18/18`, `-3.65%`
- conclusion level: `pad_sweep_no_better_candidate`

Latest DeepSeek pad sweep result:

- request count: `900`
- valid request count: `900`
- cache field visibility: `900/900`
- best cost delta vs anchorPad8 by wins: `anchorPad4`, `18/18`, `-2.05%`
- conclusion level: `pad_sweep_no_better_candidate`

## Readable Full/Lite POC benchmark

Readable POC command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode readablePoc --output tests/outputs/private/provider-cache-benchmark-readable-poc.raw.json
```

Smoke command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode readablePoc --repeat-count 2 --project-limit 1 --scenario-limit 2 --output tests/outputs/private/provider-cache-benchmark-readable-poc-smoke.raw.json --summary-output tests/outputs/provider-cache-benchmark-readable-poc-smoke.latest.json
```

`readablePoc` compares `natural`, `readableFull`, `readableFullPad4`, `readableLite`, and `readableLitePad4`. The padded variants use the hidden Markdown comment `<!-- BASEBRIEF_CACHE_PAD: p p p p -->` before the dynamic tail request.

Readable Markdown cost evidence requires `>= 15/18` estimated-cost wins against the matching non-padded readable baseline and at least `5%` lower overall median estimated cost. Anything below that stays POC-only.

Latest MiMo readable POC result:

- request count: `900`
- valid request count: `900`
- cache field visibility: `900/900`
- `readableFullPad4`: `6/18` estimated-cost wins, `-0.04%` overall estimated-cost delta
- `readableLitePad4`: `5/18` estimated-cost wins, `-7.04%` overall estimated-cost delta
- conclusion level: `readable_poc_inconclusive`

Latest DeepSeek readable POC result:

- request count: `900`
- valid request count: `900`
- cache field visibility: `900/900`
- `readableFullPad4`: `0/18` estimated-cost wins, `+10.56%` overall estimated-cost delta
- `readableLitePad4`: `0/18` estimated-cost wins, `+15.04%` overall estimated-cost delta
- conclusion level: `readable_poc_inconclusive`
