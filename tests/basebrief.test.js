const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { generateFromObject } = require("../scripts/generate_cache_ready_lite");
const { buildSummary, SCENARIOS } = require("../scripts/provider_cache_benchmark");
const { routeMode } = require("../scripts/mode_router");

const repoRoot = path.resolve(__dirname, "..");

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

test("mode router selects full for complex or risky requests", () => {
  const cases = [
    "请整理完整阶段基线，并生成新窗口开场和 Agent 任务说明。",
    "这个任务涉及 backend、provider 和部署，先做阶段基线。",
    "边界不清，帮我优化一下。",
    "真实 Agent runtime 里有 state、memory 和 gateway。",
  ];

  for (const input of cases) {
    assert.equal(routeMode(input), "full", input);
  }
});

test("mode router selects lite only for bounded lightweight continuation", () => {
  const cases = [
    "请做一个 lite 接续，只读分析一个文件。",
    "本轮是简短交接，范围是 1 到 2 个文件的小范围任务。",
  ];

  for (const input of cases) {
    assert.equal(routeMode(input), "lite", input);
  }
});

test("mode router selects cache-ready only for stable-prefix experiments", () => {
  const cases = [
    "请用 cache-ready 模式生成稳定前缀。",
    "我要做 prompt cache 和缓存代理实验。",
  ];

  for (const input of cases) {
    assert.equal(routeMode(input), "cache-ready", input);
  }
});

test("mode router asks for clarification when no mode signal is present", () => {
  assert.equal(routeMode("请继续。"), "needs-clarification");
});

test("cache-ready generator keeps output stable for identical structured input", () => {
  const input = readJson("tests/fixtures/cache-ready/cache-ready-a.json");
  const first = generateFromObject(input);
  const second = generateFromObject(input);

  assert.equal(first, second);
  assert.match(first, /MODE_FAMILY: BASEBRIEF_CACHE_READY/);
  assert.match(first, /TAIL_REQUEST:/);
});

test("cache-ready generator uses fixed field order independent of object key order", () => {
  const normal = generateFromObject(readJson("tests/fixtures/cache-ready/cache-ready-a.json"));
  const shuffled = generateFromObject(readJson("tests/fixtures/cache-ready/cache-ready-shuffled.json"));

  assert.equal(normal, shuffled);
});

test("cache-ready generator rejects missing required fields", () => {
  const input = readJson("tests/fixtures/cache-ready/cache-ready-missing.json");

  assert.throws(() => generateFromObject(input), /Missing required key: tail_request/);
});

test("core templates preserve BaseBrief baseline sections", () => {
  const templatePaths = [
    "templates/zh-CN/BASEBRIEF.md",
    "templates/zh-CN/BASEBRIEF_LITE.md",
  ];
  const requiredTokens = [
    "verified_facts",
    "confirmed_decisions",
    "assumptions",
    "open_questions",
    "risk_boundaries",
  ];

  for (const templatePath of templatePaths) {
    const content = readText(templatePath);
    for (const token of requiredTokens) {
      assert.match(content, new RegExp(token), `${templatePath} missing ${token}`);
    }
  }
});

test("benchmark summary classifies large-sample evidence with anonymized project ids", () => {
  const projectIds = ["projectA", "projectB", "projectC"];
  const calls = [];

  for (const projectId of projectIds) {
    for (const scenario of SCENARIOS) {
      for (const variant of ["natural", "cacheReady"]) {
        for (let iteration = 0; iteration < 10; iteration += 1) {
          const promptTokens = variant === "natural" ? 400 : 700;
          const cachedTokens = variant === "natural" ? 300 : 600;
          calls.push({
            projectId,
            scenarioId: scenario.id,
            variant,
            phase: iteration === 0 ? "warmup" : "repeat",
            iteration,
            status: "success",
            promptTokens,
            cachedTokens,
            cacheRatio: cachedTokens / promptTokens,
            cacheFieldVisible: true,
            completionTokens: 32,
            uncachedInputTokens: promptTokens - cachedTokens,
            estimatedTotalCostCny: 0.0001,
            totalLatencyMs: 1000 + iteration,
          });
        }
      }
    }
  }

  const summary = buildSummary({
    status: "executed",
    startedAt: "2026-06-02T00:00:00.000Z",
    finishedAt: "2026-06-02T00:10:00.000Z",
    providerName: "test-provider",
    model: "test-model",
    mode: "absolute",
    repeats: 10,
    projectIds,
    calls,
  });

  assert.equal(summary.requestCount, 360);
  assert.equal(summary.validRequestCount, 360);
  assert.equal(summary.cacheReadyWins, 18);
  assert.equal(summary.cacheReadyCacheRatioWins, 18);
  assert.equal(summary.conclusionLevel, "large_sample_evidence");
  assert.deepEqual(
    [...new Set(summary.comparisons.map((item) => item.projectId))].sort(),
    projectIds,
  );
});

test("normalized benchmark summary reports ratio and cost wins only for length-normalized comparisons", () => {
  const projectIds = ["projectA", "projectB", "projectC"];
  const calls = [];

  for (const projectId of projectIds) {
    for (const scenario of SCENARIOS) {
      for (const variant of ["natural", "cacheReady"]) {
        for (let iteration = 0; iteration < 10; iteration += 1) {
          const promptTokens = variant === "natural" ? 1000 : 1020;
          const cachedTokens = variant === "natural" ? 900 : 960;
          const estimatedTotalCostCny = variant === "natural" ? 0.0002 : 0.00017;
          calls.push({
            projectId,
            scenarioId: scenario.id,
            variant,
            phase: iteration === 0 ? "warmup" : "repeat",
            iteration,
            status: "success",
            promptTokens,
            completionTokens: 32,
            cachedTokens,
            cacheRatio: cachedTokens / promptTokens,
            cacheFieldVisible: true,
            estimatedTotalCostCny,
            totalLatencyMs: 1000 + iteration,
          });
        }
      }
    }
  }

  const summary = buildSummary({
    status: "executed",
    startedAt: "2026-06-02T00:00:00.000Z",
    finishedAt: "2026-06-02T00:10:00.000Z",
    providerName: "test-provider",
    model: "test-model",
    mode: "normalized",
    repeats: 10,
    projectIds,
    calls,
  });

  assert.equal(summary.lengthNormalizedComparisons, 18);
  assert.equal(summary.cacheReadyCacheRatioWins, 18);
  assert.equal(summary.cacheReadyEstimatedCostWins, 18);
  assert.equal(summary.ratioConclusionLevel, "ratio_large_sample_evidence");
  assert.equal(summary.costConclusionLevel, "cost_large_sample_evidence");
  assert.equal(summary.conclusionLevel, "normalized_large_sample_evidence");
  assert(summary.overallCostDeltaPercent < -0.05);
});
