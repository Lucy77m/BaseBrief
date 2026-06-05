#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");

const { buildAdapterArtifacts, normalizeTargets } = require("./basebrief_build_adapters");
const { buildHandoffArtifacts, validateHandoffInput } = require("./basebrief_build_handoff");
const { checkArtifacts } = require("./basebrief_check_artifacts");
const { runReceiverCheck } = require("./basebrief_receiver_check");
const { collectGuidedAnswersFromStdin, runReceiverFlow } = require("./basebrief_receiver_flow");
const { runReceiverInit } = require("./basebrief_receiver_init");
const { runReviewDraft } = require("./basebrief_review_draft");
const {
  runStateAdvance,
  runStateHistory,
  runStateInit,
  runStateRead,
  runStateStatus,
  runStateValidate,
} = require("./basebrief_project_state");
const { commandDiff: commandSealDiff, commandSeal: commandCreateSeal } = require("./basebrief_seal");
const { buildSidecarBundle } = require("./basebrief_sidecar");

const STARTER_FILE = "basebrief-handoff-input.json";
const HELP_TEXT = [
  "BaseBrief CLI Lite",
  "",
  "Usage:",
  "  node scripts/basebrief.js init --output-dir <dir>",
  "  node scripts/basebrief.js build --input <markdown-or-json> --output-dir <dir> [--adapters codex|claude|all|none] [--check]",
  "  node scripts/basebrief.js check --input <file-or-dir>",
  "  node scripts/basebrief.js receiver-init --repo <target-repo> --output <receiver-check.json> [--json]",
  "  node scripts/basebrief.js receiver-check --config <json> --repo <target-repo> [--json]",
  "  node scripts/basebrief.js receiver-flow --repo <target-repo> --output-dir <dir> [--guided] [--json]",
  "  node scripts/basebrief.js receiver-flow --repo <target-repo> --output-dir <dir> --extract --source <draft-or-context.md> [--json]",
  "  node scripts/basebrief.js review-draft --draft <draft-context.md> --output <receiver-ready.md> [--json]",
  "  node scripts/basebrief.js state-init --repo <target-repo> --source <receiver-ready.md> [--json]",
  "  node scripts/basebrief.js state-read --repo <target-repo> [--json]",
  "  node scripts/basebrief.js state-status --repo <target-repo> [--json]",
  "  node scripts/basebrief.js state-validate --repo <target-repo> [--json]",
  "  node scripts/basebrief.js state-history --repo <target-repo> [--json]",
  "  node scripts/basebrief.js state-advance --repo <target-repo> --source <receiver-ready.md> [--json]",
  "  node scripts/basebrief.js sidecar-build --repo <target-repo> [--target generic|openclaw] [--output-dir <dir>] [--json]",
  "  node scripts/basebrief.js seal --input <markdown-or-json> --output <file>",
  "  node scripts/basebrief.js diff --before <file> --after <file>",
  "",
  "Start here:",
  "  docs/quickstart-5min.md",
].join(os.EOL);

function parseOptions(args) {
  const options = { _: [] };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      options._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (key === "json" || key === "check" || key === "guided" || key === "extract") {
      options[key] = true;
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    options[key] = value;
    index += 1;
  }
  return options;
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

function starterInput() {
  return {
    mode: "full",
    provider_profile: "unknown",
    project_identity: "BaseBrief public-safe starter project",
    current_goal: "Prepare a readable project handoff with structured BB9 input.",
    verified_facts: [
      "Replace this starter with facts verified from repository files.",
      "Keep public examples free of secrets and private absolute paths.",
    ],
    confirmed_decisions: [
      "Keep readable brief content separate from provider-facing active prompts.",
    ],
    assumptions: [
      "The next agent can inspect the repository before editing.",
    ],
    open_questions: [
      "Which provider profile, if any, should be used for active prompt generation?",
    ],
    risk_boundaries: [
      "Do not write secrets, tokens, or local absolute paths.",
      "Do not turn provider-specific estimated-cost evidence into general proof.",
    ],
    forbidden_scope: [
      ".env files",
      "API keys",
      "private local paths",
    ],
    expected_output: "Readable handoff artifacts generated from this BB9 input.",
    tail_request: "Build handoff artifacts and review the check results before sharing.",
  };
}

function artifactMapForHandoff(result) {
  const artifacts = {
    readableBrief: path.join(result.outputDir, "readableBrief.md"),
    activeProviderPrompt: path.join(result.outputDir, "activeProviderPrompt.md"),
    meta: path.join(result.outputDir, "handoff.meta.json"),
  };
  if (result.wroteCacheSidecar) {
    artifacts.cacheSidecar = path.join(result.outputDir, "cacheSidecar.md");
  }
  return artifacts;
}

function artifactMapForAdapters(result) {
  if (!result) return null;
  const artifacts = {
    meta: path.join(result.outputDir, "adapter.meta.json"),
  };
  for (const [target, fileName] of Object.entries(result.outputFiles)) {
    artifacts[target] = path.join(result.outputDir, fileName);
  }
  return artifacts;
}

function publicPath(filePath, cwd = process.cwd()) {
  const relative = path.relative(cwd, filePath);
  if (!relative) return ".";
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return relative;
  }
  return "[outside-cwd]";
}

function toRelativeMap(artifacts, cwd = process.cwd()) {
  if (!artifacts) return null;
  return Object.fromEntries(
    Object.entries(artifacts).map(([key, value]) => [key, publicPath(value, cwd)]),
  );
}

function commandInit(options) {
  if (!options["output-dir"]) {
    throw new Error("Missing --output-dir <dir>");
  }
  const outputDir = path.resolve(options["output-dir"]);
  const input = starterInput();
  validateHandoffInput(input);
  const outputFile = path.join(outputDir, STARTER_FILE);
  writeText(outputFile, `${JSON.stringify(input, null, 2)}\n`);
  return {
    command: "init",
    outputDir,
    outputFiles: {
      starter: outputFile,
    },
    sourceSchema: "schemas/bb9-handoff.schema.json",
  };
}

function commandBuild(options) {
  if (!options.input) {
    throw new Error("Missing --input <markdown-or-json>");
  }
  if (!options["output-dir"]) {
    throw new Error("Missing --output-dir <dir>");
  }
  const adapters = options.adapters || "none";
  if (adapters !== "none") {
    normalizeTargets(adapters);
  }
  const outputDir = path.resolve(options["output-dir"]);
  const handoff = buildHandoffArtifacts({
    inputPath: options.input,
    outputDir,
    mode: options.mode || "",
    providerProfile: options["provider-profile"] || "",
  });

  let adapterResult = null;
  if (adapters !== "none") {
    adapterResult = buildAdapterArtifacts({
      inputPath: options.input,
      outputDir: path.join(outputDir, "adapters"),
      target: adapters,
    });
  }

  let checkResult = null;
  if (options.check) {
    checkResult = checkArtifacts({ inputPath: outputDir });
  }

  return {
    command: "build",
    outputDir,
    handoff: {
      wroteCacheSidecar: handoff.wroteCacheSidecar,
      outputFiles: artifactMapForHandoff(handoff),
      recommendedPromptType: handoff.meta.recommendedPromptType,
      providerProfile: handoff.meta.providerProfile && handoff.meta.providerProfile.profileId,
    },
    adapters: adapterResult
      ? {
          targets: adapterResult.targets,
          outputFiles: artifactMapForAdapters(adapterResult),
        }
      : null,
    check: checkResult,
  };
}

function commandCheck(options) {
  if (!options.input) {
    throw new Error("Missing --input <file-or-dir>");
  }
  return {
    command: "check",
    input: path.resolve(options.input),
    check: checkArtifacts({ inputPath: options.input }),
  };
}

function commandReceiverCheck(options) {
  return {
    command: "receiver-check",
    result: runReceiverCheck({
      configPath: options.config,
      repoPath: options.repo,
    }),
  };
}

function commandReceiverInit(options) {
  return runReceiverInit({
    repoPath: options.repo,
    outputPath: options.output,
  });
}

function commandReceiverFlow(options) {
  return runReceiverFlow({
    repoPath: options.repo,
    outputDir: options["output-dir"],
    guided: Boolean(options.guided),
    guidedAnswers: options.guidedAnswers,
    extract: Boolean(options.extract),
    sourcePath: options.source,
  });
}

function commandReviewDraft(options) {
  return runReviewDraft({
    draftPath: options.draft,
    outputPath: options.output,
  });
}

function commandStateInit(options) {
  return runStateInit({
    repoPath: options.repo,
    sourcePath: options.source,
  });
}

function commandStateRead(options) {
  return runStateRead({
    repoPath: options.repo,
  });
}

function commandStateStatus(options) {
  return runStateStatus({
    repoPath: options.repo,
  });
}

function commandStateValidate(options) {
  return runStateValidate({
    repoPath: options.repo,
  });
}

function commandStateHistory(options) {
  return runStateHistory({
    repoPath: options.repo,
  });
}

function commandStateAdvance(options) {
  return runStateAdvance({
    repoPath: options.repo,
    sourcePath: options.source,
  });
}

function commandSidecarBuild(options) {
  return buildSidecarBundle({
    repoPath: options.repo,
    target: options.target || "generic",
    outputDir: options["output-dir"] || "",
  });
}

function commandSeal(options) {
  return {
    ...commandCreateSeal({
      input: options.input,
      output: options.output,
    }),
  };
}

function commandDiff(options) {
  return commandSealDiff({
    before: options.before,
    after: options.after,
  });
}

function run(argv) {
  const command = argv[2];
  if (!command || command === "--help" || command === "-h") return { command: "help" };
  const options = parseOptions(argv.slice(3));
  if (options._.length) {
    throw new Error(`Unexpected positional argument: ${options._[0]}`);
  }
  if (command === "init") return commandInit(options);
  if (command === "build") return commandBuild(options);
  if (command === "check") return commandCheck(options);
  if (command === "receiver-init") return commandReceiverInit(options);
  if (command === "receiver-check") return commandReceiverCheck(options);
  if (command === "receiver-flow") return commandReceiverFlow(options);
  if (command === "review-draft") return commandReviewDraft(options);
  if (command === "state-init") return commandStateInit(options);
  if (command === "state-read") return commandStateRead(options);
  if (command === "state-status") return commandStateStatus(options);
  if (command === "state-validate") return commandStateValidate(options);
  if (command === "state-history") return commandStateHistory(options);
  if (command === "state-advance") return commandStateAdvance(options);
  if (command === "sidecar-build") return commandSidecarBuild(options);
  if (command === "seal") return commandSeal(options);
  if (command === "diff") return commandDiff(options);
  throw new Error(`Unknown command: ${command}`);
}

function toPublicResult(result) {
  const cwd = process.cwd();
  if (result.command === "init") {
    return {
      ...result,
      outputDir: publicPath(result.outputDir, cwd),
      outputFiles: toRelativeMap(result.outputFiles, cwd),
    };
  }
  if (result.command === "build") {
    return {
      ...result,
      outputDir: publicPath(result.outputDir, cwd),
      handoff: {
        ...result.handoff,
        outputFiles: toRelativeMap(result.handoff.outputFiles, cwd),
      },
      adapters: result.adapters
        ? {
            ...result.adapters,
            outputFiles: toRelativeMap(result.adapters.outputFiles, cwd),
          }
        : null,
    };
  }
  if (result.command === "check") {
    return {
      ...result,
      input: publicPath(result.input, cwd),
    };
  }
  if (result.command === "receiver-check") return result;
  if (result.command === "receiver-init") {
    return {
      ...result,
      output: publicPath(result.output, cwd),
    };
  }
  if (result.command === "receiver-flow") {
    return {
      ...result,
      outputDir: publicPath(result.outputDir, cwd),
      outputFiles: toRelativeMap(result.outputFiles, cwd),
      extract_source: result.extract_source ? publicPath(result.extract_source, cwd) : undefined,
    };
  }
  if (result.command === "review-draft") {
    return {
      ...result,
      source_draft: publicPath(result.source_draft, cwd),
      output: publicPath(result.output, cwd),
    };
  }
  if (result.command === "state-init") {
    return {
      ...result,
      repo: publicPath(result.repo, cwd),
      output: publicPath(result.output, cwd),
      source: publicPath(result.source, cwd),
    };
  }
  if (result.command === "state-read") {
    return {
      ...result,
      repo: publicPath(result.repo, cwd),
      input: publicPath(result.input, cwd),
    };
  }
  if (result.command === "state-status" || result.command === "state-validate" || result.command === "state-history") {
    return {
      ...result,
      repo: publicPath(result.repo, cwd),
      input: publicPath(result.input, cwd),
    };
  }
  if (result.command === "state-advance") {
    return {
      ...result,
      repo: publicPath(result.repo, cwd),
      input: publicPath(result.input, cwd),
      output: publicPath(result.output, cwd),
      source: publicPath(result.source, cwd),
      history_output: publicPath(result.history_output, cwd),
    };
  }
  if (result.command === "sidecar-build") {
    return {
      ...result,
      repo: publicPath(result.repo, cwd),
      input: publicPath(result.input, cwd),
      outputDir: publicPath(result.outputDir, cwd),
      outputFiles: toRelativeMap(result.outputFiles, cwd),
    };
  }
  if (result.command === "seal") {
    return {
      ...result,
      output: publicPath(result.output, cwd),
    };
  }
  return result;
}

function formatHuman(result) {
  if (result.command === "help") {
    return `${HELP_TEXT}${os.EOL}`;
  }
  if (result.command === "init") {
    return `BaseBrief starter written to ${result.outputFiles.starter}${os.EOL}`;
  }
  if (result.command === "build") {
    const lines = [
      `BaseBrief artifacts written to ${result.outputDir}`,
      `recommended_prompt_type=${result.handoff.recommendedPromptType}`,
      `adapters=${result.adapters ? result.adapters.targets.join(",") : "none"}`,
    ];
    if (result.check) {
      lines.push(`check_status=${result.check.status}`);
      lines.push(`check_errors=${result.check.errorCount}`);
      lines.push(`check_warnings=${result.check.warningCount}`);
      lines.push(...formatFindingLines(result.check.findings));
    }
    return `${lines.join(os.EOL)}${os.EOL}`;
  }
  if (result.command === "check") {
    return [
      `BaseBrief check ${result.check.status}: errors=${result.check.errorCount}, warnings=${result.check.warningCount}`,
      ...formatFindingLines(result.check.findings),
      "",
    ].join(os.EOL);
  }
  if (result.command === "receiver-check") {
    return [
      `BaseBrief receiver check ${result.result.handoff_acceptance}.`,
      `receiver_task_status=${result.result.receiver_task_status}`,
      `repository_state_status=${result.result.repository_state_status}`,
      `declared_checks_status=${result.result.declared_checks_status}`,
      `handoff_acceptance=${result.result.handoff_acceptance}`,
      result.result.blocked_reason ? `blocked_reason=${result.result.blocked_reason}` : "",
      "",
    ].filter((line, index, lines) => line || index === lines.length - 1).join(os.EOL);
  }
  if (result.command === "receiver-init") {
    return [
      `BaseBrief receiver config written to ${result.output}`,
      `expected_branch=${result.config.expected_branch}`,
      `expected_head=${result.config.expected_head}`,
      `expected_changed_files=${result.config.expected_changed_files.length}`,
      `declared_checks=${result.config.declared_checks.length}`,
      "",
    ].join(os.EOL);
  }
  if (result.command === "receiver-flow") {
    return [
      `BaseBrief receiver flow draft written to ${result.outputDir}`,
      `handoff_status=${result.handoff_status}`,
      `expected_changed_files=${result.receiver_check_config.expected_changed_files.length}`,
      `guided=${result.guided}`,
      `extract=${result.extract}`,
      "review_required=true",
      "",
    ].join(os.EOL);
  }
  if (result.command === "review-draft") {
    return [
      `BaseBrief receiver-ready handoff written to ${result.output}`,
      `handoff_status=${result.handoff_status}`,
      `reviewed_fields=${result.reviewed_fields.length}`,
      "",
    ].join(os.EOL);
  }
  if (result.command === "state-init") {
    return [
      `BaseBrief project state written to ${result.output}`,
      `schemaVersion=${result.schemaVersion}`,
      `handoff_status=${result.state.source.handoff_status}`,
      "",
    ].join(os.EOL);
  }
  if (result.command === "state-read") {
    return [
      `BaseBrief project state read from ${result.input}`,
      `schemaVersion=${result.schemaVersion}`,
      `state_status=${result.state.state_status}`,
      "",
    ].join(os.EOL);
  }
  if (result.command === "state-status") {
    return [
      `BaseBrief project state status for ${result.repo}`,
      `exists=${result.exists}`,
      `state_status=${result.state_status}`,
      `validation_status=${result.validation_status}`,
      result.updated_at ? `updated_at=${result.updated_at}` : "",
      ...result.errors.map((error) => `error=${error}`),
      "",
    ].filter((line, index, lines) => line || index === lines.length - 1).join(os.EOL);
  }
  if (result.command === "state-validate") {
    return [
      `BaseBrief project state validation ${result.validation_status}`,
      `exists=${result.exists}`,
      `state_status=${result.state_status}`,
      ...result.errors.map((error) => `error=${error}`),
      "",
    ].join(os.EOL);
  }
  if (result.command === "state-history") {
    return [
      `BaseBrief project state history ${result.history_status}`,
      `entries=${result.entries.length}`,
      "",
    ].join(os.EOL);
  }
  if (result.command === "state-advance") {
    return [
      `BaseBrief project state advanced at ${result.output}`,
      `schemaVersion=${result.schemaVersion}`,
      `handoff_status=${result.state.source.handoff_status}`,
      `history_output=${result.history_output}`,
      "",
    ].join(os.EOL);
  }
  if (result.command === "sidecar-build") {
    return [
      `BaseBrief sidecar bundle written to ${result.outputDir}`,
      `schemaVersion=${result.schemaVersion}`,
      `target=${result.target}`,
      `projectStateSchemaVersion=${result.projectStateSchemaVersion}`,
      "",
    ].join(os.EOL);
  }
  if (result.command === "seal") {
    return `BaseBrief seal written to ${result.output}${os.EOL}checksum=${result.checksum}${os.EOL}`;
  }
  if (result.command === "diff") {
    return [
      `BaseBrief seal diff changed=${result.diff.changed}`,
      `changed_fields=${result.diff.changedFields.join(",") || "none"}`,
      `task_boundary_changed=${result.diff.summary.taskBoundaryChanged}`,
      "",
    ].join(os.EOL);
  }
  return `${JSON.stringify(result, null, 2)}${os.EOL}`;
}

function formatFindingLines(findings = []) {
  return findings.map(
    (finding) => `${finding.severity} ${finding.ruleId} ${finding.file}:${finding.line} ${finding.message}`,
  );
}

function cli() {
  let result;
  if (process.argv[2] === "receiver-flow" && process.argv.includes("--guided")) {
    const options = parseOptions(process.argv.slice(3));
    options.guidedAnswers = collectGuidedAnswersFromStdin(fs.readFileSync(0, "utf8"));
    result = commandReceiverFlow(options);
  } else {
    result = run(process.argv);
  }
  const publicResult = toPublicResult(result);
  const jsonMode = process.argv.includes("--json");
  if (jsonMode) {
    process.stdout.write(`${JSON.stringify(publicResult, null, 2)}\n`);
  } else {
    process.stdout.write(formatHuman(publicResult));
  }
  if (result.check && result.check.errorCount > 0) {
    process.exitCode = 1;
  }
  if (result.command === "receiver-check" && result.result.handoff_acceptance === "blocked") {
    process.exitCode = 1;
  }
  if (result.command === "state-validate" && result.validation_status !== "passed") {
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
  HELP_TEXT,
  commandBuild,
  commandCheck,
  commandDiff,
  commandInit,
  commandReceiverInit,
  commandReceiverCheck,
  commandReceiverFlow,
  commandReviewDraft,
  commandStateAdvance,
  commandStateHistory,
  commandStateInit,
  commandStateRead,
  commandStateStatus,
  commandStateValidate,
  commandSidecarBuild,
  commandSeal,
  formatFindingLines,
  formatHuman,
  parseOptions,
  run,
  starterInput,
  publicPath,
  toPublicResult,
};
