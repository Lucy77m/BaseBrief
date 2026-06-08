#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");

const { checkArtifacts } = require("./basebrief_check_artifacts");
const { CONTEXT_PACK_FILES } = require("./basebrief_context_pack");

const FILE_EXPORT_CONTRACT_VERSION = "basebrief-file-export-v1";
const SOURCE_KIND = "context-pack-lite";
const CONTEXT_PACK_FILE_ORDER = Object.values(CONTEXT_PACK_FILES);
const EXPORT_FILES = {
  manifest: "manifest.json",
  contextPack: "context-pack.md",
  context: "context.json",
  adapterNotes: "adapter-notes.md",
};

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
  if (!inputPath) throw new Error("Missing --input <context-pack-dir>");
  assertNonSensitivePath(inputPath, "file export input");
  const inputDir = path.resolve(inputPath);
  if (!fs.existsSync(inputDir)) {
    throw new Error(`Context pack input does not exist: ${inputPath}`);
  }
  if (!fs.statSync(inputDir).isDirectory()) {
    throw new Error(`Context pack input must be a directory: ${inputPath}`);
  }
  for (const fileName of CONTEXT_PACK_FILE_ORDER) {
    if (!fs.existsSync(path.join(inputDir, fileName))) {
      throw new Error(`Context pack is missing required file: ${fileName}`);
    }
  }
  return inputDir;
}

function assertWritableOutputDir(outputDir) {
  if (!outputDir) throw new Error("Missing --output-dir <dir>");
  assertNonSensitivePath(outputDir, "file export output");
  const resolved = path.resolve(outputDir);
  if (!fs.existsSync(resolved)) return resolved;
  if (!fs.statSync(resolved).isDirectory()) {
    throw new Error(`file export output exists and is not a directory: ${outputDir}`);
  }
  if (fs.readdirSync(resolved).length > 0) {
    throw new Error(`file export output directory already exists and is not empty: ${outputDir}`);
  }
  return resolved;
}

function readPackFile(inputDir, fileName) {
  return fs.readFileSync(path.join(inputDir, fileName), "utf8").trimEnd();
}

function publicFinding(finding) {
  return {
    severity: finding.severity,
    ruleId: finding.ruleId,
    file: path.basename(finding.file || ""),
    line: finding.line,
    message: finding.message,
  };
}

function publicCheck(check) {
  return {
    status: check.status,
    errorCount: check.errorCount,
    warningCount: check.warningCount,
    findings: check.findings.map(publicFinding),
  };
}

function metadataValue(content, label) {
  const pattern = new RegExp(`^- ${label}:\\s*(.*?)\\s*$`, "m");
  const match = pattern.exec(content);
  return match ? match[1].trim() : "";
}

function extractPackFacts(manifestContent) {
  return {
    project: metadataValue(manifestContent, "Project") || "not_available",
    packMode: metadataValue(manifestContent, "Pack mode") || "not_available",
    branch: metadataValue(manifestContent, "Branch") || "not_available",
    head: metadataValue(manifestContent, "HEAD") || "not_available",
    worktreeStatus: metadataValue(manifestContent, "Worktree status") || "not_available",
    worktreeChangedFiles: metadataValue(manifestContent, "Worktree changed files") || "not_available",
    sinceCommit: metadataValue(manifestContent, "Since commit") || "not_available",
  };
}

function renderContextPack(fileContents) {
  const sections = [];
  for (const fileName of CONTEXT_PACK_FILE_ORDER) {
    sections.push([
      `<!-- BASEBRIEF_SOURCE_FILE: ${fileName} -->`,
      "",
      fileContents[fileName],
    ].join(os.EOL));
  }
  return [
    "# BaseBrief File-only Context Pack Export",
    "",
    "Review status: generated",
    "Source: checked Context Pack Lite directory",
    "Trust: medium",
    "Stale: false",
    "",
    "This export concatenates checked Context Pack Lite files for local file consumption.",
    "It is not an MCP server, plugin, runtime integration, provider request path, schema-v2, hosted service, cloud-memory layer, or Workflow Runner.",
    "",
    ...sections,
    "",
  ].join(os.EOL);
}

function renderAdapterNotes(check) {
  const notes = [
    "# File-only Export Adapter Notes",
    "",
    "Review status: generated",
    "Source: checked Context Pack Lite directory",
    "Trust: medium",
    "Stale: false",
    "",
    "## Boundary",
    "",
    "- MCP-friendly means these files can be consumed by future local tools.",
    "- No provider request.",
    "- No runtime integration.",
    "- No plugin.",
    "- No MCP server.",
    "- No IDE integration.",
    "- No hosted service.",
    "- No cloud-memory behavior.",
    "- No schema-v2.",
    "- No Workflow Runner.",
    "- Consumers must recheck live repo facts before implementation.",
    "",
    "## Check Status",
    "",
    `- check_status: ${check.status}`,
    `- check_errors: ${check.errorCount}`,
    `- check_warnings: ${check.warningCount}`,
  ];
  if (!check.findings.length) {
    notes.push("- check_findings: none");
  } else {
    notes.push(...check.findings.map((finding) => `- ${finding.severity} ${finding.ruleId} ${path.basename(finding.file)}:${finding.line} ${finding.message}`));
  }
  notes.push("");
  return notes.join(os.EOL);
}

function outputFileMap(outputDir) {
  return Object.fromEntries(
    Object.entries(EXPORT_FILES).map(([key, fileName]) => [key, path.join(outputDir, fileName)]),
  );
}

function writeText(filePath, content) {
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`, { encoding: "utf8", flag: "wx" });
}

function buildExportPayload({ generatedAt, check, fileContents }) {
  const checkSummary = publicCheck(check);
  const pack = extractPackFacts(fileContents["MANIFEST.md"]);
  return {
    contractVersion: FILE_EXPORT_CONTRACT_VERSION,
    sourceKind: SOURCE_KIND,
    generatedAt,
    sourceFiles: CONTEXT_PACK_FILE_ORDER,
    outputFiles: EXPORT_FILES,
    check: checkSummary,
    review: {
      status: check.warningCount > 0 ? "needs-review" : "generated",
      warningOnly: check.errorCount === 0 && check.warningCount > 0,
      liveRepoRecheckRequired: true,
      missingInputSemantics: ["not_available", "not_applicable", "needs-review", "stale"],
    },
    pack,
    boundaries: [
      "No provider request.",
      "No runtime integration.",
      "No plugin.",
      "No MCP server.",
      "No IDE integration.",
      "No hosted service.",
      "No cloud-memory behavior.",
      "No schema-v2.",
      "No Workflow Runner.",
    ],
  };
}

function runExport(options) {
  const inputDir = assertContextPackInput(options.input);
  const outputDir = assertWritableOutputDir(options["output-dir"]);
  const check = checkArtifacts({ inputPath: inputDir });
  if (check.errorCount > 0) {
    throw new Error(`Context pack check failed: errors=${check.errorCount}, warnings=${check.warningCount}`);
  }

  const fileContents = Object.fromEntries(
    CONTEXT_PACK_FILE_ORDER.map((fileName) => [fileName, readPackFile(inputDir, fileName)]),
  );
  const generatedAt = new Date().toISOString();
  const payload = buildExportPayload({ generatedAt, check, fileContents });
  const outputFiles = outputFileMap(outputDir);

  fs.mkdirSync(outputDir, { recursive: true });
  writeText(outputFiles.contextPack, renderContextPack(fileContents));
  writeText(outputFiles.context, JSON.stringify(payload, null, 2));
  writeText(outputFiles.manifest, JSON.stringify({
    contractVersion: FILE_EXPORT_CONTRACT_VERSION,
    sourceKind: SOURCE_KIND,
    generatedAt,
    sourceFiles: CONTEXT_PACK_FILE_ORDER,
    outputFiles: EXPORT_FILES,
    check: payload.check,
    review: payload.review,
  }, null, 2));
  writeText(outputFiles.adapterNotes, renderAdapterNotes(check));

  return {
    command: "export",
    contractVersion: FILE_EXPORT_CONTRACT_VERSION,
    sourceKind: SOURCE_KIND,
    input: inputDir,
    outputDir,
    outputFiles,
    status: "generated",
    check: payload.check,
    review: payload.review,
  };
}

module.exports = {
  CONTEXT_PACK_FILE_ORDER,
  EXPORT_FILES,
  FILE_EXPORT_CONTRACT_VERSION,
  buildExportPayload,
  runExport,
};
