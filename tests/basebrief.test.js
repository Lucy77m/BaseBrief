const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { generateFromObject } = require("../scripts/generate_cache_ready_lite");
const { generateCapsuleFromObject } = require("../scripts/generate_cache_ready_capsule");
const { generateAnchorFromObject } = require("../scripts/generate_cache_ready_anchor");
const { generateBb9HandoffFromObject, getProviderProfile } = require("../scripts/generate_bb9_handoff");
const {
  buildHandoffArtifacts,
  extractHandoffJsonBlock,
  validateHandoffInput,
} = require("../scripts/basebrief_build_handoff");
const { buildAdapterArtifacts, normalizeTargets } = require("../scripts/basebrief_build_adapters");
const { checkArtifacts } = require("../scripts/basebrief_check_artifacts");
const { HELP_TEXT, commandBuild, commandCheck, commandDiff, commandInit, commandReceiverCheck, commandReceiverFlow, commandReceiverInit, commandReviewDraft, commandSidecarBuild, commandSidecarCheck, commandStateAdvance, commandStateHistory, commandStateInit, commandStateRead, commandStateStatus, commandStateValidate, commandSeal, formatHuman, run, starterInput } = require("../scripts/basebrief");
const {
  CONFIG_SCHEMA_VERSION: RECEIVER_CHECK_SCHEMA_VERSION,
  RESULT_SCHEMA_VERSION: RECEIVER_CHECK_RESULT_SCHEMA_VERSION,
  parsePorcelainZ,
  runReceiverCheck,
  validateReceiverCheckConfig,
} = require("../scripts/basebrief_receiver_check");
const { buildReceiverCheckConfig, runReceiverInit } = require("../scripts/basebrief_receiver_init");
const { FLOW_SCHEMA_VERSION, runReceiverFlow } = require("../scripts/basebrief_receiver_flow");
const { REVIEW_DRAFT_SCHEMA_VERSION, runReviewDraft } = require("../scripts/basebrief_review_draft");
const { PROJECT_STATE_SCHEMA_VERSION, runStateAdvance, runStateHistory, runStateInit, runStateRead, runStateStatus, runStateValidate } = require("../scripts/basebrief_project_state");
const { SIDECAR_SCHEMA_VERSION, buildSidecarBundle, checkSidecarBundle } = require("../scripts/basebrief_sidecar");
const { createSealFromInput, diffSeals, readSealOrInput, SEAL_SCHEMA_VERSION } = require("../scripts/basebrief_seal");
const { buildSummary, getPromptForVariant, SCENARIOS, PROVIDER_PROFILES } = require("../scripts/provider_cache_benchmark");
const { classifyRelayUsage } = require("../scripts/provider_relay_usage_audit");
const { routeMode } = require("../scripts/mode_router");

const repoRoot = path.resolve(__dirname, "..");

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function withTempDir(fn) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "basebrief-handoff-"));
  try {
    return fn(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function createReceiverCheckRepo(tempDir) {
  const repoDir = path.join(tempDir, "repo");
  fs.mkdirSync(repoDir, { recursive: true });
  git(repoDir, ["init"]);
  git(repoDir, ["config", "user.email", "basebrief@example.invalid"]);
  git(repoDir, ["config", "user.name", "BaseBrief Test"]);
  fs.mkdirSync(path.join(repoDir, "docs"), { recursive: true });
  fs.mkdirSync(path.join(repoDir, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(repoDir, "docs", "safe.md"), [
    "# Safe",
    "",
    "## Risk Boundaries",
    "- keep checks read-only",
    "",
    "## Open Questions",
    "- none",
    "",
  ].join("\n"), "utf8");
  fs.writeFileSync(path.join(repoDir, "scripts", "valid.js"), "const value = 1;\n", "utf8");
  fs.writeFileSync(path.join(repoDir, "scripts", "invalid.js"), "const = ;\n", "utf8");
  fs.writeFileSync(path.join(repoDir, "tokens.txt"), "alpha\nbeta\n", "utf8");
  fs.writeFileSync(path.join(repoDir, "receiver.json"), "{}\n", "utf8");
  git(repoDir, ["add", "."]);
  git(repoDir, ["commit", "-m", "fixture"]);
  return repoDir;
}

function receiverCheckConfig(repoDir, overrides = {}) {
  return {
    schemaVersion: RECEIVER_CHECK_SCHEMA_VERSION,
    expected_branch: git(repoDir, ["branch", "--show-current"]),
    expected_head: git(repoDir, ["rev-parse", "HEAD"]),
    expected_changed_files: [],
    declared_checks: [],
    ...overrides,
  };
}

function writeReceiverCheckConfig(tempDir, config, name = "receiver-check.json") {
  const configPath = path.join(tempDir, name);
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return configPath;
}

function createGuidedDraft(tempDir, overrides = {}) {
  const fixtureRoot = path.join(tempDir, `guided-fixture-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(fixtureRoot, { recursive: true });
  const repoDir = createReceiverCheckRepo(fixtureRoot);
  const outputDir = path.join(fixtureRoot, "guided-flow");
  const guidedAnswers = {
    current_goal: "Prepare a reviewed receiver handoff.",
    verified_facts: "The local receiver flow draft was generated from a test fixture.",
    confirmed_decisions: "The draft must stay human-reviewed before receiver use.",
    risk_boundaries: "Do not read env files or write provider credentials.",
    receiver_entry_task: "Inspect the reviewed receiver handoff first.",
    open_questions: "No open questions remain for this fixture.",
    ...overrides.guidedAnswers,
  };
  runReceiverFlow({
    repoPath: repoDir,
    outputDir,
    guided: true,
    guidedAnswers,
  });
  const draftPath = path.join(outputDir, "draft-context.md");
  if (overrides.reviewed !== false) {
    const reviewedDraft = fs.readFileSync(draftPath, "utf8").replace(/- \[ \]/g, "- [x]");
    fs.writeFileSync(draftPath, reviewedDraft, "utf8");
  }
  return { draftPath, outputDir, repoDir };
}

function validateBb9HandoffInputAgainstSchema(input, schema) {
  const allowed = new Set(Object.keys(schema.properties));
  for (const key of schema.required) {
    assert(key in input, `missing required key: ${key}`);
  }
  for (const key of Object.keys(input)) {
    assert(allowed.has(key), `unexpected key: ${key}`);
  }
  if ("mode" in input) {
    assert(schema.properties.mode.enum.includes(input.mode), `invalid mode: ${input.mode}`);
  }
  for (const [key, rule] of Object.entries(schema.properties)) {
    if (!(key in input)) continue;
    if (rule.type === "string") {
      assert.equal(typeof input[key], "string", `${key} must be string`);
      if (rule.minLength) assert(input[key].length >= rule.minLength, `${key} must not be empty`);
    }
    if (rule.$ref === "#/$defs/nonEmptyStringArray") {
      assert(Array.isArray(input[key]), `${key} must be array`);
      assert(input[key].length > 0, `${key} must not be empty`);
      input[key].forEach((item) => {
        assert.equal(typeof item, "string", `${key} item must be string`);
        assert(item.length > 0, `${key} item must not be empty`);
      });
    }
    if (rule.$ref === "#/$defs/stringArray") {
      assert(Array.isArray(input[key]), `${key} must be array`);
      input[key].forEach((item) => assert.equal(typeof item, "string", `${key} item must be string`));
    }
  }
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

test("public docs keep cache-ready as explicit experiment route", () => {
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const skill = readText("skills/basebrief/SKILL.md");
  const modeSelection = readText("docs/mode-selection.md");
  const docsIndex = readText("docs/index.md");

  assert.match(readme, /普通项目接续默认只在 `full` 和 `lite` 之间选择/);
  assert.match(readme, /`cache-ready` 只保留为显式 prompt-cache 实验路线/);
  assert.match(readme, /零依赖 CLI Lite/);
  assert.doesNotMatch(readme, /BaseBrief 当前不是 CLI|暂无 CLI/);
  assert.match(englishReadme, /normal continuation routes to `full` or `lite`/);
  assert.match(englishReadme, /zero-dependency CLI Lite/);
  assert.match(skill, /普通项目接续默认只在 `full` 和 `lite` 之间选择/);
  assert.match(modeSelection, /`cache-ready` 是显式实验路线/);
  assert.match(docsIndex, /experiments\/cache-ready-bb12-guard\.md/);
});

test("v0.3.0 release candidate documents receiver workflow and release boundaries", () => {
  const release = readText("docs/releases/v0.3.0.md");
  const roadmap = readText("docs/roadmap/basebrief-long-term-baseline.md");
  assert.match(release, /Receiver-ready v1/);
  assert.match(release, /Receiver Safe Check v1/);
  assert.match(release, /receiver-init --repo <target-repo>/);
  assert.match(release, /No Codex receiver thread/);
  assert.match(release, /No push, tag, or formal release/);
  assert.match(roadmap, /Phase 8A: Receiver Workflow/);
  assert.match(roadmap, /v0\.3\.0/);
});

test("v0.3.1 receiver stabilization documents examples, local npm scripts, and release boundaries", () => {
  const packageJson = readJson("package.json");
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const cliLite = readText("docs/cli-lite.md");
  const docsIndex = readText("docs/index.md");
  const testing = readText("docs/testing.md");
  const roadmap = readText("docs/roadmap/basebrief-long-term-baseline.md");
  const release = readText("docs/releases/v0.3.1.md");
  const frictionLog = readText("docs/dogfooding/receiver-friction-log.md");
  const differenceReadme = readText("examples/receiver/difference-found/README.md");
  const blockedReadme = readText("examples/receiver/blocked/README.md");
  const languageReadme = readText("examples/receiver/language-routing/README.md");
  const differenceResult = readJson("examples/receiver/difference-found/receiver-check-result.json");
  const blockedResult = readJson("examples/receiver/blocked/blocked-result.json");

  assert.equal(packageJson.private, true);
  assert.deepEqual(Object.keys(packageJson.scripts).sort(), ["check", "release-check", "test"]);
  assert.equal(packageJson.scripts.test, "node --test tests/basebrief.test.js");
  assert.equal(packageJson.scripts["release-check"], "node scripts/run_release_checks.js");
  assert.equal(packageJson.scripts.check, "npm test && npm run release-check");
  ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies", "bin", "publishConfig", "files"].forEach((key) => {
    assert.equal(key in packageJson, false, `package.json should not define ${key}`);
  });

  assert.match(readme, /npm run check/);
  assert.match(readme, /不是发布到 npm 的 package/);
  assert.match(readme, /docs\/releases\/v0\.3\.1\.md/);
  assert.match(englishReadme, /not a published npm package/);
  assert.match(englishReadme, /docs\/releases\/v0\.3\.1\.md/);
  assert.match(cliLite, /not a published npm package/);
  assert.match(cliLite, /npm run check/);
  assert.match(docsIndex, /dogfooding\/receiver-friction-log\.md/);
  assert.match(docsIndex, /releases\/v0\.3\.1\.md/);
  assert.match(docsIndex, /examples\/receiver\/difference-found\/README\.md/);
  assert.match(testing, /v0\.3\.1 receiver stabilization/);
  assert.match(testing, /provider_probe_status=skipped/);
  assert.match(roadmap, /Current v0\.3\.1 stabilization target/);
  assert.match(roadmap, /document the v0\.3\.1 local release-candidate gate/);
  assert.match(release, /Receiver Stabilization/);
  assert.match(release, /BB9 handoff schema is unchanged/);
  assert.match(release, /Receiver Safe Check config and result schemas are unchanged/);
  assert.match(release, /Auto Flow Skeleton is not introduced/);
  assert.match(release, /No provider request/);
  assert.match(release, /provider_probe_status=skipped/);
  assert.match(release, /No push, tag, or formal release/);
  assert.match(frictionLog, /actual_handoff_friction/);
  assert.match(frictionLog, /difference_found/);
  assert.match(frictionLog, /blocked/);

  assert.match(differenceReadme, /does not mean the agent failed/);
  assert.equal(differenceResult.handoff_acceptance, "difference_found");
  assert.equal(differenceResult.receiver_task_status, "completed");
  assert.match(blockedReadme, /cannot run safely/);
  assert.equal(blockedResult.handoff_acceptance, "blocked");
  assert.equal(blockedResult.receiver_task_status, "blocked");
  assert.match(languageReadme, /match_latest_user_message/);
  assert.match(languageReadme, /technical literals/);

  for (const relativePath of [
    "docs/releases/v0.3.1.md",
    "docs/dogfooding/receiver-friction-log.md",
    "examples/receiver/difference-found",
    "examples/receiver/blocked",
    "examples/receiver/language-routing",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
    assert.equal(result.warningCount, 0, relativePath);
  }
});

test("v0.3.2 receiver flow draft skeleton documents release boundaries", () => {
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const cliLite = readText("docs/cli-lite.md");
  const docsIndex = readText("docs/index.md");
  const testing = readText("docs/testing.md");
  const roadmap = readText("docs/roadmap/basebrief-long-term-baseline.md");
  const release = readText("docs/releases/v0.3.2.md");
  const receiverFlow = readText("docs/receiver-flow.md");

  assert.match(readme, /docs\/releases\/v0\.3\.2\.md/);
  assert.match(englishReadme, /docs\/releases\/v0\.3\.2\.md/);
  assert.match(cliLite, /receiver-flow --repo <target-repo> --output-dir <dir>/);
  assert.match(cliLite, /releases\/v0\.3\.2\.md/);
  assert.match(docsIndex, /releases\/v0\.3\.2\.md/);
  assert.match(testing, /v0\.3\.2 Receiver Flow Draft Skeleton/);
  assert.match(testing, /provider_probe_status=skipped/);
  assert.match(roadmap, /Completed v0\.3\.2 draft skeleton/);
  assert.match(release, /Receiver Flow Draft Skeleton/);
  assert.match(release, /receiver-flow --repo <target-repo> --output-dir <dir>/);
  assert.match(release, /flow-summary\.json/);
  assert.match(release, /receiver-check\.json/);
  assert.match(release, /draft-context\.md/);
  assert.match(release, /handoff_status: draft_needs_review/);
  assert.match(release, /No provider request/);
  assert.match(release, /No receiver thread creation/);
  assert.match(release, /No push, tag, or formal release/);
  assert.match(release, /provider_probe_status=skipped/);
  assert.match(release, /BB9 handoff schema is unchanged/);
  assert.match(release, /Receiver Safe Check config and result schemas are unchanged/);
  assert.match(receiverFlow, /Does not make provider requests/);
  assert.doesNotMatch(release, /handoff_status:\s*ready_for_receiver/);

  for (const relativePath of [
    "docs/releases/v0.3.2.md",
    "docs/receiver-flow.md",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
    assert.equal(result.warningCount, 0, relativePath);
  }
});

test("v0.3.3 receiver flow dogfooding evidence stays draft-only and public-safe", () => {
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const cliLite = readText("docs/cli-lite.md");
  const docsIndex = readText("docs/index.md");
  const testing = readText("docs/testing.md");
  const roadmap = readText("docs/roadmap/basebrief-long-term-baseline.md");
  const release = readText("docs/releases/v0.3.3.md");
  const dogfooding = readText("docs/dogfooding/receiver-flow-dogfooding.md");
  const cleanConfig = readJson("examples/receiver-flow/clean-repo/receiver-check.json");
  const dirtyConfig = readJson("examples/receiver-flow/dirty-repo/receiver-check.json");
  const visibleConfig = readJson("examples/receiver-flow/visible-output/receiver-check.json");
  const cleanSummary = readJson("examples/receiver-flow/clean-repo/flow-summary.json");
  const dirtySummary = readJson("examples/receiver-flow/dirty-repo/flow-summary.json");
  const visibleSummary = readJson("examples/receiver-flow/visible-output/flow-summary.json");

  assert.match(readme, /docs\/dogfooding\/receiver-flow-dogfooding\.md/);
  assert.match(readme, /docs\/releases\/v0\.3\.3\.md/);
  assert.match(englishReadme, /docs\/dogfooding\/receiver-flow-dogfooding\.md/);
  assert.match(englishReadme, /docs\/releases\/v0\.3\.3\.md/);
  assert.match(cliLite, /releases\/v0\.3\.3\.md/);
  assert.match(docsIndex, /dogfooding\/receiver-flow-dogfooding\.md/);
  assert.match(docsIndex, /releases\/v0\.3\.3\.md/);
  assert.match(docsIndex, /examples\/receiver-flow\/clean-repo\/README\.md/);
  assert.match(docsIndex, /examples\/receiver-flow\/dirty-repo\/README\.md/);
  assert.match(docsIndex, /examples\/receiver-flow\/visible-output\/README\.md/);
  assert.match(testing, /v0\.3\.3 Receiver Flow Dogfooding Evidence/);
  assert.match(testing, /provider_probe_status=skipped/);
  assert.match(roadmap, /Current v0\.3\.3 evidence target/);
  assert.match(release, /evidence-only stabilization/);
  assert.match(release, /handoff_status: draft_needs_review/);
  assert.match(release, /No provider request/);
  assert.match(release, /No receiver thread creation/);
  assert.match(release, /No Auto Flow/);
  assert.match(release, /provider_probe_status=skipped/);
  assert.match(release, /No push, tag, or formal release/);
  assert.match(dogfooding, /receiver_flow_dogfooding/);
  assert.match(dogfooding, /command_shape/);
  assert.match(dogfooding, /output_shape/);
  assert.match(dogfooding, /review_checkpoints/);
  assert.match(dogfooding, /observed_friction/);
  assert.match(dogfooding, /next_fix_candidate/);
  assert.doesNotMatch(release, /handoff_status:\s*ready_for_receiver/);

  assert.equal(cleanSummary.handoff_status, "draft_needs_review");
  assert.deepEqual(cleanConfig.expected_changed_files, []);
  assert.equal(dirtySummary.handoff_status, "draft_needs_review");
  assert.deepEqual(dirtyConfig.expected_changed_files, ["docs/safe.md", "new.txt"]);
  assert.equal(visibleSummary.handoff_status, "draft_needs_review");
  assert.deepEqual(visibleConfig.expected_changed_files, [
    "flow/draft-context.md",
    "flow/flow-summary.json",
    "flow/receiver-check.json",
  ]);

  for (const relativePath of [
    "docs/releases/v0.3.3.md",
    "docs/dogfooding/receiver-flow-dogfooding.md",
    "examples/receiver-flow/clean-repo",
    "examples/receiver-flow/dirty-repo",
    "examples/receiver-flow/visible-output",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
    assert.equal(result.warningCount, 0, relativePath);
  }
});

test("v0.4.0 release candidate integrates local toolchain without expanding product scope", () => {
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const cliLite = readText("docs/cli-lite.md");
  const docsIndex = readText("docs/index.md");
  const testing = readText("docs/testing.md");
  const roadmap = readText("docs/roadmap/basebrief-long-term-baseline.md");
  const release = readText("docs/releases/v0.4.0.md");
  const packageJson = readJson("package.json");

  assert.match(readme, /docs\/releases\/v0\.4\.0\.md/);
  assert.match(englishReadme, /docs\/releases\/v0\.4\.0\.md/);
  assert.match(cliLite, /v0\.4\.0/);
  assert.match(cliLite, /not a published npm package/);
  assert.match(docsIndex, /releases\/v0\.4\.0\.md/);
  assert.match(testing, /v0\.4\.0 Integrated Local Toolchain Release Candidate/);
  assert.match(testing, /provider_probe_status=skipped/);
  assert.match(roadmap, /Current v0\.4\.0 release-candidate target/);
  assert.match(release, /integrated local toolchain/);
  assert.match(release, /one public skill entry/);
  assert.match(release, /BB9 structured handoff contract/);
  assert.match(release, /CLI Lite/);
  assert.match(release, /Artifact Checker/);
  assert.match(release, /Receiver Safe Check/);
  assert.match(release, /Receiver Flow Draft/);
  assert.match(release, /Seal\/Diff/);
  assert.match(release, /npm run check/);
  assert.match(release, /BB9 handoff schema is unchanged/);
  assert.match(release, /Receiver Safe Check config and result schemas are unchanged/);
  assert.match(release, /CLI Lite command behavior is unchanged/);
  assert.match(release, /provider_probe_status=skipped/);
  assert.match(release, /No provider request/);
  assert.match(release, /No broad provider savings claim/);
  assert.match(release, /No receiver thread creation/);
  assert.match(release, /No Auto Flow/);
  assert.match(release, /No Web UI/);
  assert.match(release, /No Cursor adapter/);
  assert.match(release, /No hosted service/);
  assert.match(release, /No installed or global CLI/);
  assert.match(release, /No published npm package/);
  assert.match(release, /No `\.basebrief\/` project state directory/);
  assert.match(release, /No CI matrix/);
  assert.match(release, /No push, tag, or formal release/);
  assert.equal(packageJson.private, true);
  assert.deepEqual(Object.keys(packageJson.scripts).sort(), ["check", "release-check", "test"]);

  const result = checkArtifacts({ inputPath: path.join(repoRoot, "docs/releases/v0.4.0.md") });
  assert.equal(result.status, "passed");
  assert.equal(result.errorCount, 0);
  assert.equal(result.warningCount, 0);
});

test("v0.4.1 stabilization candidate documents scale testing without expanding features", () => {
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const docsIndex = readText("docs/index.md");
  const testing = readText("docs/testing.md");
  const baseline = readText("docs/baselines/v0.4.0-post-release-baseline.md");
  const matrix = readText("docs/testing-v0.4.x-test-matrix.md");
  const release = readText("docs/releases/v0.4.1.md");

  assert.match(readme, /docs\/releases\/v0\.4\.1\.md/);
  assert.match(englishReadme, /docs\/releases\/v0\.4\.1\.md/);
  assert.match(docsIndex, /releases\/v0\.4\.1\.md/);
  assert.match(docsIndex, /baselines\/v0\.4\.0-post-release-baseline\.md/);
  assert.match(docsIndex, /testing-v0\.4\.x-test-matrix\.md/);
  assert.match(testing, /v0\.4\.1 Stabilization Candidate/);
  assert.match(testing, /testing-v0\.4\.x-test-matrix\.md/);
  assert.match(testing, /provider_probe_status=skipped/);
  assert.match(baseline, /release tag: `v0\.4\.0`/);
  assert.match(baseline, /release commit: `4de7342`/);
  assert.match(baseline, /provider_probe_status=skipped/);
  assert.match(matrix, /BaseBrief v0\.4\.x Test Matrix/);
  assert.match(matrix, /OpenCode availability/);
  assert.match(matrix, /Claude Code availability/);
  assert.match(release, /Stabilization Candidate/);
  assert.match(release, /BB9 handoff schema is unchanged/);
  assert.match(release, /Receiver Safe Check config and result schemas are unchanged/);
  assert.match(release, /Receiver Flow Draft schema and default behavior are unchanged/);
  assert.match(release, /CLI Lite command behavior is unchanged/);
  assert.match(release, /provider_probe_status=skipped/);
  assert.match(release, /No provider request/);
  assert.match(release, /No Auto Flow/);
  assert.match(release, /No `receiver-flow --guided`/);
  assert.match(release, /No `receiver-flow --extract`/);
  assert.match(release, /No `review-draft`/);
  assert.match(release, /No `.basebrief\/` project state directory/);
  assert.match(release, /No push, tag, or formal release/);

  for (const relativePath of [
    "docs/baselines/v0.4.0-post-release-baseline.md",
    "docs/testing-v0.4.x-test-matrix.md",
    "docs/releases/v0.4.1.md",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
    assert.equal(result.warningCount, 0, relativePath);
  }
});

test("v0.5.0 guided receiver flow documents human-input draft boundaries", () => {
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const cliLite = readText("docs/cli-lite.md");
  const docsIndex = readText("docs/index.md");
  const testing = readText("docs/testing.md");
  const receiverFlow = readText("docs/receiver-flow.md");
  const dogfooding = readText("docs/dogfooding/receiver-flow-guided-dogfooding.md");
  const release = readText("docs/releases/v0.5.0.md");

  assert.match(readme, /docs\/releases\/v0\.5\.0\.md/);
  assert.match(englishReadme, /docs\/releases\/v0\.5\.0\.md/);
  assert.match(docsIndex, /releases\/v0\.5\.0\.md/);
  assert.match(docsIndex, /dogfooding\/receiver-flow-guided-dogfooding\.md/);
  assert.match(cliLite, /receiver-flow --repo <target-repo> --output-dir <dir> --guided/);
  assert.match(receiverFlow, /receiver-flow --repo <target-repo> --output-dir <dir> --guided/);
  assert.match(receiverFlow, /Empty guided answers are written as\s+`\[EMPTY\]`/);
  assert.match(testing, /v0\.5\.0 Guided Receiver Flow Candidate/);
  assert.match(testing, /handoff_status: draft_needs_review/);
  assert.match(dogfooding, /guided-self-smoke/);
  assert.match(dogfooding, /provider_request_performed`: false/);
  assert.match(release, /Guided Receiver Flow Candidate/);
  assert.match(release, /Default `receiver-flow` behavior remains unchanged/);
  assert.match(release, /Empty guided answers are written as `\[EMPTY\]`/);
  assert.match(release, /review_checklist/);
  assert.match(release, /handoff_status: draft_needs_review/);
  assert.match(release, /No provider request/);
  assert.match(release, /No automatic promotion to `ready_for_receiver`/);
  assert.match(release, /No `review-draft`/);
  assert.match(release, /No `receiver-flow --extract`/);
  assert.match(release, /No `.basebrief\/` project state directory/);
  assert.match(release, /No Auto Flow/);
  assert.match(release, /No push, tag, or formal release/);

  for (const relativePath of [
    "docs/dogfooding/receiver-flow-guided-dogfooding.md",
    "docs/releases/v0.5.0.md",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
    assert.equal(result.warningCount, 0, relativePath);
  }
});

test("v0.5.1 review draft gate documents receiver-ready promotion boundaries", () => {
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const cliLite = readText("docs/cli-lite.md");
  const docsIndex = readText("docs/index.md");
  const testing = readText("docs/testing.md");
  const receiverFlow = readText("docs/receiver-flow.md");
  const dogfooding = readText("docs/dogfooding/receiver-flow-review-draft-dogfooding.md");
  const release = readText("docs/releases/v0.5.1.md");

  assert.match(readme, /docs\/releases\/v0\.5\.1\.md/);
  assert.match(englishReadme, /docs\/releases\/v0\.5\.1\.md/);
  assert.match(docsIndex, /releases\/v0\.5\.1\.md/);
  assert.match(docsIndex, /dogfooding\/receiver-flow-review-draft-dogfooding\.md/);
  assert.match(cliLite, /review-draft --draft <draft-context\.md> --output <receiver-ready\.md>/);
  assert.match(receiverFlow, /review-draft --draft <draft-context\.md> --output <receiver-ready\.md>/);
  assert.match(testing, /v0\.5\.1 Review Draft Gate Candidate/);
  assert.match(dogfooding, /review-draft-self-smoke/);
  assert.match(dogfooding, /provider_request_performed`: false/);
  assert.match(release, /Review Draft Gate Candidate/);
  assert.match(release, /ready_for_receiver/);
  assert.match(release, /No provider request/);
  assert.match(release, /No receiver-flow --extract/);
  assert.match(release, /No Auto Flow/);
  assert.match(release, /No `.basebrief\/`/);
  assert.match(release, /provider_probe_status=skipped/);
  assert.match(release, /No push, tag, or formal release/);

  for (const relativePath of [
    "docs/dogfooding/receiver-flow-review-draft-dogfooding.md",
    "docs/releases/v0.5.1.md",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
    assert.equal(result.warningCount, 0, relativePath);
  }
});

test("v0.5.2 receiver flow extract documents candidate-only boundaries", () => {
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const cliLite = readText("docs/cli-lite.md");
  const docsIndex = readText("docs/index.md");
  const testing = readText("docs/testing.md");
  const receiverFlow = readText("docs/receiver-flow.md");
  const dogfooding = readText("docs/dogfooding/receiver-flow-extract-dogfooding.md");
  const release = readText("docs/releases/v0.5.2.md");

  assert.match(readme, /docs\/releases\/v0\.5\.2\.md/);
  assert.match(englishReadme, /docs\/releases\/v0\.5\.2\.md/);
  assert.match(docsIndex, /releases\/v0\.5\.2\.md/);
  assert.match(docsIndex, /dogfooding\/receiver-flow-extract-dogfooding\.md/);
  assert.match(cliLite, /receiver-flow --repo <target-repo> --output-dir <dir> --extract --source <draft-or-context\.md>/);
  assert.match(receiverFlow, /receiver-flow --repo <target-repo> --output-dir <dir> --extract --source <draft-or-context\.md>/);
  assert.match(receiverFlow, /\[CANDIDATE\]/);
  assert.match(receiverFlow, /\[NEEDS_REVIEW\]/);
  assert.match(testing, /v0\.5\.2 Receiver Flow Extract Candidate/);
  assert.match(dogfooding, /extract-self-smoke/);
  assert.match(dogfooding, /provider_request_performed`: false/);
  assert.match(release, /Receiver Flow Extract Candidate/);
  assert.match(release, /\[CANDIDATE\]/);
  assert.match(release, /\[NEEDS_REVIEW\]/);
  assert.match(release, /handoff_status: draft_needs_review/);
  assert.match(release, /No provider request/);
  assert.match(release, /No automatic promotion to `ready_for_receiver`/);
  assert.match(release, /No Auto Flow/);
  assert.match(release, /No `.basebrief\/`/);
  assert.match(release, /provider_probe_status=skipped/);
  assert.match(release, /No push, tag, or formal release/);

  for (const relativePath of [
    "docs/dogfooding/receiver-flow-extract-dogfooding.md",
    "docs/releases/v0.5.2.md",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
    assert.equal(result.warningCount, 0, relativePath);
  }
});

test("v0.5.3 receiver flow review closure documents accepted and rejected examples", () => {
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const docsIndex = readText("docs/index.md");
  const testing = readText("docs/testing.md");
  const dogfooding = readText("docs/dogfooding/receiver-flow-v0.5.x-closure.md");
  const release = readText("docs/releases/v0.5.3.md");
  const validReady = readText("examples/receiver-flow-review/valid-ready/receiver-ready.md");
  const rejectedCandidate = readText("examples/receiver-flow-review/rejected-candidate/draft-context.md");
  const rejectedEmpty = readText("examples/receiver-flow-review/rejected-empty/draft-context.md");

  assert.match(readme, /docs\/releases\/v0\.5\.3\.md/);
  assert.match(englishReadme, /docs\/releases\/v0\.5\.3\.md/);
  assert.match(docsIndex, /releases\/v0\.5\.3\.md/);
  assert.match(docsIndex, /dogfooding\/receiver-flow-v0\.5\.x-closure\.md/);
  assert.match(docsIndex, /examples\/receiver-flow-review\/valid-ready\/README\.md/);
  assert.match(docsIndex, /examples\/receiver-flow-review\/rejected-candidate\/README\.md/);
  assert.match(docsIndex, /examples\/receiver-flow-review\/rejected-empty\/README\.md/);
  assert.match(testing, /v0\.5\.3 Receiver Flow Review Closure/);
  assert.match(dogfooding, /v0\.5\.x-review-closure/);
  assert.match(dogfooding, /\[CANDIDATE\]/);
  assert.match(dogfooding, /\[EMPTY\]/);
  assert.match(release, /Receiver Flow Review Closure/);
  assert.match(release, /No new CLI command/);
  assert.match(release, /No `.basebrief\/`/);
  assert.match(release, /provider_probe_status=skipped/);
  assert.match(validReady, /handoff_status: ready_for_receiver/);
  assert.match(rejectedCandidate, /\[CANDIDATE\]/);
  assert.match(rejectedEmpty, /\[EMPTY\]/);

  for (const relativePath of [
    "docs/dogfooding/receiver-flow-v0.5.x-closure.md",
    "docs/releases/v0.5.3.md",
    "examples/receiver-flow-review/valid-ready",
    "examples/receiver-flow-review/rejected-candidate",
    "examples/receiver-flow-review/rejected-empty",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
    assert.equal(result.warningCount, 0, relativePath);
  }
});

test("v0.6.0 project state documents local state boundaries", () => {
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const docsIndex = readText("docs/index.md");
  const cliLite = readText("docs/cli-lite.md");
  const receiverFlow = readText("docs/receiver-flow.md");
  const testing = readText("docs/testing.md");
  const roadmap = readText("docs/roadmap/basebrief-long-term-baseline.md");
  const projectState = readText("docs/project-state.md");
  const dogfooding = readText("docs/dogfooding/project-state-dogfooding.md");
  const selfDogfooding = readText("docs/dogfooding/project-state-self-dogfooding-v0.6.x.md");
  const postReleaseBaseline = readText("docs/baselines/v0.6.0-post-release-baseline.md");
  const modelDoc = readText("docs/design/project-state-model.md");
  const validationRules = readText("docs/design/project-state-validation-rules.md");
  const v06xMatrix = readText("docs/testing-v0.6.x-test-matrix.md");
  const release = readText("docs/releases/v0.6.0.md");
  const schema = readJson("schemas/basebrief-project-state.schema.json");
  const exampleState = readJson("examples/project-state/state.json");

  assert.match(readme, /docs\/project-state\.md/);
  assert.match(readme, /docs\/releases\/v0\.6\.0\.md/);
  assert.match(englishReadme, /state-init/);
  assert.match(englishReadme, /docs\/project-state\.md/);
  assert.match(docsIndex, /project-state\.md/);
  assert.match(docsIndex, /design\/project-state-model\.md/);
  assert.match(docsIndex, /design\/project-state-validation-rules\.md/);
  assert.match(docsIndex, /releases\/v0\.6\.0\.md/);
  assert.match(docsIndex, /baselines\/v0\.6\.0-post-release-baseline\.md/);
  assert.match(docsIndex, /testing-v0\.6\.x-test-matrix\.md/);
  assert.match(docsIndex, /dogfooding\/project-state-dogfooding\.md/);
  assert.match(docsIndex, /dogfooding\/project-state-self-dogfooding-v0\.6\.x\.md/);
  assert.match(docsIndex, /examples\/project-state\/README\.md/);
  assert.match(cliLite, /state-init --repo <target-repo> --source <receiver-ready\.md>/);
  assert.match(cliLite, /state-read --repo <target-repo>/);
  assert.match(receiverFlow, /\.basebrief\/state\.json/);
  assert.match(testing, /v0\.6\.0 Project State Directory Release/);
  assert.match(testing, /v0\.6\.1 Stability And Self-Dogfooding/);
  assert.match(roadmap, /v0\.6\.0/);
  assert.match(projectState, /basebrief-project-state-v1/);
  assert.match(projectState, /No provider request/);
  assert.match(projectState, /No Auto Flow/);
  assert.match(projectState, /Receiver Safe Check config and result schemas are unchanged/);
  assert.match(dogfooding, /state-init --repo <target-repo> --source <receiver-ready\.md>/);
  assert.match(dogfooding, /No provider request/);
  assert.match(selfDogfooding, /receiver-flow --guided/);
  assert.match(selfDogfooding, /state-read --json/);
  assert.match(selfDogfooding, /No provider request/);
  assert.match(postReleaseBaseline, /release tag: `v0\.6\.0`/);
  assert.match(postReleaseBaseline, /provider_probe_status=skipped/);
  assert.match(modelDoc, /not a memory store/);
  assert.match(modelDoc, /basebrief-project-state-v1/);
  assert.match(validationRules, /handoff_status: ready_for_receiver/);
  assert.match(validationRules, /BASEBRIEF_PROVIDER_API_KEY/);
  assert.match(v06xMatrix, /BaseBrief v0\.6\.x Test Matrix/);
  assert.match(v06xMatrix, /BASEBRIEF_PROVIDER_BASE_URL/);
  assert.match(release, /Project State Directory Release/);
  assert.match(release, /\.basebrief\/state\.json/);
  assert.match(release, /basebrief-project-state-v1/);
  assert.match(release, /state-init/);
  assert.match(release, /state-read/);
  assert.match(release, /No provider request/);
  assert.match(release, /No Auto Flow/);
  assert.match(release, /No receiver thread creation/);
  assert.match(release, /No provider gateway/);
  assert.match(release, /No published npm package/);
  assert.match(release, /No global CLI installation/);
  assert.match(release, /provider_probe_status=skipped/);
  assert.match(release, /BB9 handoff schema is unchanged/);
  assert.match(release, /Receiver Safe Check config and result schemas are unchanged/);
  assert.equal(schema.properties.schemaVersion.const, PROJECT_STATE_SCHEMA_VERSION);
  assert.equal(exampleState.schemaVersion, PROJECT_STATE_SCHEMA_VERSION);
  assert.equal(exampleState.source.handoff_status, "ready_for_receiver");

  for (const relativePath of [
    "docs/project-state.md",
    "docs/dogfooding/project-state-dogfooding.md",
    "docs/dogfooding/project-state-self-dogfooding-v0.6.x.md",
    "docs/baselines/v0.6.0-post-release-baseline.md",
    "docs/design/project-state-model.md",
    "docs/design/project-state-validation-rules.md",
    "docs/releases/v0.6.0.md",
    "docs/testing-v0.6.x-test-matrix.md",
    "examples/project-state",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
  }
});

test("v0.6.2 self-dogfooding documents exception evidence without new lifecycle scope", () => {
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const docsIndex = readText("docs/index.md");
  const frictionLog = readText("docs/dogfooding/receiver-friction-log.md");
  const selfDogfooding = readText("docs/dogfooding/project-state-self-dogfooding-v0.6.2.md");
  const v06xMatrix = readText("docs/testing-v0.6.x-test-matrix.md");
  const release = readText("docs/releases/v0.6.2.md");

  assert.match(readme, /docs\/dogfooding\/project-state-self-dogfooding-v0\.6\.2\.md/);
  assert.match(readme, /docs\/releases\/v0\.6\.2\.md/);
  assert.match(englishReadme, /docs\/dogfooding\/project-state-self-dogfooding-v0\.6\.2\.md/);
  assert.match(englishReadme, /docs\/releases\/v0\.6\.2\.md/);
  assert.match(docsIndex, /dogfooding\/project-state-self-dogfooding-v0\.6\.2\.md/);
  assert.match(docsIndex, /releases\/v0\.6\.2\.md/);

  for (const doc of [selfDogfooding, v06xMatrix, release]) {
    assert.match(doc, /draft_needs_review/);
    assert.match(doc, /ready_for_receiver/);
    assert.match(doc, /basebrief-project-state-v1/);
    assert.match(doc, /state-init-draft-rejected/);
    assert.match(doc, /state-init-env-source-rejected/);
    assert.match(doc, /state-init-git-source-rejected/);
    assert.match(doc, /state-init-missing-field-rejected/);
    assert.match(doc, /state-init-duplicate-rejected/);
  }

  assert.match(selfDogfooding, /receiver-flow --guided/);
  assert.match(selfDogfooding, /review-draft-unchecked/);
  assert.match(selfDogfooding, /state-read-missing-state/);
  assert.match(selfDogfooding, /No provider request/);
  assert.match(selfDogfooding, /not memory/);
  assert.match(frictionLog, /v0\.6\.2 Project-State Self-Dogfooding/);
  assert.match(frictionLog, /overreach_or_unwanted_automation/);
  assert.match(frictionLog, /state-init-duplicate-rejected/);
  assert.match(release, /Self-Dogfooding Evidence Candidate/);
  assert.match(release, /No provider request/);
  assert.match(release, /No Auto Flow/);
  assert.match(release, /No state lifecycle commands/);
  assert.match(release, /No schema change/);
  assert.match(release, /provider_probe_status=skipped/);
  assert.match(release, /BASEBRIEF_PROVIDER_BASE_URL/);
  assert.match(release, /BASEBRIEF_PROVIDER_API_KEY/);
  assert.match(release, /BASEBRIEF_PROVIDER_MODEL/);

  for (const relativePath of [
    "docs/dogfooding/project-state-self-dogfooding-v0.6.2.md",
    "docs/releases/v0.6.2.md",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
  }
});

test("v0.6.3 lifecycle readiness gate documents criteria without lifecycle commands", () => {
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const docsIndex = readText("docs/index.md");
  const frictionLog = readText("docs/dogfooding/receiver-friction-log.md");
  const readinessDoc = readText("docs/design/project-state-lifecycle-readiness.md");
  const dogfooding = readText("docs/dogfooding/project-state-lifecycle-readiness-v0.6.3.md");
  const v06xMatrix = readText("docs/testing-v0.6.x-test-matrix.md");
  const release = readText("docs/releases/v0.6.3.md");
  const schema = readJson("schemas/basebrief-project-state.schema.json");

  assert.match(readme, /docs\/design\/project-state-lifecycle-readiness\.md/);
  assert.match(readme, /docs\/dogfooding\/project-state-lifecycle-readiness-v0\.6\.3\.md/);
  assert.match(readme, /docs\/releases\/v0\.6\.3\.md/);
  assert.match(englishReadme, /docs\/design\/project-state-lifecycle-readiness\.md/);
  assert.match(englishReadme, /docs\/dogfooding\/project-state-lifecycle-readiness-v0\.6\.3\.md/);
  assert.match(englishReadme, /docs\/releases\/v0\.6\.3\.md/);
  assert.match(docsIndex, /design\/project-state-lifecycle-readiness\.md/);
  assert.match(docsIndex, /dogfooding\/project-state-lifecycle-readiness-v0\.6\.3\.md/);
  assert.match(docsIndex, /releases\/v0\.6\.3\.md/);

  for (const doc of [readinessDoc, dogfooding, v06xMatrix, release]) {
    assert.match(doc, /No state lifecycle commands|does not add state lifecycle commands/);
    assert.match(doc, /No Auto Flow|Auto Flow are not automated yet/);
    assert.match(doc, /No provider request|does not run provider requests/);
    assert.match(doc, /No schema change|does not change/);
    assert.match(doc, /provider_probe_status=skipped/);
  }

  assert.match(readinessDoc, /Readiness Criteria/);
  assert.match(readinessDoc, /basebrief-project-state-v1/);
  assert.match(readinessDoc, /BASEBRIEF_PROVIDER_BASE_URL/);
  assert.match(readinessDoc, /BASEBRIEF_PROVIDER_API_KEY/);
  assert.match(readinessDoc, /BASEBRIEF_PROVIDER_MODEL/);
  assert.match(dogfooding, /state-init-duplicate-rejected/);
  assert.match(dogfooding, /state-read-missing-state/);
  assert.match(dogfooding, /review-draft-unchecked/);
  assert.match(dogfooding, /state-advance/);
  assert.match(dogfooding, /state-status/);
  assert.match(dogfooding, /state-validate/);
  assert.match(dogfooding, /state-history/);
  assert.match(frictionLog, /v0\.6\.3 Lifecycle Readiness Classification/);
  assert.match(frictionLog, /lifecycle-readiness-v0\.6\.3/);
  assert.match(frictionLog, /not_automated_yet/);
  assert.match(release, /Lifecycle Readiness Gate Candidate/);
  assert.match(release, /not a lifecycle release/);
  assert.equal(schema.properties.schemaVersion.const, PROJECT_STATE_SCHEMA_VERSION);

  for (const relativePath of [
    "docs/design/project-state-lifecycle-readiness.md",
    "docs/dogfooding/project-state-lifecycle-readiness-v0.6.3.md",
    "docs/releases/v0.6.3.md",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
  }
});

test("v0.7.0 project state lifecycle documents commands without schema or provider expansion", () => {
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const docsIndex = readText("docs/index.md");
  const projectState = readText("docs/project-state.md");
  const lifecycleModel = readText("docs/design/project-state-lifecycle-model.md");
  const dogfooding = readText("docs/dogfooding/project-state-lifecycle-v0.7.0.md");
  const matrix = readText("docs/testing-v0.7.x-test-matrix.md");
  const cliLite = readText("docs/cli-lite.md");
  const testing = readText("docs/testing.md");
  const release = readText("docs/releases/v0.7.0.md");
  const schema = readJson("schemas/basebrief-project-state.schema.json");

  assert.match(readme, /docs\/design\/project-state-lifecycle-model\.md/);
  assert.match(readme, /docs\/dogfooding\/project-state-lifecycle-v0\.7\.0\.md/);
  assert.match(readme, /docs\/testing-v0\.7\.x-test-matrix\.md/);
  assert.match(readme, /docs\/releases\/v0\.7\.0\.md/);
  assert.match(englishReadme, /state-status/);
  assert.match(englishReadme, /state-advance/);
  assert.match(englishReadme, /docs\/design\/project-state-lifecycle-model\.md/);
  assert.match(englishReadme, /docs\/dogfooding\/project-state-lifecycle-v0\.7\.0\.md/);
  assert.match(docsIndex, /design\/project-state-lifecycle-model\.md/);
  assert.match(docsIndex, /dogfooding\/project-state-lifecycle-v0\.7\.0\.md/);
  assert.match(docsIndex, /testing-v0\.7\.x-test-matrix\.md/);
  assert.match(docsIndex, /releases\/v0\.7\.0\.md/);

  for (const doc of [projectState, lifecycleModel, dogfooding, matrix, cliLite, release]) {
    assert.match(doc, /state-status/);
    assert.match(doc, /state-validate/);
    assert.match(doc, /state-history/);
    assert.match(doc, /state-advance/);
    assert.match(doc, /basebrief-project-state-v1/);
    assert.match(doc, /No Auto Flow|Auto Flow/);
    assert.match(doc, /No provider request|Provider execution remains out of scope/);
    assert.match(doc, /No schema change|without changing/);
  }

  assert.match(projectState, /\.basebrief\/history\//);
  assert.match(lifecycleModel, /Project State Lifecycle Model/);
  assert.match(dogfooding, /Project State Lifecycle v0\.7\.0/);
  assert.match(dogfooding, /state-advance-archives-history/);
  assert.match(matrix, /BaseBrief v0\.7\.x Test Matrix/);
  assert.match(matrix, /state-status-missing/);
  assert.match(matrix, /state-validate-invalid/);
  assert.match(matrix, /state-advance-draft-rejected/);
  assert.match(matrix, /provider_probe_status=skipped/);
  assert.match(testing, /v0\.7\.0 Project State Lifecycle Candidate/);
  assert.match(testing, /testing-v0\.7\.x-test-matrix\.md/);
  assert.match(release, /Project State Lifecycle Candidate/);
  assert.match(release, /provider_probe_status=skipped/);
  assert.match(release, /BASEBRIEF_PROVIDER_BASE_URL/);
  assert.match(release, /BASEBRIEF_PROVIDER_API_KEY/);
  assert.match(release, /BASEBRIEF_PROVIDER_MODEL/);
  assert.equal(schema.properties.schemaVersion.const, PROJECT_STATE_SCHEMA_VERSION);

  for (const relativePath of [
    "docs/project-state.md",
    "docs/design/project-state-lifecycle-model.md",
    "docs/dogfooding/project-state-lifecycle-v0.7.0.md",
    "docs/testing-v0.7.x-test-matrix.md",
    "docs/releases/v0.7.0.md",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
  }
});

test("v0.8.0 sidecar handoff bundle documents local-only project-state consumption", () => {
  const docsIndex = readText("docs/index.md");
  const cliLite = readText("docs/cli-lite.md");
  const projectState = readText("docs/project-state.md");
  const release = readText("docs/releases/v0.8.0.md");

  assert.match(docsIndex, /releases\/v0\.8\.0\.md/);
  assert.match(cliLite, /sidecar-build --repo <target-repo>/);
  assert.match(cliLite, /--target generic\|openclaw/);
  assert.match(projectState, /sidecar-build --repo <target-repo>/);
  assert.match(projectState, /basebrief-project-state-v1/);
  assert.match(projectState, /\.basebrief\/sidecar\/<target>\//);

  for (const doc of [cliLite, projectState, release]) {
    assert.match(doc, /No provider request/);
    assert.match(doc, /No raw private output/);
    assert.match(doc, /No runtime integration|No runtime/);
    assert.match(doc, /No schema change/);
  }

  assert.match(release, /Sidecar Handoff Bundle Candidate/);
  assert.match(release, /handoff\.md/);
  assert.match(release, /next-chat-prompt\.md/);
  assert.match(release, /manifest\.json/);
  assert.match(release, /Wait for user confirmation/);
  assert.match(release, /provider_probe_status=skipped/);

  for (const relativePath of [
    "docs/cli-lite.md",
    "docs/project-state.md",
    "docs/releases/v0.8.0.md",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
  }
});

test("v0.8.1 sidecar check documents read-only bundle acceptance", () => {
  const docsIndex = readText("docs/index.md");
  const cliLite = readText("docs/cli-lite.md");
  const projectState = readText("docs/project-state.md");
  const release = readText("docs/releases/v0.8.1.md");

  assert.match(docsIndex, /releases\/v0\.8\.1\.md/);
  assert.match(cliLite, /sidecar-check --input <sidecar-dir>/);
  assert.match(projectState, /sidecar-check --input <sidecar-dir>/);
  assert.match(release, /Sidecar Check Hardening Candidate/);
  assert.match(release, /basebrief-sidecar-v1/);
  assert.match(release, /basebrief-project-state-v1/);
  assert.match(release, /current_goal/);
  assert.match(release, /receiver_entry_task/);
  assert.match(release, /risk_boundaries/);

  for (const doc of [cliLite, projectState, release]) {
    assert.match(doc, /No provider request/);
    assert.match(doc, /No raw private output/);
    assert.match(doc, /No runtime integration|No runtime/);
    assert.match(doc, /No schema change/);
  }

  assert.match(release, /provider_probe_status=skipped/);
  assert.match(release, /profile\/config\/memory\/workspace/);

  for (const relativePath of [
    "docs/cli-lite.md",
    "docs/project-state.md",
    "docs/releases/v0.8.1.md",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
  }
});

test("public quickstart and minimal examples provide a clean first-use path", () => {
  const quickstart = readText("docs/quickstart-5min.md");
  const minimalBrief = readText("examples/minimal/output-basebrief-lite.md");
  const minimalNextChat = readText("examples/minimal/next-chat-prompt.md");
  assert.match(quickstart, /路径 A/);
  assert.match(quickstart, /路径 B/);
  assert.match(quickstart, /路径 C/);
  assert.match(quickstart, /路径 D/);
  assert.match(quickstart, /来源窗口已验证/);
  assert.match(quickstart, /当前工作目录与目标仓库是否一致/);
  assert.match(quickstart, /match_latest_user_message/);
  assert.match(quickstart, /expected_changed_files/);
  assert.match(quickstart, /receiver_check_config/);
  assert.match(quickstart, /receiver-init --repo \. --output tests\/outputs\/private\/quickstart\/receiver-check\.json/);
  assert.match(quickstart, /不是接收窗口验收/);
  assert.match(quickstart, /handoff_acceptance/);
  assert.match(minimalBrief, /handoff_status/);
  assert.match(minimalBrief, /handoff_protocol_version/);
  assert.match(minimalBrief, /generated_at/);
  assert.match(minimalBrief, /preferred_language/);
  assert.match(minimalBrief, /response_language/);
  assert.match(minimalBrief, /receiver_entry_task/);
  assert.match(minimalBrief, /post_acceptance_next_action/);
  assert.match(minimalBrief, /expected_changed_files/);
  assert.match(minimalBrief, /receiver_check_config/);
  assert.match(minimalBrief, /receiver_task_status/);
  assert.match(minimalBrief, /repository_state_status/);
  assert.match(minimalBrief, /declared_checks_status/);
  assert.match(minimalBrief, /handoff_acceptance/);
  assert.match(minimalNextChat, /来源窗口已验证与接收窗口本轮已验证/);
  assert.match(minimalNextChat, /不要再次建议开启新窗口/);
  assert.match(minimalNextChat, /用户最新消息的自然语言主体/);

  const result = checkArtifacts({ inputPath: path.join(repoRoot, "examples/minimal") });
  assert.equal(result.status, "passed");
  assert.equal(result.errorCount, 0);
});

test("Quickstart Lite workflow builds and checks without warnings", () => withTempDir((tempDir) => {
  const outputDir = path.join(tempDir, "quickstart", "build");
  const buildResult = commandBuild({
    input: path.join(repoRoot, "examples/structured-handoff-lite.md"),
    "output-dir": outputDir,
    check: true,
  });
  const checkResult = commandCheck({ input: outputDir });

  assert.equal(buildResult.check.status, "passed");
  assert.equal(buildResult.check.errorCount, 0);
  assert.equal(buildResult.check.warningCount, 0);
  assert.equal(checkResult.check.warningCount, 0);
  assert.match(fs.readFileSync(path.join(outputDir, "readableBrief.md"), "utf8"), /## open_questions/);
}));

test("BB9 handoff contract and examples match schema boundaries", () => {
  const schema = readJson("schemas/bb9-handoff.schema.json");
  const fullInput = readJson("examples/bb9-handoff-full-input.json");
  const liteInput = readJson("examples/bb9-handoff-lite-input.json");
  const handoffDoc = readText("docs/handoff.md");

  validateBb9HandoffInputAgainstSchema(fullInput, schema);
  validateBb9HandoffInputAgainstSchema(liteInput, schema);
  ["readableBrief", "cacheSidecar", "activeProviderPrompt", "handoff.meta.json"].forEach((artifact) => {
    assert(handoffDoc.includes(artifact), `handoff doc missing artifact: ${artifact}`);
  });
  assert.match(handoffDoc, /BB12 is a MiMo-specific selector candidate/);
});

test("structured handoff markdown examples expose valid JSON blocks", () => {
  const full = extractHandoffJsonBlock(readText("examples/structured-handoff-full.md"));
  const lite = extractHandoffJsonBlock(readText("examples/structured-handoff-lite.md"));

  validateHandoffInput(full);
  validateHandoffInput(lite);
  assert.equal(full.mode, "full");
  assert.equal(lite.mode, "lite");
});

test("handoff builder writes prompt artifacts from structured markdown", () => withTempDir((tempDir) => {
  const outputDir = path.join(tempDir, "mimo");
  const result = buildHandoffArtifacts({
    inputPath: path.join(repoRoot, "examples/structured-handoff-full.md"),
    outputDir,
    providerProfile: "mimo",
  });

  assert.equal(result.wroteCacheSidecar, true);
  assert(fs.existsSync(path.join(outputDir, "readableBrief.md")));
  assert(fs.existsSync(path.join(outputDir, "cacheSidecar.md")));
  assert(fs.existsSync(path.join(outputDir, "activeProviderPrompt.md")));
  assert(fs.existsSync(path.join(outputDir, "handoff.meta.json")));

  const meta = JSON.parse(fs.readFileSync(path.join(outputDir, "handoff.meta.json"), "utf8"));
  assert.equal(meta.recommendedPromptType, "cacheSidecar");
  assert.equal(meta.artifacts.cacheSidecar, "cacheSidecar.md");
  assert.equal(meta.providerProfile.defaultPromptStrategy, "bb9_sidecar");
  assert.equal(meta.providerProfile.activePromptStrategy, "cacheSidecar");
  assert(meta.providerProfile.experimentalCandidates.some((candidate) => candidate.candidateId === "bb12SizeBandGuard"));
  assert(!JSON.stringify(meta).includes("# BaseBrief BB9 Cache Sidecar"));
  assert(!JSON.stringify(meta).includes("BASEBRIEF_CACHE_BLOCK_PAD"));
}));

test("handoff builder falls back to readable prompt for relay profile", () => withTempDir((tempDir) => {
  const outputDir = path.join(tempDir, "relay");
  const result = buildHandoffArtifacts({
    inputPath: path.join(repoRoot, "examples/structured-handoff-lite.md"),
    outputDir,
    providerProfile: "relay-openai-gpt55-codex-oauth",
  });

  assert.equal(result.wroteCacheSidecar, false);
  assert(fs.existsSync(path.join(outputDir, "readableBrief.md")));
  assert(fs.existsSync(path.join(outputDir, "activeProviderPrompt.md")));
  assert(!fs.existsSync(path.join(outputDir, "cacheSidecar.md")));
  const readable = fs.readFileSync(path.join(outputDir, "readableBrief.md"), "utf8");
  const active = fs.readFileSync(path.join(outputDir, "activeProviderPrompt.md"), "utf8");
  const meta = JSON.parse(fs.readFileSync(path.join(outputDir, "handoff.meta.json"), "utf8"));
  assert.equal(active, readable);
  assert.equal(meta.recommendedPromptType, "readableBrief");
  assert.equal(meta.providerProfile.defaultPromptStrategy, "readable_fallback");
  assert.equal(meta.providerProfile.activePromptStrategy, "readableBrief");
  assert.equal(meta.artifacts.cacheSidecar, null);
}));

test("handoff builder rejects missing block, invalid json, and schema failures", () => withTempDir((tempDir) => {
  const noBlock = path.join(tempDir, "no-block.md");
  const invalidJson = path.join(tempDir, "invalid-json.md");
  const missingField = path.join(tempDir, "missing-field.json");
  fs.writeFileSync(noBlock, "# no block\n", "utf8");
  fs.writeFileSync(invalidJson, [
    "<!-- BASEBRIEF_HANDOFF_JSON_BEGIN -->",
    "```json",
    "{",
    "```",
    "<!-- BASEBRIEF_HANDOFF_JSON_END -->",
  ].join("\n"), "utf8");
  fs.writeFileSync(missingField, JSON.stringify({ mode: "lite" }), "utf8");

  assert.throws(
    () => buildHandoffArtifacts({ inputPath: noBlock, outputDir: path.join(tempDir, "out-a") }),
    /Missing BASEBRIEF handoff JSON block/,
  );
  assert.throws(
    () => buildHandoffArtifacts({ inputPath: invalidJson, outputDir: path.join(tempDir, "out-b") }),
    /Invalid handoff JSON/,
  );
  assert.throws(
    () => buildHandoffArtifacts({ inputPath: missingField, outputDir: path.join(tempDir, "out-c") }),
    /Missing required key: project_identity/,
  );
}));

test("handoff builder CLI accepts markdown input and writes metadata", () => withTempDir((tempDir) => {
  const outputDir = path.join(tempDir, "cli");
  const stdout = execFileSync(process.execPath, [
    "scripts/basebrief_build_handoff.js",
    "--input",
    "examples/structured-handoff-full.md",
    "--output-dir",
    outputDir,
    "--provider-profile",
    "deepseek",
    "--json",
  ], { cwd: repoRoot, encoding: "utf8" });

  const result = JSON.parse(stdout);
  assert.equal(result.wroteCacheSidecar, true);
  const meta = JSON.parse(fs.readFileSync(path.join(outputDir, "handoff.meta.json"), "utf8"));
  assert.equal(meta.providerProfile.profileId, "deepseek");
}));

test("adapter builder writes Codex and Claude outputs from structured markdown", () => withTempDir((tempDir) => {
  const outputDir = path.join(tempDir, "adapters");
  const result = buildAdapterArtifacts({
    inputPath: path.join(repoRoot, "examples/structured-handoff-full.md"),
    outputDir,
    target: "all",
  });

  assert.deepEqual(result.targets, ["codex", "claude"]);
  assert(fs.existsSync(path.join(outputDir, "codex-task.md")));
  assert(fs.existsSync(path.join(outputDir, "claude-project-context.md")));
  assert(fs.existsSync(path.join(outputDir, "adapter.meta.json")));

  const codex = fs.readFileSync(path.join(outputDir, "codex-task.md"), "utf8");
  const claude = fs.readFileSync(path.join(outputDir, "claude-project-context.md"), "utf8");
  const meta = JSON.parse(fs.readFileSync(path.join(outputDir, "adapter.meta.json"), "utf8"));

  for (const content of [codex, claude]) {
    assert.match(content, /Verified Facts/);
    assert.match(content, /Confirmed Decisions/);
    assert.match(content, /Risk Boundaries/);
    assert.match(content, /Open Questions/);
    assert.doesNotMatch(content, /BASEBRIEF_CACHE_BLOCK_PAD|cacheSidecar|Bearer\s+|sk-[A-Za-z0-9]{10,}|[A-Z]:\\/);
  }
  assert.equal(meta.inputMode, "full");
  assert.equal(meta.outputFiles.codex, "codex-task.md");
  assert.equal(meta.outputFiles.claude, "claude-project-context.md");
  assert(!JSON.stringify(meta).includes("Prepare a complete handoff"));
}));

test("adapter builder respects individual targets", () => withTempDir((tempDir) => {
  const codexDir = path.join(tempDir, "codex");
  const claudeDir = path.join(tempDir, "claude");

  buildAdapterArtifacts({
    inputPath: path.join(repoRoot, "examples/structured-handoff-full.md"),
    outputDir: codexDir,
    target: "codex",
  });
  buildAdapterArtifacts({
    inputPath: path.join(repoRoot, "examples/structured-handoff-full.md"),
    outputDir: claudeDir,
    target: "claude",
  });

  assert(fs.existsSync(path.join(codexDir, "codex-task.md")));
  assert(!fs.existsSync(path.join(codexDir, "claude-project-context.md")));
  assert(!fs.existsSync(path.join(claudeDir, "codex-task.md")));
  assert(fs.existsSync(path.join(claudeDir, "claude-project-context.md")));
}));

test("adapter builder rejects missing arguments, invalid targets, and schema failures", () => withTempDir((tempDir) => {
  const missingField = path.join(tempDir, "missing-field.json");
  fs.writeFileSync(missingField, JSON.stringify({ mode: "full" }), "utf8");

  assert.throws(
    () => buildAdapterArtifacts({ outputDir: tempDir, target: "all" }),
    /Missing --input/,
  );
  assert.throws(
    () => buildAdapterArtifacts({ inputPath: path.join(repoRoot, "examples/structured-handoff-full.md"), target: "all" }),
    /Missing --output-dir/,
  );
  assert.throws(
    () => normalizeTargets("cursor"),
    /--target must be codex, claude, or all/,
  );
  assert.throws(
    () => buildAdapterArtifacts({ inputPath: missingField, outputDir: path.join(tempDir, "bad"), target: "all" }),
    /Missing required key: project_identity/,
  );
}));

test("adapter builder CLI writes selected target metadata", () => withTempDir((tempDir) => {
  const outputDir = path.join(tempDir, "cli");
  const stdout = execFileSync(process.execPath, [
    "scripts/basebrief_build_adapters.js",
    "--input",
    "examples/structured-handoff-full.md",
    "--output-dir",
    outputDir,
    "--target",
    "codex",
    "--json",
  ], { cwd: repoRoot, encoding: "utf8" });

  const result = JSON.parse(stdout);
  assert.deepEqual(result.targets, ["codex"]);
  assert(fs.existsSync(path.join(outputDir, "codex-task.md")));
  assert(!fs.existsSync(path.join(outputDir, "claude-project-context.md")));
}));

test("artifact checker passes clean structured and adapter examples", () => withTempDir((tempDir) => {
  const outputDir = path.join(tempDir, "clean");
  fs.mkdirSync(outputDir, { recursive: true });
  for (const relativePath of [
    "examples/structured-handoff-full.md",
    "examples/adapter-codex-task.md",
    "examples/adapter-claude-project-context.md",
  ]) {
    fs.copyFileSync(path.join(repoRoot, relativePath), path.join(outputDir, path.basename(relativePath)));
  }

  const result = checkArtifacts({ inputPath: outputDir });
  assert.equal(result.status, "passed");
  assert.equal(result.errorCount, 0);
  assert.equal(result.warningCount, 0);
  assert.deepEqual(result.findings, []);
}));

test("artifact checker CLI emits stable json for clean input", () => {
  const stdout = execFileSync(process.execPath, [
    "scripts/basebrief_check_artifacts.js",
    "--input",
    "examples/adapter-codex-task.md",
    "--json",
  ], { cwd: repoRoot, encoding: "utf8" });

  const result = JSON.parse(stdout);
  assert.equal(result.status, "passed");
  assert.equal(result.errorCount, 0);
  assert.equal(result.warningCount, 0);
  assert(Array.isArray(result.findings));
});

test("artifact checker reports errors for secrets, bearer tokens, and private paths", () => withTempDir((tempDir) => {
  const filePath = path.join(tempDir, "codex-task.md");
  fs.writeFileSync(filePath, [
    "# BaseBrief Codex Task",
    "",
    "## Risk Boundaries",
    "- keep safe",
    "",
    "## Open Questions",
    "- none",
    "",
    `api_key=${"sk-" + "1234567890abcdef"}`,
    `Authorization: ${"Bearer " + "abcdef1234567890"}`,
    `Path: ${"D:" + "\\BaseBrief-private\\secret.md"}`,
    "",
  ].join("\n"), "utf8");

  const result = checkArtifacts({ inputPath: filePath });
  assert.equal(result.status, "failed");
  assert(result.errorCount >= 3);
  assert(result.findings.some((finding) => finding.ruleId === "secret.sk"));
  assert(result.findings.some((finding) => finding.ruleId === "secret.bearer"));
  assert(result.findings.some((finding) => finding.ruleId === "private.absolute-path"));
}));

test("artifact checker blocks common fake secret formats without echoing values", () => withTempDir((tempDir) => {
  const fakeSecrets = {
    "secret.github-token": `gh${"p_"}fakegithubtoken1234567890`,
    "secret.aws-access-key": `${"AKIA"}IOSFODNN7EXAMPLE`,
    "secret.slack-token": `xox${"b-"}fake-slack-token-1234567890`,
    "secret.google-api-key": `${"AIza"}SyFakeGoogleApiKey1234567890`,
    "secret.private-key-block": `-----BEGIN ${"PRIVATE"} KEY-----`,
  };
  const filePath = path.join(tempDir, "secrets.md");
  fs.writeFileSync(filePath, [
    "# Fake Secrets",
    "",
    ...Object.values(fakeSecrets),
    "",
  ].join("\n"), "utf8");

  const result = checkArtifacts({ inputPath: filePath });
  const serialized = JSON.stringify(result);
  assert.equal(result.status, "failed");
  for (const ruleId of Object.keys(fakeSecrets)) {
    assert(result.findings.some((finding) => finding.ruleId === ruleId), ruleId);
  }
  for (const value of Object.values(fakeSecrets)) {
    assert.equal(serialized.includes(value), false, value);
  }
}));

test("artifact checker handles broken markdown and skips noisy directories", () => withTempDir((tempDir) => {
  fs.writeFileSync(path.join(tempDir, "broken.md"), [
    "# Broken Markdown",
    "",
    "```js",
    "console.log('unterminated fence')",
    "",
    "- L1",
    "  - L2",
    "    - L3",
    "中文 and zero width marker stay public-safe.",
    "",
  ].join("\n"), "utf8");
  for (const dirName of ["node_modules", "dist", ".cache", "coverage", "private"]) {
    fs.mkdirSync(path.join(tempDir, dirName), { recursive: true });
    fs.writeFileSync(path.join(tempDir, dirName, "secret.md"), `${"sk-"}testsecretvalue123456\n`, "utf8");
  }

  const result = checkArtifacts({ inputPath: tempDir });
  assert.equal(result.status, "passed");
  assert.equal(result.errorCount, 0);
  assert.equal(result.warningCount, 0);
}));

test("artifact checker rejects provider sidecar content in adapter outputs", () => withTempDir((tempDir) => {
  const filePath = path.join(tempDir, "codex-task.md");
  fs.writeFileSync(filePath, [
    "# BaseBrief Codex Task",
    "",
    "## Risk Boundaries",
    "- keep provider-only prompt text out",
    "",
    "## Open Questions",
    "- none",
    "",
    "BASEBRIEF_CACHE_BLOCK_PAD",
    "",
  ].join("\n"), "utf8");

  const result = checkArtifacts({ inputPath: filePath });
  assert.equal(result.status, "failed");
  assert(result.findings.some((finding) => finding.ruleId === "adapter.provider-sidecar"));
}));

test("artifact checker distinguishes missing risk errors from missing open-question warnings", () => withTempDir((tempDir) => {
  const missingRisk = path.join(tempDir, "missing-risk.md");
  const missingOpen = path.join(tempDir, "missing-open.md");
  fs.writeFileSync(missingRisk, [
    "# BaseBrief Codex Task",
    "",
    "## Open Questions",
    "- none",
    "",
  ].join("\n"), "utf8");
  fs.writeFileSync(missingOpen, [
    "# BaseBrief Codex Task",
    "",
    "## Risk Boundaries",
    "- keep safe",
    "",
  ].join("\n"), "utf8");

  const riskResult = checkArtifacts({ inputPath: missingRisk });
  const openResult = checkArtifacts({ inputPath: missingOpen });
  assert.equal(riskResult.status, "failed");
  assert(riskResult.findings.some((finding) => finding.ruleId === `artifact.missing-${"risk"}-boundaries`));
  assert.equal(openResult.status, "passed");
  assert.equal(openResult.errorCount, 0);
  assert.equal(openResult.warningCount, 1);
  assert(openResult.findings.some((finding) => finding.ruleId === "artifact.missing-open-questions"));
}));

test("artifact checker warns on provider-general savings claims", () => withTempDir((tempDir) => {
  const filePath = path.join(tempDir, "claim.md");
  fs.writeFileSync(filePath, [
    "# BaseBrief Codex Task",
    "",
    "## Risk Boundaries",
    "- keep provider claims scoped",
    "",
    "## Open Questions",
    "- none",
    "",
    "This is cross-provider proof of savings.",
    "",
  ].join("\n"), "utf8");

  const result = checkArtifacts({ inputPath: filePath });
  assert.equal(result.status, "passed");
  assert.equal(result.errorCount, 0);
  assert.equal(result.warningCount, 1);
  assert(result.findings.some((finding) => finding.ruleId === "provider.overgeneralized-claim"));
}));

test("artifact checker CLI exits nonzero on errors", () => withTempDir((tempDir) => {
  const filePath = path.join(tempDir, "codex-task.md");
  fs.writeFileSync(filePath, [
    "# BaseBrief Codex Task",
    "",
    "## Open Questions",
    "- none",
    "",
  ].join("\n"), "utf8");

  let error;
  try {
    execFileSync(process.execPath, [
      "scripts/basebrief_check_artifacts.js",
      "--input",
      filePath,
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });
  } catch (caught) {
    error = caught;
  }
  assert(error, "checker CLI should fail on missing risk boundaries");
  assert.notEqual(error.status, 0);
  const result = JSON.parse(error.stdout);
  assert(result.findings.some((finding) => finding.ruleId === `artifact.missing-${"risk"}-boundaries`));
}));

test("CLI Lite init writes a schema-compatible starter input", () => withTempDir((tempDir) => {
  const outputDir = path.join(tempDir, "starter");
  const result = commandInit({ "output-dir": outputDir });
  const starterPath = path.join(outputDir, "basebrief-handoff-input.json");
  const starter = JSON.parse(fs.readFileSync(starterPath, "utf8"));
  const schema = readJson("schemas/bb9-handoff.schema.json");

  assert.equal(result.command, "init");
  assert.equal(result.outputFiles.starter, starterPath);
  validateBb9HandoffInputAgainstSchema(starter, schema);
  validateBb9HandoffInputAgainstSchema(starterInput(), schema);
  assert.equal(starter.provider_profile, "unknown");
}));

test("CLI Lite build writes handoff and adapter outputs with check summary", () => withTempDir((tempDir) => {
  const outputDir = path.join(tempDir, "build");
  const result = commandBuild({
    input: path.join(repoRoot, "examples/structured-handoff-full.md"),
    "output-dir": outputDir,
    "provider-profile": "relay-openai-gpt55-codex-oauth",
    adapters: "all",
    check: true,
  });

  assert.equal(result.command, "build");
  assert.equal(result.check.status, "passed");
  assert.equal(result.handoff.wroteCacheSidecar, false);
  assert.equal(result.adapters.targets.length, 2);
  assert(fs.existsSync(path.join(outputDir, "readableBrief.md")));
  assert(fs.existsSync(path.join(outputDir, "activeProviderPrompt.md")));
  assert(fs.existsSync(path.join(outputDir, "handoff.meta.json")));
  assert(fs.existsSync(path.join(outputDir, "adapters", "codex-task.md")));
  assert(fs.existsSync(path.join(outputDir, "adapters", "claude-project-context.md")));
  assert(!JSON.stringify(result).includes("Prepare a complete handoff"));
}));

test("CLI Lite build can skip adapters explicitly", () => withTempDir((tempDir) => {
  const outputDir = path.join(tempDir, "build-no-adapters");
  const result = commandBuild({
    input: path.join(repoRoot, "examples/structured-handoff-full.md"),
    "output-dir": outputDir,
    adapters: "none",
  });

  assert.equal(result.command, "build");
  assert.equal(result.adapters, null);
  assert(fs.existsSync(path.join(outputDir, "readableBrief.md")));
  assert(!fs.existsSync(path.join(outputDir, "adapters")));
}));

test("CLI Lite check delegates to artifact checker", () => {
  const result = commandCheck({ input: path.join(repoRoot, "examples/adapter-codex-task.md") });

  assert.equal(result.command, "check");
  assert.equal(result.check.status, "passed");
  assert.equal(result.check.errorCount, 0);
  assert(Array.isArray(result.check.findings));
});

test("CLI Lite human output explains warning findings and keeps warning exit zero", () => withTempDir((tempDir) => {
  const filePath = path.join(tempDir, "codex-task.md");
  fs.writeFileSync(filePath, [
    "# BaseBrief Codex Task",
    "",
    "## Risk Boundaries",
    "- keep the task bounded",
    "",
  ].join("\n"), "utf8");

  const stdout = execFileSync(process.execPath, [
    "scripts/basebrief.js",
    "check",
    "--input",
    filePath,
  ], { cwd: repoRoot, encoding: "utf8" });

  assert.match(stdout, /warnings=1/);
  assert.match(stdout, /WARNING artifact\.missing-open-questions codex-task\.md:1/);
}));

test("CLI Lite build human output explains error findings", () => withTempDir((tempDir) => {
  const outputDir = path.join(tempDir, "dirty-out");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "codex-task.md"), [
    "# BaseBrief Codex Task",
    "",
    "## Open Questions",
    "- none",
    "",
  ].join("\n"), "utf8");

  let error;
  try {
    execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "build",
      "--input",
      "examples/structured-handoff-full.md",
      "--output-dir",
      outputDir,
      "--check",
    ], { cwd: repoRoot, encoding: "utf8" });
  } catch (caught) {
    error = caught;
  }

  assert(error, "CLI build --check should fail when checker reports errors");
  assert(error.stdout.includes(`ERROR artifact.missing-${"risk"}-boundaries codex-task.md:1`));
}));

test("CLI Lite rejects missing command, missing args, and invalid adapter targets", () => {
  assert.equal(run(["node", "scripts/basebrief.js"]).command, "help");
  assert.equal(run(["node", "scripts/basebrief.js", "--help"]).command, "help");
  assert.equal(run(["node", "scripts/basebrief.js", "-h"]).command, "help");
  assert.match(HELP_TEXT, /docs\/quickstart-5min\.md/);
  assert.match(formatHuman({
    command: "check",
    check: {
      status: "passed",
      errorCount: 0,
      warningCount: 1,
      findings: [{ severity: "WARNING", ruleId: "sample.warning", file: "sample.md", line: 1, message: "Review this." }],
    },
  }), /WARNING sample\.warning sample\.md:1 Review this\./);
  assert.throws(() => run(["node", "scripts/basebrief.js", "deploy"]), /Unknown command: deploy/);
  assert.throws(() => commandInit({}), /Missing --output-dir/);
  assert.throws(() => commandBuild({ "output-dir": "out" }), /Missing --input/);
  assert.throws(() => commandBuild({ input: "examples/structured-handoff-full.md" }), /Missing --output-dir/);
  assert.throws(
    () => commandBuild({ input: "examples/structured-handoff-full.md", "output-dir": "out", adapters: "cursor" }),
    /--target must be codex, claude, or all/,
  );
  assert.throws(() => commandCheck({}), /Missing --input/);
});

test("CLI Lite build --check exits nonzero when generated artifacts contain errors", () => withTempDir((tempDir) => {
  const outputDir = path.join(tempDir, "dirty-out");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "codex-task.md"), [
    "# BaseBrief Codex Task",
    "",
    "## Open Questions",
    "- none",
    "",
  ].join("\n"), "utf8");

  let error;
  try {
    execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "build",
      "--input",
      "examples/structured-handoff-full.md",
      "--output-dir",
      outputDir,
      "--check",
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });
  } catch (caught) {
    error = caught;
  }
  assert(error, "CLI build --check should fail when checker reports errors");
  assert.notEqual(error.status, 0);
  const result = JSON.parse(error.stdout);
  assert.equal(result.check.status, "failed");
  assert(result.check.findings.some((finding) => finding.ruleId === `artifact.missing-${"risk"}-boundaries`));
}));

test("Receiver Safe Check contracts are independent and preserve porcelain leading spaces", () => {
  const configSchema = readJson("schemas/basebrief-receiver-check.schema.json");
  const resultSchema = readJson("schemas/basebrief-receiver-check-result.schema.json");
  const publicConfig = readJson("examples/receiver-check-config.json");
  const bb9Schema = readJson("schemas/bb9-handoff.schema.json");

  assert.equal(configSchema.properties.schemaVersion.const, RECEIVER_CHECK_SCHEMA_VERSION);
  assert.equal(resultSchema.properties.schemaVersion.const, RECEIVER_CHECK_RESULT_SCHEMA_VERSION);
  assert.doesNotThrow(() => validateReceiverCheckConfig(publicConfig));
  assert.throws(
    () => validateReceiverCheckConfig({ ...publicConfig, expected_changed_files: ["z.md", "a.md"] }),
    /stable sorted order/,
  );
  assert.throws(
    () => validateReceiverCheckConfig({ ...publicConfig, expected_changed_files: ["a.md", "a.md"] }),
    /unique values/,
  );
  ["receiver_task_status", "repository_state_status", "declared_checks_status", "handoff_acceptance"].forEach((field) => {
    assert(resultSchema.required.includes(field));
  });
  assert.equal("receiver_check_config" in bb9Schema.properties, false);
  assert.equal("declared_checks" in bb9Schema.properties, false);
  assert.deepEqual(
    parsePorcelainZ(Buffer.from(" M docs/first.md\0?? second.md\0", "utf8")),
    ["docs/first.md", "second.md"],
  );
});

test("Receiver init generates state-only config without changing a clean target repository", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  const outputPath = path.join(tempDir, "receiver-init.json");
  const before = git(repoDir, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const result = runReceiverInit({ repoPath: repoDir, outputPath });
  const after = git(repoDir, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const config = JSON.parse(fs.readFileSync(outputPath, "utf8"));

  assert.equal(result.command, "receiver-init");
  assert.equal(result.output_inside_repo, false);
  assert.equal(result.output_repo_relative, "not_applicable");
  assert.equal(result.output_git_visible, false);
  assert.equal(config.schemaVersion, RECEIVER_CHECK_SCHEMA_VERSION);
  assert.deepEqual(config.expected_changed_files, []);
  assert.deepEqual(config.declared_checks, []);
  assert.equal(config.expected_branch, git(repoDir, ["branch", "--show-current"]));
  assert.equal(config.expected_head, git(repoDir, ["rev-parse", "HEAD"]));
  assert.equal(before, after);
  assert(!JSON.stringify(config).includes(repoDir));
}));

test("Receiver init captures dirty state and closes the in-repository init-check workflow", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  fs.writeFileSync(path.join(repoDir, "docs", "safe.md"), "# changed\n", "utf8");
  fs.writeFileSync(path.join(repoDir, "new.txt"), "new\n", "utf8");
  fs.mkdirSync(path.join(repoDir, "receiver"));
  const outputPath = path.join(repoDir, "receiver", "check.json");
  const result = runReceiverInit({ repoPath: repoDir, outputPath });
  const config = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  const checkResult = runReceiverCheck({ configPath: outputPath, repoPath: repoDir });

  assert.equal(result.output_inside_repo, true);
  assert.equal(result.output_repo_relative, "receiver/check.json");
  assert.equal(result.output_git_visible, true);
  assert.deepEqual(config.expected_changed_files, ["docs/safe.md", "new.txt", "receiver/check.json"]);
  assert.deepEqual(config.declared_checks, []);
  assert.equal(checkResult.repository_state_status, "match");
  assert.equal(checkResult.declared_checks_status, "skipped");
  assert.equal(checkResult.handoff_acceptance, "pass");
  assert.equal(git(repoDir, ["diff", "--name-only"]), "docs/safe.md");
}));

test("Receiver init keeps ignored in-repository output out of expected changed files", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  fs.writeFileSync(path.join(repoDir, ".gitignore"), "private/\n", "utf8");
  git(repoDir, ["add", ".gitignore"]);
  git(repoDir, ["commit", "-m", "ignore private"]);
  const outputPath = path.join(repoDir, "private", "receiver.json");
  const result = runReceiverInit({ repoPath: repoDir, outputPath });
  const config = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  const checkResult = runReceiverCheck({ configPath: outputPath, repoPath: repoDir });

  assert.equal(result.output_inside_repo, true);
  assert.equal(result.output_git_visible, false);
  assert.deepEqual(config.expected_changed_files, []);
  assert.equal(checkResult.handoff_acceptance, "pass");
}));

test("Receiver init rejects overwrite, sensitive output, tracked-file writes, and non-root repos", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  const existingPath = path.join(tempDir, "existing.json");
  fs.writeFileSync(existingPath, "{}\n", "utf8");
  assert.throws(() => runReceiverInit({ repoPath: repoDir, outputPath: existingPath }), /already exists/);
  assert.throws(() => runReceiverInit({ repoPath: repoDir, outputPath: path.join(tempDir, ".env.receiver.json") }), /must not be written inside an \.env path/);
  assert.throws(() => runReceiverInit({ repoPath: repoDir, outputPath: path.join(tempDir, ".env.local", "receiver.json") }), /must not be written inside an \.env path/);
  assert.throws(() => runReceiverInit({ repoPath: repoDir, outputPath: path.join(tempDir, "receiver.txt") }), /must use a \.json extension/);
  assert.throws(() => runReceiverInit({ repoPath: repoDir, outputPath: path.join(repoDir, ".git", "receiver.json") }), /must not be written inside \.git/);
  fs.rmSync(path.join(repoDir, "receiver.json"));
  assert.throws(() => runReceiverInit({ repoPath: repoDir, outputPath: path.join(repoDir, "receiver.json") }), /must not write a tracked/);
  assert.throws(() => runReceiverInit({ repoPath: path.join(repoDir, "docs"), outputPath: path.join(tempDir, "nested.json") }), /must point to the target repository root/);
  const nestedOutput = path.join(tempDir, "missing", "nested", "receiver.json");
  assert.equal(runReceiverInit({ repoPath: repoDir, outputPath: nestedOutput }).command, "receiver-init");
  assert(fs.existsSync(nestedOutput));
}));

test("Receiver init config builder preserves stable state-only contract", () => {
  const config = buildReceiverCheckConfig({
    branch: "main",
    head: "0123456789abcdef",
    changedFiles: ["a.md", "z.md"],
  }, "receiver/check.json");
  assert.deepEqual(config.expected_changed_files, ["a.md", "receiver/check.json", "z.md"]);
  assert.deepEqual(config.declared_checks, []);
  assert.doesNotThrow(() => validateReceiverCheckConfig(config));
});

test("Receiver init and check use a stable detached HEAD branch sentinel", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  git(repoDir, ["checkout", "--detach"]);
  const outputPath = path.join(tempDir, "detached.json");
  const result = runReceiverInit({ repoPath: repoDir, outputPath });
  const checkResult = runReceiverCheck({ configPath: outputPath, repoPath: repoDir });

  assert.equal(result.config.expected_branch, "(detached)");
  assert.equal(checkResult.repository.branch, "(detached)");
  assert.equal(checkResult.handoff_acceptance, "pass");
}));

test("Receiver Safe Check returns pass for matching state and declared checks without writes", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  const configPath = writeReceiverCheckConfig(tempDir, receiverCheckConfig(repoDir, {
    declared_checks: [
      { id: "artifact", kind: "artifact_check", path: "docs/safe.md" },
      { id: "syntax", kind: "node_syntax", path: "scripts/valid.js" },
      { id: "tokens", kind: "file_tokens", path: "tokens.txt", tokens: ["alpha", "beta"] },
    ],
  }));
  const before = git(repoDir, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const result = runReceiverCheck({ configPath, repoPath: repoDir });
  const after = git(repoDir, ["status", "--porcelain=v1", "--untracked-files=all"]);

  assert.equal(result.schemaVersion, RECEIVER_CHECK_RESULT_SCHEMA_VERSION);
  assert.equal(result.receiver_task_status, "completed");
  assert.equal(result.repository_state_status, "match");
  assert.equal(result.declared_checks_status, "passed");
  assert.equal(result.handoff_acceptance, "pass");
  assert(result.declared_checks.every((check) => check.status === "passed"));
  assert.equal(after, before);
}));

test("Receiver Safe Check reports repository and declared-check differences without blocking", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  fs.writeFileSync(path.join(repoDir, "docs", "unexpected.md"), "# unexpected\n\ncross-provider proof\n", "utf8");
  const stateConfigPath = writeReceiverCheckConfig(tempDir, receiverCheckConfig(repoDir, {
    expected_branch: "unexpected-branch",
    expected_head: "0000000",
    expected_changed_files: ["docs/missing.md"],
  }), "state-difference.json");
  const stateResult = runReceiverCheck({ configPath: stateConfigPath, repoPath: repoDir });

  assert.equal(stateResult.receiver_task_status, "completed");
  assert.equal(stateResult.repository_state_status, "difference_found");
  assert.equal(stateResult.declared_checks_status, "skipped");
  assert.equal(stateResult.handoff_acceptance, "difference_found");
  assert.deepEqual(stateResult.changed_files.missing, ["docs/missing.md"]);
  assert.deepEqual(stateResult.changed_files.unexpected, ["docs/unexpected.md"]);

  const checksConfigPath = writeReceiverCheckConfig(tempDir, receiverCheckConfig(repoDir, {
    expected_changed_files: ["docs/unexpected.md"],
    declared_checks: [
      { id: "artifact", kind: "artifact_check", path: "docs/unexpected.md" },
      { id: "syntax", kind: "node_syntax", path: "scripts/invalid.js" },
      { id: "tokens", kind: "file_tokens", path: "tokens.txt", tokens: ["alpha", "missing"] },
    ],
  }), "check-difference.json");
  const checksResult = runReceiverCheck({ configPath: checksConfigPath, repoPath: repoDir });

  assert.equal(checksResult.receiver_task_status, "completed");
  assert.equal(checksResult.repository_state_status, "match");
  assert.equal(checksResult.declared_checks_status, "difference_found");
  assert.equal(checksResult.handoff_acceptance, "difference_found");
  assert(checksResult.declared_checks.every((check) => check.status === "difference_found"));
  assert.match(checksResult.declared_checks.find((check) => check.kind === "file_tokens").detail, /missing_token_count=1/);
  assert(!JSON.stringify(checksResult).includes("missing\n"));
}));

test("Receiver Safe Check blocks invalid, sensitive, and escaping paths", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  const outsideDir = path.join(tempDir, "outside");
  fs.mkdirSync(outsideDir);
  fs.writeFileSync(path.join(outsideDir, "outside.md"), "# outside\n", "utf8");
  fs.symlinkSync(outsideDir, path.join(repoDir, "outside-link"), "junction");

  const cases = [
    {
      name: "unexpected-key",
      config: { ...receiverCheckConfig(repoDir), raw_command: "git status" },
      pattern: /Unexpected key/,
    },
    {
      name: "traversal",
      config: receiverCheckConfig(repoDir, {
        declared_checks: [{ id: "escape", kind: "file_tokens", path: "../outside/outside.md", tokens: ["outside"] }],
      }),
      pattern: /must not escape/,
    },
    {
      name: "env",
      config: receiverCheckConfig(repoDir, {
        declared_checks: [{ id: "env", kind: "file_tokens", path: ".env.local", tokens: ["value"] }],
      }),
      pattern: /must not access \.env/,
    },
    {
      name: "git",
      config: receiverCheckConfig(repoDir, {
        declared_checks: [{ id: "git", kind: "file_tokens", path: ".GIT/config", tokens: ["core"] }],
      }),
      pattern: /must not access \.git/,
    },
    {
      name: "symlink",
      config: receiverCheckConfig(repoDir, {
        expected_changed_files: ["outside-link"],
        declared_checks: [{ id: "symlink", kind: "artifact_check", path: "outside-link/outside.md" }],
      }),
      pattern: /resolves outside/,
    },
    {
      name: "artifact-directory",
      config: receiverCheckConfig(repoDir, {
        expected_changed_files: ["outside-link"],
        declared_checks: [{ id: "directory", kind: "artifact_check", path: "docs" }],
      }),
      pattern: /artifact_check path must be a file/,
    },
    {
      name: "node-extension",
      config: receiverCheckConfig(repoDir, {
        expected_changed_files: ["outside-link"],
        declared_checks: [{ id: "extension", kind: "node_syntax", path: "tokens.txt" }],
      }),
      pattern: /node_syntax path must use/,
    },
  ];

  for (const testCase of cases) {
    const configPath = writeReceiverCheckConfig(tempDir, testCase.config, `${testCase.name}.json`);
    const result = runReceiverCheck({ configPath, repoPath: repoDir });
    assert.equal(result.receiver_task_status, "blocked", testCase.name);
    assert.equal(result.handoff_acceptance, "blocked", testCase.name);
    assert.match(result.blocked_reason, testCase.pattern, testCase.name);
  }

  const missingRepoResult = runReceiverCheck({
    configPath: writeReceiverCheckConfig(tempDir, receiverCheckConfig(repoDir), "missing-repo.json"),
    repoPath: path.join(tempDir, "missing"),
  });
  assert.equal(missingRepoResult.handoff_acceptance, "blocked");

  const envConfigPath = writeReceiverCheckConfig(tempDir, receiverCheckConfig(repoDir), ".env.receiver-check.json");
  const envConfigResult = runReceiverCheck({ configPath: envConfigPath, repoPath: repoDir });
  assert.equal(envConfigResult.handoff_acceptance, "blocked");
  assert.match(envConfigResult.blocked_reason, /must not be read from \.env/);

  const gitConfigPath = writeReceiverCheckConfig(path.join(repoDir, ".git"), receiverCheckConfig(repoDir), "receiver-check.json");
  const gitConfigResult = runReceiverCheck({ configPath: gitConfigPath, repoPath: repoDir });
  assert.equal(gitConfigResult.handoff_acceptance, "blocked");
  assert.match(gitConfigResult.blocked_reason, /must not be read from \.git/);
}));

test("CLI Lite exposes Receiver Safe Check and keeps difference exit zero", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  const passConfigPath = writeReceiverCheckConfig(tempDir, receiverCheckConfig(repoDir), "pass.json");
  const differenceConfigPath = writeReceiverCheckConfig(tempDir, receiverCheckConfig(repoDir, {
    expected_head: "0000000",
  }), "difference.json");
  const blockedConfigPath = writeReceiverCheckConfig(tempDir, {
    ...receiverCheckConfig(repoDir),
    unexpected: true,
  }, "blocked.json");

  assert.match(HELP_TEXT, /receiver-check --config <json> --repo <target-repo>/);
  const direct = commandReceiverCheck({ config: passConfigPath, repo: repoDir });
  assert.equal(direct.result.handoff_acceptance, "pass");
  assert.equal(run(["node", "scripts/basebrief.js", "receiver-check", "--config", passConfigPath, "--repo", repoDir]).result.handoff_acceptance, "pass");

  const difference = spawnSync(process.execPath, [
    "scripts/basebrief.js",
    "receiver-check",
    "--config",
    differenceConfigPath,
    "--repo",
    repoDir,
    "--json",
  ], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(difference.status, 0);
  assert.equal(JSON.parse(difference.stdout).result.handoff_acceptance, "difference_found");

  const standaloneDifference = spawnSync(process.execPath, [
    "scripts/basebrief_receiver_check.js",
    "--config",
    differenceConfigPath,
    "--repo",
    repoDir,
    "--json",
  ], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(standaloneDifference.status, 0);
  assert.equal(JSON.parse(standaloneDifference.stdout).handoff_acceptance, "difference_found");

  const blocked = spawnSync(process.execPath, [
    "scripts/basebrief.js",
    "receiver-check",
    "--config",
    blockedConfigPath,
    "--repo",
    repoDir,
    "--json",
  ], { cwd: repoRoot, encoding: "utf8" });
  assert.notEqual(blocked.status, 0);
  assert.equal(JSON.parse(blocked.stdout).result.handoff_acceptance, "blocked");
}));

test("CLI Lite and standalone script expose Receiver init", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  const cliOutput = path.join(tempDir, "cli-receiver.json");
  const standaloneOutput = path.join(tempDir, "standalone-receiver.json");

  assert.match(HELP_TEXT, /receiver-init --repo <target-repo> --output <receiver-check\.json>/);
  const direct = commandReceiverInit({ repo: repoDir, output: cliOutput });
  assert.equal(direct.command, "receiver-init");
  assert(fs.existsSync(cliOutput));

  const standalone = spawnSync(process.execPath, [
    "scripts/basebrief_receiver_init.js",
    "--repo",
    repoDir,
    "--output",
    standaloneOutput,
    "--json",
  ], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(standalone.status, 0);
  assert.equal(JSON.parse(standalone.stdout).command, "receiver-init");
  assert(fs.existsSync(standaloneOutput));

  const blocked = spawnSync(process.execPath, [
    "scripts/basebrief.js",
    "receiver-init",
    "--repo",
    repoDir,
    "--output",
    standaloneOutput,
    "--json",
  ], { cwd: repoRoot, encoding: "utf8" });
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /already exists/);
}));

test("Receiver flow draft writes review-only artifacts for a clean repository", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  const outputDir = path.join(tempDir, "receiver-flow");
  const before = git(repoDir, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const result = runReceiverFlow({ repoPath: repoDir, outputDir });
  const after = git(repoDir, ["status", "--porcelain=v1", "--untracked-files=all"]);

  assert.equal(result.command, "receiver-flow");
  assert.equal(result.schemaVersion, FLOW_SCHEMA_VERSION);
  assert.equal(result.handoff_status, "draft_needs_review");
  assert.equal(result.summary.handoff_status, "draft_needs_review");
  assert.deepEqual(result.receiver_check_config.expected_changed_files, []);
  assert(fs.existsSync(path.join(outputDir, "flow-summary.json")));
  assert(fs.existsSync(path.join(outputDir, "receiver-check.json")));
  assert(fs.existsSync(path.join(outputDir, "draft-context.md")));
  assert.equal(JSON.parse(fs.readFileSync(path.join(outputDir, "flow-summary.json"), "utf8")).schemaVersion, FLOW_SCHEMA_VERSION);
  assert.equal(JSON.parse(fs.readFileSync(path.join(outputDir, "receiver-check.json"), "utf8")).schemaVersion, RECEIVER_CHECK_SCHEMA_VERSION);
  const draft = fs.readFileSync(path.join(outputDir, "draft-context.md"), "utf8");
  assert.match(draft, /handoff_status: draft_needs_review/);
  assert.match(draft, /review before sharing/i);
  assert.match(draft, /expected_changed_files/);
  assert.match(draft, /receiver_check_config/);
  assert.doesNotMatch(draft, /Human-Provided Fields/);
  assert.doesNotMatch(draft, /handoff_status:\s*ready_for_receiver/);
  assert.equal(after, before);
}));

test("Receiver flow guided draft writes human fields and review checklist", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  const outputDir = path.join(tempDir, "guided-flow");
  const result = runReceiverFlow({
    repoPath: repoDir,
    outputDir,
    guided: true,
    guidedAnswers: {
      current_goal: "Prepare the next receiver handoff.",
      verified_facts: "Unit tests passed before handoff.",
      confirmed_decisions: "Keep draft status until review.",
      risk_boundaries: "Do not read env files.",
      receiver_entry_task: "Inspect the generated draft first.",
      open_questions: "",
    },
  });
  const draft = fs.readFileSync(path.join(outputDir, "draft-context.md"), "utf8");
  const summary = JSON.parse(fs.readFileSync(path.join(outputDir, "flow-summary.json"), "utf8"));

  assert.equal(result.handoff_status, "draft_needs_review");
  assert.equal(result.guided, true);
  assert.equal(summary.guided, true);
  assert.equal(summary.human_fields.open_questions, "[EMPTY]");
  assert.equal(result.review_checklist.length, 6);
  assert(result.review_checklist.find((item) => item.field === "open_questions").empty);
  assert.match(draft, /## Human-Provided Fields/);
  assert.match(draft, /### current_goal/);
  assert.match(draft, /Prepare the next receiver handoff/);
  assert.match(draft, /### open_questions/);
  assert.match(draft, /\[EMPTY\]/);
  assert.match(draft, /## Review Checklist/);
  assert.match(draft, /open_questions reviewed \[EMPTY\]/);
  assert.doesNotMatch(draft, /handoff_status:\s*ready_for_receiver/);
  assert.equal(checkArtifacts({ inputPath: outputDir }).status, "passed");
}));

test("Receiver flow draft captures dirty state and visible generated files", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  fs.writeFileSync(path.join(repoDir, "docs", "safe.md"), "# changed\n", "utf8");
  fs.writeFileSync(path.join(repoDir, "new.txt"), "new\n", "utf8");
  const outputDir = path.join(repoDir, "flow");
  const result = runReceiverFlow({ repoPath: repoDir, outputDir });

  assert.equal(result.output_inside_repo, true);
  assert.equal(result.output_repo_relative, "flow");
  assert.deepEqual(result.receiver_check_config.expected_changed_files, [
    "docs/safe.md",
    "flow/draft-context.md",
    "flow/flow-summary.json",
    "flow/receiver-check.json",
    "new.txt",
  ]);
  assert.deepEqual(result.output_git_visible_files, [
    "flow/flow-summary.json",
    "flow/receiver-check.json",
    "flow/draft-context.md",
  ].sort());
}));

test("Receiver flow draft rejects unsafe outputs, overwrite, tracked writes, and nested repos", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  const existingDir = path.join(tempDir, "existing-flow");
  fs.mkdirSync(existingDir);
  fs.writeFileSync(path.join(existingDir, "flow-summary.json"), "{}\n", "utf8");

  assert.throws(() => runReceiverFlow({ repoPath: repoDir, outputDir: existingDir }), /already exists/);
  assert.throws(() => runReceiverFlow({ repoPath: repoDir, outputDir: path.join(tempDir, ".env.flow") }), /must not be written inside an \.env path/);
  assert.throws(() => runReceiverFlow({ repoPath: repoDir, outputDir: path.join(repoDir, ".git", "flow") }), /must not be written inside \.git/);
  assert.throws(() => runReceiverFlow({ repoPath: path.join(repoDir, "docs"), outputDir: path.join(tempDir, "nested-flow") }), /must point to the target repository root/);

  fs.mkdirSync(path.join(repoDir, "tracked-flow"));
  fs.writeFileSync(path.join(repoDir, "tracked-flow", "flow-summary.json"), "{}\n", "utf8");
  git(repoDir, ["add", "tracked-flow/flow-summary.json"]);
  git(repoDir, ["commit", "-m", "track flow output"]);
  assert.throws(() => runReceiverFlow({ repoPath: repoDir, outputDir: path.join(repoDir, "tracked-flow") }), /already exists|tracked target-repository file/);
}));

test("Receiver flow draft handles Unicode and space paths and rejects no-git directories", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  const renamedRepo = path.join(tempDir, "中文 path repo");
  fs.renameSync(repoDir, renamedRepo);
  const outputDir = path.join(tempDir, "output with spaces", "flow");
  const result = runReceiverFlow({ repoPath: renamedRepo, outputDir });

  assert.equal(result.command, "receiver-flow");
  assert.equal(result.handoff_status, "draft_needs_review");
  assert(fs.existsSync(path.join(outputDir, "draft-context.md")));
  assert.equal(checkArtifacts({ inputPath: outputDir }).status, "passed");

  const noGitDir = path.join(tempDir, "plain folder");
  fs.mkdirSync(noGitDir, { recursive: true });
  assert.throws(
    () => runReceiverFlow({ repoPath: noGitDir, outputDir: path.join(tempDir, "no-git-output") }),
    /not a git repository|rev-parse failed|fatal/i,
  );
}));

test("Receiver flow guided CLI reads stdin, rejects EOF, and lets checker catch fake secrets", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  const cliOutputDir = path.join(tempDir, "guided-cli");
  const inputLines = [
    "Continue guided receiver-flow implementation.",
    "The repository is a local test fixture.",
    "Keep draft status.",
    "No env file access.",
    "Review draft-context.md first.",
    "No open questions recorded.",
  ].join("\n");
  const cli = spawnSync(process.execPath, [
    "scripts/basebrief.js",
    "receiver-flow",
    "--repo",
    repoDir,
    "--output-dir",
    cliOutputDir,
    "--guided",
    "--json",
  ], { cwd: repoRoot, encoding: "utf8", input: inputLines });
  assert.equal(cli.status, 0);
  const parsed = JSON.parse(cli.stdout);
  assert.equal(parsed.guided, true);
  assert.equal(parsed.handoff_status, "draft_needs_review");
  assert.equal(parsed.outputFiles.draftContext, "[outside-cwd]");

  const eof = spawnSync(process.execPath, [
    "scripts/basebrief.js",
    "receiver-flow",
    "--repo",
    repoDir,
    "--output-dir",
    path.join(tempDir, "guided-eof"),
    "--guided",
    "--json",
  ], { cwd: repoRoot, encoding: "utf8", input: "only one line\n" });
  assert.notEqual(eof.status, 0);
  assert.match(eof.stderr, /requires one input line for each guided field/);

  const secretOutputDir = path.join(tempDir, "guided-secret");
  runReceiverFlow({
    repoPath: repoDir,
    outputDir: secretOutputDir,
    guided: true,
    guidedAnswers: {
      current_goal: `${"sk-"}fakeguidedsecret123456`,
      verified_facts: "fixture fact",
      confirmed_decisions: "fixture decision",
      risk_boundaries: "fixture risk",
      receiver_entry_task: "fixture task",
      open_questions: "fixture question",
    },
  });
  const check = checkArtifacts({ inputPath: secretOutputDir });
  assert.equal(check.status, "failed");
  assert(check.findings.some((finding) => finding.ruleId === "secret.sk"));
}));

test("CLI Lite exposes Receiver flow draft with public-safe json paths", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  const directDir = path.join(tempDir, "direct-flow");
  const direct = commandReceiverFlow({ repo: repoDir, "output-dir": directDir });
  assert.equal(direct.command, "receiver-flow");
  assert.equal(direct.handoff_status, "draft_needs_review");

  const cliOutputDir = path.join(repoRoot, "tests", "outputs", "private", `receiver-flow-${Date.now()}`);
  try {
    assert.match(HELP_TEXT, /receiver-flow --repo <target-repo> --output-dir <dir>/);
    const cli = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "receiver-flow",
      "--repo",
      repoDir,
      "--output-dir",
      cliOutputDir,
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(cli.status, 0);
    const result = JSON.parse(cli.stdout);
    assert.equal(result.command, "receiver-flow");
    assert.equal(result.handoff_status, "draft_needs_review");
    assert.equal(result.outputDir.startsWith("tests"), true);
    assert.equal(result.outputFiles.flowSummary.includes("flow-summary.json"), true);
    assert.equal(result.outputFiles.receiverCheckConfig.includes("receiver-check.json"), true);
    assert.equal(result.outputFiles.draftContext.includes("draft-context.md"), true);
  } finally {
    fs.rmSync(cliOutputDir, { recursive: true, force: true });
  }
}));

test("Receiver flow extract writes candidate-only draft artifacts from an explicit source", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  const sourcePath = path.join(tempDir, "source-context.md");
  fs.writeFileSync(sourcePath, [
    "# Reviewed Source Context",
    "",
    "## current_goal",
    "",
    "Prepare the next receiver task.",
    "",
    "## verified_facts",
    "",
    "The source file is a local Markdown fixture.",
    "",
    "## confirmed_decisions",
    "",
    "Keep extracted content candidate-only.",
    "",
    "## risk_boundaries",
    "",
    "Do not read env files.",
    "",
    "## receiver_entry_task",
    "",
    "Review extracted candidates before sharing.",
    "",
    "## open_questions",
    "",
    "No open questions in this fixture.",
    "",
  ].join("\n"), "utf8");
  const outputDir = path.join(tempDir, "extract-flow");
  const result = runReceiverFlow({ repoPath: repoDir, outputDir, extract: true, sourcePath });
  const draft = fs.readFileSync(path.join(outputDir, "draft-context.md"), "utf8");
  const candidates = JSON.parse(fs.readFileSync(path.join(outputDir, "extract-candidates.json"), "utf8"));

  assert.equal(result.command, "receiver-flow");
  assert.equal(result.handoff_status, "draft_needs_review");
  assert.equal(result.extract, true);
  assert.equal(result.guided, false);
  assert.equal(result.candidate_fields.length, 6);
  assert(fs.existsSync(path.join(outputDir, "extract-candidates.json")));
  assert.equal(candidates.schemaVersion, "basebrief-receiver-flow-extract-v1");
  assert.equal(candidates.handoff_status, "draft_needs_review");
  assert.equal(candidates.source_file, "source-context.md");
  assert(candidates.candidate_fields.every((candidate) => candidate.value.startsWith("[CANDIDATE]")));
  assert.match(draft, /## Extracted Candidate Fields/);
  assert.match(draft, /source: receiver-flow --extract/);
  assert.match(draft, /\[CANDIDATE\] Prepare the next receiver task/);
  assert.match(draft, /- \[ \] current_goal reviewed \[CANDIDATE\]/);
  assert.throws(
    () => runReviewDraft({ draftPath: path.join(outputDir, "draft-context.md"), outputPath: path.join(tempDir, "ready.md") }),
    /blocked review markers/,
  );
  assert.equal(checkArtifacts({ inputPath: outputDir }).status, "passed");
}));

test("Receiver flow extract marks missing fields and rejects unsafe source inputs", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  const sourcePath = path.join(tempDir, "partial-source.md");
  fs.writeFileSync(sourcePath, [
    "# Partial Source Context",
    "",
    "## current_goal",
    "",
    "Only one field is present.",
    "",
  ].join("\n"), "utf8");
  const outputDir = path.join(tempDir, "partial-extract");
  const result = runReceiverFlow({ repoPath: repoDir, outputDir, extract: true, sourcePath });
  const candidates = JSON.parse(fs.readFileSync(path.join(outputDir, "extract-candidates.json"), "utf8"));
  assert.equal(candidates.candidate_fields.find((candidate) => candidate.field === "current_goal").status, "candidate");
  assert.equal(candidates.candidate_fields.find((candidate) => candidate.field === "verified_facts").value, "[NEEDS_REVIEW]");

  assert.throws(
    () => runReceiverFlow({ repoPath: repoDir, outputDir: path.join(tempDir, "missing-source"), extract: true }),
    /requires --source/,
  );
  assert.throws(
    () => runReceiverFlow({ repoPath: repoDir, outputDir: path.join(tempDir, "env-source"), extract: true, sourcePath: path.join(tempDir, ".env.context.md") }),
    /must not be read from an \.env path/,
  );
  assert.throws(
    () => runReceiverFlow({ repoPath: repoDir, outputDir: path.join(tempDir, "git-source"), extract: true, sourcePath: path.join(repoDir, ".git", "config.md") }),
    /must not be read from \.git/,
  );
  assert.throws(
    () => runReceiverFlow({ repoPath: repoDir, outputDir: path.join(tempDir, "combined"), guided: true, extract: true, sourcePath }),
    /must be run separately/,
  );
}));

test("CLI Lite exposes receiver-flow extract with public-safe json paths", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  const sourceDir = path.join(repoRoot, "tests", "outputs", "private", `extract-source-${Date.now()}`);
  const sourcePath = path.join(sourceDir, "source-context.md");
  const outputDir = path.join(repoRoot, "tests", "outputs", "private", `receiver-flow-extract-${Date.now()}`);
  try {
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(sourcePath, [
      "# Source Context",
      "",
      "## current_goal",
      "",
      "Extract candidate fields through CLI.",
      "",
      "## verified_facts",
      "",
      "The source path is inside ignored test output.",
      "",
      "## confirmed_decisions",
      "",
      "Keep candidates blocked until review.",
      "",
      "## risk_boundaries",
      "",
      "No provider request.",
      "",
      "## receiver_entry_task",
      "",
      "Inspect extract-candidates.json.",
      "",
      "## open_questions",
      "",
      "No open questions recorded.",
      "",
    ].join("\n"), "utf8");
    assert.match(HELP_TEXT, /receiver-flow --repo <target-repo> --output-dir <dir> --extract --source <draft-or-context\.md>/);
    const cli = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "receiver-flow",
      "--repo",
      repoDir,
      "--output-dir",
      outputDir,
      "--extract",
      "--source",
      sourcePath,
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(cli.status, 0, cli.stderr);
    const result = JSON.parse(cli.stdout);
    assert.equal(result.command, "receiver-flow");
    assert.equal(result.extract, true);
    assert.equal(result.handoff_status, "draft_needs_review");
    assert.equal(result.outputDir.startsWith("tests"), true);
    assert.equal(result.extract_source.startsWith("tests"), true);
    assert.equal(result.outputFiles.extractCandidates.includes("extract-candidates.json"), true);
  } finally {
    fs.rmSync(sourceDir, { recursive: true, force: true });
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
}));

test("Review draft gate promotes a fully reviewed guided draft to receiver-ready", () => withTempDir((tempDir) => {
  const { draftPath } = createGuidedDraft(tempDir);
  const outputPath = path.join(tempDir, "receiver-ready.md");
  const result = runReviewDraft({ draftPath, outputPath });
  const ready = fs.readFileSync(outputPath, "utf8");

  assert.equal(result.command, "review-draft");
  assert.equal(result.schemaVersion, REVIEW_DRAFT_SCHEMA_VERSION);
  assert.equal(result.handoff_status, "ready_for_receiver");
  assert.deepEqual(result.reviewed_fields, [
    "current_goal",
    "verified_facts",
    "confirmed_decisions",
    "risk_boundaries",
    "receiver_entry_task",
    "open_questions",
  ]);
  assert.match(ready, /handoff_status: ready_for_receiver/);
  assert.match(ready, /handoff_protocol_version: receiver-ready-v1/);
  assert.match(ready, /## Review Summary/);
  assert.match(ready, /## current_goal/);
  assert.match(ready, /## verified_facts/);
  assert.match(ready, /## confirmed_decisions/);
  assert.match(ready, /## risk_boundaries/);
  assert.match(ready, /## receiver_entry_task/);
  assert.match(ready, /## open_questions/);
  assert.equal(checkArtifacts({ inputPath: outputPath }).status, "passed");
}));

test("Review draft gate rejects blocked markers and unchecked checklist items", () => withTempDir((tempDir) => {
  for (const marker of ["[EMPTY]", "[NEEDS_REVIEW]", "[CANDIDATE: docs/example.md]"]) {
    const { draftPath } = createGuidedDraft(tempDir);
    fs.appendFileSync(draftPath, `${os.EOL}${marker}${os.EOL}`, "utf8");
    assert.throws(
      () => runReviewDraft({ draftPath, outputPath: path.join(tempDir, `blocked-${marker.replace(/[^a-z]/gi, "")}.md`) }),
      /blocked review markers/,
      marker,
    );
  }

  const { draftPath } = createGuidedDraft(tempDir, { reviewed: false });
  assert.throws(
    () => runReviewDraft({ draftPath, outputPath: path.join(tempDir, "unchecked.md") }),
    /checklist is not fully reviewed/,
  );
}));

test("Review draft gate rejects missing fields, wrong status, overwrite, and sensitive paths", () => withTempDir((tempDir) => {
  const { draftPath } = createGuidedDraft(tempDir);
  const missingFieldDraft = path.join(tempDir, "missing-field.md");
  fs.copyFileSync(draftPath, missingFieldDraft);
  fs.writeFileSync(
    missingFieldDraft,
    fs.readFileSync(missingFieldDraft, "utf8").replace(/### open_questions[\s\S]*?## Review Checklist/, "## Review Checklist"),
    "utf8",
  );
  assert.throws(
    () => runReviewDraft({ draftPath: missingFieldDraft, outputPath: path.join(tempDir, "missing-ready.md") }),
    /missing required human fields: open_questions/,
  );

  const wrongStatusDraft = path.join(tempDir, "wrong-status.md");
  fs.copyFileSync(draftPath, wrongStatusDraft);
  fs.writeFileSync(
    wrongStatusDraft,
    fs.readFileSync(wrongStatusDraft, "utf8").replace("handoff_status: draft_needs_review", "handoff_status: ready_for_receiver"),
    "utf8",
  );
  assert.throws(
    () => runReviewDraft({ draftPath: wrongStatusDraft, outputPath: path.join(tempDir, "wrong-ready.md") }),
    /must have handoff_status: draft_needs_review/,
  );

  const existingOutput = path.join(tempDir, "existing.md");
  fs.writeFileSync(existingOutput, "existing\n", "utf8");
  assert.throws(() => runReviewDraft({ draftPath, outputPath: existingOutput }), /already exists/);
  assert.throws(() => runReviewDraft({ draftPath, outputPath: path.join(tempDir, ".env.ready.md") }), /must not use an \.env path/);
  assert.throws(() => runReviewDraft({ draftPath, outputPath: path.join(tempDir, ".git", "ready.md") }), /must not use a \.git path/);
  assert.throws(() => runReviewDraft({ draftPath: path.join(tempDir, ".env.draft.md"), outputPath: path.join(tempDir, "ready.md") }), /must not use an \.env path/);
}));

test("CLI Lite exposes review-draft with public-safe json paths", () => withTempDir((tempDir) => {
  const { draftPath } = createGuidedDraft(tempDir);
  const directOutput = path.join(tempDir, "direct-ready.md");
  const direct = commandReviewDraft({ draft: draftPath, output: directOutput });
  assert.equal(direct.command, "review-draft");
  assert.equal(direct.handoff_status, "ready_for_receiver");

  const cliDraftDir = path.join(repoRoot, "tests", "outputs", "private", `review-draft-${Date.now()}`);
  const cliDraftPath = path.join(cliDraftDir, "draft-context.md");
  const cliOutputPath = path.join(repoRoot, "tests", "outputs", "private", `receiver-ready-${Date.now()}.md`);
  try {
    fs.mkdirSync(cliDraftDir, { recursive: true });
    fs.copyFileSync(draftPath, cliDraftPath);
    assert.match(HELP_TEXT, /review-draft --draft <draft-context\.md> --output <receiver-ready\.md>/);
    const cli = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "review-draft",
      "--draft",
      cliDraftPath,
      "--output",
      cliOutputPath,
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(cli.status, 0, cli.stderr);
    const result = JSON.parse(cli.stdout);
    assert.equal(result.command, "review-draft");
    assert.equal(result.handoff_status, "ready_for_receiver");
    assert.equal(result.source_draft.startsWith("tests"), true);
    assert.equal(result.output.startsWith("tests"), true);
    assert(fs.existsSync(cliOutputPath));
  } finally {
    fs.rmSync(cliDraftDir, { recursive: true, force: true });
    fs.rmSync(cliOutputPath, { force: true });
  }
}));

test("Project state init writes and reads local .basebrief state from receiver-ready", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  const { draftPath } = createGuidedDraft(tempDir);
  const readyPath = path.join(tempDir, "receiver-ready.md");
  runReviewDraft({ draftPath, outputPath: readyPath });

  const result = runStateInit({ repoPath: repoDir, sourcePath: readyPath });
  const statePath = path.join(repoDir, ".basebrief", "state.json");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const readResult = runStateRead({ repoPath: repoDir });

  assert.equal(result.command, "state-init");
  assert.equal(result.schemaVersion, PROJECT_STATE_SCHEMA_VERSION);
  assert.equal(result.output, statePath);
  assert.equal(state.schemaVersion, PROJECT_STATE_SCHEMA_VERSION);
  assert.equal(state.state_status, "local_project_state");
  assert.equal(state.source.file, "receiver-ready.md");
  assert.equal(state.source.handoff_status, "ready_for_receiver");
  assert.equal(state.repository.branch, git(repoDir, ["branch", "--show-current"]));
  assert.equal(state.repository.head, git(repoDir, ["rev-parse", "HEAD"]));
  assert.deepEqual(state.repository.changed_files, []);
  assert.match(state.handoff.current_goal, /Prepare a reviewed receiver handoff/);
  assert.match(state.handoff.receiver_entry_task, /Inspect the reviewed receiver handoff first/);
  assert.doesNotMatch(JSON.stringify(state), /[A-Z]:\\/);
  assert.equal(readResult.command, "state-read");
  assert.deepEqual(readResult.state, state);
  assert.equal(checkArtifacts({ inputPath: path.join(repoDir, ".basebrief") }).status, "passed");
}));

test("Project state init rejects unsafe or unreviewed sources and overwrite", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  const { draftPath } = createGuidedDraft(tempDir);
  const readyPath = path.join(tempDir, "receiver-ready.md");
  runReviewDraft({ draftPath, outputPath: readyPath });

  const draftOnly = path.join(tempDir, "draft-only.md");
  fs.copyFileSync(draftPath, draftOnly);
  assert.throws(() => runStateInit({ repoPath: repoDir, sourcePath: draftOnly }), /handoff_status: ready_for_receiver/);

  const missingFieldReady = path.join(tempDir, "missing-field-ready.md");
  fs.writeFileSync(
    missingFieldReady,
    fs.readFileSync(readyPath, "utf8").replace(/## open_questions[\s\S]*$/, ""),
    "utf8",
  );
  assert.throws(() => runStateInit({ repoPath: repoDir, sourcePath: missingFieldReady }), /missing required sections: open_questions/);

  assert.throws(() => runStateInit({ repoPath: repoDir, sourcePath: path.join(tempDir, ".env.ready.md") }), /must not use an \.env path/);
  assert.throws(() => runStateInit({ repoPath: repoDir, sourcePath: path.join(repoDir, ".git", "ready.md") }), /must not use a \.git path/);

  runStateInit({ repoPath: repoDir, sourcePath: readyPath });
  assert.throws(() => runStateInit({ repoPath: repoDir, sourcePath: readyPath }), /already exists/);
}));

test("Project state lifecycle status and validate are read-only and public-safe", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  const statePath = path.join(repoDir, ".basebrief", "state.json");

  const missingStatus = runStateStatus({ repoPath: repoDir });
  assert.equal(missingStatus.command, "state-status");
  assert.equal(missingStatus.exists, false);
  assert.equal(missingStatus.validation_status, "missing");
  assert.equal(missingStatus.input, statePath);

  const missingValidate = runStateValidate({ repoPath: repoDir });
  assert.equal(missingValidate.command, "state-validate");
  assert.equal(missingValidate.validation_status, "failed");
  assert.deepEqual(missingValidate.errors, ["project-state does not exist"]);

  const { draftPath } = createGuidedDraft(tempDir);
  const readyPath = path.join(tempDir, "receiver-ready.md");
  runReviewDraft({ draftPath, outputPath: readyPath });
  runStateInit({ repoPath: repoDir, sourcePath: readyPath });

  const validStatus = runStateStatus({ repoPath: repoDir });
  assert.equal(validStatus.exists, true);
  assert.equal(validStatus.validation_status, "passed");
  assert.equal(validStatus.source.handoff_status, "ready_for_receiver");

  const validValidate = runStateValidate({ repoPath: repoDir });
  assert.equal(validValidate.validation_status, "passed");
  assert.deepEqual(validValidate.errors, []);

  fs.writeFileSync(statePath, `${JSON.stringify({ schemaVersion: "wrong" }, null, 2)}\n`, "utf8");
  const invalidValidate = runStateValidate({ repoPath: repoDir });
  assert.equal(invalidValidate.validation_status, "failed");
  assert(invalidValidate.errors.includes("schemaVersion must be basebrief-project-state-v1"));
}));

test("Project state lifecycle advance archives previous state and updates ready source", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  const { draftPath } = createGuidedDraft(tempDir);
  const readyPath = path.join(tempDir, "receiver-ready.md");
  runReviewDraft({ draftPath, outputPath: readyPath });
  const initResult = runStateInit({ repoPath: repoDir, sourcePath: readyPath });

  const secondDraft = createGuidedDraft(tempDir, {
    guidedAnswers: {
      current_goal: "Advance to the next reviewed state.",
      verified_facts: "The previous local project state exists and validates.",
      confirmed_decisions: "The next state must still come from a reviewed receiver-ready source.",
      risk_boundaries: "Do not call providers or store credentials.",
      receiver_entry_task: "Read state-history before continuing lifecycle work.",
      open_questions: "No lifecycle command should bypass review.",
    },
  });
  const secondReadyPath = path.join(tempDir, "receiver-ready-next.md");
  runReviewDraft({ draftPath: secondDraft.draftPath, outputPath: secondReadyPath });

  const advanceResult = runStateAdvance({ repoPath: repoDir, sourcePath: secondReadyPath });
  const statePath = path.join(repoDir, ".basebrief", "state.json");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const historyState = JSON.parse(fs.readFileSync(advanceResult.history_output, "utf8"));

  assert.equal(advanceResult.command, "state-advance");
  assert.equal(advanceResult.schemaVersion, PROJECT_STATE_SCHEMA_VERSION);
  assert.equal(advanceResult.input, statePath);
  assert.equal(advanceResult.output, statePath);
  assert.match(advanceResult.history_output.replace(/\\/g, "/"), /\.basebrief\/history\/.+\.json$/);
  assert(fs.existsSync(advanceResult.history_output));
  assert.equal(historyState.handoff.current_goal, initResult.state.handoff.current_goal);
  assert.equal(state.schemaVersion, PROJECT_STATE_SCHEMA_VERSION);
  assert.equal(state.generated_at, initResult.state.generated_at);
  assert.match(state.handoff.current_goal, /Advance to the next reviewed state/);
  assert.match(state.handoff.receiver_entry_task, /Read state-history/);
  assert.doesNotMatch(JSON.stringify(state), /[A-Z]:\\/);

  const history = runStateHistory({ repoPath: repoDir });
  assert.equal(history.command, "state-history");
  assert.equal(history.history_status, "available");
  assert.equal(history.entries.length, 1);
  assert.equal(history.entries[0].validation_status, "passed");
  assert.equal(checkArtifacts({ inputPath: path.join(repoDir, ".basebrief") }).status, "passed");
}));

test("Project state lifecycle rejects unsafe or unreviewed advance", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  const { draftPath } = createGuidedDraft(tempDir);
  const readyPath = path.join(tempDir, "receiver-ready.md");
  runReviewDraft({ draftPath, outputPath: readyPath });

  assert.throws(() => runStateAdvance({ repoPath: repoDir, sourcePath: readyPath }), /run state-init before state-advance/);

  runStateInit({ repoPath: repoDir, sourcePath: readyPath });
  const draftOnly = path.join(tempDir, "draft-only.md");
  fs.copyFileSync(draftPath, draftOnly);
  assert.throws(() => runStateAdvance({ repoPath: repoDir, sourcePath: draftOnly }), /handoff_status: ready_for_receiver/);
  assert.throws(() => runStateAdvance({ repoPath: repoDir, sourcePath: path.join(tempDir, ".env.ready.md") }), /must not use an \.env path/);
  assert.throws(() => runStateAdvance({ repoPath: repoDir, sourcePath: path.join(repoDir, ".git", "ready.md") }), /must not use a \.git path/);

  fs.writeFileSync(path.join(repoDir, ".basebrief", "state.json"), `${JSON.stringify({ schemaVersion: "wrong" }, null, 2)}\n`, "utf8");
  assert.throws(() => runStateAdvance({ repoPath: repoDir, sourcePath: readyPath }), /validation failed before advance/);
}));

function createSidecarFixture(tempDir, target = "generic") {
  const repoDir = createReceiverCheckRepo(tempDir);
  const { draftPath } = createGuidedDraft(tempDir, {
    guidedAnswers: {
      risk_boundaries: [
        "Do not call providers.",
        "Do not write secrets or raw private output.",
      ].join("\n"),
    },
  });
  const readyPath = path.join(tempDir, `${target}-receiver-ready.md`);
  runReviewDraft({ draftPath, outputPath: readyPath });
  runStateInit({ repoPath: repoDir, sourcePath: readyPath });
  const outputDir = path.join(tempDir, `${target}-sidecar`);
  buildSidecarBundle({ repoPath: repoDir, target, outputDir });
  return { repoDir, outputDir };
}

test("Sidecar build writes generic bundle from valid project state", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  const { draftPath } = createGuidedDraft(tempDir, {
    guidedAnswers: {
      risk_boundaries: [
        "Do not call providers.",
        "Do not write secrets or raw private output.",
      ].join("\n"),
    },
  });
  const readyPath = path.join(tempDir, "receiver-ready.md");
  runReviewDraft({ draftPath, outputPath: readyPath });
  runStateInit({ repoPath: repoDir, sourcePath: readyPath });

  const outputDir = path.join(tempDir, "generic-sidecar");
  const result = buildSidecarBundle({ repoPath: repoDir, target: "generic", outputDir });
  const manifest = JSON.parse(fs.readFileSync(path.join(outputDir, "manifest.json"), "utf8"));
  const stateSummary = JSON.parse(fs.readFileSync(path.join(outputDir, "state-summary.json"), "utf8"));
  const prompt = fs.readFileSync(path.join(outputDir, "next-chat-prompt.md"), "utf8");

  assert.equal(result.command, "sidecar-build");
  assert.equal(result.schemaVersion, SIDECAR_SCHEMA_VERSION);
  assert.equal(result.projectStateSchemaVersion, PROJECT_STATE_SCHEMA_VERSION);
  assert.equal(result.target, "generic");
  assert.equal(manifest.schemaVersion, SIDECAR_SCHEMA_VERSION);
  assert.equal(manifest.projectStateSchemaVersion, PROJECT_STATE_SCHEMA_VERSION);
  assert.equal(manifest.output_files.handoff, "handoff.md");
  assert.equal(stateSummary.projectStateSchemaVersion, PROJECT_STATE_SCHEMA_VERSION);
  assert.match(stateSummary.current_goal, /Prepare a reviewed receiver handoff/);
  assert.match(prompt, /current_goal/);
  assert.match(prompt, /receiver_entry_task/);
  assert.match(prompt, /wait for user confirmation/i);
  assert.match(prompt, /No provider request/);
  assert.match(prompt, /No raw private output/);
  assert.match(prompt, /No runtime integration/);
  assert.match(prompt, /No schema change/);
  assert.match(prompt, /No auto-advance/);
  assert(stateSummary.risk_boundaries.length >= 2);
  assert.doesNotMatch(JSON.stringify(manifest), /[A-Z]:\\/);
  assert.doesNotMatch(JSON.stringify(stateSummary), /[A-Z]:\\/);
  assert.equal(checkArtifacts({ inputPath: outputDir }).status, "passed");
}));

test("Sidecar build writes OpenClaw-safe bundle without runtime integration", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  const { draftPath } = createGuidedDraft(tempDir, {
    guidedAnswers: {
      risk_boundaries: [
        "Do not call providers.",
        "Do not write secrets.",
      ].join("\n"),
    },
  });
  const readyPath = path.join(tempDir, "receiver-ready.md");
  runReviewDraft({ draftPath, outputPath: readyPath });
  runStateInit({ repoPath: repoDir, sourcePath: readyPath });

  const outputDir = path.join(tempDir, "openclaw-sidecar");
  const result = commandSidecarBuild({ repo: repoDir, target: "openclaw", "output-dir": outputDir });
  const prompt = fs.readFileSync(path.join(outputDir, "next-chat-prompt.md"), "utf8");
  const risks = fs.readFileSync(path.join(outputDir, "risk-boundaries.md"), "utf8");

  assert.equal(result.target, "openclaw");
  assert.match(prompt, /OpenClaw\/Hermes runtime/);
  assert.match(prompt, /profile\/config\/memory\/workspace/);
  assert.match(risks, /Do not connect OpenClaw or Hermes runtime/);
  assert.match(risks, /No provider request/);
  assert.equal(checkArtifacts({ inputPath: outputDir }).status, "passed");
}));

test("Sidecar build rejects missing state, invalid state, unsupported target, and non-empty output", () => withTempDir((tempDir) => {
  const repoDir = createReceiverCheckRepo(tempDir);
  assert.throws(() => buildSidecarBundle({ repoPath: repoDir }), /project-state does not exist/);
  assert.throws(() => buildSidecarBundle({ repoPath: repoDir, target: "runtime" }), /Unsupported sidecar target/);

  const { draftPath } = createGuidedDraft(tempDir);
  const readyPath = path.join(tempDir, "receiver-ready.md");
  runReviewDraft({ draftPath, outputPath: readyPath });
  runStateInit({ repoPath: repoDir, sourcePath: readyPath });

  const occupied = path.join(tempDir, "occupied-sidecar");
  fs.mkdirSync(occupied, { recursive: true });
  fs.writeFileSync(path.join(occupied, "existing.txt"), "already here\n", "utf8");
  assert.throws(() => buildSidecarBundle({ repoPath: repoDir, outputDir: occupied }), /already exists and is not empty/);

  fs.writeFileSync(path.join(repoDir, ".basebrief", "state.json"), `${JSON.stringify({ schemaVersion: "wrong" }, null, 2)}\n`, "utf8");
  assert.throws(() => buildSidecarBundle({ repoPath: repoDir, outputDir: path.join(tempDir, "invalid-sidecar") }), /project-state validation failed/);
}));

test("Sidecar check passes valid generic and openclaw bundles", () => withTempDir((tempDir) => {
  const generic = createSidecarFixture(path.join(tempDir, "generic"), "generic");
  const openclaw = createSidecarFixture(path.join(tempDir, "openclaw"), "openclaw");

  const genericCheck = checkSidecarBundle({ inputPath: generic.outputDir });
  const openclawCheck = commandSidecarCheck({ input: openclaw.outputDir });

  assert.equal(genericCheck.command, "sidecar-check");
  assert.equal(genericCheck.check_status, "passed");
  assert.equal(genericCheck.target, "generic");
  assert.equal(genericCheck.schemaVersion, SIDECAR_SCHEMA_VERSION);
  assert.equal(genericCheck.projectStateSchemaVersion, PROJECT_STATE_SCHEMA_VERSION);
  assert.equal(openclawCheck.check_status, "passed");
  assert.equal(openclawCheck.target, "openclaw");
  assert.equal(openclawCheck.artifact_check.status, "passed");
}));

test("Sidecar check rejects malformed or incomplete bundles", () => withTempDir((tempDir) => {
  const { outputDir } = createSidecarFixture(tempDir, "generic");

  fs.rmSync(path.join(outputDir, "handoff.md"));
  let result = checkSidecarBundle({ inputPath: outputDir });
  assert.equal(result.check_status, "failed");
  assert(result.errors.some((error) => error.includes("Missing required sidecar file: handoff.md")));

  fs.writeFileSync(path.join(outputDir, "handoff.md"), "# restored\n\n## Risk Boundaries\n- No provider request.\n\n## Open Questions\nNone.\n", "utf8");
  fs.writeFileSync(path.join(outputDir, "manifest.json"), "{\n", "utf8");
  result = checkSidecarBundle({ inputPath: outputDir });
  assert.equal(result.check_status, "failed");
  assert(result.errors.some((error) => error.includes("manifest.json must be parseable JSON")));

  const { outputDir: invalidTargetDir } = createSidecarFixture(path.join(tempDir, "invalid-target"), "generic");
  const manifest = JSON.parse(fs.readFileSync(path.join(invalidTargetDir, "manifest.json"), "utf8"));
  manifest.target = "runtime";
  fs.writeFileSync(path.join(invalidTargetDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  result = checkSidecarBundle({ inputPath: invalidTargetDir });
  assert.equal(result.check_status, "failed");
  assert(result.errors.some((error) => error.includes("manifest.json.target must be generic or openclaw")));
}));

test("Sidecar check rejects weak state summary and prompt contracts", () => withTempDir((tempDir) => {
  const { outputDir } = createSidecarFixture(tempDir, "generic");
  const summaryPath = path.join(outputDir, "state-summary.json");
  const promptPath = path.join(outputDir, "next-chat-prompt.md");

  const emptyGoal = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  emptyGoal.current_goal = "";
  fs.writeFileSync(summaryPath, `${JSON.stringify(emptyGoal, null, 2)}\n`, "utf8");
  let result = checkSidecarBundle({ inputPath: outputDir });
  assert.equal(result.check_status, "failed");
  assert(result.errors.some((error) => error.includes("current_goal")));

  emptyGoal.current_goal = "Prepare a reviewed receiver handoff for testing.";
  emptyGoal.risk_boundaries = ["Only one boundary."];
  fs.writeFileSync(summaryPath, `${JSON.stringify(emptyGoal, null, 2)}\n`, "utf8");
  result = checkSidecarBundle({ inputPath: outputDir });
  assert.equal(result.check_status, "failed");
  assert(result.errors.some((error) => error.includes("at least two")));

  const { outputDir: promptDir } = createSidecarFixture(path.join(tempDir, "prompt"), "generic");
  const prompt = fs.readFileSync(path.join(promptDir, "next-chat-prompt.md"), "utf8")
    .replace(/Wait for user confirmation/gi, "Continue after review")
    .replace(/No provider request/gi, "Provider requests are not covered")
    .replace(/No runtime integration/gi, "Runtime details are not covered");
  fs.writeFileSync(path.join(promptDir, "next-chat-prompt.md"), prompt, "utf8");
  result = checkSidecarBundle({ inputPath: promptDir });
  assert.equal(result.check_status, "failed");
  assert(result.errors.some((error) => error.includes("waiting for user confirmation")));
  assert(result.errors.some((error) => error.includes("No provider request")));
  assert(result.errors.some((error) => error.includes("No runtime integration")));
}));

test("Sidecar check enforces OpenClaw/Hermes wording for openclaw target", () => withTempDir((tempDir) => {
  const { outputDir } = createSidecarFixture(tempDir, "openclaw");
  const promptPath = path.join(outputDir, "next-chat-prompt.md");
  const riskPath = path.join(outputDir, "risk-boundaries.md");
  const handoffPath = path.join(outputDir, "handoff.md");

  for (const filePath of [promptPath, riskPath, handoffPath]) {
    const content = fs.readFileSync(filePath, "utf8")
      .replace(/OpenClaw\/Hermes runtime/g, "local runtime")
      .replace(/OpenClaw or Hermes runtime/g, "local runtime")
      .replace(/profile\/config\/memory\/workspace/g, "local files")
      .replace(/profile, config, memory, or workspace/g, "local files");
    fs.writeFileSync(filePath, content, "utf8");
  }

  const result = checkSidecarBundle({ inputPath: outputDir });
  assert.equal(result.check_status, "failed");
  assert(result.errors.some((error) => error.includes("OpenClaw/Hermes runtime")));
  assert(result.errors.some((error) => error.includes("profile/config/memory/workspace")));
}));

test("CLI Lite exposes project state commands with public-safe json paths", () => withTempDir((tempDir) => {
  const repoDir = path.join(repoRoot, "tests", "outputs", "private", `state-repo-${Date.now()}`);
  const sourceDir = path.join(repoRoot, "tests", "outputs", "private", `state-source-${Date.now()}`);
  const sidecarDir = path.join(repoRoot, "tests", "outputs", "private", `sidecar-${Date.now()}`);
  try {
    fs.mkdirSync(sourceDir, { recursive: true });
    const fixtureRepo = createReceiverCheckRepo(tempDir);
    fs.rmSync(repoDir, { recursive: true, force: true });
    fs.cpSync(fixtureRepo, repoDir, { recursive: true });
    const { draftPath } = createGuidedDraft(tempDir);
    const readyPath = path.join(sourceDir, "receiver-ready.md");
    runReviewDraft({ draftPath, outputPath: readyPath });

    const direct = commandStateInit({ repo: repoDir, source: readyPath });
    assert.equal(direct.command, "state-init");
    assert.equal(commandStateRead({ repo: repoDir }).state.schemaVersion, PROJECT_STATE_SCHEMA_VERSION);
    assert.equal(commandStateStatus({ repo: repoDir }).validation_status, "passed");
    assert.equal(commandStateValidate({ repo: repoDir }).validation_status, "passed");
    assert.equal(commandStateHistory({ repo: repoDir }).history_status, "not_initialized");

    fs.rmSync(path.join(repoDir, ".basebrief"), { recursive: true, force: true });
    assert.match(HELP_TEXT, /state-init --repo <target-repo> --source <receiver-ready\.md>/);
    assert.match(HELP_TEXT, /state-read --repo <target-repo>/);
    assert.match(HELP_TEXT, /state-status --repo <target-repo>/);
    assert.match(HELP_TEXT, /state-validate --repo <target-repo>/);
    assert.match(HELP_TEXT, /state-history --repo <target-repo>/);
    assert.match(HELP_TEXT, /state-advance --repo <target-repo> --source <receiver-ready\.md>/);
    const missingValidateCli = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "state-validate",
      "--repo",
      repoDir,
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(missingValidateCli.status, 1, missingValidateCli.stderr);
    const missingValidateResult = JSON.parse(missingValidateCli.stdout);
    assert.equal(missingValidateResult.validation_status, "failed");

    const initCli = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "state-init",
      "--repo",
      repoDir,
      "--source",
      readyPath,
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(initCli.status, 0, initCli.stderr);
    const initResult = JSON.parse(initCli.stdout);
    assert.equal(initResult.command, "state-init");
    assert.equal(initResult.schemaVersion, PROJECT_STATE_SCHEMA_VERSION);
    assert.equal(initResult.repo.startsWith("tests"), true);
    assert.equal(initResult.source.startsWith("tests"), true);
    assert.equal(initResult.output.replace(/\\/g, "/").endsWith(".basebrief/state.json"), true);

    const readCli = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "state-read",
      "--repo",
      repoDir,
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(readCli.status, 0, readCli.stderr);
    const readResult = JSON.parse(readCli.stdout);
    assert.equal(readResult.command, "state-read");
    assert.equal(readResult.schemaVersion, PROJECT_STATE_SCHEMA_VERSION);
    assert.equal(readResult.input.replace(/\\/g, "/").endsWith(".basebrief/state.json"), true);

    const statusCli = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "state-status",
      "--repo",
      repoDir,
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(statusCli.status, 0, statusCli.stderr);
    const statusResult = JSON.parse(statusCli.stdout);
    assert.equal(statusResult.command, "state-status");
    assert.equal(statusResult.validation_status, "passed");
    assert.equal(statusResult.input.replace(/\\/g, "/").endsWith(".basebrief/state.json"), true);

    const validateCli = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "state-validate",
      "--repo",
      repoDir,
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(validateCli.status, 0, validateCli.stderr);
    const validateResult = JSON.parse(validateCli.stdout);
    assert.equal(validateResult.command, "state-validate");
    assert.equal(validateResult.validation_status, "passed");

    const historyBeforeCli = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "state-history",
      "--repo",
      repoDir,
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(historyBeforeCli.status, 0, historyBeforeCli.stderr);
    const historyBeforeResult = JSON.parse(historyBeforeCli.stdout);
    assert.equal(historyBeforeResult.history_status, "not_initialized");

    const advanceCli = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "state-advance",
      "--repo",
      repoDir,
      "--source",
      readyPath,
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(advanceCli.status, 0, advanceCli.stderr);
    const advanceResult = JSON.parse(advanceCli.stdout);
    assert.equal(advanceResult.command, "state-advance");
    assert.equal(advanceResult.history_output.startsWith("tests"), true);
    assert.equal(advanceResult.history_output.replace(/\\/g, "/").includes(".basebrief/history/"), true);

    const historyAfterCli = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "state-history",
      "--repo",
      repoDir,
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(historyAfterCli.status, 0, historyAfterCli.stderr);
    const historyAfterResult = JSON.parse(historyAfterCli.stdout);
    assert.equal(historyAfterResult.command, "state-history");
    assert.equal(historyAfterResult.history_status, "available");
    assert.equal(historyAfterResult.entries.length, 1);

    const sidecarCli = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "sidecar-build",
      "--repo",
      repoDir,
      "--output-dir",
      sidecarDir,
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(sidecarCli.status, 0, sidecarCli.stderr);
    const sidecarResult = JSON.parse(sidecarCli.stdout);
    assert.equal(sidecarResult.command, "sidecar-build");
    assert.equal(sidecarResult.schemaVersion, SIDECAR_SCHEMA_VERSION);
    assert.equal(sidecarResult.projectStateSchemaVersion, PROJECT_STATE_SCHEMA_VERSION);
    assert.equal(sidecarResult.target, "generic");
    assert.equal(sidecarResult.repo.startsWith("tests"), true);
    assert.equal(sidecarResult.input.startsWith("tests"), true);
    assert.equal(sidecarResult.outputDir.startsWith("tests"), true);
    assert.equal(sidecarResult.outputFiles.handoff.startsWith("tests"), true);
    assert.match(HELP_TEXT, /sidecar-build --repo <target-repo>/);

    const sidecarCheckCli = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "sidecar-check",
      "--input",
      sidecarDir,
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(sidecarCheckCli.status, 0, sidecarCheckCli.stderr);
    const sidecarCheckResult = JSON.parse(sidecarCheckCli.stdout);
    assert.equal(sidecarCheckResult.command, "sidecar-check");
    assert.equal(sidecarCheckResult.check_status, "passed");
    assert.equal(sidecarCheckResult.target, "generic");
    assert.equal(sidecarCheckResult.input.startsWith("tests"), true);
    assert.equal(sidecarCheckResult.artifact_check.status, "passed");
    assert.match(HELP_TEXT, /sidecar-check --input <sidecar-dir>/);
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
    fs.rmSync(sourceDir, { recursive: true, force: true });
    fs.rmSync(sidecarDir, { recursive: true, force: true });
  }
}));

test("Seal/Diff v1 creates stable seal snapshots from BB9 input", () => {
  const input = readJson("examples/seal-before-input.json");
  const seal = createSealFromInput(input, { sealedAt: "2026-06-03T00:00:00.000Z", label: "before" });

  assert.equal(seal.schemaVersion, SEAL_SCHEMA_VERSION);
  assert.equal(seal.sourceSchema, "schemas/bb9-handoff.schema.json");
  assert.equal(seal.label, "before");
  assert.equal(seal.handoff.project_identity, input.project_identity);
  assert.match(seal.checksums.overall, /^[a-f0-9]{64}$/);
  assert.match(seal.checksums.sections.verified_facts, /^[a-f0-9]{64}$/);
  assert(!JSON.stringify(seal).includes("BASEBRIEF_CACHE_BLOCK_PAD"));
});

test("Seal/Diff v1 compares facts, decisions, risks, questions, and task boundaries", () => {
  const before = createSealFromInput(readJson("examples/seal-before-input.json"), { sealedAt: "2026-06-03T00:00:00.000Z" });
  const after = createSealFromInput(readJson("examples/seal-after-input.json"), { sealedAt: "2026-06-03T00:00:00.000Z" });
  const diff = diffSeals(before, after);

  assert.equal(diff.changed, true);
  assert(diff.changedFields.includes("verified_facts"));
  assert(diff.changedFields.includes("confirmed_decisions"));
  assert(diff.changedFields.includes("risk_boundaries"));
  assert(diff.changedFields.includes("open_questions"));
  assert(diff.changedFields.includes("tail_request"));
  assert.equal(diff.summary.taskBoundaryChanged, true);
  assert.equal(diff.fields.verified_facts.added.length, 1);
  assert.equal(diff.fields.open_questions.added.length, 1);
});

test("Seal/Diff v1 can read structured markdown and existing seal json", () => withTempDir((tempDir) => {
  const sealPath = path.join(tempDir, "seal.json");
  const result = commandSeal({
    input: path.join(repoRoot, "examples/structured-handoff-full.md"),
    output: sealPath,
  });
  const seal = readSealOrInput(sealPath);
  const markdownSeal = readSealOrInput(path.join(repoRoot, "examples/structured-handoff-full.md"));

  assert.equal(result.command, "seal");
  assert.equal(seal.schemaVersion, SEAL_SCHEMA_VERSION);
  assert.equal(markdownSeal.handoff.current_goal, seal.handoff.current_goal);
  assert.equal(markdownSeal.checksums.overall, seal.checksums.overall);
}));

test("CLI Lite exposes seal and diff commands", () => withTempDir((tempDir) => {
  const sealPath = path.join(tempDir, "seal-before.json");
  const sealResult = commandSeal({
    input: path.join(repoRoot, "examples/seal-before-input.json"),
    output: sealPath,
  });
  const diffResult = commandDiff({
    before: sealPath,
    after: path.join(repoRoot, "examples/seal-after-input.json"),
  });

  assert.equal(sealResult.command, "seal");
  assert(fs.existsSync(sealPath));
  assert.equal(diffResult.command, "diff");
  assert.equal(diffResult.diff.changed, true);
  assert(diffResult.diff.changedFields.includes("tail_request"));
}));

test("Seal/Diff v1 rejects missing command arguments", () => {
  assert.throws(() => commandSeal({ output: "seal.json" }), /Missing --input/);
  assert.throws(() => commandSeal({ input: "examples/seal-before-input.json" }), /Missing --output/);
  assert.throws(() => commandDiff({ after: "examples/seal-after-input.json" }), /Missing --before/);
  assert.throws(() => commandDiff({ before: "examples/seal-before-input.json" }), /Missing --after/);
  assert.throws(
    () => diffSeals({ schemaVersion: "wrong" }, createSealFromInput(readJson("examples/seal-after-input.json"))),
    /Before input is not a BaseBrief seal/,
  );
});

test("ContextOps docs stay a boundary document, not a platform promise", () => {
  const contextOps = readText("docs/contextops.md");
  const roadmap = readText("docs/roadmap/basebrief-long-term-baseline.md");

  assert.match(contextOps, /not a product surface/);
  assert.match(contextOps, /Current Non-Goals/);
  assert.match(contextOps, /hosted service/);
  assert.match(contextOps, /provider-general/);
  assert.match(roadmap, /ContextOps is documented as a boundary/);
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

test("hybrid prompts keep natural context stable and only change final choice", () => {
  const snapshot = {
    projectId: "projectA",
    readmeExcerpt: "Public sample README.",
    packages: [{ location: "package.json", name: "sample" }],
    entryFiles: ["src/main.js"],
    configFiles: ["vite.config.js"],
    fileSample: ["src/main.js", "vite.config.js"],
  };
  const scenario = SCENARIOS[0];
  const fullA = getPromptForVariant("hybrid", snapshot, scenario, 0, "bb6HybridFull");
  const fullB = getPromptForVariant("hybrid", snapshot, scenario, 1, "bb6HybridFull");
  const splitA = fullA.split("\n--\n");
  const splitB = fullB.split("\n--\n");

  assert.match(fullA, /^# BaseBrief BB6 Hybrid Anchor/);
  assert.match(fullA, /FORMAT: bb6-hybrid-full/);
  assert.match(fullA, /## Stable Tail Options\nA=/);
  assert.match(fullA, /<!-- BASEBRIEF_CACHE_PAD: p p p p -->\n--\nCHOICE=A$/);
  assert.equal(splitA[0], splitB[0]);
  assert.equal(splitB[1], "CHOICE=B");
});

test("blockpad prompts keep long stable pad before the final choice", () => {
  const snapshot = {
    projectId: "projectA",
    readmeExcerpt: "Public sample README.",
    packages: [{ location: "package.json", name: "sample" }],
    entryFiles: ["src/main.js"],
    configFiles: ["vite.config.js"],
    fileSample: ["src/main.js", "vite.config.js"],
  };
  const scenario = SCENARIOS[0];
  const promptA = getPromptForVariant("blockpad", snapshot, scenario, 0, "bb7BlockPadLite");
  const promptB = getPromptForVariant("blockpad", snapshot, scenario, 1, "bb7BlockPadLite");
  const [stableA, tailA] = promptA.split("\n--\n");
  const [stableB, tailB] = promptB.split("\n--\n");

  assert.match(promptA, /^# BaseBrief BB7 Block Pad Lite/);
  assert.match(promptA, /BASEBRIEF_CACHE_BLOCK_PAD/);
  assert(stableA.split(" p").length > 300, "blockpad prompt should include a long stable pad");
  assert.equal(stableA, stableB);
  assert.equal(tailA, "CHOICE=A");
  assert.equal(tailB, "CHOICE=B");
});

test("blockalign prompts keep scenario-aligned pad stable across choices", () => {
  const snapshot = {
    projectId: "projectA",
    readmeExcerpt: "Public sample README.",
    packages: [{ location: "package.json", name: "sample" }],
    entryFiles: ["src/main.js"],
    configFiles: ["vite.config.js"],
    fileSample: ["src/main.js", "vite.config.js"],
  };
  const scenario = SCENARIOS.find((item) => item.id === "risk-boundary");
  const promptA = getPromptForVariant("blockalign", snapshot, scenario, 0, "bb8AlignedBlockPadLite");
  const promptB = getPromptForVariant("blockalign", snapshot, scenario, 1, "bb8AlignedBlockPadLite");
  const [stableA, tailA] = promptA.split("\n--\n");
  const [stableB, tailB] = promptB.split("\n--\n");

  assert.match(promptA, /^# BaseBrief BB8 Aligned Block Pad Lite/);
  assert.match(promptA, /FORMAT: bb8-aligned-blockpad-lite/);
  assert(stableA.split(" p").length > 330, "blockalign prompt should include a scenario-aligned stable pad");
  assert.equal(stableA, stableB);
  assert.equal(tailA, "CHOICE=A");
  assert.equal(tailB, "CHOICE=B");
});

function bb9Fixture(overrides = {}) {
  return {
    mode: "full",
    provider_profile: "mimo",
    project_identity: "BaseBrief public sample project",
    current_goal: "Prepare a complete handoff.",
    verified_facts: [
      "One public skill entry exists.",
      "Full and Lite remain readable.",
      "Cache-ready evidence is provider-specific.",
    ],
    confirmed_decisions: [
      "Keep readable handoff first.",
      "Attach sidecar only for supported provider profiles.",
    ],
    assumptions: ["The next agent can inspect files."],
    open_questions: ["Whether sidecar should be merged later."],
    risk_boundaries: [
      "Do not expose secrets.",
      "Do not claim cross-provider savings.",
    ],
    forbidden_scope: [".env", "API keys", "private paths"],
    expected_output: "Readable handoff plus optional BB9 sidecar.",
    tail_request: "Write the next-chat opener.",
    ...overrides,
  };
}

test("BB9 handoff generator emits readable full brief plus supported cache sidecar", () => {
  const output = generateBb9HandoffFromObject(bb9Fixture(), { mode: "full", providerProfile: "mimo" });

  assert.match(output.readableBrief, /^# BaseBrief Full Handoff/);
  assert.match(output.readableBrief, /## verified_facts/);
  assert.match(output.readableBrief, /## assumptions/);
  assert.match(output.cacheSidecar, /^# BaseBrief BB9 Cache Sidecar/);
  assert.match(output.cacheSidecar, /SELECTED_VARIANT: bb7BlockPadLite/);
  assert.match(output.cacheSidecar, /BASEBRIEF_CACHE_BLOCK_PAD/);
  assert.equal(output.selectedVariant, "bb7BlockPadLite");
  assert.equal(output.recommendedPromptType, "cacheSidecar");
  assert.equal(output.activeProviderPrompt, output.cacheSidecar);
  assert.equal(output.promptUsePolicy.activeProviderPrompt, "cacheSidecar");
  assert.match(output.promptUsePolicy.cacheSidecar, /Do not concatenate/);
  assert.equal(output.providerProfile.profileId, "mimo");
  assert.equal(output.fallbackReason, null);
  assert(output.cacheSidecar.indexOf("TAIL_REQUEST=") > output.cacheSidecar.indexOf("BASEBRIEF_CACHE_BLOCK_PAD"));
});

test("BB9 handoff generator keeps lite readable brief separate from sidecar", () => {
  const output = generateBb9HandoffFromObject(bb9Fixture({ mode: "lite" }), { mode: "lite", providerProfile: "deepseek" });

  assert.match(output.readableBrief, /^# BaseBrief Lite Handoff/);
  assert.doesNotMatch(output.readableBrief, /## assumptions/);
  assert.match(output.readableBrief, /## open_questions/);
  assert.match(output.cacheSidecar, /MODE: lite/);
  assert.match(output.cacheSidecar, /TAIL_REQUEST=Write the next-chat opener/);
  assert.notEqual(output.readableBrief, output.cacheSidecar);
  assert.equal(output.providerProfile.pricingCnyPerMillionTokens.inputCacheHit, 0.02);
});

test("BB9 handoff generator is deterministic and independent of JSON key order", () => {
  const normal = bb9Fixture();
  const shuffled = {
    tail_request: normal.tail_request,
    expected_output: normal.expected_output,
    forbidden_scope: normal.forbidden_scope,
    risk_boundaries: normal.risk_boundaries,
    open_questions: normal.open_questions,
    assumptions: normal.assumptions,
    confirmed_decisions: normal.confirmed_decisions,
    verified_facts: normal.verified_facts,
    current_goal: normal.current_goal,
    project_identity: normal.project_identity,
    provider_profile: normal.provider_profile,
    mode: normal.mode,
  };

  assert.deepEqual(
    generateBb9HandoffFromObject(normal, { mode: "full", providerProfile: "mimo" }),
    generateBb9HandoffFromObject(shuffled, { mode: "full", providerProfile: "mimo" }),
  );
});

test("BB9 handoff generator rejects missing core fields", () => {
  const input = bb9Fixture();
  delete input.tail_request;

  assert.throws(
    () => generateBb9HandoffFromObject(input, { mode: "full", providerProfile: "mimo" }),
    /Missing required key: tail_request/,
  );
});

test("BB9 handoff generator falls back when cache cost is not observable", () => {
  const output = generateBb9HandoffFromObject(bb9Fixture(), {
    mode: "lite",
    providerProfile: "relay-openai-gpt55-codex-oauth",
  });

  assert.equal(output.cacheSidecar, null);
  assert.equal(output.selectedVariant, "natural");
  assert.equal(output.recommendedPromptType, "readableBrief");
  assert.equal(output.activeProviderPrompt, output.readableBrief);
  assert.equal(output.promptUsePolicy.activeProviderPrompt, "readableBrief");
  assert.equal(output.fallbackReason, "cache_cost_not_observable");
  assert.equal(output.providerProfile.cacheUsageObservable, false);
  assert.match(output.readableBrief, /^# BaseBrief Lite Handoff/);
});

test("BB9 provider profiles separate direct provider evidence from relay observation", () => {
  const mimo = getProviderProfile("mimo");
  const deepseek = getProviderProfile("deepseek-v4-flash");
  const relay = getProviderProfile("relay-openai-gpt55-codex-oauth");
  const unknown = getProviderProfile("unknown-provider");

  assert.equal(mimo.cacheUsageObservable, true);
  assert.equal(mimo.defaultPromptStrategy, "bb9_sidecar");
  assert.equal(mimo.activePromptStrategy, "cacheSidecar");
  assert(mimo.experimentalCandidates.some((candidate) => (
    candidate.candidateId === "bb12SizeBandGuard" &&
    candidate.status === "mimo_specific_selector_candidate" &&
    candidate.defaultEnabled === false
  )));
  assert.equal(deepseek.cacheUsageObservable, true);
  assert.equal(deepseek.defaultPromptStrategy, "bb9_sidecar");
  assert(deepseek.experimentalCandidates.every((candidate) => candidate.defaultEnabled === false));
  assert(deepseek.experimentalCandidates.some((candidate) => (
    candidate.candidateId === "bb12SizeBandGuard" &&
    candidate.status === "deepseek_smoke_inconclusive"
  )));
  assert.equal(relay.cacheUsageObservable, false);
  assert.equal(relay.recommendedVariant, "natural");
  assert.equal(relay.defaultPromptStrategy, "readable_fallback");
  assert.equal(relay.activePromptStrategy, "readableBrief");
  assert.equal(unknown.cacheUsageObservable, false);
  assert.equal(unknown.defaultPromptStrategy, "readable_fallback");
  assert.equal(unknown.activePromptStrategy, "readableBrief");
  assert.equal(unknown.fallbackReason, "provider_profile_not_supported");
});

test("BB10 active provider prompt preserves core handoff fields", () => {
  const output = generateBb9HandoffFromObject(bb9Fixture(), { mode: "full", providerProfile: "mimo" });

  for (const token of ["P=", "G=", "F=", "D=", "R=", "X=", "O=", "TAIL_REQUEST="]) {
    assert.match(output.activeProviderPrompt, new RegExp(token.replace("=", "=")));
  }
  assert.match(output.activeProviderPrompt, /BASEBRIEF_CACHE_BLOCK_PAD/);
});

test("BB9 handoff CLI can print individual prompt artifacts", () => {
  const inputPath = path.join(repoRoot, "examples/bb9-handoff-full-input.json");
  const readable = execFileSync(process.execPath, [
    "scripts/generate_bb9_handoff.js",
    "--input",
    inputPath,
    "--mode",
    "full",
    "--provider-profile",
    "mimo",
    "--print",
    "readableBrief",
  ], { cwd: repoRoot, encoding: "utf8" });
  const active = execFileSync(process.execPath, [
    "scripts/generate_bb9_handoff.js",
    "--input",
    inputPath,
    "--mode",
    "full",
    "--provider-profile",
    "mimo",
    "--print",
    "activeProviderPrompt",
  ], { cwd: repoRoot, encoding: "utf8" });

  assert.match(readable, /^# BaseBrief Full Handoff/);
  assert.doesNotMatch(readable, /BASEBRIEF_CACHE_BLOCK_PAD/);
  assert.match(active, /^# BaseBrief BB9 Cache Sidecar/);
  assert.match(active, /BASEBRIEF_CACHE_BLOCK_PAD/);
});

test("handoffPoc benchmark prompts compare readable brief with attached BB9 sidecar", () => {
  const snapshot = {
    projectId: "projectA",
    readmeExcerpt: "Public sample README.",
    packages: [{ location: "package.json", name: "sample" }],
    entryFiles: ["src/main.js"],
    configFiles: ["vite.config.js"],
    fileSample: ["src/main.js", "vite.config.js"],
  };
  const scenario = SCENARIOS[0];
  const readable = getPromptForVariant("handoffPoc", snapshot, scenario, 0, "readableFull", "mimo");
  const sidecar = getPromptForVariant("handoffPoc", snapshot, scenario, 0, "readableFullSidecar", "mimo");
  const fallbackSidecar = getPromptForVariant("handoffPoc", snapshot, scenario, 0, "readableLiteSidecar", "relay-openai-gpt55-codex-oauth");

  assert.match(readable, /^# BaseBrief Full Handoff/);
  assert.doesNotMatch(readable, /cache_sidecar/);
  assert.match(sidecar, /^# BaseBrief Full Handoff/);
  assert.match(sidecar, /## cache_sidecar/);
  assert.match(sidecar, /# BaseBrief BB9 Cache Sidecar/);
  assert(sidecar.indexOf("TAIL_REQUEST=") > sidecar.indexOf("BASEBRIEF_CACHE_BLOCK_PAD"));
  assert.match(fallbackSidecar, /BB9 sidecar unavailable for this provider profile/);
});

test("activePromptPoc benchmark prompts use one active prompt without concatenation", () => {
  const snapshot = {
    projectId: "projectA",
    readmeExcerpt: "Public sample README.",
    packages: [{ location: "package.json", name: "sample" }],
    entryFiles: ["src/main.js"],
    configFiles: ["vite.config.js"],
    fileSample: ["src/main.js", "vite.config.js"],
  };
  const scenario = SCENARIOS[0];
  const readable = getPromptForVariant("activePromptPoc", snapshot, scenario, 0, "readableFull", "mimo");
  const sidecarOnly = getPromptForVariant("activePromptPoc", snapshot, scenario, 0, "cacheSidecarFullOnly", "mimo");

  assert.match(readable, /^# BaseBrief Full Handoff/);
  assert.doesNotMatch(readable, /# BaseBrief BB9 Cache Sidecar/);
  assert.match(sidecarOnly, /^# BaseBrief BB9 Cache Sidecar/);
  assert.doesNotMatch(sidecarOnly, /^# BaseBrief Full Handoff/);
  assert.match(sidecarOnly, /TAIL_REQUEST=/);
  assert(sidecarOnly.indexOf("TAIL_REQUEST=") > sidecarOnly.indexOf("BASEBRIEF_CACHE_BLOCK_PAD"));
});

test("activePromptTrimPoc benchmark prompts emit compact BB11 lite sidecar and selector guard", () => {
  const snapshot = {
    projectId: "projectA",
    readmeExcerpt: "Public sample README.",
    packages: [{ location: "package.json", name: "sample" }],
    entryFiles: ["src/main.js"],
    configFiles: ["vite.config.js"],
    fileSample: ["src/main.js", "vite.config.js"],
  };
  const scenario = SCENARIOS[0];
  const readable = getPromptForVariant("activePromptTrimPoc", snapshot, scenario, 0, "readableLite", "mimo");
  const bb10 = getPromptForVariant("activePromptTrimPoc", snapshot, scenario, 0, "cacheSidecarLiteOnly", "mimo");
  const trim = getPromptForVariant("activePromptTrimPoc", snapshot, scenario, 0, "cacheSidecarLiteTrimOnly", "mimo");
  const bb9 = getPromptForVariant("activePromptTrimPoc", snapshot, scenario, 0, "bb9Best", "mimo");
  const guard = getPromptForVariant("activePromptTrimPoc", snapshot, scenario, 0, "bb11SelectorGuard", "mimo");

  assert.match(readable, /^# BaseBrief Lite Handoff/);
  assert.match(bb10, /^# BaseBrief BB9 Cache Sidecar/);
  assert.match(trim, /^BB11L\n/);
  for (const token of ["P=", "G=", "F=", "D=", "R=", "X=", "O=", "PAD=", "TAIL_REQUEST="]) {
    assert.match(trim, new RegExp(token.replace("=", "=")));
  }
  assert.doesNotMatch(trim, /^# BaseBrief Lite Handoff/);
  assert(trim.length < bb10.length, "BB11 trim sidecar should be shorter than BB10 lite sidecar");
  assert(guard === trim || guard === bb9, "Selector guard should choose either trimmed sidecar or BB9 best fallback");
});

test("bb12GuardPoc prompt uses size-band guard before falling back to BB9", () => {
  const smallSnapshot = {
    projectId: "projectA",
    readmeExcerpt: "Public sample README.",
    packages: [{ location: "package.json", name: "sample" }],
    entryFiles: ["src/main.js"],
    configFiles: ["vite.config.js"],
    fileSample: ["src/main.js", "vite.config.js"],
  };
  const largeSnapshot = {
    ...smallSnapshot,
    projectId: "projectC",
    readmeExcerpt: "Large public sample README. ".repeat(80),
    packages: [{ location: "package.json", name: "sample", dependencies: Array.from({ length: 30 }, (_, index) => `dep-${index}`) }],
    fileSample: Array.from({ length: 80 }, (_, index) => `src/very-long-directory-name/file-${index}.js`),
  };
  const scenario = SCENARIOS[0];
  const smallBb11Guard = getPromptForVariant("bb12GuardPoc", smallSnapshot, scenario, 0, "bb11SelectorGuard", "mimo");
  const smallBb12 = getPromptForVariant("bb12GuardPoc", smallSnapshot, scenario, 0, "bb12SizeBandGuard", "mimo");
  const largeBb9 = getPromptForVariant("bb12GuardPoc", largeSnapshot, scenario, 0, "bb9Best", "mimo");
  const largeBb12 = getPromptForVariant("bb12GuardPoc", largeSnapshot, scenario, 0, "bb12SizeBandGuard", "mimo");

  assert.equal(smallBb12, smallBb11Guard);
  assert.equal(largeBb12, largeBb9);
});

test("handoffPoc benchmark summary classifies sidecar wins against readable baselines", () => {
  const projectIds = ["projectA", "projectB", "projectC"];
  const calls = [];
  const variants = ["readableFull", "readableFullSidecar", "readableLite", "readableLiteSidecar", "bb9Best"];

  for (const projectId of projectIds) {
    for (const scenario of SCENARIOS) {
      for (const variant of variants) {
        for (let iteration = 0; iteration < 10; iteration += 1) {
          const sidecar = variant === "readableFullSidecar" || variant === "readableLiteSidecar";
          const estimatedTotalCostCny = sidecar ? 0.00008 : variant === "bb9Best" ? 0.00009 : 0.0002;
          calls.push({
            projectId,
            scenarioId: scenario.id,
            variant,
            phase: iteration === 0 ? "warmup" : "repeat",
            iteration,
            status: "success",
            promptTokens: sidecar ? 1500 : 1000,
            completionTokens: 32,
            cachedTokens: sidecar ? 1480 : 900,
            cacheRatio: sidecar ? 1480 / 1500 : 900 / 1000,
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
    providerProfileId: "mimo",
    mode: "handoffPoc",
    repeats: 10,
    projectIds,
    calls,
  });

  assert.equal(summary.requestCount, 900);
  assert.equal(summary.handoffStats.length, 2);
  assert.equal(summary.handoffStats.find((item) => item.family === "full").estimatedCostWinsVsReadable, 18);
  assert.equal(summary.handoffStats.find((item) => item.family === "lite").estimatedCostWinsVsReadable, 18);
  assert.equal(summary.conclusionLevel, "bb9_handoff_poc_cost_evidence");
});

test("activePromptPoc benchmark summary classifies sidecar-only merge candidates", () => {
  const projectIds = ["projectA", "projectB", "projectC"];
  const calls = [];
  const variants = ["readableFull", "readableLite", "cacheSidecarFullOnly", "cacheSidecarLiteOnly", "bb9Best"];

  for (const projectId of projectIds) {
    for (const scenario of SCENARIOS) {
      for (const variant of variants) {
        for (let iteration = 0; iteration < 10; iteration += 1) {
          const sidecar = variant === "cacheSidecarFullOnly" || variant === "cacheSidecarLiteOnly";
          const estimatedTotalCostCny = sidecar ? 0.00007 : variant === "bb9Best" ? 0.00008 : 0.0002;
          calls.push({
            projectId,
            scenarioId: scenario.id,
            variant,
            phase: iteration === 0 ? "warmup" : "repeat",
            iteration,
            status: "success",
            promptTokens: sidecar ? 1200 : 1000,
            completionTokens: 32,
            cachedTokens: sidecar ? 1180 : 900,
            cacheRatio: sidecar ? 1180 / 1200 : 900 / 1000,
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
    providerProfileId: "mimo",
    mode: "activePromptPoc",
    repeats: 10,
    projectIds,
    calls,
  });

  assert.equal(summary.requestCount, 900);
  assert.equal(summary.activePromptStats.length, 2);
  assert.equal(summary.activePromptStats.find((item) => item.family === "full").estimatedCostWinsVsReadable, 18);
  assert.equal(summary.activePromptStats.find((item) => item.family === "lite").estimatedCostNoWorseThanBb9Best, 18);
  assert.equal(summary.conclusionLevel, "bb10_active_prompt_merge_candidate");
});

test("activePromptTrimPoc benchmark summary classifies BB11 trim and selector guard", () => {
  const projectIds = ["projectA", "projectB", "projectC"];
  const calls = [];
  const variants = ["readableLite", "cacheSidecarLiteOnly", "cacheSidecarLiteTrimOnly", "bb9Best", "bb11SelectorGuard"];

  for (const projectId of projectIds) {
    for (const scenario of SCENARIOS) {
      for (const variant of variants) {
        for (let iteration = 0; iteration < 10; iteration += 1) {
          const estimatedTotalCostCny =
            variant === "cacheSidecarLiteTrimOnly" || variant === "bb11SelectorGuard"
              ? 0.00007
              : variant === "cacheSidecarLiteOnly"
              ? 0.00008
              : variant === "bb9Best"
              ? 0.000075
              : 0.0002;
          calls.push({
            projectId,
            scenarioId: scenario.id,
            variant,
            phase: iteration === 0 ? "warmup" : "repeat",
            iteration,
            status: "success",
            promptTokens: variant === "readableLite" ? 1000 : 1180,
            completionTokens: 32,
            cachedTokens: variant === "readableLite" ? 900 : 1152,
            cacheRatio: variant === "readableLite" ? 900 / 1000 : 1152 / 1180,
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
    providerProfileId: "mimo",
    mode: "activePromptTrimPoc",
    repeats: 10,
    projectIds,
    calls,
  });

  assert.equal(summary.requestCount, 900);
  assert.equal(summary.activePromptTrimStats.estimatedCostWinsVsReadable, 18);
  assert.equal(summary.activePromptTrimStats.estimatedCostWinsVsBb10, 18);
  assert.equal(summary.activePromptTrimStats.selectorGuardEstimatedCostNoWorseThanBb9Best, 18);
  assert.equal(summary.conclusionLevel, "bb11_active_prompt_trim_selector_guard_candidate");
});

test("bb12GuardPoc benchmark summary classifies size-band guard selector candidates", () => {
  const projectIds = ["projectA", "projectB", "projectC"];
  const calls = [];
  const variants = ["readableLite", "cacheSidecarLiteTrimOnly", "bb9Best", "bb11SelectorGuard", "bb12SizeBandGuard"];

  for (const projectId of projectIds) {
    for (const scenario of SCENARIOS) {
      for (const variant of variants) {
        for (let iteration = 0; iteration < 10; iteration += 1) {
          const estimatedTotalCostCny =
            variant === "bb12SizeBandGuard"
              ? 0.00007
              : variant === "bb9Best"
              ? 0.000075
              : variant === "bb11SelectorGuard"
              ? 0.00008
              : variant === "cacheSidecarLiteTrimOnly"
              ? 0.00009
              : 0.0002;
          calls.push({
            projectId,
            scenarioId: scenario.id,
            variant,
            phase: iteration === 0 ? "warmup" : "repeat",
            iteration,
            status: "success",
            promptTokens: variant === "readableLite" ? 1000 : 1250,
            completionTokens: 32,
            cachedTokens: variant === "readableLite" ? 900 : 1216,
            cacheRatio: variant === "readableLite" ? 900 / 1000 : 1216 / 1250,
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
    providerProfileId: "mimo",
    mode: "bb12GuardPoc",
    repeats: 10,
    projectIds,
    calls,
  });

  assert.equal(summary.requestCount, 900);
  assert.equal(summary.bb12GuardStats.estimatedCostWinsVsReadable, 18);
  assert.equal(summary.bb12GuardStats.estimatedCostNoWorseThanBb9Best, 18);
  assert.equal(summary.bb12GuardStats.estimatedCostNoWorseThanBb11Guard, 18);
  assert.equal(summary.conclusionLevel, "bb12_size_band_guard_selector_candidate");
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
    "handoff_status",
    "handoff_protocol_version",
    "generated_at",
    "preferred_language",
    "response_language",
    "receiver_entry_task",
    "post_acceptance_next_action",
    "expected_changed_files",
    "receiver_check_config",
    "receiver_task_status",
    "repository_state_status",
    "declared_checks_status",
    "handoff_acceptance",
  ];

  for (const templatePath of templatePaths) {
    const content = readText(templatePath);
    for (const token of requiredTokens) {
      assert.match(content, new RegExp(token), `${templatePath} missing ${token}`);
    }
  }
});

test("receiver-ready templates and examples separate entry verification from project next action", () => {
  const paths = [
    "templates/zh-CN/BASEBRIEF.md",
    "templates/zh-CN/BASEBRIEF_LITE.md",
    "templates/zh-CN/NEXT_CHAT_PROMPT.md",
    "examples/next-chat-example.md",
    "examples/minimal/next-chat-prompt.md",
  ];

  for (const relativePath of paths) {
    const content = readText(relativePath);
    assert.match(content, /ready_for_receiver/, `${relativePath} missing ready receiver status`);
    assert.match(content, /receiver_entry_task|Receiver entry task/, `${relativePath} missing receiver entry task`);
    assert.match(content, /post_acceptance_next_action|Post-acceptance next action/, `${relativePath} missing post-acceptance action`);
  }

  const nextChatTemplate = readText("templates/zh-CN/NEXT_CHAT_PROMPT.md");
  assert.match(nextChatTemplate, /当前工作目录/);
  assert.match(nextChatTemplate, /来源窗口已验证/);
  assert.match(nextChatTemplate, /接收窗口本轮已验证/);
  assert.match(nextChatTemplate, /实际发现的摩擦|实际接力摩擦/);
  assert.match(nextChatTemplate, /不得再次把“开启新窗口”作为下一步|不得再次建议开启新窗口/);
  assert.match(nextChatTemplate, /match_latest_user_message/);
  assert.match(nextChatTemplate, /第一句、进度说明和最终报告/);
  assert.match(nextChatTemplate, /忽略代码、路径、命令和字段名/);
  assert.match(nextChatTemplate, /expected_changed_files/);
  assert.match(nextChatTemplate, /receiver_check_config/);
  assert.match(nextChatTemplate, /receiver-check --config <receiver_check_config> --repo <target-repo> --json/);
  assert.match(nextChatTemplate, /不等同于重跑来源窗口完整测试/);
  assert.match(nextChatTemplate, /新增、缺失或意外文件/);
  assert.match(nextChatTemplate, /receiver_task_status/);
  assert.match(nextChatTemplate, /repository_state_status/);
  assert.match(nextChatTemplate, /declared_checks_status/);
  assert.match(nextChatTemplate, /handoff_acceptance/);
  assert.match(nextChatTemplate, /difference_found.*不等于 Agent 执行失败/s);
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

test("hybrid benchmark summary requires improvement over BB5 sidecar", () => {
  const projectIds = ["projectA", "projectB", "projectC"];
  const calls = [];
  const variants = ["natural", "bb4AnchorPad", "bb5SidecarFull", "bb5SidecarLite", "bb6HybridFull", "bb6HybridLite"];

  for (const projectId of projectIds) {
    for (const scenario of SCENARIOS) {
      for (const variant of variants) {
        for (let iteration = 0; iteration < 10; iteration += 1) {
          const estimatedTotalCostCny =
            variant === "bb6HybridFull" ? 0.00007 : variant === "bb5SidecarFull" ? 0.00009 : 0.0002;
          calls.push({
            projectId,
            scenarioId: scenario.id,
            variant,
            phase: iteration === 0 ? "warmup" : "repeat",
            iteration,
            status: "success",
            promptTokens: variant === "bb6HybridFull" ? 1300 : 1000,
            completionTokens: 32,
            cachedTokens: variant === "bb6HybridFull" ? 1260 : 900,
            cacheRatio: variant === "bb6HybridFull" ? 1260 / 1300 : 900 / 1000,
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
    mode: "hybrid",
    repeats: 10,
    projectIds,
    calls,
  });

  const full = summary.hybridStats.find((item) => item.family === "full");
  assert.equal(summary.requestCount, 1080);
  assert.equal(full.estimatedCostWinsVsNatural, 18);
  assert.equal(full.estimatedCostWinsVsBb5, 18);
  assert.equal(full.conclusionLevel, "bb6_hybrid_full_best_evidence");
  assert.equal(summary.conclusionLevel, "bb6_hybrid_best_evidence");
});

test("blockpad benchmark summary requires improvement over BB6 hybrid", () => {
  const projectIds = ["projectA", "projectB", "projectC"];
  const calls = [];
  const variants = ["natural", "bb5SidecarLite", "bb6HybridLite", "bb7BlockPadLite"];

  for (const projectId of projectIds) {
    for (const scenario of SCENARIOS) {
      for (const variant of variants) {
        for (let iteration = 0; iteration < 10; iteration += 1) {
          const estimatedTotalCostCny =
            variant === "bb7BlockPadLite" ? 0.00006 : variant === "bb6HybridLite" ? 0.00009 : 0.0002;
          calls.push({
            projectId,
            scenarioId: scenario.id,
            variant,
            phase: iteration === 0 ? "warmup" : "repeat",
            iteration,
            status: "success",
            promptTokens: variant === "bb7BlockPadLite" ? 1288 : 960,
            completionTokens: 32,
            cachedTokens: variant === "bb7BlockPadLite" ? 1280 : 896,
            cacheRatio: variant === "bb7BlockPadLite" ? 1280 / 1288 : 896 / 960,
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
    mode: "blockpad",
    repeats: 10,
    projectIds,
    calls,
  });

  assert.equal(summary.requestCount, 720);
  assert.equal(summary.blockPadStats.estimatedCostWinsVsNatural, 18);
  assert.equal(summary.blockPadStats.estimatedCostWinsVsBb6, 18);
  assert.equal(summary.blockPadStats.conclusionLevel, "bb7_blockpad_best_evidence");
  assert.equal(summary.adaptiveSelectorStats.estimatedCostWinsVsNatural, 18);
  assert.equal(summary.adaptiveSelectorStats.estimatedCostNoWorseVsNatural, 18);
  assert.equal(summary.adaptiveSelectorStats.conclusionLevel, "bb9_adaptive_selector_best_evidence");
  assert.equal(summary.conclusionLevel, "bb9_adaptive_selector_best_evidence");
});

test("blockalign benchmark summary requires improvement over BB7 blockpad", () => {
  const projectIds = ["projectA", "projectB", "projectC"];
  const calls = [];
  const variants = ["natural", "bb7BlockPadLite", "bb8AlignedBlockPadLite"];

  for (const projectId of projectIds) {
    for (const scenario of SCENARIOS) {
      for (const variant of variants) {
        for (let iteration = 0; iteration < 10; iteration += 1) {
          const estimatedTotalCostCny =
            variant === "bb8AlignedBlockPadLite" ? 0.00005 : variant === "bb7BlockPadLite" ? 0.00008 : 0.0002;
          calls.push({
            projectId,
            scenarioId: scenario.id,
            variant,
            phase: iteration === 0 ? "warmup" : "repeat",
            iteration,
            status: "success",
            promptTokens: variant === "bb8AlignedBlockPadLite" ? 1282 : 1274,
            completionTokens: 32,
            cachedTokens: variant === "bb8AlignedBlockPadLite" ? 1280 : 1152,
            cacheRatio: variant === "bb8AlignedBlockPadLite" ? 1280 / 1282 : 1152 / 1274,
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
    mode: "blockalign",
    repeats: 10,
    projectIds,
    calls,
  });

  assert.equal(summary.requestCount, 540);
  assert.equal(summary.alignedBlockPadStats.estimatedCostWinsVsNatural, 18);
  assert.equal(summary.alignedBlockPadStats.estimatedCostWinsVsBb7, 18);
  assert.equal(summary.alignedBlockPadStats.conclusionLevel, "bb8_blockalign_best_evidence");
  assert.equal(summary.conclusionLevel, "bb8_blockalign_best_evidence");
});

test("benchmark provider profiles include MiMo and DeepSeek pricing", () => {
  assert.equal(PROVIDER_PROFILES["mimo-v2.5"].pricingCnyPerMillionTokens.inputCacheHit, 0.02);
  assert.equal(PROVIDER_PROFILES["deepseek-v4-flash"].pricingCnyPerMillionTokens.inputCacheMiss, 1);
  assert.equal(PROVIDER_PROFILES["deepseek-v4-flash"].pricingCnyPerMillionTokens.output, 2);
});

test("relay provider profile is separated from official provider evidence", () => {
  const relay = PROVIDER_PROFILES["relay-openai-gpt55-codex-oauth"];

  assert.equal(relay.routeType, "third_party_relay");
  assert.equal(relay.evidenceLevel, "relay_specific_observation");
  assert.equal(relay.pricingBasis, "openai_official_reference_price");
  assert.equal(relay.billingAudited, false);
  assert.equal(relay.pricingCnyPerMillionTokens, null);
});

test("relay usage audit recommends benchmark only when cache cost is observable", () => {
  const visibleCache = classifyRelayUsage([
    { label: "identical", status: "success", promptTokens: 100, completionTokens: 2, cachedTokens: 0, usageVisible: true, cacheFieldVisible: true },
    { label: "identical", status: "success", promptTokens: 100, completionTokens: 2, cachedTokens: 80, usageVisible: true, cacheFieldVisible: true },
    { label: "varied", status: "success", promptTokens: 110, completionTokens: 2, cachedTokens: 80, usageVisible: true, cacheFieldVisible: true },
  ]);
  const tokenLengthOnly = classifyRelayUsage([
    { label: "identical", status: "success", promptTokens: 100, completionTokens: 2, cachedTokens: null, usageVisible: true, cacheFieldVisible: false },
    { label: "identical", status: "success", promptTokens: 100, completionTokens: 2, cachedTokens: null, usageVisible: true, cacheFieldVisible: false },
    { label: "varied", status: "success", promptTokens: 110, completionTokens: 2, cachedTokens: null, usageVisible: true, cacheFieldVisible: false },
  ]);

  assert.equal(visibleCache.usageInterpretation, "cache_tokens_visible");
  assert.equal(visibleCache.benchmarkRecommended, true);
  assert.equal(tokenLengthOnly.usageInterpretation, "token_length_observation_only");
  assert.equal(tokenLengthOnly.stopRecommended, true);
  assert.equal(tokenLengthOnly.stopReason, "cache_cost_not_observable");
});
