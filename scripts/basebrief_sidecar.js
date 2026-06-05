#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");

const { PROJECT_STATE_SCHEMA_VERSION, runStateRead } = require("./basebrief_project_state");

const SIDECAR_SCHEMA_VERSION = "basebrief-sidecar-v1";
const SUPPORTED_TARGETS = new Set(["generic", "openclaw"]);
const OUTPUT_FILES = {
  handoff: "handoff.md",
  nextChatPrompt: "next-chat-prompt.md",
  receiverEntryTask: "receiver-entry-task.md",
  riskBoundaries: "risk-boundaries.md",
  stateSummary: "state-summary.json",
  manifest: "manifest.json",
};

const BASE_RISK_BOUNDARIES = [
  "No provider request.",
  "No raw private output.",
  "No runtime integration.",
  "No schema change.",
  "No auto-advance.",
  "Wait for user confirmation before continuing.",
];

const OPENCLAW_RISK_BOUNDARIES = [
  "Do not connect OpenClaw or Hermes runtime.",
  "Do not write OpenClaw or Hermes profile, config, memory, or workspace files.",
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

function defaultOutputDir(repoRoot, target) {
  return path.join(repoRoot, ".basebrief", "sidecar", target);
}

function resolveOutputDir(repoRoot, target, outputDir) {
  const resolved = outputDir ? path.resolve(outputDir) : defaultOutputDir(repoRoot, target);
  assertNonSensitivePath(resolved, "sidecar output");
  return resolved;
}

function assertWritableOutputDir(outputDir) {
  if (!fs.existsSync(outputDir)) return;
  if (!fs.statSync(outputDir).isDirectory()) {
    throw new Error(`sidecar output exists and is not a directory: ${outputDir}`);
  }
  if (fs.readdirSync(outputDir).length > 0) {
    throw new Error(`sidecar output directory already exists and is not empty: ${outputDir}`);
  }
}

function splitFieldLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);
}

function uniqueLines(lines) {
  const seen = new Set();
  const result = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(line);
  }
  return result;
}

function riskBoundariesForTarget(state, target) {
  return uniqueLines([
    ...splitFieldLines(state.handoff.risk_boundaries),
    ...BASE_RISK_BOUNDARIES,
    ...(target === "openclaw" ? OPENCLAW_RISK_BOUNDARIES : []),
  ]);
}

function targetDescription(target) {
  if (target === "openclaw") {
    return "OpenClaw-safe receiver handoff bundle. This is formatting and safety wording only; it does not connect runtime, provider, profile, config, memory, or workspace systems.";
  }
  return "Generic receiver handoff bundle for a new local agent window.";
}

function stateSummaryFromState(state, target, riskBoundaries) {
  return {
    schemaVersion: SIDECAR_SCHEMA_VERSION,
    projectStateSchemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    target,
    current_goal: state.handoff.current_goal,
    receiver_entry_task: state.handoff.receiver_entry_task,
    risk_boundaries: riskBoundaries,
    open_questions: state.handoff.open_questions,
    source: {
      kind: state.source.kind,
      file: state.source.file,
      handoff_status: state.source.handoff_status,
    },
    repository: {
      branch: state.repository.branch,
      head: state.repository.head,
      changed_files: state.repository.changed_files,
    },
    state_timestamps: {
      generated_at: state.generated_at,
      updated_at: state.updated_at,
    },
  };
}

function renderList(lines) {
  return lines.map((line) => `- ${line}`).join(os.EOL);
}

function renderHandoff(state, target, riskBoundaries) {
  return [
    "# BaseBrief Sidecar Handoff Bundle",
    "",
    `target: ${target}`,
    `schemaVersion: ${SIDECAR_SCHEMA_VERSION}`,
    `projectStateSchemaVersion: ${PROJECT_STATE_SCHEMA_VERSION}`,
    "",
    "## Current Goal",
    state.handoff.current_goal,
    "",
    "## Verified Facts",
    state.handoff.verified_facts,
    "",
    "## Confirmed Decisions",
    state.handoff.confirmed_decisions,
    "",
    "## Receiver Entry Task",
    state.handoff.receiver_entry_task,
    "",
    "## Risk Boundaries",
    renderList(riskBoundaries),
    "",
    "## Open Questions",
    state.handoff.open_questions,
    "",
    "## Sidecar Boundaries",
    "- No provider request.",
    "- No raw private output.",
    "- No runtime integration.",
    "- No schema change.",
    "- No auto-advance.",
    "- Wait for user confirmation before continuing.",
    ...(target === "openclaw" ? ["- OpenClaw/Hermes runtime, profile, config, memory, and workspace writes are out of scope."] : []),
  ].join(os.EOL);
}

function renderNextChatPrompt(state, target, riskBoundaries) {
  return [
    "# BaseBrief Next Chat Prompt",
    "",
    "Open the target repository, then read this sidecar bundle first:",
    "",
    "- `manifest.json`",
    "- `state-summary.json`",
    "- `handoff.md`",
    "- `receiver-entry-task.md`",
    "- `risk-boundaries.md`",
    "",
    "Do not auto-advance. Wait for user confirmation before continuing.",
    "",
    "## Receiver Task",
    "Read the sidecar files, identify BaseBrief and the stored Project State, then report pass/fail.",
    "",
    "Your response must restate:",
    "",
    "- current_goal",
    "- next task / receiver_entry_task",
    "- at least two risk boundaries",
    "- whether the bundle is understandable enough to continue",
    "",
    "## Current Goal",
    state.handoff.current_goal,
    "",
    "## Next Task",
    state.handoff.receiver_entry_task,
    "",
    "## Risk Boundaries",
    renderList(riskBoundaries),
    "",
    "## Hard Stops",
    "- No provider request.",
    "- No raw private output.",
    "- No runtime integration.",
    "- No schema change.",
    "- No auto-advance.",
    "- Wait for user confirmation.",
    ...(target === "openclaw" ? ["- Do not connect OpenClaw/Hermes runtime or write profile/config/memory/workspace files."] : []),
  ].join(os.EOL);
}

function renderReceiverEntryTask(state) {
  return [
    "# Receiver Entry Task",
    "",
    state.handoff.receiver_entry_task,
    "",
    "Report pass/fail after reading the sidecar bundle. If passing, wait for user confirmation before continuing.",
  ].join(os.EOL);
}

function renderRiskBoundaries(riskBoundaries) {
  return [
    "# Risk Boundaries",
    "",
    renderList(riskBoundaries),
    "",
    "No provider request. No raw private output. No runtime integration. No schema change. No auto-advance.",
    "Wait for user confirmation before continuing.",
  ].join(os.EOL);
}

function manifestForBundle({ target, state, outputFiles, generatedAt }) {
  return {
    schemaVersion: SIDECAR_SCHEMA_VERSION,
    target,
    description: targetDescription(target),
    generated_at: generatedAt,
    projectStateSchemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    source: {
      kind: state.source.kind,
      file: state.source.file,
      handoff_status: state.source.handoff_status,
    },
    repository: {
      branch: state.repository.branch,
      head: state.repository.head,
      changed_files: state.repository.changed_files,
    },
    output_files: outputFiles,
    boundaries: [
      "No provider request.",
      "No raw private output.",
      "No runtime integration.",
      "No schema change.",
      "No auto-advance.",
      "Wait for user confirmation.",
    ],
  };
}

function writeText(filePath, content) {
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`, { encoding: "utf8", flag: "wx" });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}

function buildSidecarBundle(options) {
  if (!options.repoPath) throw new Error("Missing --repo <target-repo>");
  const target = options.target || "generic";
  if (!SUPPORTED_TARGETS.has(target)) {
    throw new Error(`Unsupported sidecar target: ${target}`);
  }

  const stateResult = runStateRead({ repoPath: options.repoPath });
  const repoRoot = stateResult.repo;
  const outputDir = resolveOutputDir(repoRoot, target, options.outputDir);
  assertWritableOutputDir(outputDir);

  const state = stateResult.state;
  const riskBoundaries = riskBoundariesForTarget(state, target);
  if (!state.handoff.current_goal.trim()) throw new Error("sidecar current_goal must be non-empty");
  if (!state.handoff.receiver_entry_task.trim()) throw new Error("sidecar receiver_entry_task must be non-empty");
  if (riskBoundaries.length < 2) throw new Error("sidecar risk boundaries must contain at least two items");

  const generatedAt = new Date().toISOString();
  const outputFiles = { ...OUTPUT_FILES };
  const stateSummary = stateSummaryFromState(state, target, riskBoundaries);
  const manifest = manifestForBundle({ target, state, outputFiles, generatedAt });

  fs.mkdirSync(outputDir, { recursive: true });
  writeText(path.join(outputDir, OUTPUT_FILES.handoff), renderHandoff(state, target, riskBoundaries));
  writeText(path.join(outputDir, OUTPUT_FILES.nextChatPrompt), renderNextChatPrompt(state, target, riskBoundaries));
  writeText(path.join(outputDir, OUTPUT_FILES.receiverEntryTask), renderReceiverEntryTask(state));
  writeText(path.join(outputDir, OUTPUT_FILES.riskBoundaries), renderRiskBoundaries(riskBoundaries));
  writeJson(path.join(outputDir, OUTPUT_FILES.stateSummary), stateSummary);
  writeJson(path.join(outputDir, OUTPUT_FILES.manifest), manifest);

  return {
    command: "sidecar-build",
    schemaVersion: SIDECAR_SCHEMA_VERSION,
    projectStateSchemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    target,
    repo: repoRoot,
    input: stateResult.input,
    outputDir,
    outputFiles: Object.fromEntries(Object.entries(outputFiles).map(([key, fileName]) => [key, path.join(outputDir, fileName)])),
    manifest,
  };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const repoIndex = args.indexOf("--repo");
  const targetIndex = args.indexOf("--target");
  const outputDirIndex = args.indexOf("--output-dir");
  return {
    repoPath: repoIndex >= 0 ? args[repoIndex + 1] : "",
    target: targetIndex >= 0 ? args[targetIndex + 1] : "",
    outputDir: outputDirIndex >= 0 ? args[outputDirIndex + 1] : "",
    jsonMode: args.includes("--json"),
  };
}

function formatHuman(result) {
  return [
    `BaseBrief sidecar bundle written to ${result.outputDir}`,
    `schemaVersion=${result.schemaVersion}`,
    `target=${result.target}`,
    `projectStateSchemaVersion=${result.projectStateSchemaVersion}`,
    "",
  ].join(os.EOL);
}

function cli() {
  try {
    const options = parseArgs(process.argv);
    const result = buildSidecarBundle(options);
    process.stdout.write(options.jsonMode ? `${JSON.stringify(result, null, 2)}\n` : formatHuman(result));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) cli();

module.exports = {
  SIDECAR_SCHEMA_VERSION,
  SUPPORTED_TARGETS,
  buildSidecarBundle,
  formatHuman,
  riskBoundariesForTarget,
};
