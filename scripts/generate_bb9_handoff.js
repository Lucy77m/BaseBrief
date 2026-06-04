#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const profiles = require("./bb9_provider_profiles.json");

const REQUIRED_KEYS = [
  "project_identity",
  "current_goal",
  "verified_facts",
  "confirmed_decisions",
  "risk_boundaries",
  "expected_output",
  "tail_request",
];

const MODE_SET = new Set(["full", "lite"]);
const PAD_LENGTH = 335;

function sanitizeLine(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " / ")
    .replace(/[|]/g, "/")
    .replace(/[A-Z]:\\[^\s`'")]+/g, "[local-path]")
    .replace(/\/home\/[^\s`'")]+/g, "[local-path]")
    .replace(/sk-[A-Za-z0-9]{10,}/g, "[redacted-key]")
    .replace(/Bearer\s+[A-Za-z0-9._-]{10,}/g, "Bearer [redacted]")
    .replace(/\s+/g, " ")
    .trim();
}

function readString(data, key) {
  if (!(key in data)) throw new Error(`Missing required key: ${key}`);
  const value = sanitizeLine(data[key]);
  if (!value) throw new Error(`Empty required value: ${key}`);
  return value;
}

function readOptionalString(data, key) {
  if (!(key in data)) return "";
  return sanitizeLine(data[key]);
}

function readArray(data, key) {
  if (!(key in data)) throw new Error(`Missing required key: ${key}`);
  if (!Array.isArray(data[key])) throw new Error(`Expected array for key: ${key}`);
  const values = data[key].map((item) => sanitizeLine(item)).filter(Boolean);
  if (values.length === 0) throw new Error(`Array must contain at least one item: ${key}`);
  return values;
}

function readOptionalArray(data, key) {
  if (!(key in data)) return [];
  if (!Array.isArray(data[key])) throw new Error(`Expected array for key: ${key}`);
  return data[key].map((item) => sanitizeLine(item)).filter(Boolean);
}

function normalizeInput(data) {
  for (const key of REQUIRED_KEYS) {
    if (!(key in data)) throw new Error(`Missing required key: ${key}`);
  }
  return {
    projectIdentity: readString(data, "project_identity"),
    currentGoal: readString(data, "current_goal"),
    verifiedFacts: readArray(data, "verified_facts"),
    confirmedDecisions: readArray(data, "confirmed_decisions"),
    assumptions: readOptionalArray(data, "assumptions"),
    openQuestions: readOptionalArray(data, "open_questions"),
    riskBoundaries: readArray(data, "risk_boundaries"),
    forbiddenScope: readOptionalArray(data, "forbidden_scope"),
    expectedOutput: readString(data, "expected_output"),
    tailRequest: readString(data, "tail_request"),
    audience: readOptionalString(data, "audience"),
  };
}

function normalizeMode(mode) {
  const value = sanitizeLine(mode || "lite").toLowerCase();
  if (!MODE_SET.has(value)) {
    throw new Error("mode must be full or lite");
  }
  return value;
}

function getProviderProfile(profileId = "mimo") {
  const key = sanitizeLine(profileId || "mimo").toLowerCase();
  if (profiles[key]) return profiles[key];
  const byModel = Object.values(profiles).find((profile) => profile.model.toLowerCase() === key);
  if (byModel) return byModel;
  return {
    profileId: key || "unknown",
    providerName: "unknown",
    model: "unknown",
    routeType: "unknown",
    evidenceLevel: "no_cache_cost_evidence",
    pricingBasis: "unknown",
    billingAudited: false,
    cacheUsageObservable: false,
    defaultPromptStrategy: "readable_fallback",
    activePromptStrategy: "readableBrief",
    fallbackStrategy: "provider_profile_not_supported_readable_fallback",
    evidenceScope: "Unknown provider profile; no cache-cost evidence.",
    pricingCnyPerMillionTokens: null,
    candidateVariants: ["natural"],
    recommendedVariant: "natural",
    experimentalCandidates: [],
    fallbackReason: "provider_profile_not_supported",
    limitation: "Unknown provider profile; use readable BaseBrief only.",
  };
}

function bulletList(items, emptyValue = "- none") {
  if (!items.length) return emptyValue;
  return items.map((item) => `- ${item}`).join("\n");
}

function renderReadableBrief(input, mode) {
  const title = mode === "full" ? "# BaseBrief Full Handoff" : "# BaseBrief Lite Handoff";
  const lines = [
    title,
    "",
    "## project_identity",
    input.projectIdentity,
    "",
    "## current_goal",
    input.currentGoal,
    "",
    "## verified_facts",
    bulletList(input.verifiedFacts),
    "",
    "## confirmed_decisions",
    bulletList(input.confirmedDecisions),
  ];

  if (mode === "full") {
    lines.push(
      "",
      "## assumptions",
      bulletList(input.assumptions),
    );
  }

  lines.push(
    "",
    "## open_questions",
    bulletList(input.openQuestions),
    "",
    "## risk_boundaries",
    bulletList(input.riskBoundaries),
  );

  if (input.forbiddenScope.length) {
    lines.push("", "## forbidden_scope", bulletList(input.forbiddenScope));
  }

  lines.push(
    "",
    "## expected_output",
    input.expectedOutput,
    "",
    "## tail_request",
    input.tailRequest,
  );

  return `${lines.join("\n")}\n`;
}

function buildPadString(length) {
  return Array.from({ length }, () => "p").join(" ");
}

function renderCacheSidecar(input, mode, providerProfile) {
  const stableFacts = mode === "lite" ? input.verifiedFacts.slice(0, 6) : input.verifiedFacts;
  const stableDecisions = mode === "lite" ? input.confirmedDecisions.slice(0, 4) : input.confirmedDecisions;
  const stableRisks = mode === "lite" ? input.riskBoundaries.slice(0, 4) : input.riskBoundaries;
  const forbidden = input.forbiddenScope.length ? input.forbiddenScope : ["secrets", ".env", "private paths"];

  return [
    "# BaseBrief BB9 Cache Sidecar",
    "FORMAT: bb9-blockpad-lite-sidecar",
    "RULE: Keep everything before TAIL_REQUEST stable across repeats; only TAIL_REQUEST may change.",
    `PROFILE: ${providerProfile.profileId}`,
    `SELECTED_VARIANT: ${providerProfile.recommendedVariant}`,
    `MODE: ${mode}`,
    "",
    "## Stable Project Snapshot",
    `P=${input.projectIdentity}`,
    `G=${input.currentGoal}`,
    `F=${stableFacts.join(" ; ")}`,
    `D=${stableDecisions.join(" ; ")}`,
    `R=${stableRisks.join(" ; ")}`,
    `X=${forbidden.join(" ; ")}`,
    `O=${input.expectedOutput}`,
    "",
    `<!-- BASEBRIEF_CACHE_BLOCK_PAD: ${buildPadString(PAD_LENGTH)} -->`,
    "--",
    `TAIL_REQUEST=${input.tailRequest}`,
    "",
  ].join("\n");
}

function projectProviderProfile(profile) {
  return {
    profileId: profile.profileId,
    providerName: profile.providerName,
    model: profile.model,
    routeType: profile.routeType,
    evidenceLevel: profile.evidenceLevel,
    pricingBasis: profile.pricingBasis,
    billingAudited: profile.billingAudited,
    cacheUsageObservable: profile.cacheUsageObservable,
    defaultPromptStrategy: profile.defaultPromptStrategy,
    activePromptStrategy: profile.activePromptStrategy,
    fallbackStrategy: profile.fallbackStrategy,
    evidenceScope: profile.evidenceScope,
    pricingCnyPerMillionTokens: profile.pricingCnyPerMillionTokens,
    recommendedVariant: profile.recommendedVariant,
    experimentalCandidates: profile.experimentalCandidates || [],
    latestEvidence: profile.latestEvidence,
    limitation: profile.limitation,
  };
}

function generateBb9HandoffFromObject(data, options = {}) {
  const mode = normalizeMode(options.mode || data.mode);
  const input = normalizeInput(data);
  const providerProfile = getProviderProfile(options.providerProfile || data.provider_profile || "mimo");
  const warnings = [
    "Estimated-cost evidence is provider-specific and is not a billing audit.",
    "Readable full/lite content remains the primary project handoff surface.",
  ];
  const fallbackReason = providerProfile.cacheUsageObservable
    ? null
    : providerProfile.fallbackReason || "cache_usage_not_observable";
  const selectedVariant = providerProfile.cacheUsageObservable
    ? providerProfile.recommendedVariant
    : "natural";
  const recommendedPromptType = providerProfile.cacheUsageObservable ? "cacheSidecar" : "readableBrief";

  return {
    readableBrief: renderReadableBrief(input, mode),
    cacheSidecar: providerProfile.cacheUsageObservable
      ? renderCacheSidecar(input, mode, providerProfile)
      : null,
    selectedVariant,
    recommendedPromptType,
    activeProviderPrompt: providerProfile.cacheUsageObservable
      ? renderCacheSidecar(input, mode, providerProfile)
      : renderReadableBrief(input, mode),
    promptUsePolicy: {
      readableBrief: "Use for human review, project continuation, and safety boundaries.",
      cacheSidecar: providerProfile.cacheUsageObservable
        ? "Use as the active provider prompt for repeated cache-aware continuation. Do not concatenate it with readableBrief in the same provider request."
        : "Unavailable for this provider profile.",
      activeProviderPrompt: recommendedPromptType,
    },
    providerProfile: projectProviderProfile(providerProfile),
    fallbackReason,
    warnings,
  };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const inputIndex = args.indexOf("--input");
  const outputIndex = args.indexOf("--output");
  const modeIndex = args.indexOf("--mode");
  const profileIndex = args.indexOf("--provider-profile");
  const printIndex = args.indexOf("--print");
  return {
    inputPath: inputIndex >= 0 ? args[inputIndex + 1] : "",
    outputPath: outputIndex >= 0 ? args[outputIndex + 1] : "",
    mode: modeIndex >= 0 ? args[modeIndex + 1] : "",
    providerProfile: profileIndex >= 0 ? args[profileIndex + 1] : "",
    printTarget: printIndex >= 0 ? args[printIndex + 1] : "",
    jsonMode: args.includes("--json"),
  };
}

function cli() {
  const options = parseArgs(process.argv);
  if (!options.inputPath) {
    console.error("Usage: node scripts/generate_bb9_handoff.js --input <input.json> [--mode full|lite] [--provider-profile mimo|deepseek] [--output output.json]");
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(path.resolve(options.inputPath), "utf8"));
  const output = generateBb9HandoffFromObject(data, options);
  const printableFields = new Set(["readableBrief", "cacheSidecar", "activeProviderPrompt"]);
  if (options.printTarget && !printableFields.has(options.printTarget)) {
    throw new Error("--print must be readableBrief, cacheSidecar, or activeProviderPrompt");
  }
  const text = options.printTarget
    ? `${output[options.printTarget] || ""}${output[options.printTarget]?.endsWith("\n") ? "" : "\n"}`
    : `${JSON.stringify(output, null, 2)}\n`;
  if (options.outputPath) {
    fs.writeFileSync(path.resolve(options.outputPath), text, "utf8");
  } else {
    process.stdout.write(text);
  }
}

if (require.main === module) {
  cli();
}

module.exports = {
  generateBb9HandoffFromObject,
  getProviderProfile,
  renderReadableBrief,
  renderCacheSidecar,
};
