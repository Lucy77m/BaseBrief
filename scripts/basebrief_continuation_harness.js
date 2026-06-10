#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");

const { checkArtifacts } = require("./basebrief_check_artifacts");
const { buildContextPack } = require("./basebrief_context_pack");
const { runResume } = require("./basebrief_resume");

const CONTINUATION_CONTRACT_VERSION = "basebrief-continuation-harness-v1";
const CONTINUATION_FILES = {
  report: "CONTINUATION_REPORT.md",
  starter: "NEXT_WINDOW_STARTER.md",
  checkSummary: "CHECK_SUMMARY.md",
  meta: "continuation.meta.json",
  contextPack: "context-pack",
};

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

function assertWritableOutputDir(outputDir) {
  assertNonSensitivePath(outputDir, "continuation output");
  if (!fs.existsSync(outputDir)) return;
  if (!fs.statSync(outputDir).isDirectory()) {
    throw new Error(`continuation output exists and is not a directory: ${outputDir}`);
  }
  if (fs.readdirSync(outputDir).length > 0) {
    throw new Error(`continuation output directory already exists and is not empty: ${outputDir}`);
  }
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

function writeJson(filePath, data) {
  writeText(filePath, JSON.stringify(data, null, 2));
}

function relativeFromOutput(outputDir, filePath) {
  return normalizeSlash(path.relative(outputDir, filePath));
}

function outputFilesForDir(outputDir) {
  return {
    report: path.join(outputDir, CONTINUATION_FILES.report),
    starter: path.join(outputDir, CONTINUATION_FILES.starter),
    checkSummary: path.join(outputDir, CONTINUATION_FILES.checkSummary),
    meta: path.join(outputDir, CONTINUATION_FILES.meta),
    contextPackDir: path.join(outputDir, CONTINUATION_FILES.contextPack),
  };
}

function statusFrom({ check, resumeStatus, worktreeStatus }) {
  if (check.errorCount > 0 || resumeStatus === "blocked") return "blocked";
  if (check.warningCount > 0 || worktreeStatus === "dirty") return "needs_review";
  return "ready_for_receiver";
}

function publicFindings(findings = []) {
  return findings.map((finding) => ({
    severity: finding.severity,
    ruleId: finding.ruleId,
    file: finding.file,
    line: finding.line,
    message: finding.message,
  }));
}

function findingLine(finding) {
  return `- ${finding.severity} ${finding.ruleId} ${finding.file}:${finding.line} ${finding.message}`;
}

function renderCheckSummary(check) {
  return [
    "# BaseBrief Continuation Check Summary",
    "",
    `check_status: ${check.status}`,
    `check_errors: ${check.errorCount}`,
    `check_warnings: ${check.warningCount}`,
    "",
    "## Findings",
    "",
    check.findings.length ? check.findings.map(findingLine).join(os.EOL) : "- none",
    "",
    "## Review Notes",
    "",
    "- Context Pack Check is the acceptance gate before copying `NEXT_WINDOW_STARTER.md`.",
    "- Warning-only output is reviewable but not fully clean.",
    "- Error output blocks receiver handoff until repaired.",
    "",
  ].join(os.EOL);
}

function renderReport({ generatedAt, outputDir, contextPackDir, pack, check, resumeStatus, continuationStatus }) {
  const changedFiles = pack.git.changedFiles || [];
  return [
    "# BaseBrief Continuation Report",
    "",
    "## Status",
    "",
    `- continuation_status: ${continuationStatus}`,
    `- generated_at: ${generatedAt}`,
    `- repo: ${path.basename(pack.repo)}`,
    `- branch: ${pack.git.branch}`,
    `- head: ${pack.git.head}`,
    `- worktree_status: ${pack.git.worktree_status}`,
    `- worktree_changed_files: ${changedFiles.length}`,
    "",
    "## Steps Run",
    "",
    "| Step | Status | Output |",
    "|---|---|---|",
    `| context-pack | ${pack.status} | \`${relativeFromOutput(outputDir, contextPackDir)}/\` |`,
    `| check | ${check.status} | \`${CONTINUATION_FILES.checkSummary}\` |`,
    `| resume | ${resumeStatus} | \`${CONTINUATION_FILES.starter}\` |`,
    "| doctor | skipped | not_run_in_v2.8.0_minimal_harness |",
    "| export | skipped | not_run_in_v2.8.0_minimal_harness |",
    "",
    "## Human Next Step",
    "",
    continuationStatus === "blocked"
      ? "- Repair the Context Pack findings in `CHECK_SUMMARY.md`, then rerun `continue`."
      : "- Copy `NEXT_WINDOW_STARTER.md` into the next AI window after reviewing this report.",
    "",
    "## Receiver Requirements",
    "",
    "- Recheck live cwd, branch, HEAD, and worktree status in the receiver window.",
    "- Treat generated pack facts as inherited context, not as receiver-window verification.",
    "- Report gaps before implementation.",
    "- Preserve `RISK_BOUNDARIES.md`.",
    "- Use `doctor` separately when live repository drift must be compared before acting.",
    "",
    "## Warnings",
    "",
    check.findings.length ? check.findings.map(findingLine).join(os.EOL) : "- none",
    "",
    "## Hard Boundaries",
    "",
    "- No provider request.",
    "- No runtime integration.",
    "- No plugin or MCP server/tools.",
    "- No schema-v2.",
    "- No Workflow Runner.",
    "- No daemon or watcher.",
    "- No automatic commit, push, tag, release, or pull request.",
    "- Do not expose `.env`, API keys, tokens, credentials, secrets, private absolute paths, or raw private output.",
    "",
    "## Files To Review",
    "",
    "1. `CONTINUATION_REPORT.md`",
    "2. `CHECK_SUMMARY.md`",
    "3. `NEXT_WINDOW_STARTER.md`",
    "4. `context-pack/MANIFEST.md`",
    "5. `context-pack/RISK_BOUNDARIES.md`",
    "6. `context-pack/RECEIVER_STATE.md`",
    "",
  ].join(os.EOL);
}

function safePromptForOutput(prompt, contextPackDir) {
  const normalizedPrompt = normalizeSlash(prompt);
  const normalizedInput = normalizeSlash(contextPackDir);
  return normalizedPrompt.split(normalizedInput).join(CONTINUATION_FILES.contextPack);
}

function runContinuationHarness(options) {
  if (!options.repo) throw new Error("Missing --repo <target-repo>");
  if (!options["output-dir"]) throw new Error("Missing --output-dir <dir>");
  const outputDir = path.resolve(options["output-dir"]);
  assertWritableOutputDir(outputDir);

  const outputFiles = outputFilesForDir(outputDir);
  const generatedAt = new Date().toISOString();
  const pack = buildContextPack({
    repoPath: options.repo,
    outputDir: outputFiles.contextPackDir,
    since: options.since || "",
    maxFiles: options["max-files"] || "",
  });
  const check = checkArtifacts({ inputPath: outputFiles.contextPackDir });
  let resume = null;
  let resumeStatus = "blocked";
  if (check.errorCount === 0) {
    resume = runResume({ input: outputFiles.contextPackDir });
    resumeStatus = resume.status;
    writeText(outputFiles.starter, safePromptForOutput(resume.prompt, outputFiles.contextPackDir));
  }
  const continuationStatus = statusFrom({
    check,
    resumeStatus,
    worktreeStatus: pack.git.worktree_status,
  });

  writeText(outputFiles.checkSummary, renderCheckSummary(check));
  writeText(outputFiles.report, renderReport({
    generatedAt,
    outputDir,
    contextPackDir: outputFiles.contextPackDir,
    pack,
    check,
    resumeStatus,
    continuationStatus,
  }));
  writeJson(outputFiles.meta, {
    command: "continue",
    contractVersion: CONTINUATION_CONTRACT_VERSION,
    continuationStatus,
    generatedAt,
    repo: path.basename(pack.repo),
    git: pack.git,
    steps: {
      contextPack: pack.status,
      check: check.status,
      resume: resumeStatus,
      doctor: "skipped",
      export: "skipped",
    },
    check: {
      status: check.status,
      errorCount: check.errorCount,
      warningCount: check.warningCount,
      findings: publicFindings(check.findings),
    },
    outputs: {
      report: CONTINUATION_FILES.report,
      starter: resume ? CONTINUATION_FILES.starter : "",
      checkSummary: CONTINUATION_FILES.checkSummary,
      contextPack: `${CONTINUATION_FILES.contextPack}/`,
    },
    boundaries: [
      "No provider request.",
      "No runtime integration.",
      "No plugin or MCP server/tools.",
      "No schema-v2.",
      "No Workflow Runner.",
      "No automatic git or release action.",
    ],
  });

  return {
    command: "continue",
    contractVersion: CONTINUATION_CONTRACT_VERSION,
    outputDir,
    outputFiles,
    status: continuationStatus,
    steps: {
      contextPack: pack.status,
      check: check.status,
      resume: resumeStatus,
      doctor: "skipped",
      export: "skipped",
    },
    git: pack.git,
    check: {
      status: check.status,
      errorCount: check.errorCount,
      warningCount: check.warningCount,
      findings: publicFindings(check.findings),
    },
  };
}

module.exports = {
  CONTINUATION_CONTRACT_VERSION,
  CONTINUATION_FILES,
  renderCheckSummary,
  renderReport,
  runContinuationHarness,
  safePromptForOutput,
};
