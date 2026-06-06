#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");

const { checkArtifacts } = require("./basebrief_check_artifacts");
const { PROJECT_STATE_SCHEMA_VERSION, runStateRead } = require("./basebrief_project_state");

const SIDECAR_SCHEMA_VERSION = "basebrief-sidecar-v1";
const SUPPORTED_TARGETS = new Set(["generic", "openclaw"]);
const SUPPORTED_STARTER_LANGUAGES = new Set(["auto", "zh-CN", "en", "ja"]);
const OUTPUT_FILES = {
  handoff: "handoff.md",
  nextChatPrompt: "next-chat-prompt.md",
  newWindowStarter: "new-window-starter.md",
  receiverEntryTask: "receiver-entry-task.md",
  riskBoundaries: "risk-boundaries.md",
  stateSummary: "state-summary.json",
  manifest: "manifest.json",
};
const REQUIRED_OUTPUT_FILE_KEYS = ["handoff", "nextChatPrompt", "receiverEntryTask", "riskBoundaries", "stateSummary", "manifest"];

const BASE_RISK_BOUNDARIES = [
  "No provider request.",
  "No raw private output.",
  "No runtime integration.",
  "No schema change.",
  "No auto-advance.",
  "Wait for user confirmation before continuing.",
];

const OPENCLAW_RISK_BOUNDARIES = [
  "Do not connect OpenClaw or Hermes runtime.",
  "Do not write OpenClaw or Hermes profile, config, memory, or workspace files.",
];

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

function defaultOutputDir(repoRoot, target) {
  return path.join(repoRoot, ".basebrief", "sidecar", target);
}

function resolveOutputDir(repoRoot, target, outputDir) {
  const resolved = outputDir ? path.resolve(outputDir) : defaultOutputDir(repoRoot, target);
  assertNonSensitivePath(resolved, "sidecar output");
  return resolved;
}

function assertWritableOutputDir(outputDir) {
  if (!fs.existsSync(outputDir)) return;
  if (!fs.statSync(outputDir).isDirectory()) {
    throw new Error(`sidecar output exists and is not a directory: ${outputDir}`);
  }
  if (fs.readdirSync(outputDir).length > 0) {
    throw new Error(`sidecar output directory already exists and is not empty: ${outputDir}`);
  }
}

function splitFieldLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);
}

function uniqueLines(lines) {
  const seen = new Set();
  const result = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(line);
  }
  return result;
}

function riskBoundariesForTarget(state, target) {
  return uniqueLines([
    ...splitFieldLines(state.handoff.risk_boundaries),
    ...BASE_RISK_BOUNDARIES,
    ...(target === "openclaw" ? OPENCLAW_RISK_BOUNDARIES : []),
  ]);
}

function targetDescription(target) {
  if (target === "openclaw") {
    return "OpenClaw-safe receiver handoff bundle. This is formatting and safety wording only; it does not connect runtime, provider, profile, config, memory, or workspace systems.";
  }
  return "Generic receiver handoff bundle for a new local agent window.";
}

function stateSummaryFromState(state, target, riskBoundaries) {
  return {
    schemaVersion: SIDECAR_SCHEMA_VERSION,
    projectStateSchemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    target,
    current_goal: state.handoff.current_goal,
    receiver_entry_task: state.handoff.receiver_entry_task,
    risk_boundaries: riskBoundaries,
    open_questions: state.handoff.open_questions,
    source: {
      kind: state.source.kind,
      file: state.source.file,
      handoff_status: state.source.handoff_status,
    },
    repository: {
      branch: state.repository.branch,
      head: state.repository.head,
      changed_files: state.repository.changed_files,
    },
    state_timestamps: {
      generated_at: state.generated_at,
      updated_at: state.updated_at,
    },
  };
}

function renderList(lines) {
  return lines.map((line) => `- ${line}`).join(os.EOL);
}

function stripTechnicalTokens(value) {
  return String(value || "")
    .replace(/`[^`]*`/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[A-Za-z]:[\\/][^\s]+/g, " ")
    .replace(/(?:^|\s)[./\\][^\s]+/g, " ")
    .replace(/\b[A-Za-z0-9_.-]+\.(?:json|md|js|ts|txt|yml|yaml)\b/gi, " ")
    .replace(/\b(?:current_goal|receiver_entry_task|risk_boundaries|manifest|schemaVersion|Sidecar|BaseBrief)\b/gi, " ");
}

function detectStarterLanguage(state) {
  const text = stripTechnicalTokens([
    state.handoff.current_goal,
    state.handoff.receiver_entry_task,
    state.handoff.risk_boundaries,
  ].join(os.EOL));
  const kanaCount = (text.match(/[\u3040-\u30ff]/g) || []).length;
  const cjkCount = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const englishWordCount = (text.match(/\b[A-Za-z]{3,}\b/g) || []).length;

  if (kanaCount >= 2) return "ja";
  if (cjkCount >= 2) return "zh-CN";
  if (englishWordCount >= 4) return "en";
  return "zh-CN";
}

function resolveStarterLanguage(requestedLanguage, state) {
  const language = requestedLanguage || "auto";
  if (!SUPPORTED_STARTER_LANGUAGES.has(language)) {
    throw new Error(`Unsupported starter language: ${language}`);
  }
  return language === "auto" ? detectStarterLanguage(state) : language;
}

const STARTER_COPY = {
  en: {
    title: "# BaseBrief New Window Starter",
    intro: "Copy this block into a new chat. Start by accepting the BaseBrief receiver task; do not continue the project yet.",
    targetRepo: "Target repository: open the repository that generated this Sidecar bundle.",
    sidecarBundle: (bundleCue) => `Sidecar bundle: read ${bundleCue}, including \`manifest.json\`, \`state-summary.json\`, \`handoff.md\`, \`next-chat-prompt.md\`, \`receiver-entry-task.md\`, and \`risk-boundaries.md\`.`,
    firstResponse: "First response: identify BaseBrief, restate `current_goal`, restate `receiver_entry_task`, restate at least two risk boundaries, report pass/fail, and say whether the bundle is understandable enough to continue.",
    wait: "Wait for user confirmation before continuing.",
    currentGoal: "current_goal:",
    receiverEntryTask: "receiver_entry_task:",
    riskBoundaries: "risk_boundaries:",
    hardStops: "Hard stops:",
    noProvider: "No provider request.",
    noRawPrivate: "No raw private output.",
    noRuntime: "No runtime integration.",
    noSchema: "No schema change.",
    noAutoAdvance: "No auto-advance.",
    clawBoundary: "Do not connect OpenClaw/Hermes runtime or write profile/config/memory/workspace files.",
  },
  "zh-CN": {
    title: "# BaseBrief 新窗口开场白",
    intro: "把这段复制到新聊天。先接收 BaseBrief receiver task；暂时不要继续推进项目。",
    targetRepo: "目标仓库（Target repository）：打开生成此 Sidecar bundle 的仓库。",
    sidecarBundle: (bundleCue) => `Sidecar bundle：读取 ${bundleCue}，包括 \`manifest.json\`、\`state-summary.json\`、\`handoff.md\`、\`next-chat-prompt.md\`、\`receiver-entry-task.md\` 和 \`risk-boundaries.md\`。`,
    firstResponse: "首条回复：识别 BaseBrief，复述 `current_goal`，复述 `receiver_entry_task`，复述至少两个 risk boundaries，报告 pass/fail，并说明这个 bundle 是否足够清楚、可以继续。",
    wait: "等待用户确认后再继续。（Wait for user confirmation before continuing.）",
    currentGoal: "current_goal:",
    receiverEntryTask: "receiver_entry_task:",
    riskBoundaries: "risk_boundaries:",
    hardStops: "硬性停止项（Hard stops）:",
    noProvider: "不得发起 provider 请求。（No provider request.）",
    noRawPrivate: "不得暴露原始私有输出。（No raw private output.）",
    noRuntime: "不得接入 runtime。（No runtime integration.）",
    noSchema: "不得修改 schema。（No schema change.）",
    noAutoAdvance: "不得自动推进。（No auto-advance.）",
    clawBoundary: "不得连接 OpenClaw/Hermes runtime，也不得写入 profile/config/memory/workspace 文件。",
  },
  ja: {
    title: "# BaseBrief 新規ウィンドウ開始文",
    intro: "このブロックを新しいチャットにコピーしてください。まず BaseBrief receiver task を受け入れ、まだプロジェクトを進めないでください。",
    targetRepo: "対象リポジトリ（Target repository）：この Sidecar bundle を生成したリポジトリを開いてください。",
    sidecarBundle: (bundleCue) => `Sidecar bundle：${bundleCue} を読み、\`manifest.json\`、\`state-summary.json\`、\`handoff.md\`、\`next-chat-prompt.md\`、\`receiver-entry-task.md\`、\`risk-boundaries.md\` を確認してください。`,
    firstResponse: "最初の返信：BaseBrief を識別し、`current_goal` と `receiver_entry_task` を復唱し、少なくとも2つの risk boundaries を復唱し、pass/fail を報告し、この bundle が続行できるほど理解可能かを述べてください。",
    wait: "ユーザー確認を待ってから続行してください。（Wait for user confirmation before continuing.）",
    currentGoal: "current_goal:",
    receiverEntryTask: "receiver_entry_task:",
    riskBoundaries: "risk_boundaries:",
    hardStops: "停止条件（Hard stops）:",
    noProvider: "provider request を行わないこと。（No provider request.）",
    noRawPrivate: "raw private output を出さないこと。（No raw private output.）",
    noRuntime: "runtime integration を行わないこと。（No runtime integration.）",
    noSchema: "schema change を行わないこと。（No schema change.）",
    noAutoAdvance: "auto-advance しないこと。（No auto-advance.）",
    clawBoundary: "OpenClaw/Hermes runtime に接続せず、profile/config/memory/workspace ファイルを書き込まないこと。",
  },
};

function renderHandoff(state, target, riskBoundaries) {
  return [
    "# BaseBrief Sidecar Handoff Bundle",
    "",
    `target: ${target}`,
    `schemaVersion: ${SIDECAR_SCHEMA_VERSION}`,
    `projectStateSchemaVersion: ${PROJECT_STATE_SCHEMA_VERSION}`,
    "",
    "## Current Goal",
    state.handoff.current_goal,
    "",
    "## Verified Facts",
    state.handoff.verified_facts,
    "",
    "## Confirmed Decisions",
    state.handoff.confirmed_decisions,
    "",
    "## Receiver Entry Task",
    state.handoff.receiver_entry_task,
    "",
    "## Risk Boundaries",
    renderList(riskBoundaries),
    "",
    "## Open Questions",
    state.handoff.open_questions,
    "",
    "## Sidecar Boundaries",
    "- No provider request.",
    "- No raw private output.",
    "- No runtime integration.",
    "- No schema change.",
    "- No auto-advance.",
    "- Wait for user confirmation before continuing.",
    ...(target === "openclaw" ? ["- OpenClaw/Hermes runtime, profile, config, memory, and workspace writes are out of scope."] : []),
  ].join(os.EOL);
}

function renderNextChatPrompt(state, target, riskBoundaries) {
  return [
    "# BaseBrief Next Chat Prompt",
    "",
    "Open the target repository, then read this sidecar bundle first:",
    "",
    "- `manifest.json`",
    "- `state-summary.json`",
    "- `handoff.md`",
    "- `receiver-entry-task.md`",
    "- `risk-boundaries.md`",
    "",
    "Do not auto-advance. Wait for user confirmation before continuing.",
    "",
    "## Receiver Task",
    "Read the sidecar files, identify BaseBrief and the stored Project State, then report pass/fail.",
    "",
    "Your response must restate:",
    "",
    "- current_goal",
    "- next task / receiver_entry_task",
    "- at least two risk boundaries",
    "- whether the bundle is understandable enough to continue",
    "",
    "## Current Goal",
    state.handoff.current_goal,
    "",
    "## Next Task",
    state.handoff.receiver_entry_task,
    "",
    "## Risk Boundaries",
    renderList(riskBoundaries),
    "",
    "## Hard Stops",
    "- No provider request.",
    "- No raw private output.",
    "- No runtime integration.",
    "- No schema change.",
    "- No auto-advance.",
    "- Wait for user confirmation.",
    ...(target === "openclaw" ? ["- Do not connect OpenClaw/Hermes runtime or write profile/config/memory/workspace files."] : []),
  ].join(os.EOL);
}

function sidecarBundleCue(repoRoot, outputDir) {
  const relative = path.relative(repoRoot, outputDir);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return normalizeSlash(relative);
  }
  return "the directory that contains this `new-window-starter.md` file";
}

function renderNewWindowStarter(state, target, riskBoundaries, bundleCue, starterLanguage) {
  const copy = STARTER_COPY[starterLanguage];
  return [
    copy.title,
    "",
    copy.intro,
    "",
    copy.targetRepo,
    copy.sidecarBundle(bundleCue),
    "",
    copy.firstResponse,
    "",
    copy.wait,
    "",
    copy.currentGoal,
    state.handoff.current_goal,
    "",
    copy.receiverEntryTask,
    state.handoff.receiver_entry_task,
    "",
    copy.riskBoundaries,
    renderList(riskBoundaries),
    "",
    copy.hardStops,
    `- ${copy.noProvider}`,
    `- ${copy.noRawPrivate}`,
    `- ${copy.noRuntime}`,
    `- ${copy.noSchema}`,
    `- ${copy.noAutoAdvance}`,
    ...(target === "openclaw" ? [`- ${copy.clawBoundary}`] : []),
  ].join(os.EOL);
}

function renderReceiverEntryTask(state) {
  return [
    "# Receiver Entry Task",
    "",
    state.handoff.receiver_entry_task,
    "",
    "Report pass/fail after reading the sidecar bundle. If passing, wait for user confirmation before continuing.",
  ].join(os.EOL);
}

function renderRiskBoundaries(riskBoundaries) {
  return [
    "# Risk Boundaries",
    "",
    renderList(riskBoundaries),
    "",
    "No provider request. No raw private output. No runtime integration. No schema change. No auto-advance.",
    "Wait for user confirmation before continuing.",
  ].join(os.EOL);
}

function manifestForBundle({ target, state, outputFiles, generatedAt }) {
  return {
    schemaVersion: SIDECAR_SCHEMA_VERSION,
    target,
    description: targetDescription(target),
    generated_at: generatedAt,
    projectStateSchemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    source: {
      kind: state.source.kind,
      file: state.source.file,
      handoff_status: state.source.handoff_status,
    },
    repository: {
      branch: state.repository.branch,
      head: state.repository.head,
      changed_files: state.repository.changed_files,
    },
    output_files: outputFiles,
    boundaries: [
      "No provider request.",
      "No raw private output.",
      "No runtime integration.",
      "No schema change.",
      "No auto-advance.",
      "Wait for user confirmation.",
    ],
  };
}

function writeText(filePath, content) {
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`, { encoding: "utf8", flag: "wx" });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}

function readJsonForCheck(filePath, errors, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    errors.push(`${label} must be parseable JSON: ${error.message}`);
    return null;
  }
}

function normalizedText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function textIncludes(haystack, needle) {
  const normalizedNeedle = normalizedText(needle);
  if (!normalizedNeedle) return false;
  return normalizedText(haystack).includes(normalizedNeedle);
}

function validateSidecarJsonShape(value, label, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label} must be a JSON object`);
    return;
  }
  if (value.schemaVersion !== SIDECAR_SCHEMA_VERSION) {
    errors.push(`${label}.schemaVersion must be ${SIDECAR_SCHEMA_VERSION}`);
  }
  if (value.projectStateSchemaVersion !== PROJECT_STATE_SCHEMA_VERSION) {
    errors.push(`${label}.projectStateSchemaVersion must be ${PROJECT_STATE_SCHEMA_VERSION}`);
  }
  if (!SUPPORTED_TARGETS.has(value.target)) {
    errors.push(`${label}.target must be generic or openclaw`);
  }
}

function checkRequiredFiles(inputDir, errors) {
  const files = REQUIRED_OUTPUT_FILE_KEYS.map((key) => OUTPUT_FILES[key]);
  for (const fileName of files) {
    const filePath = path.join(inputDir, fileName);
    if (!fs.existsSync(filePath)) {
      errors.push(`Missing required sidecar file: ${fileName}`);
      continue;
    }
    if (!fs.statSync(filePath).isFile()) {
      errors.push(`Required sidecar path must be a file: ${fileName}`);
    }
  }
  return files;
}

function checkPromptContract({ nextChatPrompt, stateSummary, target, errors }) {
  const currentGoal = String((stateSummary && stateSummary.current_goal) || "");
  const receiverEntryTask = String((stateSummary && stateSummary.receiver_entry_task) || "");
  const riskBoundaries = Array.isArray(stateSummary && stateSummary.risk_boundaries)
    ? stateSummary.risk_boundaries.filter((item) => String(item || "").trim())
    : [];

  if (!currentGoal.trim()) errors.push("state-summary.current_goal must be non-empty");
  if (!receiverEntryTask.trim()) errors.push("state-summary.receiver_entry_task must be non-empty");
  if (riskBoundaries.length < 2) errors.push("state-summary.risk_boundaries must contain at least two items");

  if (currentGoal.trim() && !textIncludes(nextChatPrompt, currentGoal)) {
    errors.push("next-chat-prompt.md must include current_goal content");
  }
  if (receiverEntryTask.trim() && !textIncludes(nextChatPrompt, receiverEntryTask)) {
    errors.push("next-chat-prompt.md must include receiver_entry_task content");
  }
  for (const risk of riskBoundaries.slice(0, 2)) {
    if (!textIncludes(nextChatPrompt, risk)) {
      errors.push("next-chat-prompt.md must include at least two risk boundary items");
      break;
    }
  }
  if (!/wait for user confirmation/i.test(nextChatPrompt)) {
    errors.push("next-chat-prompt.md must require waiting for user confirmation");
  }
  if (!/No provider request/i.test(nextChatPrompt)) {
    errors.push("next-chat-prompt.md must include No provider request");
  }
  if (!/No raw private output/i.test(nextChatPrompt)) {
    errors.push("next-chat-prompt.md must include No raw private output");
  }
  if (!/No runtime(?: integration)?/i.test(nextChatPrompt)) {
    errors.push("next-chat-prompt.md must include No runtime integration");
  }
  if (!/No auto-advance/i.test(nextChatPrompt)) {
    errors.push("next-chat-prompt.md must include No auto-advance");
  }
  if (target === "openclaw") {
    if (!/(OpenClaw\/Hermes runtime|OpenClaw or Hermes runtime)/i.test(nextChatPrompt)) {
      errors.push("openclaw next-chat-prompt.md must prohibit OpenClaw/Hermes runtime integration");
    }
    if (!/(profile\/config\/memory\/workspace|profile[\s\S]*config[\s\S]*memory[\s\S]*workspace)/i.test(nextChatPrompt)) {
      errors.push("openclaw next-chat-prompt.md must prohibit profile/config/memory/workspace writes");
    }
  }
}

function checkStarterContract({ newWindowStarter, stateSummary, target, errors }) {
  const currentGoal = String((stateSummary && stateSummary.current_goal) || "");
  const receiverEntryTask = String((stateSummary && stateSummary.receiver_entry_task) || "");
  const riskBoundaries = Array.isArray(stateSummary && stateSummary.risk_boundaries)
    ? stateSummary.risk_boundaries.filter((item) => String(item || "").trim())
    : [];

  if (!/(target repo|target repository|目标仓库|対象リポジトリ)/i.test(newWindowStarter)) {
    errors.push("new-window-starter.md must include a target repository cue");
  }
  if (!/(sidecar bundle|directory that contains this `new-window-starter\.md` file)/i.test(newWindowStarter)) {
    errors.push("new-window-starter.md must include a sidecar bundle path instruction");
  }
  if (currentGoal.trim() && !textIncludes(newWindowStarter, currentGoal)) {
    errors.push("new-window-starter.md must include current_goal content");
  }
  if (receiverEntryTask.trim() && !textIncludes(newWindowStarter, receiverEntryTask)) {
    errors.push("new-window-starter.md must include receiver_entry_task content");
  }
  for (const risk of riskBoundaries.slice(0, 2)) {
    if (!textIncludes(newWindowStarter, risk)) {
      errors.push("new-window-starter.md must include at least two risk boundary items");
      break;
    }
  }
  if (!/(Wait for user confirmation|等待用户确认|ユーザー確認)/i.test(newWindowStarter)) {
    errors.push("new-window-starter.md must require waiting for user confirmation");
  }
  if (!/pass\/fail/i.test(newWindowStarter)) {
    errors.push("new-window-starter.md must require reporting pass/fail");
  }
  if (!/No provider request/i.test(newWindowStarter)) {
    errors.push("new-window-starter.md must include No provider request");
  }
  if (!/No raw private output/i.test(newWindowStarter)) {
    errors.push("new-window-starter.md must include No raw private output");
  }
  if (!/No runtime(?: integration)?/i.test(newWindowStarter)) {
    errors.push("new-window-starter.md must include No runtime integration");
  }
  if (!/No schema change/i.test(newWindowStarter)) {
    errors.push("new-window-starter.md must include No schema change");
  }
  if (!/No auto-advance/i.test(newWindowStarter)) {
    errors.push("new-window-starter.md must include No auto-advance");
  }
  if (target === "openclaw") {
    if (!/(OpenClaw\/Hermes runtime|OpenClaw or Hermes runtime)/i.test(newWindowStarter)) {
      errors.push("openclaw new-window-starter.md must prohibit OpenClaw/Hermes runtime integration");
    }
    if (!/(profile\/config\/memory\/workspace|profile[\s\S]*config[\s\S]*memory[\s\S]*workspace)/i.test(newWindowStarter)) {
      errors.push("openclaw new-window-starter.md must prohibit profile/config/memory/workspace writes");
    }
  }
}

function getDeclaredNewWindowStarter(manifest, errors) {
  if (!manifest || !manifest.output_files || typeof manifest.output_files !== "object") return "";
  if (!Object.prototype.hasOwnProperty.call(manifest.output_files, "newWindowStarter")) return "";
  if (manifest.output_files.newWindowStarter !== OUTPUT_FILES.newWindowStarter) {
    errors.push(`manifest.json output_files.newWindowStarter must be ${OUTPUT_FILES.newWindowStarter}`);
    return "";
  }
  return manifest.output_files.newWindowStarter;
}

function checkSidecarBundle(options) {
  if (!options.inputPath) throw new Error("Missing --input <sidecar-dir>");
  const inputDir = path.resolve(options.inputPath);
  assertNonSensitivePath(inputDir, "sidecar input");
  if (!fs.existsSync(inputDir)) throw new Error(`sidecar input does not exist: ${inputDir}`);
  if (!fs.statSync(inputDir).isDirectory()) throw new Error(`sidecar input must be a directory: ${inputDir}`);

  const errors = [];
  const requiredFiles = checkRequiredFiles(inputDir, errors);
  const manifestPath = path.join(inputDir, OUTPUT_FILES.manifest);
  const stateSummaryPath = path.join(inputDir, OUTPUT_FILES.stateSummary);
  const nextChatPromptPath = path.join(inputDir, OUTPUT_FILES.nextChatPrompt);

  const manifest = fs.existsSync(manifestPath) && fs.statSync(manifestPath).isFile()
    ? readJsonForCheck(manifestPath, errors, "manifest.json")
    : null;
  const stateSummary = fs.existsSync(stateSummaryPath) && fs.statSync(stateSummaryPath).isFile()
    ? readJsonForCheck(stateSummaryPath, errors, "state-summary.json")
    : null;
  validateSidecarJsonShape(manifest, "manifest.json", errors);
  validateSidecarJsonShape(stateSummary, "state-summary.json", errors);

  const manifestTarget = manifest && manifest.target;
  const summaryTarget = stateSummary && stateSummary.target;
  const target = SUPPORTED_TARGETS.has(manifestTarget) ? manifestTarget : summaryTarget;
  if (manifestTarget && summaryTarget && manifestTarget !== summaryTarget) {
    errors.push("manifest.json target must match state-summary.json target");
  }

  const nextChatPrompt = fs.existsSync(nextChatPromptPath) && fs.statSync(nextChatPromptPath).isFile()
    ? fs.readFileSync(nextChatPromptPath, "utf8")
    : "";
  if (stateSummary) {
    checkPromptContract({ nextChatPrompt, stateSummary, target, errors });
  }
  const newWindowStarterName = getDeclaredNewWindowStarter(manifest, errors);
  if (newWindowStarterName) {
    const newWindowStarterPath = path.join(inputDir, newWindowStarterName);
    if (!fs.existsSync(newWindowStarterPath)) {
      errors.push(`Missing declared sidecar file: ${newWindowStarterName}`);
    } else if (!fs.statSync(newWindowStarterPath).isFile()) {
      errors.push(`Declared sidecar path must be a file: ${newWindowStarterName}`);
    } else if (stateSummary) {
      checkStarterContract({
        newWindowStarter: fs.readFileSync(newWindowStarterPath, "utf8"),
        stateSummary,
        target,
        errors,
      });
    }
  }

  const artifactCheck = checkArtifacts({ inputPath: inputDir });
  const passed = errors.length === 0 && artifactCheck.status === "passed";
  return {
    command: "sidecar-check",
    schemaVersion: SIDECAR_SCHEMA_VERSION,
    projectStateSchemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    input: inputDir,
    check_status: passed ? "passed" : "failed",
    target: SUPPORTED_TARGETS.has(target) ? target : "unknown",
    required_files: requiredFiles,
    errors,
    artifact_check: artifactCheck,
  };
}

function buildSidecarBundle(options) {
  if (!options.repoPath) throw new Error("Missing --repo <target-repo>");
  const target = options.target || "generic";
  if (!SUPPORTED_TARGETS.has(target)) {
    throw new Error(`Unsupported sidecar target: ${target}`);
  }

  const stateResult = runStateRead({ repoPath: options.repoPath });
  const repoRoot = stateResult.repo;
  const outputDir = resolveOutputDir(repoRoot, target, options.outputDir);
  assertWritableOutputDir(outputDir);

  const state = stateResult.state;
  const riskBoundaries = riskBoundariesForTarget(state, target);
  const starterLanguage = resolveStarterLanguage(options.starterLanguage || "auto", state);
  if (!state.handoff.current_goal.trim()) throw new Error("sidecar current_goal must be non-empty");
  if (!state.handoff.receiver_entry_task.trim()) throw new Error("sidecar receiver_entry_task must be non-empty");
  if (riskBoundaries.length < 2) throw new Error("sidecar risk boundaries must contain at least two items");

  const generatedAt = new Date().toISOString();
  const outputFiles = { ...OUTPUT_FILES };
  const stateSummary = stateSummaryFromState(state, target, riskBoundaries);
  const manifest = manifestForBundle({ target, state, outputFiles, generatedAt });
  const bundleCue = sidecarBundleCue(repoRoot, outputDir);

  fs.mkdirSync(outputDir, { recursive: true });
  writeText(path.join(outputDir, OUTPUT_FILES.handoff), renderHandoff(state, target, riskBoundaries));
  writeText(path.join(outputDir, OUTPUT_FILES.nextChatPrompt), renderNextChatPrompt(state, target, riskBoundaries));
  writeText(path.join(outputDir, OUTPUT_FILES.newWindowStarter), renderNewWindowStarter(state, target, riskBoundaries, bundleCue, starterLanguage));
  writeText(path.join(outputDir, OUTPUT_FILES.receiverEntryTask), renderReceiverEntryTask(state));
  writeText(path.join(outputDir, OUTPUT_FILES.riskBoundaries), renderRiskBoundaries(riskBoundaries));
  writeJson(path.join(outputDir, OUTPUT_FILES.stateSummary), stateSummary);
  writeJson(path.join(outputDir, OUTPUT_FILES.manifest), manifest);

  return {
    command: "sidecar-build",
    schemaVersion: SIDECAR_SCHEMA_VERSION,
    projectStateSchemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    target,
    repo: repoRoot,
    input: stateResult.input,
    outputDir,
    starterLanguage,
    outputFiles: Object.fromEntries(Object.entries(outputFiles).map(([key, fileName]) => [key, path.join(outputDir, fileName)])),
    manifest,
  };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const repoIndex = args.indexOf("--repo");
  const targetIndex = args.indexOf("--target");
  const outputDirIndex = args.indexOf("--output-dir");
  const starterLanguageIndex = args.indexOf("--starter-language");
  return {
    repoPath: repoIndex >= 0 ? args[repoIndex + 1] : "",
    target: targetIndex >= 0 ? args[targetIndex + 1] : "",
    outputDir: outputDirIndex >= 0 ? args[outputDirIndex + 1] : "",
    starterLanguage: starterLanguageIndex >= 0 ? args[starterLanguageIndex + 1] : "auto",
    jsonMode: args.includes("--json"),
  };
}

function formatHuman(result) {
  return [
    `BaseBrief sidecar bundle written to ${result.outputDir}`,
    `schemaVersion=${result.schemaVersion}`,
    `target=${result.target}`,
    `projectStateSchemaVersion=${result.projectStateSchemaVersion}`,
    `starter_language=${result.starterLanguage || "auto"}`,
    `new_window_starter=${result.outputFiles.newWindowStarter}`,
    "",
  ].join(os.EOL);
}

function cli() {
  try {
    const options = parseArgs(process.argv);
    const result = buildSidecarBundle(options);
    process.stdout.write(options.jsonMode ? `${JSON.stringify(result, null, 2)}\n` : formatHuman(result));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) cli();

module.exports = {
  SIDECAR_SCHEMA_VERSION,
  SUPPORTED_TARGETS,
  OUTPUT_FILES,
  SUPPORTED_STARTER_LANGUAGES,
  buildSidecarBundle,
  checkSidecarBundle,
  detectStarterLanguage,
  formatHuman,
  riskBoundariesForTarget,
  resolveStarterLanguage,
};
