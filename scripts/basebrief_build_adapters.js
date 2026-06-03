#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");

const { readHandoffInput, validateHandoffInput } = require("./basebrief_build_handoff");

const TARGETS = new Set(["codex", "claude", "all"]);
const SOURCE_SCHEMA = "schemas/bb9-handoff.schema.json";

function list(items, emptyValue = "- none") {
  const values = (items || []).filter(Boolean);
  if (!values.length) return emptyValue;
  return values.map((item) => `- ${item}`).join("\n");
}

function renderCodexTask(input) {
  return [
    "# BaseBrief Codex Task",
    "",
    "## Goal",
    input.current_goal,
    "",
    "## Verified Facts",
    list(input.verified_facts),
    "",
    "## Confirmed Decisions",
    list(input.confirmed_decisions),
    "",
    "## Risk Boundaries",
    list(input.risk_boundaries),
    "",
    "## Forbidden Scope",
    list(input.forbidden_scope),
    "",
    "## Next Task",
    input.tail_request,
    "",
    "## Open Questions",
    list(input.open_questions),
    "",
  ].join("\n");
}

function renderClaudeProjectContext(input) {
  return [
    "# BaseBrief Claude Project Context",
    "",
    "## Project Identity",
    input.project_identity,
    "",
    "## Current Goal",
    input.current_goal,
    "",
    "## Verified Facts",
    list(input.verified_facts),
    "",
    "## Confirmed Decisions",
    list(input.confirmed_decisions),
    "",
    "## Assumptions",
    list(input.assumptions),
    "",
    "## Risk Boundaries",
    list(input.risk_boundaries),
    "",
    "## Open Questions",
    list(input.open_questions),
    "",
    "## Expected Output",
    input.expected_output,
    "",
  ].join("\n");
}

function normalizeTargets(target) {
  const value = String(target || "").toLowerCase();
  if (!TARGETS.has(value)) {
    throw new Error("--target must be codex, claude, or all");
  }
  return value === "all" ? ["codex", "claude"] : [value];
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

function projectMeta(input, targets, outputs) {
  return {
    inputMode: input.mode || "lite",
    targets,
    outputFiles: outputs,
    sourceSchema: SOURCE_SCHEMA,
    safetyBoundary: [
      "Adapter v1 writes only to the explicit output directory.",
      "Adapter v1 is not an official Codex or Claude configuration format.",
      "Adapter outputs must preserve facts, decisions, risks, and open questions.",
      "Adapter outputs must not include provider-only sidecar, cache PAD, or secret material.",
    ],
  };
}

function buildAdapterArtifacts(options) {
  if (!options.inputPath) {
    throw new Error("Missing --input <markdown-or-json>");
  }
  if (!options.outputDir) {
    throw new Error("Missing --output-dir <dir>");
  }
  const targets = normalizeTargets(options.target);
  const input = readHandoffInput(options.inputPath);
  validateHandoffInput(input);
  const outputDir = path.resolve(options.outputDir);
  const outputs = {};

  if (targets.includes("codex")) {
    outputs.codex = "codex-task.md";
    writeText(path.join(outputDir, outputs.codex), renderCodexTask(input));
  }
  if (targets.includes("claude")) {
    outputs.claude = "claude-project-context.md";
    writeText(path.join(outputDir, outputs.claude), renderClaudeProjectContext(input));
  }

  const meta = projectMeta(input, targets, outputs);
  writeText(path.join(outputDir, "adapter.meta.json"), `${JSON.stringify(meta, null, 2)}\n`);

  return {
    outputDir,
    targets,
    outputFiles: outputs,
    meta,
  };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const inputIndex = args.indexOf("--input");
  const outputDirIndex = args.indexOf("--output-dir");
  const targetIndex = args.indexOf("--target");
  return {
    inputPath: inputIndex >= 0 ? args[inputIndex + 1] : "",
    outputDir: outputDirIndex >= 0 ? args[outputDirIndex + 1] : "",
    target: targetIndex >= 0 ? args[targetIndex + 1] : "",
    jsonMode: args.includes("--json"),
  };
}

function cli() {
  const options = parseArgs(process.argv);
  const result = buildAdapterArtifacts(options);
  if (options.jsonMode) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`BaseBrief adapter artifacts written to ${path.relative(process.cwd(), result.outputDir) || "."}${os.EOL}`);
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
  buildAdapterArtifacts,
  normalizeTargets,
  renderClaudeProjectContext,
  renderCodexTask,
};
