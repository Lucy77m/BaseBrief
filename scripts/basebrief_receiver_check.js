#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const { checkArtifacts } = require("./basebrief_check_artifacts");
const receiverCheckSchema = require("../schemas/basebrief-receiver-check.schema.json");

const CONFIG_SCHEMA_VERSION = "basebrief-receiver-check-v1";
const RESULT_SCHEMA_VERSION = "basebrief-receiver-check-result-v1";
const CHECK_KINDS = new Set(["node_syntax", "artifact_check", "file_tokens"]);
const NODE_SYNTAX_EXTENSIONS = new Set([".cjs", ".js", ".mjs"]);
const ARTIFACT_CHECK_EXTENSIONS = new Set([".json", ".md", ".txt"]);

function normalizeSlash(value) {
  return value.replace(/\\/g, "/");
}

function run(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: false,
    env: process.env,
  });
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid receiver check JSON: ${error.message}`);
  }
}

function resolveSafeConfigPath(configPath) {
  const resolved = fs.realpathSync(path.resolve(configPath));
  const segments = pathSegments(resolved).map((segment) => segment.toLowerCase());
  const basename = path.basename(resolved).toLowerCase();
  if (segments.includes(".git")) throw new Error("Receiver check config must not be read from .git");
  if (basename === ".env" || basename.startsWith(".env.")) {
    throw new Error("Receiver check config must not be read from .env files");
  }
  return resolved;
}

function validateString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function pathSegments(relativePath) {
  return normalizeSlash(relativePath).split("/").filter(Boolean);
}

function validateRepositoryRelativePath(relativePath, label) {
  validateString(relativePath, label);
  if (path.isAbsolute(relativePath) || /^[A-Za-z]:[\\/]/.test(relativePath)) {
    throw new Error(`${label} must be repository-relative`);
  }
  const normalized = normalizeSlash(path.normalize(relativePath));
  if (normalized === ".." || normalized.startsWith("../") || pathSegments(normalized).includes("..")) {
    throw new Error(`${label} must not escape the repository`);
  }
  const segments = pathSegments(normalized);
  if (!segments.length || normalized === ".") {
    throw new Error(`${label} must identify a path inside the repository`);
  }
  const lowerSegments = segments.map((segment) => segment.toLowerCase());
  if (lowerSegments.includes(".git")) {
    throw new Error(`${label} must not access .git`);
  }
  if (lowerSegments.some((segment) => segment === ".env" || segment.startsWith(".env."))) {
    throw new Error(`${label} must not access .env files`);
  }
  return normalized;
}

function validateUniqueSortedStrings(values, label, pathValues = false) {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array`);
  const normalized = values.map((value, index) => (
    pathValues
      ? validateRepositoryRelativePath(value, `${label}[${index}]`)
      : (validateString(value, `${label}[${index}]`), value)
  ));
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${label} must contain unique values`);
  }
  const sorted = [...normalized].sort();
  if (JSON.stringify(sorted) !== JSON.stringify(normalized)) {
    throw new Error(`${label} must use stable sorted order`);
  }
  return normalized;
}

function validateReceiverCheckConfig(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Receiver check config must be an object");
  }
  const allowed = new Set(Object.keys(receiverCheckSchema.properties));
  for (const key of receiverCheckSchema.required) {
    if (!(key in input)) throw new Error(`Missing required key: ${key}`);
  }
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new Error(`Unexpected key: ${key}`);
  }
  if (input.schemaVersion !== CONFIG_SCHEMA_VERSION) {
    throw new Error(`schemaVersion must be ${CONFIG_SCHEMA_VERSION}`);
  }
  validateString(input.expected_branch, "expected_branch");
  validateString(input.expected_head, "expected_head");
  validateUniqueSortedStrings(input.expected_changed_files, "expected_changed_files", true);

  if ("declared_checks" in input && !Array.isArray(input.declared_checks)) {
    throw new Error("declared_checks must be an array");
  }
  const checks = input.declared_checks || [];
  const ids = [];
  for (const [index, check] of checks.entries()) {
    if (!check || typeof check !== "object" || Array.isArray(check)) {
      throw new Error(`declared_checks[${index}] must be an object`);
    }
    const allowedKeys = new Set(check.kind === "file_tokens" ? ["id", "kind", "path", "tokens"] : ["id", "kind", "path"]);
    for (const key of Object.keys(check)) {
      if (!allowedKeys.has(key)) throw new Error(`Unexpected declared_checks[${index}] key: ${key}`);
    }
    validateString(check.id, `declared_checks[${index}].id`);
    if (!CHECK_KINDS.has(check.kind)) throw new Error(`Unsupported declared check kind: ${check.kind}`);
    validateRepositoryRelativePath(check.path, `declared_checks[${index}].path`);
    ids.push(check.id);
    if (check.kind === "file_tokens") {
      if (!Array.isArray(check.tokens) || check.tokens.length === 0) {
        throw new Error(`declared_checks[${index}].tokens must be a non-empty array`);
      }
      validateUniqueSortedStrings(check.tokens, `declared_checks[${index}].tokens`);
    } else if ("tokens" in check) {
      throw new Error(`declared_checks[${index}].tokens is only valid for file_tokens`);
    }
  }
  if (new Set(ids).size !== ids.length) throw new Error("declared_checks ids must be unique");
}

function git(repoRoot, args, encoding = "utf8") {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding,
    shell: false,
    env: process.env,
  });
  if (result.status !== 0) {
    const stderr = encoding === "buffer" && result.stderr
      ? result.stderr.toString("utf8")
      : result.stderr || "";
    throw new Error(result.error ? result.error.message : stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout;
}

function resolveRepository(repoPath) {
  const resolved = fs.realpathSync(path.resolve(repoPath));
  const root = git(resolved, ["rev-parse", "--show-toplevel"]).trim();
  const realRoot = fs.realpathSync(root);
  if (path.normalize(realRoot) !== path.normalize(resolved)) {
    throw new Error("--repo must point to the target repository root");
  }
  return realRoot;
}

function assertSafeExistingPath(repoRoot, relativePath) {
  const normalized = validateRepositoryRelativePath(relativePath, "check path");
  const resolved = path.resolve(repoRoot, normalized);
  const relative = path.relative(repoRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Check path escapes target repository: ${relativePath}`);
  }
  if (!fs.existsSync(resolved)) throw new Error(`Check path does not exist: ${relativePath}`);
  const real = fs.realpathSync(resolved);
  const realRelative = path.relative(repoRoot, real);
  if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
    throw new Error(`Check path resolves outside target repository: ${relativePath}`);
  }
  validateRepositoryRelativePath(realRelative, "resolved check path");
  return real;
}

function parsePorcelainZ(buffer) {
  const entries = buffer.toString("utf8").split("\0");
  const files = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry) continue;
    if (entry.length < 4 || entry[2] !== " ") {
      throw new Error("Unexpected git porcelain entry");
    }
    const status = entry.slice(0, 2);
    files.push(normalizeSlash(entry.slice(3)));
    if (status.includes("R") || status.includes("C")) index += 1;
  }
  return [...new Set(files)].sort();
}

function readRepositoryState(repoRoot) {
  return {
    branch: git(repoRoot, ["branch", "--show-current"]).trim() || "(detached)",
    head: git(repoRoot, ["rev-parse", "HEAD"]).trim(),
    changedFiles: parsePorcelainZ(git(repoRoot, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], "buffer")),
  };
}

function compareLists(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  return {
    missing: expected.filter((item) => !actualSet.has(item)),
    unexpected: actual.filter((item) => !expectedSet.has(item)),
  };
}

function runDeclaredCheck(check, repoRoot) {
  const resolved = assertSafeExistingPath(repoRoot, check.path);
  if (check.kind === "node_syntax") {
    if (!fs.statSync(resolved).isFile()) throw new Error(`node_syntax path must be a file: ${check.path}`);
    if (!NODE_SYNTAX_EXTENSIONS.has(path.extname(resolved).toLowerCase())) {
      throw new Error(`node_syntax path must use .js, .cjs, or .mjs: ${check.path}`);
    }
    const result = run(process.execPath, ["--check", resolved], repoRoot);
    if (result.error || typeof result.status !== "number") {
      throw new Error(`node_syntax could not execute: ${check.path}`);
    }
    return {
      id: check.id,
      kind: check.kind,
      path: normalizeSlash(check.path),
      status: result.status === 0 ? "passed" : "difference_found",
      detail: result.status === 0 ? "syntax accepted" : "syntax check reported a difference",
    };
  }
  if (check.kind === "artifact_check") {
    if (!fs.statSync(resolved).isFile()) throw new Error(`artifact_check path must be a file: ${check.path}`);
    if (!ARTIFACT_CHECK_EXTENSIONS.has(path.extname(resolved).toLowerCase())) {
      throw new Error(`artifact_check path must use .md, .json, or .txt: ${check.path}`);
    }
    const result = checkArtifacts({ inputPath: resolved });
    return {
      id: check.id,
      kind: check.kind,
      path: normalizeSlash(check.path),
      status: result.errorCount === 0 && result.warningCount === 0 ? "passed" : "difference_found",
      detail: `status=${result.status}, errors=${result.errorCount}, warnings=${result.warningCount}`,
    };
  }
  if (check.kind === "file_tokens") {
    if (!fs.statSync(resolved).isFile()) throw new Error(`file_tokens path must be a file: ${check.path}`);
    const content = fs.readFileSync(resolved, "utf8");
    const missing = check.tokens.filter((token) => !content.includes(token));
    return {
      id: check.id,
      kind: check.kind,
      path: normalizeSlash(check.path),
      status: missing.length === 0 ? "passed" : "difference_found",
      detail: missing.length === 0 ? "all declared tokens present" : `missing_token_count=${missing.length}`,
    };
  }
  throw new Error(`Unsupported declared check kind: ${check.kind}`);
}

function blockedResult(reason) {
  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    receiver_task_status: "blocked",
    repository_state_status: "not_applicable",
    declared_checks_status: "blocked",
    handoff_acceptance: "blocked",
    repository: { branch: "", head: "" },
    changed_files: { expected: [], actual: [], missing: [], unexpected: [] },
    declared_checks: [],
    blocked_reason: reason,
  };
}

function runReceiverCheck(options) {
  try {
    if (!options.configPath) throw new Error("Missing --config <json>");
    if (!options.repoPath) throw new Error("Missing --repo <target-repo>");
    const config = readJsonFile(resolveSafeConfigPath(options.configPath));
    validateReceiverCheckConfig(config);
    const repoRoot = resolveRepository(options.repoPath);
    const before = readRepositoryState(repoRoot);
    const expectedFiles = config.expected_changed_files.map(normalizeSlash);
    const fileDiff = compareLists(expectedFiles, before.changedFiles);
    const stateMatches =
      before.branch === config.expected_branch &&
      before.head === config.expected_head &&
      fileDiff.missing.length === 0 &&
      fileDiff.unexpected.length === 0;

    const checks = (config.declared_checks || []).map((check) => runDeclaredCheck(check, repoRoot));
    const after = readRepositoryState(repoRoot);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      return blockedResult("Receiver Safe Check changed the target repository state");
    }

    const declaredStatus = checks.length === 0
      ? "skipped"
      : checks.every((check) => check.status === "passed") ? "passed" : "difference_found";
    const acceptance = stateMatches && declaredStatus !== "difference_found" ? "pass" : "difference_found";
    return {
      schemaVersion: RESULT_SCHEMA_VERSION,
      receiver_task_status: "completed",
      repository_state_status: stateMatches ? "match" : "difference_found",
      declared_checks_status: declaredStatus,
      handoff_acceptance: acceptance,
      repository: {
        branch: before.branch,
        head: before.head,
      },
      changed_files: {
        expected: expectedFiles,
        actual: before.changedFiles,
        missing: fileDiff.missing,
        unexpected: fileDiff.unexpected,
      },
      declared_checks: checks,
      blocked_reason: "",
    };
  } catch (error) {
    return blockedResult(error.message);
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const configIndex = args.indexOf("--config");
  const repoIndex = args.indexOf("--repo");
  return {
    configPath: configIndex >= 0 ? args[configIndex + 1] : "",
    repoPath: repoIndex >= 0 ? args[repoIndex + 1] : "",
    jsonMode: args.includes("--json"),
  };
}

function formatHuman(result) {
  const lines = [
    `BaseBrief receiver check ${result.handoff_acceptance}.`,
    `receiver_task_status=${result.receiver_task_status}`,
    `repository_state_status=${result.repository_state_status}`,
    `declared_checks_status=${result.declared_checks_status}`,
    `handoff_acceptance=${result.handoff_acceptance}`,
  ];
  if (result.blocked_reason) lines.push(`blocked_reason=${result.blocked_reason}`);
  return `${lines.join(os.EOL)}${os.EOL}`;
}

function cli() {
  const result = runReceiverCheck(parseArgs(process.argv));
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(formatHuman(result));
  }
  if (result.handoff_acceptance === "blocked") process.exitCode = 1;
}

if (require.main === module) cli();

module.exports = {
  CHECK_KINDS,
  CONFIG_SCHEMA_VERSION,
  RESULT_SCHEMA_VERSION,
  blockedResult,
  formatHuman,
  parsePorcelainZ,
  readRepositoryState,
  resolveRepository,
  runReceiverCheck,
  validateReceiverCheckConfig,
  validateRepositoryRelativePath,
};
