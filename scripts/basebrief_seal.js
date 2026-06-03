#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { readHandoffInput, validateHandoffInput } = require("./basebrief_build_handoff");

const SEAL_SCHEMA_VERSION = "basebrief-seal-v1";
const SOURCE_SCHEMA = "schemas/bb9-handoff.schema.json";
const ARRAY_FIELDS = ["verified_facts", "confirmed_decisions", "risk_boundaries", "open_questions", "forbidden_scope"];
const STRING_FIELDS = ["project_identity", "current_goal", "expected_output", "tail_request"];

function sha256Json(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter((item) => item.length > 0);
}

function canonicalHandoff(input) {
  validateHandoffInput(input);
  return {
    mode: input.mode || "lite",
    provider_profile: input.provider_profile || "unknown",
    project_identity: input.project_identity,
    current_goal: input.current_goal,
    verified_facts: normalizeStringArray(input.verified_facts),
    confirmed_decisions: normalizeStringArray(input.confirmed_decisions),
    assumptions: normalizeStringArray(input.assumptions),
    open_questions: normalizeStringArray(input.open_questions),
    risk_boundaries: normalizeStringArray(input.risk_boundaries),
    forbidden_scope: normalizeStringArray(input.forbidden_scope),
    expected_output: input.expected_output,
    tail_request: input.tail_request,
    audience: input.audience || "",
  };
}

function checksumSections(canonical) {
  const sections = {};
  for (const field of [...STRING_FIELDS, ...ARRAY_FIELDS, "assumptions", "audience", "mode", "provider_profile"]) {
    sections[field] = sha256Json(canonical[field]);
  }
  return sections;
}

function createSealFromInput(input, options = {}) {
  const canonical = canonicalHandoff(input);
  const sections = checksumSections(canonical);
  return {
    schemaVersion: SEAL_SCHEMA_VERSION,
    sourceSchema: SOURCE_SCHEMA,
    sealedAt: options.sealedAt || new Date().toISOString(),
    label: options.label || "",
    handoff: canonical,
    checksums: {
      overall: sha256Json(canonical),
      sections,
    },
  };
}

function isSeal(value) {
  return value && value.schemaVersion === SEAL_SCHEMA_VERSION && value.handoff && value.checksums;
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid BaseBrief seal JSON: ${error.message}`);
  }
}

function readSealOrInput(inputPath) {
  const resolved = path.resolve(inputPath);
  if (path.extname(resolved).toLowerCase() === ".json") {
    const parsed = readJsonFile(resolved);
    if (isSeal(parsed)) return parsed;
  }
  return createSealFromInput(readHandoffInput(inputPath));
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

function arrayDiff(beforeItems, afterItems) {
  const before = normalizeStringArray(beforeItems);
  const after = normalizeStringArray(afterItems);
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: after.filter((item) => !beforeSet.has(item)),
    removed: before.filter((item) => !afterSet.has(item)),
    unchanged: after.filter((item) => beforeSet.has(item)),
  };
}

function scalarDiff(beforeValue, afterValue) {
  const before = beforeValue || "";
  const after = afterValue || "";
  return {
    changed: before !== after,
    before: before !== after ? before : null,
    after: before !== after ? after : null,
  };
}

function diffSeals(beforeSeal, afterSeal) {
  if (!isSeal(beforeSeal)) throw new Error("Before input is not a BaseBrief seal");
  if (!isSeal(afterSeal)) throw new Error("After input is not a BaseBrief seal");

  const fields = {};
  for (const field of STRING_FIELDS) {
    fields[field] = scalarDiff(beforeSeal.handoff[field], afterSeal.handoff[field]);
  }
  for (const field of ARRAY_FIELDS) {
    fields[field] = arrayDiff(beforeSeal.handoff[field], afterSeal.handoff[field]);
  }

  const changedFields = Object.entries(fields)
    .filter(([, diff]) => {
      if ("changed" in diff) return diff.changed;
      return diff.added.length > 0 || diff.removed.length > 0;
    })
    .map(([field]) => field);

  return {
    schemaVersion: "basebrief-seal-diff-v1",
    before: {
      label: beforeSeal.label || "",
      checksum: beforeSeal.checksums.overall,
    },
    after: {
      label: afterSeal.label || "",
      checksum: afterSeal.checksums.overall,
    },
    changed: changedFields.length > 0,
    changedFields,
    fields,
    summary: {
      changedFieldCount: changedFields.length,
      factAdds: fields.verified_facts.added.length,
      decisionAdds: fields.confirmed_decisions.added.length,
      riskAdds: fields.risk_boundaries.added.length,
      openQuestionAdds: fields.open_questions.added.length,
      taskBoundaryChanged:
        fields.tail_request.changed ||
        fields.expected_output.changed ||
        fields.risk_boundaries.added.length > 0 ||
        fields.risk_boundaries.removed.length > 0 ||
        fields.forbidden_scope.added.length > 0 ||
        fields.forbidden_scope.removed.length > 0,
    },
  };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0] || "";
  const options = { command, jsonMode: args.includes("--json") };
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") continue;
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
    const key = arg.slice(2);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    options[key] = value;
    index += 1;
  }
  return options;
}

function commandSeal(options) {
  if (!options.input) throw new Error("Missing --input <markdown-json-or-seal>");
  if (!options.output) throw new Error("Missing --output <seal-json>");
  const seal = readSealOrInput(options.input);
  const outputPath = path.resolve(options.output);
  writeText(outputPath, `${JSON.stringify(seal, null, 2)}\n`);
  return {
    command: "seal",
    output: outputPath,
    checksum: seal.checksums.overall,
    schemaVersion: seal.schemaVersion,
  };
}

function commandDiff(options) {
  if (!options.before) throw new Error("Missing --before <seal-or-input>");
  if (!options.after) throw new Error("Missing --after <seal-or-input>");
  const beforeSeal = readSealOrInput(options.before);
  const afterSeal = readSealOrInput(options.after);
  return {
    command: "diff",
    diff: diffSeals(beforeSeal, afterSeal),
  };
}

function formatHuman(result) {
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

function cli() {
  const options = parseArgs(process.argv);
  let result;
  if (options.command === "seal") {
    result = commandSeal(options);
  } else if (options.command === "diff") {
    result = commandDiff(options);
  } else {
    throw new Error("Missing command: seal or diff");
  }
  if (options.jsonMode) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(formatHuman(result));
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
  SEAL_SCHEMA_VERSION,
  ARRAY_FIELDS,
  STRING_FIELDS,
  canonicalHandoff,
  commandDiff,
  commandSeal,
  createSealFromInput,
  diffSeals,
  isSeal,
  readSealOrInput,
};
