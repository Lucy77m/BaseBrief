#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const {
  readRepositoryState,
  resolveRepository,
} = require("./basebrief_receiver_check");
const { statePathForRepo } = require("./basebrief_project_state");
const { baselinePathForRepo } = require("./basebrief_delta");

const CONTEXT_PACK_FILES = {
  manifest: "MANIFEST.md",
  repoMap: "REPO_MAP.md",
  keyFiles: "KEY_FILES.md",
  recentDelta: "RECENT_DELTA.md",
  riskBoundaries: "RISK_BOUNDARIES.md",
  receiverState: "RECEIVER_STATE.md",
  nextWindowStarter: "NEXT_WINDOW_STARTER.md",
};
const CONTEXT_PACK_FILE_KEYS = Object.keys(CONTEXT_PACK_FILES);
const DEFAULT_MAX_FILES = 80;
const DEFAULT_RECENT_COMMITS = 10;

const PUBLIC_ENTRY_CANDIDATES = [
  "README.md",
  "README.en.md",
  "docs/index.md",
  "docs/quickstart-5min.md",
  "docs/releases/v1.9.1.md",
  "docs/testing-v1.x-delta-receiver-closure-matrix.md",
  "docs/roadmap/basebrief-v2-context-pack-lite.md",
  "docs/releases/v2.0.0-plan.md",
  "docs/specs/context-pack-lite.md",
  "docs/receiver-usage-pack.md",
  "docs/golden-path.md",
  "docs/cli-lite.md",
  "docs/specs/delta-handoff.md",
  "scripts/basebrief.js",
  "scripts/basebrief_context_pack.js",
  "scripts/run_release_checks.js",
  "tests/basebrief.test.js",
  "templates/zh-CN/BASEBRIEF.md",
  "templates/zh-CN/BASEBRIEF_LITE.md",
  "templates/zh-CN/NEXT_CHAT_PROMPT.md",
  "examples/minimal/README.md",
  "examples/golden-path/README.md",
  "examples/delta-handoff.md",
];

const RISK_BOUNDARIES = [
  "No provider request.",
  "No AI automatic summary.",
  "No vector database, embedding, or semantic index.",
  "No runtime integration.",
  "No plugin, MCP, IDE, hosted service, or cloud-memory work.",
  "No schema-v2, basebrief-project-state-v2, or basebrief-sidecar-v2.",
  "No repo dump behavior.",
  "No push, tag, release, pull request, npm publish, or global CLI install without explicit approval.",
  "Do not read, write, or expose .env, API keys, tokens, credentials, raw private output, or private notes.",
  "Keep the v1.x Delta Receiver line frozen unless explicitly reopened by the user.",
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

function assertWritableOutputDir(outputDir) {
  assertNonSensitivePath(outputDir, "context-pack output");
  if (!fs.existsSync(outputDir)) return;
  if (!fs.statSync(outputDir).isDirectory()) {
    throw new Error(`context-pack output exists and is not a directory: ${outputDir}`);
  }
  if (fs.readdirSync(outputDir).length > 0) {
    throw new Error(`context-pack output directory already exists and is not empty: ${outputDir}`);
  }
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

function parseMaxFiles(value) {
  if (value === undefined || value === null || value === "") return DEFAULT_MAX_FILES;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("--max-files must be a positive integer");
  }
  return parsed;
}

function repoRelativePath(repoRoot, filePath) {
  return normalizeSlash(path.relative(repoRoot, filePath));
}

function existsFile(repoRoot, relativePath) {
  const resolved = path.join(repoRoot, relativePath);
  return fs.existsSync(resolved) && fs.statSync(resolved).isFile();
}

function candidateRole(relativePath) {
  if (relativePath.startsWith("docs/")) return "public documentation";
  if (relativePath.startsWith("scripts/")) return "local CLI or validation script";
  if (relativePath.startsWith("tests/")) return "independent test coverage";
  if (relativePath.startsWith("templates/")) return "BaseBrief template";
  if (relativePath.startsWith("examples/")) return "public example";
  if (relativePath.startsWith("README")) return "project entry";
  return "public entry";
}

function collectKeyFiles(repoRoot, maxFiles) {
  const existing = [];
  const missing = [];
  for (const relativePath of PUBLIC_ENTRY_CANDIDATES) {
    if (existsFile(repoRoot, relativePath)) {
      existing.push({
        path: relativePath,
        role: candidateRole(relativePath),
        reviewStatus: "generated",
        source: "fixed public-safe candidate list",
      });
    } else {
      missing.push(relativePath);
    }
  }
  return {
    files: existing.slice(0, maxFiles),
    totalCandidates: existing.length,
    truncated: existing.length > maxFiles,
    missing,
  };
}

function collectRepoMap(repoRoot, maxFiles) {
  const preferredDirs = ["skills", "templates", "docs", "examples", "scripts", "schemas", "tests"];
  const layout = [];
  for (const name of preferredDirs) {
    const fullPath = path.join(repoRoot, name);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      layout.push({
        path: `${name}/`,
        role: candidateRole(`${name}/`),
      });
    }
  }
  return {
    layout: layout.slice(0, maxFiles),
    truncated: layout.length > maxFiles,
  };
}

function collectGitFacts(repoRoot, since) {
  let commits = [];
  let changedFilesInRange = [];
  let range = "recent HEAD history";
  if (since) {
    git(repoRoot, ["rev-parse", "--verify", `${since}^{commit}`]);
    range = `${since}..HEAD`;
    const logOutput = git(repoRoot, ["log", "--oneline", "--no-decorate", range]);
    const diffOutput = git(repoRoot, ["diff", "--name-only", range]);
    commits = logOutput ? logOutput.split(/\r?\n/) : [];
    changedFilesInRange = diffOutput ? diffOutput.split(/\r?\n/).map(normalizeSlash).filter(Boolean).sort() : [];
  } else {
    const logOutput = git(repoRoot, ["log", "--oneline", "--no-decorate", `-${DEFAULT_RECENT_COMMITS}`]);
    commits = logOutput ? logOutput.split(/\r?\n/) : [];
  }
  return { since: since || "", range, commits, changedFilesInRange };
}

function metadata(status, source, trust = "medium", stale = false) {
  return [
    `Review status: ${status}`,
    `Source: ${source}`,
    `Trust: ${trust}`,
    `Stale: ${stale ? "true" : "false"}`,
  ].join(os.EOL);
}

function listItems(items, emptyText = "none") {
  if (!items || !items.length) return `- ${emptyText}`;
  return items.map((item) => `- ${item}`).join(os.EOL);
}

function tableRows(rows, emptyText = "| not_available | not_available |") {
  if (!rows || !rows.length) return emptyText;
  return rows.map((row) => `| \`${row.path}\` | ${row.role} |`).join(os.EOL);
}

function renderManifest({ generatedAt, repoRoot, repoState, gitFacts, keyFiles, receiverState }) {
  return [
    "# BaseBrief Context Pack Manifest",
    "",
    metadata("generated", "local git facts and fixed public-safe BaseBrief entry list", "medium", false),
    "",
    "## Pack Identity",
    "",
    `- Project: ${path.basename(repoRoot)}`,
    "- Pack mode: Context Pack Lite",
    `- Generated at: ${generatedAt}`,
    "- Generated by: BaseBrief context-pack",
    "",
    "## Live Repo Facts",
    "",
    `- Repo: ${path.basename(repoRoot)}`,
    `- Branch: ${repoState.branch}`,
    `- HEAD: ${repoState.head}`,
    `- Worktree status: ${repoState.changedFiles.length ? "dirty" : "clean"}`,
    `- Worktree changed files: ${repoState.changedFiles.length}`,
    `- Since commit: ${gitFacts.since || "not_available"}`,
    "",
    "## Input Sources",
    "",
    `- Key files source: fixed public-safe candidate list (${keyFiles.files.length}/${keyFiles.totalCandidates} included)`,
    `- Git range source: ${gitFacts.since ? gitFacts.range : "recent HEAD history"}`,
    `- Project State source: ${receiverState.projectState.exists ? ".basebrief/state.json" : "not_available"}`,
    `- Delta baseline source: ${receiverState.deltaBaseline.exists ? ".basebrief/delta-baseline.json" : "not_available"}`,
    "",
    "## Reading Order",
    "",
    "1. `MANIFEST.md`",
    "2. `RECENT_DELTA.md`",
    "3. `RISK_BOUNDARIES.md`",
    "4. `REPO_MAP.md`",
    "5. `KEY_FILES.md`",
    "6. `RECEIVER_STATE.md`",
    "7. `NEXT_WINDOW_STARTER.md`",
    "",
    "## Safety Notes",
    "",
    "- This pack is local-first and file-based.",
    "- This pack is not a complete proof of repository state.",
    "- `needs-review`, `not_available`, and `not_applicable` sections must be checked before acting.",
    "- No provider request, runtime integration, plugin, MCP, IDE, schema-v2, or repo dump behavior is implied.",
    "",
  ].join(os.EOL);
}

function renderRepoMap({ repoMap }) {
  return [
    "# Repo Map",
    "",
    metadata("generated", "fixed public-safe top-level directory list", "medium", false),
    "",
    "## Top-Level Layout",
    "",
    "| Path | Role |",
    "|---|---|",
    tableRows(repoMap.layout),
    "",
    "## Excluded By Default",
    "",
    "- `.git/`",
    "- `node_modules/`",
    "- `.env` and `.env.*`",
    "- private notes or raw conversation logs",
    "- generated output directories",
    "",
    "## Notes",
    "",
    "- This map is intentionally small.",
    "- Use `KEY_FILES.md` for the first files to inspect.",
    "- This is not a repository dump.",
    "",
  ].join(os.EOL);
}

function renderKeyFiles({ keyFiles }) {
  return [
    "# Key Files",
    "",
    metadata("generated", "fixed public-safe BaseBrief entry list", "medium", false),
    "",
    "## Recommended First Reads",
    "",
    "| Path | Role |",
    "|---|---|",
    tableRows(keyFiles.files),
    "",
    "## Limits",
    "",
    `- included_files: ${keyFiles.files.length}`,
    `- total_public_candidates: ${keyFiles.totalCandidates}`,
    `- truncated: ${keyFiles.truncated}`,
    "",
    "## Missing Expected Inputs",
    "",
    keyFiles.missing.length
      ? listItems(keyFiles.missing.map((item) => `${item}: not_available`))
      : "- none",
    "",
  ].join(os.EOL);
}

function renderRecentDelta({ repoState, gitFacts }) {
  return [
    "# Recent Delta",
    "",
    metadata("needs-review", "git log, git diff, and worktree status", "medium", false),
    "",
    "## Commit Range",
    "",
    `- range: ${gitFacts.range}`,
    `- since: ${gitFacts.since || "not_available"}`,
    `- commits: ${gitFacts.commits.length}`,
    "",
    "## Recent Commits",
    "",
    listItems(gitFacts.commits),
    "",
    "## Changed Files In Range",
    "",
    listItems(gitFacts.changedFilesInRange),
    "",
    "## Worktree Changed Files",
    "",
    listItems(repoState.changedFiles),
    "",
    "## Review Notes",
    "",
    "- Git and worktree facts are generated and need review before acting.",
    "- Historical inherited facts are not refreshed silently by this pack.",
    "- Missing commit range input is `not_available`, not a failure.",
    "",
  ].join(os.EOL);
}

function renderRiskBoundaries() {
  return [
    "# Risk Boundaries",
    "",
    metadata("reviewed", "v2.0-A Context Pack Lite planning baseline", "high", false),
    "",
    "## Do Not Touch",
    "",
    listItems(RISK_BOUNDARIES),
    "",
    "## Requires Explicit User Approval",
    "",
    "- New top-level command beyond `context-pack`.",
    "- New schema, schema-v2, or command output format change.",
    "- Checker rule family changes.",
    "- Push, tag, release, pull request, npm publish, or global CLI install.",
    "",
  ].join(os.EOL);
}

function receiverStateFacts(repoRoot) {
  const projectStatePath = statePathForRepo(repoRoot);
  const deltaBaselinePath = baselinePathForRepo(repoRoot);
  return {
    projectState: {
      path: projectStatePath,
      exists: fs.existsSync(projectStatePath),
    },
    deltaBaseline: {
      path: deltaBaselinePath,
      exists: fs.existsSync(deltaBaselinePath),
    },
  };
}

function renderReceiverState({ receiverState }) {
  const projectStateStatus = receiverState.projectState.exists ? "generated" : "not_available";
  const deltaStatus = receiverState.deltaBaseline.exists ? "generated" : "not_available";
  return [
    "# Receiver State",
    "",
    metadata("needs-review", ".basebrief project-state and delta-baseline presence checks", "medium", false),
    "",
    "## Current Receiver Contract",
    "",
    "- v1.x Delta Receiver line: frozen baseline",
    "- receiver history requirement: not_applicable for repositories without receiver artifacts",
    "",
    "## Acceptance State",
    "",
    `- Project State: ${projectStateStatus}`,
    `- Delta baseline: ${deltaStatus}`,
    "",
    "## Lint State",
    "",
    "- Receiver lint fixtures and repairs remain part of the frozen v1.x baseline.",
    "- Context Pack Check is a later v2.1 line, not part of this generator.",
    "",
    "## Known Receiver Limitations",
    "",
    receiverState.projectState.exists
      ? "- `.basebrief/state.json` exists; inspect it before receiver-side work."
      : "- `.basebrief/state.json`: not_available",
    receiverState.deltaBaseline.exists
      ? "- `.basebrief/delta-baseline.json` exists; inspect it before delta receiver work."
      : "- `.basebrief/delta-baseline.json`: not_available",
    "",
    "## Receiver Next Action",
    "",
    "- Recheck live repo facts before implementation.",
    "- Report `not_available` or `not_applicable` gaps instead of inventing missing history.",
    "- Wait for user confirmation before reopening the frozen v1.x receiver line.",
    "",
  ].join(os.EOL);
}

function renderNextWindowStarter({ repoState }) {
  return [
    "# Next Window Starter",
    "",
    metadata("generated", "Context Pack Lite generator", "medium", false),
    "",
    "You are continuing work from a BaseBrief Context Pack Lite bundle.",
    "",
    "Start by reading:",
    "",
    "1. `MANIFEST.md`",
    "2. `RECENT_DELTA.md`",
    "3. `RISK_BOUNDARIES.md`",
    "4. `REPO_MAP.md`",
    "5. `KEY_FILES.md`",
    "6. `RECEIVER_STATE.md`",
    "",
    "Before editing, recheck the live repository facts:",
    "",
    `- expected_branch_from_pack: ${repoState.branch}`,
    `- expected_head_from_pack: ${repoState.head}`,
    "",
    "Current task:",
    "",
    "- Continue only the user-approved v2.0 Context Pack Lite implementation slice.",
    "- Do not continue the frozen v1.x Delta Receiver line unless explicitly asked.",
    "- No provider request.",
    "- No runtime integration.",
    "- No schema-v2.",
    "- Do not add provider, runtime, plugin, MCP, IDE, hosted, cloud-memory, schema-v2, AI auto-summary, vector, embedding, or repo-dump behavior.",
    "- If an input is missing, report `not_available`, `not_applicable`, or `needs-review`.",
    "",
    "Expected first response:",
    "",
    "- Report live repo facts.",
    "- State whether the pack is understandable enough to continue.",
    "- List any gaps before proposing implementation work.",
    "",
  ].join(os.EOL);
}

function outputFilesForDir(outputDir) {
  return Object.fromEntries(
    Object.entries(CONTEXT_PACK_FILES).map(([key, fileName]) => [key, path.join(outputDir, fileName)]),
  );
}

function writeText(filePath, content) {
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`, { encoding: "utf8", flag: "wx" });
}

function writeContextPackFiles(outputFiles, contents) {
  fs.mkdirSync(path.dirname(outputFiles.manifest), { recursive: true });
  for (const key of CONTEXT_PACK_FILE_KEYS) {
    writeText(outputFiles[key], contents[key]);
  }
}

function buildContextPack(options) {
  if (!options.repoPath) throw new Error("Missing --repo <target-repo>");
  if (!options.outputDir) throw new Error("Missing --output-dir <dir>");
  const repoRoot = resolveRepository(options.repoPath);
  const outputDir = path.resolve(options.outputDir);
  const maxFiles = parseMaxFiles(options.maxFiles);
  assertWritableOutputDir(outputDir);

  const generatedAt = new Date().toISOString();
  const repoState = readRepositoryState(repoRoot);
  const gitFacts = collectGitFacts(repoRoot, options.since || "");
  const keyFiles = collectKeyFiles(repoRoot, maxFiles);
  const repoMap = collectRepoMap(repoRoot, maxFiles);
  const receiverState = receiverStateFacts(repoRoot);
  const outputFiles = outputFilesForDir(outputDir);

  const contents = {
    manifest: renderManifest({ generatedAt, repoRoot, repoState, gitFacts, keyFiles, receiverState }),
    repoMap: renderRepoMap({ repoMap }),
    keyFiles: renderKeyFiles({ keyFiles }),
    recentDelta: renderRecentDelta({ repoState, gitFacts }),
    riskBoundaries: renderRiskBoundaries(),
    receiverState: renderReceiverState({ receiverState }),
    nextWindowStarter: renderNextWindowStarter({ repoState }),
  };
  writeContextPackFiles(outputFiles, contents);

  return {
    command: "context-pack",
    repo: repoRoot,
    outputDir,
    outputFiles,
    git: {
      branch: repoState.branch,
      head: repoState.head,
      worktree_status: repoState.changedFiles.length ? "dirty" : "clean",
      changedFiles: repoState.changedFiles,
      since: gitFacts.since,
      range: gitFacts.range,
      commitCount: gitFacts.commits.length,
    },
    limits: {
      maxFiles,
      includedFiles: keyFiles.files.length,
      totalPublicCandidates: keyFiles.totalCandidates,
      truncated: keyFiles.truncated,
    },
    status: "generated",
  };
}

module.exports = {
  CONTEXT_PACK_FILES,
  DEFAULT_MAX_FILES,
  PUBLIC_ENTRY_CANDIDATES,
  RISK_BOUNDARIES,
  buildContextPack,
  collectGitFacts,
  collectKeyFiles,
  collectRepoMap,
  parseMaxFiles,
};
