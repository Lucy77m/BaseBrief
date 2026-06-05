#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");

const SCANNED_EXTENSIONS = new Set([".md", ".json", ".txt"]);
const SKIPPED_DIRS = new Set([".git", "node_modules", "dist", ".cache", "coverage", "private"]);

const SECRET_PATTERNS = [
  { ruleId: "secret.sk", pattern: /sk-[A-Za-z0-9]{10,}/ },
  { ruleId: "secret.bearer", pattern: /Bearer\s+[A-Za-z0-9._-]{10,}/i },
  { ruleId: "secret.github-token", pattern: /\bgh[opusr]_[A-Za-z0-9_]{10,}/ },
  { ruleId: "secret.aws-access-key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
  { ruleId: "secret.slack-token", pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { ruleId: "secret.google-api-key", pattern: /\bAIza[A-Za-z0-9_-]{20,}/ },
  { ruleId: "secret.private-key-block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { ruleId: "secret.assignment", pattern: /\b(?:api[_-]?key|token|secret)\s*[:=]\s*["']?[A-Za-z0-9._-]{10,}/i },
  { ruleId: "secret.env-key", pattern: /\b[A-Z0-9_]*(?:API_KEY|TOKEN|SECRET)\s*=\s*["']?[A-Za-z0-9._-]{10,}/ },
];

const PRIVATE_PATH_PATTERNS = [
  /[A-Za-z]:\\[^\s"'`)]*/i,
  /[A-Za-z]:\/[^\s"'`)]*/i,
  /\/home\/[^\s"'`)]+/i,
  /\/Users\/[^\s"'`)]+/i,
];

const PROVIDER_GENERAL_CLAIM_PATTERNS = [
  /cross-provider proof/i,
  /provider-general (?:proof|claim|evidence)/i,
  /real billing (?:audit|proof|evidence)/i,
  /proven savings across providers/i,
  /all providers (?:save|reduce|support|benefit)/i,
  /跨\s*provider\s*证明/i,
  /跨供应商证明/i,
  /真实账单审计/i,
  /通用省钱证明/i,
  /所有\s*provider\s*都/i,
];

function parseArgs(argv) {
  const args = argv.slice(2);
  const inputIndex = args.indexOf("--input");
  return {
    inputPath: inputIndex >= 0 ? args[inputIndex + 1] : "",
    jsonMode: args.includes("--json"),
  };
}

function normalizeSlash(filePath) {
  return filePath.replace(/\\/g, "/");
}

function listInputFiles(inputPath) {
  if (!inputPath) {
    throw new Error("Missing --input <file-or-dir>");
  }
  const root = path.resolve(inputPath);
  if (!fs.existsSync(root)) {
    throw new Error(`Input path does not exist: ${inputPath}`);
  }
  const stat = fs.statSync(root);
  if (stat.isFile()) {
    return SCANNED_EXTENSIONS.has(path.extname(root).toLowerCase()) ? [root] : [];
  }
  if (!stat.isDirectory()) {
    return [];
  }

  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name)) {
          walk(path.join(dir, entry.name));
        }
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (SCANNED_EXTENSIONS.has(path.extname(fullPath).toLowerCase())) {
        files.push(fullPath);
      }
    }
  }
  walk(root);
  return files.sort();
}

function lineNumberForIndex(content, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function hasRiskBoundaries(content) {
  return /\brisk_boundaries\b/i.test(content) || /^##\s+Risk Boundaries\s*$/im.test(content) || /^R=.+/m.test(content);
}

function hasOpenQuestions(content) {
  return /\bopen_questions\b/i.test(content) || /^##\s+Open Questions\s*$/im.test(content);
}

function isAdapterArtifact(filePath, content) {
  const name = path.basename(filePath).toLowerCase();
  return (
    name === "codex-task.md" ||
    name === "claude-project-context.md" ||
    /^# BaseBrief (?:Codex Task|Claude Project Context)/m.test(content)
  );
}

function isHandoffOrAdapterArtifact(filePath, content) {
  const name = path.basename(filePath).toLowerCase();
  return (
    isAdapterArtifact(filePath, content) ||
    name === "readablebrief.md" ||
    name === "activeproviderprompt.md" ||
    content.includes("BASEBRIEF_HANDOFF_JSON_BEGIN") ||
    content.includes("# BaseBrief BB9")
  );
}

function addFinding(findings, severity, ruleId, file, line, message) {
  findings.push({
    severity,
    ruleId,
    file: normalizeSlash(file),
    line,
    message,
  });
}

function scanContent({ filePath, displayPath, content }) {
  const findings = [];

  for (const { ruleId, pattern } of SECRET_PATTERNS) {
    const match = pattern.exec(content);
    if (match) {
      addFinding(findings, "ERROR", ruleId, displayPath, lineNumberForIndex(content, match.index), "Secret-like string found.");
    }
  }

  for (const pattern of PRIVATE_PATH_PATTERNS) {
    const match = pattern.exec(content);
    if (match) {
      addFinding(findings, "ERROR", "private.absolute-path", displayPath, lineNumberForIndex(content, match.index), "Private absolute path found.");
    }
  }

  if (isAdapterArtifact(filePath, content)) {
    const match = /BASEBRIEF_CACHE_BLOCK_PAD|# BaseBrief BB9 Cache Sidecar|\bcacheSidecar\b/.exec(content);
    if (match) {
      addFinding(findings, "ERROR", "adapter.provider-sidecar", displayPath, lineNumberForIndex(content, match.index), "Adapter output must not contain provider-only sidecar or cache PAD content.");
    }
  }

  if (isHandoffOrAdapterArtifact(filePath, content) && !hasRiskBoundaries(content)) {
    addFinding(findings, "ERROR", "artifact.missing-risk-boundaries", displayPath, 1, "Artifact is missing risk boundaries.");
  }

  if (isHandoffOrAdapterArtifact(filePath, content) && !hasOpenQuestions(content)) {
    addFinding(findings, "WARNING", "artifact.missing-open-questions", displayPath, 1, "Artifact is missing open questions.");
  }

  for (const pattern of PROVIDER_GENERAL_CLAIM_PATTERNS) {
    const match = pattern.exec(content);
    if (match) {
      addFinding(findings, "WARNING", "provider.overgeneralized-claim", displayPath, lineNumberForIndex(content, match.index), "Provider-specific evidence may be written as a general claim.");
      break;
    }
  }

  return findings;
}

function checkArtifacts(options) {
  const inputPath = options.inputPath || "";
  const inputRoot = inputPath ? path.resolve(inputPath) : "";
  const inputFiles = listInputFiles(inputPath);
  const baseDir = fs.existsSync(inputRoot) && fs.statSync(inputRoot).isDirectory() ? inputRoot : path.dirname(inputRoot);
  const findings = [];

  for (const filePath of inputFiles) {
    const displayPath = path.relative(baseDir, filePath) || path.basename(filePath);
    const content = fs.readFileSync(filePath, "utf8");
    findings.push(...scanContent({ filePath, displayPath, content }));
  }

  const errorCount = findings.filter((finding) => finding.severity === "ERROR").length;
  const warningCount = findings.filter((finding) => finding.severity === "WARNING").length;
  return {
    status: errorCount > 0 ? "failed" : "passed",
    errorCount,
    warningCount,
    findings,
  };
}

function formatHuman(result) {
  if (!result.findings.length) {
    return `BaseBrief artifact check passed.${os.EOL}`;
  }
  const lines = [
    `BaseBrief artifact check ${result.status}.`,
    `errors=${result.errorCount}`,
    `warnings=${result.warningCount}`,
  ];
  for (const finding of result.findings) {
    lines.push(`${finding.severity} ${finding.ruleId} ${finding.file}:${finding.line} ${finding.message}`);
  }
  return `${lines.join(os.EOL)}${os.EOL}`;
}

function cli() {
  const options = parseArgs(process.argv);
  const result = checkArtifacts(options);
  if (options.jsonMode) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(formatHuman(result));
  }
  if (result.errorCount > 0) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  try {
    cli();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  checkArtifacts,
  formatHuman,
  listInputFiles,
  scanContent,
};
