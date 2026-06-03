#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");

const { generateBb9HandoffFromObject } = require("./generate_bb9_handoff");
const bb9Schema = require("../schemas/bb9-handoff.schema.json");

const BEGIN_MARKER = "<!-- BASEBRIEF_HANDOFF_JSON_BEGIN -->";
const END_MARKER = "<!-- BASEBRIEF_HANDOFF_JSON_END -->";

function readJsonFile(inputPath) {
  try {
    return JSON.parse(fs.readFileSync(inputPath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid handoff JSON: ${error.message}`);
  }
}

function extractHandoffJsonBlock(markdown) {
  const begin = markdown.indexOf(BEGIN_MARKER);
  const end = markdown.indexOf(END_MARKER);
  if (begin < 0 || end < 0 || end <= begin) {
    throw new Error("Missing BASEBRIEF handoff JSON block");
  }
  const rawBlock = markdown.slice(begin + BEGIN_MARKER.length, end).trim();
  const fenced = rawBlock.match(/^```json\s*\n([\s\S]*?)\n```$/i);
  if (!fenced) {
    throw new Error("BASEBRIEF handoff JSON block must be fenced as ```json");
  }
  try {
    return JSON.parse(fenced[1]);
  } catch (error) {
    throw new Error(`Invalid handoff JSON: ${error.message}`);
  }
}

function readHandoffInput(inputPath) {
  const resolved = path.resolve(inputPath);
  if (path.extname(resolved).toLowerCase() === ".json") {
    return readJsonFile(resolved);
  }
  return extractHandoffJsonBlock(fs.readFileSync(resolved, "utf8"));
}

function validateHandoffInput(input) {
  const allowed = new Set(Object.keys(bb9Schema.properties));
  for (const key of bb9Schema.required) {
    if (!(key in input)) {
      throw new Error(`Missing required key: ${key}`);
    }
  }
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
      throw new Error(`Unexpected key: ${key}`);
    }
  }
  if ("mode" in input && !bb9Schema.properties.mode.enum.includes(input.mode)) {
    throw new Error("mode must be full or lite");
  }
  for (const [key, rule] of Object.entries(bb9Schema.properties)) {
    if (!(key in input)) continue;
    if (rule.type === "string" && typeof input[key] !== "string") {
      throw new Error(`Expected string for key: ${key}`);
    }
    if (rule.minLength && typeof input[key] === "string" && input[key].trim().length < rule.minLength) {
      throw new Error(`Empty required value: ${key}`);
    }
    if (rule.$ref === "#/$defs/stringArray" || rule.$ref === "#/$defs/nonEmptyStringArray") {
      if (!Array.isArray(input[key])) {
        throw new Error(`Expected array for key: ${key}`);
      }
      if (rule.$ref === "#/$defs/nonEmptyStringArray" && input[key].length === 0) {
        throw new Error(`Array must contain at least one item: ${key}`);
      }
      input[key].forEach((item) => {
        if (typeof item !== "string") {
          throw new Error(`Expected string items for key: ${key}`);
        }
        if (rule.$ref === "#/$defs/nonEmptyStringArray" && !item.trim()) {
          throw new Error(`Array must contain non-empty string items: ${key}`);
        }
      });
    }
  }
}

function projectMeta(output) {
  return {
    selectedVariant: output.selectedVariant,
    recommendedPromptType: output.recommendedPromptType,
    providerProfile: output.providerProfile,
    fallbackReason: output.fallbackReason,
    promptUsePolicy: output.promptUsePolicy,
    warnings: output.warnings,
    artifacts: {
      readableBrief: "readableBrief.md",
      cacheSidecar: output.cacheSidecar ? "cacheSidecar.md" : null,
      activeProviderPrompt: "activeProviderPrompt.md",
      meta: "handoff.meta.json",
    },
  };
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

function buildHandoffArtifacts(options) {
  if (!options.inputPath) {
    throw new Error("Missing --input <markdown-or-json>");
  }
  if (!options.outputDir) {
    throw new Error("Missing --output-dir <dir>");
  }

  const input = readHandoffInput(options.inputPath);
  validateHandoffInput(input);
  const output = generateBb9HandoffFromObject(input, {
    mode: options.mode || input.mode,
    providerProfile: options.providerProfile || input.provider_profile,
  });
  const outputDir = path.resolve(options.outputDir);

  writeText(path.join(outputDir, "readableBrief.md"), output.readableBrief);
  writeText(path.join(outputDir, "activeProviderPrompt.md"), output.activeProviderPrompt);
  if (output.cacheSidecar) {
    writeText(path.join(outputDir, "cacheSidecar.md"), output.cacheSidecar);
  }
  writeText(path.join(outputDir, "handoff.meta.json"), `${JSON.stringify(projectMeta(output), null, 2)}\n`);

  return {
    outputDir,
    wroteCacheSidecar: Boolean(output.cacheSidecar),
    meta: projectMeta(output),
  };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const inputIndex = args.indexOf("--input");
  const outputDirIndex = args.indexOf("--output-dir");
  const modeIndex = args.indexOf("--mode");
  const profileIndex = args.indexOf("--provider-profile");
  return {
    inputPath: inputIndex >= 0 ? args[inputIndex + 1] : "",
    outputDir: outputDirIndex >= 0 ? args[outputDirIndex + 1] : "",
    mode: modeIndex >= 0 ? args[modeIndex + 1] : "",
    providerProfile: profileIndex >= 0 ? args[profileIndex + 1] : "",
    jsonMode: args.includes("--json"),
  };
}

function cli() {
  const options = parseArgs(process.argv);
  const result = buildHandoffArtifacts(options);
  if (options.jsonMode) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`BaseBrief handoff artifacts written to ${path.relative(process.cwd(), result.outputDir) || "."}${os.EOL}`);
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
  BEGIN_MARKER,
  END_MARKER,
  buildHandoffArtifacts,
  extractHandoffJsonBlock,
  readHandoffInput,
  validateHandoffInput,
};
