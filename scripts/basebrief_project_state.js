#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  readRepositoryState,
  resolveRepository,
} = require("./basebrief_receiver_check");

const PROJECT_STATE_SCHEMA_VERSION = "basebrief-project-state-v1";
const PROJECT_STATE_DIR = ".basebrief";
const PROJECT_STATE_FILE = "state.json";
const PROJECT_STATE_HISTORY_DIR = "history";
const STATE_FIELDS = [
  "current_goal",
  "verified_facts",
  "confirmed_decisions",
  "risk_boundaries",
  "receiver_entry_task",
  "open_questions",
];

function normalizeSlash(value) {
  return value.replace(/\\/g, "/");
}

function assertNonSensitivePath(filePath, label) {
  const segments = normalizeSlash(filePath).split("/").filter(Boolean).map((segment) => segment.toLowerCase());
  if (segments.includes(".git")) throw new Error(`${label} must not use a .git path`);
  if (segments.some((segment) => segment === ".env" || segment.startsWith(".env."))) {
    throw new Error(`${label} must not use an .env path`);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractMarkdownSection(content, heading) {
  const pattern = new RegExp(`^#{2,3}\\s+${escapeRegExp(heading)}\\s*$`, "im");
  const match = pattern.exec(content);
  if (!match) return "";
  const start = match.index + match[0].length;
  const rest = content.slice(start);
  const nextHeading = /\n#{2,3}\s+/m.exec(rest);
  const body = nextHeading ? rest.slice(0, nextHeading.index) : rest;
  return body.trim();
}

function resolveSource(sourcePath) {
  if (!sourcePath) throw new Error("Missing --source <receiver-ready.md>");
  const resolved = path.resolve(sourcePath);
  assertNonSensitivePath(resolved, "project-state source");
  if (!fs.existsSync(resolved)) throw new Error(`project-state source does not exist: ${resolved}`);
  if (!fs.statSync(resolved).isFile()) throw new Error("project-state source must be a file");
  if (path.extname(resolved).toLowerCase() !== ".md") {
    throw new Error("project-state source must be a Markdown file");
  }
  return fs.realpathSync(resolved);
}

function statePathForRepo(repoRoot) {
  return path.join(repoRoot, PROJECT_STATE_DIR, PROJECT_STATE_FILE);
}

function historyDirForRepo(repoRoot) {
  return path.join(repoRoot, PROJECT_STATE_DIR, PROJECT_STATE_HISTORY_DIR);
}

function readJsonFile(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON`);
  }
}

function parseReceiverReady(content) {
  if (!/^handoff_status:\s*ready_for_receiver\s*$/m.test(content)) {
    throw new Error("project-state source must have handoff_status: ready_for_receiver");
  }
  const fields = {};
  const missing = [];
  for (const field of STATE_FIELDS) {
    const value = extractMarkdownSection(content, field);
    if (!value) {
      missing.push(field);
    } else {
      fields[field] = value;
    }
  }
  if (missing.length) {
    throw new Error(`project-state source is missing required sections: ${missing.join(", ")}`);
  }
  return fields;
}

function validateProjectStateObject(state) {
  const errors = [];
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return ["project-state must be a JSON object"];
  }
  if (state.schemaVersion !== PROJECT_STATE_SCHEMA_VERSION) {
    errors.push("schemaVersion must be basebrief-project-state-v1");
  }
  if (state.state_status !== "local_project_state") {
    errors.push("state_status must be local_project_state");
  }
  for (const field of ["generated_at", "updated_at"]) {
    if (typeof state[field] !== "string" || !state[field]) {
      errors.push(`${field} must be a non-empty string`);
    }
  }
  if (!state.source || typeof state.source !== "object") {
    errors.push("source must be an object");
  } else {
    if (state.source.kind !== "receiver-ready") errors.push("source.kind must be receiver-ready");
    if (typeof state.source.file !== "string" || !state.source.file) errors.push("source.file must be a non-empty string");
    if (state.source.handoff_status !== "ready_for_receiver") {
      errors.push("source.handoff_status must be ready_for_receiver");
    }
  }
  if (!state.repository || typeof state.repository !== "object") {
    errors.push("repository must be an object");
  } else {
    if (typeof state.repository.branch !== "string") errors.push("repository.branch must be a string");
    if (typeof state.repository.head !== "string") errors.push("repository.head must be a string");
    if (!Array.isArray(state.repository.changed_files)) {
      errors.push("repository.changed_files must be an array");
    } else if (!state.repository.changed_files.every((item) => typeof item === "string")) {
      errors.push("repository.changed_files items must be strings");
    }
  }
  if (!state.handoff || typeof state.handoff !== "object") {
    errors.push("handoff must be an object");
  } else {
    for (const field of STATE_FIELDS) {
      if (typeof state.handoff[field] !== "string" || !state.handoff[field].trim()) {
        errors.push(`handoff.${field} must be a non-empty string`);
      }
    }
  }
  if (!state.review || typeof state.review !== "object") {
    errors.push("review must be an object");
  } else {
    if (state.review.required_before_receiver !== true) errors.push("review.required_before_receiver must be true");
    if (state.review.ready_source_required !== true) errors.push("review.ready_source_required must be true");
  }
  if (!Array.isArray(state.non_goals)) {
    errors.push("non_goals must be an array");
  } else if (!state.non_goals.every((item) => typeof item === "string")) {
    errors.push("non_goals items must be strings");
  }
  return errors;
}

function buildProjectState({ repoRoot, sourcePath, fields, generatedAt }) {
  const repository = readRepositoryState(repoRoot);
  return {
    schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    state_status: "local_project_state",
    generated_at: generatedAt,
    updated_at: generatedAt,
    source: {
      kind: "receiver-ready",
      file: path.basename(sourcePath),
      handoff_status: "ready_for_receiver",
    },
    repository: {
      branch: repository.branch,
      head: repository.head,
      changed_files: repository.changedFiles,
    },
    handoff: fields,
    review: {
      required_before_receiver: true,
      ready_source_required: true,
    },
    non_goals: [
      "no_provider_request",
      "no_auto_flow",
      "no_receiver_thread",
      "no_secret_storage",
    ],
  };
}

function buildAdvancedProjectState({ repoRoot, sourcePath, fields, previousState, updatedAt }) {
  const state = buildProjectState({
    repoRoot,
    sourcePath,
    fields,
    generatedAt: previousState.generated_at || updatedAt,
  });
  state.updated_at = updatedAt;
  return state;
}

function loadStateForValidation(repoRoot) {
  const inputPath = statePathForRepo(repoRoot);
  assertNonSensitivePath(inputPath, "project-state input");
  if (!fs.existsSync(inputPath)) {
    return {
      inputPath,
      exists: false,
      state: null,
      errors: ["project-state does not exist"],
    };
  }
  try {
    const state = readJsonFile(inputPath, "project-state");
    return {
      inputPath,
      exists: true,
      state,
      errors: validateProjectStateObject(state),
    };
  } catch (error) {
    return {
      inputPath,
      exists: true,
      state: null,
      errors: [error.message],
    };
  }
}

function runStateInit(options) {
  if (!options.repoPath) throw new Error("Missing --repo <target-repo>");
  const repoRoot = resolveRepository(options.repoPath);
  const sourcePath = resolveSource(options.sourcePath);
  const outputPath = statePathForRepo(repoRoot);
  assertNonSensitivePath(outputPath, "project-state output");
  if (fs.existsSync(outputPath)) throw new Error(`project-state already exists: ${outputPath}`);
  const fields = parseReceiverReady(fs.readFileSync(sourcePath, "utf8"));
  const generatedAt = new Date().toISOString();
  const state = buildProjectState({ repoRoot, sourcePath, fields, generatedAt });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return {
    command: "state-init",
    schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    repo: repoRoot,
    output: outputPath,
    source: sourcePath,
    state,
  };
}

function runStateRead(options) {
  if (!options.repoPath) throw new Error("Missing --repo <target-repo>");
  const repoRoot = resolveRepository(options.repoPath);
  const inputPath = statePathForRepo(repoRoot);
  assertNonSensitivePath(inputPath, "project-state input");
  if (!fs.existsSync(inputPath)) throw new Error(`project-state does not exist: ${inputPath}`);
  const state = readJsonFile(inputPath, "project-state");
  const errors = validateProjectStateObject(state);
  if (errors.length) throw new Error(`project-state validation failed: ${errors.join("; ")}`);
  return {
    command: "state-read",
    schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    repo: repoRoot,
    input: inputPath,
    state,
  };
}

function runStateStatus(options) {
  if (!options.repoPath) throw new Error("Missing --repo <target-repo>");
  const repoRoot = resolveRepository(options.repoPath);
  const { inputPath, exists, state, errors } = loadStateForValidation(repoRoot);
  return {
    command: "state-status",
    schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    repo: repoRoot,
    input: inputPath,
    exists,
    state_status: exists && state ? state.state_status || "unknown" : "missing",
    validation_status: exists && errors.length === 0 ? "passed" : exists ? "failed" : "missing",
    source: state && state.source ? state.source : null,
    repository: state && state.repository ? state.repository : null,
    generated_at: state ? state.generated_at : null,
    updated_at: state ? state.updated_at : null,
    errors,
  };
}

function runStateValidate(options) {
  if (!options.repoPath) throw new Error("Missing --repo <target-repo>");
  const repoRoot = resolveRepository(options.repoPath);
  const { inputPath, exists, state, errors } = loadStateForValidation(repoRoot);
  return {
    command: "state-validate",
    schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    repo: repoRoot,
    input: inputPath,
    exists,
    validation_status: exists && errors.length === 0 ? "passed" : "failed",
    state_status: state ? state.state_status || "unknown" : "missing",
    errors,
  };
}

function safeHistoryFileName(updatedAt, sourcePath) {
  const stamp = updatedAt.replace(/[:.]/g, "-");
  const sourceStem = path.basename(sourcePath, path.extname(sourcePath)).replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 48) || "receiver-ready";
  return `${stamp}-${sourceStem}.json`;
}

function listHistoryEntries(historyDir) {
  if (!fs.existsSync(historyDir)) return [];
  if (!fs.statSync(historyDir).isDirectory()) throw new Error("project-state history path must be a directory");
  return fs.readdirSync(historyDir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      const filePath = path.join(historyDir, name);
      try {
        const state = readJsonFile(filePath, "project-state history entry");
        const errors = validateProjectStateObject(state);
        return {
          file: name,
          validation_status: errors.length === 0 ? "passed" : "failed",
          generated_at: state.generated_at || null,
          updated_at: state.updated_at || null,
          source: state.source || null,
          errors,
        };
      } catch (error) {
        return {
          file: name,
          validation_status: "failed",
          generated_at: null,
          updated_at: null,
          source: null,
          errors: [error.message],
        };
      }
    });
}

function runStateHistory(options) {
  if (!options.repoPath) throw new Error("Missing --repo <target-repo>");
  const repoRoot = resolveRepository(options.repoPath);
  const historyDir = historyDirForRepo(repoRoot);
  assertNonSensitivePath(historyDir, "project-state history");
  const entries = listHistoryEntries(historyDir);
  return {
    command: "state-history",
    schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    repo: repoRoot,
    input: historyDir,
    history_status: entries.length ? "available" : "not_initialized",
    entries,
  };
}

function runStateAdvance(options) {
  if (!options.repoPath) throw new Error("Missing --repo <target-repo>");
  const repoRoot = resolveRepository(options.repoPath);
  const sourcePath = resolveSource(options.sourcePath);
  const inputPath = statePathForRepo(repoRoot);
  const historyDir = historyDirForRepo(repoRoot);
  assertNonSensitivePath(inputPath, "project-state input");
  assertNonSensitivePath(historyDir, "project-state history");
  if (!fs.existsSync(inputPath)) {
    throw new Error(`project-state does not exist: ${inputPath}; run state-init before state-advance`);
  }
  const previousState = readJsonFile(inputPath, "project-state");
  const previousErrors = validateProjectStateObject(previousState);
  if (previousErrors.length) {
    throw new Error(`project-state validation failed before advance: ${previousErrors.join("; ")}`);
  }
  const fields = parseReceiverReady(fs.readFileSync(sourcePath, "utf8"));
  const updatedAt = new Date().toISOString();
  const nextState = buildAdvancedProjectState({ repoRoot, sourcePath, fields, previousState, updatedAt });
  fs.mkdirSync(historyDir, { recursive: true });
  let historyPath = path.join(historyDir, safeHistoryFileName(updatedAt, sourcePath));
  let suffix = 1;
  while (fs.existsSync(historyPath)) {
    historyPath = path.join(historyDir, safeHistoryFileName(updatedAt, sourcePath).replace(/\.json$/, `-${suffix}.json`));
    suffix += 1;
  }
  fs.writeFileSync(historyPath, `${JSON.stringify(previousState, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  fs.writeFileSync(inputPath, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");
  return {
    command: "state-advance",
    schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    repo: repoRoot,
    input: inputPath,
    output: inputPath,
    source: sourcePath,
    history_output: historyPath,
    previous_updated_at: previousState.updated_at,
    updated_at: nextState.updated_at,
    state: nextState,
  };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const repoIndex = args.indexOf("--repo");
  const sourceIndex = args.indexOf("--source");
  return {
    repoPath: repoIndex >= 0 ? args[repoIndex + 1] : "",
    sourcePath: sourceIndex >= 0 ? args[sourceIndex + 1] : "",
    jsonMode: args.includes("--json"),
  };
}

function formatHuman(result) {
  if (result.command === "state-init") {
    return [
      `BaseBrief project state written to ${result.output}`,
      `schemaVersion=${result.schemaVersion}`,
      `handoff_status=${result.state.source.handoff_status}`,
      "",
    ].join(os.EOL);
  }
  if (result.command === "state-status") {
    return [
      `BaseBrief project state status for ${result.repo}`,
      `exists=${result.exists}`,
      `state_status=${result.state_status}`,
      `validation_status=${result.validation_status}`,
      "",
    ].join(os.EOL);
  }
  if (result.command === "state-validate") {
    return [
      `BaseBrief project state validation ${result.validation_status}`,
      `exists=${result.exists}`,
      `state_status=${result.state_status}`,
      "",
    ].join(os.EOL);
  }
  if (result.command === "state-history") {
    return [
      `BaseBrief project state history ${result.history_status}`,
      `entries=${result.entries.length}`,
      "",
    ].join(os.EOL);
  }
  if (result.command === "state-advance") {
    return [
      `BaseBrief project state advanced at ${result.output}`,
      `schemaVersion=${result.schemaVersion}`,
      `handoff_status=${result.state.source.handoff_status}`,
      `history_output=${result.history_output}`,
      "",
    ].join(os.EOL);
  }
  return [
    `BaseBrief project state read from ${result.input}`,
    `schemaVersion=${result.schemaVersion}`,
    `handoff_status=${result.state.source.handoff_status}`,
    "",
  ].join(os.EOL);
}

function cli() {
  try {
    const command = process.argv[2];
    const options = parseArgs(process.argv);
    let result;
    if (command === "state-read") result = runStateRead(options);
    else if (command === "state-status") result = runStateStatus(options);
    else if (command === "state-validate") result = runStateValidate(options);
    else if (command === "state-history") result = runStateHistory(options);
    else if (command === "state-advance") result = runStateAdvance(options);
    else result = runStateInit(options);
    process.stdout.write(options.jsonMode ? `${JSON.stringify(result, null, 2)}\n` : formatHuman(result));
    if (result.command === "state-validate" && result.validation_status !== "passed") {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) cli();

module.exports = {
  PROJECT_STATE_DIR,
  PROJECT_STATE_FILE,
  PROJECT_STATE_HISTORY_DIR,
  PROJECT_STATE_SCHEMA_VERSION,
  STATE_FIELDS,
  buildProjectState,
  extractMarkdownSection,
  formatHuman,
  historyDirForRepo,
  parseReceiverReady,
  runStateAdvance,
  runStateHistory,
  runStateInit,
  runStateRead,
  runStateStatus,
  runStateValidate,
  statePathForRepo,
  validateProjectStateObject,
};
