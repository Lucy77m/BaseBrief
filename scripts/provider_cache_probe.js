#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { generateFromObject } = require("./generate_cache_ready_lite");

const repoRoot = path.resolve(__dirname, "..");

function nowIso() {
  return new Date().toISOString();
}

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function buildPromptPairs() {
  const naturalWarmup = readText("tests/fixtures/cache-ready/lite-followup-a.md");
  const naturalRepeat = readText("tests/fixtures/cache-ready/lite-followup-b.md");
  const cacheWarmup = generateFromObject(readJson("tests/fixtures/cache-ready/cache-ready-followup-a.json"));
  const cacheRepeat = generateFromObject(readJson("tests/fixtures/cache-ready/cache-ready-followup-b.json"));
  return {
    natural: { warmup: naturalWarmup, repeat: naturalRepeat },
    cacheReady: { warmup: cacheWarmup, repeat: cacheRepeat },
  };
}

function getEnvConfig() {
  return {
    baseUrl: process.env.BASEBRIEF_PROVIDER_BASE_URL || "",
    apiKey: process.env.BASEBRIEF_PROVIDER_API_KEY || "",
    model: process.env.BASEBRIEF_PROVIDER_MODEL || "",
    providerName: process.env.BASEBRIEF_PROVIDER_NAME || "openai-compatible",
  };
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
    cacheFieldVisible: cachedTokens !== null,
  };
}

async function callResponses(baseUrl, apiKey, model, input) {
  const url = `${baseUrl.replace(/\/+$/, "")}/responses`;
  const start = Date.now();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input,
      temperature: 0,
      max_output_tokens: 64,
    }),
  });
  const totalLatencyMs = Date.now() - start;
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`responses endpoint failed: ${response.status} ${text.slice(0, 300)}`);
  }
  const data = JSON.parse(text);
  return {
    endpoint: "responses",
    totalLatencyMs,
    firstTokenLatencyMs: null,
    ...extractUsageMetrics(data),
  };
}

async function callChatCompletions(baseUrl, apiKey, model, input) {
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const start = Date.now();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: input }],
      temperature: 0,
      max_tokens: 64,
    }),
  });
  const totalLatencyMs = Date.now() - start;
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`chat/completions endpoint failed: ${response.status} ${text.slice(0, 300)}`);
  }
  const data = JSON.parse(text);
  return {
    endpoint: "chat/completions",
    totalLatencyMs,
    firstTokenLatencyMs: null,
    ...extractUsageMetrics(data),
  };
}

async function callOpenAICompatible(baseUrl, apiKey, model, input) {
  try {
    return await callResponses(baseUrl, apiKey, model, input);
  } catch (error) {
    return {
      ...(await callChatCompletions(baseUrl, apiKey, model, input)),
      fallbackReason: error.message,
    };
  }
}

async function runProviderProbe() {
  const env = getEnvConfig();
  const startedAt = nowIso();
  if (!env.baseUrl || !env.apiKey || !env.model) {
    return {
      status: "skipped",
      startedAt,
      finishedAt: nowIso(),
      reason: "Missing BASEBRIEF_PROVIDER_BASE_URL, BASEBRIEF_PROVIDER_API_KEY, or BASEBRIEF_PROVIDER_MODEL",
      providerName: env.providerName,
      model: env.model || null,
      calls: [],
    };
  }

  const promptPairs = buildPromptPairs();
  const calls = [];
  for (const [variant, prompts] of Object.entries(promptPairs)) {
    const warmupMetrics = await callOpenAICompatible(env.baseUrl, env.apiKey, env.model, prompts.warmup);
    calls.push({ variant, phase: "warmup", ...warmupMetrics });
    const repeatMetrics = await callOpenAICompatible(env.baseUrl, env.apiKey, env.model, prompts.repeat);
    calls.push({ variant, phase: "repeat", ...repeatMetrics });
  }

  return {
    status: "executed",
    startedAt,
    finishedAt: nowIso(),
    providerName: env.providerName,
    model: env.model,
    calls,
  };
}

async function cli() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes("--json");
  const outputIndex = args.indexOf("--output");
  const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;
  const result = await runProviderProbe();
  const serialized = JSON.stringify(result, null, 2);
  if (outputPath) {
    const resolved = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, `${serialized}\n`, "utf8");
  }
  if (jsonMode || !outputPath) {
    console.log(serialized);
  }
}

if (require.main === module) {
  cli().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { runProviderProbe };
