#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function commonPrefixLength(strings) {
  if (!strings.length) return 0;
  const shortest = strings.reduce((min, value) => Math.min(min, value.length), strings[0].length);
  let index = 0;
  while (index < shortest) {
    const ch = strings[0][index];
    if (!strings.every((value) => value[index] === ch)) break;
    index += 1;
  }
  return index;
}

function extractSectionLabel(line, lineNumber) {
  const headingMatch = line.match(/^#+\s*(.+)$/);
  if (headingMatch) return headingMatch[1].trim();
  const fieldMatch = line.match(/^([A-Za-z0-9_\- ]+):/);
  if (fieldMatch) return fieldMatch[1].trim();
  return `line:${lineNumber}`;
}

function extractOrderedFields(content) {
  return content
    .split("\n")
    .map((line) => line.match(/^([A-Za-z0-9_\- ]+):/))
    .filter(Boolean)
    .map((match) => match[1].trim());
}

function compareFieldOrder(fieldLists) {
  if (fieldLists.length <= 1) return true;
  const baseline = JSON.stringify(fieldLists[0]);
  return fieldLists.every((fields) => JSON.stringify(fields) === baseline);
}

function measureContents(contents) {
  const normalized = contents.map((value) => String(value).replace(/\r\n/g, "\n"));
  const prefixChars = commonPrefixLength(normalized);
  const prefix = normalized[0].slice(0, prefixChars);
  const linesByFile = normalized.map((value) => value.split("\n"));
  const fileMetrics = normalized.map((value) => ({
    totalLengthChars: value.length,
    totalLengthBytes: Buffer.byteLength(value, "utf8"),
    dynamicSuffixChars: value.length - prefixChars,
    dynamicSuffixBytes: Buffer.byteLength(value.slice(prefixChars), "utf8"),
    orderedFields: extractOrderedFields(value),
  }));

  const allSectionLabels = new Set();
  const changedSections = new Set();
  const maxLines = Math.max(...linesByFile.map((lines) => lines.length));
  for (let index = 0; index < maxLines; index += 1) {
    const lines = linesByFile.map((fileLines) => fileLines[index] ?? "");
    lines.forEach((line) => allSectionLabels.add(extractSectionLabel(line, index + 1)));
    if (!lines.every((line) => line === lines[0])) {
      lines.forEach((line) => changedSections.add(extractSectionLabel(line, index + 1)));
    }
  }

  const missingSectionsByFile = fileMetrics.map((metric) => {
    const ownFields = new Set(metric.orderedFields);
    return Array.from(allSectionLabels).filter((label) => /^[A-Za-z0-9_\- ]+$/.test(label) && !ownFields.has(label));
  });

  return {
    commonPrefixChars: prefixChars,
    commonPrefixBytes: Buffer.byteLength(prefix, "utf8"),
    commonPrefixLines: prefix ? prefix.split("\n").length - 1 : 0,
    exactMatch: normalized.every((value) => value === normalized[0]),
    totalLengthChars: fileMetrics.map((metric) => metric.totalLengthChars),
    totalLengthBytes: fileMetrics.map((metric) => metric.totalLengthBytes),
    dynamicSuffixChars: fileMetrics.map((metric) => metric.dynamicSuffixChars),
    dynamicSuffixBytes: fileMetrics.map((metric) => metric.dynamicSuffixBytes),
    changedSections: Array.from(changedSections),
    fieldOrderConsistent: compareFieldOrder(fileMetrics.map((metric) => metric.orderedFields)),
    missingSectionsByFile,
  };
}

function measureFiles(filePaths) {
  const absolute = filePaths.map((filePath) => path.resolve(filePath));
  const contents = absolute.map((filePath) => fs.readFileSync(filePath, "utf8"));
  return {
    files: absolute.map((filePath, index) => ({
      path: filePath,
      chars: contents[index].length,
      bytes: Buffer.byteLength(contents[index], "utf8"),
      lines: contents[index] ? contents[index].replace(/\r\n/g, "\n").split("\n").length : 0,
    })),
    ...measureContents(contents),
  };
}

function cli() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes("--json");
  const files = args.filter((arg) => arg !== "--json");
  if (files.length < 2) {
    console.error("Usage: node scripts/prompt_stability_probe.js <file1> <file2> [file3 ...] [--json]");
    process.exit(1);
  }
  const result = measureFiles(files);
  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`commonPrefixChars=${result.commonPrefixChars}`);
  console.log(`commonPrefixBytes=${result.commonPrefixBytes}`);
  console.log(`commonPrefixLines=${result.commonPrefixLines}`);
  console.log(`exactMatch=${result.exactMatch}`);
  console.log(`dynamicSuffixChars=${result.dynamicSuffixChars.join(",")}`);
  console.log(`fieldOrderConsistent=${result.fieldOrderConsistent}`);
  console.log(`changedSections=${result.changedSections.join("|")}`);
}

if (require.main === module) {
  cli();
}

module.exports = { measureFiles, measureContents };
