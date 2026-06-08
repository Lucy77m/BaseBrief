#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");

const { checkArtifacts } = require("./basebrief_check_artifacts");
const { CONTEXT_PACK_FILES } = require("./basebrief_context_pack");

const RESUME_CONTRACT_VERSION = "basebrief-resume-v1";
const PROMPT_FILE_ORDER = [
  "MANIFEST.md",
  "RECENT_DELTA.md",
  "RISK_BOUNDARIES.md",
  "REPO_MAP.md",
  "KEY_FILES.md",
  "RECEIVER_STATE.md",
  "NEXT_WINDOW_STARTER.md",
];

function normalizeSlash(value) {
  return value.replace(/\\/g, "/");
}

function requiredContextPackFiles() {
  return Object.values(CONTEXT_PACK_FILES);
}

function assertContextPackInput(inputPath) {
  if (!inputPath) throw new Error("Missing --input <context-pack-dir>");
  const inputDir = path.resolve(inputPath);
  if (!fs.existsSync(inputDir)) {
    throw new Error(`Context pack input does not exist: ${inputPath}`);
  }
  if (!fs.statSync(inputDir).isDirectory()) {
    throw new Error(`Context pack input must be a directory: ${inputPath}`);
  }
  return inputDir;
}

function readPackFile(inputDir, fileName) {
  return fs.readFileSync(path.join(inputDir, fileName), "utf8").trimEnd();
}

function findingLine(finding) {
  return `${finding.severity} ${finding.ruleId} ${finding.file}:${finding.line} ${finding.message}`;
}

function reviewNotes(check) {
  if (!check.findings.length) return ["- check_status: passed", "- check_findings: none"];
  return [
    `- check_status: ${check.status}`,
    `- check_errors: ${check.errorCount}`,
    `- check_warnings: ${check.warningCount}`,
    ...check.findings.map((finding) => `- ${findingLine(finding)}`),
  ];
}

function buildResumePrompt({ inputDir, check }) {
  const starter = readPackFile(inputDir, "NEXT_WINDOW_STARTER.md");
  const promptInput = normalizeSlash(inputDir);
  return [
    "# BaseBrief Resume Prompt",
    "",
    "You are continuing from a checked BaseBrief Context Pack Lite directory.",
    "",
    "First, read the context pack files in this order:",
    "",
    ...PROMPT_FILE_ORDER.map((fileName, index) => `${index + 1}. \`${fileName}\``),
    "",
    "Input directory:",
    "",
    `\`${promptInput}\``,
    "",
    "Before implementation:",
    "",
    "- Recheck current cwd, git branch, HEAD, and worktree status in this window.",
    "- Treat inherited pack facts as context, not as facts reverified in this window.",
    "- Report gaps before changing files.",
    "- Preserve the risk boundaries from `RISK_BOUNDARIES.md`.",
    "- Do not add provider requests, runtime integration, plugin, MCP, IDE, hosted service, cloud-memory, schema-v2, Workflow Runner, daemon, watcher, or repo-dump behavior.",
    "",
    "Context pack check notes:",
    "",
    ...reviewNotes(check),
    "",
    "Starter from `NEXT_WINDOW_STARTER.md`:",
    "",
    starter,
    "",
  ].join(os.EOL);
}

function runResume(options) {
  if (options.output || options["output-dir"]) {
    throw new Error("resume prints to stdout only; output files are not supported in v2.2-A");
  }
  const inputDir = assertContextPackInput(options.input);
  for (const fileName of requiredContextPackFiles()) {
    if (!fs.existsSync(path.join(inputDir, fileName))) {
      throw new Error(`Context pack is missing required file: ${fileName}`);
    }
  }
  const check = checkArtifacts({ inputPath: inputDir });
  if (check.errorCount > 0) {
    throw new Error(`Context pack check failed: errors=${check.errorCount}, warnings=${check.warningCount}`);
  }
  const prompt = buildResumePrompt({ inputDir, check });
  return {
    command: "resume",
    contractVersion: RESUME_CONTRACT_VERSION,
    input: inputDir,
    status: "ready",
    prompt,
    promptLength: prompt.length,
    check: {
      status: check.status,
      errorCount: check.errorCount,
      warningCount: check.warningCount,
      findings: check.findings,
    },
  };
}

module.exports = {
  PROMPT_FILE_ORDER,
  RESUME_CONTRACT_VERSION,
  buildResumePrompt,
  runResume,
};
