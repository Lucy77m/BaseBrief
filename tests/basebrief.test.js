const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { generateFromObject } = require("../scripts/generate_cache_ready_lite");
const { generateCapsuleFromObject } = require("../scripts/generate_cache_ready_capsule");
const { generateAnchorFromObject } = require("../scripts/generate_cache_ready_anchor");
const { buildSummary, getPromptForVariant, SCENARIOS, PROVIDER_PROFILES } = require("../scripts/provider_cache_benchmark");
const { routeMode } = require("../scripts/mode_router");

const repoRoot = path.resolve(__dirname, "..");

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

test("mode router selects full for complex or risky requests", () => {
  const cases = [
    "请整理完整阶段基线，并生成新窗口开场和 Agent 任务说明。",
    "这个任务涉及 backend、provider 和部署，先做阶段基线。",
    "边界不清，帮我优化一下。",
    "真实 Agent runtime 里有 state、memory 和 gateway。",
  ];

  for (const input of cases) {
    assert.equal(routeMode(input), "full", input);
  }
});

test("mode router selects lite only for bounded lightweight continuation", () => {
  const cases = [
    "请做一个 lite 接续，只读分析一个文件。",
    "本轮是简短交接，范围是 1 到 2 个文件的小范围任务。",
  ];

  for (const input of cases) {
    assert.equal(routeMode(input), "lite", input);
  }
});

test("mode router selects cache-ready only for stable-prefix experiments", () => {
  const cases = [
    "请用 cache-ready 模式生成稳定前缀。",
    "我要做 prompt cache 和缓存代理实验。",
  ];

  for (const input of cases) {
    assert.equal(routeMode(input), "cache-ready", input);
  }
});

test("mode router asks for clarification when no mode signal is present", () => {
  assert.equal(routeMode("请继续。"), "needs-clarification");
});

test("cache-ready generator keeps output stable for identical structured input", () => {
  const input = readJson("tests/fixtures/cache-ready/cache-ready-a.json");
  const first = generateFromObject(input);
  const second = generateFromObject(input);

  assert.equal(first, second);
  assert.match(first, /MODE_FAMILY: BASEBRIEF_CACHE_READY/);
  assert.match(first, /TAIL_REQUEST:/);
});

test("cache-ready generator uses fixed field order independent of object key order", () => {
  const normal = generateFromObject(readJson("tests/fixtures/cache-ready/cache-ready-a.json"));
  const shuffled = generateFromObject(readJson("tests/fixtures/cache-ready/cache-ready-shuffled.json"));

  assert.equal(normal, shuffled);
});

test("cache-ready generator rejects missing required fields", () => {
  const input = readJson("tests/fixtures/cache-ready/cache-ready-missing.json");

  assert.throws(() => generateFromObject(input), /Missing required key: tail_request/);
});

test("cache-ready capsule v2 keeps compact deterministic field order", () => {
  const input = readJson("tests/fixtures/cache-ready/cache-ready-a.json");
  const first = generateCapsuleFromObject(input);
  const second = generateCapsuleFromObject(input);

  assert.equal(first, second);
  assert.equal(first.split("\n").slice(0, 9).join("\n"), [
    "BB2",
    `P=${input.project_identity}`,
    `G=${input.current_goal}`,
    `F=${input.verified_facts.join(" ; ")}`,
    `D=${input.confirmed_decisions.join(" ; ")}`,
    `R=${input.risk_boundaries.join(" ; ")}`,
    `X=${input.forbidden_scope.join(" ; ")}`,
    `O=${input.expected_output}`,
    "--",
  ].join("\n"));
  assert.match(first, /\nT=/);
  assert.doesNotMatch(first, /NOTICE|SCHEMA_VERSION|COUNT|ASSUMPTION|OPEN_QUESTION|ALLOWED_SCOPE/);
});

test("cache-ready capsule v2 is stable across shuffled input and rejects missing fields", () => {
  const normal = generateCapsuleFromObject(readJson("tests/fixtures/cache-ready/cache-ready-a.json"));
  const shuffled = generateCapsuleFromObject(readJson("tests/fixtures/cache-ready/cache-ready-shuffled.json"));

  assert.equal(normal, shuffled);
  assert.throws(
    () => generateCapsuleFromObject(readJson("tests/fixtures/cache-ready/cache-ready-missing.json")),
    /Missing required key: tail_request/,
  );
});

test("cache-ready capsule v2 is substantially shorter than v1 for the same input", () => {
  const input = readJson("tests/fixtures/cache-ready/cache-ready-a.json");
  const v1 = generateFromObject(input);
  const v2 = generateCapsuleFromObject(input);
  const reduction = (v1.length - v2.length) / v1.length;

  assert(reduction >= 0.25, `Expected v2 to be at least 25% shorter; got ${reduction}`);
});

test("cache-ready anchor v3 pre-registers tail options and keeps only choice dynamic", () => {
  const input = readJson("examples/cache-ready-anchor-input.json");
  const first = generateAnchorFromObject(input);
  const second = generateAnchorFromObject(input);

  assert.equal(first, second);
  assert.match(first, /^BB3\n/);
  assert.match(first, /\nQAA=Restate the project state briefly/);
  assert.match(first, /\nQAB=Generate a short next-chat opener/);
  assert.match(first, /\n--\nQ=A\n$/);
  assert.doesNotMatch(first.split("\n--\n")[1], /Restate|Generate|project state|next-chat/);
});

test("cache-ready anchor v3 validates tail options and choice", () => {
  const input = readJson("examples/cache-ready-anchor-input.json");
  const changedChoice = { ...input, tail_choice: "B" };

  assert.match(generateAnchorFromObject(changedChoice), /\n--\nQ=B\n$/);
  assert.throws(() => generateAnchorFromObject({ ...input, tail_options: ["only one"] }), /tail_options must contain at least two items/);
  assert.throws(() => generateAnchorFromObject({ ...input, tail_choice: "Z" }), /tail_choice must be one of/);
});

test("cache-ready anchor pad v4 emits stable pad before dynamic choice", () => {
  const input = readJson("examples/cache-ready-anchor-pad-input.json");
  const output = generateAnchorFromObject(input);

  assert.match(output, /\nPAD=p p p p p p p p\n--\nQ=A\n$/);
  assert.doesNotMatch(output.split("\n--\n")[1], /PAD|Restate|Generate/);
});

test("cache-ready anchor pad v4 rejects missing or invalid pad values", () => {
  const input = readJson("examples/cache-ready-anchor-pad-input.json");
  const tooLongPad = Array.from({ length: 65 }, () => "p").join(" ");

  assert.throws(() => {
    const missing = { ...input };
    delete missing.cache_pad;
    generateAnchorFromObject(missing);
  }, /Missing required key: cache_pad/);
  assert.throws(() => generateAnchorFromObject({ ...input, cache_pad: "" }), /Empty required value: cache_pad/);
  assert.throws(() => generateAnchorFromObject({ ...input, cache_pad: "p x p" }), /only lowercase p tokens/);
  assert.throws(() => generateAnchorFromObject({ ...input, cache_pad: tooLongPad }), /no more than 64/);
});

test("benchmark anchor prompts stay aligned with standalone anchor generator", () => {
  const snapshot = {
    projectId: "projectA",
    readmeExcerpt: "Public sample README.",
    packages: [{ location: "package.json", name: "sample" }],
    entryFiles: ["src/main.js"],
    configFiles: ["vite.config.js"],
    fileSample: ["src/main.js", "vite.config.js"],
  };
  const scenario = SCENARIOS[0];
  const prompt = getPromptForVariant("anchorpad", snapshot, scenario, 0, "anchorPadV4");

  assert.match(prompt, /^BB3\n/);
  assert.match(prompt, /\nQAA=/);
  assert.match(prompt, /\nQAB=/);
  assert.match(prompt, /\nPAD=p p p p p p p p\n--\nQ=A\n$/);
});

test("readablePoc prompts keep stable markdown before hidden pad and dynamic tail", () => {
  const snapshot = {
    projectId: "projectA",
    readmeExcerpt: "Public sample README.",
    packages: [{ location: "package.json", name: "sample" }],
    entryFiles: ["src/main.js"],
    configFiles: ["vite.config.js"],
    fileSample: ["src/main.js", "vite.config.js"],
  };
  const scenario = SCENARIOS[0];
  const full = getPromptForVariant("readablePoc", snapshot, scenario, 0, "readableFullPad4");
  const lite = getPromptForVariant("readablePoc", snapshot, scenario, 1, "readableLitePad4");

  for (const prompt of [full, lite]) {
    const padIndex = prompt.indexOf("<!-- BASEBRIEF_CACHE_PAD: p p p p -->");
    const tailIndex = prompt.indexOf("Dynamic Tail Request");
    assert(padIndex > 0, "readablePoc prompt should include hidden cache pad");
    assert(tailIndex > padIndex, "dynamic tail must appear after hidden cache pad");
    assert.match(prompt, /verified_facts/);
    assert.match(prompt, /confirmed_decisions/);
    assert.match(prompt, /risk_boundaries/);
  }
});

test("sidecar prompts keep human-readable variants separate from compact BB5 sidecar", () => {
  const snapshot = {
    projectId: "projectA",
    readmeExcerpt: "Public sample README.",
    packages: [{ location: "package.json", name: "sample" }],
    entryFiles: ["src/main.js"],
    configFiles: ["vite.config.js"],
    fileSample: ["src/main.js", "vite.config.js"],
  };
  const scenario = SCENARIOS[0];
  const sidecar = getPromptForVariant("sidecar", snapshot, scenario, 0, "bb5SidecarFull");
  const readable = getPromptForVariant("sidecar", snapshot, scenario, 0, "readableFull");

  assert.match(readable, /^# BaseBrief Readable Full POC/);
  assert.match(sidecar, /^BB5S\n/);
  assert.match(sidecar, /\nS=full\n/);
  assert.match(sidecar, /\nPAD=p p p p\n--\nQ=A$/);
  assert.doesNotMatch(sidecar, /# BaseBrief Readable Full POC|Dynamic Tail Request/);
});

test("core templates preserve BaseBrief baseline sections", () => {
  const templatePaths = [
    "templates/zh-CN/BASEBRIEF.md",
    "templates/zh-CN/BASEBRIEF_LITE.md",
  ];
  const requiredTokens = [
    "verified_facts",
    "confirmed_decisions",
    "assumptions",
    "open_questions",
    "risk_boundaries",
  ];

  for (const templatePath of templatePaths) {
    const content = readText(templatePath);
    for (const token of requiredTokens) {
      assert.match(content, new RegExp(token), `${templatePath} missing ${token}`);
    }
  }
});

test("benchmark summary classifies large-sample evidence with anonymized project ids", () => {
  const projectIds = ["projectA", "projectB", "projectC"];
  const calls = [];

  for (const projectId of projectIds) {
    for (const scenario of SCENARIOS) {
      for (const variant of ["natural", "cacheReady"]) {
        for (let iteration = 0; iteration < 10; iteration += 1) {
          const promptTokens = variant === "natural" ? 400 : 700;
          const cachedTokens = variant === "natural" ? 300 : 600;
          calls.push({
            projectId,
            scenarioId: scenario.id,
            variant,
            phase: iteration === 0 ? "warmup" : "repeat",
            iteration,
            status: "success",
            promptTokens,
            cachedTokens,
            cacheRatio: cachedTokens / promptTokens,
            cacheFieldVisible: true,
            completionTokens: 32,
            uncachedInputTokens: promptTokens - cachedTokens,
            estimatedTotalCostCny: 0.0001,
            totalLatencyMs: 1000 + iteration,
          });
        }
      }
    }
  }

  const summary = buildSummary({
    status: "executed",
    startedAt: "2026-06-02T00:00:00.000Z",
    finishedAt: "2026-06-02T00:10:00.000Z",
    providerName: "test-provider",
    model: "test-model",
    mode: "absolute",
    repeats: 10,
    projectIds,
    calls,
  });

  assert.equal(summary.requestCount, 360);
  assert.equal(summary.validRequestCount, 360);
  assert.equal(summary.cacheReadyWins, 18);
  assert.equal(summary.cacheReadyCacheRatioWins, 18);
  assert.equal(summary.conclusionLevel, "large_sample_evidence");
  assert.deepEqual(
    [...new Set(summary.comparisons.map((item) => item.projectId))].sort(),
    projectIds,
  );
});

test("normalized benchmark summary reports ratio and cost wins only for length-normalized comparisons", () => {
  const projectIds = ["projectA", "projectB", "projectC"];
  const calls = [];

  for (const projectId of projectIds) {
    for (const scenario of SCENARIOS) {
      for (const variant of ["natural", "cacheReady"]) {
        for (let iteration = 0; iteration < 10; iteration += 1) {
          const promptTokens = variant === "natural" ? 1000 : 1020;
          const cachedTokens = variant === "natural" ? 900 : 960;
          const estimatedTotalCostCny = variant === "natural" ? 0.0002 : 0.00017;
          calls.push({
            projectId,
            scenarioId: scenario.id,
            variant,
            phase: iteration === 0 ? "warmup" : "repeat",
            iteration,
            status: "success",
            promptTokens,
            completionTokens: 32,
            cachedTokens,
            cacheRatio: cachedTokens / promptTokens,
            cacheFieldVisible: true,
            estimatedTotalCostCny,
            totalLatencyMs: 1000 + iteration,
          });
        }
      }
    }
  }

  const summary = buildSummary({
    status: "executed",
    startedAt: "2026-06-02T00:00:00.000Z",
    finishedAt: "2026-06-02T00:10:00.000Z",
    providerName: "test-provider",
    model: "test-model",
    mode: "normalized",
    repeats: 10,
    projectIds,
    calls,
  });

  assert.equal(summary.lengthNormalizedComparisons, 18);
  assert.equal(summary.cacheReadyCacheRatioWins, 18);
  assert.equal(summary.cacheReadyEstimatedCostWins, 18);
  assert.equal(summary.ratioConclusionLevel, "ratio_large_sample_evidence");
  assert.equal(summary.costConclusionLevel, "cost_large_sample_evidence");
  assert.equal(summary.conclusionLevel, "normalized_large_sample_evidence");
  assert(summary.overallCostDeltaPercent < -0.05);
});

test("capsule benchmark summary reports capsule v2 cost and ratio signals separately", () => {
  const projectIds = ["projectA", "projectB", "projectC"];
  const calls = [];

  for (const projectId of projectIds) {
    for (const scenario of SCENARIOS) {
      for (const variant of ["natural", "cacheReady", "capsuleV2"]) {
        for (let iteration = 0; iteration < 10; iteration += 1) {
          const promptTokens = variant === "capsuleV2" ? 700 : 1000;
          const cachedTokens = variant === "capsuleV2" ? 680 : 900;
          const estimatedTotalCostCny = variant === "capsuleV2" ? 0.00012 : 0.0002;
          calls.push({
            projectId,
            scenarioId: scenario.id,
            variant,
            phase: iteration === 0 ? "warmup" : "repeat",
            iteration,
            status: "success",
            promptTokens,
            completionTokens: 32,
            cachedTokens,
            cacheRatio: cachedTokens / promptTokens,
            cacheFieldVisible: true,
            estimatedTotalCostCny,
            totalLatencyMs: 1000 + iteration,
          });
        }
      }
    }
  }

  const summary = buildSummary({
    status: "executed",
    startedAt: "2026-06-02T00:00:00.000Z",
    finishedAt: "2026-06-02T00:10:00.000Z",
    providerName: "test-provider",
    model: "test-model",
    mode: "capsule",
    repeats: 10,
    projectIds,
    calls,
  });

  assert.equal(summary.requestCount, 540);
  assert.equal(summary.largeSampleThreshold, 486);
  assert.equal(summary.capsuleV2CacheRatioWins, 18);
  assert.equal(summary.capsuleV2EstimatedCostWins, 18);
  assert.equal(summary.capsuleV2ConclusionLevel, "capsule_cost_large_sample_evidence");
  assert.equal(summary.conclusionLevel, "capsule_cost_large_sample_evidence");
  assert(summary.capsuleV2OverallCostDeltaPercent < -0.05);
});

test("anchor benchmark summary reports anchor v3 cost and ratio signals separately", () => {
  const projectIds = ["projectA", "projectB", "projectC"];
  const calls = [];

  for (const projectId of projectIds) {
    for (const scenario of SCENARIOS) {
      for (const variant of ["natural", "cacheReady", "capsuleV2", "anchorV3"]) {
        for (let iteration = 0; iteration < 10; iteration += 1) {
          const promptTokens = variant === "anchorV3" ? 1100 : 1000;
          const cachedTokens = variant === "anchorV3" ? 1088 : 900;
          const estimatedTotalCostCny = variant === "anchorV3" ? 0.00012 : 0.0002;
          calls.push({
            projectId,
            scenarioId: scenario.id,
            variant,
            phase: iteration === 0 ? "warmup" : "repeat",
            iteration,
            status: "success",
            promptTokens,
            completionTokens: 32,
            cachedTokens,
            cacheRatio: cachedTokens / promptTokens,
            cacheFieldVisible: true,
            estimatedTotalCostCny,
            totalLatencyMs: 1000 + iteration,
          });
        }
      }
    }
  }

  const summary = buildSummary({
    status: "executed",
    startedAt: "2026-06-02T00:00:00.000Z",
    finishedAt: "2026-06-02T00:10:00.000Z",
    providerName: "test-provider",
    model: "test-model",
    mode: "anchor",
    repeats: 10,
    projectIds,
    calls,
  });

  assert.equal(summary.requestCount, 720);
  assert.equal(summary.largeSampleThreshold, 648);
  assert.equal(summary.anchorV3CacheRatioWins, 18);
  assert.equal(summary.anchorV3EstimatedCostWins, 18);
  assert.equal(summary.anchorV3ConclusionLevel, "anchor_cost_large_sample_evidence");
  assert.equal(summary.conclusionLevel, "anchor_cost_large_sample_evidence");
  assert(summary.anchorV3OverallCostDeltaPercent < -0.05);
});

test("anchorpad benchmark summary reports padded anchor v4 cost signals separately", () => {
  const projectIds = ["projectA", "projectB", "projectC"];
  const calls = [];

  for (const projectId of projectIds) {
    for (const scenario of SCENARIOS) {
      for (const variant of ["natural", "cacheReady", "capsuleV2", "anchorV3", "anchorPadV4"]) {
        for (let iteration = 0; iteration < 10; iteration += 1) {
          const promptTokens = variant === "anchorPadV4" ? 1120 : 1000;
          const cachedTokens = variant === "anchorPadV4" ? 1088 : 900;
          const estimatedTotalCostCny = variant === "anchorPadV4" ? 0.00012 : 0.0002;
          calls.push({
            projectId,
            scenarioId: scenario.id,
            variant,
            phase: iteration === 0 ? "warmup" : "repeat",
            iteration,
            status: "success",
            promptTokens,
            completionTokens: 32,
            cachedTokens,
            cacheRatio: cachedTokens / promptTokens,
            cacheFieldVisible: true,
            estimatedTotalCostCny,
            totalLatencyMs: 1000 + iteration,
          });
        }
      }
    }
  }

  const summary = buildSummary({
    status: "executed",
    startedAt: "2026-06-02T00:00:00.000Z",
    finishedAt: "2026-06-02T00:10:00.000Z",
    providerName: "test-provider",
    model: "test-model",
    mode: "anchorpad",
    repeats: 10,
    projectIds,
    calls,
  });

  assert.equal(summary.requestCount, 900);
  assert.equal(summary.largeSampleThreshold, 810);
  assert.equal(summary.anchorPadV4CacheRatioWins, 18);
  assert.equal(summary.anchorPadV4EstimatedCostWins, 18);
  assert.equal(summary.anchorPadV4ConclusionLevel, "anchorpad_cost_large_sample_evidence");
  assert.equal(summary.conclusionLevel, "anchorpad_cost_large_sample_evidence");
  assert(summary.anchorPadV4OverallCostDeltaPercent < -0.05);
});

test("padSweep benchmark summary marks stronger pad length as BB5 candidate", () => {
  const projectIds = ["projectA", "projectB", "projectC"];
  const calls = [];
  const variants = ["anchorPad4", "anchorPad8", "anchorPad16", "anchorPad32", "anchorPad64"];

  for (const projectId of projectIds) {
    for (const scenario of SCENARIOS) {
      for (const variant of variants) {
        for (let iteration = 0; iteration < 10; iteration += 1) {
          const estimatedTotalCostCny = variant === "anchorPad16" ? 0.00009 : variant === "anchorPad8" ? 0.00012 : 0.00013;
          calls.push({
            projectId,
            scenarioId: scenario.id,
            variant,
            phase: iteration === 0 ? "warmup" : "repeat",
            iteration,
            status: "success",
            promptTokens: 1100,
            completionTokens: 32,
            cachedTokens: variant === "anchorPad16" ? 1090 : 1080,
            cacheRatio: variant === "anchorPad16" ? 1090 / 1100 : 1080 / 1100,
            cacheFieldVisible: true,
            estimatedTotalCostCny,
            totalLatencyMs: 1000 + iteration,
          });
        }
      }
    }
  }

  const summary = buildSummary({
    status: "executed",
    startedAt: "2026-06-02T00:00:00.000Z",
    finishedAt: "2026-06-02T00:10:00.000Z",
    providerName: "test-provider",
    model: "test-model",
    providerProfileId: "custom-compatible",
    mode: "padSweep",
    repeats: 10,
    projectIds,
    calls,
  });

  assert.equal(summary.requestCount, 900);
  assert.equal(summary.padSweepBaselineVariant, "anchorPad8");
  assert.equal(summary.padSweepCandidate.variant, "anchorPad16");
  assert.equal(summary.padSweepCandidate.costWinsVsPad8, 18);
  assert.equal(summary.conclusionLevel, "pad_sweep_bb5_candidate");
});

test("readablePoc benchmark summary classifies Full and Lite padded markdown separately", () => {
  const projectIds = ["projectA", "projectB", "projectC"];
  const calls = [];
  const variants = ["natural", "readableFull", "readableFullPad4", "readableLite", "readableLitePad4"];

  for (const projectId of projectIds) {
    for (const scenario of SCENARIOS) {
      for (const variant of variants) {
        for (let iteration = 0; iteration < 10; iteration += 1) {
          const estimatedTotalCostCny =
            variant === "readableFullPad4" || variant === "readableLitePad4" ? 0.00009 : 0.0002;
          calls.push({
            projectId,
            scenarioId: scenario.id,
            variant,
            phase: iteration === 0 ? "warmup" : "repeat",
            iteration,
            status: "success",
            promptTokens: 1200,
            completionTokens: 32,
            cachedTokens: variant.endsWith("Pad4") ? 1180 : 1000,
            cacheRatio: variant.endsWith("Pad4") ? 1180 / 1200 : 1000 / 1200,
            cacheFieldVisible: true,
            estimatedTotalCostCny,
            totalLatencyMs: 1000 + iteration,
          });
        }
      }
    }
  }

  const summary = buildSummary({
    status: "executed",
    startedAt: "2026-06-02T00:00:00.000Z",
    finishedAt: "2026-06-02T00:10:00.000Z",
    providerName: "test-provider",
    model: "test-model",
    providerProfileId: "custom-compatible",
    mode: "readablePoc",
    repeats: 10,
    projectIds,
    calls,
  });

  assert.equal(summary.requestCount, 900);
  assert.equal(summary.readableStats.length, 2);
  assert.equal(summary.readableStats.find((item) => item.family === "full").estimatedCostWins, 18);
  assert.equal(summary.readableStats.find((item) => item.family === "lite").estimatedCostWins, 18);
  assert.equal(summary.conclusionLevel, "readable_poc_large_sample_evidence");
});

test("sidecar benchmark summary requires sidecar evidence and compares against BB4", () => {
  const projectIds = ["projectA", "projectB", "projectC"];
  const calls = [];
  const variants = ["natural", "readableFull", "readableLite", "bb4AnchorPad", "bb5SidecarFull", "bb5SidecarLite"];

  for (const projectId of projectIds) {
    for (const scenario of SCENARIOS) {
      for (const variant of variants) {
        for (let iteration = 0; iteration < 10; iteration += 1) {
          const estimatedTotalCostCny =
            variant === "bb5SidecarLite" ? 0.00008 : variant === "bb4AnchorPad" ? 0.00009 : 0.0002;
          calls.push({
            projectId,
            scenarioId: scenario.id,
            variant,
            phase: iteration === 0 ? "warmup" : "repeat",
            iteration,
            status: "success",
            promptTokens: variant === "bb5SidecarLite" ? 900 : 1200,
            completionTokens: 32,
            cachedTokens: variant === "bb5SidecarLite" ? 880 : 1000,
            cacheRatio: variant === "bb5SidecarLite" ? 880 / 900 : 1000 / 1200,
            cacheFieldVisible: true,
            estimatedTotalCostCny,
            totalLatencyMs: 1000 + iteration,
          });
        }
      }
    }
  }

  const summary = buildSummary({
    status: "executed",
    startedAt: "2026-06-02T00:00:00.000Z",
    finishedAt: "2026-06-02T00:10:00.000Z",
    providerName: "test-provider",
    model: "test-model",
    providerProfileId: "custom-compatible",
    mode: "sidecar",
    repeats: 10,
    projectIds,
    calls,
  });

  const lite = summary.sidecarStats.find((item) => item.family === "lite");
  assert.equal(summary.requestCount, 1080);
  assert.equal(lite.estimatedCostWinsVsNatural, 18);
  assert.equal(lite.estimatedCostWinsVsBb4, 18);
  assert.equal(lite.conclusionLevel, "bb5_sidecar_lite_best_evidence");
  assert.equal(summary.conclusionLevel, "bb5_sidecar_best_evidence");
});

test("benchmark provider profiles include MiMo and DeepSeek pricing", () => {
  assert.equal(PROVIDER_PROFILES["mimo-v2.5"].pricingCnyPerMillionTokens.inputCacheHit, 0.02);
  assert.equal(PROVIDER_PROFILES["deepseek-v4-flash"].pricingCnyPerMillionTokens.inputCacheMiss, 1);
  assert.equal(PROVIDER_PROFILES["deepseek-v4-flash"].pricingCnyPerMillionTokens.output, 2);
});
