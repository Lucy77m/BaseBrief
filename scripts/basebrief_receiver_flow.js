#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  readRepositoryState,
  resolveRepository,
  validateRepositoryRelativePath,
} = require("./basebrief_receiver_check");
const {
  buildReceiverCheckConfig,
  isIgnored,
  isTracked,
} = require("./basebrief_receiver_init");

const FLOW_SCHEMA_VERSION = "basebrief-receiver-flow-draft-v1";
const FLOW_OUTPUT_FILES = ["flow-summary.json", "receiver-check.json", "draft-context.md"];

function normalizeSlash(value) {
  return value.replace(/\\/g, "/");
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertNonSensitiveOutputDir(outputDir) {
  const segments = normalizeSlash(outputDir).split("/").filter(Boolean).map((segment) => segment.toLowerCase());
  if (segments.includes(".git")) throw new Error("Receiver flow output must not be written inside .git");
  if (segments.some((segment) => segment === ".env" || segment.startsWith(".env."))) {
    throw new Error("Receiver flow output must not be written inside an .env path");
  }
}

function resolveOutputDir(repoRoot, outputDir) {
  if (!outputDir) throw new Error("Missing --output-dir <dir>");
  const resolved = path.resolve(outputDir);
  assertNonSensitiveOutputDir(resolved);

  let existingParent = resolved;
  const pendingSegments = [];
  while (!fs.existsSync(existingParent)) {
    pendingSegments.unshift(path.basename(existingParent));
    const next = path.dirname(existingParent);
    if (next === existingParent) throw new Error("Unable to resolve receiver flow output directory");
    existingParent = next;
  }
  const realOutputDir = path.join(fs.realpathSync(existingParent), ...pendingSegments);
  assertNonSensitiveOutputDir(realOutputDir);

  const outputFiles = Object.fromEntries(
    FLOW_OUTPUT_FILES.map((fileName) => [fileName, path.join(realOutputDir, fileName)]),
  );
  for (const filePath of Object.values(outputFiles)) {
    if (fs.existsSync(filePath)) throw new Error(`Receiver flow output already exists: ${filePath}`);
  }

  if (!isInside(repoRoot, realOutputDir)) {
    return {
      outputDir: realOutputDir,
      outputFiles,
      outputInsideRepo: false,
      outputRepoRelative: "not_applicable",
      gitVisibleFiles: [],
    };
  }

  const outputRepoRelative = validateRepositoryRelativePath(
    normalizeSlash(path.relative(repoRoot, realOutputDir)),
    "receiver flow output",
  );
  const gitVisibleFiles = [];
  for (const fileName of FLOW_OUTPUT_FILES) {
    const repoRelativeFile = normalizeSlash(path.join(outputRepoRelative, fileName));
    if (isTracked(repoRoot, repoRelativeFile)) {
      throw new Error("Receiver flow must not write a tracked target-repository file");
    }
    if (!isIgnored(repoRoot, repoRelativeFile)) {
      gitVisibleFiles.push(repoRelativeFile);
    }
  }

  return {
    outputDir: realOutputDir,
    outputFiles,
    outputInsideRepo: true,
    outputRepoRelative,
    gitVisibleFiles: gitVisibleFiles.sort(),
  };
}

function buildDraftContext({ generatedAt, state, receiverConfigPath, receiverConfig }) {
  const changedFiles = state.changedFiles.length
    ? state.changedFiles.map((filePath) => `- ${filePath}`).join(os.EOL)
    : "- none";
  const expectedFiles = receiverConfig.expected_changed_files.length
    ? receiverConfig.expected_changed_files.map((filePath) => `- ${filePath}`).join(os.EOL)
    : "- none";
  return [
    "# BaseBrief Receiver Flow Draft",
    "",
    "handoff_status: draft_needs_review",
    `generated_at: ${generatedAt}`,
    "review_required: true",
    "",
    "This draft is not receiver-ready. Review before sharing.",
    "",
    "## Repository State",
    "",
    `expected_branch: ${state.branch}`,
    `expected_head: ${state.head}`,
    "",
    "## current_changed_files",
    "",
    changedFiles,
    "",
    "## expected_changed_files",
    "",
    expectedFiles,
    "",
    "## receiver_check_config",
    "",
    receiverConfigPath,
    "",
    "## receiver_entry_task_draft",
    "",
    "- Confirm the current working directory and target repository relationship.",
    "- Recheck branch, HEAD, and changed files before implementation work.",
    "- Run `receiver-check` only after this draft and config are reviewed.",
    "- Report `receiver_task_status`, `repository_state_status`, `declared_checks_status`, and `handoff_acceptance`.",
    "",
    "## Non-Goals",
    "",
    "- No provider request.",
    "- No receiver thread creation.",
    "- No final handoff generation.",
    "- No automatic promotion to `ready_for_receiver`.",
    "",
  ].join(os.EOL);
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}

function runReceiverFlow(options) {
  if (!options.repoPath) throw new Error("Missing --repo <target-repo>");
  const repoRoot = resolveRepository(options.repoPath);
  const before = readRepositoryState(repoRoot);
  const output = resolveOutputDir(repoRoot, options.outputDir);
  const receiverConfig = buildReceiverCheckConfig(before, output.gitVisibleFiles[0] ? output.gitVisibleFiles : "");
  const generatedAt = new Date().toISOString();
  const outputFilesPublic = {
    flowSummary: output.outputFiles["flow-summary.json"],
    receiverCheckConfig: output.outputFiles["receiver-check.json"],
    draftContext: output.outputFiles["draft-context.md"],
  };
  const receiverConfigPath = output.outputInsideRepo
    ? normalizeSlash(path.join(output.outputRepoRelative, "receiver-check.json"))
    : "receiver-check.json";
  const summary = {
    schemaVersion: FLOW_SCHEMA_VERSION,
    command: "receiver-flow",
    handoff_status: "draft_needs_review",
    generated_at: generatedAt,
    review_required: true,
    repository: {
      branch: before.branch,
      head: before.head,
    },
    changed_files: {
      actual: before.changedFiles,
    },
    receiver_check_config: receiverConfigPath,
    output_files: {
      flowSummary: "flow-summary.json",
      receiverCheckConfig: "receiver-check.json",
      draftContext: "draft-context.md",
    },
    non_goals: [
      "no_provider_request",
      "no_receiver_thread",
      "no_final_handoff",
      "no_auto_ready_for_receiver",
    ],
  };

  fs.mkdirSync(output.outputDir, { recursive: true });
  try {
    writeJson(outputFilesPublic.flowSummary, summary);
    writeJson(outputFilesPublic.receiverCheckConfig, receiverConfig);
    fs.writeFileSync(
      outputFilesPublic.draftContext,
      buildDraftContext({ generatedAt, state: before, receiverConfigPath, receiverConfig }),
      { encoding: "utf8", flag: "wx" },
    );
  } catch (error) {
    for (const filePath of Object.values(outputFilesPublic)) {
      fs.rmSync(filePath, { force: true });
    }
    throw error;
  }

  const after = readRepositoryState(repoRoot);
  const expectedAfter = {
    ...before,
    changedFiles: [...new Set([...before.changedFiles, ...output.gitVisibleFiles])].sort(),
  };
  if (JSON.stringify(after) !== JSON.stringify(expectedAfter)) {
    for (const filePath of Object.values(outputFilesPublic)) {
      fs.rmSync(filePath, { force: true });
    }
    throw new Error("Target repository changed unexpectedly while receiver flow draft was generated");
  }

  return {
    command: "receiver-flow",
    schemaVersion: FLOW_SCHEMA_VERSION,
    handoff_status: "draft_needs_review",
    outputDir: output.outputDir,
    outputFiles: outputFilesPublic,
    output_inside_repo: output.outputInsideRepo,
    output_repo_relative: output.outputRepoRelative,
    output_git_visible_files: output.gitVisibleFiles,
    summary,
    receiver_check_config: receiverConfig,
  };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const repoIndex = args.indexOf("--repo");
  const outputDirIndex = args.indexOf("--output-dir");
  return {
    repoPath: repoIndex >= 0 ? args[repoIndex + 1] : "",
    outputDir: outputDirIndex >= 0 ? args[outputDirIndex + 1] : "",
    jsonMode: args.includes("--json"),
  };
}

function formatHuman(result) {
  return [
    `BaseBrief receiver flow draft written to ${result.outputDir}`,
    `handoff_status=${result.handoff_status}`,
    `expected_changed_files=${result.receiver_check_config.expected_changed_files.length}`,
    "review_required=true",
    "",
  ].join(os.EOL);
}

function cli() {
  try {
    const options = parseArgs(process.argv);
    const result = runReceiverFlow(options);
    process.stdout.write(options.jsonMode ? `${JSON.stringify(result, null, 2)}\n` : formatHuman(result));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) cli();

module.exports = {
  FLOW_OUTPUT_FILES,
  FLOW_SCHEMA_VERSION,
  buildDraftContext,
  formatHuman,
  parseArgs,
  resolveOutputDir,
  runReceiverFlow,
};
