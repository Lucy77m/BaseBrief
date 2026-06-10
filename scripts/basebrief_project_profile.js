#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const PROJECT_PROFILE_CONTRACT_VERSION = "basebrief-project-profile-v1";

const RECIPE_DEFAULTS = {
  "continuation-default": {
    max_files: 12,
    review_note: "Use this for normal next-window continuation packages.",
  },
  "small-delta": {
    max_files: 8,
    review_note: "Use this when the next receiver only needs the recent repo delta.",
  },
  "review-heavy": {
    max_files: 20,
    review_note: "Use this when the receiver should inspect a wider public-safe file surface.",
  },
};

const SENSITIVE_KEY_PATTERN = /(token|secret|credential|password|api[_-]?key|oauth|bearer|env)/i;
const PRIVATE_PATH_PATTERN = /(^|[^A-Za-z])[A-Za-z]:[\\/]|\\\\|\/home\/|\/Users\//;
const SECRET_VALUE_PATTERN = /\b(?:sk|gho|ghp|github_pat|xoxb|AIza)[A-Za-z0-9_\-]{8,}|\bBearer\s+[A-Za-z0-9._\-]+/i;

function normalizeSlash(value) {
  return String(value).replace(/\\/g, "/");
}

function assertNonSensitivePath(value, label) {
  const normalized = normalizeSlash(value);
  const segments = normalized.split("/").filter(Boolean).map((segment) => segment.toLowerCase());
  if (segments.includes(".git")) throw new Error(`${label} must not use a .git path`);
  if (segments.some((segment) => segment === ".env" || segment.startsWith(".env."))) {
    throw new Error(`${label} must not use an .env path`);
  }
}

function assertNoSensitiveKey(keyPath) {
  if (SENSITIVE_KEY_PATTERN.test(keyPath)) {
    throw new Error(`profile contains unsupported sensitive field: ${keyPath}`);
  }
}

function assertNoSensitiveValue(value, keyPath) {
  if (typeof value !== "string") return;
  if (PRIVATE_PATH_PATTERN.test(value)) {
    throw new Error(`profile field must not contain private absolute paths: ${keyPath}`);
  }
  if (SECRET_VALUE_PATTERN.test(value)) {
    throw new Error(`profile field must not contain secret-like values: ${keyPath}`);
  }
}

function scanPublicSafe(value, keyPath = "profile") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanPublicSafe(item, `${keyPath}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      const nestedPath = `${keyPath}.${key}`;
      assertNoSensitiveKey(nestedPath);
      scanPublicSafe(nested, nestedPath);
    }
    return;
  }
  assertNoSensitiveValue(value, keyPath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

function writeJson(filePath, data) {
  writeText(filePath, JSON.stringify(data, null, 2));
}

function safeRelativeRepoHint(repoPath, outputPath) {
  const outputDir = path.dirname(path.resolve(outputPath));
  const relative = normalizeSlash(path.relative(outputDir, path.resolve(repoPath)));
  if (!relative || relative === ".") return ".";
  if (PRIVATE_PATH_PATTERN.test(relative)) {
    return path.basename(path.resolve(repoPath));
  }
  return relative;
}

function profileTemplate({ repoPath, outputPath, recipe = "continuation-default" }) {
  if (!RECIPE_DEFAULTS[recipe]) {
    throw new Error(`Unsupported recipe: ${recipe}`);
  }
  const recipeDefaults = RECIPE_DEFAULTS[recipe];
  return {
    schemaVersion: PROJECT_PROFILE_CONTRACT_VERSION,
    recipe,
    repo_hint: safeRelativeRepoHint(repoPath, outputPath),
    defaults: {
      since: "",
      max_files: recipeDefaults.max_files,
    },
    starter_language: "auto",
    risk_boundaries: [
      "No provider request.",
      "No raw private output.",
      "No runtime integration.",
      "No automatic git, release, pull request, or project-task execution.",
    ],
    review_notes: [
      recipeDefaults.review_note,
      "Review the generated continuation package before copying NEXT_WINDOW_STARTER.md.",
    ],
    non_goals: [
      "No Workflow Runner.",
      "No MCP server or MCP tools.",
      "No plugin.",
      "No schema-v2.",
      "No global config or credential storage.",
    ],
  };
}

function validateDefaults(defaults) {
  if (!defaults || typeof defaults !== "object" || Array.isArray(defaults)) {
    throw new Error("profile.defaults must be an object");
  }
  if ("since" in defaults && typeof defaults.since !== "string") {
    throw new Error("profile.defaults.since must be a string");
  }
  if ("max_files" in defaults) {
    const value = Number(defaults.max_files);
    if (!Number.isInteger(value) || value < 1 || value > 200) {
      throw new Error("profile.defaults.max_files must be an integer from 1 to 200");
    }
  }
}

function validateProjectProfile(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    throw new Error("profile must be a JSON object");
  }
  scanPublicSafe(profile);
  if (profile.schemaVersion !== PROJECT_PROFILE_CONTRACT_VERSION) {
    throw new Error(`profile.schemaVersion must be ${PROJECT_PROFILE_CONTRACT_VERSION}`);
  }
  if (!RECIPE_DEFAULTS[profile.recipe]) {
    throw new Error(`Unsupported recipe: ${profile.recipe}`);
  }
  if (!profile.repo_hint || typeof profile.repo_hint !== "string") {
    throw new Error("profile.repo_hint must be a string");
  }
  assertNonSensitivePath(profile.repo_hint, "profile repo_hint");
  validateDefaults(profile.defaults);
  if (!["auto", "zh-CN", "en", "ja"].includes(profile.starter_language)) {
    throw new Error("profile.starter_language must be auto, zh-CN, en, or ja");
  }
  for (const key of ["risk_boundaries", "review_notes", "non_goals"]) {
    if (!Array.isArray(profile[key]) || profile[key].length < 1) {
      throw new Error(`profile.${key} must be a non-empty array`);
    }
    profile[key].forEach((item) => {
      if (typeof item !== "string" || !item.trim()) {
        throw new Error(`profile.${key} must contain non-empty strings`);
      }
    });
  }
  return profile;
}

function loadProjectProfile(profilePath) {
  if (!profilePath) throw new Error("Missing --profile <profile.json>");
  assertNonSensitivePath(profilePath, "profile input");
  const resolved = path.resolve(profilePath);
  const profile = validateProjectProfile(readJson(resolved));
  return {
    path: resolved,
    profile,
  };
}

function resolveProfileRepo(profilePath, profile) {
  const repoHint = profile.repo_hint;
  if (path.isAbsolute(repoHint)) {
    throw new Error("profile.repo_hint must not be an absolute path");
  }
  return path.resolve(path.dirname(profilePath), repoHint);
}

function runProfileInit(options) {
  if (!options.repo) throw new Error("Missing --repo <target-repo>");
  if (!options.output) throw new Error("Missing --output <profile.json>");
  const output = path.resolve(options.output);
  assertNonSensitivePath(output, "profile output");
  if (fs.existsSync(output)) {
    throw new Error(`profile output already exists: ${output}`);
  }
  const profile = validateProjectProfile(profileTemplate({
    repoPath: options.repo,
    outputPath: output,
    recipe: options.recipe || "continuation-default",
  }));
  writeJson(output, profile);
  return {
    command: "profile-init",
    contractVersion: PROJECT_PROFILE_CONTRACT_VERSION,
    output,
    profile,
  };
}

function optionsFromProfile(profilePath, profile, overrides = {}) {
  const merged = {
    repo: overrides.repo || resolveProfileRepo(profilePath, profile),
    since: overrides.since || profile.defaults.since || "",
    "max-files": overrides["max-files"] || String(profile.defaults.max_files || ""),
    recipe: profile.recipe,
    profile: profilePath,
  };
  return merged;
}

module.exports = {
  PROJECT_PROFILE_CONTRACT_VERSION,
  RECIPE_DEFAULTS,
  loadProjectProfile,
  optionsFromProfile,
  profileTemplate,
  runProfileInit,
  validateProjectProfile,
};
