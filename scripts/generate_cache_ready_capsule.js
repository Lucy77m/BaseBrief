#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function sanitize(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " / ")
    .replace(/[|]/g, "/")
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
  lines.push(`${key}=${sanitize(value)}`);
}

function pushList(lines, key, values) {
  lines.push(`${key}=${values.join(" ; ")}`);
}

function generateCapsuleFromObject(data) {
  const lines = ["BB2"];
  pushField(lines, "P", readString(data, "project_identity"));
  pushField(lines, "G", readString(data, "current_goal"));
  pushList(lines, "F", readArray(data, "verified_facts"));
  pushList(lines, "D", readArray(data, "confirmed_decisions"));
  pushList(lines, "R", readArray(data, "risk_boundaries"));
  pushList(lines, "X", readArray(data, "forbidden_scope"));
  pushField(lines, "O", readString(data, "expected_output"));
  lines.push("--");
  pushField(lines, "T", readString(data, "tail_request"));
  return `${lines.join("\n")}\n`;
}

function cli() {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath) {
    console.error("Usage: node scripts/generate_cache_ready_capsule.js <input.json> [output.txt]");
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(path.resolve(inputPath), "utf8"));
  const output = generateCapsuleFromObject(data);
  if (outputPath) {
    fs.writeFileSync(path.resolve(outputPath), output, "utf8");
  } else {
    process.stdout.write(output);
  }
}

if (require.main === module) {
  cli();
}

module.exports = { generateCapsuleFromObject };
