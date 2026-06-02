#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");

const EXCLUDED_PARTS = new Set([
  ".git",
  ".cache",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);

const EXCLUDED_FILE_PATTERNS = [
  /^\.env/i,
  /\.log$/i,
  /\.zip$/i,
  /package-lock\.json$/i,
  /pnpm-lock\.yaml$/i,
  /yarn\.lock$/i,
  /^AGENTS\.md$/i,
  /^CLAUDE\.md$/i,
];

const MIMO_V25_PRICING_CNY_PER_MILLION_TOKENS = {
  inputCacheHit: 0.02,
  inputCacheMiss: 1,
  output: 2,
  effectiveDate: "2026-06-02 Asia/Shanghai",
};

const SCENARIOS = [
  {
    id: "full-baseline",
    label: "full baseline",
    tailRequests: [
      "整理完整阶段基线，保留项目身份、当前阶段、风险边界和下一步。",
      "补一版完整阶段基线，重点说明已验证事实和已确认决策。",
    ],
  },
  {
    id: "lite-handoff",
    label: "lite handoff",
    tailRequests: [
      "生成短接续，只覆盖一到两个文件的小范围下一步。",
      "给下一窗口一个轻量交接，不展开完整历史。",
    ],
  },
  {
    id: "risk-boundary",
    label: "risk boundary",
    tailRequests: [
      "整理风险红线，指出哪些文件、配置或操作需要暂停确认。",
      "列出安全边界和超界停止条件。",
    ],
  },
  {
    id: "next-chat-opener",
    label: "next-chat opener",
    tailRequests: [
      "写一段新窗口开场白，方便另一个 AI 接续。",
      "压缩成可以直接粘贴的新对话开头。",
    ],
  },
  {
    id: "agent-task",
    label: "agent task",
    tailRequests: [
      "写 Agent 任务说明，包含角色、范围、禁止事项和验收标准。",
      "生成一段可交给实现 Agent 的任务 brief。",
    ],
  },
  {
    id: "cache-ready-followup",
    label: "cache-ready follow-up",
    tailRequests: [
      "保持稳定前缀，只把本轮追问放在尾部。",
      "用缓存友好的结构复述项目状态，并给出下一步。",
    ],
  },
];

function nowIso() {
  return new Date().toISOString();
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function sanitizeText(value, maxLength = 1400) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[A-Z]:\\[^\s`'")]+/g, "[local-path]")
    .replace(/\/home\/[^\s`'")]+/g, "[local-path]")
    .replace(/sk-[A-Za-z0-9]{10,}/g, "[redacted-key]")
    .replace(/Bearer\s+[A-Za-z0-9._-]{10,}/g, "Bearer [redacted]")
    .replace(/api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9._-]{6,}/gi, "api_key=[redacted]")
    .replace(/token\s*[:=]\s*["']?[A-Za-z0-9._-]{6,}/gi, "token=[redacted]")
    .replace(/secret\s*[:=]\s*["']?[A-Za-z0-9._-]{6,}/gi, "secret=[redacted]")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function shouldSkipFile(fileName) {
  return EXCLUDED_FILE_PATTERNS.some((pattern) => pattern.test(fileName));
}

function walkProjectFiles(projectPath, limit = 120) {
  const result = [];
  const stack = [projectPath];

  while (stack.length > 0 && result.length < limit) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (EXCLUDED_PARTS.has(entry.name) || shouldSkipFile(entry.name)) {
        continue;
      }
      const fullPath = path.join(current, entry.name);
      const relativePath = path.relative(projectPath, fullPath).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (result.length < limit) {
        result.push(relativePath);
      }
    }
  }

  return result.sort();
}

function readIfExists(filePath, maxLength = 1400) {
  if (!fs.existsSync(filePath)) return "";
  try {
    return sanitizeText(fs.readFileSync(filePath, "utf8"), maxLength);
  } catch {
    return "";
  }
}

function readPackageSummary(projectPath) {
  const candidates = [
    "package.json",
    "frontend/package.json",
    "backend/package.json",
  ];
  const packages = [];

  for (const relativePath of candidates) {
    const fullPath = path.join(projectPath, relativePath);
    if (!fs.existsSync(fullPath)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      packages.push({
        location: relativePath,
        name: sanitizeText(parsed.name || "unnamed", 80),
        scripts: Object.keys(parsed.scripts || {}).sort().slice(0, 12),
        dependencies: Object.keys(parsed.dependencies || {}).sort().slice(0, 20),
        devDependencies: Object.keys(parsed.devDependencies || {}).sort().slice(0, 20),
      });
    } catch {
      packages.push({ location: relativePath, parseError: true });
    }
  }

  return packages;
}

function buildProjectSnapshot(projectPath, projectId) {
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Missing local project path for ${projectId}`);
  }
  const files = walkProjectFiles(projectPath);
  return {
    projectId,
    readmeExcerpt: readIfExists(path.join(projectPath, "README.md")),
    packages: readPackageSummary(projectPath),
    configFiles: files.filter((file) => /(^|\/)(vite|tsconfig|eslint|vitest|webpack|rollup|next)\b/i.test(file)).slice(0, 20),
    entryFiles: files.filter((file) => /(src\/(main|index|App)\.|backend\/server\.|src\/cli\/index\.)/i.test(file)).slice(0, 20),
    fileSample: files.slice(0, 80),
  };
}

function buildNaturalPrompt(snapshot, scenario, iteration) {
  const tailRequest = scenario.tailRequests[iteration % scenario.tailRequests.length];
  return [
    "请基于下面的项目摘要，用自然语言做 BaseBrief 接续。",
    `项目编号：${snapshot.projectId}`,
    `场景：${scenario.label}`,
    "",
    "README 摘要：",
    snapshot.readmeExcerpt || "未读取到 README。",
    "",
    "package 摘要：",
    JSON.stringify(snapshot.packages),
    "",
    "入口与配置文件：",
    [...snapshot.entryFiles, ...snapshot.configFiles].join("\n") || "未识别。",
    "",
    "文件样本：",
    snapshot.fileSample.join("\n"),
    "",
    `本轮请求：${tailRequest}`,
  ].join("\n");
}

function buildNaturalBody(snapshot) {
  return [
    "README 摘要：",
    snapshot.readmeExcerpt || "未读取到 README。",
    "",
    "package 摘要：",
    JSON.stringify(snapshot.packages),
    "",
    "入口与配置文件：",
    [...snapshot.entryFiles, ...snapshot.configFiles].join("\n") || "未识别。",
    "",
    "文件样本：",
    snapshot.fileSample.join("\n"),
  ].join("\n");
}

function buildCacheReadyPrompt(snapshot, scenario, iteration) {
  const tailRequest = scenario.tailRequests[iteration % scenario.tailRequests.length];
  return [
    "# BaseBrief Local Project Cache-ready Benchmark v1",
    "NOTICE: Stable-prefix experiment for MiMo benchmark only.",
    "RULE: Keep all fields except TAIL_REQUEST stable across repeats.",
    "SCHEMA_VERSION: 1",
    "MODE_FAMILY: BASEBRIEF_CACHE_READY",
    "BEGIN_STABLE_PREFIX",
    `PROJECT_ID: ${snapshot.projectId}`,
    `SCENARIO_ID: ${scenario.id}`,
    `SCENARIO_LABEL: ${scenario.label}`,
    `README_EXCERPT: ${sanitizeText(snapshot.readmeExcerpt || "none")}`,
    `PACKAGE_SUMMARY_JSON: ${sanitizeText(JSON.stringify(snapshot.packages), 1600)}`,
    `ENTRY_FILES: ${snapshot.entryFiles.join(" | ") || "none"}`,
    `CONFIG_FILES: ${snapshot.configFiles.join(" | ") || "none"}`,
    `FILE_SAMPLE: ${snapshot.fileSample.join(" | ")}`,
    "VERIFIED_FACT_1: This is a local real-project benchmark snapshot.",
    "VERIFIED_FACT_2: Sensitive files and generated directories are excluded.",
    "CONFIRMED_DECISION_1: Do not modify the source project.",
    "RISK_BOUNDARY_1: Do not read or output env files, tokens, secrets, or credentials.",
    "EXPECTED_OUTPUT: A concise BaseBrief continuation answer.",
    "END_STABLE_PREFIX",
    `TAIL_REQUEST: ${tailRequest}`,
  ].join("\n");
}

function buildNormalizedPrompt(snapshot, scenario, iteration, variant) {
  const tailRequest = scenario.tailRequests[iteration % scenario.tailRequests.length];
  const body = buildNaturalBody(snapshot);
  if (variant === "natural") {
    return [
      "# BaseBrief Local Project Normalized Benchmark v1",
      "FORMAT: natural-continuation",
      "RULE: Use the project snapshot below and answer the tail request.",
      `PROJECT_ID: ${snapshot.projectId}`,
      `SCENARIO_ID: ${scenario.id}`,
      `SCENARIO_LABEL: ${scenario.label}`,
      "BEGIN_STABLE_PROJECT_SNAPSHOT",
      body,
      "VERIFIED_FACT: This benchmark snapshot excludes sensitive files and generated directories.",
      "CONFIRMED_DECISION: Do not modify the source project.",
      "RISK_BOUNDARY: Do not read or output env files, tokens, secrets, or credentials.",
      "END_STABLE_PROJECT_SNAPSHOT",
      `TAIL_REQUEST: ${tailRequest}`,
    ].join("\n");
  }

  return [
    "# BaseBrief Local Project Normalized Benchmark v1",
    "FORMAT: cache-ready-continuation",
    "RULE: Keep all stable fields unchanged across repeats; place request variation only in TAIL_REQUEST.",
    `PROJECT_ID: ${snapshot.projectId}`,
    `SCENARIO_ID: ${scenario.id}`,
    `SCENARIO_LABEL: ${scenario.label}`,
    "BEGIN_STABLE_PROJECT_SNAPSHOT",
    `README_EXCERPT: ${snapshot.readmeExcerpt || "none"}`,
    `PACKAGE_SUMMARY_JSON: ${JSON.stringify(snapshot.packages)}`,
    `ENTRY_AND_CONFIG_FILES: ${[...snapshot.entryFiles, ...snapshot.configFiles].join(" | ") || "none"}`,
    `FILE_SAMPLE: ${snapshot.fileSample.join(" | ")}`,
    "VERIFIED_FACT_1: This benchmark snapshot excludes sensitive files and generated directories.",
    "CONFIRMED_DECISION_1: Do not modify the source project.",
    "RISK_BOUNDARY_1: Do not read or output env files, tokens, secrets, or credentials.",
    "END_STABLE_PROJECT_SNAPSHOT",
    `TAIL_REQUEST: ${tailRequest}`,
  ].join("\n");
}

function getEnvConfig() {
  return {
    baseUrl: process.env.BASEBRIEF_PROVIDER_BASE_URL || "",
    apiKey: process.env.BASEBRIEF_PROVIDER_API_KEY || "",
    model: process.env.BASEBRIEF_PROVIDER_MODEL || "",
    providerName: process.env.BASEBRIEF_PROVIDER_NAME || "openai-compatible",
    timeoutMs: Number(process.env.BASEBRIEF_PROVIDER_TIMEOUT_MS || 30000),
    repeats: Number(process.env.BASEBRIEF_BENCHMARK_REPEATS || 10),
    maxOutputTokens: Number(process.env.BASEBRIEF_BENCHMARK_MAX_OUTPUT_TOKENS || 32),
    projectPaths: (process.env.BASEBRIEF_BENCHMARK_PROJECTS || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

function estimateCostCny(metrics, pricing = MIMO_V25_PRICING_CNY_PER_MILLION_TOKENS) {
  const promptTokens = metrics.promptTokens ?? 0;
  const cachedTokens = metrics.cachedTokens ?? 0;
  const completionTokens = metrics.completionTokens ?? 0;
  const uncachedInputTokens = Math.max(0, promptTokens - cachedTokens);
  const estimatedInputHitCostCny = (cachedTokens / 1_000_000) * pricing.inputCacheHit;
  const estimatedInputMissCostCny = (uncachedInputTokens / 1_000_000) * pricing.inputCacheMiss;
  const estimatedOutputCostCny = (completionTokens / 1_000_000) * pricing.output;
  return {
    uncachedInputTokens,
    estimatedInputHitCostCny,
    estimatedInputMissCostCny,
    estimatedOutputCostCny,
    estimatedTotalCostCny: estimatedInputHitCostCny + estimatedInputMissCostCny + estimatedOutputCostCny,
  };
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function extractUsageMetrics(data) {
  const usage = data.usage || {};
  const promptTokens = usage.prompt_tokens ?? usage.input_tokens ?? null;
  const completionTokens = usage.completion_tokens ?? usage.output_tokens ?? null;
  const totalTokens = usage.total_tokens ?? null;
  const cachedTokens =
    usage?.prompt_tokens_details?.cached_tokens ??
    usage?.input_tokens_details?.cached_tokens ??
    usage?.cached_tokens ??
    null;
  return {
    promptTokens,
    completionTokens,
    totalTokens,
    cachedTokens,
    cacheRatio: promptTokens ? cachedTokens / promptTokens : null,
    cacheFieldVisible: cachedTokens !== null,
    ...estimateCostCny({ promptTokens, completionTokens, cachedTokens }),
  };
}

async function callChatCompletions(env, input) {
  const url = `${env.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const started = Date.now();
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.apiKey}`,
    },
    body: JSON.stringify({
      model: env.model,
      messages: [{ role: "user", content: input }],
      temperature: 0,
      max_tokens: env.maxOutputTokens,
    }),
  }, env.timeoutMs);
  const totalLatencyMs = Date.now() - started;
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`chat/completions failed: ${response.status} ${response.statusText}`);
  }
  return {
    endpoint: "chat/completions",
    totalLatencyMs,
    ...extractUsageMetrics(JSON.parse(text)),
  };
}

function median(values) {
  const clean = values.filter((value) => typeof value === "number" && Number.isFinite(value)).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
}

function quantile(values, q) {
  const clean = values.filter((value) => typeof value === "number" && Number.isFinite(value)).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const index = Math.min(clean.length - 1, Math.max(0, Math.floor((clean.length - 1) * q)));
  return clean[index];
}

function summarizeCalls(calls) {
  const successful = calls.filter((call) => call.status === "success");
  const repeatCalls = successful.filter((call) => call.iteration > 0);
  return {
    requestCount: calls.length,
    validRequestCount: successful.length,
    repeatRequestCount: repeatCalls.length,
    cacheFieldVisibleCount: successful.filter((call) => call.cacheFieldVisible).length,
    medianCachedTokens: median(repeatCalls.map((call) => call.cachedTokens)),
    medianCacheRatio: median(repeatCalls.map((call) => call.cacheRatio)),
    medianEstimatedCostCny: median(repeatCalls.map((call) => call.estimatedTotalCostCny)),
    medianLatencyMs: median(successful.map((call) => call.totalLatencyMs)),
    p25LatencyMs: quantile(successful.map((call) => call.totalLatencyMs), 0.25),
    p75LatencyMs: quantile(successful.map((call) => call.totalLatencyMs), 0.75),
  };
}

function buildSummary(rawResult) {
  const calls = rawResult.calls;
  const validRequestCount = calls.filter((call) => call.status === "success").length;
  const cacheFieldVisibleCount = calls.filter((call) => call.status === "success" && call.cacheFieldVisible).length;
  const variants = {};
  for (const variant of ["natural", "cacheReady"]) {
    variants[variant] = summarizeCalls(calls.filter((call) => call.variant === variant));
  }

  const comparisons = [];
  for (const projectId of rawResult.projectIds) {
    for (const scenario of SCENARIOS) {
      const naturalCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === "natural");
      const cacheReadyCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === "cacheReady");
      const natural = summarizeCalls(naturalCalls);
      const cacheReady = summarizeCalls(cacheReadyCalls);
      const naturalPromptMedian = median(naturalCalls.filter((call) => call.iteration > 0 && call.status === "success").map((call) => call.promptTokens));
      const cacheReadyPromptMedian = median(cacheReadyCalls.filter((call) => call.iteration > 0 && call.status === "success").map((call) => call.promptTokens));
      const lengthDeltaRatio =
        typeof naturalPromptMedian === "number" && typeof cacheReadyPromptMedian === "number" && naturalPromptMedian > 0
          ? Math.abs(cacheReadyPromptMedian - naturalPromptMedian) / naturalPromptMedian
          : null;
      const lengthNormalized = rawResult.mode !== "normalized" || (typeof lengthDeltaRatio === "number" && lengthDeltaRatio <= 0.05);
      const costDeltaCny =
        typeof natural.medianEstimatedCostCny === "number" && typeof cacheReady.medianEstimatedCostCny === "number"
          ? cacheReady.medianEstimatedCostCny - natural.medianEstimatedCostCny
          : null;
      const costDeltaPercent =
        typeof costDeltaCny === "number" && natural.medianEstimatedCostCny
          ? costDeltaCny / natural.medianEstimatedCostCny
          : null;
      comparisons.push({
        projectId,
        scenarioId: scenario.id,
        lengthNormalized,
        promptTokenDeltaRatio: lengthDeltaRatio,
        naturalMedianPromptTokens: naturalPromptMedian,
        cacheReadyMedianPromptTokens: cacheReadyPromptMedian,
        naturalMedianCachedTokens: natural.medianCachedTokens,
        cacheReadyMedianCachedTokens: cacheReady.medianCachedTokens,
        naturalMedianCacheRatio: natural.medianCacheRatio,
        cacheReadyMedianCacheRatio: cacheReady.medianCacheRatio,
        naturalMedianEstimatedCostCny: natural.medianEstimatedCostCny,
        cacheReadyMedianEstimatedCostCny: cacheReady.medianEstimatedCostCny,
        costDeltaCny,
        costDeltaPercent,
        cacheReadyCachedTokenWin:
          typeof natural.medianCachedTokens === "number" &&
          typeof cacheReady.medianCachedTokens === "number" &&
          cacheReady.medianCachedTokens > natural.medianCachedTokens,
        cacheReadyCacheRatioWin:
          lengthNormalized &&
          typeof natural.medianCacheRatio === "number" &&
          typeof cacheReady.medianCacheRatio === "number" &&
          cacheReady.medianCacheRatio > natural.medianCacheRatio,
        cacheReadyEstimatedCostWin:
          lengthNormalized &&
          typeof natural.medianEstimatedCostCny === "number" &&
          typeof cacheReady.medianEstimatedCostCny === "number" &&
          cacheReady.medianEstimatedCostCny < natural.medianEstimatedCostCny,
      });
    }
  }

  const wins = comparisons.filter((item) => item.cacheReadyCachedTokenWin).length;
  const normalizedComparisons = comparisons.filter((item) => item.lengthNormalized);
  const ratioWins = normalizedComparisons.filter((item) => item.cacheReadyCacheRatioWin).length;
  const costWins = normalizedComparisons.filter((item) => item.cacheReadyEstimatedCostWin).length;
  const cacheFieldVisibilityRate = validRequestCount ? cacheFieldVisibleCount / validRequestCount : 0;
  const validRequestRate = calls.length ? validRequestCount / calls.length : 0;
  const naturalCost = variants.natural.medianEstimatedCostCny;
  const cacheReadyCost = variants.cacheReady.medianEstimatedCostCny;
  const overallCostDeltaCny =
    typeof naturalCost === "number" && typeof cacheReadyCost === "number" ? cacheReadyCost - naturalCost : null;
  const overallCostDeltaPercent =
    typeof overallCostDeltaCny === "number" && naturalCost ? overallCostDeltaCny / naturalCost : null;
  const ratioEvidence =
    rawResult.mode === "normalized" &&
    validRequestCount >= 324 &&
    cacheFieldVisibilityRate >= 0.95 &&
    normalizedComparisons.length >= 15 &&
    ratioWins >= 15;
  const costEvidence =
    rawResult.mode === "normalized" &&
    validRequestCount >= 324 &&
    cacheFieldVisibilityRate >= 0.95 &&
    normalizedComparisons.length >= 15 &&
    costWins >= 15 &&
    typeof overallCostDeltaPercent === "number" &&
    overallCostDeltaPercent <= -0.05;

  return {
    status: rawResult.status,
    startedAt: rawResult.startedAt,
    finishedAt: rawResult.finishedAt,
    providerName: rawResult.providerName,
    model: rawResult.model,
    mode: rawResult.mode || "absolute",
    benchmarkKind: "local-real-projects-redacted",
    pricingCnyPerMillionTokens: rawResult.pricingCnyPerMillionTokens || MIMO_V25_PRICING_CNY_PER_MILLION_TOKENS,
    projectCount: rawResult.projectIds.length,
    scenarioCount: SCENARIOS.length,
    repeatsPerVariant: rawResult.repeats,
    requestCount: calls.length,
    validRequestCount,
    validRequestRate,
    cacheFieldVisibleCount,
    cacheFieldVisibilityRate,
    cacheReadyWins: wins,
    cacheReadyCacheRatioWins: ratioWins,
    cacheReadyEstimatedCostWins: costWins,
    lengthNormalizedComparisons: normalizedComparisons.length,
    cacheReadyWinThreshold: 15,
    largeSampleThreshold: 324,
    overallCostDeltaCny,
    overallCostDeltaPercent,
    ratioConclusionLevel: ratioEvidence ? "ratio_large_sample_evidence" : "ratio_not_proven",
    costConclusionLevel: costEvidence ? "cost_large_sample_evidence" : "cost_not_proven",
    conclusionLevel:
      rawResult.mode === "normalized"
        ? (ratioEvidence || costEvidence ? "normalized_large_sample_evidence" : "normalized_inconclusive")
        : (validRequestCount >= 324 && cacheFieldVisibilityRate >= 0.95 && wins >= 15
          ? "large_sample_evidence"
          : "inconclusive_large_sample"),
    variants,
    comparisons,
    limitations: [
      "MiMo mimo-v2.5 only; not a cross-provider conclusion.",
      "Latency is recorded but not used as the primary win criterion.",
      "Source project snapshots are read-only and redacted in public summary output.",
    ],
  };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const outputIndex = args.indexOf("--output");
  const summaryIndex = args.indexOf("--summary-output");
  const modeIndex = args.indexOf("--mode");
  const mode = modeIndex >= 0 ? args[modeIndex + 1] : "absolute";
  const defaultOutputPath =
    mode === "normalized"
      ? "tests/outputs/private/provider-cache-benchmark-normalized.raw.json"
      : "tests/outputs/private/provider-cache-benchmark.raw.json";
  const defaultSummaryOutputPath =
    mode === "normalized"
      ? "tests/outputs/provider-cache-benchmark-normalized.latest.json"
      : "tests/outputs/provider-cache-benchmark.latest.json";
  return {
    localProjects: args.includes("--local-projects"),
    mode,
    outputPath: outputIndex >= 0 ? args[outputIndex + 1] : defaultOutputPath,
    summaryOutputPath: summaryIndex >= 0 ? args[summaryIndex + 1] : defaultSummaryOutputPath,
    jsonMode: args.includes("--json"),
  };
}

function writeJson(relativeOrAbsolutePath, data) {
  const resolved = path.resolve(repoRoot, relativeOrAbsolutePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function runBenchmark(options = {}) {
  const env = getEnvConfig();
  if (!env.baseUrl || !env.apiKey || !env.model) {
    throw new Error("Missing BASEBRIEF_PROVIDER_BASE_URL, BASEBRIEF_PROVIDER_API_KEY, or BASEBRIEF_PROVIDER_MODEL");
  }
  if (!options.localProjects) {
    throw new Error("Use --local-projects for this benchmark.");
  }
  if (!["absolute", "normalized"].includes(options.mode)) {
    throw new Error("Benchmark mode must be absolute or normalized.");
  }
  if (env.projectPaths.length === 0) {
    throw new Error("Missing BASEBRIEF_BENCHMARK_PROJECTS. Use semicolon-separated local project paths.");
  }

  const projectIds = env.projectPaths.map((_, index) => `project${String.fromCharCode(65 + index)}`);
  const snapshots = env.projectPaths.map((projectPath, index) => buildProjectSnapshot(projectPath, projectIds[index]));
  const rawResult = {
    status: "executed",
    startedAt: nowIso(),
    finishedAt: null,
    providerName: env.providerName,
    model: env.model,
    mode: options.mode,
    pricingCnyPerMillionTokens: MIMO_V25_PRICING_CNY_PER_MILLION_TOKENS,
    repeats: env.repeats,
    projectIds,
    calls: [],
  };

  const totalRequests = snapshots.length * SCENARIOS.length * 2 * env.repeats;
  let completed = 0;

  for (const snapshot of snapshots) {
    for (const scenario of SCENARIOS) {
      for (const variant of ["natural", "cacheReady"]) {
        for (let iteration = 0; iteration < env.repeats; iteration += 1) {
          const input =
            options.mode === "normalized"
              ? buildNormalizedPrompt(snapshot, scenario, iteration, variant)
              : (variant === "natural"
                ? buildNaturalPrompt(snapshot, scenario, iteration)
                : buildCacheReadyPrompt(snapshot, scenario, iteration));
          const baseCall = {
            projectId: snapshot.projectId,
            scenarioId: scenario.id,
            variant,
            phase: iteration === 0 ? "warmup" : "repeat",
            iteration,
            promptHash: sha256(input),
          };

          try {
            const metrics = await callChatCompletions(env, input);
            rawResult.calls.push({ ...baseCall, status: "success", ...metrics });
          } catch (error) {
            rawResult.calls.push({ ...baseCall, status: "failed", error: sanitizeText(error.message, 160) });
          }

          completed += 1;
          if (completed % 20 === 0 || completed === totalRequests) {
            console.error(`benchmark_progress=${completed}/${totalRequests}`);
          }
        }
      }
    }
  }

  rawResult.finishedAt = nowIso();
  return { rawResult, summary: buildSummary(rawResult) };
}

async function cli() {
  const options = parseArgs(process.argv);
  const { rawResult, summary } = await runBenchmark(options);
  writeJson(options.outputPath, rawResult);
  writeJson(options.summaryOutputPath, summary);
  if (options.jsonMode) {
    console.log(JSON.stringify(summary, null, 2));
  }
}

if (require.main === module) {
  cli().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  buildSummary,
  runBenchmark,
  SCENARIOS,
};
