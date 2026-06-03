#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { generateAnchorFromObject } = require("./generate_cache_ready_anchor");
const { generateBb9HandoffFromObject } = require("./generate_bb9_handoff");

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

const GPT55_OFFICIAL_REFERENCE_PRICING_USD_PER_MILLION_TOKENS = {
  input: 5,
  cachedInput: 0.5,
  output: 30,
  effectiveDate: "2026-06-03",
  source: "OpenAI GPT-5.5 official reference pricing",
};

const PROVIDER_PROFILES = {
  "mimo-v2.5": {
    providerName: "xiaomimimo",
    model: "mimo-v2.5",
    routeType: "direct_provider",
    evidenceLevel: "provider_specific_evidence",
    pricingBasis: "provider_official_price",
    billingAudited: false,
    pricingCnyPerMillionTokens: CNY_CACHE_PRICING_PER_MILLION_TOKENS,
    limitation: "MiMo mimo-v2.5 only; not a cross-provider conclusion.",
  },
  "deepseek-v4-flash": {
    providerName: "deepseek",
    model: "deepseek-v4-flash",
    routeType: "direct_provider",
    evidenceLevel: "provider_specific_evidence",
    pricingBasis: "provider_official_price",
    billingAudited: false,
    pricingCnyPerMillionTokens: CNY_CACHE_PRICING_PER_MILLION_TOKENS,
    limitation: "DeepSeek deepseek-v4-flash only; not a cross-provider conclusion.",
  },
  "relay-openai-gpt55-codex-oauth": {
    providerName: "sanye-relay",
    model: "gpt-5.5",
    routeType: "third_party_relay",
    evidenceLevel: "relay_specific_observation",
    pricingBasis: "openai_official_reference_price",
    billingAudited: false,
    officialReferencePricingUsdPerMillionTokens: GPT55_OFFICIAL_REFERENCE_PRICING_USD_PER_MILLION_TOKENS,
    pricingCnyPerMillionTokens: null,
    limitation: "GPT-5.5 via third-party relay only; not OpenAI official API evidence.",
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

function buildReadableFactLines(snapshot, compact = false) {
  const files = compact ? snapshot.fileSample.slice(0, 30) : snapshot.fileSample;
  return [
    `- README excerpt: ${sanitizeText(snapshot.readmeExcerpt || "none", compact ? 700 : 1100)}`,
    `- Package summary: ${sanitizeText(JSON.stringify(snapshot.packages), compact ? 700 : 1200)}`,
    `- Entry and config files: ${sanitizeText([...snapshot.entryFiles, ...snapshot.configFiles].join(" | ") || "none", 600)}`,
    `- File sample: ${sanitizeText(files.join(" | "), compact ? 800 : 1200)}`,
  ];
}

function buildReadablePocPrompt(snapshot, scenario, iteration, variant) {
  const tailRequest = scenario.tailRequests[iteration % scenario.tailRequests.length];
  const isLite = variant === "readableLite" || variant === "readableLitePad4";
  const withPad = variant === "readableFullPad4" || variant === "readableLitePad4";
  const padLine = withPad ? ["<!-- BASEBRIEF_CACHE_PAD: p p p p -->"] : [];
  if (isLite) {
    return [
      "# BaseBrief Readable Lite POC",
      "FORMAT: readable-lite-continuation",
      "RULE: Keep sections before the cache pad stable; put request variation only after the dynamic tail heading.",
      "",
      "## Project Identity",
      `${snapshot.projectId}/${scenario.id}: local real-project benchmark snapshot`,
      "",
      "## Current Goal",
      scenario.label,
      "",
      "## verified_facts",
      ...buildReadableFactLines(snapshot, true),
      "",
      "## confirmed_decisions",
      "- Source project is read-only.",
      "- Sensitive files and generated directories are excluded.",
      "",
      "## risk_boundaries",
      "- Do not read or output env files, tokens, secrets, or credentials.",
      "- Do not write to the source project.",
      "",
      "## expected_output",
      "A concise Lite-style BaseBrief continuation answer.",
      "",
      ...padLine,
      "## Dynamic Tail Request",
      tailRequest,
    ].join("\n");
  }

  return [
    "# BaseBrief Readable Full POC",
    "FORMAT: readable-full-continuation",
    "RULE: Keep sections before the cache pad stable; put request variation only after the dynamic tail heading.",
    "",
    "## 1. Project Identity",
    `${snapshot.projectId}/${scenario.id}: local real-project benchmark snapshot`,
    "",
    "## 2. Current Goal",
    scenario.label,
    "",
    "## 3. verified_facts",
    ...buildReadableFactLines(snapshot, false),
    "",
    "## 4. confirmed_decisions",
    "- Source project is read-only.",
    "- Sensitive files and generated directories are excluded.",
    "",
    "## 5. assumptions",
    "- No unverified project assumptions are added in this benchmark prompt.",
    "",
    "## 6. open_questions",
    "- None; this prompt measures continuation format behavior only.",
    "",
    "## 7. risk_boundaries",
    "- Do not read or output env files, tokens, secrets, or credentials.",
    "- Do not write to the source project.",
    "",
    "## 8. expected_output",
    "A readable Full-style BaseBrief continuation answer.",
    "",
    ...padLine,
    "## 9. Dynamic Tail Request",
    tailRequest,
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

function buildBb5SidecarPrompt(snapshot, scenario, iteration, variant) {
  const isLite = variant === "bb5SidecarLite";
  const choice = iteration % scenario.tailRequests.length === 0 ? "A" : "B";
  const readmeLength = isLite ? 500 : 900;
  const packageLength = isLite ? 500 : 900;
  const fileLength = isLite ? 700 : 1200;
  return [
    "BB5S",
    `S=${isLite ? "lite" : "full"}`,
    `P=${snapshot.projectId}/${scenario.id}: local real-project benchmark snapshot`,
    `G=${scenario.label}`,
    `F=readme:${sanitizeText(snapshot.readmeExcerpt || "none", readmeLength)} ; pkg:${sanitizeText(JSON.stringify(snapshot.packages), packageLength)} ; files:${sanitizeText(snapshot.fileSample.join(" | "), fileLength)}`,
    "D=source project is read-only ; sensitive files and generated directories are excluded",
    "R=do not read or output env files, tokens, secrets, or credentials",
    "X=.env ; token ; secret ; credential ; source project writes",
    `O=${isLite ? "concise Lite-style continuation answer" : "readable Full-style continuation answer"}`,
    `QAA=${sanitizeText(scenario.tailRequests[0], 300)}`,
    `QAB=${sanitizeText(scenario.tailRequests[1], 300)}`,
    "PAD=p p p p",
    "--",
    `Q=${choice}`,
  ].join("\n");
}

function buildBb6HybridPrompt(snapshot, scenario, iteration, variant) {
  const isLite = variant === "bb6HybridLite";
  const choice = iteration % scenario.tailRequests.length === 0 ? "A" : "B";
  const readmeLength = isLite ? 700 : 1200;
  const packageLength = isLite ? 700 : 1400;
  const fileSample = isLite ? snapshot.fileSample.slice(0, 35) : snapshot.fileSample;
  const fileLength = isLite ? 900 : 1600;
  const output = isLite ? "concise Lite-style BaseBrief continuation answer" : "readable Full-style BaseBrief continuation answer";
  return [
    "# BaseBrief BB6 Hybrid Anchor",
    `FORMAT: bb6-hybrid-${isLite ? "lite" : "full"}`,
    "RULE: Keep everything before CHOICE stable across repeats; only CHOICE may change.",
    "",
    "## Project Identity",
    `${snapshot.projectId}/${scenario.id}: local real-project benchmark snapshot`,
    "",
    "## Current Goal",
    scenario.label,
    "",
    "## Stable Project Snapshot",
    `README 摘要：${sanitizeText(snapshot.readmeExcerpt || "none", readmeLength)}`,
    `package 摘要：${sanitizeText(JSON.stringify(snapshot.packages), packageLength)}`,
    `入口与配置文件：${sanitizeText([...snapshot.entryFiles, ...snapshot.configFiles].join(" | ") || "none", 700)}`,
    `文件样本：${sanitizeText(fileSample.join(" | "), fileLength)}`,
    "",
    "## Safety Boundary",
    "- Source project is read-only.",
    "- Sensitive files and generated directories are excluded.",
    "- Do not read or output env files, tokens, secrets, or credentials.",
    "",
    "## Expected Output",
    output,
    "",
    "## Stable Tail Options",
    `A=${sanitizeText(scenario.tailRequests[0], 300)}`,
    `B=${sanitizeText(scenario.tailRequests[1], 300)}`,
    "",
    "<!-- BASEBRIEF_CACHE_PAD: p p p p -->",
    "--",
    `CHOICE=${choice}`,
  ].join("\n");
}

function buildBlockPadLitePrompt(snapshot, scenario, iteration, padLength, title, format) {
  const choice = iteration % scenario.tailRequests.length === 0 ? "A" : "B";
  const blockPad = buildPadString(padLength);
  return [
    title,
    `FORMAT: ${format}`,
    "RULE: Keep everything before CHOICE stable across repeats; only CHOICE may change.",
    "",
    "## Project Identity",
    `${snapshot.projectId}/${scenario.id}: local real-project benchmark snapshot`,
    "",
    "## Current Goal",
    scenario.label,
    "",
    "## Stable Project Snapshot",
    `README 摘要：${sanitizeText(snapshot.readmeExcerpt || "none", 700)}`,
    `package 摘要：${sanitizeText(JSON.stringify(snapshot.packages), 700)}`,
    `入口与配置文件：${sanitizeText([...snapshot.entryFiles, ...snapshot.configFiles].join(" | ") || "none", 700)}`,
    `文件样本：${sanitizeText(snapshot.fileSample.slice(0, 35).join(" | "), 900)}`,
    "",
    "## Safety Boundary",
    "- Source project is read-only.",
    "- Sensitive files and generated directories are excluded.",
    "- Do not read or output env files, tokens, secrets, or credentials.",
    "",
    "## Expected Output",
    "concise Lite-style BaseBrief continuation answer",
    "",
    "## Stable Tail Options",
    `A=${sanitizeText(scenario.tailRequests[0], 300)}`,
    `B=${sanitizeText(scenario.tailRequests[1], 300)}`,
    "",
    `<!-- BASEBRIEF_CACHE_BLOCK_PAD: ${blockPad} -->`,
    "--",
    `CHOICE=${choice}`,
  ].join("\n");
}

function buildBb7BlockPadPrompt(snapshot, scenario, iteration) {
  return buildBlockPadLitePrompt(snapshot, scenario, iteration, 335, "# BaseBrief BB7 Block Pad Lite", "bb7-blockpad-lite");
}

function buildBb8AlignedBlockPadPrompt(snapshot, scenario, iteration) {
  const scenarioPadAdditions = {
    "full-baseline": 0,
    "lite-handoff": 5,
    "risk-boundary": 8,
    "next-chat-opener": 2,
    "agent-task": 6,
    "cache-ready-followup": 5,
  };
  const padLength = 335 + (scenarioPadAdditions[scenario.id] || 0);
  return buildBlockPadLitePrompt(snapshot, scenario, iteration, padLength, "# BaseBrief BB8 Aligned Block Pad Lite", "bb8-aligned-blockpad-lite");
}

function buildBb9HandoffInput(snapshot, scenario, iteration) {
  const tailRequest = scenario.tailRequests[iteration % scenario.tailRequests.length];
  return {
    project_identity: `${snapshot.projectId}/${scenario.id}: local real-project benchmark snapshot`,
    current_goal: scenario.label,
    verified_facts: [
      `readme:${sanitizeText(snapshot.readmeExcerpt || "none", 900)}`,
      `pkg:${sanitizeText(JSON.stringify(snapshot.packages), 900)}`,
      `files:${sanitizeText(snapshot.fileSample.join(" | "), 1200)}`,
      "sensitive files and generated directories are excluded",
    ],
    confirmed_decisions: [
      "source project is read-only",
      "readable handoff remains primary",
      "cache sidecar is provider-profile gated",
    ],
    assumptions: [
      "benchmark prompt only; no source project write is requested",
    ],
    open_questions: [
      "whether merged handoff plus sidecar beats readable baseline",
    ],
    risk_boundaries: [
      "do not read or output env files, tokens, secrets, or credentials",
      "do not write to the source project",
    ],
    forbidden_scope: [
      ".env",
      "token",
      "secret",
      "credential",
      "source project writes",
    ],
    expected_output: "concise BaseBrief continuation answer",
    tail_request: sanitizeText(tailRequest, 300),
  };
}

function buildBb9HandoffPrompt(snapshot, scenario, iteration, variant, providerProfileId = "mimo") {
  const isLite = variant === "readableLite" || variant === "readableLiteSidecar";
  const withSidecar = variant === "readableFullSidecar" || variant === "readableLiteSidecar";
  const output = generateBb9HandoffFromObject(
    buildBb9HandoffInput(snapshot, scenario, iteration),
    {
      mode: isLite ? "lite" : "full",
      providerProfile: withSidecar ? providerProfileId : "relay-openai-gpt55-codex-oauth",
    },
  );
  if (!withSidecar) {
    return output.readableBrief;
  }
  return [
    output.readableBrief.trimEnd(),
    "",
    "## cache_sidecar",
    output.cacheSidecar || "BB9 sidecar unavailable for this provider profile.",
  ].join("\n");
}

function buildBb10ActivePrompt(snapshot, scenario, iteration, variant, providerProfileId = "mimo") {
  const isLite = variant === "readableLite" || variant === "cacheSidecarLiteOnly";
  const output = generateBb9HandoffFromObject(
    buildBb9HandoffInput(snapshot, scenario, iteration),
    {
      mode: isLite ? "lite" : "full",
      providerProfile: providerProfileId,
    },
  );
  if (variant === "readableFull" || variant === "readableLite") {
    return output.readableBrief;
  }
  return output.activeProviderPrompt;
}

function getBb11TrimPadLength(scenario) {
  const scenarioPadAdditions = {
    "full-baseline": 0,
    "lite-handoff": 3,
    "risk-boundary": 6,
    "next-chat-opener": 1,
    "agent-task": 5,
    "cache-ready-followup": 3,
  };
  return 312 + (scenarioPadAdditions[scenario.id] || 0);
}

function buildBb11LiteTrimPrompt(snapshot, scenario, iteration, providerProfileId = "mimo") {
  const tailRequest = scenario.tailRequests[iteration % scenario.tailRequests.length];
  const padLength = getBb11TrimPadLength(scenario);
  return [
    "BB11L",
    "FORMAT=bb11-lite-trim-sidecar",
    "RULE=stable_before_tail;active_prompt_only;do_not_concat_readable",
    `PROFILE=${providerProfileId}`,
    `P=${snapshot.projectId}/${scenario.id}: local real-project benchmark snapshot`,
    `G=${scenario.label}`,
    `F=readme:${sanitizeText(snapshot.readmeExcerpt || "none", 760)} ; pkg:${sanitizeText(JSON.stringify(snapshot.packages), 760)} ; files:${sanitizeText(snapshot.fileSample.slice(0, 40).join(" | "), 960)} ; redacted_inputs:true`,
    "D=source_project_read_only ; readable_handoff_primary ; provider_profile_gated",
    "R=no_env_tokens_secrets_credentials ; no_source_project_writes",
    "X=.env ; token ; secret ; credential ; source_project_writes",
    "O=concise Lite-style BaseBrief continuation answer",
    `PAD=${buildPadString(padLength)}`,
    "--",
    `TAIL_REQUEST=${sanitizeText(tailRequest, 300)}`,
  ].join("\n");
}

function buildBb11SelectorGuardPrompt(snapshot, scenario, iteration, providerProfileId = "mimo") {
  const trimmed = buildBb11LiteTrimPrompt(snapshot, scenario, iteration, providerProfileId);
  const bb9Best = buildBb7BlockPadPrompt(snapshot, scenario, iteration);
  return trimmed.length <= bb9Best.length ? trimmed : bb9Best;
}

function buildBb11ActivePromptTrimPrompt(snapshot, scenario, iteration, variant, providerProfileId = "mimo") {
  if (variant === "readableLite" || variant === "cacheSidecarLiteOnly") {
    return buildBb10ActivePrompt(snapshot, scenario, iteration, variant, providerProfileId);
  }
  if (variant === "cacheSidecarLiteTrimOnly") {
    return buildBb11LiteTrimPrompt(snapshot, scenario, iteration, providerProfileId);
  }
  return buildBb11SelectorGuardPrompt(snapshot, scenario, iteration, providerProfileId);
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
    routeType: "openai_compatible",
    evidenceLevel: "local_observation_only",
    pricingBasis: "custom_or_unspecified",
    billingAudited: false,
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
    routeType: providerProfile.routeType,
    evidenceLevel: providerProfile.evidenceLevel,
    pricingBasis: providerProfile.pricingBasis,
    billingAudited: providerProfile.billingAudited,
    officialReferencePricingUsdPerMillionTokens: providerProfile.officialReferencePricingUsdPerMillionTokens,
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
  if (!pricing) {
    return {
      uncachedInputTokens: null,
      estimatedInputHitCostCny: null,
      estimatedInputMissCostCny: null,
      estimatedOutputCostCny: null,
      estimatedTotalCostCny: null,
    };
  }
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
  if (mode === "activePromptTrimPoc") return ["readableLite", "cacheSidecarLiteOnly", "cacheSidecarLiteTrimOnly", "bb9Best", "bb11SelectorGuard"];
  if (mode === "activePromptPoc") return ["readableFull", "readableLite", "cacheSidecarFullOnly", "cacheSidecarLiteOnly", "bb9Best"];
  if (mode === "handoffPoc") return ["readableFull", "readableFullSidecar", "readableLite", "readableLiteSidecar", "bb9Best"];
  if (mode === "blockalign") return ["natural", "bb7BlockPadLite", "bb8AlignedBlockPadLite"];
  if (mode === "blockpad") return ["natural", "bb5SidecarLite", "bb6HybridLite", "bb7BlockPadLite"];
  if (mode === "hybrid") return ["natural", "bb4AnchorPad", "bb5SidecarFull", "bb5SidecarLite", "bb6HybridFull", "bb6HybridLite"];
  if (mode === "sidecar") return ["natural", "readableFull", "readableLite", "bb4AnchorPad", "bb5SidecarFull", "bb5SidecarLite"];
  if (mode === "readablePoc") return ["natural", "readableFull", "readableFullPad4", "readableLite", "readableLitePad4"];
  if (mode === "padSweep") return PAD_SWEEP_VARIANTS.map((item) => item.variant);
  if (mode === "anchorpad") return ["natural", "cacheReady", "capsuleV2", "anchorV3", "anchorPadV4"];
  if (mode === "anchor") return ["natural", "cacheReady", "capsuleV2", "anchorV3"];
  return mode === "capsule" ? ["natural", "cacheReady", "capsuleV2"] : ["natural", "cacheReady"];
}

function getPromptForVariant(mode, snapshot, scenario, iteration, variant, providerProfileId = "mimo") {
  if (mode === "activePromptTrimPoc") {
    if (variant === "bb9Best") return buildBb7BlockPadPrompt(snapshot, scenario, iteration);
    return buildBb11ActivePromptTrimPrompt(snapshot, scenario, iteration, variant, providerProfileId);
  }
  if (mode === "activePromptPoc") {
    if (variant === "bb9Best") return buildBb7BlockPadPrompt(snapshot, scenario, iteration);
    return buildBb10ActivePrompt(snapshot, scenario, iteration, variant, providerProfileId);
  }
  if (mode === "handoffPoc") {
    if (variant === "bb9Best") return buildBb7BlockPadPrompt(snapshot, scenario, iteration);
    return buildBb9HandoffPrompt(snapshot, scenario, iteration, variant, providerProfileId);
  }
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
  if (mode === "readablePoc") {
    if (variant === "natural") return buildNormalizedPrompt(snapshot, scenario, iteration, "natural");
    return buildReadablePocPrompt(snapshot, scenario, iteration, variant);
  }
  if (mode === "sidecar") {
    if (variant === "natural") return buildNormalizedPrompt(snapshot, scenario, iteration, "natural");
    if (variant === "readableFull") return buildReadablePocPrompt(snapshot, scenario, iteration, "readableFull");
    if (variant === "readableLite") return buildReadablePocPrompt(snapshot, scenario, iteration, "readableLite");
    if (variant === "bb4AnchorPad") return buildAnchorPadPrompt(snapshot, scenario, iteration);
    return buildBb5SidecarPrompt(snapshot, scenario, iteration, variant);
  }
  if (mode === "hybrid") {
    if (variant === "natural") return buildNormalizedPrompt(snapshot, scenario, iteration, "natural");
    if (variant === "bb4AnchorPad") return buildAnchorPadPrompt(snapshot, scenario, iteration);
    if (variant === "bb5SidecarFull" || variant === "bb5SidecarLite") return buildBb5SidecarPrompt(snapshot, scenario, iteration, variant);
    return buildBb6HybridPrompt(snapshot, scenario, iteration, variant);
  }
  if (mode === "blockpad") {
    if (variant === "natural") return buildNormalizedPrompt(snapshot, scenario, iteration, "natural");
    if (variant === "bb5SidecarLite") return buildBb5SidecarPrompt(snapshot, scenario, iteration, variant);
    if (variant === "bb6HybridLite") return buildBb6HybridPrompt(snapshot, scenario, iteration, variant);
    return buildBb7BlockPadPrompt(snapshot, scenario, iteration);
  }
  if (mode === "blockalign") {
    if (variant === "natural") return buildNormalizedPrompt(snapshot, scenario, iteration, "natural");
    if (variant === "bb7BlockPadLite") return buildBb7BlockPadPrompt(snapshot, scenario, iteration);
    return buildBb8AlignedBlockPadPrompt(snapshot, scenario, iteration);
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
  const readableComparisons = [];
  const handoffComparisons = [];
  const activePromptComparisons = [];
  const activePromptTrimComparisons = [];
  const sidecarComparisons = [];
  const hybridComparisons = [];
  const blockPadComparisons = [];
  const alignedBlockPadComparisons = [];
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
      if (rawResult.mode === "readablePoc") {
        for (const pair of [
          { family: "full", baselineVariant: "readableFull", candidateVariant: "readableFullPad4" },
          { family: "lite", baselineVariant: "readableLite", candidateVariant: "readableLitePad4" },
        ]) {
          const baselineCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === pair.baselineVariant);
          const candidateCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === pair.candidateVariant);
          const baseline = summarizeCalls(baselineCalls);
          const candidate = summarizeCalls(candidateCalls);
          const baselinePromptMedian = median(baselineCalls.filter((call) => call.iteration > 0 && call.status === "success").map((call) => call.promptTokens));
          const candidatePromptMedian = median(candidateCalls.filter((call) => call.iteration > 0 && call.status === "success").map((call) => call.promptTokens));
          const costDeltaCny =
            typeof baseline.medianEstimatedCostCny === "number" && typeof candidate.medianEstimatedCostCny === "number"
              ? candidate.medianEstimatedCostCny - baseline.medianEstimatedCostCny
              : null;
          const costDeltaPercent =
            typeof costDeltaCny === "number" && baseline.medianEstimatedCostCny
              ? costDeltaCny / baseline.medianEstimatedCostCny
              : null;
          readableComparisons.push({
            projectId,
            scenarioId: scenario.id,
            family: pair.family,
            baselineVariant: pair.baselineVariant,
            candidateVariant: pair.candidateVariant,
            baselineMedianPromptTokens: baselinePromptMedian,
            candidateMedianPromptTokens: candidatePromptMedian,
            baselineMedianCachedTokens: baseline.medianCachedTokens,
            candidateMedianCachedTokens: candidate.medianCachedTokens,
            baselineMedianCacheRatio: baseline.medianCacheRatio,
            candidateMedianCacheRatio: candidate.medianCacheRatio,
            baselineMedianEstimatedCostCny: baseline.medianEstimatedCostCny,
            candidateMedianEstimatedCostCny: candidate.medianEstimatedCostCny,
            candidateCostDeltaCny: costDeltaCny,
            candidateCostDeltaPercent: costDeltaPercent,
            candidateCacheRatioWin:
              typeof baseline.medianCacheRatio === "number" &&
              typeof candidate.medianCacheRatio === "number" &&
              candidate.medianCacheRatio > baseline.medianCacheRatio,
            candidateEstimatedCostWin:
              typeof baseline.medianEstimatedCostCny === "number" &&
              typeof candidate.medianEstimatedCostCny === "number" &&
              candidate.medianEstimatedCostCny < baseline.medianEstimatedCostCny,
          });
        }
      }
      if (rawResult.mode === "handoffPoc") {
        const bb9BestCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === "bb9Best");
        const bb9Best = summarizeCalls(bb9BestCalls);
        for (const pair of [
          { family: "full", baselineVariant: "readableFull", candidateVariant: "readableFullSidecar" },
          { family: "lite", baselineVariant: "readableLite", candidateVariant: "readableLiteSidecar" },
        ]) {
          const baselineCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === pair.baselineVariant);
          const candidateCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === pair.candidateVariant);
          const baseline = summarizeCalls(baselineCalls);
          const candidate = summarizeCalls(candidateCalls);
          const baselinePromptMedian = median(baselineCalls.filter((call) => call.iteration > 0 && call.status === "success").map((call) => call.promptTokens));
          const candidatePromptMedian = median(candidateCalls.filter((call) => call.iteration > 0 && call.status === "success").map((call) => call.promptTokens));
          const bb9BestPromptMedian = median(bb9BestCalls.filter((call) => call.iteration > 0 && call.status === "success").map((call) => call.promptTokens));
          const baselineCostDeltaCny =
            typeof baseline.medianEstimatedCostCny === "number" && typeof candidate.medianEstimatedCostCny === "number"
              ? candidate.medianEstimatedCostCny - baseline.medianEstimatedCostCny
              : null;
          const baselineCostDeltaPercent =
            typeof baselineCostDeltaCny === "number" && baseline.medianEstimatedCostCny
              ? baselineCostDeltaCny / baseline.medianEstimatedCostCny
              : null;
          const bb9BestCostDeltaCny =
            typeof bb9Best.medianEstimatedCostCny === "number" && typeof candidate.medianEstimatedCostCny === "number"
              ? candidate.medianEstimatedCostCny - bb9Best.medianEstimatedCostCny
              : null;
          const bb9BestCostDeltaPercent =
            typeof bb9BestCostDeltaCny === "number" && bb9Best.medianEstimatedCostCny
              ? bb9BestCostDeltaCny / bb9Best.medianEstimatedCostCny
              : null;
          handoffComparisons.push({
            projectId,
            scenarioId: scenario.id,
            family: pair.family,
            baselineVariant: pair.baselineVariant,
            candidateVariant: pair.candidateVariant,
            referenceVariant: "bb9Best",
            baselineMedianPromptTokens: baselinePromptMedian,
            candidateMedianPromptTokens: candidatePromptMedian,
            bb9BestMedianPromptTokens: bb9BestPromptMedian,
            baselineMedianCacheRatio: baseline.medianCacheRatio,
            candidateMedianCacheRatio: candidate.medianCacheRatio,
            bb9BestMedianCacheRatio: bb9Best.medianCacheRatio,
            baselineMedianEstimatedCostCny: baseline.medianEstimatedCostCny,
            candidateMedianEstimatedCostCny: candidate.medianEstimatedCostCny,
            bb9BestMedianEstimatedCostCny: bb9Best.medianEstimatedCostCny,
            candidateCostDeltaVsBaselineCny: baselineCostDeltaCny,
            candidateCostDeltaVsBaselinePercent: baselineCostDeltaPercent,
            candidateCostDeltaVsBb9BestCny: bb9BestCostDeltaCny,
            candidateCostDeltaVsBb9BestPercent: bb9BestCostDeltaPercent,
            candidateCacheRatioWinVsBaseline:
              typeof baseline.medianCacheRatio === "number" &&
              typeof candidate.medianCacheRatio === "number" &&
              candidate.medianCacheRatio > baseline.medianCacheRatio,
            candidateEstimatedCostWinVsBaseline:
              typeof baseline.medianEstimatedCostCny === "number" &&
              typeof candidate.medianEstimatedCostCny === "number" &&
              candidate.medianEstimatedCostCny < baseline.medianEstimatedCostCny,
            candidateEstimatedCostNoWorseThanBb9Best:
              typeof bb9Best.medianEstimatedCostCny === "number" &&
              typeof candidate.medianEstimatedCostCny === "number" &&
              candidate.medianEstimatedCostCny <= bb9Best.medianEstimatedCostCny,
          });
        }
      }
      if (rawResult.mode === "activePromptPoc") {
        const bb9BestCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === "bb9Best");
        const bb9Best = summarizeCalls(bb9BestCalls);
        for (const pair of [
          { family: "full", baselineVariant: "readableFull", candidateVariant: "cacheSidecarFullOnly" },
          { family: "lite", baselineVariant: "readableLite", candidateVariant: "cacheSidecarLiteOnly" },
        ]) {
          const baselineCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === pair.baselineVariant);
          const candidateCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === pair.candidateVariant);
          const baseline = summarizeCalls(baselineCalls);
          const candidate = summarizeCalls(candidateCalls);
          const baselinePromptMedian = median(baselineCalls.filter((call) => call.iteration > 0 && call.status === "success").map((call) => call.promptTokens));
          const candidatePromptMedian = median(candidateCalls.filter((call) => call.iteration > 0 && call.status === "success").map((call) => call.promptTokens));
          const bb9BestPromptMedian = median(bb9BestCalls.filter((call) => call.iteration > 0 && call.status === "success").map((call) => call.promptTokens));
          const baselineCostDeltaCny =
            typeof baseline.medianEstimatedCostCny === "number" && typeof candidate.medianEstimatedCostCny === "number"
              ? candidate.medianEstimatedCostCny - baseline.medianEstimatedCostCny
              : null;
          const baselineCostDeltaPercent =
            typeof baselineCostDeltaCny === "number" && baseline.medianEstimatedCostCny
              ? baselineCostDeltaCny / baseline.medianEstimatedCostCny
              : null;
          const bb9BestCostDeltaCny =
            typeof bb9Best.medianEstimatedCostCny === "number" && typeof candidate.medianEstimatedCostCny === "number"
              ? candidate.medianEstimatedCostCny - bb9Best.medianEstimatedCostCny
              : null;
          const bb9BestCostDeltaPercent =
            typeof bb9BestCostDeltaCny === "number" && bb9Best.medianEstimatedCostCny
              ? bb9BestCostDeltaCny / bb9Best.medianEstimatedCostCny
              : null;
          activePromptComparisons.push({
            projectId,
            scenarioId: scenario.id,
            family: pair.family,
            baselineVariant: pair.baselineVariant,
            candidateVariant: pair.candidateVariant,
            referenceVariant: "bb9Best",
            baselineMedianPromptTokens: baselinePromptMedian,
            candidateMedianPromptTokens: candidatePromptMedian,
            bb9BestMedianPromptTokens: bb9BestPromptMedian,
            baselineMedianCachedTokens: baseline.medianCachedTokens,
            candidateMedianCachedTokens: candidate.medianCachedTokens,
            bb9BestMedianCachedTokens: bb9Best.medianCachedTokens,
            baselineMedianCacheRatio: baseline.medianCacheRatio,
            candidateMedianCacheRatio: candidate.medianCacheRatio,
            bb9BestMedianCacheRatio: bb9Best.medianCacheRatio,
            baselineMedianEstimatedCostCny: baseline.medianEstimatedCostCny,
            candidateMedianEstimatedCostCny: candidate.medianEstimatedCostCny,
            bb9BestMedianEstimatedCostCny: bb9Best.medianEstimatedCostCny,
            candidateCostDeltaVsBaselineCny: baselineCostDeltaCny,
            candidateCostDeltaVsBaselinePercent: baselineCostDeltaPercent,
            candidateCostDeltaVsBb9BestCny: bb9BestCostDeltaCny,
            candidateCostDeltaVsBb9BestPercent: bb9BestCostDeltaPercent,
            candidateCacheRatioWinVsBaseline:
              typeof baseline.medianCacheRatio === "number" &&
              typeof candidate.medianCacheRatio === "number" &&
              candidate.medianCacheRatio > baseline.medianCacheRatio,
            candidateEstimatedCostWinVsBaseline:
              typeof baseline.medianEstimatedCostCny === "number" &&
              typeof candidate.medianEstimatedCostCny === "number" &&
              candidate.medianEstimatedCostCny < baseline.medianEstimatedCostCny,
            candidateEstimatedCostNoWorseThanBb9Best:
              typeof bb9Best.medianEstimatedCostCny === "number" &&
              typeof candidate.medianEstimatedCostCny === "number" &&
              candidate.medianEstimatedCostCny <= bb9Best.medianEstimatedCostCny,
          });
        }
      }
      if (rawResult.mode === "activePromptTrimPoc") {
        const baselineCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === "readableLite");
        const bb10Calls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === "cacheSidecarLiteOnly");
        const trimCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === "cacheSidecarLiteTrimOnly");
        const bb9BestCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === "bb9Best");
        const guardCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === "bb11SelectorGuard");
        const baseline = summarizeCalls(baselineCalls);
        const bb10 = summarizeCalls(bb10Calls);
        const trim = summarizeCalls(trimCalls);
        const bb9Best = summarizeCalls(bb9BestCalls);
        const guard = summarizeCalls(guardCalls);
        const promptMedian = (variantCalls) => median(variantCalls.filter((call) => call.iteration > 0 && call.status === "success").map((call) => call.promptTokens));
        const costDelta = (candidate, reference) =>
          typeof candidate.medianEstimatedCostCny === "number" && typeof reference.medianEstimatedCostCny === "number"
            ? candidate.medianEstimatedCostCny - reference.medianEstimatedCostCny
            : null;
        const costDeltaPercent = (delta, reference) =>
          typeof delta === "number" && reference.medianEstimatedCostCny
            ? delta / reference.medianEstimatedCostCny
            : null;
        const trimVsReadable = costDelta(trim, baseline);
        const trimVsBb10 = costDelta(trim, bb10);
        const trimVsBb9Best = costDelta(trim, bb9Best);
        const guardVsReadable = costDelta(guard, baseline);
        const guardVsBb9Best = costDelta(guard, bb9Best);
        activePromptTrimComparisons.push({
          projectId,
          scenarioId: scenario.id,
          family: "lite",
          baselineVariant: "readableLite",
          previousVariant: "cacheSidecarLiteOnly",
          candidateVariant: "cacheSidecarLiteTrimOnly",
          selectorGuardVariant: "bb11SelectorGuard",
          referenceVariant: "bb9Best",
          baselineMedianPromptTokens: promptMedian(baselineCalls),
          bb10MedianPromptTokens: promptMedian(bb10Calls),
          candidateMedianPromptTokens: promptMedian(trimCalls),
          bb9BestMedianPromptTokens: promptMedian(bb9BestCalls),
          selectorGuardMedianPromptTokens: promptMedian(guardCalls),
          baselineMedianCachedTokens: baseline.medianCachedTokens,
          bb10MedianCachedTokens: bb10.medianCachedTokens,
          candidateMedianCachedTokens: trim.medianCachedTokens,
          bb9BestMedianCachedTokens: bb9Best.medianCachedTokens,
          selectorGuardMedianCachedTokens: guard.medianCachedTokens,
          baselineMedianCacheRatio: baseline.medianCacheRatio,
          bb10MedianCacheRatio: bb10.medianCacheRatio,
          candidateMedianCacheRatio: trim.medianCacheRatio,
          bb9BestMedianCacheRatio: bb9Best.medianCacheRatio,
          selectorGuardMedianCacheRatio: guard.medianCacheRatio,
          baselineMedianEstimatedCostCny: baseline.medianEstimatedCostCny,
          bb10MedianEstimatedCostCny: bb10.medianEstimatedCostCny,
          candidateMedianEstimatedCostCny: trim.medianEstimatedCostCny,
          bb9BestMedianEstimatedCostCny: bb9Best.medianEstimatedCostCny,
          selectorGuardMedianEstimatedCostCny: guard.medianEstimatedCostCny,
          candidateCostDeltaVsReadableCny: trimVsReadable,
          candidateCostDeltaVsReadablePercent: costDeltaPercent(trimVsReadable, baseline),
          candidateCostDeltaVsBb10Cny: trimVsBb10,
          candidateCostDeltaVsBb10Percent: costDeltaPercent(trimVsBb10, bb10),
          candidateCostDeltaVsBb9BestCny: trimVsBb9Best,
          candidateCostDeltaVsBb9BestPercent: costDeltaPercent(trimVsBb9Best, bb9Best),
          selectorGuardCostDeltaVsReadableCny: guardVsReadable,
          selectorGuardCostDeltaVsReadablePercent: costDeltaPercent(guardVsReadable, baseline),
          selectorGuardCostDeltaVsBb9BestCny: guardVsBb9Best,
          selectorGuardCostDeltaVsBb9BestPercent: costDeltaPercent(guardVsBb9Best, bb9Best),
          candidateEstimatedCostWinVsReadable:
            typeof baseline.medianEstimatedCostCny === "number" &&
            typeof trim.medianEstimatedCostCny === "number" &&
            trim.medianEstimatedCostCny < baseline.medianEstimatedCostCny,
          candidateEstimatedCostWinVsBb10:
            typeof bb10.medianEstimatedCostCny === "number" &&
            typeof trim.medianEstimatedCostCny === "number" &&
            trim.medianEstimatedCostCny < bb10.medianEstimatedCostCny,
          candidateEstimatedCostNoWorseThanBb9Best:
            typeof bb9Best.medianEstimatedCostCny === "number" &&
            typeof trim.medianEstimatedCostCny === "number" &&
            trim.medianEstimatedCostCny <= bb9Best.medianEstimatedCostCny,
          selectorGuardEstimatedCostWinVsReadable:
            typeof baseline.medianEstimatedCostCny === "number" &&
            typeof guard.medianEstimatedCostCny === "number" &&
            guard.medianEstimatedCostCny < baseline.medianEstimatedCostCny,
          selectorGuardEstimatedCostNoWorseThanBb9Best:
            typeof bb9Best.medianEstimatedCostCny === "number" &&
            typeof guard.medianEstimatedCostCny === "number" &&
            guard.medianEstimatedCostCny <= bb9Best.medianEstimatedCostCny,
        });
      }
      if (rawResult.mode === "sidecar") {
        const bb4Calls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === "bb4AnchorPad");
        const bb4 = summarizeCalls(bb4Calls);
        for (const pair of [
          { family: "full", variant: "bb5SidecarFull" },
          { family: "lite", variant: "bb5SidecarLite" },
        ]) {
          const sidecarCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === pair.variant);
          const sidecar = summarizeCalls(sidecarCalls);
          const sidecarPromptMedian = median(sidecarCalls.filter((call) => call.iteration > 0 && call.status === "success").map((call) => call.promptTokens));
          const bb4PromptMedian = median(bb4Calls.filter((call) => call.iteration > 0 && call.status === "success").map((call) => call.promptTokens));
          const naturalCostDeltaCny =
            typeof natural.medianEstimatedCostCny === "number" && typeof sidecar.medianEstimatedCostCny === "number"
              ? sidecar.medianEstimatedCostCny - natural.medianEstimatedCostCny
              : null;
          const naturalCostDeltaPercent =
            typeof naturalCostDeltaCny === "number" && natural.medianEstimatedCostCny
              ? naturalCostDeltaCny / natural.medianEstimatedCostCny
              : null;
          const bb4CostDeltaCny =
            typeof bb4.medianEstimatedCostCny === "number" && typeof sidecar.medianEstimatedCostCny === "number"
              ? sidecar.medianEstimatedCostCny - bb4.medianEstimatedCostCny
              : null;
          const bb4CostDeltaPercent =
            typeof bb4CostDeltaCny === "number" && bb4.medianEstimatedCostCny
              ? bb4CostDeltaCny / bb4.medianEstimatedCostCny
              : null;
          sidecarComparisons.push({
            projectId,
            scenarioId: scenario.id,
            family: pair.family,
            sidecarVariant: pair.variant,
            sidecarMedianPromptTokens: sidecarPromptMedian,
            bb4MedianPromptTokens: bb4PromptMedian,
            naturalMedianCachedTokens: natural.medianCachedTokens,
            sidecarMedianCachedTokens: sidecar.medianCachedTokens,
            bb4MedianCachedTokens: bb4.medianCachedTokens,
            naturalMedianCacheRatio: natural.medianCacheRatio,
            sidecarMedianCacheRatio: sidecar.medianCacheRatio,
            bb4MedianCacheRatio: bb4.medianCacheRatio,
            naturalMedianEstimatedCostCny: natural.medianEstimatedCostCny,
            sidecarMedianEstimatedCostCny: sidecar.medianEstimatedCostCny,
            bb4MedianEstimatedCostCny: bb4.medianEstimatedCostCny,
            sidecarCostDeltaVsNaturalCny: naturalCostDeltaCny,
            sidecarCostDeltaVsNaturalPercent: naturalCostDeltaPercent,
            sidecarCostDeltaVsBb4Cny: bb4CostDeltaCny,
            sidecarCostDeltaVsBb4Percent: bb4CostDeltaPercent,
            sidecarCacheRatioWinVsNatural:
              typeof natural.medianCacheRatio === "number" &&
              typeof sidecar.medianCacheRatio === "number" &&
              sidecar.medianCacheRatio > natural.medianCacheRatio,
            sidecarEstimatedCostWinVsNatural:
              typeof natural.medianEstimatedCostCny === "number" &&
              typeof sidecar.medianEstimatedCostCny === "number" &&
              sidecar.medianEstimatedCostCny < natural.medianEstimatedCostCny,
            sidecarEstimatedCostWinVsBb4:
              typeof bb4.medianEstimatedCostCny === "number" &&
              typeof sidecar.medianEstimatedCostCny === "number" &&
              sidecar.medianEstimatedCostCny <= bb4.medianEstimatedCostCny,
          });
        }
      }

      if (rawResult.mode === "hybrid") {
        for (const pair of [
          { family: "full", variant: "bb6HybridFull", bb5Variant: "bb5SidecarFull" },
          { family: "lite", variant: "bb6HybridLite", bb5Variant: "bb5SidecarLite" },
        ]) {
          const hybridCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === pair.variant);
          const bb4Calls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === "bb4AnchorPad");
          const bb5Calls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === pair.bb5Variant);
          const hybrid = summarizeCalls(hybridCalls);
          const bb4 = summarizeCalls(bb4Calls);
          const bb5 = summarizeCalls(bb5Calls);
          const hybridPromptMedian = median(hybridCalls.filter((call) => call.iteration > 0 && call.status === "success").map((call) => call.promptTokens));
          const bb5PromptMedian = median(bb5Calls.filter((call) => call.iteration > 0 && call.status === "success").map((call) => call.promptTokens));
          const naturalCostDeltaCny =
            typeof natural.medianEstimatedCostCny === "number" && typeof hybrid.medianEstimatedCostCny === "number"
              ? hybrid.medianEstimatedCostCny - natural.medianEstimatedCostCny
              : null;
          const naturalCostDeltaPercent =
            typeof naturalCostDeltaCny === "number" && natural.medianEstimatedCostCny
              ? naturalCostDeltaCny / natural.medianEstimatedCostCny
              : null;
          const bb4CostDeltaCny =
            typeof bb4.medianEstimatedCostCny === "number" && typeof hybrid.medianEstimatedCostCny === "number"
              ? hybrid.medianEstimatedCostCny - bb4.medianEstimatedCostCny
              : null;
          const bb4CostDeltaPercent =
            typeof bb4CostDeltaCny === "number" && bb4.medianEstimatedCostCny
              ? bb4CostDeltaCny / bb4.medianEstimatedCostCny
              : null;
          const bb5CostDeltaCny =
            typeof bb5.medianEstimatedCostCny === "number" && typeof hybrid.medianEstimatedCostCny === "number"
              ? hybrid.medianEstimatedCostCny - bb5.medianEstimatedCostCny
              : null;
          const bb5CostDeltaPercent =
            typeof bb5CostDeltaCny === "number" && bb5.medianEstimatedCostCny
              ? bb5CostDeltaCny / bb5.medianEstimatedCostCny
              : null;
          hybridComparisons.push({
            projectId,
            scenarioId: scenario.id,
            family: pair.family,
            hybridVariant: pair.variant,
            hybridMedianPromptTokens: hybridPromptMedian,
            bb5MedianPromptTokens: bb5PromptMedian,
            naturalMedianCachedTokens: natural.medianCachedTokens,
            hybridMedianCachedTokens: hybrid.medianCachedTokens,
            bb4MedianCachedTokens: bb4.medianCachedTokens,
            bb5MedianCachedTokens: bb5.medianCachedTokens,
            naturalMedianCacheRatio: natural.medianCacheRatio,
            hybridMedianCacheRatio: hybrid.medianCacheRatio,
            bb4MedianCacheRatio: bb4.medianCacheRatio,
            bb5MedianCacheRatio: bb5.medianCacheRatio,
            naturalMedianEstimatedCostCny: natural.medianEstimatedCostCny,
            hybridMedianEstimatedCostCny: hybrid.medianEstimatedCostCny,
            bb4MedianEstimatedCostCny: bb4.medianEstimatedCostCny,
            bb5MedianEstimatedCostCny: bb5.medianEstimatedCostCny,
            hybridCostDeltaVsNaturalCny: naturalCostDeltaCny,
            hybridCostDeltaVsNaturalPercent: naturalCostDeltaPercent,
            hybridCostDeltaVsBb4Cny: bb4CostDeltaCny,
            hybridCostDeltaVsBb4Percent: bb4CostDeltaPercent,
            hybridCostDeltaVsBb5Cny: bb5CostDeltaCny,
            hybridCostDeltaVsBb5Percent: bb5CostDeltaPercent,
            hybridCacheRatioWinVsNatural:
              typeof natural.medianCacheRatio === "number" &&
              typeof hybrid.medianCacheRatio === "number" &&
              hybrid.medianCacheRatio > natural.medianCacheRatio,
            hybridEstimatedCostWinVsNatural:
              typeof natural.medianEstimatedCostCny === "number" &&
              typeof hybrid.medianEstimatedCostCny === "number" &&
              hybrid.medianEstimatedCostCny < natural.medianEstimatedCostCny,
            hybridEstimatedCostWinVsBb4:
              typeof bb4.medianEstimatedCostCny === "number" &&
              typeof hybrid.medianEstimatedCostCny === "number" &&
              hybrid.medianEstimatedCostCny <= bb4.medianEstimatedCostCny,
            hybridEstimatedCostWinVsBb5:
              typeof bb5.medianEstimatedCostCny === "number" &&
              typeof hybrid.medianEstimatedCostCny === "number" &&
              hybrid.medianEstimatedCostCny <= bb5.medianEstimatedCostCny,
          });
        }
      }

      if (rawResult.mode === "blockpad") {
        const blockPadCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === "bb7BlockPadLite");
        const bb5Calls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === "bb5SidecarLite");
        const bb6Calls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === "bb6HybridLite");
        const blockPad = summarizeCalls(blockPadCalls);
        const bb5 = summarizeCalls(bb5Calls);
        const bb6 = summarizeCalls(bb6Calls);
        const blockPadPromptMedian = median(blockPadCalls.filter((call) => call.iteration > 0 && call.status === "success").map((call) => call.promptTokens));
        const naturalCostDeltaCny =
          typeof natural.medianEstimatedCostCny === "number" && typeof blockPad.medianEstimatedCostCny === "number"
            ? blockPad.medianEstimatedCostCny - natural.medianEstimatedCostCny
            : null;
        const naturalCostDeltaPercent =
          typeof naturalCostDeltaCny === "number" && natural.medianEstimatedCostCny
            ? naturalCostDeltaCny / natural.medianEstimatedCostCny
            : null;
        const bb5CostDeltaCny =
          typeof bb5.medianEstimatedCostCny === "number" && typeof blockPad.medianEstimatedCostCny === "number"
            ? blockPad.medianEstimatedCostCny - bb5.medianEstimatedCostCny
            : null;
        const bb5CostDeltaPercent =
          typeof bb5CostDeltaCny === "number" && bb5.medianEstimatedCostCny
            ? bb5CostDeltaCny / bb5.medianEstimatedCostCny
            : null;
        const bb6CostDeltaCny =
          typeof bb6.medianEstimatedCostCny === "number" && typeof blockPad.medianEstimatedCostCny === "number"
            ? blockPad.medianEstimatedCostCny - bb6.medianEstimatedCostCny
            : null;
        const bb6CostDeltaPercent =
          typeof bb6CostDeltaCny === "number" && bb6.medianEstimatedCostCny
            ? bb6CostDeltaCny / bb6.medianEstimatedCostCny
            : null;
        blockPadComparisons.push({
          projectId,
          scenarioId: scenario.id,
          candidateVariant: "bb7BlockPadLite",
          blockPadMedianPromptTokens: blockPadPromptMedian,
          naturalMedianCachedTokens: natural.medianCachedTokens,
          blockPadMedianCachedTokens: blockPad.medianCachedTokens,
          bb5MedianCachedTokens: bb5.medianCachedTokens,
          bb6MedianCachedTokens: bb6.medianCachedTokens,
          naturalMedianCacheRatio: natural.medianCacheRatio,
          blockPadMedianCacheRatio: blockPad.medianCacheRatio,
          bb5MedianCacheRatio: bb5.medianCacheRatio,
          bb6MedianCacheRatio: bb6.medianCacheRatio,
          naturalMedianEstimatedCostCny: natural.medianEstimatedCostCny,
          blockPadMedianEstimatedCostCny: blockPad.medianEstimatedCostCny,
          bb5MedianEstimatedCostCny: bb5.medianEstimatedCostCny,
          bb6MedianEstimatedCostCny: bb6.medianEstimatedCostCny,
          blockPadCostDeltaVsNaturalCny: naturalCostDeltaCny,
          blockPadCostDeltaVsNaturalPercent: naturalCostDeltaPercent,
          blockPadCostDeltaVsBb5Cny: bb5CostDeltaCny,
          blockPadCostDeltaVsBb5Percent: bb5CostDeltaPercent,
          blockPadCostDeltaVsBb6Cny: bb6CostDeltaCny,
          blockPadCostDeltaVsBb6Percent: bb6CostDeltaPercent,
          blockPadCacheRatioWinVsNatural:
            typeof natural.medianCacheRatio === "number" &&
            typeof blockPad.medianCacheRatio === "number" &&
            blockPad.medianCacheRatio > natural.medianCacheRatio,
          blockPadEstimatedCostWinVsNatural:
            typeof natural.medianEstimatedCostCny === "number" &&
            typeof blockPad.medianEstimatedCostCny === "number" &&
            blockPad.medianEstimatedCostCny < natural.medianEstimatedCostCny,
          blockPadEstimatedCostWinVsBb5:
            typeof bb5.medianEstimatedCostCny === "number" &&
            typeof blockPad.medianEstimatedCostCny === "number" &&
            blockPad.medianEstimatedCostCny <= bb5.medianEstimatedCostCny,
          blockPadEstimatedCostWinVsBb6:
            typeof bb6.medianEstimatedCostCny === "number" &&
            typeof blockPad.medianEstimatedCostCny === "number" &&
            blockPad.medianEstimatedCostCny <= bb6.medianEstimatedCostCny,
        });
      }

      if (rawResult.mode === "blockalign") {
        const alignedCalls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === "bb8AlignedBlockPadLite");
        const bb7Calls = calls.filter((call) => call.projectId === projectId && call.scenarioId === scenario.id && call.variant === "bb7BlockPadLite");
        const aligned = summarizeCalls(alignedCalls);
        const bb7 = summarizeCalls(bb7Calls);
        const alignedPromptMedian = median(alignedCalls.filter((call) => call.iteration > 0 && call.status === "success").map((call) => call.promptTokens));
        const naturalCostDeltaCny =
          typeof natural.medianEstimatedCostCny === "number" && typeof aligned.medianEstimatedCostCny === "number"
            ? aligned.medianEstimatedCostCny - natural.medianEstimatedCostCny
            : null;
        const naturalCostDeltaPercent =
          typeof naturalCostDeltaCny === "number" && natural.medianEstimatedCostCny
            ? naturalCostDeltaCny / natural.medianEstimatedCostCny
            : null;
        const bb7CostDeltaCny =
          typeof bb7.medianEstimatedCostCny === "number" && typeof aligned.medianEstimatedCostCny === "number"
            ? aligned.medianEstimatedCostCny - bb7.medianEstimatedCostCny
            : null;
        const bb7CostDeltaPercent =
          typeof bb7CostDeltaCny === "number" && bb7.medianEstimatedCostCny
            ? bb7CostDeltaCny / bb7.medianEstimatedCostCny
            : null;
        alignedBlockPadComparisons.push({
          projectId,
          scenarioId: scenario.id,
          candidateVariant: "bb8AlignedBlockPadLite",
          alignedMedianPromptTokens: alignedPromptMedian,
          naturalMedianCachedTokens: natural.medianCachedTokens,
          alignedMedianCachedTokens: aligned.medianCachedTokens,
          bb7MedianCachedTokens: bb7.medianCachedTokens,
          naturalMedianCacheRatio: natural.medianCacheRatio,
          alignedMedianCacheRatio: aligned.medianCacheRatio,
          bb7MedianCacheRatio: bb7.medianCacheRatio,
          naturalMedianEstimatedCostCny: natural.medianEstimatedCostCny,
          alignedMedianEstimatedCostCny: aligned.medianEstimatedCostCny,
          bb7MedianEstimatedCostCny: bb7.medianEstimatedCostCny,
          alignedCostDeltaVsNaturalCny: naturalCostDeltaCny,
          alignedCostDeltaVsNaturalPercent: naturalCostDeltaPercent,
          alignedCostDeltaVsBb7Cny: bb7CostDeltaCny,
          alignedCostDeltaVsBb7Percent: bb7CostDeltaPercent,
          alignedCacheRatioWinVsNatural:
            typeof natural.medianCacheRatio === "number" &&
            typeof aligned.medianCacheRatio === "number" &&
            aligned.medianCacheRatio > natural.medianCacheRatio,
          alignedEstimatedCostWinVsNatural:
            typeof natural.medianEstimatedCostCny === "number" &&
            typeof aligned.medianEstimatedCostCny === "number" &&
            aligned.medianEstimatedCostCny < natural.medianEstimatedCostCny,
          alignedEstimatedCostWinVsBb7:
            typeof bb7.medianEstimatedCostCny === "number" &&
            typeof aligned.medianEstimatedCostCny === "number" &&
            aligned.medianEstimatedCostCny <= bb7.medianEstimatedCostCny,
        });
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
  const readableStats = ["full", "lite"].map((family) => {
    const baselineVariant = family === "full" ? "readableFull" : "readableLite";
    const candidateVariant = family === "full" ? "readableFullPad4" : "readableLitePad4";
    const baselineCost = variants[baselineVariant]?.medianEstimatedCostCny;
    const candidateCost = variants[candidateVariant]?.medianEstimatedCostCny;
    const overallCostDeltaCny =
      typeof baselineCost === "number" && typeof candidateCost === "number"
        ? candidateCost - baselineCost
        : null;
    const overallCostDeltaPercent =
      typeof overallCostDeltaCny === "number" && baselineCost
        ? overallCostDeltaCny / baselineCost
        : null;
    const familyComparisons = readableComparisons.filter((item) => item.family === family);
    const cacheRatioWins = familyComparisons.filter((item) => item.candidateCacheRatioWin).length;
    const costWins = familyComparisons.filter((item) => item.candidateEstimatedCostWin).length;
    const strongEvidence =
      rawResult.mode === "readablePoc" &&
      validRequestCount >= largeSampleThreshold &&
      cacheFieldVisibilityRate >= 0.95 &&
      familyComparisons.length >= 15 &&
      costWins >= 15 &&
      typeof overallCostDeltaPercent === "number" &&
      overallCostDeltaPercent <= -0.05;
    const promisingSignal =
      rawResult.mode === "readablePoc" &&
      validRequestCount >= largeSampleThreshold &&
      cacheFieldVisibilityRate >= 0.95 &&
      familyComparisons.length >= 15 &&
      costWins >= 12 &&
      typeof overallCostDeltaPercent === "number" &&
      overallCostDeltaPercent <= -0.03;
    return {
      family,
      baselineVariant,
      candidateVariant,
      cacheRatioWins,
      estimatedCostWins: costWins,
      overallCostDeltaCny,
      overallCostDeltaPercent,
      conclusionLevel: strongEvidence
        ? `readable_${family}_cost_large_sample_evidence`
        : promisingSignal
        ? `readable_${family}_promising_signal`
        : `readable_${family}_inconclusive`,
    };
  });
  const readableConclusionLevel =
    rawResult.mode === "readablePoc" && readableStats.some((item) => item.conclusionLevel.endsWith("_cost_large_sample_evidence"))
      ? "readable_poc_large_sample_evidence"
      : rawResult.mode === "readablePoc" && readableStats.some((item) => item.conclusionLevel.endsWith("_promising_signal"))
      ? "readable_poc_promising_signal"
      : rawResult.mode === "readablePoc"
      ? "readable_poc_inconclusive"
      : undefined;
  const handoffStats = ["full", "lite"].map((family) => {
    const baselineVariant = family === "full" ? "readableFull" : "readableLite";
    const candidateVariant = family === "full" ? "readableFullSidecar" : "readableLiteSidecar";
    const baselineCost = variants[baselineVariant]?.medianEstimatedCostCny;
    const candidateCost = variants[candidateVariant]?.medianEstimatedCostCny;
    const bb9BestCost = variants.bb9Best?.medianEstimatedCostCny;
    const overallCostDeltaVsBaselineCny =
      typeof baselineCost === "number" && typeof candidateCost === "number"
        ? candidateCost - baselineCost
        : null;
    const overallCostDeltaVsBaselinePercent =
      typeof overallCostDeltaVsBaselineCny === "number" && baselineCost
        ? overallCostDeltaVsBaselineCny / baselineCost
        : null;
    const overallCostDeltaVsBb9BestCny =
      typeof bb9BestCost === "number" && typeof candidateCost === "number"
        ? candidateCost - bb9BestCost
        : null;
    const overallCostDeltaVsBb9BestPercent =
      typeof overallCostDeltaVsBb9BestCny === "number" && bb9BestCost
        ? overallCostDeltaVsBb9BestCny / bb9BestCost
        : null;
    const familyComparisons = handoffComparisons.filter((item) => item.family === family);
    const cacheRatioWins = familyComparisons.filter((item) => item.candidateCacheRatioWinVsBaseline).length;
    const costWins = familyComparisons.filter((item) => item.candidateEstimatedCostWinVsBaseline).length;
    const noWorseThanBb9Best = familyComparisons.filter((item) => item.candidateEstimatedCostNoWorseThanBb9Best).length;
    const strongEvidence =
      rawResult.mode === "handoffPoc" &&
      validRequestCount >= largeSampleThreshold &&
      cacheFieldVisibilityRate >= 0.95 &&
      familyComparisons.length >= 15 &&
      costWins >= 15 &&
      typeof overallCostDeltaVsBaselinePercent === "number" &&
      overallCostDeltaVsBaselinePercent <= -0.05;
    const promisingSignal =
      rawResult.mode === "handoffPoc" &&
      validRequestCount >= largeSampleThreshold &&
      cacheFieldVisibilityRate >= 0.95 &&
      familyComparisons.length >= 15 &&
      costWins >= 12 &&
      typeof overallCostDeltaVsBaselinePercent === "number" &&
      overallCostDeltaVsBaselinePercent <= -0.03;
    return {
      family,
      baselineVariant,
      candidateVariant,
      referenceVariant: "bb9Best",
      cacheRatioWinsVsReadable: cacheRatioWins,
      estimatedCostWinsVsReadable: costWins,
      estimatedCostNoWorseThanBb9Best: noWorseThanBb9Best,
      overallCostDeltaVsReadableCny: overallCostDeltaVsBaselineCny,
      overallCostDeltaVsReadablePercent: overallCostDeltaVsBaselinePercent,
      overallCostDeltaVsBb9BestCny,
      overallCostDeltaVsBb9BestPercent,
      conclusionLevel: strongEvidence
        ? `bb9_handoff_${family}_cost_evidence`
        : promisingSignal
        ? `bb9_handoff_${family}_promising_signal`
        : `bb9_handoff_${family}_inconclusive`,
    };
  });
  const handoffConclusionLevel =
    rawResult.mode === "handoffPoc" && handoffStats.some((item) => item.conclusionLevel.endsWith("_cost_evidence"))
      ? "bb9_handoff_poc_cost_evidence"
      : rawResult.mode === "handoffPoc" && handoffStats.some((item) => item.conclusionLevel.endsWith("_promising_signal"))
      ? "bb9_handoff_poc_promising_signal"
      : rawResult.mode === "handoffPoc"
      ? "bb9_handoff_poc_inconclusive"
      : undefined;
  const activePromptStats = ["full", "lite"].map((family) => {
    const baselineVariant = family === "full" ? "readableFull" : "readableLite";
    const candidateVariant = family === "full" ? "cacheSidecarFullOnly" : "cacheSidecarLiteOnly";
    const baselineCost = variants[baselineVariant]?.medianEstimatedCostCny;
    const candidateCost = variants[candidateVariant]?.medianEstimatedCostCny;
    const bb9BestCost = variants.bb9Best?.medianEstimatedCostCny;
    const overallCostDeltaVsBaselineCny =
      typeof baselineCost === "number" && typeof candidateCost === "number"
        ? candidateCost - baselineCost
        : null;
    const overallCostDeltaVsBaselinePercent =
      typeof overallCostDeltaVsBaselineCny === "number" && baselineCost
        ? overallCostDeltaVsBaselineCny / baselineCost
        : null;
    const overallCostDeltaVsBb9BestCny =
      typeof bb9BestCost === "number" && typeof candidateCost === "number"
        ? candidateCost - bb9BestCost
        : null;
    const overallCostDeltaVsBb9BestPercent =
      typeof overallCostDeltaVsBb9BestCny === "number" && bb9BestCost
        ? overallCostDeltaVsBb9BestCny / bb9BestCost
        : null;
    const familyComparisons = activePromptComparisons.filter((item) => item.family === family);
    const cacheRatioWins = familyComparisons.filter((item) => item.candidateCacheRatioWinVsBaseline).length;
    const costWins = familyComparisons.filter((item) => item.candidateEstimatedCostWinVsBaseline).length;
    const noWorseThanBb9Best = familyComparisons.filter((item) => item.candidateEstimatedCostNoWorseThanBb9Best).length;
    const strongEvidence =
      rawResult.mode === "activePromptPoc" &&
      validRequestCount >= largeSampleThreshold &&
      cacheFieldVisibilityRate >= 0.95 &&
      familyComparisons.length >= 15 &&
      costWins >= 15 &&
      typeof overallCostDeltaVsBaselinePercent === "number" &&
      overallCostDeltaVsBaselinePercent <= -0.05;
    const mergeCandidate =
      strongEvidence &&
      noWorseThanBb9Best === familyComparisons.length;
    const promisingSignal =
      rawResult.mode === "activePromptPoc" &&
      validRequestCount >= largeSampleThreshold &&
      cacheFieldVisibilityRate >= 0.95 &&
      familyComparisons.length >= 15 &&
      costWins >= 12 &&
      typeof overallCostDeltaVsBaselinePercent === "number" &&
      overallCostDeltaVsBaselinePercent <= -0.03;
    return {
      family,
      baselineVariant,
      candidateVariant,
      referenceVariant: "bb9Best",
      cacheRatioWinsVsReadable: cacheRatioWins,
      estimatedCostWinsVsReadable: costWins,
      estimatedCostNoWorseThanBb9Best: noWorseThanBb9Best,
      overallCostDeltaVsReadableCny: overallCostDeltaVsBaselineCny,
      overallCostDeltaVsReadablePercent: overallCostDeltaVsBaselinePercent,
      overallCostDeltaVsBb9BestCny,
      overallCostDeltaVsBb9BestPercent,
      conclusionLevel: mergeCandidate
        ? `bb10_active_prompt_${family}_merge_candidate`
        : strongEvidence
        ? `bb10_active_prompt_${family}_cost_evidence`
        : promisingSignal
        ? `bb10_active_prompt_${family}_promising_signal`
        : `bb10_active_prompt_${family}_inconclusive`,
    };
  });
  const activePromptConclusionLevel =
    rawResult.mode === "activePromptPoc" && activePromptStats.some((item) => item.conclusionLevel.endsWith("_merge_candidate"))
      ? "bb10_active_prompt_merge_candidate"
      : rawResult.mode === "activePromptPoc" && activePromptStats.some((item) => item.conclusionLevel.endsWith("_cost_evidence"))
      ? "bb10_active_prompt_cost_evidence"
      : rawResult.mode === "activePromptPoc" && activePromptStats.some((item) => item.conclusionLevel.endsWith("_promising_signal"))
      ? "bb10_active_prompt_promising_signal"
      : rawResult.mode === "activePromptPoc"
      ? "bb10_active_prompt_inconclusive"
      : undefined;
  const trimBaselineCost = variants.readableLite?.medianEstimatedCostCny;
  const trimBb10Cost = variants.cacheSidecarLiteOnly?.medianEstimatedCostCny;
  const trimCandidateCost = variants.cacheSidecarLiteTrimOnly?.medianEstimatedCostCny;
  const trimBb9BestCost = variants.bb9Best?.medianEstimatedCostCny;
  const trimGuardCost = variants.bb11SelectorGuard?.medianEstimatedCostCny;
  const trimOverallCostDeltaVsReadableCny =
    typeof trimBaselineCost === "number" && typeof trimCandidateCost === "number"
      ? trimCandidateCost - trimBaselineCost
      : null;
  const trimOverallCostDeltaVsReadablePercent =
    typeof trimOverallCostDeltaVsReadableCny === "number" && trimBaselineCost
      ? trimOverallCostDeltaVsReadableCny / trimBaselineCost
      : null;
  const trimOverallCostDeltaVsBb10Cny =
    typeof trimBb10Cost === "number" && typeof trimCandidateCost === "number"
      ? trimCandidateCost - trimBb10Cost
      : null;
  const trimOverallCostDeltaVsBb10Percent =
    typeof trimOverallCostDeltaVsBb10Cny === "number" && trimBb10Cost
      ? trimOverallCostDeltaVsBb10Cny / trimBb10Cost
      : null;
  const trimOverallCostDeltaVsBb9BestCny =
    typeof trimBb9BestCost === "number" && typeof trimCandidateCost === "number"
      ? trimCandidateCost - trimBb9BestCost
      : null;
  const trimOverallCostDeltaVsBb9BestPercent =
    typeof trimOverallCostDeltaVsBb9BestCny === "number" && trimBb9BestCost
      ? trimOverallCostDeltaVsBb9BestCny / trimBb9BestCost
      : null;
  const guardOverallCostDeltaVsReadableCny =
    typeof trimBaselineCost === "number" && typeof trimGuardCost === "number"
      ? trimGuardCost - trimBaselineCost
      : null;
  const guardOverallCostDeltaVsReadablePercent =
    typeof guardOverallCostDeltaVsReadableCny === "number" && trimBaselineCost
      ? guardOverallCostDeltaVsReadableCny / trimBaselineCost
      : null;
  const guardOverallCostDeltaVsBb9BestCny =
    typeof trimBb9BestCost === "number" && typeof trimGuardCost === "number"
      ? trimGuardCost - trimBb9BestCost
      : null;
  const guardOverallCostDeltaVsBb9BestPercent =
    typeof guardOverallCostDeltaVsBb9BestCny === "number" && trimBb9BestCost
      ? guardOverallCostDeltaVsBb9BestCny / trimBb9BestCost
      : null;
  const trimCostWinsVsReadable = activePromptTrimComparisons.filter((item) => item.candidateEstimatedCostWinVsReadable).length;
  const trimCostWinsVsBb10 = activePromptTrimComparisons.filter((item) => item.candidateEstimatedCostWinVsBb10).length;
  const trimNoWorseThanBb9Best = activePromptTrimComparisons.filter((item) => item.candidateEstimatedCostNoWorseThanBb9Best).length;
  const guardCostWinsVsReadable = activePromptTrimComparisons.filter((item) => item.selectorGuardEstimatedCostWinVsReadable).length;
  const guardNoWorseThanBb9Best = activePromptTrimComparisons.filter((item) => item.selectorGuardEstimatedCostNoWorseThanBb9Best).length;
  const trimStrongEvidence =
    rawResult.mode === "activePromptTrimPoc" &&
    validRequestCount >= largeSampleThreshold &&
    cacheFieldVisibilityRate >= 0.95 &&
    activePromptTrimComparisons.length >= 15 &&
    trimCostWinsVsReadable >= 15 &&
    typeof trimOverallCostDeltaVsReadablePercent === "number" &&
    trimOverallCostDeltaVsReadablePercent <= -0.05;
  const trimPromisingSignal =
    rawResult.mode === "activePromptTrimPoc" &&
    validRequestCount >= largeSampleThreshold &&
    cacheFieldVisibilityRate >= 0.95 &&
    activePromptTrimComparisons.length >= 15 &&
    trimCostWinsVsReadable >= 12 &&
    typeof trimOverallCostDeltaVsReadablePercent === "number" &&
    trimOverallCostDeltaVsReadablePercent <= -0.03;
  const guardCandidate =
    trimStrongEvidence &&
    guardCostWinsVsReadable >= 15 &&
    guardNoWorseThanBb9Best === activePromptTrimComparisons.length &&
    typeof guardOverallCostDeltaVsReadablePercent === "number" &&
    guardOverallCostDeltaVsReadablePercent <= -0.05;
  const activePromptTrimStats = rawResult.mode === "activePromptTrimPoc" ? {
    family: "lite",
    baselineVariant: "readableLite",
    previousVariant: "cacheSidecarLiteOnly",
    candidateVariant: "cacheSidecarLiteTrimOnly",
    selectorGuardVariant: "bb11SelectorGuard",
    referenceVariant: "bb9Best",
    estimatedCostWinsVsReadable: trimCostWinsVsReadable,
    estimatedCostWinsVsBb10: trimCostWinsVsBb10,
    estimatedCostNoWorseThanBb9Best: trimNoWorseThanBb9Best,
    selectorGuardEstimatedCostWinsVsReadable: guardCostWinsVsReadable,
    selectorGuardEstimatedCostNoWorseThanBb9Best: guardNoWorseThanBb9Best,
    comparisonCount: activePromptTrimComparisons.length,
    overallCostDeltaVsReadableCny: trimOverallCostDeltaVsReadableCny,
    overallCostDeltaVsReadablePercent: trimOverallCostDeltaVsReadablePercent,
    overallCostDeltaVsBb10Cny: trimOverallCostDeltaVsBb10Cny,
    overallCostDeltaVsBb10Percent: trimOverallCostDeltaVsBb10Percent,
    overallCostDeltaVsBb9BestCny: trimOverallCostDeltaVsBb9BestCny,
    overallCostDeltaVsBb9BestPercent: trimOverallCostDeltaVsBb9BestPercent,
    selectorGuardOverallCostDeltaVsReadableCny: guardOverallCostDeltaVsReadableCny,
    selectorGuardOverallCostDeltaVsReadablePercent: guardOverallCostDeltaVsReadablePercent,
    selectorGuardOverallCostDeltaVsBb9BestCny: guardOverallCostDeltaVsBb9BestCny,
    selectorGuardOverallCostDeltaVsBb9BestPercent: guardOverallCostDeltaVsBb9BestPercent,
    conclusionLevel: guardCandidate
      ? "bb11_active_prompt_trim_selector_guard_candidate"
      : trimStrongEvidence
      ? "bb11_active_prompt_trim_cost_evidence"
      : trimPromisingSignal
      ? "bb11_active_prompt_trim_promising_signal"
      : "bb11_active_prompt_trim_inconclusive",
  } : undefined;
  const activePromptTrimConclusionLevel = rawResult.mode === "activePromptTrimPoc"
    ? activePromptTrimStats.conclusionLevel
    : undefined;
  const sidecarStats = ["full", "lite"].map((family) => {
    const variant = family === "full" ? "bb5SidecarFull" : "bb5SidecarLite";
    const sidecarCost = variants[variant]?.medianEstimatedCostCny;
    const naturalBaselineCost = variants.natural?.medianEstimatedCostCny;
    const bb4BaselineCost = variants.bb4AnchorPad?.medianEstimatedCostCny;
    const overallCostDeltaVsNaturalCny =
      typeof sidecarCost === "number" && typeof naturalBaselineCost === "number"
        ? sidecarCost - naturalBaselineCost
        : null;
    const overallCostDeltaVsNaturalPercent =
      typeof overallCostDeltaVsNaturalCny === "number" && naturalBaselineCost
        ? overallCostDeltaVsNaturalCny / naturalBaselineCost
        : null;
    const overallCostDeltaVsBb4Cny =
      typeof sidecarCost === "number" && typeof bb4BaselineCost === "number"
        ? sidecarCost - bb4BaselineCost
        : null;
    const overallCostDeltaVsBb4Percent =
      typeof overallCostDeltaVsBb4Cny === "number" && bb4BaselineCost
        ? overallCostDeltaVsBb4Cny / bb4BaselineCost
        : null;
    const familyComparisons = sidecarComparisons.filter((item) => item.family === family);
    const cacheRatioWinsVsNatural = familyComparisons.filter((item) => item.sidecarCacheRatioWinVsNatural).length;
    const estimatedCostWinsVsNatural = familyComparisons.filter((item) => item.sidecarEstimatedCostWinVsNatural).length;
    const estimatedCostWinsVsBb4 = familyComparisons.filter((item) => item.sidecarEstimatedCostWinVsBb4).length;
    const strongVsNatural =
      rawResult.mode === "sidecar" &&
      validRequestCount >= largeSampleThreshold &&
      cacheFieldVisibilityRate >= 0.95 &&
      familyComparisons.length >= 15 &&
      estimatedCostWinsVsNatural >= 15 &&
      typeof overallCostDeltaVsNaturalPercent === "number" &&
      overallCostDeltaVsNaturalPercent <= -0.05;
    const notWeakerThanBb4 =
      rawResult.mode === "sidecar" &&
      familyComparisons.length >= 15 &&
      estimatedCostWinsVsBb4 >= 9 &&
      typeof overallCostDeltaVsBb4Percent === "number" &&
      overallCostDeltaVsBb4Percent <= 0;
    const promising =
      rawResult.mode === "sidecar" &&
      validRequestCount >= largeSampleThreshold &&
      cacheFieldVisibilityRate >= 0.95 &&
      familyComparisons.length >= 15 &&
      estimatedCostWinsVsNatural >= 12 &&
      typeof overallCostDeltaVsNaturalPercent === "number" &&
      overallCostDeltaVsNaturalPercent <= -0.03;
    return {
      family,
      variant,
      cacheRatioWinsVsNatural,
      estimatedCostWinsVsNatural,
      estimatedCostWinsVsBb4,
      overallCostDeltaVsNaturalCny,
      overallCostDeltaVsNaturalPercent,
      overallCostDeltaVsBb4Cny,
      overallCostDeltaVsBb4Percent,
      conclusionLevel: strongVsNatural && notWeakerThanBb4
        ? `bb5_sidecar_${family}_best_evidence`
        : strongVsNatural
        ? `bb5_sidecar_${family}_cost_evidence`
        : promising
        ? `bb5_sidecar_${family}_promising_signal`
        : `bb5_sidecar_${family}_inconclusive`,
    };
  });
  const sidecarConclusionLevel =
    rawResult.mode === "sidecar" && sidecarStats.some((item) => item.conclusionLevel.endsWith("_best_evidence"))
      ? "bb5_sidecar_best_evidence"
      : rawResult.mode === "sidecar" && sidecarStats.some((item) => item.conclusionLevel.endsWith("_cost_evidence"))
      ? "bb5_sidecar_cost_evidence"
      : rawResult.mode === "sidecar" && sidecarStats.some((item) => item.conclusionLevel.endsWith("_promising_signal"))
      ? "bb5_sidecar_promising_signal"
      : rawResult.mode === "sidecar"
      ? "bb5_sidecar_inconclusive"
      : undefined;
  const hybridStats = ["full", "lite"].map((family) => {
    const variant = family === "full" ? "bb6HybridFull" : "bb6HybridLite";
    const bb5Variant = family === "full" ? "bb5SidecarFull" : "bb5SidecarLite";
    const hybridCost = variants[variant]?.medianEstimatedCostCny;
    const naturalBaselineCost = variants.natural?.medianEstimatedCostCny;
    const bb4BaselineCost = variants.bb4AnchorPad?.medianEstimatedCostCny;
    const bb5BaselineCost = variants[bb5Variant]?.medianEstimatedCostCny;
    const overallCostDeltaVsNaturalCny =
      typeof hybridCost === "number" && typeof naturalBaselineCost === "number"
        ? hybridCost - naturalBaselineCost
        : null;
    const overallCostDeltaVsNaturalPercent =
      typeof overallCostDeltaVsNaturalCny === "number" && naturalBaselineCost
        ? overallCostDeltaVsNaturalCny / naturalBaselineCost
        : null;
    const overallCostDeltaVsBb4Cny =
      typeof hybridCost === "number" && typeof bb4BaselineCost === "number"
        ? hybridCost - bb4BaselineCost
        : null;
    const overallCostDeltaVsBb4Percent =
      typeof overallCostDeltaVsBb4Cny === "number" && bb4BaselineCost
        ? overallCostDeltaVsBb4Cny / bb4BaselineCost
        : null;
    const overallCostDeltaVsBb5Cny =
      typeof hybridCost === "number" && typeof bb5BaselineCost === "number"
        ? hybridCost - bb5BaselineCost
        : null;
    const overallCostDeltaVsBb5Percent =
      typeof overallCostDeltaVsBb5Cny === "number" && bb5BaselineCost
        ? overallCostDeltaVsBb5Cny / bb5BaselineCost
        : null;
    const familyComparisons = hybridComparisons.filter((item) => item.family === family);
    const cacheRatioWinsVsNatural = familyComparisons.filter((item) => item.hybridCacheRatioWinVsNatural).length;
    const estimatedCostWinsVsNatural = familyComparisons.filter((item) => item.hybridEstimatedCostWinVsNatural).length;
    const estimatedCostWinsVsBb4 = familyComparisons.filter((item) => item.hybridEstimatedCostWinVsBb4).length;
    const estimatedCostWinsVsBb5 = familyComparisons.filter((item) => item.hybridEstimatedCostWinVsBb5).length;
    const strongVsNatural =
      rawResult.mode === "hybrid" &&
      validRequestCount >= largeSampleThreshold &&
      cacheFieldVisibilityRate >= 0.95 &&
      familyComparisons.length >= 15 &&
      estimatedCostWinsVsNatural >= 15 &&
      typeof overallCostDeltaVsNaturalPercent === "number" &&
      overallCostDeltaVsNaturalPercent <= -0.05;
    const notWeakerThanBb5 =
      rawResult.mode === "hybrid" &&
      familyComparisons.length >= 15 &&
      estimatedCostWinsVsBb5 >= 9 &&
      typeof overallCostDeltaVsBb5Percent === "number" &&
      overallCostDeltaVsBb5Percent <= 0;
    const promising =
      rawResult.mode === "hybrid" &&
      validRequestCount >= largeSampleThreshold &&
      cacheFieldVisibilityRate >= 0.95 &&
      familyComparisons.length >= 15 &&
      estimatedCostWinsVsNatural >= 12 &&
      typeof overallCostDeltaVsNaturalPercent === "number" &&
      overallCostDeltaVsNaturalPercent <= -0.03;
    return {
      family,
      variant,
      baselineVariant: bb5Variant,
      cacheRatioWinsVsNatural,
      estimatedCostWinsVsNatural,
      estimatedCostWinsVsBb4,
      estimatedCostWinsVsBb5,
      overallCostDeltaVsNaturalCny,
      overallCostDeltaVsNaturalPercent,
      overallCostDeltaVsBb4Cny,
      overallCostDeltaVsBb4Percent,
      overallCostDeltaVsBb5Cny,
      overallCostDeltaVsBb5Percent,
      conclusionLevel: strongVsNatural && notWeakerThanBb5
        ? `bb6_hybrid_${family}_best_evidence`
        : strongVsNatural
        ? `bb6_hybrid_${family}_cost_evidence`
        : promising
        ? `bb6_hybrid_${family}_promising_signal`
        : `bb6_hybrid_${family}_inconclusive`,
    };
  });
  const hybridConclusionLevel =
    rawResult.mode === "hybrid" && hybridStats.some((item) => item.conclusionLevel.endsWith("_best_evidence"))
      ? "bb6_hybrid_best_evidence"
      : rawResult.mode === "hybrid" && hybridStats.some((item) => item.conclusionLevel.endsWith("_cost_evidence"))
      ? "bb6_hybrid_cost_evidence"
      : rawResult.mode === "hybrid" && hybridStats.some((item) => item.conclusionLevel.endsWith("_promising_signal"))
      ? "bb6_hybrid_promising_signal"
      : rawResult.mode === "hybrid"
      ? "bb6_hybrid_inconclusive"
      : undefined;
  const blockPadCost = variants.bb7BlockPadLite?.medianEstimatedCostCny;
  const blockPadNaturalCost = variants.natural?.medianEstimatedCostCny;
  const blockPadBb5Cost = variants.bb5SidecarLite?.medianEstimatedCostCny;
  const blockPadBb6Cost = variants.bb6HybridLite?.medianEstimatedCostCny;
  const blockPadOverallCostDeltaVsNaturalCny =
    typeof blockPadCost === "number" && typeof blockPadNaturalCost === "number"
      ? blockPadCost - blockPadNaturalCost
      : null;
  const blockPadOverallCostDeltaVsNaturalPercent =
    typeof blockPadOverallCostDeltaVsNaturalCny === "number" && blockPadNaturalCost
      ? blockPadOverallCostDeltaVsNaturalCny / blockPadNaturalCost
      : null;
  const blockPadOverallCostDeltaVsBb5Cny =
    typeof blockPadCost === "number" && typeof blockPadBb5Cost === "number"
      ? blockPadCost - blockPadBb5Cost
      : null;
  const blockPadOverallCostDeltaVsBb5Percent =
    typeof blockPadOverallCostDeltaVsBb5Cny === "number" && blockPadBb5Cost
      ? blockPadOverallCostDeltaVsBb5Cny / blockPadBb5Cost
      : null;
  const blockPadOverallCostDeltaVsBb6Cny =
    typeof blockPadCost === "number" && typeof blockPadBb6Cost === "number"
      ? blockPadCost - blockPadBb6Cost
      : null;
  const blockPadOverallCostDeltaVsBb6Percent =
    typeof blockPadOverallCostDeltaVsBb6Cny === "number" && blockPadBb6Cost
      ? blockPadOverallCostDeltaVsBb6Cny / blockPadBb6Cost
      : null;
  const blockPadCacheRatioWinsVsNatural = blockPadComparisons.filter((item) => item.blockPadCacheRatioWinVsNatural).length;
  const blockPadEstimatedCostWinsVsNatural = blockPadComparisons.filter((item) => item.blockPadEstimatedCostWinVsNatural).length;
  const blockPadEstimatedCostWinsVsBb5 = blockPadComparisons.filter((item) => item.blockPadEstimatedCostWinVsBb5).length;
  const blockPadEstimatedCostWinsVsBb6 = blockPadComparisons.filter((item) => item.blockPadEstimatedCostWinVsBb6).length;
  const blockPadStrongVsNatural =
    rawResult.mode === "blockpad" &&
    validRequestCount >= largeSampleThreshold &&
    cacheFieldVisibilityRate >= 0.95 &&
    blockPadComparisons.length >= 15 &&
    blockPadEstimatedCostWinsVsNatural >= 15 &&
    typeof blockPadOverallCostDeltaVsNaturalPercent === "number" &&
    blockPadOverallCostDeltaVsNaturalPercent <= -0.05;
  const blockPadNotWeakerThanBb6 =
    rawResult.mode === "blockpad" &&
    blockPadComparisons.length >= 15 &&
    blockPadEstimatedCostWinsVsBb6 >= 9 &&
    typeof blockPadOverallCostDeltaVsBb6Percent === "number" &&
    blockPadOverallCostDeltaVsBb6Percent <= 0;
  const blockPadPromising =
    rawResult.mode === "blockpad" &&
    validRequestCount >= largeSampleThreshold &&
    cacheFieldVisibilityRate >= 0.95 &&
    blockPadComparisons.length >= 15 &&
    blockPadEstimatedCostWinsVsNatural >= 12 &&
    typeof blockPadOverallCostDeltaVsNaturalPercent === "number" &&
    blockPadOverallCostDeltaVsNaturalPercent <= -0.03;
  const blockPadStats = rawResult.mode === "blockpad" ? {
    variant: "bb7BlockPadLite",
    baselineVariant: "bb6HybridLite",
    cacheRatioWinsVsNatural: blockPadCacheRatioWinsVsNatural,
    estimatedCostWinsVsNatural: blockPadEstimatedCostWinsVsNatural,
    estimatedCostWinsVsBb5: blockPadEstimatedCostWinsVsBb5,
    estimatedCostWinsVsBb6: blockPadEstimatedCostWinsVsBb6,
    overallCostDeltaVsNaturalCny: blockPadOverallCostDeltaVsNaturalCny,
    overallCostDeltaVsNaturalPercent: blockPadOverallCostDeltaVsNaturalPercent,
    overallCostDeltaVsBb5Cny: blockPadOverallCostDeltaVsBb5Cny,
    overallCostDeltaVsBb5Percent: blockPadOverallCostDeltaVsBb5Percent,
    overallCostDeltaVsBb6Cny: blockPadOverallCostDeltaVsBb6Cny,
    overallCostDeltaVsBb6Percent: blockPadOverallCostDeltaVsBb6Percent,
    conclusionLevel: blockPadStrongVsNatural && blockPadNotWeakerThanBb6
      ? "bb7_blockpad_best_evidence"
      : blockPadStrongVsNatural
      ? "bb7_blockpad_cost_evidence"
      : blockPadPromising
      ? "bb7_blockpad_promising_signal"
      : "bb7_blockpad_inconclusive",
  } : undefined;
  const blockPadConclusionLevel = rawResult.mode === "blockpad" ? blockPadStats.conclusionLevel : undefined;
  const adaptiveSelectorComparisons = rawResult.mode === "blockpad" ? blockPadComparisons.map((item) => {
    const candidates = [
      { variant: "natural", cost: item.naturalMedianEstimatedCostCny, cacheRatio: item.naturalMedianCacheRatio },
      { variant: "bb5SidecarLite", cost: item.bb5MedianEstimatedCostCny, cacheRatio: item.bb5MedianCacheRatio },
      { variant: "bb6HybridLite", cost: item.bb6MedianEstimatedCostCny, cacheRatio: item.bb6MedianCacheRatio },
      { variant: "bb7BlockPadLite", cost: item.blockPadMedianEstimatedCostCny, cacheRatio: item.blockPadMedianCacheRatio },
    ].filter((candidate) => typeof candidate.cost === "number");
    const selected = candidates.sort((a, b) => a.cost - b.cost)[0] || { variant: "unknown", cost: null, cacheRatio: null };
    const naturalCost = item.naturalMedianEstimatedCostCny;
    const selectedDeltaVsNaturalCny =
      typeof selected.cost === "number" && typeof naturalCost === "number"
        ? selected.cost - naturalCost
        : null;
    const selectedDeltaVsNaturalPercent =
      typeof selectedDeltaVsNaturalCny === "number" && naturalCost
        ? selectedDeltaVsNaturalCny / naturalCost
        : null;
    return {
      projectId: item.projectId,
      scenarioId: item.scenarioId,
      selectedVariant: selected.variant,
      selectedMedianEstimatedCostCny: selected.cost,
      selectedMedianCacheRatio: selected.cacheRatio,
      naturalMedianEstimatedCostCny: naturalCost,
      selectedCostDeltaVsNaturalCny: selectedDeltaVsNaturalCny,
      selectedCostDeltaVsNaturalPercent: selectedDeltaVsNaturalPercent,
      selectedEstimatedCostWinVsNatural:
        typeof selected.cost === "number" && typeof naturalCost === "number" && selected.cost < naturalCost,
      selectedEstimatedCostNoWorseThanNatural:
        typeof selected.cost === "number" && typeof naturalCost === "number" && selected.cost <= naturalCost,
    };
  }) : [];
  const adaptiveSelectorWinsVsNatural = adaptiveSelectorComparisons.filter((item) => item.selectedEstimatedCostWinVsNatural).length;
  const adaptiveSelectorNoWorseVsNatural = adaptiveSelectorComparisons.filter((item) => item.selectedEstimatedCostNoWorseThanNatural).length;
  const adaptiveSelectorMedianCost = median(adaptiveSelectorComparisons.map((item) => item.selectedMedianEstimatedCostCny));
  const adaptiveSelectorNaturalMedianCost = median(adaptiveSelectorComparisons.map((item) => item.naturalMedianEstimatedCostCny));
  const adaptiveSelectorOverallCostDeltaCny =
    typeof adaptiveSelectorMedianCost === "number" && typeof adaptiveSelectorNaturalMedianCost === "number"
      ? adaptiveSelectorMedianCost - adaptiveSelectorNaturalMedianCost
      : null;
  const adaptiveSelectorOverallCostDeltaPercent =
    typeof adaptiveSelectorOverallCostDeltaCny === "number" && adaptiveSelectorNaturalMedianCost
      ? adaptiveSelectorOverallCostDeltaCny / adaptiveSelectorNaturalMedianCost
      : null;
  const adaptiveSelectorStrong =
    rawResult.mode === "blockpad" &&
    validRequestCount >= largeSampleThreshold &&
    cacheFieldVisibilityRate >= 0.95 &&
    adaptiveSelectorComparisons.length >= 15 &&
    adaptiveSelectorWinsVsNatural >= 15 &&
    adaptiveSelectorNoWorseVsNatural === adaptiveSelectorComparisons.length &&
    typeof adaptiveSelectorOverallCostDeltaPercent === "number" &&
    adaptiveSelectorOverallCostDeltaPercent <= -0.05;
  const adaptiveSelectorPromising =
    rawResult.mode === "blockpad" &&
    validRequestCount >= largeSampleThreshold &&
    cacheFieldVisibilityRate >= 0.95 &&
    adaptiveSelectorComparisons.length >= 15 &&
    adaptiveSelectorWinsVsNatural >= 12 &&
    adaptiveSelectorNoWorseVsNatural === adaptiveSelectorComparisons.length &&
    typeof adaptiveSelectorOverallCostDeltaPercent === "number" &&
    adaptiveSelectorOverallCostDeltaPercent <= -0.03;
  const adaptiveSelectorStats = rawResult.mode === "blockpad" ? {
    selectorId: "bb9AdaptiveSelector",
    candidateVariants: ["natural", "bb5SidecarLite", "bb6HybridLite", "bb7BlockPadLite"],
    estimatedCostWinsVsNatural: adaptiveSelectorWinsVsNatural,
    estimatedCostNoWorseVsNatural: adaptiveSelectorNoWorseVsNatural,
    comparisonCount: adaptiveSelectorComparisons.length,
    medianEstimatedCostCny: adaptiveSelectorMedianCost,
    naturalMedianEstimatedCostCny: adaptiveSelectorNaturalMedianCost,
    overallCostDeltaVsNaturalCny: adaptiveSelectorOverallCostDeltaCny,
    overallCostDeltaVsNaturalPercent: adaptiveSelectorOverallCostDeltaPercent,
    conclusionLevel: adaptiveSelectorStrong
      ? "bb9_adaptive_selector_best_evidence"
      : adaptiveSelectorPromising
      ? "bb9_adaptive_selector_promising_signal"
      : "bb9_adaptive_selector_inconclusive",
  } : undefined;
  const alignedCost = variants.bb8AlignedBlockPadLite?.medianEstimatedCostCny;
  const alignedNaturalCost = variants.natural?.medianEstimatedCostCny;
  const alignedBb7Cost = variants.bb7BlockPadLite?.medianEstimatedCostCny;
  const alignedOverallCostDeltaVsNaturalCny =
    typeof alignedCost === "number" && typeof alignedNaturalCost === "number"
      ? alignedCost - alignedNaturalCost
      : null;
  const alignedOverallCostDeltaVsNaturalPercent =
    typeof alignedOverallCostDeltaVsNaturalCny === "number" && alignedNaturalCost
      ? alignedOverallCostDeltaVsNaturalCny / alignedNaturalCost
      : null;
  const alignedOverallCostDeltaVsBb7Cny =
    typeof alignedCost === "number" && typeof alignedBb7Cost === "number"
      ? alignedCost - alignedBb7Cost
      : null;
  const alignedOverallCostDeltaVsBb7Percent =
    typeof alignedOverallCostDeltaVsBb7Cny === "number" && alignedBb7Cost
      ? alignedOverallCostDeltaVsBb7Cny / alignedBb7Cost
      : null;
  const alignedCacheRatioWinsVsNatural = alignedBlockPadComparisons.filter((item) => item.alignedCacheRatioWinVsNatural).length;
  const alignedEstimatedCostWinsVsNatural = alignedBlockPadComparisons.filter((item) => item.alignedEstimatedCostWinVsNatural).length;
  const alignedEstimatedCostWinsVsBb7 = alignedBlockPadComparisons.filter((item) => item.alignedEstimatedCostWinVsBb7).length;
  const alignedStrongVsNatural =
    rawResult.mode === "blockalign" &&
    validRequestCount >= largeSampleThreshold &&
    cacheFieldVisibilityRate >= 0.95 &&
    alignedBlockPadComparisons.length >= 15 &&
    alignedEstimatedCostWinsVsNatural >= 15 &&
    typeof alignedOverallCostDeltaVsNaturalPercent === "number" &&
    alignedOverallCostDeltaVsNaturalPercent <= -0.05;
  const alignedNotWeakerThanBb7 =
    rawResult.mode === "blockalign" &&
    alignedBlockPadComparisons.length >= 15 &&
    alignedEstimatedCostWinsVsBb7 >= 9 &&
    typeof alignedOverallCostDeltaVsBb7Percent === "number" &&
    alignedOverallCostDeltaVsBb7Percent <= 0;
  const alignedPromising =
    rawResult.mode === "blockalign" &&
    validRequestCount >= largeSampleThreshold &&
    cacheFieldVisibilityRate >= 0.95 &&
    alignedBlockPadComparisons.length >= 15 &&
    alignedEstimatedCostWinsVsNatural >= 12 &&
    typeof alignedOverallCostDeltaVsNaturalPercent === "number" &&
    alignedOverallCostDeltaVsNaturalPercent <= -0.03;
  const alignedBlockPadStats = rawResult.mode === "blockalign" ? {
    variant: "bb8AlignedBlockPadLite",
    baselineVariant: "bb7BlockPadLite",
    cacheRatioWinsVsNatural: alignedCacheRatioWinsVsNatural,
    estimatedCostWinsVsNatural: alignedEstimatedCostWinsVsNatural,
    estimatedCostWinsVsBb7: alignedEstimatedCostWinsVsBb7,
    overallCostDeltaVsNaturalCny: alignedOverallCostDeltaVsNaturalCny,
    overallCostDeltaVsNaturalPercent: alignedOverallCostDeltaVsNaturalPercent,
    overallCostDeltaVsBb7Cny: alignedOverallCostDeltaVsBb7Cny,
    overallCostDeltaVsBb7Percent: alignedOverallCostDeltaVsBb7Percent,
    conclusionLevel: alignedStrongVsNatural && alignedNotWeakerThanBb7
      ? "bb8_blockalign_best_evidence"
      : alignedStrongVsNatural
      ? "bb8_blockalign_cost_evidence"
      : alignedPromising
      ? "bb8_blockalign_promising_signal"
      : "bb8_blockalign_inconclusive",
  } : undefined;
  const alignedBlockPadConclusionLevel = rawResult.mode === "blockalign" ? alignedBlockPadStats.conclusionLevel : undefined;

  return {
    status: rawResult.status,
    startedAt: rawResult.startedAt,
    finishedAt: rawResult.finishedAt,
    providerName: rawResult.providerName,
    model: rawResult.model,
    providerProfileId: rawResult.providerProfileId,
    routeType: rawResult.routeType,
    evidenceLevel: rawResult.evidenceLevel,
    pricingBasis: rawResult.pricingBasis,
    billingAudited: rawResult.billingAudited,
    officialReferencePricingUsdPerMillionTokens: rawResult.officialReferencePricingUsdPerMillionTokens,
    mode: rawResult.mode || "absolute",
    benchmarkKind: "local-real-projects-redacted",
    pricingCnyPerMillionTokens:
      rawResult.pricingCnyPerMillionTokens === undefined
        ? CNY_CACHE_PRICING_PER_MILLION_TOKENS
        : rawResult.pricingCnyPerMillionTokens,
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
    readableStats: rawResult.mode === "readablePoc" ? readableStats : undefined,
    readableConclusionLevel,
    handoffStats: rawResult.mode === "handoffPoc" ? handoffStats : undefined,
    handoffConclusionLevel,
    activePromptStats: rawResult.mode === "activePromptPoc" ? activePromptStats : undefined,
    activePromptConclusionLevel,
    activePromptTrimStats,
    activePromptTrimConclusionLevel,
    sidecarStats: rawResult.mode === "sidecar" ? sidecarStats : undefined,
    sidecarConclusionLevel,
    hybridStats: rawResult.mode === "hybrid" ? hybridStats : undefined,
    hybridConclusionLevel,
    blockPadStats,
    blockPadConclusionLevel,
    adaptiveSelectorStats,
    alignedBlockPadStats,
    alignedBlockPadConclusionLevel,
    ratioConclusionLevel: ratioEvidence ? "ratio_large_sample_evidence" : "ratio_not_proven",
    costConclusionLevel: costEvidence ? "cost_large_sample_evidence" : "cost_not_proven",
    conclusionLevel:
      rawResult.mode === "hybrid"
        ? hybridConclusionLevel
        : rawResult.mode === "blockalign"
        ? alignedBlockPadConclusionLevel
        : rawResult.mode === "blockpad"
        ? (adaptiveSelectorStats?.conclusionLevel || blockPadConclusionLevel)
        : rawResult.mode === "sidecar"
        ? sidecarConclusionLevel
        : rawResult.mode === "activePromptTrimPoc"
        ? activePromptTrimConclusionLevel
        : rawResult.mode === "activePromptPoc"
        ? activePromptConclusionLevel
        : rawResult.mode === "handoffPoc"
        ? handoffConclusionLevel
        : rawResult.mode === "readablePoc"
        ? readableConclusionLevel
        : rawResult.mode === "padSweep"
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
    readableComparisons: readableComparisons.length ? readableComparisons : undefined,
    handoffComparisons: handoffComparisons.length ? handoffComparisons : undefined,
    activePromptComparisons: activePromptComparisons.length ? activePromptComparisons : undefined,
    activePromptTrimComparisons: activePromptTrimComparisons.length ? activePromptTrimComparisons : undefined,
    sidecarComparisons: sidecarComparisons.length ? sidecarComparisons : undefined,
    hybridComparisons: hybridComparisons.length ? hybridComparisons : undefined,
    blockPadComparisons: blockPadComparisons.length ? blockPadComparisons : undefined,
    adaptiveSelectorComparisons: adaptiveSelectorComparisons.length ? adaptiveSelectorComparisons : undefined,
    alignedBlockPadComparisons: alignedBlockPadComparisons.length ? alignedBlockPadComparisons : undefined,
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
    mode === "blockalign"
      ? "tests/outputs/private/provider-cache-benchmark-blockalign.raw.json"
      : mode === "activePromptTrimPoc"
      ? "tests/outputs/private/provider-cache-benchmark-active-prompt-trim-poc.raw.json"
      : mode === "activePromptPoc"
      ? "tests/outputs/private/provider-cache-benchmark-active-prompt-poc.raw.json"
      : mode === "handoffPoc"
      ? "tests/outputs/private/provider-cache-benchmark-handoff-poc.raw.json"
      : mode === "blockpad"
      ? "tests/outputs/private/provider-cache-benchmark-blockpad.raw.json"
      : mode === "hybrid"
      ? "tests/outputs/private/provider-cache-benchmark-hybrid.raw.json"
      : mode === "sidecar"
      ? "tests/outputs/private/provider-cache-benchmark-sidecar.raw.json"
      : mode === "readablePoc"
      ? "tests/outputs/private/provider-cache-benchmark-readable-poc.raw.json"
      : mode === "padSweep"
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
    mode === "blockalign"
      ? "tests/outputs/provider-cache-benchmark-blockalign.latest.json"
      : mode === "activePromptTrimPoc"
      ? "tests/outputs/provider-cache-benchmark-active-prompt-trim-poc.latest.json"
      : mode === "activePromptPoc"
      ? "tests/outputs/provider-cache-benchmark-active-prompt-poc.latest.json"
      : mode === "handoffPoc"
      ? "tests/outputs/provider-cache-benchmark-handoff-poc.latest.json"
      : mode === "blockpad"
      ? "tests/outputs/provider-cache-benchmark-blockpad.latest.json"
      : mode === "hybrid"
      ? "tests/outputs/provider-cache-benchmark-hybrid.latest.json"
      : mode === "sidecar"
      ? "tests/outputs/provider-cache-benchmark-sidecar.latest.json"
      : mode === "readablePoc"
      ? "tests/outputs/provider-cache-benchmark-readable-poc.latest.json"
      : mode === "padSweep"
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
  if (!["absolute", "normalized", "capsule", "anchor", "anchorpad", "padSweep", "readablePoc", "sidecar", "hybrid", "blockpad", "blockalign", "handoffPoc", "activePromptPoc", "activePromptTrimPoc"].includes(options.mode)) {
    throw new Error("Benchmark mode must be absolute, normalized, capsule, anchor, anchorpad, padSweep, readablePoc, sidecar, hybrid, blockpad, blockalign, handoffPoc, activePromptPoc, or activePromptTrimPoc.");
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
    routeType: env.routeType,
    evidenceLevel: env.evidenceLevel,
    pricingBasis: env.pricingBasis,
    billingAudited: env.billingAudited,
    officialReferencePricingUsdPerMillionTokens: env.officialReferencePricingUsdPerMillionTokens,
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
          const input = getPromptForVariant(options.mode, snapshot, scenario, iteration, variant, env.providerProfileId);
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
  GPT55_OFFICIAL_REFERENCE_PRICING_USD_PER_MILLION_TOKENS,
};
