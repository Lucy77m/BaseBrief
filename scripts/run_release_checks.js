#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { routeMode } = require("./mode_router");
const { generateFromObject } = require("./generate_cache_ready_lite");
const { measureContents } = require("./prompt_stability_probe");
const { runProviderProbe } = require("./provider_cache_probe");

const repoRoot = path.resolve(__dirname, "..");

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function walkFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "private") {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkFiles(fullPath));
    } else {
      result.push(fullPath);
    }
  }
  return result;
}

function checkRequiredFiles() {
  const required = [
    "README.md",
    "skills/basebrief/SKILL.md",
    "skills/basebrief/modes/full.md",
    "skills/basebrief/modes/lite.md",
    "skills/basebrief/modes/cache-ready.md",
    "skills/basebrief/agents/openai.yaml",
    "templates/zh-CN/BASEBRIEF.md",
    "templates/zh-CN/BASEBRIEF_LITE.md",
    "templates/zh-CN/NEXT_CHAT_PROMPT.md",
    "templates/zh-CN/AGENT_TASK.md",
    "templates/zh-CN/RISK_NOTES.md",
    "templates/zh-CN/CACHE_PREFIX.md",
    "templates/zh-CN/CACHE_READY_LITE_INPUT.json",
    "docs/usage.md",
    "docs/mode-selection.md",
    "docs/testing.md",
    "docs/experiments/cache-ready-lite.md",
    "README.en.md",
    "scripts/mode_router.js",
    "scripts/generate_cache_ready_lite.js",
    "scripts/prompt_stability_probe.js",
    "scripts/provider_cache_probe.js",
    "scripts/provider_cache_benchmark.js",
    "examples/full-example.md",
    "examples/lite-example.md",
    "examples/cache-ready-input.json",
    "examples/cache-ready-output.md",
    "examples/next-chat-example.md",
    "examples/agent-task-example.md",
  ];
  required.forEach((relativePath) => {
    assert(fs.existsSync(path.join(repoRoot, relativePath)), `Missing required file: ${relativePath}`);
  });
}

function checkContentContracts() {
  const skill = readText("skills/basebrief/SKILL.md");
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const fullTemplate = readText("templates/zh-CN/BASEBRIEF.md");
  const liteTemplate = readText("templates/zh-CN/BASEBRIEF_LITE.md");
  const nextChatTemplate = readText("templates/zh-CN/NEXT_CHAT_PROMPT.md");
  const agentTaskTemplate = readText("templates/zh-CN/AGENT_TASK.md");
  const riskTemplate = readText("templates/zh-CN/RISK_NOTES.md");
  const cachePrefixTemplate = readText("templates/zh-CN/CACHE_PREFIX.md");
  const yaml = readText("skills/basebrief/agents/openai.yaml");

  ["full", "lite", "cache-ready"].forEach((mode) => {
    assert(skill.includes(mode), `SKILL.md must mention mode: ${mode}`);
    assert(readme.includes(mode), `README.md must mention mode: ${mode}`);
  });
  assert(readme.includes("对外只有一个入口"), "README.md must state that BaseBrief has one public entry");
  assert(readme.includes("README.en.md"), "README.md should link to README.en.md");
  assert(englishReadme.includes("One install, one entry"), "README.en.md must explain one install, one entry");
  assert(englishReadme.includes("cache-ready"), "README.en.md must describe cache-ready mode");
  assert(!/two skills/i.test(englishReadme), "README.en.md must not imply two skills");

  [
    "verified_facts",
    "confirmed_decisions",
    "assumptions",
    "open_questions",
    "risk_boundaries",
  ].forEach((token) => {
    assert(fullTemplate.includes(token), `BASEBRIEF.md missing required token: ${token}`);
    assert(liteTemplate.includes(token), `BASEBRIEF_LITE.md missing required token: ${token}`);
  });

  ["新窗口开场白建议", "Agent 任务说明建议", "缓存前缀建议"].forEach((section) => {
    assert(fullTemplate.includes(section), `BASEBRIEF.md missing full-only section: ${section}`);
  });

  ["verified_facts", "confirmed_decisions", "assumptions", "open_questions", "risk_boundaries"].forEach((token) => {
    assert(
      nextChatTemplate.includes(token) ||
        agentTaskTemplate.includes(token) ||
        riskTemplate.includes(token) ||
        cachePrefixTemplate.includes(token),
      `Shared templates should mention required token somewhere: ${token}`,
    );
  });

  assert(liteTemplate.length < fullTemplate.length, "BASEBRIEF_LITE.md must stay shorter than BASEBRIEF.md");
  assert(!/changelog/i.test(liteTemplate), "BASEBRIEF_LITE.md must not grow into changelog-like content");

  const shortMatch = yaml.match(/short_description:\s*"([^"]+)"/);
  const promptMatch = yaml.match(/default_prompt:\s*"([^"]+)"/);
  assert(shortMatch && shortMatch[1].length >= 25 && shortMatch[1].length <= 64, "openai.yaml short_description must be 25-64 chars");
  assert(promptMatch && promptMatch[1].includes("$basebrief"), "openai.yaml default_prompt must mention $basebrief");

  const skillDirs = fs.readdirSync(path.join(repoRoot, "skills"));
  assert(skillDirs.length === 1 && skillDirs[0] === "basebrief", "There must be exactly one public skill entry under skills/");
}

function checkModeRouting() {
  const cases = [
    { id: "A1", text: "请整理复杂项目阶段基线，并补新窗口开场白和 Agent 任务说明。", expected: "full" },
    { id: "B1", text: "请做一个 lite 接续，只读分析后给我 1 到 2 个文件的小范围下一步。", expected: "lite" },
    { id: "C1", text: "请处理 backend、provider 和 .env，顺便帮我部署。", expected: "full" },
    { id: "C2", text: "这个项目有 state、memory 和 gateway，先帮我整体优化一下。", expected: "full" },
    { id: "C3", text: "边界不清，先随便帮我推进。", expected: "full" },
    { id: "C4", text: "请把 provider 接入和 API key 一起配好。", expected: "full" },
    { id: "C5", text: "这个任务要同时改 backend、frontend 和 deploy。", expected: "full" },
    { id: "C6", text: "这是一个真实 Agent runtime，还带 state 和 memory。", expected: "full" },
    { id: "C7", text: "用户只说帮我优化一下，而且边界模糊但要快速推进。", expected: "full" },
    { id: "C8", text: "这次是多文件大改。", expected: "full" },
    { id: "D1", text: "请用 cache-ready 模式生成稳定前缀，我要做 prompt cache 代理实验。", expected: "cache-ready" },
  ];
  cases.forEach((testCase) => {
    const actual = routeMode(testCase.text);
    assert(actual === testCase.expected, `Mode routing failed for ${testCase.id}: expected ${testCase.expected}, got ${actual}`);
  });
  return cases.length;
}

function checkSecurity() {
  const winSep = "\\\\";
  const joined = (...parts) => parts.join("");
  const forbiddenContentPatterns = [
    new RegExp(`C:${winSep}${joined("Us", "ers")}${winSep}`, "i"),
    new RegExp(`D:${winSep}${joined("Base", "Brief-Lite")}${winSep}`, "i"),
    new RegExp(`D:${winSep}${joined("xiao", "xian")}`, "i"),
    new RegExp(`D:${winSep}${joined("Open", "ClawNative")}`, "i"),
    new RegExp(`${"\\."}${joined("open", "claw")}`, "i"),
    new RegExp(`C:${"/"}`, "i"),
    new RegExp(`D:${"/"}`, "i"),
    /\/home\//i,
    /Authorization\s*:\s*["']?\s*Bearer\s+[A-Za-z0-9._-]{6,}/i,
    /Bearer\s+[A-Za-z0-9._-]{10,}/,
    /api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9._-]{6,}/i,
    /token\s*[:=]\s*["']?[A-Za-z0-9._-]{6,}/i,
    /secret\s*[:=]\s*["']?[A-Za-z0-9._-]{6,}/i,
    /OPENAI_API_KEY\s*=/i,
    /ANTHROPIC_API_KEY\s*=/i,
    /OPENROUTER_API_KEY\s*=/i,
    /sk-[A-Za-z0-9]{10,}/,
  ];
  const forbiddenPathParts = ["node_modules", "dist", ".cache"];
  const forbiddenFileNames = [".env", ".env.local", ".env.production", ".env.development", ".env.test"];
  const forbiddenExtensions = [".zip", ".log"];

  const files = walkFiles(repoRoot);
  files.forEach((fullPath) => {
    const relative = path.relative(repoRoot, fullPath).replace(/\\/g, "/");
    if (
      relative === "scripts/run_release_checks.js" ||
      relative === "scripts/provider_cache_probe.js" ||
      relative === "scripts/provider_cache_benchmark.js"
    ) {
      return;
    }
    forbiddenPathParts.forEach((part) => {
      assert(!relative.split("/").includes(part), `Forbidden generated directory tracked: ${relative}`);
    });
    assert(!forbiddenFileNames.includes(path.basename(fullPath)), `Forbidden env-like file tracked: ${relative}`);
    assert(!forbiddenExtensions.includes(path.extname(fullPath).toLowerCase()), `Forbidden artifact extension tracked: ${relative}`);
    const content = fs.readFileSync(fullPath, "utf8");
    forbiddenContentPatterns.forEach((pattern) => {
      assert(!pattern.test(content), `Forbidden content pattern ${pattern} found in ${relative}`);
    });
  });
  return files.length;
}

function checkLinks() {
  const markdownFiles = walkFiles(repoRoot).filter((filePath) => filePath.endsWith(".md"));
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
  let checked = 0;
  markdownFiles.forEach((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    let match;
    while ((match = linkPattern.exec(content)) !== null) {
      const target = match[1];
      if (/^(https?:|mailto:|#)/i.test(target)) continue;
      if (target.startsWith("/")) continue;
      const resolved = path.resolve(path.dirname(filePath), target);
      assert(fs.existsSync(resolved), `Broken relative link in ${path.relative(repoRoot, filePath)} -> ${target}`);
      checked += 1;
    }
  });
  return checked;
}

function checkExamples() {
  const exampleFiles = [
    "examples/full-example.md",
    "examples/lite-example.md",
    "examples/cache-ready-input.json",
    "examples/cache-ready-output.md",
    "examples/next-chat-example.md",
    "examples/agent-task-example.md",
  ];
  exampleFiles.forEach((relativePath) => {
    assert(fs.existsSync(path.join(repoRoot, relativePath)), `Missing example: ${relativePath}`);
  });
  return exampleFiles.length;
}

function checkBenchmarkSummaryIfPresent() {
  const summaries = [
    "tests/outputs/provider-cache-benchmark.latest.json",
    "tests/outputs/provider-cache-benchmark-normalized.latest.json",
  ];
  const statuses = [];
  summaries.forEach((relativePath) => {
    const fullPath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(fullPath)) {
      return;
    }
    const summary = readJson(relativePath);
    assert(summary.benchmarkKind === "local-real-projects-redacted", "Benchmark summary must be public-redacted");
    assert(summary.projectCount >= 1, "Benchmark summary must include project count");
    assert(summary.requestCount >= summary.validRequestCount, "Benchmark summary request counts are inconsistent");
    assert(!JSON.stringify(summary).match(/[A-Z]:\\|\/home\/|sk-[A-Za-z0-9]{10,}/), "Benchmark summary contains private path or key-like content");
    statuses.push(`${summary.mode || "absolute"}:${summary.conclusionLevel || "present"}`);
  });
  return statuses.length ? statuses.join(",") : "absent";
}

function checkIndependentTests() {
  const tests = ["tests/basebrief.test.js"];
  tests.forEach((relativePath) => {
    assert(fs.existsSync(path.join(repoRoot, relativePath)), `Missing independent test: ${relativePath}`);
  });
  execFileSync(process.execPath, ["--test", ...tests], {
    cwd: repoRoot,
    stdio: "pipe",
    env: process.env,
  });
  return tests.length;
}

function checkCacheReadyProxy() {
  const naturalA = readText("tests/fixtures/cache-ready/lite-natural-a.md");
  const naturalB = readText("tests/fixtures/cache-ready/lite-natural-b.md");
  const naturalC = readText("tests/fixtures/cache-ready/lite-natural-c.md");
  const followupA = readText("tests/fixtures/cache-ready/lite-followup-a.md");
  const followupB = readText("tests/fixtures/cache-ready/lite-followup-b.md");

  const cacheA = generateFromObject(readJson("tests/fixtures/cache-ready/cache-ready-a.json"));
  const cacheB = generateFromObject(readJson("tests/fixtures/cache-ready/cache-ready-b.json"));
  const cacheC = generateFromObject(readJson("tests/fixtures/cache-ready/cache-ready-c.json"));
  const cacheFollowupA = generateFromObject(readJson("tests/fixtures/cache-ready/cache-ready-followup-a.json"));
  const cacheFollowupB = generateFromObject(readJson("tests/fixtures/cache-ready/cache-ready-followup-b.json"));
  const cacheShuffled = generateFromObject(readJson("tests/fixtures/cache-ready/cache-ready-shuffled.json"));

  const sameProjectNatural = measureContents([naturalA, naturalB]);
  const sameProjectCache = measureContents([cacheA, cacheB]);
  const crossProjectNatural = measureContents([naturalA, naturalC]);
  const crossProjectCache = measureContents([cacheA, cacheC]);
  const followupNatural = measureContents([followupA, followupB]);
  const followupCache = measureContents([cacheFollowupA, cacheFollowupB]);
  const shuffledConsistency = measureContents([cacheA, cacheShuffled]);

  assert(sameProjectCache.commonPrefixChars > sameProjectNatural.commonPrefixChars, "Cache-ready should improve same-project shared prefix");
  assert(crossProjectCache.commonPrefixChars > crossProjectNatural.commonPrefixChars, "Cache-ready should improve cross-project shared prefix");
  assert(followupCache.commonPrefixChars >= followupNatural.commonPrefixChars, "Cache-ready should not regress repeated follow-up shared prefix");
  assert(followupCache.changedSections.includes("TAIL_REQUEST"), "Follow-up comparison should report TAIL_REQUEST as changed");
  assert(followupCache.fieldOrderConsistent, "Cache-ready follow-up outputs should keep field order stable");
  assert(shuffledConsistency.exactMatch, "Shuffled input keys should generate the same output");
  assert(shuffledConsistency.fieldOrderConsistent, "Shuffled input keys must not change generated field order");

  let missingFieldRejected = false;
  try {
    generateFromObject(readJson("tests/fixtures/cache-ready/cache-ready-missing.json"));
  } catch (error) {
    missingFieldRejected = /Missing required key: tail_request/i.test(error.message);
  }
  assert(missingFieldRejected, "Missing field input must be rejected by cache-ready generator");

  return {
    sameProjectNatural: sameProjectNatural.commonPrefixChars,
    sameProjectCache: sameProjectCache.commonPrefixChars,
    crossProjectNatural: crossProjectNatural.commonPrefixChars,
    crossProjectCache: crossProjectCache.commonPrefixChars,
    followupNatural: followupNatural.commonPrefixChars,
    followupCache: followupCache.commonPrefixChars,
    followupChangedSections: followupCache.changedSections,
    followupDynamicSuffixChars: followupCache.dynamicSuffixChars,
    fieldOrderConsistent: followupCache.fieldOrderConsistent,
    missingFieldRejected,
  };
}

async function main() {
  checkRequiredFiles();
  checkContentContracts();
  const modeCases = checkModeRouting();
  const scannedFiles = checkSecurity();
  const checkedLinks = checkLinks();
  const exampleCount = checkExamples();
  const benchmarkSummaryStatus = checkBenchmarkSummaryIfPresent();
  const independentTests = checkIndependentTests();
  const proxy = checkCacheReadyProxy();
  const providerProbe = await runProviderProbe();

  console.log("BaseBrief release checks passed.");
  console.log(`mode_cases=${modeCases}`);
  console.log(`scanned_files=${scannedFiles}`);
  console.log(`checked_links=${checkedLinks}`);
  console.log(`example_files=${exampleCount}`);
  console.log(`benchmark_summary_status=${benchmarkSummaryStatus}`);
  console.log(`independent_test_files=${independentTests}`);
  console.log(`provider_probe_status=${providerProbe.status}`);
  console.log(`same_project_natural=${proxy.sameProjectNatural}`);
  console.log(`same_project_cache_ready=${proxy.sameProjectCache}`);
  console.log(`cross_project_natural=${proxy.crossProjectNatural}`);
  console.log(`cross_project_cache_ready=${proxy.crossProjectCache}`);
  console.log(`followup_natural=${proxy.followupNatural}`);
  console.log(`followup_cache_ready=${proxy.followupCache}`);
  console.log(`followup_dynamic_suffix_chars=${proxy.followupDynamicSuffixChars.join(",")}`);
  console.log(`followup_changed_sections=${proxy.followupChangedSections.join("|")}`);
  console.log(`cache_ready_field_order_consistent=${proxy.fieldOrderConsistent}`);
  console.log(`cache_ready_missing_field_rejected=${proxy.missingFieldRejected}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
