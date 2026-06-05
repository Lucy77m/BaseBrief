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
  const state = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  if (state.schemaVersion !== PROJECT_STATE_SCHEMA_VERSION) {
    throw new Error("project-state schemaVersion is not supported");
  }
  return {
    command: "state-read",
    schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    repo: repoRoot,
    input: inputPath,
    state,
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
    const result = command === "state-read" ? runStateRead(options) : runStateInit(options);
    process.stdout.write(options.jsonMode ? `${JSON.stringify(result, null, 2)}\n` : formatHuman(result));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) cli();

module.exports = {
  PROJECT_STATE_DIR,
  PROJECT_STATE_FILE,
  PROJECT_STATE_SCHEMA_VERSION,
  STATE_FIELDS,
  buildProjectState,
  extractMarkdownSection,
  formatHuman,
  parseReceiverReady,
  runStateInit,
  runStateRead,
  statePathForRepo,
};
