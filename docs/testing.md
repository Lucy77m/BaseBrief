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

本地快捷入口：

```text
npm test
npm run release-check
npm run check
```

这些 npm scripts 只包装上面的本地 Node 命令；它们不表示 BaseBrief 已成为发布 npm package 或安装式 CLI。

## v0.4.1 Stabilization Candidate

`v0.4.1` is a stabilization-only cycle after the `v0.4.0` public release. It uses
[the v0.4.x test matrix](testing-v0.4.x-test-matrix.md) and
[the v0.4.0 post-release baseline](baselines/v0.4.0-post-release-baseline.md)
to keep scale testing public-safe.

This cycle may add checker rules, edge tests, local sandbox summaries, and docs fixes.
It does not add `receiver-flow --guided`, `receiver-flow --extract`, `review-draft`,
`.basebrief/`, Auto Flow, Web UI, adapter expansion, provider requests, provider
benchmark claims, npm publishing, push, tag, or formal release.

Expected release-check output without provider env remains:

```text
provider_probe_status=skipped
```

## Receiver 测试额度

Receiver-ready 验证默认采用低额度策略：

- 普通文档和静态契约改动只运行本地自动检查，不创建 Codex 接收线程。
- 只有 Receiver 行为发生变化，且静态检查无法验证该行为时，才运行最多 `1` 个 low-reasoning smoke case。
- Smoke case 通过后立即停止，不追加便利性或“顺便验证”用例。
- 完整矩阵测试必须由用户明确批准。
- 已有 private 与用户提供的外部证据应优先复用，不为重复确认重新消耗接收线程额度。
- v0.3.1 receiver stabilization 文档与示例改动默认只跑本地自动检查，不创建新的 receiver 矩阵。

这项预算规则不降低发布检查标准。单元测试、release checks、Artifact Checker、`git diff --check` 和受保护接口检查仍按改动范围执行。

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

`v0.3.1` receiver stabilization 收口验证应使用：

```text
git diff --check
node --test tests/basebrief.test.js
node scripts/run_release_checks.js
npm run check
```

该收口不需要 provider 请求、外部 receiver 矩阵、OpenCode smoke、Claude Code smoke 或 Auto Flow run。未注入 provider 环境变量时，release check 必须保持 `provider_probe_status=skipped`。

上一轮 `v0.3.0` 发布候选本地验证未注入 provider 环境变量。`node scripts/run_release_checks.js` 已通过，关键结果为：

- 模式路由用例：`11` 条通过
- 安全扫描文件数：`136`
- 相对链接检查：`122` 条有效
- 公开示例文件：`28` 个存在
- artifact checker 输入：`12` 个通过
- CLI Lite 命令：`8` 条通过
- 首次使用闭环命令：`6` 条通过
- Seal/Diff 命令：`3` 条通过
- 独立测试文件：`1` 个通过
- 独立逻辑测试：`99/99` 通过
- provider probe 状态：`skipped`
- 已保存的公开 benchmark summaries：通过脱敏结构和结论等级检查；本轮未重新运行真实 provider benchmark
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

本轮还完成了 Quickstart 的 `build -> check -> seal -> diff` 与 `receiver-init -> receiver-check` 首次使用闭环、公开产物安全检查和独立逻辑测试。公开首次使用示例没有 error 或 warning，发布候选未发现 key、Bearer、`.env` 内容或私有绝对路径。

Receiver 逻辑由临时 Git 仓库自动测试覆盖。本轮未创建 Codex 接收线程，也未运行完整模型矩阵。

本轮额外执行了两个有界外部 Agent 文档 smoke case：

- OpenCode 只读 smoke 完成，并发现 Quickstart 中来源窗口连续 smoke 与接收窗口正式验收的角色表述不够清楚；文档已修正。
- Claude Code smoke 在限定时间内未返回结果，因此未重试，也没有形成可解释结论。

这些结果仅是补充执行记录，不构成跨模型稳定性证明。原始输出保存在 ignored private 测试目录，不进入公开仓库。

`provider_probe_status=skipped` 表示本轮未注入 provider 环境变量且没有发起真实 provider 请求；这不等同于真实 provider probe 失败。下方保存的 provider probe 和 benchmark 结果是历史 provider-specific 证据，本轮只验证其公开摘要结构，没有重新运行。

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

## BB5 Cache Sidecar benchmark

BB5 sidecar command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode sidecar --output tests/outputs/private/provider-cache-benchmark-sidecar.raw.json
```

Smoke command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode sidecar --repeat-count 2 --project-limit 1 --scenario-limit 2 --output tests/outputs/private/provider-cache-benchmark-sidecar-smoke.raw.json --summary-output tests/outputs/provider-cache-benchmark-sidecar-smoke.latest.json
```

`sidecar` compares `natural`, `readableFull`, `readableLite`, `bb4AnchorPad`, `bb5SidecarFull`, and `bb5SidecarLite`. The readable variants are the human track. The sidecar variants are compact cache-economics prompts derived from the same facts.

BB5 evidence requires `>= 15/18` estimated-cost wins against `natural` and at least `5%` lower overall median estimated cost. To be considered better than BB4, it also needs to be no worse than `bb4AnchorPad` on overall median estimated cost.

Latest MiMo sidecar result:

- request count: `1080`
- valid request count: `1080`
- cache field visibility: `1080/1080`
- `bb5SidecarFull`: `16/18` estimated-cost wins vs natural, `-11.59%` overall estimated-cost delta vs natural, `+1.42%` vs BB4, conclusion `bb5_sidecar_full_cost_evidence`
- `bb5SidecarLite`: `15/18` estimated-cost wins vs natural, `-27.39%` overall estimated-cost delta vs natural, `-16.70%` vs BB4, conclusion `bb5_sidecar_lite_best_evidence`
- conclusion level: `bb5_sidecar_best_evidence`

Latest DeepSeek sidecar result:

- request count: `1080`
- valid request count: `1080`
- cache field visibility: `1080/1080`
- `bb5SidecarFull`: `14/18` estimated-cost wins vs natural, `-17.16%` overall estimated-cost delta vs natural, `-8.14%` vs BB4, conclusion `bb5_sidecar_full_promising_signal`
- `bb5SidecarLite`: `2/18` estimated-cost wins vs natural, `+6.36%` overall estimated-cost delta vs natural, `+17.94%` vs BB4, conclusion `bb5_sidecar_lite_inconclusive`
- conclusion level: `bb5_sidecar_promising_signal`

Current interpretation: BB5 Sidecar is the strongest cache-economics line so far, but provider behavior differs. MiMo favors the Lite sidecar. DeepSeek favors the Full sidecar but missed the strict `15/18` evidence threshold by one scenario, so it remains promising rather than proven.

## BB6 Hybrid Anchor benchmark

BB6 hybrid command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode hybrid --output tests/outputs/private/provider-cache-benchmark-hybrid.raw.json
```

Smoke command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode hybrid --repeat-count 2 --project-limit 1 --scenario-limit 2 --output tests/outputs/private/provider-cache-benchmark-hybrid-smoke.raw.json --summary-output tests/outputs/provider-cache-benchmark-hybrid-smoke.latest.json
```

`hybrid` compares `natural`, `bb4AnchorPad`, `bb5SidecarFull`, `bb5SidecarLite`, `bb6HybridFull`, and `bb6HybridLite`. The BB6 variants keep a natural project snapshot stable, register both tail options before the dynamic boundary, and change only final `CHOICE=A/B`.

BB6 evidence requires `>= 15/18` estimated-cost wins against `natural`, at least `5%` lower overall median estimated cost, and no weaker than the matching BB5 sidecar.

Latest DeepSeek hybrid result:

- request count: `1080`
- valid request count: `1080`
- cache field visibility: `1080/1080`
- `bb6HybridLite`: `14/18` estimated-cost wins vs natural, `-18.04%` overall estimated-cost delta vs natural, conclusion `bb6_hybrid_lite_promising_signal`
- conclusion level: `bb6_hybrid_promising_signal`

## BB7 Block Pad and BB9 Adaptive Selector benchmark

Blockpad command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode blockpad --output tests/outputs/private/provider-cache-benchmark-blockpad.raw.json
```

`blockpad` compares `natural`, `bb5SidecarLite`, `bb6HybridLite`, and `bb7BlockPadLite`. It also reports `bb9AdaptiveSelector`, which selects the lowest estimated-cost candidate per project-scenario comparison.

Latest MiMo blockpad / selector result:

- request count: `720`
- valid request count: `716`
- cache field visibility: `714/716`
- `bb7BlockPadLite`: `10/18` estimated-cost wins vs natural, conclusion `bb7_blockpad_inconclusive`
- `bb9AdaptiveSelector`: `18/18` estimated-cost wins vs natural, `18/18` no-worse-than-natural, `-40.59%` median estimated-cost delta, conclusion `bb9_adaptive_selector_best_evidence`
- conclusion level: `bb9_adaptive_selector_best_evidence`

Latest DeepSeek blockpad / selector result:

- request count: `720`
- valid request count: `720`
- cache field visibility: `720/720`
- `bb7BlockPadLite`: `12/18` estimated-cost wins vs natural, conclusion `bb7_blockpad_promising_signal`
- `bb9AdaptiveSelector`: `17/18` estimated-cost wins vs natural, `18/18` no-worse-than-natural, `-26.54%` median estimated-cost delta, conclusion `bb9_adaptive_selector_best_evidence`
- conclusion level: `bb9_adaptive_selector_best_evidence`

Current interpretation: the strongest mechanism is not one universal cache-ready prompt. It is calibrated selection among natural, BB5 Lite, BB6 Lite, and BB7 block-pad Lite variants. This is still provider- and sample-specific estimated-cost evidence.

## GPT-5.5 relay usage audit

Relay usage audit command:

```bash
node scripts/provider_relay_usage_audit.js --output tests/outputs/private/provider-relay-usage-audit.raw.json --summary-output tests/outputs/provider-relay-usage-audit.latest.json
```

This audit is for `GPT-5.5 via third-party Codex OAuth relay` style routes. It uses synthetic prompts and does not send local project content.

The audit must run before any relay benchmark. It checks:

- whether `/chat/completions` returns stable usage fields
- whether `cached_tokens` is visible
- whether repeated identical prompts change provider-visible input token accounting
- whether the route should be treated as `cache_tokens_visible`, `input_tokens_may_reflect_billing_or_relay_accounting`, `token_length_observation_only`, or `usage_unusable`

Stop before benchmark if the result is `token_length_observation_only` or `usage_unusable`, or if valid request rate is below `90%`. Relay results are `relay_specific_observation`; they must not be described as OpenAI official API evidence.

Latest `sanye.mom` GPT-5.5 relay audit result:

- request count: `6`
- valid request count: `6`
- usage visible: `6/6`
- cache field visibility: `0/6`
- repeated identical prompt token values: `[70]`
- usage interpretation: `token_length_observation_only`
- benchmark recommended: `false`
- stop reason: `cache_cost_not_observable`

Because cache-aware cost is not observable from this relay response, no relay smoke benchmark or larger benchmark was run.

## BB9 handoff POC checks

BB9 handoff generation is local-only and does not call a provider:

```bash
node scripts/generate_bb9_handoff.js --input examples/bb9-handoff-full-input.json --mode full --provider-profile mimo
node scripts/generate_bb9_handoff.js --input examples/bb9-handoff-lite-input.json --mode lite --provider-profile deepseek
node scripts/generate_bb9_handoff.js --input examples/bb9-handoff-lite-input.json --mode lite --provider-profile relay-openai-gpt55-codex-oauth
node scripts/generate_bb9_handoff.js --input examples/bb9-handoff-full-input.json --mode full --provider-profile mimo --print activeProviderPrompt
```

Expected behavior:

- MiMo and DeepSeek profiles emit both `readableBrief` and `cacheSidecar`.
- Supported profiles set `recommendedPromptType=cacheSidecar`; unsupported profiles set `recommendedPromptType=readableBrief`.
- `activeProviderPrompt` equals `cacheSidecar` for supported profiles and `readableBrief` for unsupported profiles.
- The relay profile emits `readableBrief`, sets `cacheSidecar` to `null`, selects `natural`, and reports `fallbackReason=cache_cost_not_observable`.
- No provider API key is needed for this generator.
- The generator does not prove new provider savings; it only applies the already recorded BB9 provider-profile evidence.
- Do not concatenate `readableBrief` and `cacheSidecar` into one provider request; use the artifact named by `recommendedPromptType`.

BB9 handoff POC provider benchmark:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode handoffPoc --output tests/outputs/private/provider-cache-benchmark-handoff-poc.raw.json
```

Smoke command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode handoffPoc --repeat-count 2 --project-limit 1 --scenario-limit 2 --output tests/outputs/private/provider-cache-benchmark-handoff-poc-smoke.raw.json --summary-output tests/outputs/provider-cache-benchmark-handoff-poc-smoke.latest.json
```

`handoffPoc` compares `readableFull`, `readableFullSidecar`, `readableLite`, `readableLiteSidecar`, and `bb9Best`. It answers a negative-control question: whether directly concatenating readable handoff plus sidecar still improves estimated cost.

Handoff POC evidence requires:

- valid request rate `>= 90%`
- cache field visibility `>= 95%`
- `readableFullSidecar` or `readableLiteSidecar` wins estimated cost against the matching readable baseline in at least `15/18` comparisons
- overall median estimated cost is at least `5%` lower than the matching readable baseline

If it misses this threshold, keep BB9 as an experimental sidecar and do not merge it into ordinary `full` / `lite`.

BB10 active prompt POC provider benchmark:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode activePromptPoc --output tests/outputs/private/provider-cache-benchmark-active-prompt-poc.raw.json
```

Smoke command:

```bash
node scripts/provider_cache_benchmark.js --local-projects --mode activePromptPoc --repeat-count 2 --project-limit 1 --scenario-limit 2 --output tests/outputs/private/provider-cache-benchmark-active-prompt-poc-smoke.raw.json --summary-output tests/outputs/provider-cache-benchmark-active-prompt-poc-smoke.latest.json
```

`activePromptPoc` compares `readableFull`, `readableLite`, `cacheSidecarFullOnly`, `cacheSidecarLiteOnly`, and `bb9Best`. It tests the single-active-prompt policy, not the concatenation policy.

BB10 active prompt evidence requires:

- valid request rate `>= 90%`
- cache field visibility `>= 95%`
- sidecar-only estimated cost wins against the matching readable baseline in at least `15/18` comparisons
- overall median estimated cost is at least `5%` lower than the matching readable baseline
- sidecar-only is no worse than `bb9Best` in all `18/18` comparisons before it can be called a merge candidate

Latest MiMo active prompt POC result:

- request count: `360`
- valid request count: `340`
- cache field visibility: `340/340`
- `cacheSidecarFullOnly`: `1/18` estimated-cost wins vs readable Full, `+20.47%` overall estimated-cost delta, conclusion `bb10_active_prompt_full_inconclusive`
- `cacheSidecarLiteOnly`: `17/18` estimated-cost wins vs readable Lite, `-4.25%` overall estimated-cost delta, `11/18` no-worse-than-`bb9Best`, conclusion `bb10_active_prompt_lite_promising_signal`
- conclusion level: `bb10_active_prompt_promising_signal`

Interpretation: BB10 Lite sidecar-only is promising on MiMo, but it missed the strict merge-candidate threshold because the median estimated-cost reduction was below `5%` and it was not no-worse than `bb9Best` in all comparisons. Do not merge it into ordinary `full` / `lite` yet.

Latest DeepSeek active prompt smoke result:

- request count: `20`
- valid request count: `20`
- cache field visibility: `20/20`
- sidecar-only was more expensive than the readable baselines and worse than `bb9Best`
- conclusion: stop before DeepSeek large sample for this variant

## v0.3.2 Receiver Flow Draft Skeleton

`v0.3.2` receiver flow draft skeleton closure should use:

```text
git diff --check
node --test tests/basebrief.test.js
node scripts/run_release_checks.js
npm run check
```

This closure does not require provider requests, external receiver matrices, OpenCode smoke, Claude Code smoke, Auto Flow runs, Web UI checks, Cursor adapter tests, or provider benchmarks. When provider environment variables are absent, release checks must keep `provider_probe_status=skipped`.

`receiver-flow` generates draft-only output: `handoff_status: draft_needs_review`. The generated `flow-summary.json`, `receiver-check.json`, and `draft-context.md` must be reviewed before they are shared or rewritten into a `ready_for_receiver` handoff.

## v0.3.3 Receiver Flow Dogfooding Evidence

`v0.3.3` receiver-flow dogfooding evidence closure should use:

```text
git diff --check
node --test tests/basebrief.test.js
node scripts/run_release_checks.js
npm run check
```

This closure is evidence-only. It does not require provider requests, receiver thread creation, external receiver matrices, OpenCode smoke, Claude Code smoke, Auto Flow runs, Web UI checks, Cursor adapter tests, or provider benchmarks. When provider environment variables are absent, release checks must keep `provider_probe_status=skipped`.

Receiver-flow examples must pass Artifact Checker with zero errors and warnings. Examples may show `handoff_status: draft_needs_review`; they must not present a draft as `handoff_status: ready_for_receiver`.

## v0.4.0 Integrated Local Toolchain Release Candidate

`v0.4.0` release-candidate closure should use:

```text
git diff --check
node --test tests/basebrief.test.js
node scripts/run_release_checks.js
npm run check
```

This closure integrates the existing local toolchain: BB9 handoff, CLI Lite, Artifact Checker, Receiver Safe Check, Receiver Flow Draft, Seal/Diff, local npm validation scripts, and public-safe evidence. It does not require provider requests, receiver thread creation, external receiver matrices, OpenCode smoke, Claude Code smoke, Auto Flow runs, Web UI checks, Cursor adapter tests, CI matrix, internationalization work, or provider benchmarks.

When provider environment variables are absent, release checks must keep `provider_probe_status=skipped`. v0.4.0 must not be described as a hosted platform, provider gateway, published npm package, installed CLI, or Auto Flow release.
