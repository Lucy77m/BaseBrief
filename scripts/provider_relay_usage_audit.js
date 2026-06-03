#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");

const GPT55_OFFICIAL_REFERENCE_PRICING_USD_PER_MILLION_TOKENS = {
  input: 5,
  cachedInput: 0.5,
  output: 30,
  effectiveDate: "2026-06-03",
  source: "OpenAI GPT-5.5 official reference pricing",
};

function getEnvConfig() {
  return {
    baseUrl: process.env.BASEBRIEF_PROVIDER_BASE_URL || "",
    authValue: process.env.BASEBRIEF_PROVIDER_API_KEY || "",
    model: process.env.BASEBRIEF_PROVIDER_MODEL || "",
    providerName: process.env.BASEBRIEF_PROVIDER_NAME || "third-party-relay",
    providerProfileId: process.env.BASEBRIEF_PROVIDER_PROFILE || "relay-openai-gpt55-codex-oauth",
    timeoutMs: Number(process.env.BASEBRIEF_PROVIDER_TIMEOUT_MS || 30000),
    maxOutputTokens: Number(process.env.BASEBRIEF_BENCHMARK_MAX_OUTPUT_TOKENS || 16),
  };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const outputIndex = args.indexOf("--output");
  const summaryIndex = args.indexOf("--summary-output");
  const repeatIndex = args.indexOf("--repeat-count");
  return {
    outputPath: outputIndex >= 0 ? args[outputIndex + 1] : "tests/outputs/private/provider-relay-usage-audit.raw.json",
    summaryOutputPath: summaryIndex >= 0 ? args[summaryIndex + 1] : "tests/outputs/provider-relay-usage-audit.latest.json",
    repeatCount: repeatIndex >= 0 ? Number(args[repeatIndex + 1]) : 4,
    jsonMode: args.includes("--json"),
  };
}

function writeJson(relativeOrAbsolutePath, data) {
  const resolved = path.resolve(repoRoot, relativeOrAbsolutePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(data, null, 2)}\n`, "utf8");
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

function extractUsageShape(data) {
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
    usageKeys: Object.keys(usage).sort(),
    promptTokenField: usage.prompt_tokens !== undefined ? "prompt_tokens" : usage.input_tokens !== undefined ? "input_tokens" : null,
    completionTokenField: usage.completion_tokens !== undefined ? "completion_tokens" : usage.output_tokens !== undefined ? "output_tokens" : null,
    cachedTokenField:
      usage?.prompt_tokens_details?.cached_tokens !== undefined
        ? "prompt_tokens_details.cached_tokens"
        : usage?.input_tokens_details?.cached_tokens !== undefined
        ? "input_tokens_details.cached_tokens"
        : usage?.cached_tokens !== undefined
        ? "cached_tokens"
        : null,
    promptTokens,
    completionTokens,
    totalTokens,
    cachedTokens,
    usageVisible: typeof promptTokens === "number" && typeof completionTokens === "number",
    cacheFieldVisible: cachedTokens !== null,
  };
}

async function callChatCompletions(env, prompt, label, iteration) {
  const url = `${env.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const started = Date.now();
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.authValue}`,
    },
    body: JSON.stringify({
      model: env.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: env.maxOutputTokens,
    }),
  }, env.timeoutMs);
  const totalLatencyMs = Date.now() - started;
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`chat/completions failed: ${response.status} ${response.statusText}`);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("chat/completions returned non-JSON response");
  }
  return {
    label,
    iteration,
    status: "success",
    totalLatencyMs,
    ...extractUsageShape(data),
  };
}

function uniqueNumbers(values) {
  return [...new Set(values.filter((value) => typeof value === "number" && Number.isFinite(value)))];
}

function classifyRelayUsage(calls, consecutiveFailureLimit = 5) {
  const successes = calls.filter((call) => call.status === "success");
  const failures = calls.filter((call) => call.status !== "success");
  const validRequestRate = calls.length ? successes.length / calls.length : 0;
  const usageVisibleCount = successes.filter((call) => call.usageVisible).length;
  const cacheFieldVisibleCount = successes.filter((call) => call.cacheFieldVisible).length;
  const identical = successes.filter((call) => call.label === "identical");
  const identicalPromptTokenValues = uniqueNumbers(identical.map((call) => call.promptTokens));
  const identicalCachedTokenValues = uniqueNumbers(identical.map((call) => call.cachedTokens));
  const promptTokensChangedAcrossIdentical = identicalPromptTokenValues.length > 1;
  const cachedTokensChangedAcrossIdentical = identicalCachedTokenValues.length > 1;

  let maxConsecutiveFailures = 0;
  let currentFailures = 0;
  for (const call of calls) {
    if (call.status === "success") {
      currentFailures = 0;
    } else {
      currentFailures += 1;
      maxConsecutiveFailures = Math.max(maxConsecutiveFailures, currentFailures);
    }
  }

  const usageFieldStable = successes.length > 0 && usageVisibleCount === successes.length;
  const cacheFieldVisibleRate = successes.length ? cacheFieldVisibleCount / successes.length : 0;
  const usageInterpretation =
    !usageFieldStable
      ? "usage_unusable"
      : cacheFieldVisibleCount === successes.length
      ? "cache_tokens_visible"
      : promptTokensChangedAcrossIdentical
      ? "input_tokens_may_reflect_billing_or_relay_accounting"
      : "token_length_observation_only";
  const stopReason =
    maxConsecutiveFailures >= consecutiveFailureLimit
      ? "consecutive_failures"
      : validRequestRate < 0.9
      ? "low_valid_request_rate"
      : !usageFieldStable
      ? "usage_missing_or_inconsistent"
      : usageInterpretation === "token_length_observation_only"
      ? "cache_cost_not_observable"
      : null;

  return {
    requestCount: calls.length,
    validRequestCount: successes.length,
    failureCount: failures.length,
    validRequestRate,
    usageVisibleCount,
    cacheFieldVisibleCount,
    cacheFieldVisibleRate,
    identicalPromptTokenValues,
    identicalCachedTokenValues,
    promptTokensChangedAcrossIdentical,
    cachedTokensChangedAcrossIdentical,
    usageInterpretation,
    benchmarkRecommended: stopReason === null,
    stopRecommended: stopReason !== null,
    stopReason,
    maxConsecutiveFailures,
  };
}

function buildAuditPrompts() {
  const stable = [
    "BASEBRIEF_RELAY_USAGE_AUDIT",
    "This is a synthetic provider usage audit.",
    "Do not include secrets or private project data.",
    "Stable prefix line 01.",
    "Stable prefix line 02.",
    "Stable prefix line 03.",
    "Return exactly: ok",
  ].join("\n");
  return {
    identical: stable,
    varied: `${stable}\nDynamic suffix: variant B`,
  };
}

async function runAudit(options = {}) {
  const env = getEnvConfig();
  if (!env.baseUrl || !env.authValue || !env.model) {
    throw new Error("Missing BASEBRIEF_PROVIDER_BASE_URL, BASEBRIEF_PROVIDER_API_KEY, or BASEBRIEF_PROVIDER_MODEL");
  }
  const repeatCount = Number.isFinite(options.repeatCount) && options.repeatCount > 0 ? options.repeatCount : 4;
  const prompts = buildAuditPrompts();
  const calls = [];
  const startedAt = new Date().toISOString();
  const consecutiveFailureLimit = 5;
  let consecutiveFailures = 0;

  for (let iteration = 0; iteration < repeatCount; iteration += 1) {
    try {
      const result = await callChatCompletions(env, prompts.identical, "identical", iteration);
      calls.push(result);
      consecutiveFailures = 0;
    } catch (error) {
      consecutiveFailures += 1;
      calls.push({ label: "identical", iteration, status: "failed", error: error.message });
      if (consecutiveFailures >= consecutiveFailureLimit) break;
    }
  }

  for (let iteration = 0; iteration < Math.min(2, repeatCount) && consecutiveFailures < consecutiveFailureLimit; iteration += 1) {
    try {
      const result = await callChatCompletions(env, prompts.varied, "varied", iteration);
      calls.push(result);
      consecutiveFailures = 0;
    } catch (error) {
      consecutiveFailures += 1;
      calls.push({ label: "varied", iteration, status: "failed", error: error.message });
      if (consecutiveFailures >= consecutiveFailureLimit) break;
    }
  }

  const summary = {
    status: "executed",
    startedAt,
    finishedAt: new Date().toISOString(),
    providerName: env.providerName,
    model: env.model,
    providerProfileId: env.providerProfileId,
    benchmarkKind: "relay-usage-audit-redacted",
    routeType: "third_party_relay",
    evidenceLevel: "relay_specific_observation",
    pricingBasis: "openai_official_reference_price",
    billingAudited: false,
    officialReferencePricingUsdPerMillionTokens: GPT55_OFFICIAL_REFERENCE_PRICING_USD_PER_MILLION_TOKENS,
    ...classifyRelayUsage(calls, consecutiveFailureLimit),
    limitations: [
      "Third-party relay observation only; not OpenAI official API evidence.",
      "This audit checks provider-visible usage fields, not real relay billing.",
      "Synthetic prompts are used; no private project content is sent.",
    ],
  };

  const raw = { ...summary, calls };
  writeJson(options.outputPath, raw);
  writeJson(options.summaryOutputPath, summary);
  return summary;
}

if (require.main === module) {
  const options = parseArgs(process.argv);
  runAudit(options).then((summary) => {
    if (options.jsonMode) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log(`relay_usage_audit_status=${summary.usageInterpretation}`);
      console.log(`benchmark_recommended=${summary.benchmarkRecommended}`);
      if (summary.stopReason) console.log(`stop_reason=${summary.stopReason}`);
    }
    if (summary.stopRecommended) {
      process.exitCode = 2;
    }
  }).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  classifyRelayUsage,
  extractUsageShape,
  runAudit,
  GPT55_OFFICIAL_REFERENCE_PRICING_USD_PER_MILLION_TOKENS,
};
