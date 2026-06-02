#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { generateAnchorFromObject } = require("./generate_cache_ready_anchor");

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

const CNY_CACHE_PRICING_PER_MILLION_TOKENS = {
  inputCacheHit: 0.02,
  inputCacheMiss: 1,
  output: 2,
  effectiveDate: "2026-06-02 Asia/Shanghai",
};

const PROVIDER_PROFILES = {
  "mimo-v2.5": {
    providerName: "xiaomimimo",
    model: "mimo-v2.5",
    pricingCnyPerMillionTokens: CNY_CACHE_PRICING_PER_MILLION_TOKENS,
    limitation: "MiMo mimo-v2.5 only; not a cross-provider conclusion.",
  },
  "deepseek-v4-flash": {
    providerName: "deepseek",
    model: "deepseek-v4-flash",
    pricingCnyPerMillionTokens: CNY_CACHE_PRICING_PER_MILLION_TOKENS,
    limitation: "DeepSeek deepseek-v4-flash only; not a cross-provider conclusion.",
  },
};

const PAD_SWEEP_VARIANTS = [
  { variant: "anchorPad4", padLength: 4 },
  { variant: "anchorPad8", padLength: 8 },
  { variant: "anchorPad16", padLength: 16 },
  { variant: "anchorPad32", padLength: 32 },
  { variant: "anchorPad64", padLength: 64 },
];

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

function buildCapsulePrompt(snapshot, scenario, iteration) {
  const tailRequest = scenario.tailRequests[iteration % scenario.tailRequests.length];
  return [
    "BB2",
    `P=${snapshot.projectId}/${scenario.id}: local real-project benchmark snapshot`,
    `G=${scenario.label}`,
    `F=readme:${sanitizeText(snapshot.readmeExcerpt || "none", 900)} ; pkg:${sanitizeText(JSON.stringify(snapshot.packages), 900)} ; files:${sanitizeText(snapshot.fileSample.join(" | "), 1200)}`,
    "D=source project is read-only ; sensitive files and generated directories are excluded",
    "R=do not read or output env files, tokens, secrets, or credentials",
    "X=.env ; token ; secret ; credential ; source project writes",
    "O=concise BaseBrief continuation answer",
    "--",
    `T=${sanitizeText(tailRequest, 300)}`,
  ].join("\n");
}

function buildAnchorPrompt(snapshot, scenario, iteration) {
  const choice = iteration % scenario.tailRequests.length === 0 ? "A" : "B";
  return buildAnchorLikePrompt(snapshot, scenario, choice, null);
}

function buildAnchorPadPrompt(snapshot, scenario, iteration) {
  const choice = iteration % scenario.tailRequests.length === 0 ? "A" : "B";
  return buildAnchorLikePrompt(snapshot, scenario, choice, 8);
}

function buildPadString(length) {
  return Array.from({ length }, () => "p").join(" ");
}

function buildAnchorLikePrompt(snapshot, scenario, choice, padLength) {
  const input = {
    mode: padLength ? "cache-ready-anchor-pad-v4" : "cache-ready-anchor-v3",
    project_identity: `${snapshot.projectId}/${scenario.id}: local real-project benchmark snapshot`,
    current_goal: scenario.label,
    verified_facts: [
      `readme:${sanitizeText(snapshot.readmeExcerpt || "none", 900)}`,
      `pkg:${sanitizeText(JSON.stringify(snapshot.packages), 900)}`,
      `files:${sanitizeText(snapshot.fileSample.join(" | "), 1200)}`,
    ],
    confirmed_decisions: [
      "source project is read-only",
      "sensitive files and generated directories are excluded",
    ],
    risk_boundaries: [
      "do not read or output env files, tokens, secrets, or credentials",
    ],
    forbidden_scope: [
      ".env",
      "token",
      "secret",
      "credential",
      "source project writes",
    ],
    expected_output: "concise BaseBrief continuation answer",
    tail_options: scenario.tailRequests.map((request) => sanitizeText(request, 300)),
    tail_choice: choice,
  };
  if (padLength) {
    input.cache_pad = buildPadString(padLength);
  }
  return generateAnchorFromObject(input);
}

function buildPadSweepPrompt(snapshot, scenario, iteration, variant) {
  const config = PAD_SWEEP_VARIANTS.find((item) => item.variant === variant);
  if (!config) throw new Error(`Unknown pad sweep variant: ${variant}`);
  const choice = iteration % scenario.tailRequests.length === 0 ? "A" : "B";
  return buildAnchorLikePrompt(snapshot, scenario, choice, config.padLength);
}

function detectProviderProfile(providerName, model) {
  const requested = (process.env.BASEBRIEF_PROVIDER_PROFILE || "").trim();
  if (requested && PROVIDER_PROFILES[requested]) {
    return { profileId: requested, ...PROVIDER_PROFILES[requested] };
  }
  const modelKey = String(model || "").toLowerCase();
  if (PROVIDER_PROFILES[modelKey]) {
    return { profileId: modelKey, ...PROVIDER_PROFILES[modelKey] };
  }
  const providerKey = String(providerName || "").toLowerCase();
  if (providerKey.includes("deepseek")) {
    return { profileId: "deepseek-v4-flash", ...PROVIDER_PROFILES["deepseek-v4-flash"] };
  }
  if (providerKey.includes("mimo") || providerKey.includes("xiaomi")) {
    return { profileId: "mimo-v2.5", ...PROVIDER_PROFILES["mimo-v2.5"] };
  }
  return {
    profileId: "custom-compatible",
    providerName: providerName || "openai-compatible",
    model: model || "unknown",
    pricingCnyPerMillionTokens: CNY_CACHE_PRICING_PER_MILLION_TOKENS,
    limitation: "Custom OpenAI-compatible provider; not a cross-provider conclusion.",
  };
}

function getEnvConfig() {
  const providerName = process.env.BASEBRIEF_PROVIDER_NAME || "openai-compatible";
  const model = process.env.BASEBRIEF_PROVIDER_MODEL || "";
  const providerProfile = detectProviderProfile(providerName, model);
  return {
    baseUrl: process.env.BASEBRIEF_PROVIDER_BASE_URL || "",
    apiKey: process.env.BASEBRIEF_PROVIDER_API_KEY || "",
    model,
    providerName,
    providerProfileId: providerProfile.profileId,
    pricingCnyPerMillionTokens: providerProfile.pricingCnyPerMillionTokens,
    providerLimitation: providerProfile.limitation,
    timeoutMs: Number(process.env.BASEBRIEF_PROVIDER_TIMEOUT_MS || 30000),
    repeats: Number(process.env.BASEBRIEF_BENCHMARK_REPEATS || 10),
    maxOutputTokens: Number(process.env.BASEBRIEF_BENCHMARK_MAX_OUTPUT_TOKENS || 32),
    projectPaths: (process.env.BASEBRIEF_BENCHMARK_PROJECTS || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

function estimateCostCny(metrics, pricing = CNY_CACHE_PRICING_PER_MILLION_TOKENS) {
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

function extractUsageMetrics(data, pricing) {
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
    ...estimateCostCny({ promptTokens, completionTokens, cachedTokens }, pricing),
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
    ...extractUsageMetrics(JSON.parse(text), env.pricingCnyPerMillionTokens),
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

function getVariantsForMode(mode) {
  if (mode === "padSweep") return PAD_SWEEP_VARIANTS.map((item) => item.variant);
  if (mode === "anchorpad") return ["natural", "cacheReady", "capsuleV2", "anchorV3", "anchorPadV4"];
  if (mode === "anchor") return ["natural", "cacheReady", "capsuleV2", "anchorV3"];
  return mode === "capsule" ? ["natural", "cacheReady", "capsuleV2"] : ["natural", "cacheReady"];
}

function getPromptForVariant(mode, snapshot, scenario, iteration, variant) {
  if (mode === "normalized") {
    return buildNormalizedPrompt(snapshot, scenario, iteration, variant);
  }
  if (mode === "capsule") {
    if (variant === "natural") return buildNormalizedPrompt(snapshot, scenario, iteration, "natural");
    if (variant === "cacheReady") return buildNormalizedPrompt(snapshot, scenario, iteration, "cacheReady");
    return buildCapsulePrompt(snapshot, scenario, iteration);
  }
  if (mode === "anchor") {
    if (variant === "natural") return buildNormalizedPrompt(snapshot, scenario, iteration, "natural");
    if (variant === "cacheReady") return buildNormalizedPrompt(snapshot, scenario, iteration, "cacheReady");
    if (variant === "capsuleV2") return buildCapsulePrompt(snapshot, scenario, iteration);
    return buildAnchorPrompt(snapshot, scenario, iteration);
  }
  if (mode === "anchorpad") {
    if (variant === "natural") return buildNormalizedPrompt(snapshot, scenario, iteration, "natural");
    if (variant === "cacheReady") return buildNormalizedPrompt(snapshot, scenario, iteration, "cacheReady");
    if (variant === "capsuleV2") return buildCapsulePrompt(snapshot, scenario, iteration);
    if (variant === "anchorV3") return buildAnchorPrompt(snapshot, scenario, iteration);
    return buildAnchorPadPrompt(snapshot, scenario, iteration);
  }
  if (mode === "padSweep") {
    return buildPadSweepPrompt(snapshot, scenario, iteration, variant);
  }
  return variant === "natural"
    ? buildNaturalPrompt(snapshot, scenario, iteration)
    : buildCacheReadyPrompt(snapshot, scenario, iteration);
}

function buildSummary(rawResult) {
  const calls = rawResult.calls;
  const validRequestCount = calls.filter((call) => call.status === "success").length;
  const cacheFieldVisibleCount = calls.filter((call) => call.status === "success" && call.cacheFieldVisible).length;
  const variants = {};
  const variantNames = getVariantsForMode(rawResult.mode || "absolute");
  const scenarioList = rawResult.scenarioIds
    ? SCENARIOS.filter((scenario) => rawResult.scenarioIds.includes(scenario.id))
    : SCENARIOS;
  for (const variant of variantNames) {
    variants[variant] = summarizeCalls(calls.filter((call) => call.variant === variant));
  }

  const comparisons = [];
  const capsuleComparisons = [];
  const anchorComparisons = [];
  const anchorPadComparisons = [];
  const padSweepComparisons = [];
  for (const projectId of rawResult.projectIds) {
    for (const scenario of scenarioList) {
      const naturalCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === "natural");
      const cacheReadyCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === "cacheReady");
      const capsuleCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === "capsuleV2");
      const anchorCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === "anchorV3");
      const anchorPadCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === "anchorPadV4");
      const natural = summarizeCalls(naturalCalls);
      const cacheReady = summarizeCalls(cacheReadyCalls);
      const capsule = summarizeCalls(capsuleCalls);
      const anchor = summarizeCalls(anchorCalls);
      const anchorPad = summarizeCalls(anchorPadCalls);
      const naturalPromptMedian = median(naturalCalls.filter((call) => call.iteration > 0 && call.status === "success").map((call) => call.promptTokens));
      const cacheReadyPromptMedian = median(cacheReadyCalls.filter((call) => call.iteration > 0 && call.status === "success").map((call) => call.promptTokens));
      const capsulePromptMedian = median(capsuleCalls.filter((call) => call.iteration > 0 && call.status === "success").map((call) => call.promptTokens));
      const anchorPromptMedian = median(anchorCalls.filter((call) => call.iteration > 0 && call.status === "success").map((call) => call.promptTokens));
      const anchorPadPromptMedian = median(anchorPadCalls.filter((call) => call.iteration > 0 && call.status === "success").map((call) => call.promptTokens));
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
      if (naturalCalls.length > 0 && cacheReadyCalls.length > 0) {
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
      if (capsuleCalls.length > 0) {
        const capsuleCostDeltaCny =
          typeof natural.medianEstimatedCostCny === "number" && typeof capsule.medianEstimatedCostCny === "number"
            ? capsule.medianEstimatedCostCny - natural.medianEstimatedCostCny
            : null;
        const capsuleCostDeltaPercent =
          typeof capsuleCostDeltaCny === "number" && natural.medianEstimatedCostCny
            ? capsuleCostDeltaCny / natural.medianEstimatedCostCny
            : null;
        const capsulePromptReductionVsCacheReady =
          typeof cacheReadyPromptMedian === "number" && typeof capsulePromptMedian === "number" && cacheReadyPromptMedian > 0
            ? (cacheReadyPromptMedian - capsulePromptMedian) / cacheReadyPromptMedian
            : null;
        capsuleComparisons.push({
          projectId,
          scenarioId: scenario.id,
          naturalMedianPromptTokens: naturalPromptMedian,
          cacheReadyMedianPromptTokens: cacheReadyPromptMedian,
          capsuleV2MedianPromptTokens: capsulePromptMedian,
          capsuleV2PromptReductionVsCacheReady: capsulePromptReductionVsCacheReady,
          naturalMedianCacheRatio: natural.medianCacheRatio,
          capsuleV2MedianCacheRatio: capsule.medianCacheRatio,
          naturalMedianEstimatedCostCny: natural.medianEstimatedCostCny,
          capsuleV2MedianEstimatedCostCny: capsule.medianEstimatedCostCny,
          capsuleV2CostDeltaCny: capsuleCostDeltaCny,
          capsuleV2CostDeltaPercent: capsuleCostDeltaPercent,
          capsuleV2CacheRatioWin:
            typeof natural.medianCacheRatio === "number" &&
            typeof capsule.medianCacheRatio === "number" &&
            capsule.medianCacheRatio > natural.medianCacheRatio,
          capsuleV2EstimatedCostWin:
            typeof natural.medianEstimatedCostCny === "number" &&
            typeof capsule.medianEstimatedCostCny === "number" &&
            capsule.medianEstimatedCostCny < natural.medianEstimatedCostCny,
        });
      }
      if (anchorCalls.length > 0) {
        const anchorCostDeltaCny =
          typeof natural.medianEstimatedCostCny === "number" && typeof anchor.medianEstimatedCostCny === "number"
            ? anchor.medianEstimatedCostCny - natural.medianEstimatedCostCny
            : null;
        const anchorCostDeltaPercent =
          typeof anchorCostDeltaCny === "number" && natural.medianEstimatedCostCny
            ? anchorCostDeltaCny / natural.medianEstimatedCostCny
            : null;
        anchorComparisons.push({
          projectId,
          scenarioId: scenario.id,
          naturalMedianPromptTokens: naturalPromptMedian,
          cacheReadyMedianPromptTokens: cacheReadyPromptMedian,
          capsuleV2MedianPromptTokens: capsulePromptMedian,
          anchorV3MedianPromptTokens: anchorPromptMedian,
          naturalMedianCachedTokens: natural.medianCachedTokens,
          anchorV3MedianCachedTokens: anchor.medianCachedTokens,
          naturalMedianCacheRatio: natural.medianCacheRatio,
          anchorV3MedianCacheRatio: anchor.medianCacheRatio,
          naturalMedianEstimatedCostCny: natural.medianEstimatedCostCny,
          anchorV3MedianEstimatedCostCny: anchor.medianEstimatedCostCny,
          anchorV3CostDeltaCny: anchorCostDeltaCny,
          anchorV3CostDeltaPercent: anchorCostDeltaPercent,
          anchorV3CacheRatioWin:
            typeof natural.medianCacheRatio === "number" &&
            typeof anchor.medianCacheRatio === "number" &&
            anchor.medianCacheRatio > natural.medianCacheRatio,
          anchorV3EstimatedCostWin:
            typeof natural.medianEstimatedCostCny === "number" &&
            typeof anchor.medianEstimatedCostCny === "number" &&
            anchor.medianEstimatedCostCny < natural.medianEstimatedCostCny,
        });
      }
      if (anchorPadCalls.length > 0) {
        const anchorPadCostDeltaCny =
          typeof natural.medianEstimatedCostCny === "number" && typeof anchorPad.medianEstimatedCostCny === "number"
            ? anchorPad.medianEstimatedCostCny - natural.medianEstimatedCostCny
            : null;
        const anchorPadCostDeltaPercent =
          typeof anchorPadCostDeltaCny === "number" && natural.medianEstimatedCostCny
            ? anchorPadCostDeltaCny / natural.medianEstimatedCostCny
            : null;
        anchorPadComparisons.push({
          projectId,
          scenarioId: scenario.id,
          naturalMedianPromptTokens: naturalPromptMedian,
          anchorV3MedianPromptTokens: anchorPromptMedian,
          anchorPadV4MedianPromptTokens: anchorPadPromptMedian,
          naturalMedianCachedTokens: natural.medianCachedTokens,
          anchorPadV4MedianCachedTokens: anchorPad.medianCachedTokens,
          naturalMedianCacheRatio: natural.medianCacheRatio,
          anchorPadV4MedianCacheRatio: anchorPad.medianCacheRatio,
          naturalMedianEstimatedCostCny: natural.medianEstimatedCostCny,
          anchorPadV4MedianEstimatedCostCny: anchorPad.medianEstimatedCostCny,
          anchorPadV4CostDeltaCny: anchorPadCostDeltaCny,
          anchorPadV4CostDeltaPercent: anchorPadCostDeltaPercent,
          anchorPadV4CacheRatioWin:
            typeof natural.medianCacheRatio === "number" &&
            typeof anchorPad.medianCacheRatio === "number" &&
            anchorPad.medianCacheRatio > natural.medianCacheRatio,
          anchorPadV4EstimatedCostWin:
            typeof natural.medianEstimatedCostCny === "number" &&
            typeof anchorPad.medianEstimatedCostCny === "number" &&
            anchorPad.medianEstimatedCostCny < natural.medianEstimatedCostCny,
        });
      }
      if (rawResult.mode === "padSweep") {
        const baselineCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === "anchorPad8");
        const baseline = summarizeCalls(baselineCalls);
        for (const { variant, padLength } of PAD_SWEEP_VARIANTS) {
          if (variant === "anchorPad8") continue;
          const candidateCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === variant);
          const candidate = summarizeCalls(candidateCalls);
          const costDeltaCny =
            typeof baseline.medianEstimatedCostCny === "number" && typeof candidate.medianEstimatedCostCny === "number"
              ? candidate.medianEstimatedCostCny - baseline.medianEstimatedCostCny
              : null;
          const costDeltaPercent =
            typeof costDeltaCny === "number" && baseline.medianEstimatedCostCny
              ? costDeltaCny / baseline.medianEstimatedCostCny
              : null;
          padSweepComparisons.push({
            projectId,
            scenarioId: scenario.id,
            baselineVariant: "anchorPad8",
            candidateVariant: variant,
            candidatePadLength: padLength,
            baselineMedianCachedTokens: baseline.medianCachedTokens,
            candidateMedianCachedTokens: candidate.medianCachedTokens,
            baselineMedianCacheRatio: baseline.medianCacheRatio,
            candidateMedianCacheRatio: candidate.medianCacheRatio,
            baselineMedianEstimatedCostCny: baseline.medianEstimatedCostCny,
            candidateMedianEstimatedCostCny: candidate.medianEstimatedCostCny,
            candidateCostDeltaCny: costDeltaCny,
            candidateCostDeltaPercent: costDeltaPercent,
            candidateEstimatedCostWin:
              typeof baseline.medianEstimatedCostCny === "number" &&
              typeof candidate.medianEstimatedCostCny === "number" &&
              candidate.medianEstimatedCostCny < baseline.medianEstimatedCostCny,
          });
        }
      }
    }
  }

  const wins = comparisons.filter((item) => item.cacheReadyCachedTokenWin).length;
  const normalizedComparisons = comparisons.filter((item) => item.lengthNormalized);
  const ratioWins = normalizedComparisons.filter((item) => item.cacheReadyCacheRatioWin).length;
  const costWins = normalizedComparisons.filter((item) => item.cacheReadyEstimatedCostWin).length;
  const capsuleRatioWins = capsuleComparisons.filter((item) => item.capsuleV2CacheRatioWin).length;
  const capsuleCostWins = capsuleComparisons.filter((item) => item.capsuleV2EstimatedCostWin).length;
  const anchorRatioWins = anchorComparisons.filter((item) => item.anchorV3CacheRatioWin).length;
  const anchorCostWins = anchorComparisons.filter((item) => item.anchorV3EstimatedCostWin).length;
  const anchorPadRatioWins = anchorPadComparisons.filter((item) => item.anchorPadV4CacheRatioWin).length;
  const anchorPadCostWins = anchorPadComparisons.filter((item) => item.anchorPadV4EstimatedCostWin).length;
  const cacheFieldVisibilityRate = validRequestCount ? cacheFieldVisibleCount / validRequestCount : 0;
  const validRequestRate = calls.length ? validRequestCount / calls.length : 0;
  const naturalCost = variants.natural?.medianEstimatedCostCny;
  const cacheReadyCost = variants.cacheReady?.medianEstimatedCostCny;
  const capsuleCost = variants.capsuleV2?.medianEstimatedCostCny;
  const anchorCost = variants.anchorV3?.medianEstimatedCostCny;
  const anchorPadCost = variants.anchorPadV4?.medianEstimatedCostCny;
  const overallCostDeltaCny =
    typeof naturalCost === "number" && typeof cacheReadyCost === "number" ? cacheReadyCost - naturalCost : null;
  const overallCostDeltaPercent =
    typeof overallCostDeltaCny === "number" && naturalCost ? overallCostDeltaCny / naturalCost : null;
  const capsuleV2OverallCostDeltaCny =
    typeof naturalCost === "number" && typeof capsuleCost === "number" ? capsuleCost - naturalCost : null;
  const capsuleV2OverallCostDeltaPercent =
    typeof capsuleV2OverallCostDeltaCny === "number" && naturalCost ? capsuleV2OverallCostDeltaCny / naturalCost : null;
  const anchorV3OverallCostDeltaCny =
    typeof naturalCost === "number" && typeof anchorCost === "number" ? anchorCost - naturalCost : null;
  const anchorV3OverallCostDeltaPercent =
    typeof anchorV3OverallCostDeltaCny === "number" && naturalCost ? anchorV3OverallCostDeltaCny / naturalCost : null;
  const anchorPadV4OverallCostDeltaCny =
    typeof naturalCost === "number" && typeof anchorPadCost === "number" ? anchorPadCost - naturalCost : null;
  const anchorPadV4OverallCostDeltaPercent =
    typeof anchorPadV4OverallCostDeltaCny === "number" && naturalCost ? anchorPadV4OverallCostDeltaCny / naturalCost : null;
  const largeSampleThreshold = Math.max(324, Math.ceil(calls.length * 0.9));
  const ratioEvidence =
    rawResult.mode === "normalized" &&
    validRequestCount >= largeSampleThreshold &&
    cacheFieldVisibilityRate >= 0.95 &&
    normalizedComparisons.length >= 15 &&
    ratioWins >= 15;
  const costEvidence =
    rawResult.mode === "normalized" &&
    validRequestCount >= largeSampleThreshold &&
    cacheFieldVisibilityRate >= 0.95 &&
    normalizedComparisons.length >= 15 &&
    costWins >= 15 &&
    typeof overallCostDeltaPercent === "number" &&
    overallCostDeltaPercent <= -0.05;
  const capsuleInitialCostEvidence =
    rawResult.mode === "capsule" &&
    validRequestCount >= largeSampleThreshold &&
    cacheFieldVisibilityRate >= 0.95 &&
    capsuleComparisons.length >= 15 &&
    capsuleCostWins >= 12 &&
    typeof capsuleV2OverallCostDeltaPercent === "number" &&
    capsuleV2OverallCostDeltaPercent <= -0.03;
  const capsuleStrongCostEvidence =
    rawResult.mode === "capsule" &&
    validRequestCount >= largeSampleThreshold &&
    cacheFieldVisibilityRate >= 0.95 &&
    capsuleComparisons.length >= 15 &&
    capsuleCostWins >= 15 &&
    typeof capsuleV2OverallCostDeltaPercent === "number" &&
    capsuleV2OverallCostDeltaPercent <= -0.05;
  const capsuleRatioSignal =
    rawResult.mode === "capsule" &&
    validRequestCount >= largeSampleThreshold &&
    cacheFieldVisibilityRate >= 0.95 &&
    capsuleComparisons.length >= 15 &&
    capsuleRatioWins >= 12;
  const capsuleConclusionLevel = capsuleStrongCostEvidence
    ? "capsule_cost_large_sample_evidence"
    : (capsuleInitialCostEvidence || capsuleRatioSignal ? "capsule_promising_signal" : "capsule_inconclusive");
  const anchorInitialCostEvidence =
    rawResult.mode === "anchor" &&
    validRequestCount >= largeSampleThreshold &&
    cacheFieldVisibilityRate >= 0.95 &&
    anchorComparisons.length >= 15 &&
    anchorCostWins >= 12 &&
    typeof anchorV3OverallCostDeltaPercent === "number" &&
    anchorV3OverallCostDeltaPercent <= -0.03;
  const anchorStrongCostEvidence =
    rawResult.mode === "anchor" &&
    validRequestCount >= largeSampleThreshold &&
    cacheFieldVisibilityRate >= 0.95 &&
    anchorComparisons.length >= 15 &&
    anchorCostWins >= 15 &&
    typeof anchorV3OverallCostDeltaPercent === "number" &&
    anchorV3OverallCostDeltaPercent <= -0.05;
  const anchorRatioSignal =
    rawResult.mode === "anchor" &&
    validRequestCount >= largeSampleThreshold &&
    cacheFieldVisibilityRate >= 0.95 &&
    anchorComparisons.length >= 15 &&
    anchorRatioWins >= 12;
  const anchorConclusionLevel = anchorStrongCostEvidence
    ? "anchor_cost_large_sample_evidence"
    : (anchorInitialCostEvidence || anchorRatioSignal ? "anchor_promising_signal" : "anchor_inconclusive");
  const anchorPadInitialCostEvidence =
    rawResult.mode === "anchorpad" &&
    validRequestCount >= largeSampleThreshold &&
    cacheFieldVisibilityRate >= 0.95 &&
    anchorPadComparisons.length >= 15 &&
    anchorPadCostWins >= 12 &&
    typeof anchorPadV4OverallCostDeltaPercent === "number" &&
    anchorPadV4OverallCostDeltaPercent <= -0.03;
  const anchorPadStrongCostEvidence =
    rawResult.mode === "anchorpad" &&
    validRequestCount >= largeSampleThreshold &&
    cacheFieldVisibilityRate >= 0.95 &&
    anchorPadComparisons.length >= 15 &&
    anchorPadCostWins >= 15 &&
    typeof anchorPadV4OverallCostDeltaPercent === "number" &&
    anchorPadV4OverallCostDeltaPercent <= -0.05;
  const anchorPadRatioSignal =
    rawResult.mode === "anchorpad" &&
    validRequestCount >= largeSampleThreshold &&
    cacheFieldVisibilityRate >= 0.95 &&
    anchorPadComparisons.length >= 15 &&
    anchorPadRatioWins >= 12;
  const anchorPadConclusionLevel = anchorPadStrongCostEvidence
    ? "anchorpad_cost_large_sample_evidence"
    : (anchorPadInitialCostEvidence || anchorPadRatioSignal ? "anchorpad_promising_signal" : "anchorpad_inconclusive");
  const padSweepStats = PAD_SWEEP_VARIANTS
    .filter((item) => item.variant !== "anchorPad8")
    .map(({ variant, padLength }) => {
      const candidateCost = variants[variant]?.medianEstimatedCostCny;
      const baselineCost = variants.anchorPad8?.medianEstimatedCostCny;
      const overallCostDeltaCny =
        typeof candidateCost === "number" && typeof baselineCost === "number"
          ? candidateCost - baselineCost
          : null;
      const overallCostDeltaPercent =
        typeof overallCostDeltaCny === "number" && baselineCost
          ? overallCostDeltaCny / baselineCost
          : null;
      const costWins = padSweepComparisons.filter((item) => item.candidateVariant === variant && item.candidateEstimatedCostWin).length;
      return { variant, padLength, costWinsVsPad8: costWins, overallCostDeltaCny, overallCostDeltaPercent };
    });
  const padSweepCandidate = padSweepStats
    .filter((item) => item.costWinsVsPad8 >= 12 && typeof item.overallCostDeltaPercent === "number" && item.overallCostDeltaPercent <= -0.05)
    .sort((a, b) => a.overallCostDeltaPercent - b.overallCostDeltaPercent)[0] || null;
  const padSweepConclusionLevel =
    rawResult.mode === "padSweep" &&
    validRequestCount >= largeSampleThreshold &&
    cacheFieldVisibilityRate >= 0.95 &&
    padSweepCandidate
      ? "pad_sweep_bb5_candidate"
      : rawResult.mode === "padSweep"
      ? "pad_sweep_no_better_candidate"
      : undefined;

  return {
    status: rawResult.status,
    startedAt: rawResult.startedAt,
    finishedAt: rawResult.finishedAt,
    providerName: rawResult.providerName,
    model: rawResult.model,
    providerProfileId: rawResult.providerProfileId,
    mode: rawResult.mode || "absolute",
    benchmarkKind: "local-real-projects-redacted",
    pricingCnyPerMillionTokens: rawResult.pricingCnyPerMillionTokens || CNY_CACHE_PRICING_PER_MILLION_TOKENS,
    projectCount: rawResult.projectIds.length,
    scenarioCount: scenarioList.length,
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
    largeSampleThreshold,
    overallCostDeltaCny,
    overallCostDeltaPercent,
    capsuleV2CacheRatioWins: capsuleComparisons.length ? capsuleRatioWins : undefined,
    capsuleV2EstimatedCostWins: capsuleComparisons.length ? capsuleCostWins : undefined,
    capsuleV2OverallCostDeltaCny,
    capsuleV2OverallCostDeltaPercent,
    capsuleV2ConclusionLevel: capsuleComparisons.length ? capsuleConclusionLevel : undefined,
    anchorV3CacheRatioWins: anchorComparisons.length ? anchorRatioWins : undefined,
    anchorV3EstimatedCostWins: anchorComparisons.length ? anchorCostWins : undefined,
    anchorV3OverallCostDeltaCny,
    anchorV3OverallCostDeltaPercent,
    anchorV3ConclusionLevel: anchorComparisons.length ? anchorConclusionLevel : undefined,
    anchorPadV4CacheRatioWins: anchorPadComparisons.length ? anchorPadRatioWins : undefined,
    anchorPadV4EstimatedCostWins: anchorPadComparisons.length ? anchorPadCostWins : undefined,
    anchorPadV4OverallCostDeltaCny,
    anchorPadV4OverallCostDeltaPercent,
    anchorPadV4ConclusionLevel: anchorPadComparisons.length ? anchorPadConclusionLevel : undefined,
    padSweepBaselineVariant: rawResult.mode === "padSweep" ? "anchorPad8" : undefined,
    padSweepCandidate,
    padSweepStats: rawResult.mode === "padSweep" ? padSweepStats : undefined,
    padSweepConclusionLevel,
    ratioConclusionLevel: ratioEvidence ? "ratio_large_sample_evidence" : "ratio_not_proven",
    costConclusionLevel: costEvidence ? "cost_large_sample_evidence" : "cost_not_proven",
    conclusionLevel:
      rawResult.mode === "padSweep"
        ? padSweepConclusionLevel
        : rawResult.mode === "anchorpad"
        ? anchorPadConclusionLevel
        : rawResult.mode === "anchor"
        ? anchorConclusionLevel
        : rawResult.mode === "capsule"
        ? capsuleConclusionLevel
        : rawResult.mode === "normalized"
        ? (ratioEvidence || costEvidence ? "normalized_large_sample_evidence" : "normalized_inconclusive")
        : (validRequestCount >= largeSampleThreshold && cacheFieldVisibilityRate >= 0.95 && wins >= 15
          ? "large_sample_evidence"
          : "inconclusive_large_sample"),
    variants,
    comparisons,
    capsuleComparisons: capsuleComparisons.length ? capsuleComparisons : undefined,
    anchorComparisons: anchorComparisons.length ? anchorComparisons : undefined,
    anchorPadComparisons: anchorPadComparisons.length ? anchorPadComparisons : undefined,
    padSweepComparisons: padSweepComparisons.length ? padSweepComparisons : undefined,
    limitations: [
      rawResult.providerLimitation || "Provider-specific benchmark; not a cross-provider conclusion.",
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
  const repeatIndex = args.indexOf("--repeat-count");
  const projectLimitIndex = args.indexOf("--project-limit");
  const scenarioLimitIndex = args.indexOf("--scenario-limit");
  const mode = modeIndex >= 0 ? args[modeIndex + 1] : "absolute";
  const defaultOutputPath =
    mode === "padSweep"
      ? "tests/outputs/private/provider-cache-benchmark-padsweep.raw.json"
      : mode === "anchorpad"
      ? "tests/outputs/private/provider-cache-benchmark-anchorpad.raw.json"
      : mode === "anchor"
      ? "tests/outputs/private/provider-cache-benchmark-anchor.raw.json"
      : mode === "capsule"
      ? "tests/outputs/private/provider-cache-benchmark-capsule.raw.json"
      : mode === "normalized"
      ? "tests/outputs/private/provider-cache-benchmark-normalized.raw.json"
      : "tests/outputs/private/provider-cache-benchmark.raw.json";
  const defaultSummaryOutputPath =
    mode === "padSweep"
      ? "tests/outputs/provider-cache-benchmark-padsweep.latest.json"
      : mode === "anchorpad"
      ? "tests/outputs/provider-cache-benchmark-anchorpad.latest.json"
      : mode === "anchor"
      ? "tests/outputs/provider-cache-benchmark-anchor.latest.json"
      : mode === "capsule"
      ? "tests/outputs/provider-cache-benchmark-capsule.latest.json"
      : mode === "normalized"
      ? "tests/outputs/provider-cache-benchmark-normalized.latest.json"
      : "tests/outputs/provider-cache-benchmark.latest.json";
  return {
    localProjects: args.includes("--local-projects"),
    mode,
    outputPath: outputIndex >= 0 ? args[outputIndex + 1] : defaultOutputPath,
    summaryOutputPath: summaryIndex >= 0 ? args[summaryIndex + 1] : defaultSummaryOutputPath,
    repeatCount: repeatIndex >= 0 ? Number(args[repeatIndex + 1]) : undefined,
    projectLimit: projectLimitIndex >= 0 ? Number(args[projectLimitIndex + 1]) : undefined,
    scenarioLimit: scenarioLimitIndex >= 0 ? Number(args[scenarioLimitIndex + 1]) : undefined,
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
  if (!["absolute", "normalized", "capsule", "anchor", "anchorpad", "padSweep"].includes(options.mode)) {
    throw new Error("Benchmark mode must be absolute, normalized, capsule, anchor, anchorpad, or padSweep.");
  }
  if (env.projectPaths.length === 0) {
    throw new Error("Missing BASEBRIEF_BENCHMARK_PROJECTS. Use semicolon-separated local project paths.");
  }

  const projectPaths = Number.isFinite(options.projectLimit) && options.projectLimit > 0
    ? env.projectPaths.slice(0, options.projectLimit)
    : env.projectPaths;
  const scenarios = Number.isFinite(options.scenarioLimit) && options.scenarioLimit > 0
    ? SCENARIOS.slice(0, options.scenarioLimit)
    : SCENARIOS;
  const repeats = Number.isFinite(options.repeatCount) && options.repeatCount > 0
    ? options.repeatCount
    : env.repeats;
  const projectIds = projectPaths.map((_, index) => `project${String.fromCharCode(65 + index)}`);
  const snapshots = projectPaths.map((projectPath, index) => buildProjectSnapshot(projectPath, projectIds[index]));
  const rawResult = {
    status: "executed",
    startedAt: nowIso(),
    finishedAt: null,
    providerName: env.providerName,
    model: env.model,
    providerProfileId: env.providerProfileId,
    providerLimitation: env.providerLimitation,
    mode: options.mode,
    pricingCnyPerMillionTokens: env.pricingCnyPerMillionTokens,
    repeats,
    projectIds,
    scenarioIds: scenarios.map((scenario) => scenario.id),
    calls: [],
  };

  const variantsForRun = getVariantsForMode(options.mode);
  const totalRequests = snapshots.length * scenarios.length * variantsForRun.length * repeats;
  let completed = 0;

  for (const snapshot of snapshots) {
    for (const scenario of scenarios) {
      for (const variant of variantsForRun) {
        for (let iteration = 0; iteration < repeats; iteration += 1) {
          const input = getPromptForVariant(options.mode, snapshot, scenario, iteration, variant);
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
  getPromptForVariant,
  runBenchmark,
  SCENARIOS,
  PAD_SWEEP_VARIANTS,
  PROVIDER_PROFILES,
};
