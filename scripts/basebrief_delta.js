#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const {
  readRepositoryState,
  resolveRepository,
} = require("./basebrief_receiver_check");
const {
  PROJECT_STATE_SCHEMA_VERSION,
  statePathForRepo,
  validateProjectStateObject,
} = require("./basebrief_project_state");
const {
  createSealFromInput,
  diffSeals,
  isSeal,
} = require("./basebrief_seal");

const DELTA_BASELINE_SCHEMA_VERSION = "basebrief-delta-baseline-v1";
const DELTA_HANDOFF_SCHEMA_VERSION = "basebrief-delta-handoff-v1";
const DELTA_BASELINE_FILE = "delta-baseline.json";
const DEFAULT_DELTA_FILE = "delta-handoff.md";

function normalizeSlash(value) {
  return value.replace(/\\/g, "/");
}

function git(repoRoot, args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(result.error ? result.error.message : result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}

function readJsonFile(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON`);
  }
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

function baselinePathForRepo(repoRoot) {
  return path.join(repoRoot, ".basebrief", DELTA_BASELINE_FILE);
}

function loadProjectState(repoRoot) {
  const inputPath = statePathForRepo(repoRoot);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`project-state does not exist: ${inputPath}`);
  }
  const state = readJsonFile(inputPath, "project-state");
  const errors = validateProjectStateObject(state);
  if (errors.length) {
    throw new Error(`project-state validation failed: ${errors.join("; ")}`);
  }
  return { inputPath, state };
}

function validateBaselineObject(baseline) {
  const errors = [];
  if (!baseline || typeof baseline !== "object" || Array.isArray(baseline)) {
    return ["delta-baseline must be a JSON object"];
  }
  if (baseline.schemaVersion !== DELTA_BASELINE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${DELTA_BASELINE_SCHEMA_VERSION}`);
  }
  if (!baseline.repo || typeof baseline.repo !== "object") {
    errors.push("repo must be an object");
  } else {
    if (typeof baseline.repo.branch !== "string") errors.push("repo.branch must be a string");
    if (typeof baseline.repo.head !== "string" || !baseline.repo.head) errors.push("repo.head must be a non-empty string");
  }
  if (!baseline.state || typeof baseline.state !== "object") {
    errors.push("state must be an object");
  } else {
    if (typeof baseline.state.updated_at !== "string" || !baseline.state.updated_at) {
      errors.push("state.updated_at must be a non-empty string");
    }
    if (baseline.state.seal && !isSeal(baseline.state.seal)) {
      errors.push("state.seal must be a BaseBrief seal when present");
    }
  }
  if (typeof baseline.last_delta_at !== "string" || !baseline.last_delta_at) {
    errors.push("last_delta_at must be a non-empty string");
  }
  return errors;
}

function readDeltaBaseline(repoRoot) {
  const inputPath = baselinePathForRepo(repoRoot);
  if (!fs.existsSync(inputPath)) {
    return { inputPath, exists: false, baseline: null };
  }
  const baseline = readJsonFile(inputPath, "delta-baseline");
  const errors = validateBaselineObject(baseline);
  if (errors.length) {
    throw new Error(`delta-baseline validation failed: ${errors.join("; ")}`);
  }
  return { inputPath, exists: true, baseline };
}

function sectionToItems(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, ""))
    .filter(Boolean);
}

function stateToSealInput(repoRoot, state) {
  const handoff = state.handoff || {};
  return {
    mode: "full",
    provider_profile: "unknown",
    project_identity: `BaseBrief project state for ${path.basename(repoRoot)}`,
    current_goal: handoff.current_goal,
    verified_facts: sectionToItems(handoff.verified_facts),
    confirmed_decisions: sectionToItems(handoff.confirmed_decisions),
    assumptions: [],
    open_questions: sectionToItems(handoff.open_questions),
    risk_boundaries: sectionToItems(handoff.risk_boundaries),
    forbidden_scope: Array.isArray(state.non_goals) ? state.non_goals : [],
    expected_output: handoff.receiver_entry_task,
    tail_request: handoff.receiver_entry_task,
    audience: "coding agent receiver window",
  };
}

function collectGitFacts(repoRoot, since) {
  if (!since) {
    return {
      since: "",
      range: "no-baseline..HEAD",
      commits: [],
      changedFilesInRange: [],
    };
  }
  git(repoRoot, ["rev-parse", "--verify", `${since}^{commit}`]);
  const logOutput = git(repoRoot, ["log", "--oneline", "--no-decorate", `${since}..HEAD`]);
  const diffOutput = git(repoRoot, ["diff", "--name-only", `${since}..HEAD`]);
  return {
    since,
    range: `${since}..HEAD`,
    commits: logOutput ? logOutput.split(/\r?\n/) : [],
    changedFilesInRange: diffOutput
      ? diffOutput.split(/\r?\n/).map(normalizeSlash).filter(Boolean).sort()
      : [],
  };
}

function formatItems(items, emptyText = "none") {
  if (!items || items.length === 0) return `- ${emptyText}`;
  return items.map((item) => `- ${item}`).join(os.EOL);
}

function formatFieldDiff(field, diff) {
  if (!diff) return [];
  if ("changed" in diff) {
    if (!diff.changed) return [];
    return [`- ${field}: changed`];
  }
  const lines = [];
  if (diff.added.length) lines.push(`- ${field}.added: ${diff.added.length}`);
  if (diff.removed.length) lines.push(`- ${field}.removed: ${diff.removed.length}`);
  return lines;
}

function renderDeltaHandoff({ repoState, state, baselineInfo, gitFacts, stateDiff }) {
  const handoff = state.handoff;
  const baseline = baselineInfo.baseline;
  const stateDiffStatus = stateDiff ? (stateDiff.changed ? "changed" : "unchanged") : "no_previous_baseline";
  const stateDiffLines = stateDiff
    ? Object.entries(stateDiff.fields).flatMap(([field, diff]) => formatFieldDiff(field, diff))
    : [];

  return [
    "# BaseBrief Delta Handoff",
    "",
    `schemaVersion: ${DELTA_HANDOFF_SCHEMA_VERSION}`,
    `projectStateSchemaVersion: ${PROJECT_STATE_SCHEMA_VERSION}`,
    `generated_at: ${new Date().toISOString()}`,
    "",
    "## Review Status",
    "",
    "- reviewed: current project state fields copied from `.basebrief/state.json`",
    "- needs-review: git range facts, changed-file facts, and generated state diff summary",
    "",
    "## How To Read This Delta",
    "",
    "- `reviewed` sections come from the current reviewed Project State.",
    "- `needs-review` sections are generated from git facts, worktree facts, and Seal/Diff state summaries.",
    "- `baseline_source: missing` is normal for a first delta run before `.basebrief/delta-baseline.json` exists.",
    "- `no-baseline..HEAD` is a human-readable first-run sentinel, not a git revision range.",
    "- `commits_in_range: 0` does not mean the worktree is clean; check `Worktree Changed Files` too.",
    "- `stateDiff.status: unchanged` means reviewed Project State matches the delta baseline; it does not mean git or worktree content is unchanged.",
    "",
    "## Current Goal",
    "",
    "review_status=reviewed",
    "",
    handoff.current_goal,
    "",
    "## Git Range Facts",
    "",
    "review_status=needs-review",
    "",
    `- branch: ${repoState.branch}`,
    `- head: ${repoState.head}`,
    `- baseline_source: ${baseline ? ".basebrief/delta-baseline.json" : "missing"}`,
    `- range: ${gitFacts.range}`,
    `- commits_in_range: ${gitFacts.commits.length}`,
    "",
    "### Commits",
    "",
    formatItems(gitFacts.commits, "none"),
    "",
    "### Changed Files In Range",
    "",
    formatItems(gitFacts.changedFilesInRange, "none"),
    "",
    "### Worktree Changed Files",
    "",
    formatItems(repoState.changedFiles, "none"),
    "",
    "## State Diff",
    "",
    "review_status=needs-review",
    "",
    `- status: ${stateDiffStatus}`,
    `- changed_fields: ${stateDiff ? stateDiff.changedFields.join(",") || "none" : "none"}`,
    `- task_boundary_changed: ${stateDiff ? stateDiff.summary.taskBoundaryChanged : "unknown"}`,
    "",
    stateDiffLines.length ? stateDiffLines.join(os.EOL) : "- no state-level field changes available",
    "",
    "## Verified Facts",
    "",
    "review_status=reviewed",
    "",
    handoff.verified_facts,
    "",
    "## Confirmed Decisions",
    "",
    "review_status=reviewed",
    "",
    handoff.confirmed_decisions,
    "",
    "## Risk Boundaries",
    "",
    "review_status=reviewed",
    "",
    handoff.risk_boundaries,
    "",
    "## Open Questions",
    "",
    "review_status=reviewed",
    "",
    handoff.open_questions,
    "",
    "## Receiver Entry Task",
    "",
    "review_status=reviewed",
    "",
    handoff.receiver_entry_task,
    "",
  ].join(os.EOL);
}

function buildBaseline({ repoState, state, seal, generatedAt }) {
  return {
    schemaVersion: DELTA_BASELINE_SCHEMA_VERSION,
    repo: {
      branch: repoState.branch,
      head: repoState.head,
    },
    state: {
      updated_at: state.updated_at,
      seal,
    },
    last_delta_at: generatedAt,
  };
}

function runDelta(options) {
  if (!options.repoPath) throw new Error("Missing --repo <target-repo>");
  if (!options.outputDir) throw new Error("Missing --output-dir <dir>");
  const repoRoot = resolveRepository(options.repoPath);
  const outputDir = path.resolve(options.outputDir);
  const outputPath = path.join(outputDir, DEFAULT_DELTA_FILE);
  const repoState = readRepositoryState(repoRoot);
  const { inputPath: stateInput, state } = loadProjectState(repoRoot);
  const baselineInfo = readDeltaBaseline(repoRoot);
  const since = options.since || (baselineInfo.baseline && baselineInfo.baseline.repo.head) || "";
  const gitFacts = collectGitFacts(repoRoot, since);
  const currentSeal = createSealFromInput(stateToSealInput(repoRoot, state));
  const previousSeal = baselineInfo.baseline && baselineInfo.baseline.state.seal;
  const stateDiff = previousSeal ? diffSeals(previousSeal, currentSeal) : null;
  const content = renderDeltaHandoff({
    repoState,
    state,
    baselineInfo,
    gitFacts,
    stateDiff,
  });
  writeText(outputPath, content);

  const generatedAt = new Date().toISOString();
  let baselineOutput = "";
  if (options.advanceBaseline) {
    baselineOutput = baselinePathForRepo(repoRoot);
    writeText(baselineOutput, `${JSON.stringify(buildBaseline({
      repoState,
      state,
      seal: currentSeal,
      generatedAt,
    }), null, 2)}\n`);
  }

  return {
    command: "delta",
    schemaVersion: DELTA_HANDOFF_SCHEMA_VERSION,
    baselineSchemaVersion: DELTA_BASELINE_SCHEMA_VERSION,
    repo: repoRoot,
    outputDir,
    outputFiles: {
      deltaHandoff: outputPath,
    },
    baseline: {
      input: baselineInfo.inputPath,
      exists: baselineInfo.exists,
      advanced: Boolean(options.advanceBaseline),
      output: baselineOutput,
    },
    projectState: {
      input: stateInput,
      schemaVersion: state.schemaVersion,
      updated_at: state.updated_at,
    },
    git: {
      branch: repoState.branch,
      head: repoState.head,
      since,
      range: gitFacts.range,
      commitCount: gitFacts.commits.length,
      changedFilesInRange: gitFacts.changedFilesInRange,
      worktreeChangedFiles: repoState.changedFiles,
    },
    stateDiff: {
      status: stateDiff ? (stateDiff.changed ? "changed" : "unchanged") : "no_previous_baseline",
      changedFields: stateDiff ? stateDiff.changedFields : [],
      taskBoundaryChanged: stateDiff ? stateDiff.summary.taskBoundaryChanged : null,
    },
  };
}

module.exports = {
  DEFAULT_DELTA_FILE,
  DELTA_BASELINE_FILE,
  DELTA_BASELINE_SCHEMA_VERSION,
  DELTA_HANDOFF_SCHEMA_VERSION,
  baselinePathForRepo,
  buildBaseline,
  collectGitFacts,
  readDeltaBaseline,
  renderDeltaHandoff,
  runDelta,
  stateToSealInput,
  validateBaselineObject,
};
