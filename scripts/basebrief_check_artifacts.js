#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");

const SCANNED_EXTENSIONS = new Set([".md", ".json", ".txt"]);
const SKIPPED_DIRS = new Set([".git", "node_modules", "dist", ".cache", "coverage", "private"]);

const SECRET_PATTERNS = [
  { ruleId: "secret.sk", pattern: /\bsk-[A-Za-z0-9]{10,}/ },
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

const RECEIVER_RESULT_SCHEMA_VERSION = "basebrief-receiver-check-result-v1";
const DELTA_MARKDOWN_MACHINE_FIELDS = [
  "receiver_task_status",
  "repository_state_status",
  "handoff_acceptance",
];
const DELTA_MARKDOWN_REPORT_SECTIONS = [
  "blocking_or_repair_notes",
  "current_goal",
  "live_repo_state",
  "inherited_fact_differences",
  "hard_boundaries",
  "next_narrow_slice",
];
const STARTER_MARKDOWN_MACHINE_FIELDS = [
  "receiver_task_status",
  "repository_state_status",
  "declared_checks_status",
  "handoff_acceptance",
];
const STARTER_MARKDOWN_REPORT_SECTIONS = [
  "current_goal",
  "receiver_entry_task",
  "risk_boundaries",
  "inherited_fact_differences",
  "hard_boundaries",
  "next_narrow_slice",
];
const STARTER_FACT_LAYERS = [
  "source_window_inherited_facts",
  "live_repo_state",
  "receiver_window_rechecks",
];
const CONTEXT_PACK_FILES = [
  "MANIFEST.md",
  "REPO_MAP.md",
  "KEY_FILES.md",
  "RECENT_DELTA.md",
  "RISK_BOUNDARIES.md",
  "RECEIVER_STATE.md",
  "NEXT_WINDOW_STARTER.md",
];
const CONTEXT_PACK_METADATA_FIELDS = [
  "Review status",
  "Source",
  "Trust",
  "Stale",
];
const CONTEXT_PACK_REVIEW_STATUSES = new Set([
  "reviewed",
  "needs-review",
  "generated",
  "not_available",
  "not_applicable",
  "stale",
]);
const CONTEXT_PACK_TRUST_VALUES = new Set(["high", "medium", "low"]);
const CONTEXT_PACK_SINGLE_FILE_CHAR_LIMIT = 20000;
const CONTEXT_PACK_TOTAL_CHAR_LIMIT = 80000;

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

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function hasLabeledField(content, label) {
  const pattern = new RegExp("^\\s*`?" + escapeRegex(label) + "`?\\s*:", "m");
  return pattern.test(content);
}

function findLabeledFieldIndex(content, label) {
  const pattern = new RegExp("^\\s*`?" + escapeRegex(label) + "`?\\s*:", "m");
  const match = pattern.exec(content);
  return match ? match.index : -1;
}

function getLabeledFieldValue(content, label) {
  const pattern = new RegExp("^\\s*`?" + escapeRegex(label) + "`?\\s*:\\s*(.*?)\\s*$", "m");
  const match = pattern.exec(content);
  return match ? match[1].trim() : "";
}

function getMarkdownTitle(content) {
  const match = /^#\s+(.+)$/m.exec(content);
  return match ? match[1] : "";
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

function parseJsonIfPossible(filePath, content) {
  if (path.extname(filePath).toLowerCase() !== ".json") {
    return null;
  }
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function isReceiverResultArtifact(filePath, content, parsedJson) {
  return !!parsedJson && parsedJson.schemaVersion === RECEIVER_RESULT_SCHEMA_VERSION;
}

function looksLikeReceiverMarkdown(filePath, content) {
  if (path.extname(filePath).toLowerCase() !== ".md") {
    return false;
  }

  const normalizedPath = normalizeSlash(filePath).toLowerCase();
  const hasCoreFields = hasLabeledField(content, "receiver_task_status") &&
    hasLabeledField(content, "repository_state_status") &&
    hasLabeledField(content, "handoff_acceptance");
  if (!hasCoreFields) {
    return false;
  }

  const title = getMarkdownTitle(content);
  const receiverPathHint = /(?:^|\/)(?:receiver|golden-path)\//.test(normalizedPath);
  const explicitReportHint =
    /Delta Receiver Report Example/i.test(title) ||
    /Receiver First Response/i.test(title) ||
    /Starter Report Outline/i.test(title) ||
    /Receiver Language Routing Report/i.test(title) ||
    /receiver-report|starter-report/i.test(path.basename(filePath));

  return receiverPathHint && explicitReportHint;
}

function isStarterStyleReceiverMarkdown(filePath, content) {
  if (!looksLikeReceiverMarkdown(filePath, content)) {
    return false;
  }

  const hasStarterMachineShape = hasLabeledField(content, "declared_checks_status");
  const hasStarterAnchor = hasLabeledField(content, "receiver_entry_task") ||
    hasLabeledField(content, "risk_boundaries") ||
    hasLabeledField(content, "source_window_inherited_facts") ||
    hasLabeledField(content, "receiver_window_rechecks") ||
    hasLabeledField(content, "actual_handoff_friction");

  return hasStarterMachineShape && hasStarterAnchor;
}

function isDeltaStyleReceiverMarkdown(filePath, content) {
  if (!looksLikeReceiverMarkdown(filePath, content) || isStarterStyleReceiverMarkdown(filePath, content)) {
    return false;
  }

  return DELTA_MARKDOWN_MACHINE_FIELDS.every((field) => hasLabeledField(content, field));
}

function hasHumanPassFailAnchor(content) {
  return /pass\/fail/i.test(content) || /`pass`\s+or\s+`fail`/i.test(content);
}

function hasDifferenceSemantics(content) {
  return /difference_found[\s\S]{0,240}(?:does not mean the agent failed|not an? (?:agent )?(?:execution )?failure|completed (?:receiver|verification|entry verification)|不等于 Agent 执行失败|核验已完成|正确完成并准确报告差异)/i.test(content);
}

function hasHistoricalDriftSemantics(content) {
  return /historical\s+`?commits_in_range`?\s+drift[\s\S]{0,240}(?:non-blocking|not_applicable|不应误判为 blocking|应按 non-blocking)/i.test(content);
}

function addMissingMachineFields(findings, displayPath, content, fields) {
  for (const field of fields) {
    if (!hasLabeledField(content, field)) {
      addFinding(findings, "ERROR", "receiver.missing-machine-field", displayPath, 1, `Receiver artifact is missing machine field: ${field}.`);
    }
  }
}

function addMissingReportSections(findings, displayPath, content, fields) {
  for (const field of fields) {
    if (!hasLabeledField(content, field)) {
      addFinding(findings, "ERROR", "receiver.missing-report-section", displayPath, 1, `Receiver artifact is missing report section: ${field}.`);
    }
  }
}

function addMissingFactLayers(findings, displayPath, content, fields) {
  for (const field of fields) {
    if (!hasLabeledField(content, field)) {
      addFinding(findings, "ERROR", "receiver.missing-fact-layer", displayPath, 1, `Receiver artifact is missing fact layer: ${field}.`);
    }
  }
}

function addReceiverMarkdownWarnings(findings, displayPath, content) {
  if (content.includes("difference_found") && !hasDifferenceSemantics(content)) {
    const index = content.indexOf("difference_found");
    addFinding(findings, "WARNING", "receiver.missing-difference-semantics", displayPath, lineNumberForIndex(content, index), "Receiver artifact mentions difference_found without explaining that it is a completed verification result, not an agent failure.");
  }

  if (/historical\s+`?commits_in_range`?\s+drift/i.test(content) && !hasHistoricalDriftSemantics(content)) {
    const match = /historical\s+`?commits_in_range`?\s+drift/i.exec(content);
    addFinding(findings, "WARNING", "receiver.missing-drift-semantics", displayPath, lineNumberForIndex(content, match ? match.index : 0), "Receiver artifact mentions historical commits_in_range drift without a non-blocking explanation.");
  }
}

function scanReceiverResultJson(findings, displayPath, parsedJson) {
  for (const field of STARTER_MARKDOWN_MACHINE_FIELDS) {
    if (!(field in parsedJson)) {
      addFinding(findings, "ERROR", "receiver.missing-machine-field", displayPath, 1, `Receiver result JSON is missing machine field: ${field}.`);
    }
  }

  if (!("handoff_acceptance" in parsedJson) || !("receiver_task_status" in parsedJson) || !("repository_state_status" in parsedJson)) {
    return;
  }

  if (parsedJson.handoff_acceptance === "blocked" && parsedJson.receiver_task_status !== "blocked") {
    addFinding(findings, "ERROR", "receiver.invalid-result-consistency", displayPath, 1, "Receiver result JSON with handoff_acceptance=blocked must set receiver_task_status=blocked.");
  }

  if (parsedJson.handoff_acceptance !== "blocked" && parsedJson.receiver_task_status !== "completed") {
    addFinding(findings, "ERROR", "receiver.invalid-result-consistency", displayPath, 1, "Receiver result JSON with non-blocked handoff_acceptance must set receiver_task_status=completed.");
  }

  if (parsedJson.repository_state_status === "not_applicable" && parsedJson.handoff_acceptance !== "blocked") {
    addFinding(findings, "ERROR", "receiver.invalid-result-consistency", displayPath, 1, "repository_state_status=not_applicable is only valid for blocked receiver results.");
  }
}

function scanStarterStyleReceiverMarkdown(findings, displayPath, content) {
  addMissingMachineFields(findings, displayPath, content, STARTER_MARKDOWN_MACHINE_FIELDS);
  addMissingReportSections(findings, displayPath, content, STARTER_MARKDOWN_REPORT_SECTIONS);
  addMissingFactLayers(findings, displayPath, content, STARTER_FACT_LAYERS);

  if (!hasHumanPassFailAnchor(content)) {
    addFinding(findings, "ERROR", "receiver.missing-human-anchor", displayPath, 1, "Starter-style receiver report must preserve a human pass/fail anchor.");
  }

  if (!/wait for user confirmation/i.test(content)) {
    addFinding(findings, "ERROR", "receiver.missing-human-anchor", displayPath, 1, "Starter-style receiver report must preserve wait for user confirmation.");
  }

  addReceiverMarkdownWarnings(findings, displayPath, content);
}

function scanDeltaStyleReceiverMarkdown(findings, displayPath, content) {
  addMissingMachineFields(findings, displayPath, content, DELTA_MARKDOWN_MACHINE_FIELDS);
  addMissingReportSections(findings, displayPath, content, DELTA_MARKDOWN_REPORT_SECTIONS);
  addReceiverMarkdownWarnings(findings, displayPath, content);
}

function isContextPackDirectory(inputRoot) {
  if (!inputRoot || !fs.existsSync(inputRoot) || !fs.statSync(inputRoot).isDirectory()) {
    return false;
  }
  const presentFiles = CONTEXT_PACK_FILES.filter((fileName) => fs.existsSync(path.join(inputRoot, fileName)));
  return presentFiles.includes("MANIFEST.md") && presentFiles.length >= 3;
}

function addContextPackFinding(findings, severity, ruleId, file, content, fallbackLine, message) {
  addFinding(findings, severity, ruleId, file, fallbackLine, message);
}

function scanContextPackMetadata(findings, fileName, content) {
  for (const field of CONTEXT_PACK_METADATA_FIELDS) {
    if (!hasLabeledField(content, field)) {
      addContextPackFinding(
        findings,
        "ERROR",
        "context-pack.missing-metadata",
        fileName,
        content,
        1,
        `Context Pack artifact is missing metadata field: ${field}.`,
      );
    }
  }

  const reviewStatus = getLabeledFieldValue(content, "Review status").toLowerCase();
  if (reviewStatus && !CONTEXT_PACK_REVIEW_STATUSES.has(reviewStatus)) {
    addContextPackFinding(
      findings,
      "ERROR",
      "context-pack.invalid-metadata",
      fileName,
      content,
      lineNumberForIndex(content, findLabeledFieldIndex(content, "Review status")),
      `Context Pack artifact has invalid Review status: ${reviewStatus}.`,
    );
  }

  const trust = getLabeledFieldValue(content, "Trust").toLowerCase();
  if (trust && !CONTEXT_PACK_TRUST_VALUES.has(trust)) {
    addContextPackFinding(
      findings,
      "ERROR",
      "context-pack.invalid-metadata",
      fileName,
      content,
      lineNumberForIndex(content, findLabeledFieldIndex(content, "Trust")),
      `Context Pack artifact has invalid Trust value: ${trust}.`,
    );
  }

  const stale = getLabeledFieldValue(content, "Stale").toLowerCase();
  if (stale && stale !== "true" && stale !== "false") {
    addContextPackFinding(
      findings,
      "ERROR",
      "context-pack.invalid-metadata",
      fileName,
      content,
      lineNumberForIndex(content, findLabeledFieldIndex(content, "Stale")),
      `Context Pack artifact has invalid Stale value: ${stale}.`,
    );
  }
}

function scanContextPackManifest(findings, content) {
  const required = [
    { label: "branch", pattern: /\bBranch\s*:/i },
    { label: "HEAD", pattern: /\bHEAD\s*:/ },
    { label: "worktree status", pattern: /\bWorktree status\s*:/i },
    { label: "reading order", pattern: /Reading Order/i },
    { label: "safety notes", pattern: /Safety Notes/i },
  ];

  for (const item of required) {
    if (!item.pattern.test(content)) {
      addFinding(
        findings,
        "ERROR",
        "context-pack.missing-manifest-field",
        "MANIFEST.md",
        1,
        `Context Pack manifest is missing ${item.label}.`,
      );
    }
  }
}

function scanContextPackRiskBoundaries(findings, content) {
  const required = [
    { label: "no provider request", pattern: /No provider request/i },
    { label: "no runtime integration", pattern: /No runtime integration/i },
    {
      label: "no plugin/MCP/IDE/hosted/cloud-memory",
      pattern: /No plugin[\s\S]{0,160}MCP[\s\S]{0,160}IDE[\s\S]{0,160}hosted[\s\S]{0,160}cloud-memory/i,
    },
    { label: "no schema-v2", pattern: /No schema-v2/i },
    { label: "no repo dump", pattern: /No repo dump/i },
    {
      label: "no secrets/.env/token/credentials",
      pattern: /(?:secret|\.env|API keys?|tokens?|credentials)[\s\S]{0,180}(?:secret|\.env|API keys?|tokens?|credentials)/i,
    },
  ];

  for (const item of required) {
    if (!item.pattern.test(content)) {
      addFinding(
        findings,
        "ERROR",
        "context-pack.missing-risk-boundary",
        "RISK_BOUNDARIES.md",
        1,
        `Context Pack risk boundaries are missing ${item.label}.`,
      );
    }
  }
}

function scanContextPackReceiverState(findings, content) {
  if (!/\b(?:not_available|not_applicable|needs-review)\b/.test(content)) {
    addFinding(
      findings,
      "ERROR",
      "context-pack.missing-receiver-state-semantics",
      "RECEIVER_STATE.md",
      1,
      "Context Pack receiver state must expose not_available, not_applicable, or needs-review semantics.",
    );
  }
}

function scanContextPackStarter(findings, content) {
  const required = [
    {
      label: "live repo fact recheck",
      pattern: /recheck (?:the )?live (?:repository|repo) facts?|live repo fact recheck/i,
    },
    {
      label: "reading order",
      pattern: /Start by reading|Reading Order|read[\s\S]{0,120}MANIFEST\.md[\s\S]{0,240}RECENT_DELTA\.md/i,
    },
    {
      label: "report gaps before edits",
      pattern: /(?:report|list)[\s\S]{0,80}gaps[\s\S]{0,80}before/i,
    },
    {
      label: "do not continue historical or frozen lines unless explicitly asked",
      pattern: /historical release slices[\s\S]{0,140}frozen lines[\s\S]{0,140}unless explicitly asked|frozen v1\.x[\s\S]{0,140}unless explicitly (?:asked|reopened)|Do not continue the frozen v1\.x/i,
    },
  ];

  for (const item of required) {
    if (!item.pattern.test(content)) {
      addFinding(
        findings,
        "ERROR",
        "context-pack.missing-starter-instruction",
        "NEXT_WINDOW_STARTER.md",
        1,
        `Context Pack starter is missing instruction: ${item.label}.`,
      );
    }
  }
}

function scanContextPackDirectory(inputRoot) {
  const findings = [];
  let totalChars = 0;

  for (const fileName of CONTEXT_PACK_FILES) {
    const fullPath = path.join(inputRoot, fileName);
    if (!fs.existsSync(fullPath)) {
      addFinding(
        findings,
        "ERROR",
        "context-pack.missing-file",
        fileName,
        1,
        `Context Pack directory is missing required file: ${fileName}.`,
      );
      continue;
    }

    const content = fs.readFileSync(fullPath, "utf8");
    totalChars += content.length;
    scanContextPackMetadata(findings, fileName, content);
    if (content.length > CONTEXT_PACK_SINGLE_FILE_CHAR_LIMIT) {
      addFinding(
        findings,
        "WARNING",
        "context-pack.too-thick",
        fileName,
        1,
        `Context Pack artifact exceeds ${CONTEXT_PACK_SINGLE_FILE_CHAR_LIMIT} characters.`,
      );
    }

    if (fileName === "MANIFEST.md") scanContextPackManifest(findings, content);
    if (fileName === "RISK_BOUNDARIES.md") scanContextPackRiskBoundaries(findings, content);
    if (fileName === "RECEIVER_STATE.md") scanContextPackReceiverState(findings, content);
    if (fileName === "NEXT_WINDOW_STARTER.md") scanContextPackStarter(findings, content);
  }

  if (totalChars > CONTEXT_PACK_TOTAL_CHAR_LIMIT) {
    addFinding(
      findings,
      "WARNING",
      "context-pack.too-thick",
      ".",
      1,
      `Context Pack directory exceeds ${CONTEXT_PACK_TOTAL_CHAR_LIMIT} total characters.`,
    );
  }

  return findings;
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
  const parsedJson = parseJsonIfPossible(filePath, content);

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

  if (isReceiverResultArtifact(filePath, content, parsedJson)) {
    scanReceiverResultJson(findings, displayPath, parsedJson);
  } else if (isStarterStyleReceiverMarkdown(filePath, content)) {
    scanStarterStyleReceiverMarkdown(findings, displayPath, content);
  } else if (isDeltaStyleReceiverMarkdown(filePath, content)) {
    scanDeltaStyleReceiverMarkdown(findings, displayPath, content);
  }

  return findings;
}

function checkArtifacts(options) {
  const inputPath = options.inputPath || "";
  const inputRoot = inputPath ? path.resolve(inputPath) : "";
  const inputFiles = listInputFiles(inputPath);
  const baseDir = fs.existsSync(inputRoot) && fs.statSync(inputRoot).isDirectory() ? inputRoot : path.dirname(inputRoot);
  const findings = [];

  if (isContextPackDirectory(inputRoot)) {
    findings.push(...scanContextPackDirectory(inputRoot));
  }

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
