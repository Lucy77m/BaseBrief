const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  buildHandoffArtifacts,
  extractHandoffJsonBlock,
  validateHandoffInput,
} = require("../scripts/basebrief_build_handoff");
const { buildAdapterArtifacts, normalizeTargets } = require("../scripts/basebrief_build_adapters");
const { checkArtifacts } = require("../scripts/basebrief_check_artifacts");
const { HELP_TEXT, commandBuild, commandCheck, commandDelta, commandDiff, commandInit, commandReceiverCheck, commandReceiverFlow, commandReceiverInit, commandReviewDraft, commandSidecarBuild, commandSidecarCheck, commandStateAdvance, commandStateHistory, commandStateInit, commandStateRead, commandStateStatus, commandStateValidate, commandSeal, formatHuman, run, starterInput } = require("../scripts/basebrief");
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
const { SIDECAR_SCHEMA_VERSION, buildSidecarBundle, checkSidecarBundle, detectStarterLanguage } = require("../scripts/basebrief_sidecar");
const { createSealFromInput, diffSeals, readSealOrInput, SEAL_SCHEMA_VERSION } = require("../scripts/basebrief_seal");
const { DELTA_BASELINE_SCHEMA_VERSION, DELTA_HANDOFF_SCHEMA_VERSION, readDeltaBaseline, runDelta } = require("../scripts/basebrief_delta");
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
  assert.match(englishReadme, /normal continuation path routes to `full` or `lite`/);
  assert.match(englishReadme, /zero-dependency CLI Lite/);
  assert.match(skill, /普通项目接续默认只在 `full` 和 `lite` 之间选择/);
  assert.match(modeSelection, /`cache-ready` 是显式实验路线/);
  assert.match(docsIndex, /experiments\/cache-ready-bb12-guard\.md/);
});

test("README 2-minute homepage stays concise and local-only", () => {
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const docsIndex = readText("docs/index.md");

  assert.ok(readme.split(/\r?\n/).length <= 85);
  assert.ok(englishReadme.split(/\r?\n/).length <= 90);
  assert.ok((readme.match(/\]\(/g) || []).length <= 12);
  assert.ok((englishReadme.match(/\]\(/g) || []).length <= 12);

  assert.match(readme, /我会带着上下文，一万次回到那个项目现场。/);
  assert.match(englishReadme, /I’ll return to the project scene with context in hand, every time\./);
  assert.match(readme, /context-pack --repo <target-repo> --output-dir <dir>/);
  assert.match(readme, /resume --input <context-pack-dir>/);
  assert.match(readme, /export --input <context-pack-dir> --output-dir <dir>/);
  assert.match(readme, /doctor --repo <target-repo> --context-pack <context-pack-dir>/);
  assert.match(englishReadme, /context-pack --repo <target-repo> --output-dir <dir>/);
  assert.match(englishReadme, /resume --input <context-pack-dir>/);
  assert.match(englishReadme, /export --input <context-pack-dir> --output-dir <dir>/);
  assert.match(englishReadme, /doctor --repo <target-repo> --context-pack <context-pack-dir>/);

  for (const doc of [readme, englishReadme]) {
    assert.match(doc, /No provider request/);
    assert.match(doc, /No runtime integration/);
    assert.match(doc, /No MCP server/);
    assert.match(doc, /No Workflow Runner/);
    assert.match(doc, /provider_probe_status=skipped/);
    assert.doesNotMatch(doc, /sidecar-build/);
    assert.doesNotMatch(doc, /basebrief-project-state-v1/);
  }

  assert.match(docsIndex, /project-state\.md/);
  assert.match(docsIndex, /seal-diff\.md/);
  assert.match(docsIndex, /specs\/delta-handoff\.md/);
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
  const languageReport = readText("examples/receiver/language-routing/receiver-report.md");
  const differenceResult = readJson("examples/receiver/difference-found/receiver-check-result.json");
  const blockedResult = readJson("examples/receiver/blocked/blocked-result.json");

  assert.equal(packageJson.private, true);
  assert.deepEqual(Object.keys(packageJson.scripts).sort(), ["check", "release-check", "test"]);
  assert.equal(packageJson.scripts.test, "node --test tests/basebrief.test.js tests/context-pack.test.js tests/cache-ready-benchmark.test.js tests/continuation-harness.test.js tests/project-profile.test.js tests/workflow-runner.test.js");
  assert.equal(packageJson.scripts["release-check"], "node scripts/run_release_checks.js");
  assert.equal(packageJson.scripts.check, "npm test && npm run release-check");
  ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies", "bin", "publishConfig", "files"].forEach((key) => {
    assert.equal(key in packageJson, false, `package.json should not define ${key}`);
  });

  assert.match(readme, /npm run check/);
  assert.match(readme, /不是发布到 npm 的 package/);
  assert.match(docsIndex, /releases\/v0\.3\.1\.md/);
  assert.match(englishReadme, /not a published npm package/);
  assert.match(docsIndex, /releases\/v0\.3\.1\.md/);
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
  assert.match(frictionLog, /pass\/fail/);
  assert.match(frictionLog, /receiver_acceptance_words/);
  assert.match(frictionLog, /difference_found/);
  assert.match(frictionLog, /blocked/);

  assert.match(differenceReadme, /human-facing `fail`/);
  assert.match(differenceReadme, /does not mean the agent failed/);
  assert.equal(differenceResult.handoff_acceptance, "difference_found");
  assert.equal(differenceResult.receiver_task_status, "completed");
  assert.match(blockedReadme, /human-facing/);
  assert.match(blockedReadme, /cannot run safely/);
  assert.equal(blockedResult.handoff_acceptance, "blocked");
  assert.equal(blockedResult.receiver_task_status, "blocked");
  assert.match(languageReadme, /BaseBrief/);
  assert.match(languageReadme, /current_goal/);
  assert.match(languageReadme, /receiver_entry_task/);
  assert.match(languageReadme, /match_latest_user_message/);
  assert.match(languageReadme, /pass\/fail/);
  assert.match(languageReadme, /technical literals/);
  assert.match(languageReadme, /wait_for_user_confirmation/);
  assert.match(languageReport, /BaseBrief/);
  assert.match(languageReport, /pass\/fail/);
  assert.match(languageReport, /receiver_task_status: completed/);
  assert.match(languageReport, /declared_checks_status: skipped/);
  assert.match(languageReport, /handoff_acceptance: pass/);
  assert.match(languageReport, /source_window_inherited_facts/);
  assert.match(languageReport, /live_repo_state/);
  assert.match(languageReport, /receiver_window_rechecks/);
  assert.match(languageReport, /wait for user confirmation/);

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

  assert.match(docsIndex, /releases\/v0\.3\.2\.md/);
  assert.match(docsIndex, /releases\/v0\.3\.2\.md/);
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

  assert.match(docsIndex, /dogfooding\/receiver-flow-dogfooding\.md/);
  assert.match(docsIndex, /releases\/v0\.3\.3\.md/);
  assert.match(docsIndex, /dogfooding\/receiver-flow-dogfooding\.md/);
  assert.match(docsIndex, /releases\/v0\.3\.3\.md/);
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

  assert.match(docsIndex, /releases\/v0\.4\.0\.md/);
  assert.match(docsIndex, /releases\/v0\.4\.0\.md/);
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

  assert.match(docsIndex, /releases\/v0\.4\.1\.md/);
  assert.match(docsIndex, /releases\/v0\.4\.1\.md/);
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

  assert.match(docsIndex, /releases\/v0\.5\.0\.md/);
  assert.match(docsIndex, /releases\/v0\.5\.0\.md/);
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

  assert.match(docsIndex, /releases\/v0\.5\.1\.md/);
  assert.match(docsIndex, /releases\/v0\.5\.1\.md/);
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

  assert.match(docsIndex, /releases\/v0\.5\.2\.md/);
  assert.match(docsIndex, /releases\/v0\.5\.2\.md/);
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

  assert.match(docsIndex, /releases\/v0\.5\.3\.md/);
  assert.match(docsIndex, /releases\/v0\.5\.3\.md/);
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

  assert.match(docsIndex, /project-state\.md/);
  assert.match(docsIndex, /releases\/v0\.6\.0\.md/);
  assert.match(cliLite, /state-init/);
  assert.match(docsIndex, /project-state\.md/);
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

  assert.match(docsIndex, /dogfooding\/project-state-self-dogfooding-v0\.6\.2\.md/);
  assert.match(docsIndex, /releases\/v0\.6\.2\.md/);
  assert.match(docsIndex, /dogfooding\/project-state-self-dogfooding-v0\.6\.2\.md/);
  assert.match(docsIndex, /releases\/v0\.6\.2\.md/);
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

  assert.match(docsIndex, /design\/project-state-lifecycle-readiness\.md/);
  assert.match(docsIndex, /dogfooding\/project-state-lifecycle-readiness-v0\.6\.3\.md/);
  assert.match(docsIndex, /releases\/v0\.6\.3\.md/);
  assert.match(docsIndex, /design\/project-state-lifecycle-readiness\.md/);
  assert.match(docsIndex, /dogfooding\/project-state-lifecycle-readiness-v0\.6\.3\.md/);
  assert.match(docsIndex, /releases\/v0\.6\.3\.md/);
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

  assert.match(docsIndex, /design\/project-state-lifecycle-model\.md/);
  assert.match(docsIndex, /dogfooding\/project-state-lifecycle-v0\.7\.0\.md/);
  assert.match(docsIndex, /testing-v0\.7\.x-test-matrix\.md/);
  assert.match(docsIndex, /releases\/v0\.7\.0\.md/);
  assert.match(cliLite, /state-status/);
  assert.match(cliLite, /state-advance/);
  assert.match(docsIndex, /design\/project-state-lifecycle-model\.md/);
  assert.match(docsIndex, /dogfooding\/project-state-lifecycle-v0\.7\.0\.md/);
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
  assert.match(cliLite, /pass\/fail/);
  assert.match(projectState, /pass\/fail/);
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

test("v0.8.2 sidecar receiver acceptance evidence stays public-safe", () => {
  const docsIndex = readText("docs/index.md");
  const testing = readText("docs/testing.md");
  const matrix = readText("docs/testing-v0.8.x-test-matrix.md");
  const dogfooding = readText("docs/dogfooding/sidecar-receiver-acceptance-v0.8.2.md");
  const release = readText("docs/releases/v0.8.2.md");

  assert.match(docsIndex, /releases\/v0\.8\.2\.md/);
  assert.match(docsIndex, /testing-v0\.8\.x-test-matrix\.md/);
  assert.match(docsIndex, /dogfooding\/sidecar-receiver-acceptance-v0\.8\.2\.md/);
  assert.match(testing, /v0\.8\.2 Sidecar Receiver Acceptance Evidence/);
  assert.match(testing, /testing-v0\.8\.x-test-matrix\.md/);

  for (const doc of [matrix, dogfooding, release]) {
    assert.match(doc, /sidecar-build/);
    assert.match(doc, /sidecar-check/);
    assert.match(doc, /generic/);
    assert.match(doc, /openclaw/);
    assert.match(doc, /No provider request/);
    assert.match(doc, /No raw private output/);
    assert.match(doc, /No runtime integration/);
    assert.match(doc, /No schema change/);
    assert.match(doc, /provider_probe_status=skipped/);
  }

  assert.match(matrix, /basebrief-project-state-v1/);
  assert.match(release, /basebrief-project-state-v1/);
  assert.match(release, /basebrief-sidecar-v1/);
  assert.match(dogfooding, /0 errors, 0 warnings/);
  assert.match(dogfooding, /wait for user confirmation/i);
  assert.match(release, /Wait for user confirmation/);
  assert.match(release, /profile\/config\/memory\/workspace/);

  for (const relativePath of [
    "docs/testing-v0.8.x-test-matrix.md",
    "docs/dogfooding/sidecar-receiver-acceptance-v0.8.2.md",
    "docs/releases/v0.8.2.md",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
  }
});

test("v0.8.3 sidecar discoverability polish links docs index and docs", () => {
  const docsIndex = readText("docs/index.md");
  const matrix = readText("docs/testing-v0.8.x-test-matrix.md");
  const release = readText("docs/releases/v0.8.3.md");

  for (const doc of [matrix, release]) {
    assert.match(doc, /sidecar-build/);
    assert.match(doc, /sidecar-check/);
    assert.match(doc, /generic/);
    assert.match(doc, /openclaw/);
    assert.match(doc, /provider_probe_status=skipped/);
  }

  for (const doc of [release]) {
    assert.match(doc, /No provider request/);
    assert.match(doc, /No raw private output/);
    assert.match(doc, /No runtime integration/);
    assert.match(doc, /No schema change/);
    assert.match(doc, /basebrief-project-state-v1/);
    assert.match(doc, /basebrief-sidecar-v1/);
  }

  assert.match(docsIndex, /releases\/v0\.8\.0\.md/);
  assert.match(docsIndex, /releases\/v0\.8\.1\.md/);
  assert.match(docsIndex, /releases\/v0\.8\.2\.md/);
  assert.match(docsIndex, /releases\/v0\.8\.3\.md/);
  assert.match(docsIndex, /testing-v0\.8\.x-test-matrix\.md/);
  assert.match(docsIndex, /releases\/v0\.8\.3\.md/);
  assert.match(matrix, /v0\.8\.3 Discoverability Polish/);
  assert.match(release, /Sidecar Discoverability Polish Candidate/);
  assert.match(release, /No Auto Flow/);
  assert.match(release, /Wait for user confirmation/);

  for (const relativePath of [
    "README.md",
    "README.en.md",
    "docs/testing-v0.8.x-test-matrix.md",
    "docs/releases/v0.8.3.md",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
  }
});

test("v0.8.4 external receiver smoke evidence stays manual and public-safe", () => {
  const docsIndex = readText("docs/index.md");
  const testing = readText("docs/testing.md");
  const matrix = readText("docs/testing-v0.8.x-test-matrix.md");
  const dogfooding = readText("docs/dogfooding/sidecar-external-receiver-smoke-v0.8.4.md");
  const release = readText("docs/releases/v0.8.4.md");

  assert.match(docsIndex, /releases\/v0\.8\.4\.md/);
  assert.match(docsIndex, /dogfooding\/sidecar-external-receiver-smoke-v0\.8\.4\.md/);
  assert.match(testing, /v0\.8\.4 External Receiver Smoke Evidence/);
  assert.match(testing, /manual_required/);
  assert.match(matrix, /v0\.8\.4 External Receiver Smoke Evidence/);

  for (const doc of [matrix, dogfooding, release]) {
    assert.match(doc, /sidecar-build/);
    assert.match(doc, /sidecar-check/);
    assert.match(doc, /generic/);
    assert.match(doc, /openclaw/);
    assert.match(doc, /manual_required/);
    assert.match(doc, /No provider request/);
    assert.match(doc, /No raw private output/);
    assert.match(doc, /No runtime integration/);
    assert.match(doc, /No schema change/);
    assert.match(doc, /provider_probe_status=skipped/);
  }

  assert.match(dogfooding, /OpenCode CLI availability \| available/);
  assert.match(dogfooding, /Claude Code CLI availability \| available/);
  assert.match(dogfooding, /0 errors, 0 warnings/);
  assert.match(dogfooding, /wait for user confirmation/i);
  assert.match(dogfooding, /did not invoke external receiver prompts/);
  assert.doesNotMatch(dogfooding, /OpenCode generic receiver prompt execution \| passed/);
  assert.doesNotMatch(dogfooding, /Claude Code generic receiver prompt execution \| passed/);
  assert.match(release, /External Receiver Smoke Evidence Candidate/);
  assert.match(release, /No Auto Flow/);
  assert.match(release, /Wait for user confirmation/);
  assert.match(release, /basebrief-project-state-v1/);
  assert.match(release, /basebrief-sidecar-v1/);

  for (const relativePath of [
    "docs/testing-v0.8.x-test-matrix.md",
    "docs/dogfooding/sidecar-external-receiver-smoke-v0.8.4.md",
    "docs/releases/v0.8.4.md",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
  }
});

test("v0.8.5 manual receiver smoke intake stays not-run until public-safe evidence", () => {
  const docsIndex = readText("docs/index.md");
  const testing = readText("docs/testing.md");
  const matrix = readText("docs/testing-v0.8.x-test-matrix.md");
  const dogfooding = readText("docs/dogfooding/sidecar-manual-receiver-smoke-v0.8.5.md");
  const release = readText("docs/releases/v0.8.5.md");

  assert.match(docsIndex, /releases\/v0\.8\.5\.md/);
  assert.match(docsIndex, /dogfooding\/sidecar-manual-receiver-smoke-v0\.8\.5\.md/);
  assert.match(testing, /v0\.8\.5 Manual Receiver Smoke Result Intake/);
  assert.match(testing, /not_run/);
  assert.match(testing, /manual_required/);
  assert.match(matrix, /v0\.8\.5 Manual Receiver Smoke Result Intake/);

  for (const doc of [matrix, dogfooding, release]) {
    assert.match(doc, /not_run/);
    assert.match(doc, /manual_required/);
    assert.match(doc, /No provider request/);
    assert.match(doc, /No raw private output/);
    assert.match(doc, /No runtime integration/);
    assert.match(doc, /No schema change/);
    assert.match(doc, /provider_probe_status=skipped/);
  }

  assert.match(dogfooding, /tool: opencode \| claude-code/);
  assert.match(dogfooding, /target: generic \| openclaw/);
  assert.match(dogfooding, /status: passed \| failed \| timed_out \| unavailable \| not_run/);
  assert.match(dogfooding, /basebrief_identified/);
  assert.match(dogfooding, /v08x_identified/);
  assert.match(dogfooding, /current_commit_identified/);
  assert.match(dogfooding, /current_goal_repeated/);
  assert.match(dogfooding, /receiver_entry_task_repeated/);
  assert.match(dogfooding, /risk_boundaries_count/);
  assert.match(dogfooding, /wait_for_user_confirmation/);
  assert.match(dogfooding, /no_auto_advance/);
  assert.match(dogfooding, /no_provider/);
  assert.match(dogfooding, /no_runtime/);
  assert.match(dogfooding, /new-window-starter\.md/);
  assert.match(dogfooding, /pass\/fail/);
  assert.match(dogfooding, /human-facing `pass`/);
  assert.match(dogfooding, /human-facing `fail`/);
  assert.match(dogfooding, /opencode \| generic \| not_run \| manual_required/);
  assert.match(dogfooding, /claude-code \| generic \| not_run \| manual_required/);
  assert.doesNotMatch(dogfooding, /opencode \| generic \| passed/);
  assert.doesNotMatch(dogfooding, /claude-code \| generic \| passed/);
  assert.match(release, /Manual Receiver Smoke Result Intake Candidate/);
  assert.match(release, /new-window-starter\.md/);
  assert.match(release, /pass\/fail/);
  assert.match(release, /OpenCode generic receiver smoke: not_run, manual_required/);
  assert.match(release, /Claude Code generic receiver smoke: not_run, manual_required/);
  assert.match(release, /No external receiver prompt was invoked from Codex/);
  assert.match(release, /Wait for user confirmation/);
  assert.match(release, /basebrief-project-state-v1/);
  assert.match(release, /basebrief-sidecar-v1/);
  assert.doesNotMatch(release, /OpenCode generic receiver smoke: passed/);
  assert.doesNotMatch(release, /Claude Code generic receiver smoke: passed/);

  for (const relativePath of [
    "docs/testing-v0.8.x-test-matrix.md",
    "docs/dogfooding/sidecar-manual-receiver-smoke-v0.8.5.md",
    "docs/releases/v0.8.5.md",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
  }
});

test("v0.8.6 manual receiver smoke result evidence records generic passes only", () => {
  const docsIndex = readText("docs/index.md");
  const testing = readText("docs/testing.md");
  const matrix = readText("docs/testing-v0.8.x-test-matrix.md");
  const dogfooding = readText("docs/dogfooding/sidecar-manual-receiver-smoke-v0.8.6.md");
  const release = readText("docs/releases/v0.8.6.md");

  assert.match(docsIndex, /releases\/v0\.8\.6\.md/);
  assert.match(docsIndex, /dogfooding\/sidecar-manual-receiver-smoke-v0\.8\.6\.md/);
  assert.match(testing, /v0\.8\.6 Manual Receiver Smoke Result Intake Evidence/);
  assert.match(matrix, /v0\.8\.6 Manual Receiver Smoke Result Intake Evidence/);

  for (const doc of [matrix, dogfooding, release]) {
    assert.match(doc, /passed/);
    assert.match(doc, /not_run/);
    assert.match(doc, /manual_required/);
    assert.match(doc, /No raw private output/);
    assert.match(doc, /No runtime integration/);
    assert.match(doc, /No schema change/);
    assert.match(doc, /provider_probe_status=skipped/);
  }

  assert.match(dogfooding, /opencode \| generic \| passed/);
  assert.match(dogfooding, /claude-code \| generic \| passed/);
  assert.match(dogfooding, /opencode \| openclaw \| not_run \| manual_required/);
  assert.match(dogfooding, /claude-code \| openclaw \| not_run \| manual_required/);
  assert.match(dogfooding, /v08x_identified: yes/);
  assert.match(dogfooding, /risk_boundaries_count: 7/);
  assert.match(dogfooding, /wait_for_user_confirmation: yes/);
  assert.match(dogfooding, /no_auto_advance: yes/);
  assert.match(dogfooding, /no_provider: yes/);
  assert.match(dogfooding, /no_runtime: yes/);
  assert.match(dogfooding, /new-window-starter\.md/);
  assert.match(dogfooding, /reported `pass`/);
  assert.match(dogfooding, /No provider request/);
  assert.match(dogfooding, /Only the two generic rows are marked `passed`/);

  assert.match(release, /Manual Receiver Smoke Result Intake Evidence Candidate/);
  assert.match(release, /new-window-starter\.md/);
  assert.match(release, /pass\/fail/);
  assert.match(release, /OpenCode generic receiver smoke: passed/);
  assert.match(release, /Claude Code generic receiver smoke: passed/);
  assert.match(release, /Only the two generic receiver smoke rows are marked `passed`/);
  assert.match(release, /basebrief-project-state-v1/);
  assert.match(release, /basebrief-sidecar-v1/);
  assert.doesNotMatch(release, /OpenCode openclaw receiver smoke: passed/);
  assert.doesNotMatch(release, /Claude Code openclaw receiver smoke: passed/);

  for (const relativePath of [
    "docs/testing-v0.8.x-test-matrix.md",
    "docs/dogfooding/sidecar-manual-receiver-smoke-v0.8.6.md",
    "docs/releases/v0.8.6.md",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
  }
});

test("OpenClaw and Hermes manual smoke follow-up closes the first-response gap without rewriting v0.8.5/v0.8.6 history", () => {
  const docsIndex = readText("docs/index.md");
  const testing = readText("docs/testing.md");
  const matrix = readText("docs/testing-v0.8.x-test-matrix.md");
  const dogfooding = readText("docs/dogfooding/sidecar-openclaw-hermes-manual-smoke-followup.md");

  assert.match(docsIndex, /dogfooding\/sidecar-openclaw-hermes-manual-smoke-followup\.md/);
  assert.match(testing, /OpenClaw\/Hermes Manual Receiver Smoke Follow-up/);
  assert.match(testing, /hermes-agent/);
  assert.match(testing, /openclaw-agent/);
  assert.match(testing, /strict six-file absolute-path/);
  assert.match(testing, /does not rewrite the `v0\.8\.5` \/ `v0\.8\.6` checkpoint tables/);
  assert.match(matrix, /OpenClaw\/Hermes Manual Receiver Smoke Follow-up/);
  assert.match(matrix, /hermes-agent/);
  assert.match(matrix, /openclaw-agent/);
  assert.match(matrix, /strict six-file/);
  assert.match(matrix, /latest freshly rebuilt `openclaw` bundle/);
  assert.match(dogfooding, /user-supplied private summary file/);
  assert.match(dogfooding, /six named files read by absolute path/);
  assert.match(dogfooding, /`hermes-agent` \| passed/);
  assert.match(dogfooding, /`openclaw-agent` \| passed/);
  assert.match(dogfooding, /strict six-file absolute-path recheck/);
  assert.match(dogfooding, /reported `pass`/);
  assert.match(dogfooding, /waited for user confirmation/);
  assert.match(dogfooding, /does not define or\s+start `v0\.9\.0`/);
  assert.match(dogfooding, /No provider request/);
  assert.match(dogfooding, /No runtime integration/);
  assert.match(dogfooding, /Do not write OpenClaw\/Hermes profile\/config\/memory\/workspace files/);
  assert.match(dogfooding, /latest freshly rebuilt `openclaw` bundle/);
  assert.match(dogfooding, /provider_probe_status=skipped/);

  for (const relativePath of [
    "docs/testing.md",
    "docs/testing-v0.8.x-test-matrix.md",
    "docs/dogfooding/sidecar-openclaw-hermes-manual-smoke-followup.md",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
  }
});

test("v0.9.0 readiness line defines integrated handoff hardening without expanding scope", () => {
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const docsIndex = readText("docs/index.md");
  const testing = readText("docs/testing.md");
  const projectState = readText("docs/project-state.md");
  const roadmap = readText("docs/roadmap/basebrief-long-term-baseline.md");
  const release = readText("docs/releases/v0.9.0.md");

  for (const doc of [docsIndex, testing, projectState, roadmap, release]) {
    assert.match(doc, /v0\.9\.0/);
    assert.match(doc, /Integrated Handoff Readiness/);
  }

  assert.match(release, /receiver-ready handoff -> Project State -> Sidecar bundle -> receiver first response/);
  assert.match(release, /public hardening candidate/);
  assert.match(release, /No provider request/);
  assert.match(release, /No raw private output/);
  assert.match(release, /No runtime integration/);
  assert.match(release, /No schema change/);
  assert.match(release, /No Auto Flow/);
  assert.match(release, /No plugin or platform work/);
  assert.match(release, /No v1\.0 claim/);
  assert.match(release, /No cross-provider cache claim/);
  assert.match(release, /No claim based on audited billing records/);
  assert.match(release, /provider_probe_status=skipped/);
  assert.match(roadmap, /Current v0\.9\.x closure line/);
  assert.match(roadmap, /v0\.9\.0 Integrated Handoff Readiness/);
  assert.match(roadmap, /basebrief-project-state-v1/);
  assert.match(roadmap, /basebrief-sidecar-v1/);
  assert.match(roadmap, /provider requests, runtime integration, schema changes/);
  assert.match(projectState, /No plugin or platform work/);
  assert.match(projectState, /No v1\.0 claim/);
  assert.match(testing, /provider_probe_status=skipped/);

  for (const relativePath of [
    "README.md",
    "README.en.md",
    "docs/testing.md",
    "docs/project-state.md",
    "docs/roadmap/basebrief-long-term-baseline.md",
    "docs/releases/v0.9.0.md",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
  }
});

test("v0.9.1 golden path closure keeps the integrated local handoff line easy to follow", () => {
  const docsIndex = readText("docs/index.md");
  const quickstart = readText("docs/quickstart-5min.md");
  const testing = readText("docs/testing.md");
  const projectState = readText("docs/project-state.md");
  const cliLite = readText("docs/cli-lite.md");
  const goldenPath = readText("docs/golden-path.md");
  const release = readText("docs/releases/v0.9.1.md");

  for (const doc of [docsIndex, quickstart, projectState, cliLite, goldenPath, release]) {
    assert.match(doc, /Integrated Handoff Golden Path/);
  }

  assert.match(goldenPath, /receiver-ready\.md -> state-init\/state-advance -> sidecar-build -> sidecar-check -> new-window-starter\.md -> receiver first response/);
  assert.match(goldenPath, /state-init --repo <target-repo> --source <receiver-ready\.md>/);
  assert.match(goldenPath, /state-advance --repo <target-repo> --source <receiver-ready\.md>/);
  assert.match(goldenPath, /sidecar-build --repo <target-repo>/);
  assert.match(goldenPath, /sidecar-check --input <sidecar-dir>/);
  assert.match(goldenPath, /state-status/);
  assert.match(goldenPath, /state-validate/);
  assert.match(goldenPath, /state-history/);
  assert.match(goldenPath, /pass\/fail/);
  assert.match(goldenPath, /wait for user confirmation/);
  assert.match(goldenPath, /No provider request/);
  assert.match(goldenPath, /No raw private output/);
  assert.match(goldenPath, /No runtime integration/);
  assert.match(goldenPath, /No schema change/);
  assert.match(goldenPath, /No Auto Flow/);
  assert.match(goldenPath, /basebrief-project-state-v1/);
  assert.match(goldenPath, /basebrief-sidecar-v1/);
  assert.match(release, /v0\.9\.1/);
  assert.match(release, /Golden Path Closure Candidate/);
  assert.match(release, /provider_probe_status=skipped/);
  assert.match(testing, /v0\.9\.1 Golden Path Closure Candidate/);
  assert.match(testing, /provider_probe_status=skipped/);
  assert.match(quickstart, /路径 B2/);
  assert.match(quickstart, /state-init -> sidecar-build -> sidecar-check/);
  assert.match(quickstart, /state-advance -> sidecar-build -> sidecar-check/);
  assert.match(cliLite, /Golden Path Grouped Flow/);

  for (const relativePath of [
    "README.md",
    "README.en.md",
    "docs/quickstart-5min.md",
    "docs/project-state.md",
    "docs/cli-lite.md",
    "docs/golden-path.md",
    "docs/testing.md",
    "docs/releases/v0.9.1.md",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
  }
});

test("v0.9.2 golden path example closure provides a public-safe first-pass and follow-up kit", () => {
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const docsIndex = readText("docs/index.md");
  const quickstart = readText("docs/quickstart-5min.md");
  const testing = readText("docs/testing.md");
  const goldenPath = readText("docs/golden-path.md");
  const release = readText("docs/releases/v0.9.2.md");
  const usability = readText(".github/ISSUE_TEMPLATE/usability_feedback.md");
  const kitReadme = readText("examples/golden-path/README.md");
  const ready = readText("examples/golden-path/receiver-ready.md");
  const stateReference = readText("examples/golden-path/state-reference.md");
  const firstPass = readText("examples/golden-path/first-pass-receiver-report.md");
  const followUp = readText("examples/golden-path/follow-up-receiver-report.md");
  const boundary = readText("examples/golden-path/sidecar-output-boundary.md");

  assert.match(docsIndex, /\.\.\/examples\/golden-path\/README\.md/);
  assert.match(docsIndex, /releases\/v0\.9\.2\.md/);
  assert.match(docsIndex, /\.\.\/examples\/golden-path\/README\.md/);
  assert.match(docsIndex, /releases\/v0\.9\.2\.md/);
  assert.match(docsIndex, /\.\.\/examples\/golden-path\/README\.md/);
  assert.match(docsIndex, /releases\/v0\.9\.2\.md/);
  assert.match(quickstart, /\.\.\/examples\/golden-path\/README\.md/);
  assert.match(goldenPath, /\.\.\/examples\/golden-path\/README\.md/);
  assert.match(testing, /v0\.9\.2 Golden Path Example Closure Candidate/);
  assert.match(usability, /Integrated Handoff Golden Path/);

  assert.match(release, /Golden Path Example Closure Candidate/);
  assert.match(release, /examples\/golden-path\//);
  assert.match(release, /No provider request/);
  assert.match(release, /No raw private output/);
  assert.match(release, /No runtime integration/);
  assert.match(release, /No schema change/);
  assert.match(release, /No Auto Flow/);
  assert.match(release, /provider_probe_status=skipped/);

  assert.match(kitReadme, /Golden Path Example Kit/);
  assert.match(kitReadme, /state-init --repo <target-repo> --source <receiver-ready\.md>/);
  assert.match(kitReadme, /state-advance --repo <target-repo> --source <receiver-ready\.md>/);
  assert.match(kitReadme, /sidecar-build --repo <target-repo>/);
  assert.match(kitReadme, /sidecar-check --input <sidecar-dir>/);
  assert.match(kitReadme, /new-window-starter\.md/);
  assert.match(kitReadme, /v1\.2 Delta Receiver Report Kit/);
  assert.match(kitReadme, /live_repo_state/);
  assert.match(kitReadme, /inherited_fact_differences/);
  assert.match(kitReadme, /hard_boundaries/);
  assert.match(kitReadme, /next_narrow_slice/);
  assert.match(kitReadme, /receiver-window rechecks/);
  assert.match(kitReadme, /difference_found/);

  assert.match(ready, /handoff_status: ready_for_receiver/);
  assert.match(ready, /No provider request/);
  assert.match(ready, /No raw private output/);
  assert.match(ready, /No runtime integration/);
  assert.match(ready, /No schema change/);
  assert.match(ready, /No Auto Flow/);

  assert.match(stateReference, /basebrief-project-state-v1/);
  assert.match(stateReference, /\.\.\/project-state\/state\.json/);

  assert.match(firstPass, /pass/);
  assert.match(firstPass, /wait/);
  assert.match(firstPass, /state-init/);
  assert.match(firstPass, /No provider request/);
  assert.match(firstPass, /No raw private output/);
  assert.match(firstPass, /No runtime integration/);
  assert.match(firstPass, /live_repo_state/);
  assert.match(firstPass, /inherited_fact_differences/);
  assert.match(firstPass, /hard_boundaries/);
  assert.match(firstPass, /next_narrow_slice/);
  assert.match(firstPass, /difference_found/);

  assert.match(followUp, /pass/);
  assert.match(followUp, /wait/);
  assert.match(followUp, /state-advance/);
  assert.match(followUp, /No provider request/);
  assert.match(followUp, /No raw private output/);
  assert.match(followUp, /No runtime integration/);
  assert.match(followUp, /live_repo_state/);
  assert.match(followUp, /inherited_fact_differences/);
  assert.match(followUp, /hard_boundaries/);
  assert.match(followUp, /next_narrow_slice/);
  assert.match(followUp, /difference_found/);

  assert.match(boundary, /No provider request/);
  assert.match(boundary, /No raw private output/);
  assert.match(boundary, /No runtime integration/);
  assert.match(boundary, /No schema change/);
  assert.match(boundary, /No Auto Flow/);

  const result = checkArtifacts({ inputPath: path.join(repoRoot, "examples/golden-path") });
  assert.equal(result.status, "passed");
  assert.equal(result.errorCount, 0);

  for (const relativePath of [
    "docs/golden-path.md",
    "docs/testing.md",
    "docs/releases/v0.9.2.md",
    "examples/golden-path",
    ".github/ISSUE_TEMPLATE/usability_feedback.md",
  ]) {
    const checked = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(checked.status, "passed", relativePath);
    assert.equal(checked.errorCount, 0, relativePath);
  }
});

test("v0.9.3 final closure freeze aligns the whole v0.9.x line for release review", () => {
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const docsIndex = readText("docs/index.md");
  const testing = readText("docs/testing.md");
  const roadmap = readText("docs/roadmap/basebrief-long-term-baseline.md");
  const goldenPath = readText("docs/golden-path.md");
  const release = readText("docs/releases/v0.9.3.md");
  const matrix = readText("docs/testing-v0.9.x-test-matrix.md");

  assert.match(docsIndex, /releases\/v0\.9\.3\.md/);
  assert.match(docsIndex, /testing-v0\.9\.x-test-matrix\.md/);
  assert.match(docsIndex, /releases\/v0\.9\.3\.md/);
  assert.match(docsIndex, /testing-v0\.9\.x-test-matrix\.md/);
  assert.match(docsIndex, /releases\/v0\.9\.3\.md/);
  assert.match(docsIndex, /testing-v0\.9\.x-test-matrix\.md/);
  assert.match(testing, /v0\.9\.3 Final Closure \/ Freeze Candidate/);
  assert.match(testing, /testing-v0\.9\.x-test-matrix\.md/);
  assert.match(goldenPath, /releases\/v0\.9\.3\.md/);
  assert.match(goldenPath, /testing-v0\.9\.x-test-matrix\.md/);

  assert.match(release, /Final Closure \/ Freeze Candidate/);
  assert.match(release, /v0\.9\.0` defines it, `v0\.9\.1` explains it, `v0\.9\.2` gives/);
  assert.match(release, /v0\.9\.3` closes and freezes/);
  assert.match(release, /No provider request/);
  assert.match(release, /No raw private output/);
  assert.match(release, /No runtime integration/);
  assert.match(release, /No schema change/);
  assert.match(release, /No Auto Flow/);
  assert.match(release, /No v1\.0 work/);
  assert.match(release, /provider_probe_status=skipped/);

  assert.match(matrix, /v0\.9\.x Integrated Handoff Closure Matrix/);
  assert.match(matrix, /receiver-ready\.md -> state-init\/state-advance -> sidecar-build -> sidecar-check -> new-window-starter\.md -> receiver first response/);
  assert.match(matrix, /v0\.9\.0 Integrated Handoff Readiness/);
  assert.match(matrix, /v0\.9\.1 Golden Path Closure/);
  assert.match(matrix, /v0\.9\.2 Golden Path Example Closure/);
  assert.match(matrix, /v0\.9\.3 Final Closure \/ Freeze/);
  assert.match(matrix, /provider_probe_status=skipped/);
  assert.match(matrix, /No provider request/);
  assert.match(matrix, /No raw private output/);
  assert.match(matrix, /No runtime integration/);
  assert.match(matrix, /No schema change/);
  assert.match(matrix, /No Auto Flow/);
  assert.match(matrix, /No v1\.0 work/);

  assert.match(roadmap, /`v0\.9\.x` closure line is frozen/);
  assert.match(roadmap, /v0\.9\.3 Final Closure \/ Freeze/);
  assert.match(roadmap, /public v1\.x Delta Receiver line opened with `v1\.0` Delta Handoff RC hardening/);
  assert.match(roadmap, /Keep the locally closed and frozen v1\.x Delta Handoff \/ Receiver \/ Starter \/ Usage Pack \/ Lint \/ Fixture \/ Repair \/ Dogfooding \/ Adoption line reviewable/);
  assert.doesNotMatch(roadmap, /Current v0\.9\.0 readiness target/);

  for (const relativePath of [
    "README.md",
    "README.en.md",
    "docs/index.md",
    "docs/testing.md",
    "docs/golden-path.md",
    "docs/roadmap/basebrief-long-term-baseline.md",
    "docs/releases/v0.9.3.md",
    "docs/testing-v0.9.x-test-matrix.md",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
  }
});

test("v1.0.0 delta handoff RC hardening exposes local-first delta without expanding scope", () => {
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const docsIndex = readText("docs/index.md");
  const testing = readText("docs/testing.md");
  const roadmap = readText("docs/roadmap/basebrief-long-term-baseline.md");
  const cliLite = readText("docs/cli-lite.md");
  const release = readText("docs/releases/v1.0.0.md");
  const v101Release = readText("docs/releases/v1.0.1.md");
  const v110Release = readText("docs/releases/v1.1.0.md");
  const v110Plan = readText("docs/releases/v1.1.0-plan.md");
  const v120Release = readText("docs/releases/v1.2.0.md");
  const v120Plan = readText("docs/releases/v1.2.0-plan.md");
  const v130Release = readText("docs/releases/v1.3.0.md");
  const v130Plan = readText("docs/releases/v1.3.0-plan.md");
  const v140Release = readText("docs/releases/v1.4.0.md");
  const v140Plan = readText("docs/releases/v1.4.0-plan.md");
  const v150Release = readText("docs/releases/v1.5.0.md");
  const v150Plan = readText("docs/releases/v1.5.0-plan.md");
  const v160Release = readText("docs/releases/v1.6.0.md");
  const v160Plan = readText("docs/releases/v1.6.0-plan.md");
  const v170Release = readText("docs/releases/v1.7.0.md");
  const v170Plan = readText("docs/releases/v1.7.0-plan.md");
  const v180Release = readText("docs/releases/v1.8.0.md");
  const v180Plan = readText("docs/releases/v1.8.0-plan.md");
  const v190Release = readText("docs/releases/v1.9.0.md");
  const v190Plan = readText("docs/releases/v1.9.0-plan.md");
  const v191Release = readText("docs/releases/v1.9.1.md");
  const v200Plan = readText("docs/releases/v2.0.0-plan.md");
  const contextPackLiteRoadmap = readText("docs/roadmap/basebrief-v2-context-pack-lite.md");
  const contextPackLiteSpec = readText("docs/specs/context-pack-lite.md");
  const v210Plan = readText("docs/releases/v2.1.0-plan.md");
  const v210Release = readText("docs/releases/v2.1.0.md");
  const contextPackCheckSpec = readText("docs/specs/context-pack-check.md");
  const contextPackCheckDogfooding = readText("docs/dogfooding/context-pack-check-acceptance-v2.1.0.md");
  const v1xDeltaReceiverMatrix = readText("docs/testing-v1.x-delta-receiver-closure-matrix.md");
  const plan = readText("docs/releases/v1.0.0-plan.md");
  const rcReview = readText("docs/releases/v1.0.0-rc-review.md");
  const checksDoc = readText("docs/checks.md");
  const receiverCheckDoc = readText("docs/receiver-check.md");
  const spec = readText("docs/specs/delta-handoff.md");
  const dogfooding = readText("docs/dogfooding/delta-handoff-fresh-receiver-v1.0.md");
  const baselineAdvanceDogfooding = readText("docs/dogfooding/delta-handoff-baseline-advance-v1.0.md");
  const receiverAcceptanceDogfooding = readText("docs/dogfooding/delta-receiver-acceptance-v1.1.md");
  const receiverReportKitDogfooding = readText("docs/dogfooding/delta-receiver-report-kit-v1.2.md");
  const receiverUsagePackDoc = readText("docs/receiver-usage-pack.md");
  const deltaReportPass = readText("examples/receiver/delta-report-pass/README.md");
  const deltaReportDifference = readText("examples/receiver/delta-report-difference-found/README.md");
  const receiverUsagePackReadme = readText("examples/receiver/usage-pack/README.md");
  const receiverUsagePackOutline = readText("examples/receiver/usage-pack/starter-report-outline.md");
  const receiverLintReadme = readText("examples/receiver/lint/README.md");
  const receiverLintRepairReadme = readText("examples/receiver/lint/repair/README.md");
  const receiverLintDogfooding = readText("docs/dogfooding/delta-receiver-lint-dogfooding-v1.8.md");
  const example = readText("examples/delta-handoff.md");

  assert.match(docsIndex, /releases\/v1\.0\.0\.md/);
  assert.match(docsIndex, /specs\/delta-handoff\.md/);
  assert.match(docsIndex, /dogfooding\/delta-handoff-fresh-receiver-v1\.0\.md/);
  assert.match(docsIndex, /dogfooding\/delta-handoff-baseline-advance-v1\.0\.md/);
  assert.match(docsIndex, /releases\/v1\.9\.1\.md/);
  assert.match(docsIndex, /testing-v1\.x-delta-receiver-closure-matrix\.md/);
  assert.match(v191Release, /v1\.x Delta Receiver line is locally closed and frozen/);
  assert.match(roadmap, /Delta Handoff RC hardening/);
  assert.match(release, /`basebrief-project-state-v1` remains unchanged/);
  assert.match(readme, /provider_probe_status=skipped/);
  assert.match(cliLite, /delta --repo/);

  assert.match(docsIndex, /releases\/v1\.0\.0\.md/);
  assert.match(docsIndex, /specs\/delta-handoff\.md/);
  assert.match(docsIndex, /dogfooding\/delta-handoff-fresh-receiver-v1\.0\.md/);
  assert.match(docsIndex, /dogfooding\/delta-handoff-baseline-advance-v1\.0\.md/);
  assert.match(docsIndex, /releases\/v1\.9\.1\.md/);
  assert.match(docsIndex, /testing-v1\.x-delta-receiver-closure-matrix\.md/);
  assert.match(v191Release, /v1\.x Delta Receiver line is locally closed and frozen/);
  assert.match(roadmap, /Delta Handoff RC hardening/);
  assert.match(release, /`basebrief-project-state-v1` remains unchanged/);
  assert.match(englishReadme, /provider_probe_status=skipped/);

  assert.match(docsIndex, /releases\/v1\.0\.0\.md/);
  assert.match(docsIndex, /releases\/v1\.0\.0-plan\.md/);
  assert.match(docsIndex, /releases\/v1\.0\.0-rc-review\.md/);
  assert.match(docsIndex, /releases\/v1\.0\.1\.md/);
  assert.match(docsIndex, /releases\/v1\.1\.0\.md/);
  assert.match(docsIndex, /releases\/v1\.1\.0-plan\.md/);
  assert.match(docsIndex, /releases\/v1\.2\.0-plan\.md/);
  assert.match(docsIndex, /releases\/v1\.2\.0\.md/);
  assert.match(docsIndex, /releases\/v1\.3\.0\.md/);
  assert.match(docsIndex, /releases\/v1\.3\.0-plan\.md/);
  assert.match(docsIndex, /receiver-usage-pack\.md/);
  assert.match(docsIndex, /releases\/v1\.4\.0\.md/);
  assert.match(docsIndex, /releases\/v1\.4\.0-plan\.md/);
  assert.match(docsIndex, /releases\/v1\.5\.0\.md/);
  assert.match(docsIndex, /releases\/v1\.5\.0-plan\.md/);
  assert.match(docsIndex, /releases\/v1\.6\.0\.md/);
  assert.match(docsIndex, /releases\/v1\.6\.0-plan\.md/);
  assert.match(docsIndex, /releases\/v1\.7\.0\.md/);
  assert.match(docsIndex, /releases\/v1\.7\.0-plan\.md/);
  assert.match(docsIndex, /releases\/v1\.8\.0\.md/);
  assert.match(docsIndex, /releases\/v1\.8\.0-plan\.md/);
  assert.match(docsIndex, /releases\/v1\.9\.0\.md/);
  assert.match(docsIndex, /releases\/v1\.9\.0-plan\.md/);
  assert.match(docsIndex, /releases\/v1\.9\.1\.md/);
  assert.match(docsIndex, /testing-v1\.x-delta-receiver-closure-matrix\.md/);
  assert.match(docsIndex, /roadmap\/basebrief-v2-context-pack-lite\.md/);
  assert.match(docsIndex, /releases\/v2\.0\.0-plan\.md/);
  assert.match(docsIndex, /releases\/v2\.1\.0\.md/);
  assert.match(docsIndex, /releases\/v2\.1\.0-plan\.md/);
  assert.match(docsIndex, /specs\/context-pack-lite\.md/);
  assert.match(docsIndex, /specs\/context-pack-check\.md/);
  assert.match(docsIndex, /dogfooding\/context-pack-check-acceptance-v2\.1\.0\.md/);
  assert.match(docsIndex, /specs\/delta-handoff\.md/);
  assert.match(docsIndex, /\.\.\/examples\/delta-handoff\.md/);
  assert.match(docsIndex, /dogfooding\/delta-handoff-fresh-receiver-v1\.0\.md/);
  assert.match(docsIndex, /dogfooding\/delta-handoff-baseline-advance-v1\.0\.md/);
  assert.match(docsIndex, /dogfooding\/delta-receiver-acceptance-v1\.1\.md/);
  assert.match(docsIndex, /dogfooding\/delta-receiver-report-kit-v1\.2\.md/);
  assert.match(docsIndex, /dogfooding\/delta-receiver-lint-dogfooding-v1\.8\.md/);
  assert.match(docsIndex, /\.\.\/examples\/receiver\/delta-report-pass\/README\.md/);
  assert.match(docsIndex, /\.\.\/examples\/receiver\/delta-report-difference-found\/README\.md/);
  assert.match(docsIndex, /\.\.\/examples\/receiver\/usage-pack\/README\.md/);
  assert.match(docsIndex, /\.\.\/examples\/receiver\/lint\/README\.md/);
  assert.match(docsIndex, /\.\.\/examples\/receiver\/lint\/repair\/README\.md/);

  assert.match(testing, /v1\.0 Delta Handoff RC Candidate/);
  assert.match(testing, /v1\.0 Delta Handoff Fresh Receiver Dogfooding/);
  assert.match(testing, /v1\.0 Delta Handoff Baseline-Advance Dogfooding/);
  assert.match(testing, /v1\.1 Delta Receiver Acceptance Local Closeout/);
  assert.match(testing, /v1\.2 Delta Receiver Report Kit Plan/);
  assert.match(testing, /v1\.2 Delta Receiver Report Kit Local Closeout/);
  assert.match(testing, /v1\.3 Delta Receiver Starter Integration Plan/);
  assert.match(testing, /v1\.3 Delta Receiver Starter Integration Local Closeout/);
  assert.match(testing, /v1\.4 Delta Receiver Usage Pack Plan/);
  assert.match(testing, /v1\.4 Delta Receiver Usage Pack Local Closeout/);
  assert.match(testing, /v1\.5 Delta Receiver Lint Mini Plan/);
  assert.match(testing, /v1\.5 Delta Receiver Lint Mini Local Closeout/);
  assert.match(testing, /v1\.6 Delta Receiver Lint Fixture Pack Plan/);
  assert.match(testing, /v1\.6 Delta Receiver Lint Fixture Pack Local Closeout/);
  assert.match(testing, /v1\.7 Delta Receiver Lint Repair Pack Plan/);
  assert.match(testing, /v1\.7 Delta Receiver Lint Repair Pack Local Closeout/);
  assert.match(testing, /v1\.8 Delta Receiver Lint Dogfooding Evidence Plan/);
  assert.match(testing, /v1\.8 Delta Receiver Lint Dogfooding Evidence Local Closeout/);
  assert.match(testing, /v1\.9 Delta Receiver Lint Discoverability \/ Adoption Plan/);
  assert.match(testing, /v1\.9 Delta Receiver Lint Discoverability \/ Adoption Local Closeout/);
  assert.match(testing, /v1\.9\.1 Delta Receiver Final Closure \/ Freeze/);
  assert.match(testing, /v2\.1\.0 Context Pack Check Local Closeout/);
  assert.match(testing, /check --input <context-pack-dir>/);
  assert.match(testing, /context-pack\.too-thick/);
  assert.match(testing, /testing-v1\.x-delta-receiver-closure-matrix\.md/);
  assert.match(testing, /receiver-specific rule families/);
  assert.match(testing, /Markdown\/text report kit/);
  assert.match(testing, /non-blocking historical `commits_in_range` drift/);
  assert.match(testing, /docs\/receiver-usage-pack\.md/);
  assert.match(testing, /examples\/receiver\/usage-pack\/README\.md/);
  assert.match(testing, /basebrief-project-state-v1` unchanged/);
  assert.match(testing, /provider_probe_status=skipped/);

  assert.match(checksDoc, /## Receiver Lint/);
  assert.match(checksDoc, /basebrief-receiver-check-result-v1/);
  assert.match(checksDoc, /receiver\.missing-machine-field/);
  assert.match(checksDoc, /receiver\.missing-human-anchor/);
  assert.match(checksDoc, /receiver\.missing-drift-semantics/);
  assert.match(checksDoc, /completed verification\s+result, not an agent failure/i);
  assert.match(checksDoc, /examples\/receiver\/lint\//);
  assert.match(checksDoc, /examples\/receiver\/lint\/repair\//);
  assert.match(checksDoc, /delta-receiver-lint-dogfooding-v1\.8\.md/);
  assert.match(checksDoc, /Receiver Lint Adoption Path/);
  assert.match(checksDoc, /docs\/releases\/v1\.9\.0-plan\.md/);
  assert.match(receiverCheckDoc, /Artifact Checker Compatibility/);
  assert.match(receiverCheckDoc, /examples\/receiver\/difference-found\/receiver-check-result\.json/);
  assert.match(receiverCheckDoc, /basebrief-receiver-check-result-v1/);
  assert.match(receiverCheckDoc, /receiver_task_status/);
  assert.match(receiverCheckDoc, /declared_checks_status/);

  assert.match(roadmap, /Phase 8B: Delta Handoff/);
  assert.match(roadmap, /Closed v1\.0-v1\.2 Delta line/);
  assert.match(roadmap, /fresh receiver dogfooding has reported `handoff_acceptance: pass`/);
  assert.match(roadmap, /basebrief-project-state-v1` remains unchanged/);
  assert.match(roadmap, /v1\.1 receiver acceptance closure/);
  assert.match(roadmap, /Delta Receiver Acceptance Kit/);
  assert.match(roadmap, /Local v1\.1 closeout status/);
  assert.match(roadmap, /docs\/releases\/v1\.1\.0\.md/);
  assert.match(roadmap, /Local v1\.2 closeout status/);
  assert.match(roadmap, /docs\/releases\/v1\.2\.0\.md/);
  assert.match(roadmap, /Local v1\.3 closeout status/);
  assert.match(roadmap, /docs\/releases\/v1\.3\.0\.md/);
  assert.match(roadmap, /Delta Receiver Starter Integration/);
  assert.match(roadmap, /v1\.2 report kit/);
  assert.match(roadmap, /Local v1\.4 closeout status/);
  assert.match(roadmap, /docs\/releases\/v1\.4\.0\.md/);
  assert.match(roadmap, /docs\/receiver-usage-pack\.md/);
  assert.match(roadmap, /Delta Receiver Usage Pack/);
  assert.match(roadmap, /Local v1\.5 closeout status/);
  assert.match(roadmap, /docs\/releases\/v1\.5\.0\.md/);
  assert.match(roadmap, /docs\/releases\/v1\.5\.0-plan\.md/);
  assert.match(roadmap, /scripts\/basebrief_check_artifacts\.js/);
  assert.match(roadmap, /Delta Receiver Lint Mini/);
  assert.match(roadmap, /Planned v1\.6 direction/);
  assert.match(roadmap, /docs\/releases\/v1\.6\.0-plan\.md/);
  assert.match(roadmap, /Local v1\.6 closeout status/);
  assert.match(roadmap, /docs\/releases\/v1\.6\.0\.md/);
  assert.match(roadmap, /examples\/receiver\/lint\//);
  assert.match(roadmap, /Local v1\.7 closeout status/);
  assert.match(roadmap, /docs\/releases\/v1\.7\.0\.md/);
  assert.match(roadmap, /examples\/receiver\/lint\/repair\//);
  assert.match(roadmap, /Local v1\.8 closeout status/);
  assert.match(roadmap, /docs\/releases\/v1\.8\.0\.md/);
  assert.match(roadmap, /delta-receiver-lint-dogfooding-v1\.8\.md/);
  assert.match(roadmap, /Local v1\.x final closeout status/);
  assert.match(roadmap, /docs\/releases\/v1\.9\.1\.md/);
  assert.match(roadmap, /docs\/testing-v1\.x-delta-receiver-closure-matrix\.md/);
  assert.match(roadmap, /locally closed and frozen the v1\.x Delta Handoff/);
  assert.match(roadmap, /locally closed and frozen v1\.x Delta Handoff \/ Receiver \/ Starter \/ Usage Pack \/ Lint \/ Fixture \/ Repair \/ Dogfooding \/ Adoption line reviewable/);
  assert.match(roadmap, /repeated local receiver usage evidence/);
  assert.doesNotMatch(roadmap, /Next v1\.3 planning target/);
  assert.doesNotMatch(roadmap, /Current v0\.9\.0 readiness target/);

  assert.match(contextPackLiteRoadmap, /BaseBrief v2\.0 is Context Pack Lite/);
  assert.match(contextPackLiteRoadmap, /v1\.x answers: what changed/);
  assert.match(contextPackLiteRoadmap, /v2\.0 answers: what local context pack/);
  assert.match(contextPackLiteRoadmap, /v2\.0 Context Pack Lite/);
  assert.match(contextPackLiteRoadmap, /v2\.1 Context Pack Check/);
  assert.match(contextPackLiteRoadmap, /v2\.2 One-command Resume \/ New-window Prompt/);
  assert.match(contextPackLiteRoadmap, /v2\.3 BaseBrief Format/);
  assert.match(contextPackLiteRoadmap, /Workflow Runner Lite or watcher\/dashboard work/);
  for (const artifact of ["MANIFEST.md", "REPO_MAP.md", "KEY_FILES.md", "RECENT_DELTA.md", "RISK_BOUNDARIES.md", "RECEIVER_STATE.md", "NEXT_WINDOW_STARTER.md"]) {
    assert.match(contextPackLiteRoadmap, new RegExp(artifact.replace(".", "\\.")));
    assert.match(contextPackLiteSpec, new RegExp(artifact.replace(".", "\\.")));
    assert.match(contextPackCheckSpec, new RegExp(artifact.replace(".", "\\.")));
  }
  for (const term of ["reviewed", "needs-review", "generated", "not_available", "not_applicable", "stale", "source", "trust"]) {
    assert.match(contextPackLiteRoadmap, new RegExp(term));
    assert.match(contextPackLiteSpec, new RegExp(term));
    assert.match(contextPackCheckSpec, new RegExp(term));
  }
  assert.match(contextPackLiteRoadmap, /a provider request path/);
  assert.match(contextPackLiteRoadmap, /a Repomix or Gitingest replacement/);
  assert.match(contextPackLiteRoadmap, /v2\.0-A does not implement a new command/);
  assert.match(v200Plan, /No `context-pack` command in v2\.0-A/);
  assert.match(v200Plan, /No provider request/);
  assert.match(v200Plan, /No AI automatic summary/);
  assert.match(v200Plan, /No vector database, embedding, or semantic index/);
  assert.match(v200Plan, /No `schema-v2`/);
  assert.match(v200Plan, /provider_probe_status=skipped/);
  assert.match(contextPackLiteSpec, /This spec defines the artifact contract only/);
  assert.match(contextPackLiteSpec, /do not invent receiver history/);
  assert.match(contextPackLiteSpec, /Prefer integrating this with the existing check surface/);
  assert.match(v210Plan, /v2\.1\.0 Context Pack Check Plan/);
  assert.match(v210Plan, /v2\.1-A check contract/);
  assert.match(v210Plan, /check --input <context-pack-dir>/);
  assert.match(v210Plan, /seven expected artifacts/);
  assert.match(v210Plan, /Review status/);
  assert.match(v210Plan, /provider_probe_status=skipped/);
  assert.match(v210Release, /v2\.1\.0 Context Pack Check Local Closeout/);
  assert.match(v210Release, /v2\.1-A/);
  assert.match(v210Release, /v2\.1-B/);
  assert.match(v210Release, /v2\.1-C/);
  assert.match(v210Release, /No new top-level `context-pack-check` command/);
  assert.match(v210Release, /No provider request/);
  assert.match(v210Release, /No runtime integration/);
  assert.match(v210Release, /No schema-v2/);
  assert.match(v210Release, /No Workflow Runner/);
  assert.match(v210Release, /provider_probe_status=skipped/);
  assert.match(contextPackCheckSpec, /Context Pack Check Spec/);
  assert.match(contextPackCheckSpec, /Status: v2\.1-A contract freeze/);
  assert.match(contextPackCheckSpec, /Required Files/);
  assert.match(contextPackCheckSpec, /Shared Metadata/);
  assert.match(contextPackCheckSpec, /Thickness/);
  assert.match(contextPackCheckSpec, /does not prove/);
  assert.match(contextPackCheckSpec, /keep the result shape compatible with Artifact Checker JSON/);
  assert.match(contextPackCheckDogfooding, /Context Pack Check Acceptance v2\.1\.0/);
  assert.match(contextPackCheckDogfooding, /clean_pack_status: pass/);
  assert.match(contextPackCheckDogfooding, /broken_pack_status: pass/);
  assert.match(contextPackCheckDogfooding, /thickness_warning_status: pass/);
  assert.match(contextPackCheckDogfooding, /public_safety_passthrough_status: pass/);
  assert.match(contextPackCheckDogfooding, /No new top-level checker command/);
  assert.match(contextPackCheckDogfooding, /No raw private output/);
  assert.match(contextPackCheckDogfooding, /No provider request/);

  assert.match(cliLite, /delta --repo <target-repo> --output-dir <dir>/);
  assert.match(release, /v1\.0\.0 Delta Handoff RC Candidate/);
  assert.match(release, /Reviewable Delta Handoff Compiler/);
  assert.match(release, /node scripts\/basebrief\.js delta/);
  assert.match(release, /v1\.0\.0-rc-review\.md/);
  assert.match(release, /handoff_acceptance: pass/);
  assert.match(release, /delta-handoff-baseline-advance-v1\.0\.md/);
  assert.match(release, /baseline-advance closure/);
  assert.match(release, /basebrief-project-state-v1` remains unchanged/);
  assert.match(release, /provider_probe_status=skipped/);
  assert.match(release, /No provider request/);
  assert.match(release, /No runtime integration/);
  assert.match(release, /No schema-v2 work/);
  assert.match(release, /No plugin, MCP, IDE/);

  assert.match(plan, /Reviewable Delta Handoff Compiler/);
  assert.match(rcReview, /v1\.0\.0 RC Review Package/);
  assert.match(rcReview, /Commit-Ready Summary/);
  assert.match(rcReview, /docs\/releases\/v1\.0\.1\.md/);
  assert.match(rcReview, /delta-handoff-fresh-receiver-v1\.0\.md/);
  assert.match(rcReview, /delta-handoff-baseline-advance-v1\.0\.md/);
  assert.match(rcReview, /\.basebrief\/delta-baseline\.json/);
  assert.match(rcReview, /provider_probe_status=skipped/);
  assert.match(rcReview, /No provider request/);
  assert.match(rcReview, /No schema-v2 work/);
  assert.match(v101Release, /v1\.0\.1 Delta Receiver Clarity Patch/);
  assert.match(v101Release, /basebrief-delta-handoff-v1/);
  assert.match(v101Release, /basebrief-delta-baseline-v1/);
  assert.match(v101Release, /basebrief-project-state-v1/);
  assert.match(v101Release, /baseline_source: missing/);
  assert.match(v101Release, /no-baseline\.\.HEAD/);
  assert.match(v101Release, /commits_in_range: 0/);
  assert.match(v101Release, /stateDiff\.status: unchanged/);
  assert.match(v101Release, /provider_probe_status=skipped/);
  assert.match(v101Release, /No provider request/);
  assert.match(v101Release, /No runtime integration/);
  assert.match(v101Release, /No plugin, MCP, IDE/);
  assert.match(v101Release, /No schema-v2 work/);
  assert.match(v110Release, /v1\.1\.0 Delta Receiver Acceptance Local Closeout/);
  assert.match(v110Release, /Delta Receiver Acceptance Kit/);
  assert.match(v110Release, /docs\/releases\/v1\.1\.0-plan\.md/);
  assert.match(v110Release, /docs\/dogfooding\/delta-receiver-acceptance-v1\.1\.md/);
  assert.match(v110Release, /handoff_acceptance: difference_found/);
  assert.match(v110Release, /handoff_acceptance: pass/);
  assert.match(v110Release, /commits_in_range: 4/);
  assert.match(v110Release, /historical pre-commit closeout fact/);
  assert.match(v110Release, /count drift is non-blocking/);
  assert.match(v110Release, /branch, HEAD, and worktree facts/);
  assert.match(v110Release, /worktreeChangedFiles: \[\]/);
  assert.match(v110Release, /basebrief-project-state-v1/);
  assert.match(v110Release, /basebrief-delta-handoff-v1/);
  assert.match(v110Release, /basebrief-delta-baseline-v1/);
  assert.match(v110Release, /provider_probe_status=skipped/);
  assert.match(v110Release, /No provider request/);
  assert.match(v110Release, /No runtime integration/);
  assert.match(v110Release, /No plugin, MCP, IDE/);
  assert.match(v110Release, /No schema-v2 work/);
  assert.match(v110Release, /No new CLI command/);
  assert.match(v110Release, /not a push, tag, release/);
  assert.match(v110Plan, /v1\.1\.0 Delta Receiver Acceptance Plan/);
  assert.match(v110Plan, /Delta Receiver Acceptance Kit/);
  assert.match(v110Plan, /live repository state versus inherited handoff facts/);
  assert.match(v110Plan, /receiver_task_status/);
  assert.match(v110Plan, /handoff_acceptance/);
  assert.match(v110Plan, /basebrief-project-state-v1/);
  assert.match(v110Plan, /basebrief-delta-handoff-v1/);
  assert.match(v110Plan, /basebrief-delta-baseline-v1/);
  assert.match(v110Plan, /No provider request/);
  assert.match(v110Plan, /No runtime integration/);
  assert.match(v110Plan, /No plugin, MCP, IDE/);
  assert.match(v110Plan, /No schema-v2 work/);
  assert.match(v110Plan, /No new CLI command/);
  assert.match(v110Plan, /provider_probe_status=skipped/);
  assert.match(v120Plan, /v1\.2\.0 Delta Receiver Report Kit Plan/);
  assert.match(v120Plan, /Delta Receiver Report Kit/);
  assert.match(v120Plan, /Markdown\/text reporting aid/);
  assert.match(v120Plan, /not a JSON schema/);
  assert.match(v120Plan, /receiver_task_status/);
  assert.match(v120Plan, /repository_state_status/);
  assert.match(v120Plan, /handoff_acceptance/);
  assert.match(v120Plan, /blocking_or_repair_notes/);
  assert.match(v120Plan, /current_goal/);
  assert.match(v120Plan, /live_repo_state/);
  assert.match(v120Plan, /inherited_fact_differences/);
  assert.match(v120Plan, /hard_boundaries/);
  assert.match(v120Plan, /next_narrow_slice/);
  assert.match(v120Plan, /source-window inherited facts/);
  assert.match(v120Plan, /receiver-window\s+rechecks/);
  assert.match(v120Plan, /handoff_acceptance: pass/);
  assert.match(v120Plan, /handoff_acceptance: difference_found/);
  assert.match(v120Plan, /handoff_acceptance: blocked/);
  assert.match(v120Plan, /historical count drift as non-blocking/);
  assert.match(v120Plan, /basebrief-project-state-v1/);
  assert.match(v120Plan, /basebrief-delta-handoff-v1/);
  assert.match(v120Plan, /basebrief-delta-baseline-v1/);
  assert.match(v120Plan, /No provider request/);
  assert.match(v120Plan, /No runtime integration/);
  assert.match(v120Plan, /No plugin, MCP, IDE/);
  assert.match(v120Plan, /No schema-v2 work/);
  assert.match(v120Plan, /No new CLI command/);
  assert.match(v120Plan, /No machine-readable JSON schema/);
  assert.match(v120Plan, /No command output format change/);
  assert.match(v120Plan, /provider_probe_status=skipped/);
  assert.match(v120Release, /v1\.2\.0 Delta Receiver Report Kit Local Closeout/);
  assert.match(v120Release, /Delta Receiver Report Kit/);
  assert.match(v120Release, /docs\/releases\/v1\.2\.0-plan\.md/);
  assert.match(v120Release, /docs\/dogfooding\/delta-receiver-report-kit-v1\.2\.md/);
  assert.match(v120Release, /examples\/receiver\/delta-report-pass\/README\.md/);
  assert.match(v120Release, /examples\/receiver\/delta-report-difference-found\/README\.md/);
  assert.match(v120Release, /receiver_task_status/);
  assert.match(v120Release, /repository_state_status/);
  assert.match(v120Release, /handoff_acceptance/);
  assert.match(v120Release, /blocking_or_repair_notes/);
  assert.match(v120Release, /current_goal/);
  assert.match(v120Release, /live_repo_state/);
  assert.match(v120Release, /inherited_fact_differences/);
  assert.match(v120Release, /hard_boundaries/);
  assert.match(v120Release, /next_narrow_slice/);
  assert.match(v120Release, /source-window inherited facts/);
  assert.match(v120Release, /receiver-window\s+rechecks/);
  assert.match(v120Release, /handoff_acceptance: pass/);
  assert.match(v120Release, /handoff_acceptance: difference_found/);
  assert.match(v120Release, /handoff_acceptance: blocked/);
  assert.match(v120Release, /It is not an agent failure/);
  assert.match(v120Release, /historical count drift is non-blocking/);
  assert.match(v120Release, /No provider request/);
  assert.match(v120Release, /No runtime integration/);
  assert.match(v120Release, /No plugin, MCP, IDE/);
  assert.match(v120Release, /No schema-v2 work/);
  assert.match(v120Release, /No new CLI command/);
  assert.match(v120Release, /No machine-readable JSON schema/);
  assert.match(v120Release, /No command output format change/);
  assert.match(v120Release, /provider_probe_status=skipped/);
  assert.match(v130Release, /v1\.3\.0 Delta Receiver Starter Integration Local Closeout/);
  assert.match(v130Release, /Delta Receiver Starter Integration/);
  assert.match(v130Release, /docs\/releases\/v1\.3\.0-plan\.md/);
  assert.match(v130Release, /docs\/quickstart-5min\.md/);
  assert.match(v130Release, /docs\/golden-path\.md/);
  assert.match(v130Release, /examples\/golden-path\/README\.md/);
  assert.match(v130Release, /examples\/golden-path\/first-pass-receiver-report\.md/);
  assert.match(v130Release, /examples\/golden-path\/follow-up-receiver-report\.md/);
  assert.match(v130Release, /templates\/zh-CN\/NEXT_CHAT_PROMPT\.md/);
  assert.match(v130Release, /pass\/fail/);
  assert.match(v130Release, /wait for user confirmation/);
  assert.match(v130Release, /declared_checks_status/);
  assert.match(v130Release, /current_goal/);
  assert.match(v130Release, /live_repo_state/);
  assert.match(v130Release, /inherited_fact_differences/);
  assert.match(v130Release, /hard_boundaries/);
  assert.match(v130Release, /next_narrow_slice/);
  assert.match(v130Release, /source-window inherited facts/);
  assert.match(v130Release, /live repo\s+facts/);
  assert.match(v130Release, /receiver-window rechecks/);
  assert.match(v130Release, /difference_found/);
  assert.match(v130Release, /historical count drift is non-blocking/);
  assert.match(v130Release, /No provider request/);
  assert.match(v130Release, /No runtime integration/);
  assert.match(v130Release, /No plugin, MCP, IDE/);
  assert.match(v130Release, /No schema-v2 work/);
  assert.match(v130Release, /No new CLI command/);
  assert.match(v130Release, /No machine-readable JSON schema/);
  assert.match(v130Release, /No command output format change/);
  assert.match(v130Release, /provider_probe_status=skipped/);
  assert.match(v130Plan, /v1\.3\.0 Delta Receiver Starter Integration Plan/);
  assert.match(v130Plan, /Delta Receiver Starter Integration/);
  assert.match(v130Plan, /v1\.2 report kit/);
  assert.match(v130Plan, /starter-facing docs\s+and\s+examples/);
  assert.match(v130Plan, /not to create a new runtime or command/);
  assert.match(v130Plan, /source-window inherited facts/);
  assert.match(v130Plan, /receiver-window rechecks/);
  assert.match(v130Plan, /difference_found/);
  assert.match(v130Plan, /historical `commits_in_range` drift/);
  assert.match(v130Plan, /No provider request/);
  assert.match(v130Plan, /No runtime integration/);
  assert.match(v130Plan, /No plugin, MCP, IDE/);
  assert.match(v130Plan, /No schema-v2 work/);
  assert.match(v130Plan, /No new CLI command/);
  assert.match(v130Plan, /No machine-readable JSON schema/);
  assert.match(v130Plan, /No command output format change/);
  assert.match(v130Plan, /Thin command exploration/);
  assert.match(v130Plan, /provider_probe_status=skipped/);
  assert.match(v140Plan, /v1\.4\.0 Delta Receiver Usage Pack Plan/);
  assert.match(v140Plan, /Delta Receiver Usage Pack/);
  assert.match(v140Plan, /public usage guide/);
  assert.match(v140Plan, /example router/);
  assert.match(v140Plan, /copyable starter outline/);
  assert.match(v140Plan, /difference_found/);
  assert.match(v140Plan, /blocked/);
  assert.match(v140Plan, /source-window inherited facts/);
  assert.match(v140Plan, /live repo facts/);
  assert.match(v140Plan, /receiver-window\s+rechecks/);
  assert.match(v140Plan, /historical `commits_in_range` drift/);
  assert.match(v140Plan, /No provider request/);
  assert.match(v140Plan, /No runtime integration/);
  assert.match(v140Plan, /No plugin, MCP, IDE/);
  assert.match(v140Plan, /No schema-v2 work/);
  assert.match(v140Plan, /No new CLI command/);
  assert.match(v140Plan, /No machine-readable JSON schema/);
  assert.match(v140Plan, /No command output format change/);
  assert.match(v140Plan, /provider_probe_status=skipped/);
  assert.match(v140Release, /v1\.4\.0 Delta Receiver Usage Pack Local Closeout/);
  assert.match(v140Release, /Delta Receiver Usage Pack/);
  assert.match(v140Release, /docs\/releases\/v1\.4\.0-plan\.md/);
  assert.match(v140Release, /docs\/receiver-usage-pack\.md/);
  assert.match(v140Release, /examples\/receiver\/usage-pack\/README\.md/);
  assert.match(v140Release, /examples\/receiver\/usage-pack\/starter-report-outline\.md/);
  assert.match(v140Release, /pass\/fail/);
  assert.match(v140Release, /wait for user confirmation/);
  assert.match(v140Release, /difference_found/);
  assert.match(v140Release, /blocked/);
  assert.match(v140Release, /historical `commits_in_range` drift remains non-blocking/);
  assert.match(v140Release, /No provider request/);
  assert.match(v140Release, /No runtime integration/);
  assert.match(v140Release, /No plugin, MCP, IDE/);
  assert.match(v140Release, /No schema-v2 work/);
  assert.match(v140Release, /No new CLI command/);
  assert.match(v140Release, /No machine-readable JSON schema/);
  assert.match(v140Release, /No command output format change/);
  assert.match(v140Release, /provider_probe_status=skipped/);
  assert.match(v150Plan, /v1\.5\.0 Delta Receiver Lint Mini Plan/);
  assert.match(v150Plan, /Delta Receiver Lint Mini/);
  assert.match(v150Plan, /explicit receiver Markdown and receiver result JSON shapes/);
  assert.match(v150Plan, /missing machine fields/);
  assert.match(v150Plan, /missing `difference_found` semantics/);
  assert.match(v150Plan, /basebrief-receiver-check-result-v1/);
  assert.match(v150Plan, /No provider request/);
  assert.match(v150Plan, /No runtime integration/);
  assert.match(v150Plan, /No plugin, MCP, IDE/);
  assert.match(v150Plan, /No schema-v2 work/);
  assert.match(v150Plan, /No new CLI command/);
  assert.match(v150Plan, /No machine-readable JSON schema/);
  assert.match(v150Plan, /No command output format change/);
  assert.match(v150Plan, /provider_probe_status=skipped/);
  assert.match(v150Release, /v1\.5\.0 Delta Receiver Lint Mini Local Closeout/);
  assert.match(v150Release, /Delta Receiver Lint Mini/);
  assert.match(v150Release, /docs\/releases\/v1\.5\.0-plan\.md/);
  assert.match(v150Release, /scripts\/basebrief_check_artifacts\.js/);
  assert.match(v150Release, /docs\/checks\.md/);
  assert.match(v150Release, /docs\/receiver-check\.md/);
  assert.match(v150Release, /docs\/receiver-usage-pack\.md/);
  assert.match(v150Release, /receiver\.missing-machine-field/);
  assert.match(v150Release, /receiver\.invalid-result-consistency/);
  assert.match(v150Release, /receiver\.missing-drift-semantics/);
  assert.match(v150Release, /schemaVersion: basebrief-receiver-check-result-v1/);
  assert.match(v150Release, /`difference_found` remains a completed verification result/);
  assert.match(v150Release, /node scripts\/basebrief\.js check --input examples\/receiver\/language-routing\/receiver-report\.md --json/);
  assert.match(v150Release, /node scripts\/basebrief\.js check --input examples\/receiver\/difference-found\/receiver-check-result\.json --json/);
  assert.match(v150Release, /No provider request/);
  assert.match(v150Release, /No runtime integration/);
  assert.match(v150Release, /No plugin, MCP, IDE/);
  assert.match(v150Release, /No schema-v2 work/);
  assert.match(v150Release, /No new CLI command/);
  assert.match(v150Release, /No machine-readable JSON schema/);
  assert.match(v150Release, /No command output format change/);
  assert.match(v150Release, /provider_probe_status=skipped/);
  assert.match(v160Plan, /v1\.6\.0 Delta Receiver Lint Fixture Pack Plan/);
  assert.match(v160Plan, /Delta Receiver Lint Fixture Pack/);
  assert.match(v160Plan, /examples\/receiver\/lint\//);
  assert.match(v160Plan, /clean pass/);
  assert.match(v160Plan, /receiver result JSON consistency error/);
  assert.match(v160Plan, /historical `commits_in_range` drift warning/);
  assert.match(v160Plan, /No new CLI command/);
  assert.match(v160Plan, /No machine-readable JSON schema/);
  assert.match(v160Plan, /No command output format change/);
  assert.match(v160Plan, /provider_probe_status=skipped/);
  assert.match(v160Release, /v1\.6\.0 Delta Receiver Lint Fixture Pack Local Closeout/);
  assert.match(v160Release, /Delta Receiver Lint Fixture Pack/);
  assert.match(v160Release, /docs\/releases\/v1\.6\.0-plan\.md/);
  assert.match(v160Release, /examples\/receiver\/lint\/README\.md/);
  assert.match(v160Release, /receiver\.missing-report-section/);
  assert.match(v160Release, /receiver\.invalid-result-consistency/);
  assert.match(v160Release, /receiver\.missing-drift-semantics/);
  assert.match(v160Release, /node scripts\/basebrief\.js check --input examples\/receiver\/lint\/clean-pass-receiver-report\.md --json/);
  assert.match(v160Release, /node scripts\/basebrief\.js check --input examples\/receiver\/lint\/delta-missing-section-receiver-report\.md --json/);
  assert.match(v160Release, /No provider request/);
  assert.match(v160Release, /No runtime integration/);
  assert.match(v160Release, /No plugin, MCP, IDE/);
  assert.match(v160Release, /No schema-v2 work/);
  assert.match(v160Release, /No new CLI command/);
  assert.match(v160Release, /No machine-readable JSON schema/);
  assert.match(v160Release, /No command output format change/);
  assert.match(v160Release, /provider_probe_status=skipped/);
  assert.match(v170Plan, /v1\.7\.0 Delta Receiver Lint Repair Pack Plan/);
  assert.match(v170Plan, /Delta Receiver Lint Repair Pack/);
  assert.match(v170Plan, /examples\/receiver\/lint\/repair\//);
  assert.match(v170Plan, /receiver\.missing-human-anchor/);
  assert.match(v170Plan, /receiver\.missing-drift-semantics/);
  assert.match(v170Plan, /No checker rule change/);
  assert.match(v170Plan, /No new CLI command/);
  assert.match(v170Plan, /No machine-readable JSON schema/);
  assert.match(v170Plan, /provider_probe_status=skipped/);
  assert.match(v170Release, /v1\.7\.0 Delta Receiver Lint Repair Pack Local Closeout/);
  assert.match(v170Release, /examples\/receiver\/lint\/repair\/README\.md/);
  assert.match(v170Release, /fixed-delta-receiver-report\.md/);
  assert.match(v170Release, /fixed-starter-report\.md/);
  assert.match(v170Release, /fixed-result\.json/);
  assert.match(v170Release, /receiver\.invalid-result-consistency/);
  assert.match(v170Release, /node scripts\/basebrief\.js check --input examples\/receiver\/lint\/repair\/fixed-delta-receiver-report\.md --json/);
  assert.match(v170Release, /No checker rule change/);
  assert.match(v170Release, /provider_probe_status=skipped/);
  assert.match(v180Plan, /v1\.8\.0 Delta Receiver Lint Dogfooding Evidence Plan/);
  assert.match(v180Plan, /Delta Receiver Lint Dogfooding Evidence/);
  assert.match(v180Plan, /delta-receiver-lint-dogfooding-v1\.8\.md/);
  assert.match(v180Plan, /v1\.6 fixture behavior/);
  assert.match(v180Plan, /v1\.7 repair/);
  assert.match(v180Plan, /No checker rule change/);
  assert.match(v180Plan, /provider_probe_status=skipped/);
  assert.match(v180Release, /v1\.8\.0 Delta Receiver Lint Dogfooding Evidence Local Closeout/);
  assert.match(v180Release, /docs\/dogfooding\/delta-receiver-lint-dogfooding-v1\.8\.md/);
  assert.match(v180Release, /fixed-delta-receiver-report\.md/);
  assert.match(v180Release, /fixed-starter-report\.md/);
  assert.match(v180Release, /fixed-result\.json/);
  assert.match(v180Release, /No checker rule change/);
  assert.match(v180Release, /provider_probe_status=skipped/);
  assert.match(v190Plan, /v1\.9\.0 Delta Receiver Lint Discoverability \/ Adoption Plan/);
  assert.match(v190Plan, /Make the existing receiver lint public surface easier to find/);
  assert.match(v190Plan, /examples\/receiver\/usage-pack\/README\.md/);
  assert.match(v190Plan, /examples\/receiver\/lint\/README\.md/);
  assert.match(v190Plan, /examples\/receiver\/lint\/repair\/README\.md/);
  assert.match(v190Plan, /examples\/receiver\/delta-report-difference-found\/README\.md/);
  assert.match(v190Plan, /No checker rule change/);
  assert.match(v190Plan, /No new rule family/);
  assert.match(v190Plan, /No new CLI command/);
  assert.match(v190Plan, /No machine-readable JSON schema/);
  assert.match(v190Plan, /No command output format change/);
  assert.match(v190Plan, /provider_probe_status=skipped/);
  assert.match(v190Release, /v1\.9\.0 Delta Receiver Lint Discoverability \/ Adoption Local Closeout/);
  assert.match(v190Release, /docs\/releases\/v1\.9\.0-plan\.md/);
  assert.match(v190Release, /docs\/receiver-usage-pack\.md/);
  assert.match(v190Release, /examples\/receiver\/usage-pack\/README\.md/);
  assert.match(v190Release, /examples\/receiver\/lint\/README\.md/);
  assert.match(v190Release, /examples\/receiver\/lint\/repair\/README\.md/);
  assert.match(v190Release, /examples\/receiver\/delta-report-difference-found\/README\.md/);
  assert.match(v190Release, /Intentional failing fixtures remain learning inputs/);
  assert.match(v190Release, /difference_found` remains a completed verification result/);
  assert.match(v190Release, /Historical `commits_in_range` drift remains non-blocking/);
  assert.match(v190Release, /Receiver lint remains explicit-shape based/);
  assert.match(v190Release, /No checker rule change/);
  assert.match(v190Release, /No new rule family/);
  assert.match(v190Release, /No new CLI command/);
  assert.match(v190Release, /No machine-readable JSON schema/);
  assert.match(v190Release, /No command output format change/);
  assert.match(v190Release, /provider_probe_status=skipped/);
  assert.match(v191Release, /v1\.9\.1 Delta Receiver Final Closure \/ Freeze/);
  assert.match(v191Release, /docs\/testing-v1\.x-delta-receiver-closure-matrix\.md/);
  assert.match(v191Release, /v1\.x Delta Receiver line is frozen/);
  assert.match(v191Release, /difference_found` remains a completed verification result/);
  assert.match(v191Release, /Historical `commits_in_range` drift remains non-blocking/);
  assert.match(v191Release, /Receiver lint remains explicit-shape based/);
  assert.match(v191Release, /No checker rule change/);
  assert.match(v191Release, /No new rule family/);
  assert.match(v191Release, /No new CLI command/);
  assert.match(v191Release, /No machine-readable JSON schema/);
  assert.match(v191Release, /No command output format change/);
  assert.match(v191Release, /No v1\.10 feature line/);
  assert.match(v191Release, /provider_probe_status=skipped/);
  assert.match(v1xDeltaReceiverMatrix, /v1\.x Delta Receiver Closure Matrix/);
  assert.match(v1xDeltaReceiverMatrix, /delta-handoff\.md -> receiver usage pack/);
  assert.match(v1xDeltaReceiverMatrix, /v1\.0 Delta Handoff/);
  assert.match(v1xDeltaReceiverMatrix, /v1\.9 Delta Receiver Lint Discoverability \/ Adoption/);
  assert.match(v1xDeltaReceiverMatrix, /v1\.9\.1 Final Closure \/ Freeze/);
  assert.match(v1xDeltaReceiverMatrix, /difference_found` remains a completed verification result/);
  assert.match(v1xDeltaReceiverMatrix, /Historical `commits_in_range` drift remains non-blocking/);
  assert.match(v1xDeltaReceiverMatrix, /provider_probe_status=skipped/);
  assert.match(v1xDeltaReceiverMatrix, /No provider request/);
  assert.match(v1xDeltaReceiverMatrix, /No checker rule change/);
  assert.match(v1xDeltaReceiverMatrix, /No new rule family/);
  assert.match(spec, /basebrief-delta-baseline-v1/);
  assert.match(spec, /needs-review/);
  assert.match(dogfooding, /handoff_acceptance: pass/);
  assert.match(baselineAdvanceDogfooding, /Delta Handoff Baseline-Advance Dogfooding v1\.0/);
  assert.match(baselineAdvanceDogfooding, /delta --advance-baseline/);
  assert.match(baselineAdvanceDogfooding, /First run wrote local baseline/);
  assert.match(baselineAdvanceDogfooding, /Second run no longer reported `baseline_source: missing`/);
  assert.match(baselineAdvanceDogfooding, /basebrief-project-state-v1/);
  assert.match(baselineAdvanceDogfooding, /handoff_acceptance: pass/);
  assert.match(baselineAdvanceDogfooding, /provider_probe_status=skipped/);
  assert.match(receiverAcceptanceDogfooding, /Delta Receiver Acceptance Dogfooding v1\.1/);
  assert.match(receiverAcceptanceDogfooding, /receiver_task_status/);
  assert.match(receiverAcceptanceDogfooding, /repository_state_status/);
  assert.match(receiverAcceptanceDogfooding, /handoff_acceptance/);
  assert.match(receiverAcceptanceDogfooding, /blocking_or_repair_notes/);
  assert.match(receiverAcceptanceDogfooding, /current_goal/);
  assert.match(receiverAcceptanceDogfooding, /live_repo_state/);
  assert.match(receiverAcceptanceDogfooding, /inherited_fact_differences/);
  assert.match(receiverAcceptanceDogfooding, /hard_boundaries/);
  assert.match(receiverAcceptanceDogfooding, /next_narrow_slice/);
  assert.match(receiverAcceptanceDogfooding, /live repository state/);
  assert.match(receiverAcceptanceDogfooding, /inherited handoff facts/);
  assert.match(receiverAcceptanceDogfooding, /receiver-window rechecks/);
  assert.match(receiverAcceptanceDogfooding, /difference_found/);
  assert.match(receiverAcceptanceDogfooding, /Local Dry-Run Result/);
  assert.match(receiverAcceptanceDogfooding, /handoff_acceptance: difference_found/);
  assert.match(receiverAcceptanceDogfooding, /handoff_acceptance: pass/);
  assert(
    receiverAcceptanceDogfooding.indexOf("handoff_acceptance: difference_found") <
    receiverAcceptanceDogfooding.indexOf("handoff_acceptance: pass")
  );
  assert.match(receiverAcceptanceDogfooding, /commits_in_range: 3/);
  assert.match(receiverAcceptanceDogfooding, /historical count drift/);
  assert.match(receiverAcceptanceDogfooding, /should not\s+treat an explainable historical count drift as blocking/);
  assert.match(receiverAcceptanceDogfooding, /branch, HEAD, and worktree facts/);
  assert.match(receiverAcceptanceDogfooding, /worktreeChangedFiles: \[\]/);
  assert.match(receiverAcceptanceDogfooding, /no baseline advance/);
  assert.match(receiverAcceptanceDogfooding, /No provider request/);
  assert.match(receiverAcceptanceDogfooding, /No runtime integration/);
  assert.match(receiverAcceptanceDogfooding, /No plugin, MCP, IDE/);
  assert.match(receiverAcceptanceDogfooding, /No schema-v2 work/);
  assert.match(receiverAcceptanceDogfooding, /provider_probe_status=skipped/);
  assert.match(receiverReportKitDogfooding, /Delta Receiver Report Kit Dogfooding v1\.2/);
  assert.match(receiverReportKitDogfooding, /receiver_task_status/);
  assert.match(receiverReportKitDogfooding, /repository_state_status/);
  assert.match(receiverReportKitDogfooding, /handoff_acceptance/);
  assert.match(receiverReportKitDogfooding, /blocking_or_repair_notes/);
  assert.match(receiverReportKitDogfooding, /current_goal/);
  assert.match(receiverReportKitDogfooding, /live_repo_state/);
  assert.match(receiverReportKitDogfooding, /inherited_fact_differences/);
  assert.match(receiverReportKitDogfooding, /hard_boundaries/);
  assert.match(receiverReportKitDogfooding, /next_narrow_slice/);
  assert.match(receiverReportKitDogfooding, /source-window inherited facts/);
  assert.match(receiverReportKitDogfooding, /receiver-window rechecks/);
  assert.match(receiverReportKitDogfooding, /blocking differences versus non-blocking differences/);
  assert.match(receiverReportKitDogfooding, /examples\/receiver\/delta-report-pass\/README\.md/);
  assert.match(receiverReportKitDogfooding, /examples\/receiver\/delta-report-difference-found\/README\.md/);
  assert.match(receiverReportKitDogfooding, /handoff_acceptance: pass/);
  assert.match(receiverReportKitDogfooding, /handoff_acceptance: difference_found/);
  assert.match(receiverReportKitDogfooding, /It is not an agent failure/);
  assert.match(receiverReportKitDogfooding, /handoff_acceptance: blocked/);
  assert.match(receiverReportKitDogfooding, /historical count drift/);
  assert.match(receiverReportKitDogfooding, /No provider request/);
  assert.match(receiverReportKitDogfooding, /No runtime integration/);
  assert.match(receiverReportKitDogfooding, /No plugin, MCP, IDE/);
  assert.match(receiverReportKitDogfooding, /No schema-v2 work/);
  assert.match(receiverReportKitDogfooding, /No new CLI command/);
  assert.match(receiverReportKitDogfooding, /No machine-readable JSON schema/);
  assert.match(receiverReportKitDogfooding, /No command output format change/);
  assert.match(receiverReportKitDogfooding, /provider_probe_status=skipped/);
  assert.match(receiverUsagePackDoc, /Delta Receiver Usage Pack/);
  assert.match(receiverUsagePackDoc, /Minimum Read Order/);
  assert.match(receiverUsagePackDoc, /Decision Matrix/);
  assert.match(receiverUsagePackDoc, /pass\/fail/);
  assert.match(receiverUsagePackDoc, /difference_found/);
  assert.match(receiverUsagePackDoc, /blocked/);
  assert.match(receiverUsagePackDoc, /Human-facing `fail` can coexist with machine `difference_found`/);
  assert.match(receiverUsagePackDoc, /source-window inherited facts/);
  assert.match(receiverUsagePackDoc, /live repo facts/);
  assert.match(receiverUsagePackDoc, /receiver-window rechecks/);
  assert.match(receiverUsagePackDoc, /Historical `commits_in_range` drift remains non-blocking/);
  assert.match(receiverUsagePackDoc, /docs\/dogfooding\/delta-receiver-report-kit-v1\.2\.md/);
  assert.match(receiverUsagePackDoc, /examples\/golden-path\/first-pass-receiver-report\.md/);
  assert.match(receiverUsagePackDoc, /examples\/golden-path\/follow-up-receiver-report\.md/);
  assert.match(receiverUsagePackDoc, /No provider request/);
  assert.match(receiverUsagePackDoc, /No runtime integration/);
  assert.match(receiverUsagePackDoc, /No plugin, MCP, IDE/);
  assert.match(receiverUsagePackDoc, /No schema-v2 work/);
  assert.match(receiverUsagePackDoc, /No new CLI command/);
  assert.match(receiverUsagePackDoc, /No machine-readable JSON schema/);
  assert.match(receiverUsagePackDoc, /No command output format change/);
  assert.match(receiverUsagePackDoc, /provider_probe_status=skipped/);
  assert.match(receiverUsagePackReadme, /Receiver Usage Pack Example Router/);
  assert.match(receiverUsagePackReadme, /\.\.\/delta-report-pass\/README\.md/);
  assert.match(receiverUsagePackReadme, /\.\.\/delta-report-difference-found\/README\.md/);
  assert.match(receiverUsagePackReadme, /\.\.\/blocked\/README\.md/);
  assert.match(receiverUsagePackReadme, /\.\.\/language-routing\/README\.md/);
  assert.match(receiverUsagePackReadme, /\.\.\/\.\.\/golden-path\/first-pass-receiver-report\.md/);
  assert.match(receiverUsagePackReadme, /\.\.\/\.\.\/golden-path\/follow-up-receiver-report\.md/);
  assert.match(receiverUsagePackReadme, /starter-report-outline\.md/);
  assert.match(receiverUsagePackReadme, /difference_found/);
  assert.match(receiverUsagePackReadme, /historical `commits_in_range` drift remains non-blocking/);
  assert.match(receiverUsagePackReadme, /pass\/fail/);
  assert.match(receiverUsagePackReadme, /provider_probe_status=skipped/);
  assert.match(receiverUsagePackOutline, /source-window inherited facts/);
  assert.match(receiverUsagePackOutline, /live_repo_state/);
  assert.match(receiverUsagePackOutline, /receiver_window_rechecks/);
  assert.match(receiverUsagePackOutline, /inherited_fact_differences/);
  assert.match(receiverUsagePackOutline, /hard_boundaries/);
  assert.match(receiverUsagePackOutline, /next_narrow_slice/);
  assert.match(receiverUsagePackOutline, /wait for user confirmation/);
  assert.match(receiverUsagePackOutline, /declared_checks_status/);
  assert.match(receiverUsagePackOutline, /difference_found/);
  assert.match(receiverUsagePackOutline, /non-blocking/);
  assert.match(receiverUsagePackDoc, /examples\/receiver\/lint\//);
  assert.match(receiverUsagePackDoc, /examples\/receiver\/lint\/repair\//);
  assert.match(receiverUsagePackDoc, /delta-receiver-lint-dogfooding-v1\.8\.md/);
  assert.match(receiverUsagePackDoc, /Fixture To Repair To Example Path/);
  assert.match(receiverUsagePackDoc, /docs\/releases\/v1\.9\.0-plan\.md/);
  assert.match(receiverUsagePackReadme, /If A Receiver Lint Finding Sent You Here/);
  assert.match(receiverUsagePackReadme, /\.\.\/lint\/README\.md/);
  assert.match(receiverUsagePackReadme, /\.\.\/lint\/repair\/README\.md/);
  assert.match(receiverLintReadme, /clean-pass-receiver-report\.md/);
  assert.match(receiverLintReadme, /receiver\.missing-report-section/);
  assert.match(receiverLintReadme, /receiver\.invalid-result-consistency/);
  assert.match(receiverLintReadme, /receiver\.missing-drift-semantics/);
  assert.match(receiverLintReadme, /Public Read Order/);
  assert.match(receiverLintReadme, /\.\.\/usage-pack\/README\.md/);
  assert.match(receiverLintRepairReadme, /fixed-delta-receiver-report\.md/);
  assert.match(receiverLintRepairReadme, /fixed-result\.json/);
  assert.match(receiverLintRepairReadme, /receiver\.missing-human-anchor/);
  assert.match(receiverLintRepairReadme, /After Repair/);
  assert.match(receiverLintRepairReadme, /\.\.\/\.\.\/delta-report-difference-found\/README\.md/);
  assert.match(receiverLintDogfooding, /Delta Receiver Lint Dogfooding v1\.8/);
  assert.match(receiverLintDogfooding, /provider_request_performed: false/);
  assert.match(receiverLintDogfooding, /raw_private_output_copied: false/);
  assert.match(receiverLintDogfooding, /fixed-delta-receiver-report\.md/);
  assert.match(receiverLintDogfooding, /receiver\.missing-report-section/);
  for (const reportExample of [deltaReportPass, deltaReportDifference]) {
    assert.match(reportExample, /receiver_task_status/);
    assert.match(reportExample, /repository_state_status/);
    assert.match(reportExample, /handoff_acceptance/);
    assert.match(reportExample, /blocking_or_repair_notes/);
    assert.match(reportExample, /current_goal/);
    assert.match(reportExample, /live_repo_state/);
    assert.match(reportExample, /inherited_fact_differences/);
    assert.match(reportExample, /hard_boundaries/);
    assert.match(reportExample, /next_narrow_slice/);
    assert.match(reportExample, /No provider request/);
    assert.match(reportExample, /No runtime integration/);
    assert.match(reportExample, /No plugin, MCP, IDE/);
    assert.match(reportExample, /No schema-v2 work/);
    assert.match(reportExample, /provider_probe_status=skipped/);
  }
  assert.match(deltaReportPass, /Delta Receiver Report Example: pass/);
  assert.match(deltaReportPass, /repository_state_status: match/);
  assert.match(deltaReportPass, /handoff_acceptance: pass/);
  assert.match(deltaReportPass, /Historical dry-run `commits_in_range` values may differ/);
  assert.match(deltaReportDifference, /Delta Receiver Report Example: difference_found/);
  assert.match(deltaReportDifference, /repository_state_status: difference_found/);
  assert.match(deltaReportDifference, /handoff_acceptance: difference_found/);
  assert.match(deltaReportDifference, /does not mean the agent failed/);
  assert.match(deltaReportDifference, /blocking: yes/);
  assert.match(example, /schemaVersion: basebrief-delta-handoff-v1/);
  assert.match(example, /## How To Read This Delta/);
  assert.match(example, /baseline_source: \.basebrief\/delta-baseline\.json/);
  assert.match(example, /commits_in_range: 0/);
  assert.match(example, /stateDiff\.status: unchanged/);
  assert.match(example, /reviewed Project State matches the delta baseline/);
  assert.match(example, /Worktree Changed Files/);

  for (const relativePath of [
    "README.md",
    "README.en.md",
    "docs/checks.md",
    "docs/index.md",
    "docs/receiver-check.md",
    "docs/testing.md",
    "docs/roadmap/basebrief-long-term-baseline.md",
    "docs/releases/v1.0.0.md",
    "docs/releases/v1.0.0-plan.md",
    "docs/releases/v1.0.0-rc-review.md",
    "docs/releases/v1.0.1.md",
    "docs/releases/v1.1.0.md",
    "docs/releases/v1.1.0-plan.md",
    "docs/releases/v1.2.0.md",
    "docs/releases/v1.2.0-plan.md",
    "docs/releases/v1.3.0.md",
    "docs/releases/v1.3.0-plan.md",
    "docs/releases/v1.4.0.md",
    "docs/releases/v1.4.0-plan.md",
    "docs/releases/v1.5.0.md",
    "docs/releases/v1.5.0-plan.md",
    "docs/releases/v1.6.0.md",
    "docs/releases/v1.6.0-plan.md",
    "docs/releases/v1.7.0.md",
    "docs/releases/v1.7.0-plan.md",
    "docs/releases/v1.8.0.md",
    "docs/releases/v1.8.0-plan.md",
    "docs/releases/v1.9.0.md",
    "docs/releases/v1.9.0-plan.md",
    "docs/releases/v1.9.1.md",
    "docs/receiver-usage-pack.md",
    "docs/testing-v1.x-delta-receiver-closure-matrix.md",
    "docs/specs/delta-handoff.md",
    "docs/dogfooding/delta-handoff-fresh-receiver-v1.0.md",
    "docs/dogfooding/delta-handoff-baseline-advance-v1.0.md",
    "docs/dogfooding/delta-receiver-acceptance-v1.1.md",
    "docs/dogfooding/delta-receiver-report-kit-v1.2.md",
    "docs/dogfooding/delta-receiver-lint-dogfooding-v1.8.md",
    "examples/delta-handoff.md",
    "examples/receiver/blocked",
    "examples/receiver/difference-found",
    "examples/receiver/delta-report-pass",
    "examples/receiver/delta-report-difference-found",
    "examples/receiver/language-routing",
    "examples/receiver/usage-pack",
    "examples/receiver/lint/README.md",
    "examples/receiver/lint/clean-pass-receiver-report.md",
    "examples/receiver/lint/repair/README.md",
    "examples/receiver/lint/repair/fixed-delta-receiver-report.md",
    "examples/receiver/lint/repair/fixed-starter-report.md",
    "examples/receiver/lint/repair/fixed-result.json",
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

test("artifact checker passes clean receiver markdown and result examples", () => {
  for (const relativePath of [
    "examples/receiver/delta-report-pass/README.md",
    "examples/receiver/delta-report-difference-found/README.md",
    "examples/golden-path/first-pass-receiver-report.md",
    "examples/golden-path/follow-up-receiver-report.md",
    "examples/receiver/usage-pack/starter-report-outline.md",
    "examples/receiver/language-routing/receiver-report.md",
    "examples/receiver/difference-found/receiver-check-result.json",
    "examples/receiver/blocked/blocked-result.json",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
    assert.equal(result.warningCount, 0, relativePath);
  }
});

test("artifact checker reports receiver contract errors for explicit receiver shapes", () => withTempDir((tempDir) => {
  const receiverDir = path.join(tempDir, "receiver");
  const goldenPathDir = path.join(tempDir, "golden-path");
  fs.mkdirSync(receiverDir, { recursive: true });
  fs.mkdirSync(goldenPathDir, { recursive: true });

  const deltaMissingLiveRepoStatePath = path.join(receiverDir, "delta-receiver-report.md");
  const starterMissingPassFailPath = path.join(goldenPathDir, "first-pass-receiver-report.md");
  const starterMissingWaitAnchorPath = path.join(goldenPathDir, "follow-up-receiver-report.md");
  const starterMissingRechecksPath = path.join(goldenPathDir, "starter-report-outline.md");
  const jsonMissingDeclaredChecksPath = path.join(receiverDir, "receiver-check-result-missing-declared.json");
  const jsonInvalidBlockedComboPath = path.join(receiverDir, "receiver-check-result-invalid-blocked.json");

  fs.writeFileSync(
    deltaMissingLiveRepoStatePath,
    readText("examples/receiver/delta-report-pass/README.md").replace(/live_repo_state/g, "live_repo_state_removed"),
    "utf8",
  );
  fs.writeFileSync(
    starterMissingPassFailPath,
    readText("examples/golden-path/first-pass-receiver-report.md").replace(/pass\/fail/g, "result-anchor"),
    "utf8",
  );
  fs.writeFileSync(
    starterMissingWaitAnchorPath,
    readText("examples/golden-path/follow-up-receiver-report.md").replace(/wait for user confirmation/g, "wait for confirmation"),
    "utf8",
  );
  fs.writeFileSync(
    starterMissingRechecksPath,
    readText("examples/receiver/usage-pack/starter-report-outline.md").replace(/receiver_window_rechecks/g, "receiver_window_rechecks_removed"),
    "utf8",
  );
  fs.writeFileSync(
    jsonMissingDeclaredChecksPath,
    `${JSON.stringify({
      schemaVersion: "basebrief-receiver-check-result-v1",
      receiver_task_status: "completed",
      repository_state_status: "difference_found",
      handoff_acceptance: "difference_found",
    }, null, 2)}\n`,
    "utf8",
  );
  fs.writeFileSync(
    jsonInvalidBlockedComboPath,
    `${JSON.stringify({
      ...readJson("examples/receiver/blocked/blocked-result.json"),
      receiver_task_status: "completed",
    }, null, 2)}\n`,
    "utf8",
  );

  const deltaResult = checkArtifacts({ inputPath: deltaMissingLiveRepoStatePath });
  assert.equal(deltaResult.status, "failed");
  assert(deltaResult.findings.some((finding) => finding.ruleId === "receiver.missing-report-section"));

  const missingPassFailResult = checkArtifacts({ inputPath: starterMissingPassFailPath });
  assert.equal(missingPassFailResult.status, "failed");
  assert(missingPassFailResult.findings.some((finding) => finding.ruleId === "receiver.missing-human-anchor"));

  const missingWaitResult = checkArtifacts({ inputPath: starterMissingWaitAnchorPath });
  assert.equal(missingWaitResult.status, "failed");
  assert(missingWaitResult.findings.some((finding) => finding.ruleId === "receiver.missing-human-anchor"));

  const missingRechecksResult = checkArtifacts({ inputPath: starterMissingRechecksPath });
  assert.equal(missingRechecksResult.status, "failed");
  assert(missingRechecksResult.findings.some((finding) => finding.ruleId === "receiver.missing-fact-layer"));

  const missingDeclaredChecksResult = checkArtifacts({ inputPath: jsonMissingDeclaredChecksPath });
  assert.equal(missingDeclaredChecksResult.status, "failed");
  assert(missingDeclaredChecksResult.findings.some((finding) => finding.ruleId === "receiver.missing-machine-field"));

  const invalidBlockedComboResult = checkArtifacts({ inputPath: jsonInvalidBlockedComboPath });
  assert.equal(invalidBlockedComboResult.status, "failed");
  assert(invalidBlockedComboResult.findings.some((finding) => finding.ruleId === "receiver.invalid-result-consistency"));
}));

test("artifact checker emits receiver warnings without failing explicit receiver reports", () => withTempDir((tempDir) => {
  const receiverDir = path.join(tempDir, "receiver");
  const goldenPathDir = path.join(tempDir, "golden-path");
  fs.mkdirSync(receiverDir, { recursive: true });
  fs.mkdirSync(goldenPathDir, { recursive: true });

  const differenceWarningPath = path.join(receiverDir, "delta-difference-receiver-report.md");
  const driftWarningPath = path.join(goldenPathDir, "starter-report-outline.md");

  fs.writeFileSync(
    differenceWarningPath,
    readText("examples/receiver/delta-report-difference-found/README.md").replace(/It does not mean the agent failed\.\s*/g, ""),
    "utf8",
  );
  fs.writeFileSync(
    driftWarningPath,
    readText("examples/receiver/usage-pack/starter-report-outline.md").replace(/non-blocking/g, "documented"),
    "utf8",
  );

  const differenceWarningResult = checkArtifacts({ inputPath: differenceWarningPath });
  assert.equal(differenceWarningResult.status, "passed");
  assert.equal(differenceWarningResult.errorCount, 0);
  assert.equal(differenceWarningResult.warningCount, 1);
  assert(differenceWarningResult.findings.some((finding) => finding.ruleId === "receiver.missing-difference-semantics"));

  const driftWarningResult = checkArtifacts({ inputPath: driftWarningPath });
  assert.equal(driftWarningResult.status, "passed");
  assert.equal(driftWarningResult.errorCount, 0);
  assert.equal(driftWarningResult.warningCount, 1);
  assert(driftWarningResult.findings.some((finding) => finding.ruleId === "receiver.missing-drift-semantics"));
}));

test("receiver lint fixture pack documents expected pass, error, and warning behavior", () => {
  const cases = [
    {
      relativePath: "examples/receiver/lint/clean-pass-receiver-report.md",
      status: "passed",
      errorCount: 0,
      warningCount: 0,
      ruleId: null,
    },
    {
      relativePath: "examples/receiver/lint/delta-missing-section-receiver-report.md",
      status: "failed",
      errorCount: 1,
      warningCount: 0,
      ruleId: "receiver.missing-report-section",
    },
    {
      relativePath: "examples/receiver/lint/starter-missing-pass-fail-starter-report.md",
      status: "failed",
      errorCount: 1,
      warningCount: 0,
      ruleId: "receiver.missing-human-anchor",
    },
    {
      relativePath: "examples/receiver/lint/starter-missing-wait-starter-report.md",
      status: "failed",
      errorCount: 1,
      warningCount: 0,
      ruleId: "receiver.missing-human-anchor",
    },
    {
      relativePath: "examples/receiver/lint/starter-missing-fact-layer-starter-report.md",
      status: "failed",
      errorCount: 1,
      warningCount: 0,
      ruleId: "receiver.missing-fact-layer",
    },
    {
      relativePath: "examples/receiver/lint/json-invalid-result-consistency.json",
      status: "failed",
      errorCount: 1,
      warningCount: 0,
      ruleId: "receiver.invalid-result-consistency",
    },
    {
      relativePath: "examples/receiver/lint/difference-found-warning-receiver-report.md",
      status: "passed",
      errorCount: 0,
      warningCount: 1,
      ruleId: "receiver.missing-difference-semantics",
    },
    {
      relativePath: "examples/receiver/lint/historical-drift-warning-starter-report.md",
      status: "passed",
      errorCount: 0,
      warningCount: 1,
      ruleId: "receiver.missing-drift-semantics",
    },
  ];

  for (const testCase of cases) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, testCase.relativePath) });
    assert.equal(result.status, testCase.status, testCase.relativePath);
    assert.equal(result.errorCount, testCase.errorCount, testCase.relativePath);
    assert.equal(result.warningCount, testCase.warningCount, testCase.relativePath);
    if (testCase.ruleId) {
      assert(result.findings.some((finding) => finding.ruleId === testCase.ruleId), testCase.relativePath);
    } else {
      assert.equal(result.findings.length, 0, testCase.relativePath);
    }
  }
});

test("receiver lint repair pack provides clean fixed references", () => {
  for (const relativePath of [
    "examples/receiver/lint/repair/fixed-delta-receiver-report.md",
    "examples/receiver/lint/repair/fixed-starter-report.md",
    "examples/receiver/lint/repair/fixed-result.json",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
    assert.equal(result.warningCount, 0, relativePath);
    assert.equal(result.findings.length, 0, relativePath);
  }
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
  assert.match(formatHuman({
    command: "sidecar-build",
    outputDir: "tests/outputs/private/sidecar-generic",
    schemaVersion: SIDECAR_SCHEMA_VERSION,
    target: "generic",
    projectStateSchemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    outputFiles: {
      newWindowStarter: "tests/outputs/private/sidecar-generic/new-window-starter.md",
    },
  }), /new_window_starter=tests\/outputs\/private\/sidecar-generic\/new-window-starter\.md/);
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

function createSidecarFixture(tempDir, target = "generic", options = {}) {
  const repoDir = createReceiverCheckRepo(tempDir);
  const { draftPath } = createGuidedDraft(tempDir, {
    guidedAnswers: {
      risk_boundaries: [
        "Do not call providers.",
        "Do not write secrets or raw private output.",
      ].join("\n"),
      ...options.guidedAnswers,
    },
  });
  const readyPath = path.join(tempDir, `${target}-receiver-ready.md`);
  runReviewDraft({ draftPath, outputPath: readyPath });
  runStateInit({ repoPath: repoDir, sourcePath: readyPath });
  const outputDir = path.join(tempDir, `${target}-sidecar`);
  buildSidecarBundle({ repoPath: repoDir, target, outputDir, starterLanguage: options.starterLanguage });
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
  const starter = fs.readFileSync(path.join(outputDir, "new-window-starter.md"), "utf8");

  assert.equal(result.command, "sidecar-build");
  assert.equal(result.schemaVersion, SIDECAR_SCHEMA_VERSION);
  assert.equal(result.projectStateSchemaVersion, PROJECT_STATE_SCHEMA_VERSION);
  assert.equal(result.target, "generic");
  assert.equal(result.starterLanguage, "en");
  assert.equal(manifest.schemaVersion, SIDECAR_SCHEMA_VERSION);
  assert.equal(manifest.projectStateSchemaVersion, PROJECT_STATE_SCHEMA_VERSION);
  assert.equal(manifest.output_files.handoff, "handoff.md");
  assert.equal(manifest.output_files.newWindowStarter, "new-window-starter.md");
  assert.equal(result.outputFiles.newWindowStarter, path.join(outputDir, "new-window-starter.md"));
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
  assert.match(starter, /Target repository/);
  assert.match(starter, /Sidecar bundle/);
  assert.match(starter, /current_goal/);
  assert.match(starter, /receiver_entry_task/);
  assert.match(starter, /pass\/fail/);
  assert.match(starter, /Wait for user confirmation/);
  assert.match(starter, /No provider request/);
  assert.match(starter, /No raw private output/);
  assert.match(starter, /No runtime integration/);
  assert.match(starter, /No schema change/);
  assert.match(starter, /No auto-advance/);
  assert(stateSummary.risk_boundaries.length >= 2);
  assert.doesNotMatch(JSON.stringify(manifest), /[A-Z]:\\/);
  assert.doesNotMatch(JSON.stringify(stateSummary), /[A-Z]:\\/);
  assert.equal(checkArtifacts({ inputPath: outputDir }).status, "passed");
}));

test("Sidecar build localizes copyable new-window starter languages", () => withTempDir((tempDir) => {
  const zh = createSidecarFixture(path.join(tempDir, "zh"), "generic", { starterLanguage: "zh-CN" });
  const en = createSidecarFixture(path.join(tempDir, "en"), "generic", { starterLanguage: "en" });
  const ja = createSidecarFixture(path.join(tempDir, "ja"), "generic", { starterLanguage: "ja" });

  const zhStarter = fs.readFileSync(path.join(zh.outputDir, "new-window-starter.md"), "utf8");
  const enStarter = fs.readFileSync(path.join(en.outputDir, "new-window-starter.md"), "utf8");
  const jaStarter = fs.readFileSync(path.join(ja.outputDir, "new-window-starter.md"), "utf8");

  assert.match(zhStarter, /# BaseBrief 新窗口开场白/);
  assert.match(zhStarter, /目标仓库/);
  assert.match(zhStarter, /Wait for user confirmation/);
  assert.match(zhStarter, /pass\/fail/);
  assert.match(zhStarter, /No provider request/);
  assert.match(zhStarter, /current_goal/);
  assert.match(enStarter, /# BaseBrief New Window Starter/);
  assert.match(enStarter, /Target repository/);
  assert.match(enStarter, /pass\/fail/);
  assert.match(jaStarter, /# BaseBrief 新規ウィンドウ開始文/);
  assert.match(jaStarter, /対象リポジトリ/);
  assert.match(jaStarter, /pass\/fail/);
  assert.match(jaStarter, /No raw private output/);
  assert.match(jaStarter, /receiver_entry_task/);

  assert.equal(checkSidecarBundle({ inputPath: zh.outputDir }).check_status, "passed");
  assert.equal(checkSidecarBundle({ inputPath: en.outputDir }).check_status, "passed");
  assert.equal(checkSidecarBundle({ inputPath: ja.outputDir }).check_status, "passed");
}));

test("Sidecar build auto-detects starter language with zh-CN fallback", () => withTempDir((tempDir) => {
  assert.equal(detectStarterLanguage({
    handoff: {
      current_goal: "继续验证 BaseBrief 新窗口开场白。",
      receiver_entry_task: "读取 sidecar bundle，然后等待用户确认。",
      risk_boundaries: "不要调用 provider。",
    },
  }), "zh-CN");
  assert.equal(detectStarterLanguage({
    handoff: {
      current_goal: "Validate the copyable sidecar starter in a fresh receiver window.",
      receiver_entry_task: "Read the sidecar bundle and wait for user confirmation.",
      risk_boundaries: "Do not call providers.",
    },
  }), "en");
  assert.equal(detectStarterLanguage({
    handoff: {
      current_goal: "新しい受信ウィンドウで BaseBrief の開始文を確認する。",
      receiver_entry_task: "sidecar bundle を読んで、ユーザー確認を待つ。",
      risk_boundaries: "provider request を行わない。",
    },
  }), "ja");
  assert.equal(detectStarterLanguage({
    handoff: {
      current_goal: "Fix BaseBrief 新窗口 starter language routing.",
      receiver_entry_task: "Read sidecar bundle 然后等待确认。",
      risk_boundaries: "No provider request.",
    },
  }), "zh-CN");

  const autoZh = createSidecarFixture(path.join(tempDir, "auto-zh"), "generic", {
    guidedAnswers: {
      current_goal: "继续验证 BaseBrief 新窗口开场白。",
      receiver_entry_task: "读取 sidecar bundle，然后等待用户确认。",
      risk_boundaries: "不要调用 provider。\n不要暴露原始私有输出。",
    },
  });
  const starter = fs.readFileSync(path.join(autoZh.outputDir, "new-window-starter.md"), "utf8");
  assert.match(starter, /# BaseBrief 新窗口开场白/);
  assert.equal(checkSidecarBundle({ inputPath: autoZh.outputDir }).check_status, "passed");
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
  const starter = fs.readFileSync(path.join(outputDir, "new-window-starter.md"), "utf8");
  const risks = fs.readFileSync(path.join(outputDir, "risk-boundaries.md"), "utf8");

  assert.equal(result.target, "openclaw");
  assert.equal(result.starterLanguage, "en");
  assert.match(prompt, /OpenClaw\/Hermes runtime/);
  assert.match(prompt, /profile\/config\/memory\/workspace/);
  assert.match(starter, /OpenClaw\/Hermes runtime/);
  assert.match(starter, /profile\/config\/memory\/workspace/);
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
  assert.throws(() => buildSidecarBundle({ repoPath: repoDir, starterLanguage: "fr" }), /Unsupported starter language/);

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

test("Sidecar check validates copyable new-window starter while keeping old bundles compatible", () => withTempDir((tempDir) => {
  const { outputDir: missingDir } = createSidecarFixture(path.join(tempDir, "missing"), "generic");
  fs.rmSync(path.join(missingDir, "new-window-starter.md"));
  let result = checkSidecarBundle({ inputPath: missingDir });
  assert.equal(result.check_status, "failed");
  assert(result.errors.some((error) => error.includes("Missing declared sidecar file: new-window-starter.md")));

  const { outputDir: weakDir } = createSidecarFixture(path.join(tempDir, "weak"), "generic");
  const starterPath = path.join(weakDir, "new-window-starter.md");
  const weakStarter = fs.readFileSync(starterPath, "utf8")
    .replace(/Target repository/gi, "Workspace")
    .replace(/Sidecar bundle/gi, "Bundle")
    .replace(/directory that contains this `new-window-starter\.md` file/gi, "nearby files")
    .replace(/Wait for user confirmation/gi, "Continue after review")
    .replace(/pass\/fail/gi, "result")
    .replace(/No provider request/gi, "Provider requests are not covered")
    .replace(/No runtime integration/gi, "Runtime details are not covered")
    .replace(/No schema change/gi, "Schema details are not covered")
    .replace(/No auto-advance/gi, "Advance after review");
  fs.writeFileSync(starterPath, weakStarter, "utf8");
  result = checkSidecarBundle({ inputPath: weakDir });
  assert.equal(result.check_status, "failed");
  assert(result.errors.some((error) => error.includes("target repository cue")));
  assert(result.errors.some((error) => error.includes("sidecar bundle path instruction")));
  assert(result.errors.some((error) => error.includes("waiting for user confirmation")));
  assert(result.errors.some((error) => error.includes("pass/fail")));
  assert(result.errors.some((error) => error.includes("No provider request")));
  assert(result.errors.some((error) => error.includes("No runtime integration")));
  assert(result.errors.some((error) => error.includes("No schema change")));
  assert(result.errors.some((error) => error.includes("No auto-advance")));

  const { outputDir: oldDir } = createSidecarFixture(path.join(tempDir, "old"), "generic");
  const manifestPath = path.join(oldDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  delete manifest.output_files.newWindowStarter;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.rmSync(path.join(oldDir, "new-window-starter.md"));
  result = checkSidecarBundle({ inputPath: oldDir });
  assert.equal(result.check_status, "passed");
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
    assert.equal(sidecarResult.outputFiles.newWindowStarter.startsWith("tests"), true);
    assert.equal(sidecarResult.manifest.output_files.newWindowStarter, "new-window-starter.md");
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

test("Delta Handoff writes reviewable delta output and advances local baseline only when requested", () => withTempDir((tempDir) => {
  const repoDir = path.join(repoRoot, "tests", "outputs", "private", `delta-repo-${Date.now()}`);
  const sourceDir = path.join(repoRoot, "tests", "outputs", "private", `delta-source-${Date.now()}`);
  const outputDir = path.join(repoRoot, "tests", "outputs", "private", `delta-output-${Date.now()}`);
  const cliOutputDir = path.join(repoRoot, "tests", "outputs", "private", `delta-cli-${Date.now()}`);
  try {
    fs.mkdirSync(repoDir, { recursive: true });
    fs.mkdirSync(sourceDir, { recursive: true });
    git(repoDir, ["init"]);
    git(repoDir, ["config", "user.email", "basebrief@example.invalid"]);
    git(repoDir, ["config", "user.name", "BaseBrief Delta Test"]);
    fs.writeFileSync(path.join(repoDir, "safe.js"), "const safe = true;\n", "utf8");
    git(repoDir, ["add", "."]);
    git(repoDir, ["commit", "-m", "initial fixture"]);
    const firstHead = git(repoDir, ["rev-parse", "HEAD"]);

    const { draftPath } = createGuidedDraft(tempDir);
    const readyPath = path.join(sourceDir, "receiver-ready.md");
    runReviewDraft({ draftPath, outputPath: readyPath });
    runStateInit({ repoPath: repoDir, sourcePath: readyPath });

    fs.writeFileSync(path.join(repoDir, "notes.md"), "local delta note\n", "utf8");
    const initial = runDelta({ repoPath: repoDir, outputDir });
    const initialContent = fs.readFileSync(path.join(outputDir, "delta-handoff.md"), "utf8");
    assert.equal(initial.command, "delta");
    assert.equal(initial.schemaVersion, DELTA_HANDOFF_SCHEMA_VERSION);
    assert.equal(initial.baseline.exists, false);
    assert.equal(initial.baseline.advanced, false);
    assert.equal(fs.existsSync(path.join(repoDir, ".basebrief", "delta-baseline.json")), false);
    assert.equal(initial.stateDiff.status, "no_previous_baseline");
    assert(initial.git.worktreeChangedFiles.includes("notes.md"));
    assert.match(initialContent, /review_status=reviewed/);
    assert.match(initialContent, /review_status=needs-review/);
    assert.match(initialContent, /schemaVersion: basebrief-delta-handoff-v1/);
    assert.match(initialContent, /## How To Read This Delta/);
    assert.match(initialContent, /baseline_source: missing/);
    assert.match(initialContent, /no-baseline\.\.HEAD/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(repoDir, ".basebrief", "state.json"), "utf8")).schemaVersion, PROJECT_STATE_SCHEMA_VERSION);

    git(repoDir, ["add", "notes.md"]);
    git(repoDir, ["commit", "-m", "add delta note"]);
    const advanced = commandDelta({ repo: repoDir, "output-dir": outputDir, "advance-baseline": true });
    assert.equal(advanced.baseline.advanced, true);
    const baselineInfo = readDeltaBaseline(repoDir);
    assert.equal(baselineInfo.exists, true);
    assert.equal(baselineInfo.baseline.schemaVersion, DELTA_BASELINE_SCHEMA_VERSION);
    assert.equal(baselineInfo.baseline.repo.head, git(repoDir, ["rev-parse", "HEAD"]));
    assert.equal(baselineInfo.baseline.state.updated_at, JSON.parse(fs.readFileSync(path.join(repoDir, ".basebrief", "state.json"), "utf8")).updated_at);

    fs.writeFileSync(path.join(repoDir, "followup.md"), "second delta note\n", "utf8");
    git(repoDir, ["add", "followup.md"]);
    git(repoDir, ["commit", "-m", "add followup note"]);
    const followup = runDelta({ repoPath: repoDir, outputDir: cliOutputDir });
    const followupContent = fs.readFileSync(path.join(cliOutputDir, "delta-handoff.md"), "utf8");
    assert.equal(followup.baseline.exists, true);
    assert.equal(followup.git.commitCount, 1);
    assert.deepEqual(followup.git.changedFilesInRange, ["followup.md"]);
    assert.equal(followup.stateDiff.status, "unchanged");
    assert.match(followupContent, /## How To Read This Delta/);
    assert.match(followupContent, /commits_in_range: 1/);
    assert.match(followupContent, /does not mean the worktree is clean/);
    assert.match(followupContent, /stateDiff\.status: unchanged/);
    assert.match(followupContent, /does not mean git or worktree content is unchanged/);

    const explicit = runDelta({ repoPath: repoDir, outputDir: cliOutputDir, since: firstHead });
    assert.equal(explicit.git.commitCount, 2);
    assert(explicit.git.changedFilesInRange.includes("notes.md"));
    assert(explicit.git.changedFilesInRange.includes("followup.md"));

    const cli = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "delta",
      "--repo",
      repoDir,
      "--output-dir",
      cliOutputDir,
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(cli.status, 0, cli.stderr);
    const cliResult = JSON.parse(cli.stdout);
    assert.equal(cliResult.command, "delta");
    assert.equal(cliResult.repo.startsWith("tests"), true);
    assert.equal(cliResult.outputFiles.deltaHandoff.startsWith("tests"), true);
    assert.equal(cliResult.baseline.input.startsWith("tests"), true);
    assert.equal(cliResult.projectState.input.startsWith("tests"), true);
    assert.match(HELP_TEXT, /delta --repo <target-repo> --output-dir <dir>/);
    assert.match(formatHuman(followup), /BaseBrief delta handoff written/);
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
    fs.rmSync(sourceDir, { recursive: true, force: true });
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.rmSync(cliOutputDir, { recursive: true, force: true });
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
  assert.match(nextChatTemplate, /pass\/fail/);
  assert.match(nextChatTemplate, /等待用户确认/);
  assert.match(nextChatTemplate, /receiver_task_status/);
  assert.match(nextChatTemplate, /repository_state_status/);
  assert.match(nextChatTemplate, /declared_checks_status/);
  assert.match(nextChatTemplate, /handoff_acceptance/);
  assert.match(nextChatTemplate, /live_repo_state/);
  assert.match(nextChatTemplate, /inherited_fact_differences/);
  assert.match(nextChatTemplate, /hard_boundaries/);
  assert.match(nextChatTemplate, /next_narrow_slice/);
  assert.match(nextChatTemplate, /source-window inherited facts/);
  assert.match(nextChatTemplate, /receiver-window rechecks/);
  assert.match(nextChatTemplate, /historical drift/);
  assert.match(nextChatTemplate, /difference_found.*不等于 Agent 执行失败/s);
});
