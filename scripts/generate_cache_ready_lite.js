#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function sanitize(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " / ")
    .replace(/\s+/g, " ")
    .trim();
}

function readString(data, key) {
  if (!(key in data)) throw new Error(`Missing required key: ${key}`);
  const value = sanitize(data[key]);
  if (!value) throw new Error(`Empty required value: ${key}`);
  return value;
}

function readArray(data, key) {
  if (!(key in data)) throw new Error(`Missing required key: ${key}`);
  if (!Array.isArray(data[key])) throw new Error(`Expected array for key: ${key}`);
  const values = data[key].map((item) => sanitize(item)).filter(Boolean);
  if (values.length === 0) throw new Error(`Array must contain at least one item: ${key}`);
  return values;
}

function pushField(lines, key, value) {
  lines.push(`${key}: ${sanitize(value)}`);
}

function pushList(lines, key, items) {
  lines.push(`${key}_COUNT: ${items.length}`);
  items.forEach((item, index) => {
    lines.push(`${key}_${index + 1}: ${sanitize(item)}`);
  });
}

function generateFromObject(data) {
  const lines = [];
  lines.push("# BaseBrief Cache-ready Lite v1");
  lines.push("");
  lines.push("NOTICE: Experimental mode. Stable-prefix proxy only. Not provider-level cache proof.");
  lines.push("RULE: Keep fixed fields unchanged whenever prefix reuse is the goal.");
  lines.push("RULE: Put request-specific variation only in TAIL_REQUEST.");
  lines.push("SCHEMA_VERSION: 1");
  lines.push("MODE_FAMILY: BASEBRIEF_CACHE_READY");
  lines.push("BEGIN_VARIABLE_BLOCK");
  pushField(lines, "MODE", readString(data, "mode"));
  pushField(lines, "PROJECT_NAME", readString(data, "project_name"));
  pushField(lines, "PROJECT_IDENTITY", readString(data, "project_identity"));
  pushField(lines, "CURRENT_GOAL", readString(data, "current_goal"));
  pushList(lines, "VERIFIED_FACT", readArray(data, "verified_facts"));
  pushList(lines, "CONFIRMED_DECISION", readArray(data, "confirmed_decisions"));
  pushList(lines, "ASSUMPTION", readArray(data, "assumptions"));
  pushList(lines, "OPEN_QUESTION", readArray(data, "open_questions"));
  pushList(lines, "RISK_BOUNDARY", readArray(data, "risk_boundaries"));
  pushList(lines, "ALLOWED_SCOPE", readArray(data, "allowed_scope"));
  pushList(lines, "FORBIDDEN_SCOPE", readArray(data, "forbidden_scope"));
  pushField(lines, "NEXT_ACTION", readString(data, "next_action"));
  pushField(lines, "EXPECTED_OUTPUT", readString(data, "expected_output"));
  pushField(lines, "TAIL_REQUEST", readString(data, "tail_request"));
  lines.push("END_VARIABLE_BLOCK");
  return `${lines.join("\n")}\n`;
}

function cli() {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath) {
    console.error("Usage: node scripts/generate_cache_ready_lite.js <input.json> [output.txt]");
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(path.resolve(inputPath), "utf8"));
  const output = generateFromObject(data);
  if (outputPath) {
    fs.writeFileSync(path.resolve(outputPath), output, "utf8");
  } else {
    process.stdout.write(output);
  }
}

if (require.main === module) {
  cli();
}

module.exports = { generateFromObject };
