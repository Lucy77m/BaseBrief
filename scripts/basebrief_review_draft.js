#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");

const { GUIDED_FIELDS } = require("./basebrief_receiver_flow");

const REVIEW_DRAFT_SCHEMA_VERSION = "basebrief-review-draft-v1";
const REQUIRED_REVIEW_FIELDS = GUIDED_FIELDS.map((field) => field.key);
const BLOCKED_MARKER_PATTERNS = [
  /\[EMPTY\]/i,
  /\[NEEDS_REVIEW\]/i,
  /\[CANDIDATE(?:[^\]]*)?\]/i,
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

function resolveDraftPath(draftPath) {
  if (!draftPath) throw new Error("Missing --draft <draft-context.md>");
  const resolved = path.resolve(draftPath);
  assertNonSensitivePath(resolved, "review-draft input");
  if (!fs.existsSync(resolved)) throw new Error(`review-draft input does not exist: ${resolved}`);
  if (!fs.statSync(resolved).isFile()) throw new Error("review-draft input must be a file");
  return fs.realpathSync(resolved);
}

function resolveOutputPath(outputPath) {
  if (!outputPath) throw new Error("Missing --output <receiver-ready.md>");
  const resolved = path.resolve(outputPath);
  assertNonSensitivePath(resolved, "review-draft output");
  if (path.extname(resolved).toLowerCase() !== ".md") {
    throw new Error("review-draft output must be a Markdown file");
  }
  if (fs.existsSync(resolved)) throw new Error(`review-draft output already exists: ${resolved}`);

  let existingParent = path.dirname(resolved);
  const pendingSegments = [];
  while (!fs.existsSync(existingParent)) {
    pendingSegments.unshift(path.basename(existingParent));
    const next = path.dirname(existingParent);
    if (next === existingParent) throw new Error("Unable to resolve review-draft output directory");
    existingParent = next;
  }
  const realOutput = path.join(fs.realpathSync(existingParent), ...pendingSegments, path.basename(resolved));
  assertNonSensitivePath(realOutput, "review-draft output");
  if (fs.existsSync(realOutput)) throw new Error(`review-draft output already exists: ${realOutput}`);
  return realOutput;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractMarkdownSection(content, heading) {
  const pattern = new RegExp(`^###\\s+${escapeRegExp(heading)}\\s*$`, "im");
  const match = pattern.exec(content);
  if (!match) return null;
  const start = match.index + match[0].length;
  const rest = content.slice(start);
  const nextHeading = /\n#{2,3}\s+/m.exec(rest);
  const body = nextHeading ? rest.slice(0, nextHeading.index) : rest;
  return body.trim();
}

function findBlockedMarkers(content) {
  return BLOCKED_MARKER_PATTERNS
    .filter((pattern) => pattern.test(content))
    .map((pattern) => {
      if (pattern.source.includes("EMPTY")) return "[EMPTY]";
      if (pattern.source.includes("NEEDS_REVIEW")) return "[NEEDS_REVIEW]";
      return "[CANDIDATE]";
    });
}

function validateChecklist(content) {
  const missing = [];
  for (const field of REQUIRED_REVIEW_FIELDS) {
    const pattern = new RegExp(`^- \\[[xX]\\]\\s+${escapeRegExp(field)} reviewed\\s*$`, "m");
    if (!pattern.test(content)) missing.push(field);
  }
  return missing;
}

function validateReviewedDraft(content) {
  if (!/^handoff_status:\s*draft_needs_review\s*$/m.test(content)) {
    throw new Error("review-draft input must have handoff_status: draft_needs_review");
  }
  if (/^handoff_status:\s*ready_for_receiver\s*$/m.test(content)) {
    throw new Error("review-draft input is already receiver-ready");
  }

  const markers = findBlockedMarkers(content);
  if (markers.length) {
    throw new Error(`review-draft input still contains blocked review markers: ${[...new Set(markers)].join(", ")}`);
  }

  const fields = {};
  const missingFields = [];
  for (const field of REQUIRED_REVIEW_FIELDS) {
    const value = extractMarkdownSection(content, field);
    if (!value) {
      missingFields.push(field);
    } else {
      fields[field] = value;
    }
  }
  if (missingFields.length) {
    throw new Error(`review-draft input is missing required human fields: ${missingFields.join(", ")}`);
  }

  const unchecked = validateChecklist(content);
  if (unchecked.length) {
    throw new Error(`review-draft checklist is not fully reviewed: ${unchecked.join(", ")}`);
  }

  return fields;
}

function buildReceiverReady({ generatedAt, draftPath, fields }) {
  const lines = [
    "# BaseBrief Receiver-Ready Handoff",
    "",
    "handoff_status: ready_for_receiver",
    "handoff_protocol_version: receiver-ready-v1",
    `generated_at: ${generatedAt}`,
    "source: review-draft",
    `source_draft: ${path.basename(draftPath)}`,
    "",
    "## Review Summary",
    "",
    "- Source draft had `handoff_status: draft_needs_review`.",
    "- Required human-provided fields were present.",
    "- Review checklist entries were explicitly checked.",
    "- Blocked review markers were absent.",
    "",
    "## current_goal",
    "",
    fields.current_goal,
    "",
    "## verified_facts",
    "",
    fields.verified_facts,
    "",
    "## confirmed_decisions",
    "",
    fields.confirmed_decisions,
    "",
    "## risk_boundaries",
    "",
    fields.risk_boundaries,
    "",
    "## receiver_entry_task",
    "",
    fields.receiver_entry_task,
    "",
    "## open_questions",
    "",
    fields.open_questions,
    "",
    "## Receiver Entry Instructions",
    "",
    "- Review the confirmed fields before implementation work.",
    "- Recheck repository state with the paired receiver-check config if one is provided.",
    "- Report `receiver_task_status`, `repository_state_status`, `declared_checks_status`, and `handoff_acceptance`.",
    "",
    "## Non-Goals",
    "",
    "- No provider request.",
    "- No receiver-flow --extract.",
    "- No Auto Flow.",
    "- No `.basebrief/` project state directory.",
    "",
  ];
  return lines.join(os.EOL);
}

function runReviewDraft(options) {
  const draftPath = resolveDraftPath(options.draftPath);
  const outputPath = resolveOutputPath(options.outputPath);
  const content = fs.readFileSync(draftPath, "utf8");
  const fields = validateReviewedDraft(content);
  const generatedAt = new Date().toISOString();
  const receiverReady = buildReceiverReady({ generatedAt, draftPath, fields });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, receiverReady, { encoding: "utf8", flag: "wx" });
  return {
    command: "review-draft",
    schemaVersion: REVIEW_DRAFT_SCHEMA_VERSION,
    handoff_status: "ready_for_receiver",
    source_draft: draftPath,
    output: outputPath,
    reviewed_fields: REQUIRED_REVIEW_FIELDS,
    review_summary: {
      required_fields_present: true,
      blocked_markers_absent: true,
      checklist_complete: true,
    },
  };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const draftIndex = args.indexOf("--draft");
  const outputIndex = args.indexOf("--output");
  return {
    draftPath: draftIndex >= 0 ? args[draftIndex + 1] : "",
    outputPath: outputIndex >= 0 ? args[outputIndex + 1] : "",
    jsonMode: args.includes("--json"),
  };
}

function formatHuman(result) {
  return [
    `BaseBrief receiver-ready handoff written to ${result.output}`,
    `handoff_status=${result.handoff_status}`,
    `reviewed_fields=${result.reviewed_fields.length}`,
    "",
  ].join(os.EOL);
}

function cli() {
  try {
    const options = parseArgs(process.argv);
    const result = runReviewDraft(options);
    process.stdout.write(options.jsonMode ? `${JSON.stringify(result, null, 2)}\n` : formatHuman(result));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) cli();

module.exports = {
  BLOCKED_MARKER_PATTERNS,
  REQUIRED_REVIEW_FIELDS,
  REVIEW_DRAFT_SCHEMA_VERSION,
  buildReceiverReady,
  extractMarkdownSection,
  formatHuman,
  parseArgs,
  resolveDraftPath,
  resolveOutputPath,
  runReviewDraft,
  validateReviewedDraft,
};
