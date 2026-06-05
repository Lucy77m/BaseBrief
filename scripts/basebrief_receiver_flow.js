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
const EXTRACT_OUTPUT_FILES = ["flow-summary.json", "receiver-check.json", "draft-context.md", "extract-candidates.json"];
const GUIDED_FIELDS = [
  {
    key: "current_goal",
    label: "current_goal",
    prompt: "[1/6] Current goal, in one or two sentences:",
  },
  {
    key: "verified_facts",
    label: "verified_facts",
    prompt: "[2/6] Verified facts from this phase:",
  },
  {
    key: "confirmed_decisions",
    label: "confirmed_decisions",
    prompt: "[3/6] Confirmed decisions from this phase:",
  },
  {
    key: "risk_boundaries",
    label: "risk_boundaries",
    prompt: "[4/6] Risk boundaries or forbidden actions:",
  },
  {
    key: "receiver_entry_task",
    label: "receiver_entry_task",
    prompt: "[5/6] First task the receiver should start with:",
  },
  {
    key: "open_questions",
    label: "open_questions",
    prompt: "[6/6] Open questions not yet resolved:",
  },
];

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

function assertNonSensitiveInputPath(inputPath, label) {
  const segments = normalizeSlash(inputPath).split("/").filter(Boolean).map((segment) => segment.toLowerCase());
  if (segments.includes(".git")) throw new Error(`${label} must not be read from .git`);
  if (segments.some((segment) => segment === ".env" || segment.startsWith(".env."))) {
    throw new Error(`${label} must not be read from an .env path`);
  }
}

function resolveExtractSource(sourcePath) {
  if (!sourcePath) throw new Error("receiver-flow --extract requires --source <draft-or-context.md>");
  const resolved = path.resolve(sourcePath);
  assertNonSensitiveInputPath(resolved, "receiver-flow extract source");
  if (!fs.existsSync(resolved)) throw new Error(`receiver-flow extract source does not exist: ${resolved}`);
  if (!fs.statSync(resolved).isFile()) throw new Error("receiver-flow extract source must be a file");
  if (path.extname(resolved).toLowerCase() !== ".md") {
    throw new Error("receiver-flow extract source must be a Markdown file");
  }
  return fs.realpathSync(resolved);
}

function resolveOutputDir(repoRoot, outputDir, outputFileNames = FLOW_OUTPUT_FILES) {
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
    outputFileNames.map((fileName) => [fileName, path.join(realOutputDir, fileName)]),
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
  for (const fileName of outputFileNames) {
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

function normalizeCandidateValue(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "[NEEDS_REVIEW]";
  return `[CANDIDATE] ${trimmed}`;
}

function extractCandidateFields({ sourcePath, content }) {
  const sourceFile = path.basename(sourcePath);
  return GUIDED_FIELDS.map((field) => {
    const extracted = extractMarkdownSection(content, field.key);
    return {
      field: field.key,
      status: extracted ? "candidate" : "needs_review",
      value: normalizeCandidateValue(extracted),
      source: {
        file: sourceFile,
        heading: extracted ? field.key : "not_found",
      },
      review_required: true,
    };
  });
}

function buildExtractCandidateSummary({ generatedAt, sourcePath, candidates }) {
  return {
    schemaVersion: "basebrief-receiver-flow-extract-v1",
    command: "receiver-flow",
    mode: "extract",
    handoff_status: "draft_needs_review",
    generated_at: generatedAt,
    source_file: path.basename(sourcePath),
    candidate_fields: candidates,
    review_required: true,
    non_goals: [
      "no_provider_request",
      "no_receiver_thread",
      "no_auto_ready_for_receiver",
      "no_auto_flow",
    ],
  };
}

function normalizeGuidedAnswers(answers = {}) {
  return Object.fromEntries(
    GUIDED_FIELDS.map((field) => {
      const value = String(answers[field.key] || "").trim();
      return [field.key, value || "[EMPTY]"];
    }),
  );
}

function buildReviewChecklist(guidedAnswers) {
  return GUIDED_FIELDS.map((field) => ({
    field: field.key,
    status: "needs_review",
    empty: guidedAnswers[field.key] === "[EMPTY]",
  }));
}

function buildGuidedSections(guidedAnswers) {
  if (!guidedAnswers) return [];
  const checklist = buildReviewChecklist(guidedAnswers);
  const lines = [
    "## Human-Provided Fields",
    "",
    "source: receiver-flow --guided",
    "",
  ];
  for (const field of GUIDED_FIELDS) {
    lines.push(`### ${field.label}`, "", guidedAnswers[field.key], "");
  }
  lines.push("## Review Checklist", "");
  for (const item of checklist) {
    lines.push(`- [ ] ${item.field} reviewed${item.empty ? " [EMPTY]" : ""}`);
  }
  lines.push(
    "",
    "## Guided Safety Notes",
    "",
    "- Human-provided fields still require review.",
    "- This guided draft is not receiver-ready.",
    "- Do not promote this draft to `ready_for_receiver` without a separate review step.",
    "",
  );
  return lines;
}

function buildExtractSections({ sourcePath, candidates }) {
  if (!candidates) return [];
  const lines = [
    "## Extracted Candidate Fields",
    "",
    "source: receiver-flow --extract",
    `source_file: ${path.basename(sourcePath)}`,
    "",
  ];
  for (const candidate of candidates) {
    lines.push(
      `### ${candidate.field}`,
      "",
      candidate.value,
      "",
      `source_heading: ${candidate.source.heading}`,
      "",
    );
  }
  lines.push("## Review Checklist", "");
  for (const candidate of candidates) {
    lines.push(`- [ ] ${candidate.field} reviewed [CANDIDATE]`);
  }
  lines.push(
    "",
    "## Extract Safety Notes",
    "",
    "- Extracted fields are candidates only.",
    "- This extracted draft is not receiver-ready.",
    "- Review and replace candidate markers before `review-draft` can pass.",
    "",
  );
  return lines;
}

function buildDraftContext({
  generatedAt,
  state,
  receiverConfigPath,
  receiverConfig,
  guidedAnswers = null,
  extract = null,
}) {
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
    ...buildGuidedSections(guidedAnswers),
    ...buildExtractSections(extract || {}),
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
  if (options.guided && options.extract) throw new Error("receiver-flow --guided and --extract must be run separately");
  const repoRoot = resolveRepository(options.repoPath);
  const before = readRepositoryState(repoRoot);
  const extractSourcePath = options.extract ? resolveExtractSource(options.sourcePath) : "";
  const extractSourceContent = extractSourcePath ? fs.readFileSync(extractSourcePath, "utf8") : "";
  const outputFileNames = options.extract ? EXTRACT_OUTPUT_FILES : FLOW_OUTPUT_FILES;
  const output = resolveOutputDir(repoRoot, options.outputDir, outputFileNames);
  const receiverConfig = buildReceiverCheckConfig(before, output.gitVisibleFiles[0] ? output.gitVisibleFiles : "");
  const generatedAt = new Date().toISOString();
  const guidedAnswers = options.guided ? normalizeGuidedAnswers(options.guidedAnswers) : null;
  const extractCandidates = options.extract
    ? extractCandidateFields({ sourcePath: extractSourcePath, content: extractSourceContent })
    : null;
  const reviewChecklist = guidedAnswers ? buildReviewChecklist(guidedAnswers) : [];
  const outputFilesPublic = {
    flowSummary: output.outputFiles["flow-summary.json"],
    receiverCheckConfig: output.outputFiles["receiver-check.json"],
    draftContext: output.outputFiles["draft-context.md"],
  };
  if (options.extract) {
    outputFilesPublic.extractCandidates = output.outputFiles["extract-candidates.json"];
  }
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
      extractCandidates: options.extract ? "extract-candidates.json" : undefined,
    },
    guided: Boolean(guidedAnswers),
    extract: Boolean(extractCandidates),
    extract_source_file: extractSourcePath ? path.basename(extractSourcePath) : undefined,
    human_fields: guidedAnswers || undefined,
    candidate_fields: extractCandidates || undefined,
    review_checklist: reviewChecklist,
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
    if (options.extract) {
      writeJson(
        outputFilesPublic.extractCandidates,
        buildExtractCandidateSummary({ generatedAt, sourcePath: extractSourcePath, candidates: extractCandidates }),
      );
    }
    fs.writeFileSync(
      outputFilesPublic.draftContext,
      buildDraftContext({
        generatedAt,
        state: before,
        receiverConfigPath,
        receiverConfig,
        guidedAnswers,
        extract: extractCandidates ? { sourcePath: extractSourcePath, candidates: extractCandidates } : null,
      }),
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
    guided: Boolean(guidedAnswers),
    extract: Boolean(extractCandidates),
    extract_source: extractSourcePath || undefined,
    human_fields: guidedAnswers || undefined,
    candidate_fields: extractCandidates || undefined,
    review_checklist: reviewChecklist,
    summary,
    receiver_check_config: receiverConfig,
  };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const repoIndex = args.indexOf("--repo");
  const outputDirIndex = args.indexOf("--output-dir");
  const sourceIndex = args.indexOf("--source");
  return {
    repoPath: repoIndex >= 0 ? args[repoIndex + 1] : "",
    outputDir: outputDirIndex >= 0 ? args[outputDirIndex + 1] : "",
    sourcePath: sourceIndex >= 0 ? args[sourceIndex + 1] : "",
    jsonMode: args.includes("--json"),
    guided: args.includes("--guided"),
    extract: args.includes("--extract"),
  };
}

function formatHuman(result) {
  return [
    `BaseBrief receiver flow draft written to ${result.outputDir}`,
    `handoff_status=${result.handoff_status}`,
    `expected_changed_files=${result.receiver_check_config.expected_changed_files.length}`,
    "review_required=true",
    result.extract ? "extract=true" : "",
    "",
  ].filter((line, index, lines) => line || index === lines.length - 1).join(os.EOL);
}

function collectGuidedAnswersFromStdin(inputText) {
  const lines = inputText.split(/\r?\n/);
  if (lines.length < GUIDED_FIELDS.length || GUIDED_FIELDS.some((field, index) => lines[index] === undefined)) {
    throw new Error("receiver-flow --guided requires one input line for each guided field");
  }
  return Object.fromEntries(GUIDED_FIELDS.map((field, index) => [field.key, lines[index] || ""]));
}

function readGuidedInputSync() {
  if (process.stdin.isTTY) {
    process.stderr.write([
      "receiver-flow --guided expects six input lines in this order:",
      ...GUIDED_FIELDS.map((field) => field.prompt),
      "Submit EOF after the final line.",
      "",
    ].join(os.EOL));
  }
  return collectGuidedAnswersFromStdin(fs.readFileSync(0, "utf8"));
}

function cli() {
  try {
    const options = parseArgs(process.argv);
    if (options.guided) options.guidedAnswers = readGuidedInputSync();
    const result = runReceiverFlow(options);
    process.stdout.write(options.jsonMode ? `${JSON.stringify(result, null, 2)}\n` : formatHuman(result));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) cli();

module.exports = {
  EXTRACT_OUTPUT_FILES,
  FLOW_OUTPUT_FILES,
  FLOW_SCHEMA_VERSION,
  GUIDED_FIELDS,
  buildExtractCandidateSummary,
  buildExtractSections,
  buildDraftContext,
  buildReviewChecklist,
  collectGuidedAnswersFromStdin,
  extractCandidateFields,
  extractMarkdownSection,
  formatHuman,
  normalizeGuidedAnswers,
  parseArgs,
  resolveExtractSource,
  resolveOutputDir,
  runReceiverFlow,
};
