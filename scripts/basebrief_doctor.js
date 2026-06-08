#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const { checkArtifacts } = require("./basebrief_check_artifacts");
const { CONTEXT_PACK_FILES } = require("./basebrief_context_pack");
const { readRepositoryState, resolveRepository } = require("./basebrief_receiver_check");

const DOCTOR_CONTRACT_VERSION = "basebrief-doctor-v1";
const REQUIRED_BOUNDARY_PATTERNS = [
  { label: "No provider request", pattern: /No provider request/i },
  { label: "No runtime integration", pattern: /No runtime integration/i },
  { label: "No MCP server", pattern: /No MCP server|No plugin, MCP/i },
  { label: "No schema-v2", pattern: /No schema-v2|schema-v2/i },
  { label: "No Workflow Runner", pattern: /No Workflow Runner/i },
];

function normalizeSlash(value) {
  return value.replace(/\\/g, "/");
}

function pathSegments(filePath) {
  return normalizeSlash(filePath).split("/").filter(Boolean);
}

function assertNonSensitivePath(filePath, label) {
  const segments = pathSegments(filePath).map((segment) => segment.toLowerCase());
  if (segments.includes(".git")) throw new Error(`${label} must not use a .git path`);
  if (segments.some((segment) => segment === ".env" || segment.startsWith(".env."))) {
    throw new Error(`${label} must not use an .env path`);
  }
}

function assertContextPackInput(inputPath) {
  if (!inputPath) throw new Error("Missing --context-pack <context-pack-dir>");
  assertNonSensitivePath(inputPath, "doctor context-pack input");
  const inputDir = path.resolve(inputPath);
  if (!fs.existsSync(inputDir)) {
    throw new Error(`Context pack input does not exist: ${inputPath}`);
  }
  if (!fs.statSync(inputDir).isDirectory()) {
    throw new Error(`Context pack input must be a directory: ${inputPath}`);
  }
  return inputDir;
}

function assertRepoInput(repoPath) {
  if (!repoPath) throw new Error("Missing --repo <target-repo>");
  assertNonSensitivePath(repoPath, "doctor repo input");
  return resolveRepository(repoPath);
}

function readPackFile(inputDir, fileName) {
  const filePath = path.join(inputDir, fileName);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return "";
  return fs.readFileSync(filePath, "utf8");
}

function metadataValue(content, label) {
  const pattern = new RegExp(`^- ${label}:\\s*(.*?)\\s*$`, "m");
  const match = pattern.exec(content);
  return match ? match[1].trim() : "";
}

function finding(severity, ruleId, message, source, evidence) {
  return { severity, ruleId, message, source, evidence };
}

function checkStatus(findings) {
  if (findings.some((item) => item.severity === "error")) return "failed";
  if (findings.some((item) => item.severity === "warning")) return "warning";
  return "passed";
}

function summarize(findings) {
  return {
    errorCount: findings.filter((item) => item.severity === "error").length,
    warningCount: findings.filter((item) => item.severity === "warning").length,
    infoCount: findings.filter((item) => item.severity === "info").length,
  };
}

function publicCheckFinding(checkFinding) {
  return `${checkFinding.ruleId} ${path.basename(checkFinding.file || "")}:${checkFinding.line}`;
}

function addPackCheckFindings(findings, check) {
  for (const checkFinding of check.findings) {
    const severity = String(checkFinding.severity).toLowerCase() === "error" ? "error" : "warning";
    findings.push(finding(
      severity,
      severity === "error" ? "doctor.pack-check-error" : "doctor.pack-check-warning",
      checkFinding.message,
      "check",
      publicCheckFinding(checkFinding),
    ));
  }
}

function addGitFindings(findings, repoState, manifestContent) {
  const packBranch = metadataValue(manifestContent, "Branch");
  const packHead = metadataValue(manifestContent, "HEAD");
  if (repoState.changedFiles.length > 0) {
    findings.push(finding(
      "warning",
      "doctor.worktree-dirty",
      "Repository worktree is dirty; receiver facts should be rechecked before continuing.",
      "git",
      `changed_files=${repoState.changedFiles.length}`,
    ));
  }
  if (packHead && packHead !== repoState.head) {
    findings.push(finding(
      "warning",
      "doctor.pack-head-stale",
      "Context pack HEAD differs from live repository HEAD.",
      "context-pack",
      `pack=${packHead.slice(0, 12)} live=${repoState.head.slice(0, 12)}`,
    ));
  }
  if (packBranch && packBranch !== repoState.branch) {
    findings.push(finding(
      "warning",
      "doctor.pack-branch-mismatch",
      "Context pack branch differs from live repository branch.",
      "context-pack",
      `pack=${packBranch} live=${repoState.branch}`,
    ));
  }
}

function addBoundaryFindings(findings, inputDir) {
  const boundaryContent = [
    readPackFile(inputDir, CONTEXT_PACK_FILES.riskBoundaries),
    readPackFile(inputDir, CONTEXT_PACK_FILES.nextWindowStarter),
  ].join("\n");
  const missing = REQUIRED_BOUNDARY_PATTERNS
    .filter((item) => !item.pattern.test(boundaryContent))
    .map((item) => item.label);
  if (missing.length > 0) {
    findings.push(finding(
      "warning",
      "doctor.no-provider-boundary",
      "Context pack is missing one or more required local-only boundary statements.",
      "docs",
      `missing=${missing.join(", ")}`,
    ));
  }
}

function runDoctor(options) {
  const repoRoot = assertRepoInput(options.repo);
  const inputDir = assertContextPackInput(options["context-pack"]);
  const repoState = readRepositoryState(repoRoot);
  const manifestContent = readPackFile(inputDir, CONTEXT_PACK_FILES.manifest);
  const check = checkArtifacts({ inputPath: inputDir });
  const findings = [];

  addPackCheckFindings(findings, check);
  addGitFindings(findings, repoState, manifestContent);
  addBoundaryFindings(findings, inputDir);
  findings.push(finding(
    "info",
    "doctor.live-recheck-required",
    "Receivers must recheck cwd, branch, HEAD, and worktree status before implementation.",
    "git",
    `branch=${repoState.branch} head=${repoState.head.slice(0, 12)}`,
  ));

  return {
    command: "doctor",
    contractVersion: DOCTOR_CONTRACT_VERSION,
    repo: repoRoot,
    contextPack: inputDir,
    status: checkStatus(findings),
    summary: summarize(findings),
    findings,
  };
}

module.exports = {
  DOCTOR_CONTRACT_VERSION,
  REQUIRED_BOUNDARY_PATTERNS,
  runDoctor,
};
