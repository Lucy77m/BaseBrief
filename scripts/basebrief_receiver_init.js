#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const {
  CONFIG_SCHEMA_VERSION,
  readRepositoryState,
  resolveRepository,
  validateReceiverCheckConfig,
  validateRepositoryRelativePath,
} = require("./basebrief_receiver_check");

function normalizeSlash(value) {
  return value.replace(/\\/g, "/");
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertNonSensitiveOutputPath(outputPath) {
  const segments = normalizeSlash(outputPath).split("/").filter(Boolean).map((segment) => segment.toLowerCase());
  const basename = path.basename(outputPath).toLowerCase();
  if (segments.includes(".git")) throw new Error("Receiver init output must not be written inside .git");
  if (segments.some((segment) => segment === ".env" || segment.startsWith(".env."))) {
    throw new Error("Receiver init output must not be written inside an .env path");
  }
  if (path.extname(basename) !== ".json") throw new Error("Receiver init output must use a .json extension");
}

function gitStatus(repoRoot, args) {
  return spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
    env: process.env,
  });
}

function isTracked(repoRoot, relativePath) {
  const result = gitStatus(repoRoot, ["ls-files", "--error-unmatch", "--", relativePath]);
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new Error(result.error ? result.error.message : result.stderr.trim() || "Unable to inspect tracked files");
}

function isIgnored(repoRoot, relativePath) {
  const result = gitStatus(repoRoot, ["check-ignore", "-q", "--", relativePath]);
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new Error(result.error ? result.error.message : result.stderr.trim() || "Unable to inspect ignored files");
}

function resolveOutput(repoRoot, outputPath) {
  if (!outputPath) throw new Error("Missing --output <receiver-check.json>");
  const resolved = path.resolve(outputPath);
  assertNonSensitiveOutputPath(resolved);
  if (fs.existsSync(resolved)) throw new Error(`Receiver init output already exists: ${outputPath}`);

  let existingParent = path.dirname(resolved);
  const pendingSegments = [];
  while (!fs.existsSync(existingParent)) {
    pendingSegments.unshift(path.basename(existingParent));
    const next = path.dirname(existingParent);
    if (next === existingParent) throw new Error("Unable to resolve receiver init output directory");
    existingParent = next;
  }
  const realParent = path.join(fs.realpathSync(existingParent), ...pendingSegments);
  const realOutput = path.join(realParent, path.basename(resolved));
  assertNonSensitiveOutputPath(realOutput);
  if (fs.existsSync(realOutput)) throw new Error(`Receiver init output already exists: ${outputPath}`);

  if (!isInside(repoRoot, realOutput)) {
    return { outputPath: realOutput, repoRelativePath: "", gitVisible: false };
  }
  const repoRelativePath = validateRepositoryRelativePath(
    normalizeSlash(path.relative(repoRoot, realOutput)),
    "receiver init output",
  );
  if (isTracked(repoRoot, repoRelativePath)) {
    throw new Error("Receiver init must not write a tracked target-repository file");
  }
  return { outputPath: realOutput, repoRelativePath, gitVisible: !isIgnored(repoRoot, repoRelativePath) };
}

function buildReceiverCheckConfig(state, repoRelativeOutput = "") {
  const expectedChangedFiles = [...state.changedFiles];
  const outputFiles = Array.isArray(repoRelativeOutput)
    ? repoRelativeOutput
    : repoRelativeOutput ? [repoRelativeOutput] : [];
  for (const outputFile of outputFiles) {
    if (outputFile && !expectedChangedFiles.includes(outputFile)) {
      expectedChangedFiles.push(outputFile);
    }
  }
  expectedChangedFiles.sort();
  const config = {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    expected_branch: state.branch,
    expected_head: state.head,
    expected_changed_files: expectedChangedFiles,
    declared_checks: [],
  };
  validateReceiverCheckConfig(config);
  return config;
}

function runReceiverInit(options) {
  if (!options.repoPath) throw new Error("Missing --repo <target-repo>");
  const repoRoot = resolveRepository(options.repoPath);
  const before = readRepositoryState(repoRoot);
  const output = resolveOutput(repoRoot, options.outputPath);
  const config = buildReceiverCheckConfig(before, output.gitVisible ? output.repoRelativePath : "");

  fs.mkdirSync(path.dirname(output.outputPath), { recursive: true });
  fs.writeFileSync(output.outputPath, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  const after = readRepositoryState(repoRoot);
  const expectedAfter = {
    ...before,
    changedFiles: config.expected_changed_files,
  };
  if (JSON.stringify(after) !== JSON.stringify(expectedAfter)) {
    fs.rmSync(output.outputPath, { force: true });
    throw new Error("Target repository changed unexpectedly while receiver config was generated");
  }

  return {
    command: "receiver-init",
    output: output.outputPath,
    output_inside_repo: Boolean(output.repoRelativePath),
    output_repo_relative: output.repoRelativePath || "not_applicable",
    output_git_visible: output.gitVisible,
    config,
  };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const repoIndex = args.indexOf("--repo");
  const outputIndex = args.indexOf("--output");
  return {
    repoPath: repoIndex >= 0 ? args[repoIndex + 1] : "",
    outputPath: outputIndex >= 0 ? args[outputIndex + 1] : "",
    jsonMode: args.includes("--json"),
  };
}

function formatHuman(result) {
  return [
    `BaseBrief receiver config written to ${result.output}`,
    `expected_branch=${result.config.expected_branch}`,
    `expected_head=${result.config.expected_head}`,
    `expected_changed_files=${result.config.expected_changed_files.length}`,
    `declared_checks=${result.config.declared_checks.length}`,
    "",
  ].join(os.EOL);
}

function cli() {
  try {
    const options = parseArgs(process.argv);
    const result = runReceiverInit(options);
    process.stdout.write(options.jsonMode ? `${JSON.stringify(result, null, 2)}\n` : formatHuman(result));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) cli();

module.exports = {
  buildReceiverCheckConfig,
  formatHuman,
  isTracked,
  isIgnored,
  parseArgs,
  resolveOutput,
  runReceiverInit,
};
