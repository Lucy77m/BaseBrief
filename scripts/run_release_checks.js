#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { routeMode } = require("./mode_router");
const { generateFromObject } = require("./generate_cache_ready_lite");
const { generateCapsuleFromObject } = require("./generate_cache_ready_capsule");
const { generateAnchorFromObject } = require("./generate_cache_ready_anchor");
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

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
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
    "package.json",
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
    "templates/zh-CN/CACHE_READY_CAPSULE_INPUT.json",
    "templates/zh-CN/CACHE_READY_ANCHOR_INPUT.json",
    "templates/zh-CN/CACHE_READY_ANCHOR_PAD_INPUT.json",
    "docs/usage.md",
    "docs/index.md",
    "docs/quickstart-5min.md",
    "docs/known-limitations.md",
    "docs/dogfooding/v0.2.2-first-run-workflow.md",
    "docs/dogfooding/receiver-ready-v1-evidence.md",
    "docs/dogfooding/receiver-friction-log.md",
    "docs/dogfooding/receiver-flow-dogfooding.md",
    "docs/dogfooding/receiver-flow-guided-dogfooding.md",
    "docs/integrations.md",
    "docs/adapters.md",
    "docs/walkthrough.md",
    "docs/mode-selection.md",
    "docs/handoff.md",
    "docs/checks.md",
    "docs/receiver-check.md",
    "docs/receiver-flow.md",
    "docs/baselines/v0.4.0-post-release-baseline.md",
    "docs/releases/v0.3.0.md",
    "docs/releases/v0.3.1.md",
    "docs/releases/v0.3.2.md",
    "docs/releases/v0.3.3.md",
    "docs/releases/v0.4.0.md",
    "docs/releases/v0.4.1.md",
    "docs/releases/v0.5.0.md",
    "docs/testing-v0.4.x-test-matrix.md",
    "docs/cli-lite.md",
    "docs/seal-diff.md",
    "docs/contextops.md",
    "docs/testing.md",
    "docs/roadmap/basebrief-long-term-baseline.md",
    "docs/evolution/bb-evolution-log.md",
    "docs/experiments/cache-ready-lite.md",
    "docs/experiments/cache-ready-capsule.md",
    "docs/experiments/cache-ready-anchor.md",
    "docs/experiments/cache-ready-anchor-pad.md",
    "docs/experiments/cache-ready-readable-poc.md",
    "docs/experiments/cache-ready-sidecar.md",
    "docs/experiments/cache-ready-hybrid-anchor.md",
    "docs/experiments/cache-ready-adaptive-selector.md",
    "docs/experiments/cache-ready-relay-gpt55.md",
    "README.en.md",
    "scripts/mode_router.js",
    "scripts/generate_cache_ready_lite.js",
    "scripts/generate_cache_ready_capsule.js",
    "scripts/generate_cache_ready_anchor.js",
    "scripts/prompt_stability_probe.js",
    "scripts/provider_cache_probe.js",
    "scripts/provider_cache_benchmark.js",
    "scripts/provider_relay_usage_audit.js",
    "scripts/generate_bb9_handoff.js",
    "scripts/basebrief.js",
    "scripts/basebrief_build_handoff.js",
    "scripts/basebrief_build_adapters.js",
    "scripts/basebrief_check_artifacts.js",
    "scripts/basebrief_receiver_init.js",
    "scripts/basebrief_receiver_check.js",
    "scripts/basebrief_receiver_flow.js",
    "scripts/basebrief_seal.js",
    "scripts/bb9_provider_profiles.json",
    "schemas/bb9-handoff.schema.json",
    "schemas/basebrief-receiver-check.schema.json",
    "schemas/basebrief-receiver-check-result.schema.json",
    "schemas/basebrief-seal.schema.json",
    "examples/full-example.md",
    "examples/lite-example.md",
    "examples/cache-ready-input.json",
    "examples/cache-ready-output.md",
    "examples/cache-ready-capsule-input.json",
    "examples/cache-ready-capsule-output.md",
    "examples/cache-ready-anchor-input.json",
    "examples/cache-ready-anchor-output.md",
    "examples/cache-ready-anchor-pad-input.json",
    "examples/cache-ready-anchor-pad-output.md",
    "examples/bb9-handoff-full-input.json",
    "examples/bb9-handoff-full-output.md",
    "examples/bb9-handoff-lite-input.json",
    "examples/bb9-handoff-lite-output.md",
    "examples/bb9-handoff-fallback-output.md",
    "examples/structured-handoff-full.md",
    "examples/structured-handoff-lite.md",
    "examples/adapter-codex-task.md",
    "examples/adapter-claude-project-context.md",
    "examples/seal-before-input.json",
    "examples/seal-after-input.json",
    "examples/next-chat-example.md",
    "examples/receiver-check-config.json",
    "examples/receiver/difference-found/README.md",
    "examples/receiver/difference-found/receiver-check-config.json",
    "examples/receiver/difference-found/receiver-check-result.json",
    "examples/receiver/blocked/README.md",
    "examples/receiver/blocked/blocked-result.json",
    "examples/receiver/language-routing/README.md",
    "examples/receiver/language-routing/receiver-report.md",
    "examples/receiver-flow/clean-repo/README.md",
    "examples/receiver-flow/clean-repo/flow-summary.json",
    "examples/receiver-flow/clean-repo/receiver-check.json",
    "examples/receiver-flow/clean-repo/draft-context.md",
    "examples/receiver-flow/dirty-repo/README.md",
    "examples/receiver-flow/dirty-repo/flow-summary.json",
    "examples/receiver-flow/dirty-repo/receiver-check.json",
    "examples/receiver-flow/dirty-repo/draft-context.md",
    "examples/receiver-flow/visible-output/README.md",
    "examples/receiver-flow/visible-output/flow-summary.json",
    "examples/receiver-flow/visible-output/receiver-check.json",
    "examples/receiver-flow/visible-output/draft-context.md",
    "examples/agent-task-example.md",
    "examples/minimal/README.md",
    "examples/minimal/input-project-notes.md",
    "examples/minimal/output-basebrief-lite.md",
    "examples/minimal/next-chat-prompt.md",
    ".github/ISSUE_TEMPLATE/usability_feedback.md",
  ];
  required.forEach((relativePath) => {
    assert(fs.existsSync(path.join(repoRoot, relativePath)), `Missing required file: ${relativePath}`);
  });
}

function checkContentContracts() {
  const packageJson = readJson("package.json");
  const skill = readText("skills/basebrief/SKILL.md");
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const integrationsDoc = readText("docs/integrations.md");
  const docsIndex = readText("docs/index.md");
  const quickstartDoc = readText("docs/quickstart-5min.md");
  const knownLimitationsDoc = readText("docs/known-limitations.md");
  const dogfoodingDoc = readText("docs/dogfooding/v0.2.2-first-run-workflow.md");
  const receiverReadyDogfoodingDoc = readText("docs/dogfooding/receiver-ready-v1-evidence.md");
  const receiverFrictionDoc = readText("docs/dogfooding/receiver-friction-log.md");
  const receiverFlowDogfoodingDoc = readText("docs/dogfooding/receiver-flow-dogfooding.md");
  const receiverFlowGuidedDogfoodingDoc = readText("docs/dogfooding/receiver-flow-guided-dogfooding.md");
  const testingDoc = readText("docs/testing.md");
  const usabilityFeedbackTemplate = readText(".github/ISSUE_TEMPLATE/usability_feedback.md");
  const adaptersDoc = readText("docs/adapters.md");
  const walkthroughDoc = readText("docs/walkthrough.md");
  const modeSelectionDoc = readText("docs/mode-selection.md");
  const handoffDoc = readText("docs/handoff.md");
  const checksDoc = readText("docs/checks.md");
  const receiverCheckDoc = readText("docs/receiver-check.md");
  const receiverFlowDoc = readText("docs/receiver-flow.md");
  const releaseCandidateDoc = readText("docs/releases/v0.3.0.md");
  const receiverStabilizationReleaseDoc = readText("docs/releases/v0.3.1.md");
  const receiverFlowReleaseDoc = readText("docs/releases/v0.3.2.md");
  const receiverFlowDogfoodingReleaseDoc = readText("docs/releases/v0.3.3.md");
  const integratedToolchainReleaseDoc = readText("docs/releases/v0.4.0.md");
  const stabilizationCandidateDoc = readText("docs/releases/v0.4.1.md");
  const guidedReceiverFlowReleaseDoc = readText("docs/releases/v0.5.0.md");
  const postReleaseBaselineDoc = readText("docs/baselines/v0.4.0-post-release-baseline.md");
  const testMatrixDoc = readText("docs/testing-v0.4.x-test-matrix.md");
  const cliLiteDoc = readText("docs/cli-lite.md");
  const sealDiffDoc = readText("docs/seal-diff.md");
  const contextOpsDoc = readText("docs/contextops.md");
  const roadmapDoc = readText("docs/roadmap/basebrief-long-term-baseline.md");
  const bb9Schema = readJson("schemas/bb9-handoff.schema.json");
  const receiverCheckSchema = readJson("schemas/basebrief-receiver-check.schema.json");
  const receiverCheckResultSchema = readJson("schemas/basebrief-receiver-check-result.schema.json");
  const receiverCheckConfigExample = readJson("examples/receiver-check-config.json");
  const sealSchema = readJson("schemas/basebrief-seal.schema.json");
  const providerProfiles = readJson("scripts/bb9_provider_profiles.json");
  const structuredFullExample = readText("examples/structured-handoff-full.md");
  const structuredLiteExample = readText("examples/structured-handoff-lite.md");
  const fullTemplate = readText("templates/zh-CN/BASEBRIEF.md");
  const liteTemplate = readText("templates/zh-CN/BASEBRIEF_LITE.md");
  const nextChatTemplate = readText("templates/zh-CN/NEXT_CHAT_PROMPT.md");
  const agentTaskTemplate = readText("templates/zh-CN/AGENT_TASK.md");
  const riskTemplate = readText("templates/zh-CN/RISK_NOTES.md");
  const cachePrefixTemplate = readText("templates/zh-CN/CACHE_PREFIX.md");
  const yaml = readText("skills/basebrief/agents/openai.yaml");

  assert(packageJson.private === true, "package.json must stay private");
  assert(
    JSON.stringify(Object.keys(packageJson.scripts || {}).sort()) === JSON.stringify(["check", "release-check", "test"]),
    "package.json must only expose local validation scripts",
  );
  assert(packageJson.scripts.test === "node --test tests/basebrief.test.js", "npm test must wrap the independent tests");
  assert(packageJson.scripts["release-check"] === "node scripts/run_release_checks.js", "npm run release-check must wrap release checks");
  assert(packageJson.scripts.check === "npm test && npm run release-check", "npm run check must run tests before release checks");
  ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies", "bin", "publishConfig", "files"].forEach((key) => {
    assert(!(key in packageJson), `package.json must not define ${key}`);
  });

  ["full", "lite", "cache-ready"].forEach((mode) => {
    assert(skill.includes(mode), `SKILL.md must mention mode: ${mode}`);
    assert(readme.includes(mode), `README.md must mention mode: ${mode}`);
  });
  assert(readme.includes("一个公开 Skill 入口"), "README.md must state that BaseBrief has one public skill entry");
  assert(readme.includes("README.en.md"), "README.md should link to README.en.md");
  assert(readme.includes("docs/quickstart-5min.md"), "README.md should link to the quickstart");
  assert(readme.includes("docs/index.md"), "README.md should link to the documentation index");
  assert(readme.includes("docs/integrations.md"), "README.md should link to integrations docs");
  assert(readme.includes("docs/handoff.md"), "README.md should link to handoff contract docs");
  assert(readme.includes("docs/cli-lite.md"), "README.md should link to CLI Lite docs");
  assert(readme.includes("docs/receiver-check.md"), "README.md should link to Receiver Safe Check docs");
  assert(readme.includes("docs/receiver-flow.md"), "README.md should link to Receiver Flow Draft docs");
  assert(readme.includes("receiver-flow"), "README.md should mention receiver-flow command");
  assert(readme.includes("docs/dogfooding/receiver-friction-log.md"), "README.md should link to receiver friction log");
  assert(readme.includes("docs/dogfooding/receiver-flow-dogfooding.md"), "README.md should link to receiver-flow dogfooding evidence");
  assert(readme.includes("docs/dogfooding/receiver-flow-guided-dogfooding.md"), "README.md should link to guided receiver-flow dogfooding evidence");
  assert(readme.includes("docs/releases/v0.5.0.md"), "README.md should link to v0.5.0 guided receiver flow candidate");
  assert(readme.includes("docs/releases/v0.4.1.md"), "README.md should link to v0.4.1 stabilization candidate");
  assert(readme.includes("docs/releases/v0.4.0.md"), "README.md should link to v0.4.0 release candidate");
  assert(readme.includes("docs/releases/v0.3.3.md"), "README.md should link to v0.3.3 release candidate");
  assert(readme.includes("docs/releases/v0.3.2.md"), "README.md should link to v0.3.2 release candidate");
  assert(readme.includes("docs/releases/v0.3.1.md"), "README.md should link to v0.3.1 release candidate");
  assert(readme.includes("docs/releases/v0.3.0.md"), "README.md should link to v0.3.0 release candidate");
  assert(readme.includes("docs/seal-diff.md"), "README.md should link to Seal/Diff docs");
  assert(readme.includes("零依赖 CLI Lite"), "README.md must describe the existing CLI Lite");
  assert(readme.includes("npm run check"), "README.md must document npm validation shortcut");
  assert(readme.includes("不是发布到 npm 的 package"), "README.md must keep npm scripts out of published-package scope");
  assert(!readme.includes("BaseBrief 当前不是 CLI"), "README.md must not describe CLI Lite as nonexistent");
  assert(!readme.includes("暂无 CLI"), "README.md must not contain the obsolete no-CLI status");
  assert(!readme.includes("BB2 experiment notes"), "README.md must keep experiment-history links out of the public entry");
  assert(englishReadme.includes("one public skill entry"), "README.en.md must explain the single public skill entry");
  assert(englishReadme.includes("normal continuation routes to `full` or `lite`"), "README.en.md must make full/lite the normal route");
  assert(englishReadme.includes("docs/quickstart-5min.md"), "README.en.md should link to the quickstart");
  assert(englishReadme.includes("docs/index.md"), "README.en.md should link to the documentation index");
  assert(englishReadme.includes("docs/handoff.md"), "README.en.md should link to handoff docs");
  assert(englishReadme.includes("docs/cli-lite.md"), "README.en.md should link to CLI Lite docs");
  assert(englishReadme.includes("docs/receiver-check.md"), "README.en.md should link to Receiver Safe Check docs");
  assert(englishReadme.includes("docs/receiver-flow.md"), "README.en.md should link to Receiver Flow Draft docs");
  assert(englishReadme.includes("receiver-flow"), "README.en.md should mention receiver-flow command");
  assert(englishReadme.includes("docs/dogfooding/receiver-friction-log.md"), "README.en.md should link to receiver friction log");
  assert(englishReadme.includes("docs/dogfooding/receiver-flow-dogfooding.md"), "README.en.md should link to receiver-flow dogfooding evidence");
  assert(englishReadme.includes("docs/dogfooding/receiver-flow-guided-dogfooding.md"), "README.en.md should link to guided receiver-flow dogfooding evidence");
  assert(englishReadme.includes("docs/releases/v0.5.0.md"), "README.en.md should link to v0.5.0 guided receiver flow candidate");
  assert(englishReadme.includes("docs/releases/v0.4.1.md"), "README.en.md should link to v0.4.1 stabilization candidate");
  assert(englishReadme.includes("docs/releases/v0.4.0.md"), "README.en.md should link to v0.4.0 release candidate");
  assert(englishReadme.includes("docs/releases/v0.3.3.md"), "README.en.md should link to v0.3.3 release candidate");
  assert(englishReadme.includes("docs/releases/v0.3.2.md"), "README.en.md should link to v0.3.2 release candidate");
  assert(englishReadme.includes("docs/releases/v0.3.1.md"), "README.en.md should link to v0.3.1 release candidate");
  assert(englishReadme.includes("docs/releases/v0.3.0.md"), "README.en.md should link to v0.3.0 release candidate");
  assert(englishReadme.includes("docs/seal-diff.md"), "README.en.md should link to Seal/Diff docs");
  assert(englishReadme.includes("Integrations"), "README.en.md should link to integrations docs");
  assert(englishReadme.includes("zero-dependency CLI Lite"), "README.en.md must describe the existing CLI Lite");
  assert(englishReadme.includes("npm run check"), "README.en.md must document npm validation shortcut");
  assert(englishReadme.includes("not a published npm package"), "README.en.md must keep npm scripts out of published-package scope");
  assert(!englishReadme.includes("not a CLI or plugin yet"), "README.en.md must not contain the obsolete no-CLI status");
  assert(englishReadme.includes("cache-ready"), "README.en.md must describe cache-ready mode");
  assert(!/two skills/i.test(englishReadme), "README.en.md must not imply two skills");
  assert(
    skill.includes("普通项目接续默认只在 `full` 和 `lite` 之间选择"),
    "SKILL.md must keep cache-ready out of ordinary routing",
  );
  assert(
    modeSelectionDoc.includes("`cache-ready` 是显式实验路线"),
    "mode-selection.md must mark cache-ready as explicit experiment route",
  );
  assert(modeSelectionDoc.includes("选完模式后怎么办"), "mode-selection.md must explain the next action");
  assert(quickstartDoc.includes("路径 A"), "quickstart must document the Skill-first path");
  assert(quickstartDoc.includes("路径 B"), "quickstart must document the local build path");
  assert(quickstartDoc.includes("路径 C"), "quickstart must document the Seal/Diff path");
  assert(quickstartDoc.includes("路径 D"), "quickstart must document the Receiver Safe Check path");
  assert(quickstartDoc.includes("tests/outputs/private/quickstart/build"), "quickstart build must use the ignored private output directory");
  assert(quickstartDoc.includes("tests/outputs/private/quickstart/before.json"), "quickstart seal must use the ignored private output directory");
  assert(knownLimitationsDoc.includes("Free-form Markdown"), "Known Limitations must document free-form Markdown input boundary");
  assert(knownLimitationsDoc.includes("not a Git diff"), "Known Limitations must document Seal/Diff boundary");
  assert(dogfoodingDoc.includes("artifact.missing-open-questions"), "Dogfooding record must document the first-run warning");
  assert(dogfoodingDoc.includes("Remaining Friction"), "Dogfooding record must document remaining friction");
  assert(docsIndex.includes("dogfooding/receiver-ready-v1-evidence.md"), "Docs index must link receiver-ready v1 evidence");
  assert(docsIndex.includes("dogfooding/receiver-friction-log.md"), "Docs index must link receiver friction log");
  assert(docsIndex.includes("dogfooding/receiver-flow-dogfooding.md"), "Docs index must link receiver-flow dogfooding evidence");
  assert(docsIndex.includes("dogfooding/receiver-flow-guided-dogfooding.md"), "Docs index must link guided receiver-flow dogfooding evidence");
  assert(docsIndex.includes("receiver-flow.md"), "Docs index must link Receiver Flow Draft docs");
  assert(docsIndex.includes("../examples/receiver/difference-found/README.md"), "Docs index should link receiver difference example");
  assert(docsIndex.includes("../examples/receiver/blocked/README.md"), "Docs index should link receiver blocked example");
  assert(docsIndex.includes("../examples/receiver/language-routing/README.md"), "Docs index should link receiver language routing example");
  assert(docsIndex.includes("../examples/receiver-flow/clean-repo/README.md"), "Docs index should link receiver-flow clean repo example");
  assert(docsIndex.includes("../examples/receiver-flow/dirty-repo/README.md"), "Docs index should link receiver-flow dirty repo example");
  assert(docsIndex.includes("../examples/receiver-flow/visible-output/README.md"), "Docs index should link receiver-flow visible output example");
  assert(docsIndex.includes("releases/v0.5.0.md"), "Docs index must link v0.5.0 guided receiver flow candidate");
  assert(docsIndex.includes("releases/v0.4.1.md"), "Docs index must link v0.4.1 stabilization candidate");
  assert(docsIndex.includes("baselines/v0.4.0-post-release-baseline.md"), "Docs index must link v0.4.0 post-release baseline");
  assert(docsIndex.includes("testing-v0.4.x-test-matrix.md"), "Docs index must link v0.4.x test matrix");
  assert(docsIndex.includes("releases/v0.4.0.md"), "Docs index must link v0.4.0 release candidate");
  assert(docsIndex.includes("releases/v0.3.3.md"), "Docs index must link v0.3.3 release candidate");
  assert(docsIndex.includes("releases/v0.3.2.md"), "Docs index must link v0.3.2 release candidate");
  assert(docsIndex.includes("releases/v0.3.1.md"), "Docs index must link v0.3.1 release candidate");
  assert(docsIndex.includes("releases/v0.3.0.md"), "Docs index must link v0.3.0 release candidate");
  assert(receiverReadyDogfoodingDoc.includes("User-provided external evidence"), "Receiver-ready evidence must distinguish external evidence");
  assert(receiverReadyDogfoodingDoc.includes("not proof across all tools"), "Receiver-ready evidence must keep the interpretation scoped");
  assert(receiverReadyDogfoodingDoc.includes("Low-budget Validation Rule"), "Receiver-ready evidence must record the validation budget");
  assert(receiverFrictionDoc.includes("actual_handoff_friction"), "Receiver friction log must record the report shape");
  assert(receiverFrictionDoc.includes("difference_found"), "Receiver friction log must document difference_found");
  assert(receiverFrictionDoc.includes("blocked"), "Receiver friction log must document blocked");
  assert(receiverFrictionDoc.includes("v0.3.1"), "Receiver friction log must name v0.3.1 stabilization");
  assert(receiverFlowDogfoodingDoc.includes("receiver_flow_dogfooding"), "Receiver flow dogfooding doc must define the record shape");
  assert(receiverFlowDogfoodingDoc.includes("command_shape"), "Receiver flow dogfooding doc must record command shape");
  assert(receiverFlowDogfoodingDoc.includes("output_shape"), "Receiver flow dogfooding doc must record output shape");
  assert(receiverFlowDogfoodingDoc.includes("review_checkpoints"), "Receiver flow dogfooding doc must record review checkpoints");
  assert(receiverFlowDogfoodingDoc.includes("observed_friction"), "Receiver flow dogfooding doc must record observed friction");
  assert(receiverFlowDogfoodingDoc.includes("next_fix_candidate"), "Receiver flow dogfooding doc must record next fix candidate");
  assert(receiverFlowDogfoodingDoc.includes("No provider request"), "Receiver flow dogfooding doc must reject provider requests");
  assert(receiverFlowDogfoodingDoc.includes("No receiver thread creation"), "Receiver flow dogfooding doc must reject receiver thread creation");
  assert(receiverFlowDogfoodingDoc.includes("No Auto Flow"), "Receiver flow dogfooding doc must reject Auto Flow");
  assert(receiverFlowGuidedDogfoodingDoc.includes("receiver-flow --repo <target-repo> --output-dir <dir> --guided"), "Guided dogfooding doc must document guided command shape");
  assert(receiverFlowGuidedDogfoodingDoc.includes("guided-self-smoke"), "Guided dogfooding doc must include self smoke case");
  assert(receiverFlowGuidedDogfoodingDoc.includes("provider_request_performed`: false"), "Guided dogfooding doc must state no provider request");
  assert(receiverFlowGuidedDogfoodingDoc.includes("No `ready_for_receiver` output"), "Guided dogfooding doc must keep draft-only boundary");
  assert(receiverFlowGuidedDogfoodingDoc.includes("No Auto Flow"), "Guided dogfooding doc must reject Auto Flow");
  assert(receiverFlowDoc.includes("receiver-flow --repo <target-repo> --output-dir <dir>"), "Receiver Flow docs must document the command");
  assert(receiverFlowDoc.includes("receiver-flow --repo <target-repo> --output-dir <dir> --guided"), "Receiver Flow docs must document guided mode");
  assert(receiverFlowDoc.includes("handoff_status: draft_needs_review"), "Receiver Flow docs must keep draft status explicit");
  assert(receiverFlowDoc.includes("Empty guided answers are written as"), "Receiver Flow docs must document empty guided answers");
  assert(receiverFlowDoc.includes("not Auto Flow"), "Receiver Flow docs must reject Auto Flow scope");
  assert(receiverFlowDoc.includes("Does not make provider requests"), "Receiver Flow docs must reject provider requests");
  assert(receiverFlowDoc.includes("Does not overwrite existing output files"), "Receiver Flow docs must reject overwrites");
  assert(receiverFlowDoc.includes("Does not write tracked target-repository files"), "Receiver Flow docs must reject tracked target writes");
  assert(knownLimitationsDoc.includes("does not automatically decide when a handoff is stale"), "Known Limitations must document generated_at boundary");
  assert(knownLimitationsDoc.includes("does not add file-content hashes"), "Known Limitations must document deferred receiver integrity work");
  assert(knownLimitationsDoc.includes("not a general test runner"), "Known Limitations must scope Receiver Safe Check");
  assert(testingDoc.includes("最多 `1` 个 low-reasoning smoke case"), "Testing docs must cap receiver smoke cases");
  assert(testingDoc.includes("完整矩阵测试必须由用户明确批准"), "Testing docs must require approval for full receiver matrices");
  assert(testingDoc.includes("npm run check"), "Testing docs must document npm validation shortcut");
  assert(testingDoc.includes("v0.3.1 receiver stabilization"), "Testing docs must document v0.3.1 receiver stabilization budget");
  assert(testingDoc.includes("v0.3.2 Receiver Flow Draft Skeleton"), "Testing docs must document v0.3.2 receiver flow closure");
  assert(testingDoc.includes("v0.3.3 Receiver Flow Dogfooding Evidence"), "Testing docs must document v0.3.3 receiver flow dogfooding closure");
  assert(testingDoc.includes("v0.4.0 Integrated Local Toolchain Release Candidate"), "Testing docs must document v0.4.0 release-candidate closure");
  assert(testingDoc.includes("v0.4.1 Stabilization Candidate"), "Testing docs must document v0.4.1 stabilization candidate");
  assert(testingDoc.includes("testing-v0.4.x-test-matrix.md"), "Testing docs must link v0.4.x test matrix");
  assert(testingDoc.includes("v0.5.0 Guided Receiver Flow Candidate"), "Testing docs must document v0.5.0 guided receiver flow candidate");
  assert(testingDoc.includes("provider_probe_status=skipped"), "Testing docs must preserve skipped provider probe wording");
  assert(usabilityFeedbackTemplate.includes("Do not include secrets"), "Usability feedback template must include a safety warning");
  assert(usabilityFeedbackTemplate.includes("Expected Result"), "Usability feedback template must collect expected results");
  [
    "docs/experiments/cache-ready-lite.md",
    "docs/experiments/cache-ready-capsule.md",
    "docs/experiments/cache-ready-anchor.md",
    "docs/experiments/cache-ready-anchor-pad.md",
    "docs/experiments/cache-ready-readable-poc.md",
    "docs/experiments/cache-ready-sidecar.md",
    "docs/experiments/cache-ready-hybrid-anchor.md",
    "docs/experiments/cache-ready-adaptive-selector.md",
    "docs/experiments/cache-ready-active-prompt-trim.md",
    "docs/experiments/cache-ready-bb12-guard.md",
    "docs/experiments/cache-ready-relay-gpt55.md",
  ].forEach((relativePath) => {
    const indexTarget = relativePath.replace(/^docs\//, "");
    assert(docsIndex.includes(indexTarget), `Documentation index should link to ${relativePath}`);
  });
  assert(handoffDoc.includes("readableBrief"), "handoff.md must define readableBrief");
  assert(handoffDoc.includes("cacheSidecar"), "handoff.md must define cacheSidecar");
  assert(handoffDoc.includes("activeProviderPrompt"), "handoff.md must define activeProviderPrompt");
  assert(handoffDoc.includes("handoff.meta.json"), "handoff.md must define handoff.meta.json");
  assert(handoffDoc.includes("BASEBRIEF_HANDOFF_JSON_BEGIN"), "handoff.md must document structured JSON block markers");
  assert(handoffDoc.includes("scripts/basebrief_build_handoff.js"), "handoff.md must document the builder script");
  assert(handoffDoc.includes("defaultPromptStrategy"), "handoff.md must document provider strategy metadata");
  assert(handoffDoc.includes("experimentalCandidates"), "handoff.md must document experimental candidates");
  assert(docsIndex.includes("../examples/structured-handoff-full.md"), "Documentation index should link to structured full handoff example");
  assert(docsIndex.includes("../examples/adapter-codex-task.md"), "Documentation index should link to adapter Codex example");
  assert(adaptersDoc.includes("scripts/basebrief_build_adapters.js"), "adapters.md must document adapter builder script");
  assert(adaptersDoc.includes("codex-task.md"), "adapters.md must document Codex output");
  assert(adaptersDoc.includes("claude-project-context.md"), "adapters.md must document Claude output");
  assert(checksDoc.includes("scripts/basebrief_check_artifacts.js"), "checks.md must document artifact checker script");
  assert(checksDoc.includes("--input"), "checks.md must document explicit input behavior");
  assert(checksDoc.includes("not a full security audit"), "checks.md must explain checker boundary");
  assert(cliLiteDoc.includes("scripts/basebrief.js"), "cli-lite.md must document CLI Lite script");
  assert(cliLiteDoc.includes("not a published npm package"), "cli-lite.md must state CLI Lite is not a published npm package");
  assert(cliLiteDoc.includes("v0.4.0"), "cli-lite.md must describe v0.4.0 local toolchain boundary");
  assert(cliLiteDoc.includes("npm run check"), "cli-lite.md must document npm validation shortcut");
  assert(cliLiteDoc.includes("node scripts/basebrief.js build"), "cli-lite.md must document build command");
  assert(cliLiteDoc.includes("node scripts/basebrief.js seal"), "cli-lite.md must document seal command");
  assert(cliLiteDoc.includes("node scripts/basebrief.js diff"), "cli-lite.md must document diff command");
  assert(cliLiteDoc.includes("node scripts/basebrief.js receiver-flow"), "cli-lite.md must document receiver-flow command");
  assert(cliLiteDoc.includes("--guided"), "cli-lite.md must document receiver-flow guided option");
  assert(cliLiteDoc.includes("draft_needs_review"), "cli-lite.md must keep receiver-flow in draft status");
  assert(cliLiteDoc.includes("releases/v0.3.2.md"), "cli-lite.md must link v0.3.2 release candidate");
  assert(cliLiteDoc.includes("releases/v0.3.3.md"), "cli-lite.md must link v0.3.3 release candidate");
  assert(sealDiffDoc.includes("scripts/basebrief_seal.js"), "seal-diff.md must document seal script");
  assert(sealDiffDoc.includes("basebrief-seal-v1"), "seal-diff.md must document seal schema version");
  assert(sealDiffDoc.includes("not a project-management system"), "seal-diff.md must state product boundary");
  assert(contextOpsDoc.includes("not a product surface"), "contextops.md must keep ContextOps out of product surface");
  assert(contextOpsDoc.includes("Current Non-Goals"), "contextops.md must define non-goals");
  assert(contextOpsDoc.includes("hosted service"), "contextops.md must reject hosted-service scope");
  assert(contextOpsDoc.includes("provider-general"), "contextops.md must reject provider-general cache claims");
  assert(sealSchema.properties.schemaVersion.const === "basebrief-seal-v1", "Seal schema must define v1 schema version");
  assert(structuredFullExample.includes("BASEBRIEF_HANDOFF_JSON_BEGIN"), "structured full example must include handoff JSON begin marker");
  assert(structuredFullExample.includes("BASEBRIEF_HANDOFF_JSON_END"), "structured full example must include handoff JSON end marker");
  assert(structuredLiteExample.includes("BASEBRIEF_HANDOFF_JSON_BEGIN"), "structured lite example must include handoff JSON begin marker");
  assert(structuredLiteExample.includes("BASEBRIEF_HANDOFF_JSON_END"), "structured lite example must include handoff JSON end marker");
  assert(structuredLiteExample.includes('"open_questions"'), "structured lite example must include open questions");
  assert(roadmapDoc.includes("Do not add BB13"), "roadmap baseline must include experiment freeze rule");
  ["mimo", "deepseek", "relay-openai-gpt55-codex-oauth"].forEach((profileId) => {
    const profile = providerProfiles[profileId];
    assert(profile, `Missing provider profile: ${profileId}`);
    ["defaultPromptStrategy", "activePromptStrategy", "fallbackStrategy", "evidenceScope", "experimentalCandidates"].forEach((field) => {
      assert(field in profile, `Provider profile ${profileId} missing strategy field: ${field}`);
    });
  });
  assert(providerProfiles.mimo.defaultPromptStrategy === "bb9_sidecar", "MiMo default strategy must remain BB9 sidecar");
  assert(
    providerProfiles.mimo.experimentalCandidates.some(
      (candidate) => candidate.candidateId === "bb12SizeBandGuard" && candidate.status === "mimo_specific_selector_candidate" && candidate.defaultEnabled === false,
    ),
    "MiMo profile must record BB12 as metadata-only selector candidate",
  );
  assert(providerProfiles.deepseek.defaultPromptStrategy === "bb9_sidecar", "DeepSeek default strategy must remain BB9 sidecar");
  assert(
    providerProfiles.deepseek.experimentalCandidates.every((candidate) => candidate.defaultEnabled === false),
    "DeepSeek experimental candidates must not be default enabled",
  );
  assert(
    !providerProfiles.deepseek.experimentalCandidates.some(
      (candidate) => candidate.candidateId === "bb12SizeBandGuard" && candidate.status !== "deepseek_smoke_inconclusive",
    ),
    "DeepSeek BB12 must remain smoke inconclusive",
  );
  assert(providerProfiles["relay-openai-gpt55-codex-oauth"].activePromptStrategy === "readableBrief", "Relay must use readable active prompt");
  assert(providerProfiles["relay-openai-gpt55-codex-oauth"].cacheUsageObservable === false, "Relay cache usage must not be observable");
  [
    "project_identity",
    "current_goal",
    "verified_facts",
    "confirmed_decisions",
    "risk_boundaries",
    "expected_output",
    "tail_request",
  ].forEach((field) => {
    assert(bb9Schema.required.includes(field), `BB9 schema missing required field: ${field}`);
  });
  ["Codex", "Claude Code", "Cursor"].forEach((toolName) => {
    assert(integrationsDoc.includes(toolName), `integrations.md must mention ${toolName}`);
  });
  assert(walkthroughDoc.includes("verified_facts"), "walkthrough.md must show verified_facts");
  assert(walkthroughDoc.includes("risk_boundaries"), "walkthrough.md must show risk_boundaries");

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

  [fullTemplate, liteTemplate, nextChatTemplate].forEach((template) => {
    [
      "handoff_status",
      "ready_for_receiver",
      "handoff_protocol_version",
      "receiver-ready-v1",
      "generated_at",
      "preferred_language",
      "response_language",
      "match_latest_user_message",
      "receiver_entry_task",
      "post_acceptance_next_action",
      "expected_changed_files",
      "receiver_check_config",
      "receiver_task_status",
      "repository_state_status",
      "declared_checks_status",
      "handoff_acceptance",
    ].forEach((token) => {
      assert(template.includes(token), `Receiver-ready template missing token: ${token}`);
    });
  });
  assert(nextChatTemplate.includes("当前工作目录"), "NEXT_CHAT_PROMPT.md must require current working directory reporting");
  assert(nextChatTemplate.includes("来源窗口已验证"), "NEXT_CHAT_PROMPT.md must distinguish source-window verification");
  assert(nextChatTemplate.includes("接收窗口本轮已验证"), "NEXT_CHAT_PROMPT.md must distinguish receiver re-verification");
  assert(nextChatTemplate.includes("实际接力摩擦"), "NEXT_CHAT_PROMPT.md must require actual handoff friction");
  assert(nextChatTemplate.includes("第一句、进度说明和最终报告"), "NEXT_CHAT_PROMPT.md must route all agent-authored response language");
  assert(nextChatTemplate.includes("忽略代码、路径、命令和字段名"), "NEXT_CHAT_PROMPT.md must ignore technical tokens for language routing");
  assert(nextChatTemplate.includes("新增、缺失或意外文件"), "NEXT_CHAT_PROMPT.md must require exact changed-file comparison");
  assert(nextChatTemplate.includes("不等于 Agent 执行失败"), "NEXT_CHAT_PROMPT.md must distinguish difference_found from execution failure");
  assert(nextChatTemplate.includes("receiver-check --config <receiver_check_config> --repo <target-repo> --json"), "NEXT_CHAT_PROMPT.md must use the fixed receiver-check command");
  assert(quickstartDoc.includes("receiver_entry_task"), "Quickstart must explain receiver entry task");
  assert(quickstartDoc.includes("post_acceptance_next_action"), "Quickstart must explain post-acceptance next action");
  assert(quickstartDoc.includes("match_latest_user_message"), "Quickstart must explain response language routing");
  assert(quickstartDoc.includes("expected_changed_files"), "Quickstart must explain exact changed-file comparison");
  assert(quickstartDoc.includes("handoff_acceptance"), "Quickstart must explain receiver acceptance status");
  assert(knownLimitationsDoc.includes("does not automatically switch"), "Known limitations must state working-directory boundary");
  assert(knownLimitationsDoc.includes("Platform-generated tool traces"), "Known limitations must state language-routing boundary");
  assert(quickstartDoc.includes("receiver_check_config"), "Quickstart must explain optional Receiver Safe Check");
  assert(quickstartDoc.includes("receiver-init --repo . --output tests/outputs/private/quickstart/receiver-check.json"), "Quickstart must show receiver-init workflow");
  assert(quickstartDoc.includes("不是接收窗口验收"), "Quickstart must distinguish source smoke from receiver acceptance");
  assert(receiverCheckDoc.includes("basebrief-receiver-check-v1"), "Receiver Safe Check docs must name the config contract");
  assert(receiverCheckDoc.includes("basebrief-receiver-check-result-v1"), "Receiver Safe Check docs must name the result contract");
  assert(receiverCheckDoc.includes("不等同于重跑来源窗口的完整测试"), "Receiver Safe Check docs must distinguish lightweight checks from full tests");
  assert(receiverCheckDoc.includes("receiver-init --repo <target-repo> --output <receiver-check-config.json>"), "Receiver Safe Check docs must show receiver-init workflow");
  assert(releaseCandidateDoc.includes("Receiver-ready v1"), "v0.3.0 release candidate must describe Receiver-ready v1");
  assert(releaseCandidateDoc.includes("Receiver Safe Check v1"), "v0.3.0 release candidate must describe Receiver Safe Check v1");
  assert(releaseCandidateDoc.includes("receiver-init --repo <target-repo>"), "v0.3.0 release candidate must describe explicit receiver workflow");
  assert(releaseCandidateDoc.includes("No Codex receiver thread"), "v0.3.0 release candidate must record receiver-thread boundary");
  assert(releaseCandidateDoc.includes("not cross-model stability proof"), "v0.3.0 release candidate must scope external smoke evidence");
  assert(releaseCandidateDoc.includes("No push, tag, or formal release"), "v0.3.0 release candidate must keep release actions pending");
  assert(receiverStabilizationReleaseDoc.includes("Receiver Stabilization"), "v0.3.1 release candidate must describe receiver stabilization");
  assert(receiverStabilizationReleaseDoc.includes("docs/dogfooding/receiver-friction-log.md") || receiverStabilizationReleaseDoc.includes("receiver friction log"), "v0.3.1 release candidate must reference receiver friction log");
  assert(receiverStabilizationReleaseDoc.includes("difference_found"), "v0.3.1 release candidate must document difference_found");
  assert(receiverStabilizationReleaseDoc.includes("blocked"), "v0.3.1 release candidate must document blocked");
  assert(receiverStabilizationReleaseDoc.includes("npm run check"), "v0.3.1 release candidate must document npm validation script");
  assert(receiverStabilizationReleaseDoc.includes("provider_probe_status=skipped"), "v0.3.1 release candidate must preserve skipped provider probe gate");
  assert(receiverStabilizationReleaseDoc.includes("No provider request"), "v0.3.1 release candidate must state no provider request");
  assert(receiverStabilizationReleaseDoc.includes("No push, tag, or formal release"), "v0.3.1 release candidate must keep release actions pending");
  assert(receiverStabilizationReleaseDoc.includes("Auto Flow Skeleton is not introduced"), "v0.3.1 release candidate must keep Auto Flow out of scope");
  assert(receiverStabilizationReleaseDoc.includes("BB9 handoff schema is unchanged"), "v0.3.1 release candidate must protect BB9 schema");
  assert(receiverStabilizationReleaseDoc.includes("Receiver Safe Check config and result schemas are unchanged"), "v0.3.1 release candidate must protect receiver schemas");
  assert(receiverFlowReleaseDoc.includes("Receiver Flow Draft Skeleton"), "v0.3.2 release candidate must describe receiver flow draft skeleton");
  assert(receiverFlowReleaseDoc.includes("receiver-flow --repo <target-repo> --output-dir <dir>"), "v0.3.2 release candidate must document receiver-flow command");
  assert(receiverFlowReleaseDoc.includes("flow-summary.json"), "v0.3.2 release candidate must document flow summary output");
  assert(receiverFlowReleaseDoc.includes("receiver-check.json"), "v0.3.2 release candidate must document receiver-check output");
  assert(receiverFlowReleaseDoc.includes("draft-context.md"), "v0.3.2 release candidate must document draft context output");
  assert(receiverFlowReleaseDoc.includes("handoff_status: draft_needs_review"), "v0.3.2 release candidate must keep draft status explicit");
  assert(receiverFlowReleaseDoc.includes("No provider request"), "v0.3.2 release candidate must state no provider request");
  assert(receiverFlowReleaseDoc.includes("No receiver thread creation"), "v0.3.2 release candidate must state no receiver thread creation");
  assert(receiverFlowReleaseDoc.includes("No push, tag, or formal release"), "v0.3.2 release candidate must keep release actions pending");
  assert(receiverFlowReleaseDoc.includes("provider_probe_status=skipped"), "v0.3.2 release candidate must preserve skipped provider probe gate");
  assert(receiverFlowReleaseDoc.includes("BB9 handoff schema is unchanged"), "v0.3.2 release candidate must protect BB9 schema");
  assert(receiverFlowReleaseDoc.includes("Receiver Safe Check config and result schemas are unchanged"), "v0.3.2 release candidate must protect receiver schemas");
  assert(receiverFlowDogfoodingReleaseDoc.includes("Receiver Flow Dogfooding"), "v0.3.3 release candidate must describe receiver flow dogfooding");
  assert(receiverFlowDogfoodingReleaseDoc.includes("evidence-only stabilization"), "v0.3.3 release candidate must stay evidence-only");
  assert(receiverFlowDogfoodingReleaseDoc.includes("handoff_status: draft_needs_review"), "v0.3.3 release candidate must keep draft status explicit");
  assert(receiverFlowDogfoodingReleaseDoc.includes("No provider request"), "v0.3.3 release candidate must state no provider request");
  assert(receiverFlowDogfoodingReleaseDoc.includes("No receiver thread creation"), "v0.3.3 release candidate must state no receiver thread creation");
  assert(receiverFlowDogfoodingReleaseDoc.includes("No Auto Flow"), "v0.3.3 release candidate must state no Auto Flow");
  assert(receiverFlowDogfoodingReleaseDoc.includes("provider_probe_status=skipped"), "v0.3.3 release candidate must preserve skipped provider probe gate");
  assert(receiverFlowDogfoodingReleaseDoc.includes("No push, tag, or formal release"), "v0.3.3 release candidate must keep release actions pending");
  assert(receiverFlowDogfoodingReleaseDoc.includes("BB9 handoff schema is unchanged"), "v0.3.3 release candidate must protect BB9 schema");
  assert(receiverFlowDogfoodingReleaseDoc.includes("Receiver Safe Check config and result schemas are unchanged"), "v0.3.3 release candidate must protect receiver schemas");
  assert(integratedToolchainReleaseDoc.includes("integrated local toolchain"), "v0.4.0 release candidate must describe integrated local toolchain");
  assert(integratedToolchainReleaseDoc.includes("one public skill entry"), "v0.4.0 release candidate must preserve one public skill entry");
  assert(integratedToolchainReleaseDoc.includes("BB9 handoff schema is unchanged"), "v0.4.0 release candidate must protect BB9 schema");
  assert(integratedToolchainReleaseDoc.includes("Receiver Safe Check config and result schemas are unchanged"), "v0.4.0 release candidate must protect receiver schemas");
  assert(integratedToolchainReleaseDoc.includes("CLI Lite command behavior is unchanged"), "v0.4.0 release candidate must protect CLI behavior");
  assert(integratedToolchainReleaseDoc.includes("package.json"), "v0.4.0 release candidate must document package boundary");
  assert(integratedToolchainReleaseDoc.includes("provider_probe_status=skipped"), "v0.4.0 release candidate must preserve skipped provider probe gate");
  assert(integratedToolchainReleaseDoc.includes("No provider request"), "v0.4.0 release candidate must state no provider request");
  assert(integratedToolchainReleaseDoc.includes("No broad provider savings claim"), "v0.4.0 release candidate must reject broad provider claims");
  assert(integratedToolchainReleaseDoc.includes("No receiver thread creation"), "v0.4.0 release candidate must state no receiver thread creation");
  assert(integratedToolchainReleaseDoc.includes("No Auto Flow"), "v0.4.0 release candidate must state no Auto Flow");
  assert(integratedToolchainReleaseDoc.includes("No Web UI"), "v0.4.0 release candidate must state no Web UI");
  assert(integratedToolchainReleaseDoc.includes("No Cursor adapter"), "v0.4.0 release candidate must state no Cursor adapter");
  assert(integratedToolchainReleaseDoc.includes("No hosted service"), "v0.4.0 release candidate must state no hosted service");
  assert(integratedToolchainReleaseDoc.includes("No installed or global CLI"), "v0.4.0 release candidate must state no installed CLI");
  assert(integratedToolchainReleaseDoc.includes("No published npm package"), "v0.4.0 release candidate must state no published package");
  assert(integratedToolchainReleaseDoc.includes("No `.basebrief/` project state directory"), "v0.4.0 release candidate must state no .basebrief directory");
  assert(integratedToolchainReleaseDoc.includes("No CI matrix"), "v0.4.0 release candidate must state no CI matrix");
  assert(integratedToolchainReleaseDoc.includes("No push, tag, or formal release"), "v0.4.0 release candidate must keep release actions pending");
  assert(stabilizationCandidateDoc.includes("Stabilization Candidate"), "v0.4.1 candidate must describe stabilization");
  assert(stabilizationCandidateDoc.includes("BB9 handoff schema is unchanged"), "v0.4.1 candidate must protect BB9 schema");
  assert(stabilizationCandidateDoc.includes("Receiver Safe Check config and result schemas are unchanged"), "v0.4.1 candidate must protect receiver schemas");
  assert(stabilizationCandidateDoc.includes("Receiver Flow Draft schema and default behavior are unchanged"), "v0.4.1 candidate must protect receiver-flow behavior");
  assert(stabilizationCandidateDoc.includes("CLI Lite command behavior is unchanged"), "v0.4.1 candidate must protect CLI behavior");
  assert(stabilizationCandidateDoc.includes("provider_probe_status=skipped"), "v0.4.1 candidate must preserve skipped provider probe gate");
  assert(stabilizationCandidateDoc.includes("No provider request"), "v0.4.1 candidate must state no provider request");
  assert(stabilizationCandidateDoc.includes("No Auto Flow"), "v0.4.1 candidate must state no Auto Flow");
  assert(stabilizationCandidateDoc.includes("No `receiver-flow --guided`"), "v0.4.1 candidate must state no guided mode");
  assert(stabilizationCandidateDoc.includes("No `receiver-flow --extract`"), "v0.4.1 candidate must state no extract mode");
  assert(stabilizationCandidateDoc.includes("No `review-draft`"), "v0.4.1 candidate must state no review-draft");
  assert(stabilizationCandidateDoc.includes("No `.basebrief/` project state directory"), "v0.4.1 candidate must state no .basebrief directory");
  assert(stabilizationCandidateDoc.includes("No push, tag, or formal release"), "v0.4.1 candidate must keep release actions pending");
  assert(postReleaseBaselineDoc.includes("release tag: `v0.4.0`"), "post-release baseline must record v0.4.0 tag");
  assert(postReleaseBaselineDoc.includes("release commit: `4de7342`"), "post-release baseline must record release commit");
  assert(postReleaseBaselineDoc.includes("provider_probe_status=skipped"), "post-release baseline must preserve skipped provider wording");
  assert(testMatrixDoc.includes("BaseBrief v0.4.x Test Matrix"), "v0.4.x test matrix must have a stable title");
  assert(testMatrixDoc.includes("OpenCode availability"), "v0.4.x test matrix must include OpenCode runner probe");
  assert(testMatrixDoc.includes("Claude Code availability"), "v0.4.x test matrix must include Claude Code runner probe");
  assert(guidedReceiverFlowReleaseDoc.includes("Guided Receiver Flow Candidate"), "v0.5.0 candidate must describe guided receiver flow");
  assert(guidedReceiverFlowReleaseDoc.includes("Default `receiver-flow` behavior remains unchanged"), "v0.5.0 candidate must protect default receiver-flow behavior");
  assert(guidedReceiverFlowReleaseDoc.includes("Empty guided answers are written as `[EMPTY]`"), "v0.5.0 candidate must document empty answers");
  assert(guidedReceiverFlowReleaseDoc.includes("review_checklist"), "v0.5.0 candidate must document review checklist");
  assert(guidedReceiverFlowReleaseDoc.includes("handoff_status: draft_needs_review"), "v0.5.0 candidate must keep draft status explicit");
  assert(guidedReceiverFlowReleaseDoc.includes("BB9 handoff schema is unchanged"), "v0.5.0 candidate must protect BB9 schema");
  assert(guidedReceiverFlowReleaseDoc.includes("Receiver Safe Check config and result schemas are unchanged"), "v0.5.0 candidate must protect receiver schemas");
  assert(guidedReceiverFlowReleaseDoc.includes("provider_probe_status=skipped"), "v0.5.0 candidate must preserve skipped provider probe gate");
  assert(guidedReceiverFlowReleaseDoc.includes("No provider request"), "v0.5.0 candidate must state no provider request");
  assert(guidedReceiverFlowReleaseDoc.includes("No automatic promotion to `ready_for_receiver`"), "v0.5.0 candidate must reject automatic ready promotion");
  assert(guidedReceiverFlowReleaseDoc.includes("No `review-draft`"), "v0.5.0 candidate must state no review-draft");
  assert(guidedReceiverFlowReleaseDoc.includes("No `receiver-flow --extract`"), "v0.5.0 candidate must state no extract mode");
  assert(guidedReceiverFlowReleaseDoc.includes("No `.basebrief/` project state directory"), "v0.5.0 candidate must state no .basebrief directory");
  assert(guidedReceiverFlowReleaseDoc.includes("No Auto Flow"), "v0.5.0 candidate must state no Auto Flow");
  assert(guidedReceiverFlowReleaseDoc.includes("No push, tag, or formal release"), "v0.5.0 candidate must keep release actions pending");
  assert(receiverCheckSchema.properties.schemaVersion.const === "basebrief-receiver-check-v1", "Receiver Safe Check config schema version mismatch");
  assert(receiverCheckResultSchema.properties.schemaVersion.const === "basebrief-receiver-check-result-v1", "Receiver Safe Check result schema version mismatch");
  assert(receiverCheckConfigExample.schemaVersion === "basebrief-receiver-check-v1", "Receiver Safe Check example schema version mismatch");
  assert(Array.isArray(receiverCheckConfigExample.expected_changed_files), "Receiver Safe Check example must include expected_changed_files");
  assert(handoffDoc.includes("It is not a BB9 schema field"), "Handoff docs must keep Receiver Safe Check outside BB9");
  assert(!("receiver_check_config" in bb9Schema.properties), "BB9 schema must not absorb receiver_check_config");
  assert(!("declared_checks" in bb9Schema.properties), "BB9 schema must not absorb declared_checks");
  ["node_syntax", "artifact_check", "file_tokens"].forEach((kind) => {
    assert(receiverCheckDoc.includes(kind), `Receiver Safe Check docs missing kind: ${kind}`);
    assert(JSON.stringify(receiverCheckSchema).includes(kind), `Receiver Safe Check schema missing kind: ${kind}`);
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
      relative === "scripts/provider_cache_benchmark.js" ||
      relative === "scripts/generate_bb9_handoff.js" ||
      relative === "scripts/basebrief_build_handoff.js" ||
      relative === "scripts/basebrief_build_adapters.js" ||
      relative === "scripts/basebrief_check_artifacts.js"
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
    "examples/cache-ready-capsule-input.json",
    "examples/cache-ready-capsule-output.md",
    "examples/cache-ready-anchor-input.json",
    "examples/cache-ready-anchor-output.md",
    "examples/cache-ready-anchor-pad-input.json",
    "examples/cache-ready-anchor-pad-output.md",
    "examples/bb9-handoff-full-input.json",
    "examples/bb9-handoff-full-output.md",
    "examples/bb9-handoff-lite-input.json",
    "examples/bb9-handoff-lite-output.md",
    "examples/bb9-handoff-fallback-output.md",
    "examples/structured-handoff-full.md",
    "examples/structured-handoff-lite.md",
    "examples/adapter-codex-task.md",
    "examples/adapter-claude-project-context.md",
    "examples/seal-before-input.json",
    "examples/seal-after-input.json",
    "examples/next-chat-example.md",
    "examples/receiver-check-config.json",
    "examples/receiver/difference-found/README.md",
    "examples/receiver/difference-found/receiver-check-config.json",
    "examples/receiver/difference-found/receiver-check-result.json",
    "examples/receiver/blocked/README.md",
    "examples/receiver/blocked/blocked-result.json",
    "examples/receiver/language-routing/README.md",
    "examples/receiver/language-routing/receiver-report.md",
    "examples/receiver-flow/clean-repo/README.md",
    "examples/receiver-flow/clean-repo/flow-summary.json",
    "examples/receiver-flow/clean-repo/receiver-check.json",
    "examples/receiver-flow/clean-repo/draft-context.md",
    "examples/receiver-flow/dirty-repo/README.md",
    "examples/receiver-flow/dirty-repo/flow-summary.json",
    "examples/receiver-flow/dirty-repo/receiver-check.json",
    "examples/receiver-flow/dirty-repo/draft-context.md",
    "examples/receiver-flow/visible-output/README.md",
    "examples/receiver-flow/visible-output/flow-summary.json",
    "examples/receiver-flow/visible-output/receiver-check.json",
    "examples/receiver-flow/visible-output/draft-context.md",
    "examples/agent-task-example.md",
    "examples/minimal/README.md",
    "examples/minimal/input-project-notes.md",
    "examples/minimal/output-basebrief-lite.md",
    "examples/minimal/next-chat-prompt.md",
  ];
  exampleFiles.forEach((relativePath) => {
    assert(fs.existsSync(path.join(repoRoot, relativePath)), `Missing example: ${relativePath}`);
  });
  return exampleFiles.length;
}

function checkArtifactChecker() {
  const inputs = [
    "examples/structured-handoff-full.md",
    "examples/structured-handoff-lite.md",
    "examples/adapter-codex-task.md",
    "examples/adapter-claude-project-context.md",
    "examples/minimal",
    "docs/known-limitations.md",
    "docs/dogfooding/v0.2.2-first-run-workflow.md",
    "docs/dogfooding/receiver-ready-v1-evidence.md",
    "docs/dogfooding/receiver-friction-log.md",
    "docs/dogfooding/receiver-flow-dogfooding.md",
    "docs/dogfooding/receiver-flow-guided-dogfooding.md",
    "docs/baselines/v0.4.0-post-release-baseline.md",
    "docs/testing-v0.4.x-test-matrix.md",
    "docs/receiver-check.md",
    "docs/receiver-flow.md",
    "docs/releases/v0.3.0.md",
    "docs/releases/v0.3.1.md",
    "docs/releases/v0.3.2.md",
    "docs/releases/v0.3.3.md",
    "docs/releases/v0.4.0.md",
    "docs/releases/v0.4.1.md",
    "docs/releases/v0.5.0.md",
    "examples/receiver-check-config.json",
    "examples/receiver/difference-found",
    "examples/receiver/blocked",
    "examples/receiver/language-routing",
    "examples/receiver-flow/clean-repo",
    "examples/receiver-flow/dirty-repo",
    "examples/receiver-flow/visible-output",
    ".github/ISSUE_TEMPLATE/usability_feedback.md",
  ];
  inputs.forEach((relativePath) => {
    const stdout = execFileSync(process.execPath, [
      "scripts/basebrief_check_artifacts.js",
      "--input",
      relativePath,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const result = JSON.parse(stdout);
    assert(result.status === "passed", `Artifact checker must pass for ${relativePath}`);
    assert(result.errorCount === 0, `Artifact checker must report zero errors for ${relativePath}`);
    assert(result.warningCount === 0, `Artifact checker must report zero warnings for ${relativePath}`);
    assert(Array.isArray(result.findings), `Artifact checker must return findings array for ${relativePath}`);
  });
  return inputs.length;
}

function validateCliStarter(input) {
  const schema = readJson("schemas/bb9-handoff.schema.json");
  schema.required.forEach((key) => {
    assert(key in input, `CLI starter missing required key: ${key}`);
  });
  Object.keys(input).forEach((key) => {
    assert(key in schema.properties, `CLI starter has unexpected key: ${key}`);
  });
  assert(input.mode === "full", "CLI starter should default to full mode");
  assert(input.provider_profile === "unknown", "CLI starter should default to unknown provider profile");
}

function checkCliLite() {
  const tempRoot = fs.mkdtempSync(path.join(repoRoot, "tests", "outputs", "private", "release-cli-"));
  try {
    const helpStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "--help",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    assert(helpStdout.includes("BaseBrief CLI Lite"), "CLI help must identify CLI Lite");
    assert(helpStdout.includes("docs/quickstart-5min.md"), "CLI help must link to the quickstart");
    assert(helpStdout.includes("receiver-init --repo <target-repo> --output <receiver-check.json>"), "CLI help must expose Receiver init");
    assert(helpStdout.includes("receiver-check --config <json> --repo <target-repo>"), "CLI help must expose Receiver Safe Check");
    assert(helpStdout.includes("receiver-flow --repo <target-repo> --output-dir <dir>"), "CLI help must expose Receiver Flow Draft");

    const noCommandStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    assert(noCommandStdout === helpStdout, "CLI without a command must print the same help");

    const initDir = path.join(tempRoot, "init");
    const initStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "init",
      "--output-dir",
      initDir,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const initResult = JSON.parse(initStdout);
    assert(initResult.command === "init", "CLI init must return command metadata");
    const starterPath = path.join(initDir, "basebrief-handoff-input.json");
    assert(fs.existsSync(starterPath), "CLI init must write starter handoff input");
    validateCliStarter(JSON.parse(fs.readFileSync(starterPath, "utf8")));

    const buildDir = path.join(tempRoot, "build");
    const buildStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "build",
      "--input",
      "examples/structured-handoff-full.md",
      "--output-dir",
      buildDir,
      "--provider-profile",
      "relay-openai-gpt55-codex-oauth",
      "--adapters",
      "all",
      "--check",
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const buildResult = JSON.parse(buildStdout);
    assert(buildResult.command === "build", "CLI build must return command metadata");
    assert(buildResult.handoff.outputFiles.readableBrief, "CLI build must report readableBrief");
    assert(buildResult.handoff.outputFiles.activeProviderPrompt, "CLI build must report activeProviderPrompt");
    assert(buildResult.handoff.outputFiles.meta, "CLI build must report handoff metadata");
    assert(buildResult.adapters.targets.length === 2, "CLI build --adapters all must report two targets");
    assert(buildResult.check.status === "passed", "CLI build --check must pass for public-safe structured example");
    assert(fs.existsSync(path.join(buildDir, "readableBrief.md")), "CLI build must write readableBrief");
    assert(fs.existsSync(path.join(buildDir, "adapters", "codex-task.md")), "CLI build must write Codex adapter");
    assert(fs.existsSync(path.join(buildDir, "adapters", "claude-project-context.md")), "CLI build must write Claude adapter");

    const checkStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "check",
      "--input",
      "examples/adapter-codex-task.md",
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const checkResult = JSON.parse(checkStdout);
    assert(checkResult.command === "check", "CLI check must return command metadata");
    assert(checkResult.check.status === "passed", "CLI check must delegate to artifact checker");
    assert(Array.isArray(checkResult.check.findings), "CLI check must return checker findings array");

    const receiverRepo = path.join(tempRoot, "receiver-repo");
    fs.mkdirSync(receiverRepo);
    git(receiverRepo, ["init"]);
    git(receiverRepo, ["config", "user.email", "basebrief@example.invalid"]);
    git(receiverRepo, ["config", "user.name", "BaseBrief Release Check"]);
    fs.writeFileSync(path.join(receiverRepo, "safe.js"), "const safe = true;\n", "utf8");
    git(receiverRepo, ["add", "."]);
    git(receiverRepo, ["commit", "-m", "fixture"]);
    const receiverConfigPath = path.join(tempRoot, "receiver-check.json");
    const receiverInitStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "receiver-init",
      "--repo",
      receiverRepo,
      "--output",
      receiverConfigPath,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const receiverInitResult = JSON.parse(receiverInitStdout);
    assert(receiverInitResult.command === "receiver-init", "CLI receiver-init must return command metadata");
    assert(receiverInitResult.config.declared_checks.length === 0, "CLI receiver-init must create state-only config");
    const receiverStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "receiver-check",
      "--config",
      receiverConfigPath,
      "--repo",
      receiverRepo,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const receiverResult = JSON.parse(receiverStdout);
    assert(receiverResult.command === "receiver-check", "CLI receiver-check must return command metadata");
    assert(receiverResult.result.handoff_acceptance === "pass", "CLI receiver-check must pass for matching fixture");

    const receiverFlowDir = path.join(tempRoot, "receiver-flow");
    const receiverFlowStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "receiver-flow",
      "--repo",
      receiverRepo,
      "--output-dir",
      receiverFlowDir,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const receiverFlowResult = JSON.parse(receiverFlowStdout);
    assert(receiverFlowResult.command === "receiver-flow", "CLI receiver-flow must return command metadata");
    assert(receiverFlowResult.handoff_status === "draft_needs_review", "CLI receiver-flow must return draft status");
    assert(receiverFlowResult.outputDir.startsWith("tests"), "CLI receiver-flow must return a public-safe relative output dir");
    assert(receiverFlowResult.outputFiles.flowSummary.endsWith("flow-summary.json"), "CLI receiver-flow must report flow summary path");
    assert(receiverFlowResult.outputFiles.receiverCheckConfig.endsWith("receiver-check.json"), "CLI receiver-flow must report receiver-check path");
    assert(receiverFlowResult.outputFiles.draftContext.endsWith("draft-context.md"), "CLI receiver-flow must report draft context path");
    assert(fs.existsSync(path.join(receiverFlowDir, "flow-summary.json")), "CLI receiver-flow must write flow summary");
    assert(fs.existsSync(path.join(receiverFlowDir, "receiver-check.json")), "CLI receiver-flow must write receiver check config");
    assert(fs.existsSync(path.join(receiverFlowDir, "draft-context.md")), "CLI receiver-flow must write draft context");

    const warningPath = path.join(tempRoot, "codex-task.md");
    fs.writeFileSync(warningPath, [
      "# BaseBrief Codex Task",
      "",
      "## Risk Boundaries",
      "- keep the task bounded",
      "",
    ].join("\n"), "utf8");
    const warningStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "check",
      "--input",
      warningPath,
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    assert(warningStdout.includes("WARNING artifact.missing-open-questions"), "CLI human output must explain warning findings");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
  return 9;
}

function checkFirstRunWorkflow() {
  const quickstartRoot = path.join(repoRoot, "tests", "outputs", "private", "quickstart");
  fs.rmSync(quickstartRoot, { recursive: true, force: true });
  try {
    const buildDir = path.join(quickstartRoot, "build");
    const buildResult = JSON.parse(execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "build",
      "--input",
      "examples/structured-handoff-lite.md",
      "--output-dir",
      "tests/outputs/private/quickstart/build",
      "--check",
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    }));
    assert(buildResult.check.errorCount === 0, "Quickstart build must report zero errors");
    assert(buildResult.check.warningCount === 0, "Quickstart build must report zero warnings");
    assert(fs.existsSync(path.join(buildDir, "readableBrief.md")), "Quickstart build must write readableBrief");

    const checkResult = JSON.parse(execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "check",
      "--input",
      "tests/outputs/private/quickstart/build",
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    }));
    assert(checkResult.check.errorCount === 0, "Quickstart direct check must report zero errors");
    assert(checkResult.check.warningCount === 0, "Quickstart direct check must report zero warnings");

    const sealPath = path.join(quickstartRoot, "before.json");
    const sealResult = JSON.parse(execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "seal",
      "--input",
      "examples/seal-before-input.json",
      "--output",
      "tests/outputs/private/quickstart/before.json",
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    }));
    assert(sealResult.command === "seal", "Quickstart seal must complete");
    assert(fs.existsSync(sealPath), "Quickstart seal must write the before seal");

    const diffResult = JSON.parse(execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "diff",
      "--before",
      "tests/outputs/private/quickstart/before.json",
      "--after",
      "examples/seal-after-input.json",
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    }));
    assert(diffResult.diff.changed === true, "Quickstart diff must detect changes");
    assert(diffResult.diff.summary.taskBoundaryChanged === true, "Quickstart diff must detect task-boundary changes");

    const receiverConfigPath = path.join(quickstartRoot, "receiver-check.json");
    const receiverInitResult = JSON.parse(execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "receiver-init",
      "--repo",
      ".",
      "--output",
      "tests/outputs/private/quickstart/receiver-check.json",
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    }));
    assert(receiverInitResult.command === "receiver-init", "Quickstart receiver-init must complete");
    assert(fs.existsSync(receiverConfigPath), "Quickstart receiver-init must write config");

    const receiverCheckResult = JSON.parse(execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "receiver-check",
      "--config",
      "tests/outputs/private/quickstart/receiver-check.json",
      "--repo",
      ".",
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    }));
    assert(receiverCheckResult.result.handoff_acceptance === "pass", "Quickstart receiver-check must pass immediately after receiver-init");
  } finally {
    fs.rmSync(quickstartRoot, { recursive: true, force: true });
  }
  return 6;
}

function validateSealShape(seal) {
  assert(seal.schemaVersion === "basebrief-seal-v1", "Seal must use v1 schema");
  assert(seal.sourceSchema === "schemas/bb9-handoff.schema.json", "Seal must reference BB9 handoff schema");
  assert(seal.handoff && Array.isArray(seal.handoff.verified_facts), "Seal must contain canonical handoff facts");
  assert(seal.checksums && /^[a-f0-9]{64}$/.test(seal.checksums.overall), "Seal must contain overall checksum");
  assert(seal.checksums.sections && /^[a-f0-9]{64}$/.test(seal.checksums.sections.risk_boundaries), "Seal must contain section checksums");
}

function checkSealDiff() {
  const tempRoot = fs.mkdtempSync(path.join(repoRoot, "tests", "outputs", "private", "release-seal-"));
  try {
    const sealPath = path.join(tempRoot, "seal-before.json");
    const sealStdout = execFileSync(process.execPath, [
      "scripts/basebrief_seal.js",
      "seal",
      "--input",
      "examples/seal-before-input.json",
      "--output",
      sealPath,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const sealResult = JSON.parse(sealStdout);
    assert(sealResult.command === "seal", "Seal script must return seal command metadata");
    validateSealShape(JSON.parse(fs.readFileSync(sealPath, "utf8")));

    const diffStdout = execFileSync(process.execPath, [
      "scripts/basebrief_seal.js",
      "diff",
      "--before",
      sealPath,
      "--after",
      "examples/seal-after-input.json",
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const diffResult = JSON.parse(diffStdout);
    assert(diffResult.command === "diff", "Seal script must return diff command metadata");
    assert(diffResult.diff.changed === true, "Seal diff must detect changes");
    assert(diffResult.diff.summary.taskBoundaryChanged === true, "Seal diff must detect task-boundary changes");
    assert(diffResult.diff.fields.verified_facts.added.length >= 1, "Seal diff must report added facts");

    const cliDiffStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "diff",
      "--before",
      "examples/seal-before-input.json",
      "--after",
      "examples/seal-after-input.json",
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const cliDiffResult = JSON.parse(cliDiffStdout);
    assert(cliDiffResult.command === "diff", "CLI Lite must expose diff command");
    assert(cliDiffResult.diff.changedFields.includes("tail_request"), "CLI diff must report changed tail request");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
  return 3;
}

function checkBenchmarkSummaryIfPresent() {
  const summaries = [
    "tests/outputs/provider-cache-benchmark.latest.json",
    "tests/outputs/provider-cache-benchmark-normalized.latest.json",
    "tests/outputs/provider-cache-benchmark-capsule.latest.json",
    "tests/outputs/provider-cache-benchmark-anchor.latest.json",
    "tests/outputs/provider-cache-benchmark-anchorpad.latest.json",
    "tests/outputs/provider-cache-benchmark-padsweep.latest.json",
    "tests/outputs/provider-cache-benchmark-padsweep-deepseek.latest.json",
    "tests/outputs/provider-cache-benchmark-readable-poc.latest.json",
    "tests/outputs/provider-cache-benchmark-readable-poc-deepseek.latest.json",
    "tests/outputs/provider-cache-benchmark-active-prompt-poc.latest.json",
    "tests/outputs/provider-cache-benchmark-active-prompt-poc-deepseek.latest.json",
    "tests/outputs/provider-cache-benchmark-active-prompt-trim-poc.latest.json",
    "tests/outputs/provider-cache-benchmark-active-prompt-trim-poc-deepseek.latest.json",
    "tests/outputs/provider-cache-benchmark-bb12-guard-poc.latest.json",
    "tests/outputs/provider-cache-benchmark-bb12-guard-poc-deepseek.latest.json",
    "tests/outputs/provider-cache-benchmark-handoff-poc.latest.json",
    "tests/outputs/provider-cache-benchmark-handoff-poc-deepseek.latest.json",
    "tests/outputs/provider-cache-benchmark-sidecar.latest.json",
    "tests/outputs/provider-cache-benchmark-sidecar-deepseek.latest.json",
    "tests/outputs/provider-cache-benchmark-hybrid.latest.json",
    "tests/outputs/provider-cache-benchmark-hybrid-deepseek.latest.json",
    "tests/outputs/provider-cache-benchmark-blockpad.latest.json",
    "tests/outputs/provider-cache-benchmark-blockpad-deepseek.latest.json",
    "tests/outputs/provider-cache-benchmark-blockalign.latest.json",
    "tests/outputs/provider-cache-benchmark-blockalign-deepseek.latest.json",
    "tests/outputs/provider-relay-usage-audit.latest.json",
  ];
  const statuses = [];
  summaries.forEach((relativePath) => {
    const fullPath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(fullPath)) {
      return;
    }
    const summary = readJson(relativePath);
    const isRelayAudit = relativePath.includes("provider-relay-usage-audit");
    assert(
      summary.benchmarkKind === (isRelayAudit ? "relay-usage-audit-redacted" : "local-real-projects-redacted"),
      "Benchmark summary must be public-redacted",
    );
    if (!isRelayAudit) {
      assert(summary.projectCount >= 1, "Benchmark summary must include project count");
    }
    assert(summary.requestCount >= summary.validRequestCount, "Benchmark summary request counts are inconsistent");
    assert(!JSON.stringify(summary).match(/[A-Z]:\\|\/home\/|sk-[A-Za-z0-9]{10,}/), "Benchmark summary contains private path or key-like content");
    statuses.push(`${summary.mode || summary.providerProfileId || "absolute"}:${summary.conclusionLevel || summary.usageInterpretation || "present"}`);
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
  const capsuleA = generateCapsuleFromObject(readJson("tests/fixtures/cache-ready/cache-ready-a.json"));
  const capsuleShuffled = generateCapsuleFromObject(readJson("tests/fixtures/cache-ready/cache-ready-shuffled.json"));
  const capsuleFollowupA = generateCapsuleFromObject(readJson("tests/fixtures/cache-ready/cache-ready-followup-a.json"));
  const capsuleFollowupB = generateCapsuleFromObject(readJson("tests/fixtures/cache-ready/cache-ready-followup-b.json"));
  const anchorInputA = readJson("examples/cache-ready-anchor-input.json");
  const anchorInputB = { ...anchorInputA, tail_choice: "B" };
  const anchorA = generateAnchorFromObject(anchorInputA);
  const anchorB = generateAnchorFromObject(anchorInputB);
  const anchorPadInput = readJson("examples/cache-ready-anchor-pad-input.json");
  const anchorPadA = generateAnchorFromObject(anchorPadInput);

  const sameProjectNatural = measureContents([naturalA, naturalB]);
  const sameProjectCache = measureContents([cacheA, cacheB]);
  const crossProjectNatural = measureContents([naturalA, naturalC]);
  const crossProjectCache = measureContents([cacheA, cacheC]);
  const followupNatural = measureContents([followupA, followupB]);
  const followupCache = measureContents([cacheFollowupA, cacheFollowupB]);
  const shuffledConsistency = measureContents([cacheA, cacheShuffled]);
  const capsuleShuffledConsistency = measureContents([capsuleA, capsuleShuffled]);
  const capsuleFollowup = measureContents([capsuleFollowupA, capsuleFollowupB]);
  const capsuleReduction = (cacheA.length - capsuleA.length) / cacheA.length;
  const anchorFollowup = measureContents([anchorA, anchorB]);

  assert(sameProjectCache.commonPrefixChars > sameProjectNatural.commonPrefixChars, "Cache-ready should improve same-project shared prefix");
  assert(crossProjectCache.commonPrefixChars > crossProjectNatural.commonPrefixChars, "Cache-ready should improve cross-project shared prefix");
  assert(followupCache.commonPrefixChars >= followupNatural.commonPrefixChars, "Cache-ready should not regress repeated follow-up shared prefix");
  assert(followupCache.changedSections.includes("TAIL_REQUEST"), "Follow-up comparison should report TAIL_REQUEST as changed");
  assert(followupCache.fieldOrderConsistent, "Cache-ready follow-up outputs should keep field order stable");
  assert(shuffledConsistency.exactMatch, "Shuffled input keys should generate the same output");
  assert(shuffledConsistency.fieldOrderConsistent, "Shuffled input keys must not change generated field order");
  assert(capsuleShuffledConsistency.exactMatch, "Capsule shuffled input keys should generate the same output");
  const capsuleTailIndex = capsuleFollowupA.indexOf("\nT=");
  assert(capsuleTailIndex > 0, "Capsule output should contain a T tail field");
  assert(capsuleFollowup.commonPrefixChars >= capsuleTailIndex + 3, "Capsule follow-up should keep all fields before T stable");
  assert(capsuleReduction >= 0.25, "Capsule v2 should be at least 25% shorter than cache-ready v1 for the same input");
  const anchorTailIndex = anchorA.indexOf("\nQ=");
  assert(anchorTailIndex > 0, "Anchor output should contain a Q tail field");
  assert(anchorA.includes("\nQAA=") && anchorA.includes("\nQAB="), "Anchor output should pre-register request options");
  assert(anchorFollowup.commonPrefixChars >= anchorTailIndex + 3, "Anchor follow-up should keep all fields before Q stable");
  assert(anchorPadA.includes("\nPAD=p p p p p p p p\n--\nQ=A"), "Anchor pad output should keep PAD stable before Q");

  let missingFieldRejected = false;
  try {
    generateFromObject(readJson("tests/fixtures/cache-ready/cache-ready-missing.json"));
  } catch (error) {
    missingFieldRejected = /Missing required key: tail_request/i.test(error.message);
  }
  assert(missingFieldRejected, "Missing field input must be rejected by cache-ready generator");
  let capsuleMissingFieldRejected = false;
  try {
    generateCapsuleFromObject(readJson("tests/fixtures/cache-ready/cache-ready-missing.json"));
  } catch (error) {
    capsuleMissingFieldRejected = /Missing required key: tail_request/i.test(error.message);
  }
  assert(capsuleMissingFieldRejected, "Missing field input must be rejected by cache-ready capsule generator");
  let anchorInvalidChoiceRejected = false;
  try {
    generateAnchorFromObject({ ...anchorInputA, tail_choice: "Z" });
  } catch (error) {
    anchorInvalidChoiceRejected = /tail_choice must be one of/i.test(error.message);
  }
  assert(anchorInvalidChoiceRejected, "Invalid tail choice must be rejected by cache-ready anchor generator");
  let anchorPadMissingPadRejected = false;
  try {
    const missingPad = { ...anchorPadInput };
    delete missingPad.cache_pad;
    generateAnchorFromObject(missingPad);
  } catch (error) {
    anchorPadMissingPadRejected = /Missing required key: cache_pad/i.test(error.message);
  }
  assert(anchorPadMissingPadRejected, "Anchor-pad v4 input must require cache_pad");

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
    capsuleReduction,
    missingFieldRejected,
    capsuleMissingFieldRejected,
    anchorInvalidChoiceRejected,
    anchorPadMissingPadRejected,
  };
}

async function main() {
  checkRequiredFiles();
  checkContentContracts();
  const modeCases = checkModeRouting();
  const scannedFiles = checkSecurity();
  const checkedLinks = checkLinks();
  const exampleCount = checkExamples();
  const artifactCheckInputs = checkArtifactChecker();
  const cliLiteCommands = checkCliLite();
  const firstRunCommands = checkFirstRunWorkflow();
  const sealDiffCommands = checkSealDiff();
  const benchmarkSummaryStatus = checkBenchmarkSummaryIfPresent();
  const independentTests = checkIndependentTests();
  const proxy = checkCacheReadyProxy();
  const providerProbe = await runProviderProbe();

  console.log("BaseBrief release checks passed.");
  console.log(`mode_cases=${modeCases}`);
  console.log(`scanned_files=${scannedFiles}`);
  console.log(`checked_links=${checkedLinks}`);
  console.log(`example_files=${exampleCount}`);
  console.log(`artifact_check_inputs=${artifactCheckInputs}`);
  console.log(`cli_lite_commands=${cliLiteCommands}`);
  console.log(`first_run_commands=${firstRunCommands}`);
  console.log(`seal_diff_commands=${sealDiffCommands}`);
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
  console.log(`cache_ready_capsule_reduction=${proxy.capsuleReduction}`);
  console.log(`cache_ready_missing_field_rejected=${proxy.missingFieldRejected}`);
  console.log(`cache_ready_capsule_missing_field_rejected=${proxy.capsuleMissingFieldRejected}`);
  console.log(`cache_ready_anchor_invalid_choice_rejected=${proxy.anchorInvalidChoiceRejected}`);
  console.log(`cache_ready_anchor_pad_missing_pad_rejected=${proxy.anchorPadMissingPadRejected}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
