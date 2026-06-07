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
    "docs/dogfooding/receiver-flow-review-draft-dogfooding.md",
    "docs/dogfooding/receiver-flow-extract-dogfooding.md",
    "docs/dogfooding/receiver-flow-v0.5.x-closure.md",
    "docs/dogfooding/project-state-dogfooding.md",
    "docs/dogfooding/project-state-self-dogfooding-v0.6.x.md",
    "docs/dogfooding/project-state-self-dogfooding-v0.6.2.md",
    "docs/dogfooding/project-state-lifecycle-readiness-v0.6.3.md",
    "docs/dogfooding/project-state-lifecycle-v0.7.0.md",
    "docs/dogfooding/sidecar-receiver-acceptance-v0.8.2.md",
    "docs/dogfooding/sidecar-external-receiver-smoke-v0.8.4.md",
    "docs/dogfooding/sidecar-manual-receiver-smoke-v0.8.5.md",
    "docs/dogfooding/sidecar-manual-receiver-smoke-v0.8.6.md",
    "docs/dogfooding/sidecar-openclaw-hermes-manual-smoke-followup.md",
    "docs/dogfooding/delta-handoff-fresh-receiver-v1.0.md",
    "docs/dogfooding/delta-handoff-baseline-advance-v1.0.md",
    "docs/dogfooding/delta-receiver-acceptance-v1.1.md",
    "docs/integrations.md",
    "docs/adapters.md",
    "docs/walkthrough.md",
    "docs/mode-selection.md",
    "docs/handoff.md",
    "docs/checks.md",
    "docs/receiver-check.md",
    "docs/receiver-flow.md",
    "docs/project-state.md",
    "docs/baselines/v0.4.0-post-release-baseline.md",
    "docs/baselines/v0.6.0-post-release-baseline.md",
    "docs/design/project-state-model.md",
    "docs/design/project-state-validation-rules.md",
    "docs/design/project-state-lifecycle-readiness.md",
    "docs/design/project-state-lifecycle-model.md",
    "docs/releases/v0.3.0.md",
    "docs/releases/v0.3.1.md",
    "docs/releases/v0.3.2.md",
    "docs/releases/v0.3.3.md",
    "docs/releases/v0.4.0.md",
    "docs/releases/v0.4.1.md",
    "docs/releases/v0.5.0.md",
    "docs/releases/v0.5.1.md",
    "docs/releases/v0.5.2.md",
    "docs/releases/v0.5.3.md",
    "docs/releases/v0.6.0.md",
    "docs/releases/v0.6.2.md",
    "docs/releases/v0.6.3.md",
    "docs/releases/v0.7.0.md",
    "docs/releases/v0.8.0.md",
    "docs/releases/v0.8.1.md",
    "docs/releases/v0.8.2.md",
    "docs/releases/v0.8.3.md",
    "docs/releases/v0.8.4.md",
    "docs/releases/v0.8.5.md",
    "docs/releases/v0.8.6.md",
    "docs/releases/v0.8.7.md",
    "docs/releases/v0.8.8.md",
    "docs/releases/v0.9.0.md",
    "docs/releases/v0.9.1.md",
    "docs/releases/v0.9.2.md",
    "docs/releases/v0.9.3.md",
    "docs/releases/v1.0.0.md",
    "docs/releases/v1.0.0-plan.md",
    "docs/releases/v1.0.0-rc-review.md",
    "docs/releases/v1.0.1.md",
    "docs/releases/v1.1.0.md",
    "docs/releases/v1.1.0-plan.md",
    "docs/specs/delta-handoff.md",
    "docs/testing-v0.4.x-test-matrix.md",
    "docs/testing-v0.6.x-test-matrix.md",
    "docs/testing-v0.7.x-test-matrix.md",
    "docs/testing-v0.8.x-test-matrix.md",
    "docs/testing-v0.9.x-test-matrix.md",
    "docs/cli-lite.md",
    "docs/golden-path.md",
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
    "scripts/basebrief_review_draft.js",
    "scripts/basebrief_project_state.js",
    "scripts/basebrief_sidecar.js",
    "scripts/basebrief_seal.js",
    "scripts/basebrief_delta.js",
    "scripts/bb9_provider_profiles.json",
    "schemas/bb9-handoff.schema.json",
    "schemas/basebrief-receiver-check.schema.json",
    "schemas/basebrief-receiver-check-result.schema.json",
    "schemas/basebrief-project-state.schema.json",
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
    "examples/delta-handoff.md",
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
    "examples/receiver-flow-review/valid-ready/README.md",
    "examples/receiver-flow-review/valid-ready/draft-context.md",
    "examples/receiver-flow-review/valid-ready/receiver-ready.md",
    "examples/receiver-flow-review/rejected-candidate/README.md",
    "examples/receiver-flow-review/rejected-candidate/draft-context.md",
    "examples/receiver-flow-review/rejected-empty/README.md",
    "examples/receiver-flow-review/rejected-empty/draft-context.md",
    "examples/project-state/README.md",
    "examples/project-state/state.json",
    "examples/agent-task-example.md",
    "examples/golden-path/README.md",
    "examples/golden-path/receiver-ready.md",
    "examples/golden-path/state-reference.md",
    "examples/golden-path/first-pass-receiver-report.md",
    "examples/golden-path/follow-up-receiver-report.md",
    "examples/golden-path/sidecar-output-boundary.md",
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
  const receiverDifferenceExampleReadme = readText("examples/receiver/difference-found/README.md");
  const receiverBlockedExampleReadme = readText("examples/receiver/blocked/README.md");
  const receiverLanguageRoutingExampleReadme = readText("examples/receiver/language-routing/README.md");
  const receiverLanguageRoutingReport = readText("examples/receiver/language-routing/receiver-report.md");
  const dogfoodingDoc = readText("docs/dogfooding/v0.2.2-first-run-workflow.md");
  const receiverReadyDogfoodingDoc = readText("docs/dogfooding/receiver-ready-v1-evidence.md");
  const receiverFrictionDoc = readText("docs/dogfooding/receiver-friction-log.md");
  const receiverFlowDogfoodingDoc = readText("docs/dogfooding/receiver-flow-dogfooding.md");
  const receiverFlowGuidedDogfoodingDoc = readText("docs/dogfooding/receiver-flow-guided-dogfooding.md");
  const receiverFlowReviewDraftDogfoodingDoc = readText("docs/dogfooding/receiver-flow-review-draft-dogfooding.md");
  const receiverFlowExtractDogfoodingDoc = readText("docs/dogfooding/receiver-flow-extract-dogfooding.md");
  const receiverFlowClosureDogfoodingDoc = readText("docs/dogfooding/receiver-flow-v0.5.x-closure.md");
  const projectStateDogfoodingDoc = readText("docs/dogfooding/project-state-dogfooding.md");
  const projectStateSelfDogfoodingDoc = readText("docs/dogfooding/project-state-self-dogfooding-v0.6.x.md");
  const projectStateSelfDogfoodingV062Doc = readText("docs/dogfooding/project-state-self-dogfooding-v0.6.2.md");
  const projectStateLifecycleReadinessDogfoodingDoc = readText("docs/dogfooding/project-state-lifecycle-readiness-v0.6.3.md");
  const projectStateLifecycleDogfoodingV070Doc = readText("docs/dogfooding/project-state-lifecycle-v0.7.0.md");
  const basebriefSelfValidationPreV08Doc = readText("docs/dogfooding/basebrief-self-validation-pre-v0.8.md");
  const preV08FrictionLogDoc = readText("docs/dogfooding/pre-v0.8-friction-log.md");
  const sidecarReceiverAcceptanceV082Doc = readText("docs/dogfooding/sidecar-receiver-acceptance-v0.8.2.md");
  const sidecarExternalReceiverSmokeV084Doc = readText("docs/dogfooding/sidecar-external-receiver-smoke-v0.8.4.md");
  const sidecarManualReceiverSmokeV085Doc = readText("docs/dogfooding/sidecar-manual-receiver-smoke-v0.8.5.md");
  const sidecarManualReceiverSmokeV086Doc = readText("docs/dogfooding/sidecar-manual-receiver-smoke-v0.8.6.md");
  const sidecarOpenClawHermesManualSmokeFollowupDoc = readText("docs/dogfooding/sidecar-openclaw-hermes-manual-smoke-followup.md");
  const deltaHandoffFreshReceiverDoc = readText("docs/dogfooding/delta-handoff-fresh-receiver-v1.0.md");
  const deltaHandoffBaselineAdvanceDoc = readText("docs/dogfooding/delta-handoff-baseline-advance-v1.0.md");
  const deltaReceiverAcceptanceDoc = readText("docs/dogfooding/delta-receiver-acceptance-v1.1.md");
  const testingDoc = readText("docs/testing.md");
  const usabilityFeedbackTemplate = readText(".github/ISSUE_TEMPLATE/usability_feedback.md");
  const adaptersDoc = readText("docs/adapters.md");
  const walkthroughDoc = readText("docs/walkthrough.md");
  const modeSelectionDoc = readText("docs/mode-selection.md");
  const handoffDoc = readText("docs/handoff.md");
  const goldenPathDoc = readText("docs/golden-path.md");
  const checksDoc = readText("docs/checks.md");
  const receiverCheckDoc = readText("docs/receiver-check.md");
  const receiverFlowDoc = readText("docs/receiver-flow.md");
  const projectStateDoc = readText("docs/project-state.md");
  const releaseCandidateDoc = readText("docs/releases/v0.3.0.md");
  const receiverStabilizationReleaseDoc = readText("docs/releases/v0.3.1.md");
  const receiverFlowReleaseDoc = readText("docs/releases/v0.3.2.md");
  const receiverFlowDogfoodingReleaseDoc = readText("docs/releases/v0.3.3.md");
  const integratedToolchainReleaseDoc = readText("docs/releases/v0.4.0.md");
  const stabilizationCandidateDoc = readText("docs/releases/v0.4.1.md");
  const guidedReceiverFlowReleaseDoc = readText("docs/releases/v0.5.0.md");
  const reviewDraftReleaseDoc = readText("docs/releases/v0.5.1.md");
  const extractReceiverFlowReleaseDoc = readText("docs/releases/v0.5.2.md");
  const receiverFlowClosureReleaseDoc = readText("docs/releases/v0.5.3.md");
  const projectStateReleaseDoc = readText("docs/releases/v0.6.0.md");
  const projectStateV062ReleaseDoc = readText("docs/releases/v0.6.2.md");
  const projectStateV063ReleaseDoc = readText("docs/releases/v0.6.3.md");
  const projectStateV070ReleaseDoc = readText("docs/releases/v0.7.0.md");
  const sidecarV080ReleaseDoc = readText("docs/releases/v0.8.0.md");
  const sidecarV081ReleaseDoc = readText("docs/releases/v0.8.1.md");
  const sidecarV082ReleaseDoc = readText("docs/releases/v0.8.2.md");
  const sidecarV083ReleaseDoc = readText("docs/releases/v0.8.3.md");
  const sidecarV084ReleaseDoc = readText("docs/releases/v0.8.4.md");
  const sidecarV085ReleaseDoc = readText("docs/releases/v0.8.5.md");
  const sidecarV086ReleaseDoc = readText("docs/releases/v0.8.6.md");
  const sidecarV087ReleaseDoc = readText("docs/releases/v0.8.7.md");
  const sidecarV088ReleaseDoc = readText("docs/releases/v0.8.8.md");
  const readinessV090ReleaseDoc = readText("docs/releases/v0.9.0.md");
  const goldenPathV091ReleaseDoc = readText("docs/releases/v0.9.1.md");
  const goldenPathExampleV092ReleaseDoc = readText("docs/releases/v0.9.2.md");
  const closureV093ReleaseDoc = readText("docs/releases/v0.9.3.md");
  const deltaV100ReleaseDoc = readText("docs/releases/v1.0.0.md");
  const v100PlanDoc = readText("docs/releases/v1.0.0-plan.md");
  const v100RcReviewDoc = readText("docs/releases/v1.0.0-rc-review.md");
  const v101ReleaseDoc = readText("docs/releases/v1.0.1.md");
  const v110ReleaseDoc = readText("docs/releases/v1.1.0.md");
  const v110PlanDoc = readText("docs/releases/v1.1.0-plan.md");
  const deltaHandoffSpecDoc = readText("docs/specs/delta-handoff.md");
  const postReleaseBaselineDoc = readText("docs/baselines/v0.4.0-post-release-baseline.md");
  const v060PostReleaseBaselineDoc = readText("docs/baselines/v0.6.0-post-release-baseline.md");
  const projectStateModelDoc = readText("docs/design/project-state-model.md");
  const projectStateValidationRulesDoc = readText("docs/design/project-state-validation-rules.md");
  const projectStateLifecycleReadinessDoc = readText("docs/design/project-state-lifecycle-readiness.md");
  const projectStateLifecycleModelDoc = readText("docs/design/project-state-lifecycle-model.md");
  const testMatrixDoc = readText("docs/testing-v0.4.x-test-matrix.md");
  const v06xTestMatrixDoc = readText("docs/testing-v0.6.x-test-matrix.md");
  const v07xTestMatrixDoc = readText("docs/testing-v0.7.x-test-matrix.md");
  const v08xTestMatrixDoc = readText("docs/testing-v0.8.x-test-matrix.md");
  const v09xTestMatrixDoc = readText("docs/testing-v0.9.x-test-matrix.md");
  const cliLiteDoc = readText("docs/cli-lite.md");
  const sealDiffDoc = readText("docs/seal-diff.md");
  const contextOpsDoc = readText("docs/contextops.md");
  const roadmapDoc = readText("docs/roadmap/basebrief-long-term-baseline.md");
  const bb9Schema = readJson("schemas/bb9-handoff.schema.json");
  const receiverCheckSchema = readJson("schemas/basebrief-receiver-check.schema.json");
  const receiverCheckResultSchema = readJson("schemas/basebrief-receiver-check-result.schema.json");
  const projectStateSchema = readJson("schemas/basebrief-project-state.schema.json");
  const receiverCheckConfigExample = readJson("examples/receiver-check-config.json");
  const projectStateExample = readJson("examples/project-state/state.json");
  const sealSchema = readJson("schemas/basebrief-seal.schema.json");
  const providerProfiles = readJson("scripts/bb9_provider_profiles.json");
  const deltaHandoffExample = readText("examples/delta-handoff.md");
  const structuredFullExample = readText("examples/structured-handoff-full.md");
  const structuredLiteExample = readText("examples/structured-handoff-lite.md");
  const goldenPathExampleReadme = readText("examples/golden-path/README.md");
  const goldenPathExampleReady = readText("examples/golden-path/receiver-ready.md");
  const goldenPathExampleStateReference = readText("examples/golden-path/state-reference.md");
  const goldenPathExampleFirstPass = readText("examples/golden-path/first-pass-receiver-report.md");
  const goldenPathExampleFollowUp = readText("examples/golden-path/follow-up-receiver-report.md");
  const goldenPathExampleBoundary = readText("examples/golden-path/sidecar-output-boundary.md");
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
  assert(readme.includes("docs/golden-path.md"), "README.md should link to golden path docs");
  assert(readme.includes("docs/cli-lite.md"), "README.md should link to CLI Lite docs");
  assert(readme.includes("docs/receiver-check.md"), "README.md should link to Receiver Safe Check docs");
  assert(readme.includes("docs/receiver-flow.md"), "README.md should link to Receiver Flow Draft docs");
  assert(readme.includes("docs/project-state.md"), "README.md should link to Project State docs");
  assert(readme.includes("receiver-flow"), "README.md should mention receiver-flow command");
  assert(readme.includes("sidecar-build"), "README.md should mention sidecar-build command");
  assert(readme.includes("sidecar-check"), "README.md should mention sidecar-check command");
  assert(readme.includes("generic"), "README.md should mention generic sidecar target");
  assert(readme.includes("openclaw"), "README.md should mention openclaw sidecar target");
  assert(readme.includes("basebrief-project-state-v1"), "README.md should mention Project State schema");
  assert(readme.includes("basebrief-sidecar-v1"), "README.md should mention Sidecar schema");
  assert(readme.includes("No provider request"), "README.md should preserve sidecar no-provider boundary");
  assert(readme.includes("No raw private output"), "README.md should preserve sidecar raw-output boundary");
  assert(readme.includes("No runtime integration"), "README.md should preserve sidecar runtime boundary");
  assert(readme.includes("No schema change"), "README.md should preserve sidecar schema boundary");
  assert(readme.includes("provider_probe_status=skipped"), "README.md should preserve skipped provider probe wording");
  assert(readme.includes("docs/dogfooding/receiver-friction-log.md"), "README.md should link to receiver friction log");
  assert(readme.includes("docs/dogfooding/receiver-flow-dogfooding.md"), "README.md should link to receiver-flow dogfooding evidence");
  assert(readme.includes("docs/dogfooding/receiver-flow-guided-dogfooding.md"), "README.md should link to guided receiver-flow dogfooding evidence");
  assert(readme.includes("docs/dogfooding/receiver-flow-review-draft-dogfooding.md"), "README.md should link to review-draft dogfooding evidence");
  assert(readme.includes("docs/dogfooding/receiver-flow-extract-dogfooding.md"), "README.md should link to extract dogfooding evidence");
  assert(readme.includes("docs/dogfooding/receiver-flow-v0.5.x-closure.md"), "README.md should link to v0.5.x closure dogfooding evidence");
  assert(readme.includes("docs/dogfooding/project-state-dogfooding.md"), "README.md should link to project-state dogfooding evidence");
  assert(readme.includes("docs/dogfooding/project-state-self-dogfooding-v0.6.x.md"), "README.md should link to project-state self-dogfooding evidence");
  assert(readme.includes("docs/dogfooding/project-state-self-dogfooding-v0.6.2.md"), "README.md should link to v0.6.2 project-state self-dogfooding evidence");
  assert(readme.includes("docs/dogfooding/project-state-lifecycle-readiness-v0.6.3.md"), "README.md should link to v0.6.3 lifecycle readiness dogfooding");
  assert(readme.includes("docs/dogfooding/project-state-lifecycle-v0.7.0.md"), "README.md should link to v0.7.0 lifecycle dogfooding");
  assert(readme.includes("docs/design/project-state-model.md"), "README.md should link to project-state model docs");
  assert(readme.includes("docs/design/project-state-validation-rules.md"), "README.md should link to project-state validation docs");
  assert(readme.includes("docs/design/project-state-lifecycle-readiness.md"), "README.md should link to project-state lifecycle readiness docs");
  assert(readme.includes("docs/design/project-state-lifecycle-model.md"), "README.md should link to project-state lifecycle model docs");
  assert(readme.includes("docs/baselines/v0.6.0-post-release-baseline.md"), "README.md should link to v0.6.0 post-release baseline");
  assert(readme.includes("docs/testing-v0.6.x-test-matrix.md"), "README.md should link to v0.6.x test matrix");
  assert(readme.includes("docs/testing-v0.7.x-test-matrix.md"), "README.md should link to v0.7.x test matrix");
  assert(readme.includes("docs/testing-v0.8.x-test-matrix.md"), "README.md should link to v0.8.x sidecar test matrix");
  assert(readme.includes("new-window-starter.md"), "README.md should mention the copyable Sidecar starter");
  assert(readme.includes("pass/fail"), "README.md should document the Sidecar receiver pass/fail report");
  assert(readme.includes("--starter-language auto|zh-CN|en|ja"), "README.md should mention starter language routing");
  assert(readme.includes("docs/releases/v0.8.7.md"), "README.md should link to v0.8.7 copyable starter");
  assert(readme.includes("docs/releases/v0.8.8.md"), "README.md should link to v0.8.8 starter language routing");
  assert(readme.includes("docs/releases/v0.9.0.md"), "README.md should link to v0.9.0 readiness candidate");
  assert(readme.includes("docs/releases/v0.9.1.md"), "README.md should link to v0.9.1 golden-path candidate");
  assert(readme.includes("docs/releases/v0.9.2.md"), "README.md should link to v0.9.2 golden-path example candidate");
  assert(readme.includes("docs/releases/v0.9.3.md"), "README.md should link to v0.9.3 closure candidate");
  assert(readme.includes("docs/releases/v1.0.0.md"), "README.md should link to v1.0.0 delta handoff RC");
  assert(readme.includes("docs/specs/delta-handoff.md"), "README.md should link to delta handoff spec");
  assert(readme.includes("docs/dogfooding/delta-handoff-fresh-receiver-v1.0.md"), "README.md should link to delta fresh receiver dogfooding");
  assert(readme.includes("Delta Handoff RC hardening"), "README.md should describe v1.0 Delta Handoff RC hardening");
  assert(readme.includes("basebrief-project-state-v1` 保持不变"), "README.md should preserve project-state schema for v1.0");
  assert(readme.includes("docs/testing-v0.9.x-test-matrix.md"), "README.md should link to v0.9.x closure matrix");
  assert(readme.includes("Integrated Handoff Readiness"), "README.md should define v0.9.0 readiness");
  assert(readme.includes("Integrated Handoff Golden Path"), "README.md should mention the golden-path guide");
  assert(readme.includes("examples/golden-path/README.md"), "README.md should link to the golden-path example kit");
  assert(readme.includes("docs/releases/v0.8.3.md"), "README.md should link to v0.8.3 sidecar discoverability polish");
  assert(readme.includes("docs/releases/v0.8.2.md"), "README.md should link to v0.8.2 sidecar receiver acceptance evidence");
  assert(readme.includes("docs/releases/v0.8.1.md"), "README.md should link to v0.8.1 sidecar check hardening");
  assert(readme.includes("docs/releases/v0.8.0.md"), "README.md should link to v0.8.0 sidecar handoff bundle");
  assert(readme.includes("docs/releases/v0.7.0.md"), "README.md should link to v0.7.0 lifecycle release candidate");
  assert(readme.includes("docs/releases/v0.6.3.md"), "README.md should link to v0.6.3 lifecycle readiness candidate");
  assert(readme.includes("docs/releases/v0.6.2.md"), "README.md should link to v0.6.2 self-dogfooding evidence candidate");
  assert(readme.includes("docs/releases/v0.6.0.md"), "README.md should link to v0.6.0 project-state release");
  assert(readme.includes("docs/releases/v0.5.3.md"), "README.md should link to v0.5.3 review closure");
  assert(readme.includes("docs/releases/v0.5.2.md"), "README.md should link to v0.5.2 extract candidate");
  assert(readme.includes("docs/releases/v0.5.1.md"), "README.md should link to v0.5.1 review draft gate candidate");
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
  assert(englishReadme.includes("docs/golden-path.md"), "README.en.md should link to golden path docs");
  assert(englishReadme.includes("docs/cli-lite.md"), "README.en.md should link to CLI Lite docs");
  assert(englishReadme.includes("docs/receiver-check.md"), "README.en.md should link to Receiver Safe Check docs");
  assert(englishReadme.includes("docs/receiver-flow.md"), "README.en.md should link to Receiver Flow Draft docs");
  assert(englishReadme.includes("docs/project-state.md"), "README.en.md should link to Project State docs");
  assert(englishReadme.includes("receiver-flow"), "README.en.md should mention receiver-flow command");
  assert(englishReadme.includes("state-init"), "README.en.md should mention state-init command");
  assert(englishReadme.includes("state-read"), "README.en.md should mention state-read command");
  assert(englishReadme.includes("sidecar-build"), "README.en.md should mention sidecar-build command");
  assert(englishReadme.includes("sidecar-check"), "README.en.md should mention sidecar-check command");
  assert(englishReadme.includes("generic"), "README.en.md should mention generic sidecar target");
  assert(englishReadme.includes("openclaw"), "README.en.md should mention openclaw sidecar target");
  assert(englishReadme.includes("basebrief-project-state-v1"), "README.en.md should mention Project State schema");
  assert(englishReadme.includes("basebrief-sidecar-v1"), "README.en.md should mention Sidecar schema");
  assert(englishReadme.includes("No provider request"), "README.en.md should preserve sidecar no-provider boundary");
  assert(englishReadme.includes("No raw private output"), "README.en.md should preserve sidecar raw-output boundary");
  assert(englishReadme.includes("No runtime integration"), "README.en.md should preserve sidecar runtime boundary");
  assert(englishReadme.includes("No schema change"), "README.en.md should preserve sidecar schema boundary");
  assert(englishReadme.includes("provider_probe_status=skipped"), "README.en.md should preserve skipped provider probe wording");
  assert(englishReadme.includes("docs/dogfooding/receiver-friction-log.md"), "README.en.md should link to receiver friction log");
  assert(englishReadme.includes("docs/dogfooding/receiver-flow-dogfooding.md"), "README.en.md should link to receiver-flow dogfooding evidence");
  assert(englishReadme.includes("docs/dogfooding/receiver-flow-guided-dogfooding.md"), "README.en.md should link to guided receiver-flow dogfooding evidence");
  assert(englishReadme.includes("docs/dogfooding/receiver-flow-review-draft-dogfooding.md"), "README.en.md should link to review-draft dogfooding evidence");
  assert(englishReadme.includes("docs/dogfooding/receiver-flow-extract-dogfooding.md"), "README.en.md should link to extract dogfooding evidence");
  assert(englishReadme.includes("docs/dogfooding/receiver-flow-v0.5.x-closure.md"), "README.en.md should link to v0.5.x closure dogfooding evidence");
  assert(englishReadme.includes("docs/dogfooding/project-state-dogfooding.md"), "README.en.md should link to project-state dogfooding evidence");
  assert(englishReadme.includes("docs/dogfooding/project-state-self-dogfooding-v0.6.x.md"), "README.en.md should link to project-state self-dogfooding evidence");
  assert(englishReadme.includes("docs/dogfooding/project-state-self-dogfooding-v0.6.2.md"), "README.en.md should link to v0.6.2 project-state self-dogfooding evidence");
  assert(englishReadme.includes("docs/dogfooding/project-state-lifecycle-readiness-v0.6.3.md"), "README.en.md should link to v0.6.3 lifecycle readiness dogfooding");
  assert(englishReadme.includes("docs/dogfooding/project-state-lifecycle-v0.7.0.md"), "README.en.md should link to v0.7.0 lifecycle dogfooding");
  assert(englishReadme.includes("docs/design/project-state-model.md"), "README.en.md should link to project-state model docs");
  assert(englishReadme.includes("docs/design/project-state-validation-rules.md"), "README.en.md should link to project-state validation docs");
  assert(englishReadme.includes("docs/design/project-state-lifecycle-readiness.md"), "README.en.md should link to project-state lifecycle readiness docs");
  assert(englishReadme.includes("docs/design/project-state-lifecycle-model.md"), "README.en.md should link to project-state lifecycle model docs");
  assert(englishReadme.includes("docs/baselines/v0.6.0-post-release-baseline.md"), "README.en.md should link to v0.6.0 post-release baseline");
  assert(englishReadme.includes("docs/testing-v0.6.x-test-matrix.md"), "README.en.md should link to v0.6.x test matrix");
  assert(englishReadme.includes("docs/testing-v0.7.x-test-matrix.md"), "README.en.md should link to v0.7.x test matrix");
  assert(englishReadme.includes("docs/testing-v0.8.x-test-matrix.md"), "README.en.md should link to v0.8.x sidecar test matrix");
  assert(englishReadme.includes("new-window-starter.md"), "README.en.md should mention the copyable Sidecar starter");
  assert(englishReadme.includes("pass/fail"), "README.en.md should document the Sidecar receiver pass/fail report");
  assert(englishReadme.includes("--starter-language auto|zh-CN|en|ja"), "README.en.md should mention starter language routing");
  assert(englishReadme.includes("docs/releases/v0.8.7.md"), "README.en.md should link to v0.8.7 copyable starter");
  assert(englishReadme.includes("docs/releases/v0.8.8.md"), "README.en.md should link to v0.8.8 starter language routing");
  assert(englishReadme.includes("docs/releases/v0.9.0.md"), "README.en.md should link to v0.9.0 readiness candidate");
  assert(englishReadme.includes("docs/releases/v0.9.1.md"), "README.en.md should link to v0.9.1 golden-path candidate");
  assert(englishReadme.includes("docs/releases/v0.9.2.md"), "README.en.md should link to v0.9.2 golden-path example candidate");
  assert(englishReadme.includes("docs/releases/v0.9.3.md"), "README.en.md should link to v0.9.3 closure candidate");
  assert(englishReadme.includes("docs/releases/v1.0.0.md"), "README.en.md should link to v1.0.0 delta handoff RC");
  assert(englishReadme.includes("docs/specs/delta-handoff.md"), "README.en.md should link to delta handoff spec");
  assert(englishReadme.includes("docs/dogfooding/delta-handoff-fresh-receiver-v1.0.md"), "README.en.md should link to delta fresh receiver dogfooding");
  assert(englishReadme.includes("Delta Handoff RC hardening"), "README.en.md should describe v1.0 Delta Handoff RC hardening");
  assert(englishReadme.includes("basebrief-project-state-v1` remains unchanged"), "README.en.md should preserve project-state schema for v1.0");
  assert(englishReadme.includes("docs/testing-v0.9.x-test-matrix.md"), "README.en.md should link to v0.9.x closure matrix");
  assert(englishReadme.includes("Integrated Handoff Readiness"), "README.en.md should define v0.9.0 readiness");
  assert(englishReadme.includes("Integrated Handoff Golden Path"), "README.en.md should mention the golden-path guide");
  assert(englishReadme.includes("examples/golden-path/README.md"), "README.en.md should link to the golden-path example kit");
  assert(englishReadme.includes("docs/releases/v0.8.3.md"), "README.en.md should link to v0.8.3 sidecar discoverability polish");
  assert(englishReadme.includes("docs/releases/v0.8.2.md"), "README.en.md should link to v0.8.2 sidecar receiver acceptance evidence");
  assert(englishReadme.includes("docs/releases/v0.8.1.md"), "README.en.md should link to v0.8.1 sidecar check hardening");
  assert(englishReadme.includes("docs/releases/v0.8.0.md"), "README.en.md should link to v0.8.0 sidecar handoff bundle");
  assert(englishReadme.includes("docs/releases/v0.7.0.md"), "README.en.md should link to v0.7.0 lifecycle release candidate");
  assert(englishReadme.includes("docs/releases/v0.6.3.md"), "README.en.md should link to v0.6.3 lifecycle readiness candidate");
  assert(englishReadme.includes("docs/releases/v0.6.2.md"), "README.en.md should link to v0.6.2 self-dogfooding evidence candidate");
  assert(englishReadme.includes("docs/releases/v0.6.0.md"), "README.en.md should link to v0.6.0 project-state release");
  assert(englishReadme.includes("docs/releases/v0.5.3.md"), "README.en.md should link to v0.5.3 review closure");
  assert(englishReadme.includes("docs/releases/v0.5.2.md"), "README.en.md should link to v0.5.2 extract candidate");
  assert(englishReadme.includes("docs/releases/v0.5.1.md"), "README.en.md should link to v0.5.1 review draft gate candidate");
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
  assert(skill.includes("新窗口开场白（可复制）"), "SKILL.md must require copyable new-window starter output");
  assert(skill.includes("pass/fail"), "SKILL.md must preserve the Sidecar receiver pass/fail anchor");
  assert(skill.includes("--starter-language auto|zh-CN|en|ja"), "SKILL.md must document starter language routing");
  assert(
    modeSelectionDoc.includes("`cache-ready` 是显式实验路线"),
    "mode-selection.md must mark cache-ready as explicit experiment route",
  );
  assert(modeSelectionDoc.includes("选完模式后怎么办"), "mode-selection.md must explain the next action");
  assert(quickstartDoc.includes("路径 A"), "quickstart must document the Skill-first path");
  assert(quickstartDoc.includes("路径 B"), "quickstart must document the local build path");
  assert(quickstartDoc.includes("路径 B2"), "quickstart must document the reviewed-handoff golden path");
  assert(quickstartDoc.includes("路径 C"), "quickstart must document the Seal/Diff path");
  assert(quickstartDoc.includes("路径 D"), "quickstart must document the Receiver Safe Check path");
  assert(quickstartDoc.includes("golden-path.md"), "quickstart must link to the golden path guide");
  assert(quickstartDoc.includes("../examples/golden-path/README.md"), "quickstart must link to the golden-path example kit");
  assert(quickstartDoc.includes("state-init -> sidecar-build -> sidecar-check"), "quickstart must document first-pass golden path");
  assert(quickstartDoc.includes("state-advance -> sidecar-build -> sidecar-check"), "quickstart must document follow-up golden path");
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
  assert(docsIndex.includes("dogfooding/receiver-flow-review-draft-dogfooding.md"), "Docs index must link review-draft dogfooding evidence");
  assert(docsIndex.includes("dogfooding/receiver-flow-extract-dogfooding.md"), "Docs index must link extract dogfooding evidence");
  assert(docsIndex.includes("dogfooding/receiver-flow-v0.5.x-closure.md"), "Docs index must link v0.5.x closure dogfooding evidence");
  assert(docsIndex.includes("dogfooding/project-state-dogfooding.md"), "Docs index must link project-state dogfooding evidence");
  assert(docsIndex.includes("dogfooding/project-state-self-dogfooding-v0.6.x.md"), "Docs index must link project-state self-dogfooding evidence");
  assert(docsIndex.includes("dogfooding/project-state-self-dogfooding-v0.6.2.md"), "Docs index must link v0.6.2 project-state self-dogfooding evidence");
  assert(docsIndex.includes("dogfooding/project-state-lifecycle-readiness-v0.6.3.md"), "Docs index must link v0.6.3 lifecycle readiness dogfooding");
  assert(docsIndex.includes("dogfooding/project-state-lifecycle-v0.7.0.md"), "Docs index must link v0.7.0 lifecycle dogfooding");
  assert(docsIndex.includes("receiver-flow.md"), "Docs index must link Receiver Flow Draft docs");
  assert(docsIndex.includes("project-state.md"), "Docs index must link Project State docs");
  assert(docsIndex.includes("golden-path.md"), "Docs index must link golden path docs");
  assert(docsIndex.includes("design/project-state-model.md"), "Docs index must link project-state model docs");
  assert(docsIndex.includes("design/project-state-validation-rules.md"), "Docs index must link project-state validation docs");
  assert(docsIndex.includes("design/project-state-lifecycle-readiness.md"), "Docs index must link project-state lifecycle readiness docs");
  assert(docsIndex.includes("design/project-state-lifecycle-model.md"), "Docs index must link project-state lifecycle model docs");
  assert(docsIndex.includes("../examples/receiver/difference-found/README.md"), "Docs index should link receiver difference example");
  assert(docsIndex.includes("../examples/receiver/blocked/README.md"), "Docs index should link receiver blocked example");
  assert(docsIndex.includes("../examples/receiver/language-routing/README.md"), "Docs index should link receiver language routing example");
  assert(docsIndex.includes("../examples/receiver-flow/clean-repo/README.md"), "Docs index should link receiver-flow clean repo example");
  assert(docsIndex.includes("../examples/receiver-flow/dirty-repo/README.md"), "Docs index should link receiver-flow dirty repo example");
  assert(docsIndex.includes("../examples/receiver-flow/visible-output/README.md"), "Docs index should link receiver-flow visible output example");
  assert(docsIndex.includes("../examples/receiver-flow-review/valid-ready/README.md"), "Docs index should link valid reviewed draft example");
  assert(docsIndex.includes("../examples/receiver-flow-review/rejected-candidate/README.md"), "Docs index should link rejected candidate draft example");
  assert(docsIndex.includes("../examples/receiver-flow-review/rejected-empty/README.md"), "Docs index should link rejected empty draft example");
  assert(docsIndex.includes("../examples/project-state/README.md"), "Docs index should link project-state example");
  assert(docsIndex.includes("../examples/golden-path/README.md"), "Docs index should link golden-path example kit");
  assert(docsIndex.includes("releases/v0.6.0.md"), "Docs index must link v0.6.0 project-state release");
  assert(docsIndex.includes("releases/v0.8.0.md"), "Docs index must link v0.8.0 sidecar release candidate");
  assert(docsIndex.includes("releases/v0.8.1.md"), "Docs index must link v0.8.1 sidecar check hardening candidate");
  assert(docsIndex.includes("releases/v0.8.2.md"), "Docs index must link v0.8.2 sidecar receiver acceptance evidence candidate");
  assert(docsIndex.includes("releases/v0.8.3.md"), "Docs index must link v0.8.3 sidecar discoverability polish candidate");
  assert(docsIndex.includes("releases/v0.8.4.md"), "Docs index must link v0.8.4 sidecar external receiver smoke candidate");
  assert(docsIndex.includes("releases/v0.8.5.md"), "Docs index must link v0.8.5 sidecar manual receiver smoke intake candidate");
  assert(docsIndex.includes("releases/v0.8.6.md"), "Docs index must link v0.8.6 sidecar manual receiver smoke evidence candidate");
  assert(docsIndex.includes("releases/v0.8.7.md"), "Docs index must link v0.8.7 copyable starter candidate");
  assert(docsIndex.includes("releases/v0.8.8.md"), "Docs index must link v0.8.8 starter language routing candidate");
  assert(docsIndex.includes("releases/v0.9.0.md"), "Docs index must link v0.9.0 readiness candidate");
  assert(docsIndex.includes("releases/v0.9.1.md"), "Docs index must link v0.9.1 golden-path candidate");
  assert(docsIndex.includes("releases/v0.9.2.md"), "Docs index must link v0.9.2 golden-path example candidate");
  assert(docsIndex.includes("releases/v0.9.3.md"), "Docs index must link v0.9.3 closure candidate");
  assert(docsIndex.includes("testing-v0.9.x-test-matrix.md"), "Docs index must link v0.9.x closure matrix");
  assert(docsIndex.includes("releases/v0.7.0.md"), "Docs index must link v0.7.0 lifecycle release candidate");
  assert(docsIndex.includes("releases/v0.6.3.md"), "Docs index must link v0.6.3 lifecycle readiness candidate");
  assert(docsIndex.includes("releases/v0.6.2.md"), "Docs index must link v0.6.2 self-dogfooding evidence candidate");
  assert(docsIndex.includes("baselines/v0.6.0-post-release-baseline.md"), "Docs index must link v0.6.0 post-release baseline");
  assert(docsIndex.includes("testing-v0.6.x-test-matrix.md"), "Docs index must link v0.6.x test matrix");
  assert(docsIndex.includes("testing-v0.7.x-test-matrix.md"), "Docs index must link v0.7.x test matrix");
  assert(docsIndex.includes("testing-v0.8.x-test-matrix.md"), "Docs index must link v0.8.x test matrix");
  assert(docsIndex.includes("releases/v0.5.1.md"), "Docs index must link v0.5.1 review draft gate candidate");
  assert(docsIndex.includes("releases/v0.5.2.md"), "Docs index must link v0.5.2 extract candidate");
  assert(docsIndex.includes("releases/v0.5.3.md"), "Docs index must link v0.5.3 review closure");
  assert(docsIndex.includes("releases/v0.5.0.md"), "Docs index must link v0.5.0 guided receiver flow candidate");
  assert(docsIndex.includes("releases/v0.4.1.md"), "Docs index must link v0.4.1 stabilization candidate");
  assert(docsIndex.includes("baselines/v0.4.0-post-release-baseline.md"), "Docs index must link v0.4.0 post-release baseline");
  assert(docsIndex.includes("testing-v0.4.x-test-matrix.md"), "Docs index must link v0.4.x test matrix");
  assert(docsIndex.includes("releases/v0.4.0.md"), "Docs index must link v0.4.0 release candidate");
  assert(docsIndex.includes("releases/v0.3.3.md"), "Docs index must link v0.3.3 release candidate");
  assert(docsIndex.includes("releases/v0.3.2.md"), "Docs index must link v0.3.2 release candidate");
  assert(docsIndex.includes("releases/v0.3.1.md"), "Docs index must link v0.3.1 release candidate");
  assert(docsIndex.includes("releases/v0.3.0.md"), "Docs index must link v0.3.0 release candidate");
  assert(docsIndex.includes("releases/v1.0.1.md"), "Docs index must link v1.0.1 clarity patch");
  assert(receiverReadyDogfoodingDoc.includes("User-provided external evidence"), "Receiver-ready evidence must distinguish external evidence");
  assert(receiverReadyDogfoodingDoc.includes("not proof across all tools"), "Receiver-ready evidence must keep the interpretation scoped");
  assert(receiverReadyDogfoodingDoc.includes("Low-budget Validation Rule"), "Receiver-ready evidence must record the validation budget");
  assert(receiverDifferenceExampleReadme.includes("human-facing `fail`"), "Receiver difference example must distinguish human-facing fail wording");
  assert(receiverDifferenceExampleReadme.includes("machine result stays `difference_found`"), "Receiver difference example must preserve machine difference_found semantics");
  assert(receiverBlockedExampleReadme.includes("human-facing"), "Receiver blocked example must distinguish human-facing fail wording");
  assert(receiverBlockedExampleReadme.includes("machine result must stay `blocked`"), "Receiver blocked example must preserve blocked semantics");
  assert(receiverLanguageRoutingExampleReadme.includes("BaseBrief"), "Receiver language-routing example must identify BaseBrief");
  assert(receiverLanguageRoutingExampleReadme.includes("current_goal"), "Receiver language-routing example must restate current_goal");
  assert(receiverLanguageRoutingExampleReadme.includes("receiver_entry_task"), "Receiver language-routing example must restate receiver_entry_task");
  assert(receiverLanguageRoutingExampleReadme.includes("pass/fail"), "Receiver language-routing example must preserve pass/fail wording");
  assert(receiverLanguageRoutingExampleReadme.includes("wait_for_user_confirmation"), "Receiver language-routing example must preserve wait-for-confirmation anchor");
  assert(receiverLanguageRoutingReport.includes("BaseBrief"), "Receiver language-routing report must identify BaseBrief");
  assert(receiverLanguageRoutingReport.includes("receiver 验收结论是 pass"), "Receiver language-routing report must include a pass report");
  assert(receiverLanguageRoutingReport.includes("等待你的确认"), "Receiver language-routing report must stop at the confirmation gate");
  assert(receiverFrictionDoc.includes("actual_handoff_friction"), "Receiver friction log must record the report shape");
  assert(receiverFrictionDoc.includes("pass/fail"), "Receiver friction log must preserve human-facing pass/fail wording");
  assert(receiverFrictionDoc.includes("receiver_acceptance_words"), "Receiver friction log must record receiver_acceptance_words");
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
  assert(receiverFlowReviewDraftDogfoodingDoc.includes("review-draft --draft <draft-context.md> --output <receiver-ready.md>"), "Review-draft dogfooding doc must document command shape");
  assert(receiverFlowReviewDraftDogfoodingDoc.includes("blocked_marker_shape"), "Review-draft dogfooding doc must document blocked marker shape");
  assert(receiverFlowReviewDraftDogfoodingDoc.includes("handoff_status: ready_for_receiver"), "Review-draft dogfooding doc must document ready output status");
  assert(receiverFlowReviewDraftDogfoodingDoc.includes("provider_request_performed`: false"), "Review-draft dogfooding doc must state no provider request");
  assert(receiverFlowReviewDraftDogfoodingDoc.includes("No receiver-flow --extract"), "Review-draft dogfooding doc must reject extract mode");
  assert(receiverFlowReviewDraftDogfoodingDoc.includes("No Auto Flow"), "Review-draft dogfooding doc must reject Auto Flow");
  assert(receiverFlowExtractDogfoodingDoc.includes("receiver-flow --repo <target-repo> --output-dir <dir> --extract --source <draft-or-context.md>"), "Extract dogfooding doc must document command shape");
  assert(receiverFlowExtractDogfoodingDoc.includes("extract-self-smoke"), "Extract dogfooding doc must include self smoke case");
  assert(receiverFlowExtractDogfoodingDoc.includes("[CANDIDATE]"), "Extract dogfooding doc must document candidate markers");
  assert(receiverFlowExtractDogfoodingDoc.includes("[NEEDS_REVIEW]"), "Extract dogfooding doc must document missing field markers");
  assert(receiverFlowExtractDogfoodingDoc.includes("provider_request_performed`: false"), "Extract dogfooding doc must state no provider request");
  assert(receiverFlowExtractDogfoodingDoc.includes("No Auto Flow"), "Extract dogfooding doc must reject Auto Flow");
  assert(receiverFlowClosureDogfoodingDoc.includes("v0.5.x-review-closure"), "v0.5.x closure dogfooding doc must include closure case");
  assert(receiverFlowClosureDogfoodingDoc.includes("ready_shape"), "v0.5.x closure dogfooding doc must document ready shape");
  assert(receiverFlowClosureDogfoodingDoc.includes("[CANDIDATE]"), "v0.5.x closure dogfooding doc must document candidate marker");
  assert(receiverFlowClosureDogfoodingDoc.includes("[EMPTY]"), "v0.5.x closure dogfooding doc must document empty marker");
  assert(receiverFlowClosureDogfoodingDoc.includes("provider_request_performed`: false"), "v0.5.x closure dogfooding doc must state no provider request");
  assert(receiverFlowClosureDogfoodingDoc.includes("No `.basebrief/` project state directory in `v0.5.x`"), "v0.5.x closure dogfooding doc must keep .basebrief out of v0.5.x");
  assert(projectStateDogfoodingDoc.includes("state-init --repo <target-repo> --source <receiver-ready.md>"), "Project State dogfooding doc must document command shape");
  assert(projectStateDogfoodingDoc.includes(".basebrief/state.json"), "Project State dogfooding doc must document output shape");
  assert(projectStateDogfoodingDoc.includes("handoff_status: ready_for_receiver"), "Project State dogfooding doc must require ready source");
  assert(projectStateDogfoodingDoc.includes("No provider request"), "Project State dogfooding doc must state no provider request");
  assert(projectStateDogfoodingDoc.includes("No Auto Flow"), "Project State dogfooding doc must state no Auto Flow");
  assert(projectStateDogfoodingDoc.includes("No receiver thread creation"), "Project State dogfooding doc must state no receiver thread creation");
  assert(receiverFlowDoc.includes("receiver-flow --repo <target-repo> --output-dir <dir>"), "Receiver Flow docs must document the command");
  assert(receiverFlowDoc.includes("receiver-flow --repo <target-repo> --output-dir <dir> --guided"), "Receiver Flow docs must document guided mode");
  assert(receiverFlowDoc.includes("receiver-flow --repo <target-repo> --output-dir <dir> --extract --source <draft-or-context.md>"), "Receiver Flow docs must document extract mode");
  assert(receiverFlowDoc.includes("review-draft --draft <draft-context.md> --output <receiver-ready.md>"), "Receiver Flow docs must document the review-draft gate");
  assert(receiverFlowDoc.includes("handoff_status: draft_needs_review"), "Receiver Flow docs must keep draft status explicit");
  assert(receiverFlowDoc.includes("Empty guided answers are written as"), "Receiver Flow docs must document empty guided answers");
  assert(receiverFlowDoc.includes("[CANDIDATE]"), "Receiver Flow docs must document extracted candidate markers");
  assert(receiverFlowDoc.includes("[NEEDS_REVIEW]"), "Receiver Flow docs must document extracted missing-field markers");
  assert(receiverFlowDoc.includes("not Auto Flow"), "Receiver Flow docs must reject Auto Flow scope");
  assert(receiverFlowDoc.includes("Does not make provider requests"), "Receiver Flow docs must reject provider requests");
  assert(receiverFlowDoc.includes("Does not overwrite existing output files"), "Receiver Flow docs must reject overwrites");
  assert(receiverFlowDoc.includes("Does not write tracked target-repository files"), "Receiver Flow docs must reject tracked target writes");
  assert(receiverFlowDoc.includes("state-init --repo <target-repo> --source <receiver-ready.md>"), "Receiver Flow docs must point to project-state init after review");
  assert(projectStateDoc.includes("state-init --repo <target-repo> --source <receiver-ready.md>"), "Project State docs must document state-init");
  assert(projectStateDoc.includes("state-read --repo <target-repo>"), "Project State docs must document state-read");
  assert(projectStateDoc.includes("state-status --repo <target-repo>"), "Project State docs must document state-status");
  assert(projectStateDoc.includes("state-validate --repo <target-repo>"), "Project State docs must document state-validate");
  assert(projectStateDoc.includes("state-history --repo <target-repo>"), "Project State docs must document state-history");
  assert(projectStateDoc.includes("state-advance --repo <target-repo> --source <receiver-ready.md>"), "Project State docs must document state-advance");
  assert(projectStateDoc.includes("sidecar-build --repo <target-repo>"), "Project State docs must document sidecar-build");
  assert(projectStateDoc.includes("sidecar-check --input <sidecar-dir>"), "Project State docs must document sidecar-check");
  assert(projectStateDoc.includes("receiver-ready.md -> state-init/state-advance -> sidecar-build -> sidecar-check -> new-window-starter.md -> receiver first response"), "Project State docs must define the golden path");
  assert(projectStateDoc.includes("Integrated Handoff Golden Path"), "Project State docs must link to the golden-path guide");
  assert(projectStateDoc.includes("new-window-starter.md"), "Project State docs must document copyable sidecar starter");
  assert(projectStateDoc.includes("--starter-language auto|zh-CN|en|ja"), "Project State docs must document starter language option");
  assert(projectStateDoc.includes("output_files.newWindowStarter"), "Project State docs must document starter manifest compatibility");
  assert(projectStateDoc.includes(".basebrief/state.json"), "Project State docs must document output file");
  assert(projectStateDoc.includes(".basebrief/history/"), "Project State docs must document history output");
  assert(projectStateDoc.includes(".basebrief/sidecar/<target>/"), "Project State docs must document sidecar output directory");
  assert(projectStateDoc.includes("basebrief-project-state-v1"), "Project State docs must document schema version");
  assert(projectStateDoc.includes("v0.9.0"), "Project State docs must document v0.9.0 readiness");
  assert(projectStateDoc.includes("No provider request"), "Project State docs must state no provider request");
  assert(projectStateDoc.includes("No raw private output"), "Project State docs must state no raw private output");
  assert(projectStateDoc.includes("No runtime integration"), "Project State docs must state no runtime integration");
  assert(projectStateDoc.includes("No Auto Flow"), "Project State docs must state no Auto Flow");
  assert(projectStateDoc.includes("No plugin or platform work"), "Project State docs must reject plugin/platform scope");
  assert(projectStateDoc.includes("No v1.0 claim"), "Project State docs must reject v1.0 claims");
  assert(projectStateDoc.includes("No receiver thread creation"), "Project State docs must state no receiver thread creation");
  assert(projectStateDoc.includes("No schema change"), "Project State docs must state no schema change");
  assert(projectStateDoc.includes("BB9 handoff schema is unchanged"), "Project State docs must protect BB9 schema");
  assert(projectStateDoc.includes("Receiver Safe Check config and result schemas are unchanged"), "Project State docs must protect receiver schemas");
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
  assert(testingDoc.includes("v0.5.1 Review Draft Gate Candidate"), "Testing docs must document v0.5.1 review draft gate candidate");
  assert(testingDoc.includes("v0.5.2 Receiver Flow Extract Candidate"), "Testing docs must document v0.5.2 extract candidate");
  assert(testingDoc.includes("v0.5.3 Receiver Flow Review Closure"), "Testing docs must document v0.5.3 review closure");
  assert(testingDoc.includes("v0.6.0 Project State Directory Release"), "Testing docs must document v0.6.0 project-state release");
  assert(testingDoc.includes("v0.6.1 Stability And Self-Dogfooding"), "Testing docs must document v0.6.1 stabilization");
  assert(testingDoc.includes("testing-v0.6.x-test-matrix.md"), "Testing docs must link v0.6.x test matrix");
  assert(testingDoc.includes("v0.7.0 Project State Lifecycle Candidate"), "Testing docs must document v0.7.0 lifecycle candidate");
  assert(testingDoc.includes("testing-v0.7.x-test-matrix.md"), "Testing docs must link v0.7.x test matrix");
  assert(testingDoc.includes("v0.8.2 Sidecar Receiver Acceptance Evidence"), "Testing docs must document v0.8.2 sidecar receiver acceptance evidence");
  assert(testingDoc.includes("v0.8.4 External Receiver Smoke Evidence"), "Testing docs must document v0.8.4 external receiver smoke evidence");
  assert(testingDoc.includes("v0.8.5 Manual Receiver Smoke Result Intake"), "Testing docs must document v0.8.5 manual receiver smoke intake");
  assert(testingDoc.includes("v0.8.6 Manual Receiver Smoke Result Intake Evidence"), "Testing docs must document v0.8.6 manual receiver smoke evidence");
  assert(testingDoc.includes("OpenClaw/Hermes Manual Receiver Smoke Follow-up"), "Testing docs must document OpenClaw/Hermes manual smoke follow-up");
  assert(testingDoc.includes("v0.8.7 Copyable New-Window Starter"), "Testing docs must document v0.8.7 copyable starter");
  assert(testingDoc.includes("v0.8.8 Starter Language Routing"), "Testing docs must document v0.8.8 starter language routing");
  assert(testingDoc.includes("v0.9.0 Integrated Handoff Readiness Candidate"), "Testing docs must document v0.9.0 readiness candidate");
  assert(testingDoc.includes("v0.9.1 Golden Path Closure Candidate"), "Testing docs must document v0.9.1 golden-path closure candidate");
  assert(testingDoc.includes("v0.9.2 Golden Path Example Closure Candidate"), "Testing docs must document v0.9.2 golden-path example closure candidate");
  assert(testingDoc.includes("v0.9.3 Final Closure / Freeze Candidate"), "Testing docs must document v0.9.3 closure candidate");
  assert(testingDoc.includes("v1.0 Delta Handoff Fresh Receiver Dogfooding"), "Testing docs must document v1.0 delta fresh receiver dogfooding");
  assert(testingDoc.includes("v1.0 Delta Handoff RC Candidate"), "Testing docs must document v1.0 delta RC candidate");
  assert(testingDoc.includes("basebrief-project-state-v1` unchanged"), "Testing docs must preserve v1.0 project-state schema");
  assert(testingDoc.includes("testing-v0.9.x-test-matrix.md"), "Testing docs must link v0.9.x closure matrix");
  assert(testingDoc.includes("new-window-starter.md"), "Testing docs must document Sidecar starter");
  assert(testingDoc.includes("pass/fail"), "Testing docs must document Sidecar receiver pass/fail reporting");
  assert(testingDoc.includes("manual_required"), "Testing docs must preserve manual-required receiver execution status");
  assert(testingDoc.includes("not_run"), "Testing docs must preserve not-run receiver execution status");
  assert(testingDoc.includes("testing-v0.8.x-test-matrix.md"), "Testing docs must link v0.8.x test matrix");
  assert(testingDoc.includes("provider_probe_status=skipped"), "Testing docs must preserve skipped provider probe wording");
  assert(usabilityFeedbackTemplate.includes("Do not include secrets"), "Usability feedback template must include a safety warning");
  assert(usabilityFeedbackTemplate.includes("Integrated Handoff Golden Path"), "Usability feedback template must include golden-path entry point");
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
  assert(cliLiteDoc.includes("node scripts/basebrief.js delta --repo <target-repo> --output-dir <dir>"), "cli-lite.md must document delta command");
  assert(cliLiteDoc.includes("--advance-baseline"), "cli-lite.md must document delta baseline advance option");
  assert(cliLiteDoc.includes("specs/delta-handoff.md"), "cli-lite.md must link delta handoff spec");
  assert(cliLiteDoc.includes("node scripts/basebrief.js receiver-flow"), "cli-lite.md must document receiver-flow command");
  assert(cliLiteDoc.includes("--guided"), "cli-lite.md must document receiver-flow guided option");
  assert(cliLiteDoc.includes("--extract --source <draft-or-context.md>"), "cli-lite.md must document receiver-flow extract option");
  assert(cliLiteDoc.includes("draft_needs_review"), "cli-lite.md must keep receiver-flow in draft status");
  assert(cliLiteDoc.includes("node scripts/basebrief.js review-draft --draft <draft-context.md> --output <receiver-ready.md>"), "cli-lite.md must document review-draft command");
  assert(cliLiteDoc.includes("ready_for_receiver"), "cli-lite.md must document review-draft ready status");
  assert(cliLiteDoc.includes("node scripts/basebrief.js state-init --repo <target-repo> --source <receiver-ready.md>"), "cli-lite.md must document state-init command");
  assert(cliLiteDoc.includes("node scripts/basebrief.js state-read --repo <target-repo>"), "cli-lite.md must document state-read command");
  assert(cliLiteDoc.includes("node scripts/basebrief.js state-status --repo <target-repo>"), "cli-lite.md must document state-status command");
  assert(cliLiteDoc.includes("node scripts/basebrief.js state-validate --repo <target-repo>"), "cli-lite.md must document state-validate command");
  assert(cliLiteDoc.includes("node scripts/basebrief.js state-history --repo <target-repo>"), "cli-lite.md must document state-history command");
  assert(cliLiteDoc.includes("node scripts/basebrief.js state-advance --repo <target-repo> --source <receiver-ready.md>"), "cli-lite.md must document state-advance command");
  assert(cliLiteDoc.includes("node scripts/basebrief.js sidecar-build --repo <target-repo>"), "cli-lite.md must document sidecar-build command");
  assert(cliLiteDoc.includes("node scripts/basebrief.js sidecar-check --input <sidecar-dir>"), "cli-lite.md must document sidecar-check command");
  assert(cliLiteDoc.includes("Golden Path Grouped Flow"), "cli-lite.md must group the integrated handoff path");
  assert(cliLiteDoc.includes("receiver-ready.md -> state-init/state-advance -> sidecar-build -> sidecar-check -> new-window-starter.md -> receiver first response"), "cli-lite.md must document the golden path");
  assert(cliLiteDoc.includes("golden-path.md"), "cli-lite.md must link to the golden-path guide");
  assert(cliLiteDoc.includes("new-window-starter.md"), "cli-lite.md must document copyable sidecar starter");
  assert(cliLiteDoc.includes("--starter-language auto|zh-CN|en|ja"), "cli-lite.md must document starter language option");
  assert(cliLiteDoc.includes("Protocol fields, paths, file names, schema"), "cli-lite.md must document literal protocol fields for starter language routing");
  assert(cliLiteDoc.includes("output_files.newWindowStarter"), "cli-lite.md must document starter manifest key");
  assert(cliLiteDoc.includes("--target generic|openclaw"), "cli-lite.md must document sidecar target option");
  assert(cliLiteDoc.includes("basebrief-project-state-v1"), "cli-lite.md must document project-state schema version");
  assert(cliLiteDoc.includes(".basebrief/history/"), "cli-lite.md must document project-state history directory");
  assert(cliLiteDoc.includes(".basebrief/sidecar/<target>/"), "cli-lite.md must document sidecar output directory");
  assert(cliLiteDoc.includes("No raw private output"), "cli-lite.md must document sidecar raw-output boundary");
  assert(cliLiteDoc.includes("No runtime"), "cli-lite.md must document sidecar runtime boundary");
  assert(cliLiteDoc.includes("wait for user confirmation"), "cli-lite.md must document receiver confirmation boundary");
  assert(cliLiteDoc.includes("releases/v0.8.0.md"), "cli-lite.md must link v0.8.0 sidecar release candidate");
  assert(cliLiteDoc.includes("releases/v0.8.1.md"), "cli-lite.md must link v0.8.1 sidecar check hardening candidate");
  assert(cliLiteDoc.includes("releases/v0.7.0.md"), "cli-lite.md must link v0.7.0 lifecycle release candidate");
  assert(cliLiteDoc.includes("releases/v0.6.0.md"), "cli-lite.md must link v0.6.0 project-state release");
  assert(cliLiteDoc.includes("releases/v0.3.2.md"), "cli-lite.md must link v0.3.2 release candidate");
  assert(cliLiteDoc.includes("releases/v0.3.3.md"), "cli-lite.md must link v0.3.3 release candidate");
  assert(sealDiffDoc.includes("scripts/basebrief_seal.js"), "seal-diff.md must document seal script");
  assert(sealDiffDoc.includes("basebrief-seal-v1"), "seal-diff.md must document seal schema version");
  assert(sealDiffDoc.includes("not a project-management system"), "seal-diff.md must state product boundary");
  assert(deltaV100ReleaseDoc.includes("v1.0.0 Delta Handoff RC Candidate"), "v1.0.0 release doc must have stable title");
  assert(deltaV100ReleaseDoc.includes("Reviewable Delta Handoff Compiler"), "v1.0.0 release doc must name the quality bar");
  assert(deltaV100ReleaseDoc.includes("node scripts/basebrief.js delta"), "v1.0.0 release doc must document delta command");
  assert(deltaV100ReleaseDoc.includes("v1.0.0-rc-review.md"), "v1.0.0 release doc must link RC review package");
  assert(deltaV100ReleaseDoc.includes("basebrief-project-state-v1` remains unchanged"), "v1.0.0 release doc must preserve project-state schema");
  assert(deltaV100ReleaseDoc.includes("handoff_acceptance: pass"), "v1.0.0 release doc must record fresh receiver pass");
  assert(deltaV100ReleaseDoc.includes("delta-handoff-baseline-advance-v1.0.md"), "v1.0.0 release doc must link baseline-advance evidence");
  assert(deltaV100ReleaseDoc.includes("baseline-advance closure"), "v1.0.0 release doc must record baseline-advance closure");
  assert(deltaV100ReleaseDoc.includes("provider_probe_status=skipped"), "v1.0.0 release doc must preserve skipped provider gate");
  assert(deltaV100ReleaseDoc.includes("No provider request"), "v1.0.0 release doc must reject provider scope");
  assert(deltaV100ReleaseDoc.includes("No runtime integration"), "v1.0.0 release doc must reject runtime scope");
  assert(deltaV100ReleaseDoc.includes("No schema-v2 work"), "v1.0.0 release doc must reject schema-v2 work");
  assert(deltaV100ReleaseDoc.includes("No plugin, MCP, IDE"), "v1.0.0 release doc must reject plugin/MCP/IDE work");
  assert(v100PlanDoc.includes("Reviewable Delta Handoff Compiler"), "v1.0 plan must define the internal quality bar");
  assert(v100PlanDoc.includes("basebrief-project-state-v1"), "v1.0 plan must preserve project-state v1");
  assert(v100PlanDoc.includes("provider requests"), "v1.0 plan must reject provider scope");
  assert(v100RcReviewDoc.includes("v1.0.0 RC Review Package"), "v1.0 RC review doc must have stable title");
  assert(v100RcReviewDoc.includes("Commit-Ready Summary"), "v1.0 RC review doc must include commit-ready summary");
  assert(v100RcReviewDoc.includes("docs/dogfooding/delta-handoff-fresh-receiver-v1.0.md"), "v1.0 RC review doc must link fresh receiver evidence");
  assert(v100RcReviewDoc.includes("docs/dogfooding/delta-handoff-baseline-advance-v1.0.md"), "v1.0 RC review doc must link baseline-advance evidence");
  assert(v100RcReviewDoc.includes("docs/releases/v1.0.1.md"), "v1.0 RC review doc must link the v1.0.1 clarity patch");
  assert(v100RcReviewDoc.includes(".basebrief/delta-baseline.json"), "v1.0 RC review doc must document local baseline artifact");
  assert(v100RcReviewDoc.includes("provider_probe_status=skipped"), "v1.0 RC review doc must preserve skipped provider gate");
  assert(v100RcReviewDoc.includes("No provider request"), "v1.0 RC review doc must reject provider scope");
  assert(v100RcReviewDoc.includes("No schema-v2 work"), "v1.0 RC review doc must reject schema-v2 scope");
  assert(v101ReleaseDoc.includes("v1.0.1 Delta Receiver Clarity Patch"), "v1.0.1 release doc must have stable title");
  assert(v101ReleaseDoc.includes("basebrief-delta-handoff-v1"), "v1.0.1 release doc must preserve delta handoff schema");
  assert(v101ReleaseDoc.includes("basebrief-delta-baseline-v1"), "v1.0.1 release doc must preserve delta baseline schema");
  assert(v101ReleaseDoc.includes("basebrief-project-state-v1"), "v1.0.1 release doc must preserve project-state schema");
  assert(v101ReleaseDoc.includes("baseline_source: missing"), "v1.0.1 release doc must explain first-run baseline state");
  assert(v101ReleaseDoc.includes("no-baseline..HEAD"), "v1.0.1 release doc must explain the first-run range sentinel");
  assert(v101ReleaseDoc.includes("commits_in_range: 0"), "v1.0.1 release doc must explain zero-commit ranges");
  assert(v101ReleaseDoc.includes("stateDiff.status: unchanged"), "v1.0.1 release doc must explain unchanged state diffs");
  assert(v101ReleaseDoc.includes("provider_probe_status=skipped"), "v1.0.1 release doc must preserve skipped provider gate");
  assert(v101ReleaseDoc.includes("No provider request"), "v1.0.1 release doc must reject provider scope");
  assert(v101ReleaseDoc.includes("No runtime integration"), "v1.0.1 release doc must reject runtime scope");
  assert(v101ReleaseDoc.includes("No plugin, MCP, IDE"), "v1.0.1 release doc must reject plugin/MCP/IDE scope");
  assert(v101ReleaseDoc.includes("No schema-v2 work"), "v1.0.1 release doc must reject schema-v2 scope");
  assert(v110ReleaseDoc.includes("v1.1.0 Delta Receiver Acceptance Local Closeout"), "v1.1.0 closeout doc must have stable title");
  assert(v110ReleaseDoc.includes("Delta Receiver Acceptance Kit"), "v1.1.0 closeout doc must name receiver acceptance kit");
  assert(v110ReleaseDoc.includes("docs/releases/v1.1.0-plan.md"), "v1.1.0 closeout doc must link planning baseline");
  assert(v110ReleaseDoc.includes("docs/dogfooding/delta-receiver-acceptance-v1.1.md"), "v1.1.0 closeout doc must link receiver acceptance evidence");
  assert(v110ReleaseDoc.includes("handoff_acceptance: difference_found"), "v1.1.0 closeout doc must record stale-handoff difference");
  assert(v110ReleaseDoc.includes("handoff_acceptance: pass"), "v1.1.0 closeout doc must record refreshed-handoff pass");
  assert(v110ReleaseDoc.includes("commits_in_range: 4"), "v1.1.0 closeout doc must record current refreshed commit count");
  assert(v110ReleaseDoc.includes("worktreeChangedFiles: []"), "v1.1.0 closeout doc must record clean refreshed worktree");
  assert(v110ReleaseDoc.includes("basebrief-project-state-v1"), "v1.1.0 closeout doc must preserve project-state schema");
  assert(v110ReleaseDoc.includes("basebrief-delta-handoff-v1"), "v1.1.0 closeout doc must preserve delta handoff schema");
  assert(v110ReleaseDoc.includes("basebrief-delta-baseline-v1"), "v1.1.0 closeout doc must preserve delta baseline schema");
  assert(v110ReleaseDoc.includes("provider_probe_status=skipped"), "v1.1.0 closeout doc must preserve skipped provider gate");
  assert(v110ReleaseDoc.includes("No provider request"), "v1.1.0 closeout doc must reject provider scope");
  assert(v110ReleaseDoc.includes("No runtime integration"), "v1.1.0 closeout doc must reject runtime scope");
  assert(v110ReleaseDoc.includes("No plugin, MCP, IDE"), "v1.1.0 closeout doc must reject plugin/MCP/IDE scope");
  assert(v110ReleaseDoc.includes("No schema-v2 work"), "v1.1.0 closeout doc must reject schema-v2 scope");
  assert(v110ReleaseDoc.includes("No new CLI command"), "v1.1.0 closeout doc must avoid new CLI commands");
  assert(v110ReleaseDoc.includes("not a push, tag, release"), "v1.1.0 closeout doc must avoid publication claims");
  assert(v110PlanDoc.includes("v1.1.0 Delta Receiver Acceptance Plan"), "v1.1.0 plan must have stable title");
  assert(v110PlanDoc.includes("Delta Receiver Acceptance Kit"), "v1.1.0 plan must name the receiver acceptance kit");
  assert(v110PlanDoc.includes("live repository state versus inherited handoff facts"), "v1.1.0 plan must require live-vs-inherited separation");
  assert(v110PlanDoc.includes("receiver_task_status"), "v1.1.0 plan must require receiver status reporting");
  assert(v110PlanDoc.includes("handoff_acceptance"), "v1.1.0 plan must require handoff acceptance reporting");
  assert(v110PlanDoc.includes("basebrief-project-state-v1"), "v1.1.0 plan must preserve project-state schema");
  assert(v110PlanDoc.includes("basebrief-delta-handoff-v1"), "v1.1.0 plan must preserve delta handoff schema");
  assert(v110PlanDoc.includes("basebrief-delta-baseline-v1"), "v1.1.0 plan must preserve delta baseline schema");
  assert(v110PlanDoc.includes("No provider request"), "v1.1.0 plan must reject provider scope");
  assert(v110PlanDoc.includes("No runtime integration"), "v1.1.0 plan must reject runtime scope");
  assert(v110PlanDoc.includes("No plugin, MCP, IDE"), "v1.1.0 plan must reject plugin/MCP/IDE scope");
  assert(v110PlanDoc.includes("No schema-v2 work"), "v1.1.0 plan must reject schema-v2 scope");
  assert(v110PlanDoc.includes("No new CLI command"), "v1.1.0 plan must avoid new CLI commands");
  assert(v110PlanDoc.includes("provider_probe_status=skipped"), "v1.1.0 plan must preserve skipped provider gate");
  assert(deltaHandoffSpecDoc.includes("basebrief-delta-baseline-v1"), "delta spec must define baseline schema");
  assert(deltaHandoffSpecDoc.includes("reviewed"), "delta spec must define reviewed semantics");
  assert(deltaHandoffSpecDoc.includes("needs-review"), "delta spec must define needs-review semantics");
  assert(deltaHandoffSpecDoc.includes("does not change"), "delta spec must preserve project-state schema");
  assert(deltaHandoffExample.includes("schemaVersion: basebrief-delta-handoff-v1"), "delta example must use delta handoff schema");
  assert(deltaHandoffExample.includes("review_status=reviewed"), "delta example must show reviewed sections");
  assert(deltaHandoffExample.includes("review_status=needs-review"), "delta example must show needs-review sections");
  assert(deltaHandoffExample.includes("## How To Read This Delta"), "delta example must include receiver clarity guidance");
  assert(deltaHandoffExample.includes("baseline_source: .basebrief/delta-baseline.json"), "delta example must show a baseline-present case");
  assert(deltaHandoffExample.includes("commits_in_range: 0"), "delta example must show the zero-commit-range case");
  assert(deltaHandoffExample.includes("stateDiff.status: unchanged"), "delta example must explain unchanged state diffs");
  assert(deltaHandoffExample.includes("Worktree Changed Files"), "delta example must keep worktree changes visible");
  assert(deltaHandoffExample.includes("No provider request"), "delta example must preserve provider boundary");
  assert(roadmapDoc.includes("current `v1.0` line is Delta Handoff RC hardening"), "Roadmap must identify current v1.0 Delta Handoff RC line");
  assert(roadmapDoc.includes("Phase 8B: Delta Handoff"), "Roadmap must document Delta Handoff phase");
  assert(roadmapDoc.includes("fresh receiver dogfooding has reported `handoff_acceptance: pass`"), "Roadmap must record fresh receiver pass");
  assert(roadmapDoc.includes("basebrief-project-state-v1` remains unchanged"), "Roadmap must preserve project-state schema in v1.0");
  assert(roadmapDoc.includes("Next v1.1 planning target"), "Roadmap must document v1.1 receiver acceptance target");
  assert(roadmapDoc.includes("Delta Receiver Acceptance Kit"), "Roadmap must name v1.1 receiver acceptance kit");
  assert(roadmapDoc.includes("receiver contract, not an"), "Roadmap must keep v1.1 out of runtime scope");
  assert(roadmapDoc.includes("Local v1.1 closeout status"), "Roadmap must document v1.1 closeout status");
  assert(roadmapDoc.includes("docs/releases/v1.1.0.md"), "Roadmap must link v1.1 closeout doc");
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
  assert(roadmapDoc.includes("Current v0.9.x closure line"), "Roadmap must name the current v0.9.x closure line");
  assert(roadmapDoc.includes("v0.9.3 Final Closure / Freeze"), "Roadmap must include the v0.9.3 closure stage");
  assert(roadmapDoc.includes("`v0.9.x` closure line is frozen"), "Roadmap must preserve the frozen v0.9.x closure line");
  assert(roadmapDoc.includes("Complete the `v1.0` Delta Handoff RC hardening line for explicit user review"), "Roadmap must make v1.0 RC hardening the first near-term priority");
  assert(roadmapDoc.includes("provider requests, runtime integration, schema changes"), "Roadmap must keep v0.9.x out of runtime/provider/schema scope");
  assert(goldenPathDoc.includes("Integrated Handoff Golden Path"), "golden-path.md must have a stable title");
  assert(goldenPathDoc.includes("receiver-ready.md -> state-init/state-advance -> sidecar-build -> sidecar-check -> new-window-starter.md -> receiver first response"), "golden-path.md must define the integrated path");
  assert(goldenPathDoc.includes("state-init --repo <target-repo> --source <receiver-ready.md>"), "golden-path.md must document state-init");
  assert(goldenPathDoc.includes("state-advance --repo <target-repo> --source <receiver-ready.md>"), "golden-path.md must document state-advance");
  assert(goldenPathDoc.includes("sidecar-build --repo <target-repo>"), "golden-path.md must document sidecar-build");
  assert(goldenPathDoc.includes("sidecar-check --input <sidecar-dir>"), "golden-path.md must document sidecar-check");
  assert(goldenPathDoc.includes("state-status"), "golden-path.md must mention optional state-status inspection");
  assert(goldenPathDoc.includes("state-validate"), "golden-path.md must mention optional state-validate inspection");
  assert(goldenPathDoc.includes("state-history"), "golden-path.md must mention optional state-history inspection");
  assert(goldenPathDoc.includes("pass/fail"), "golden-path.md must preserve receiver pass/fail reporting");
  assert(goldenPathDoc.includes("wait for user confirmation"), "golden-path.md must preserve receiver confirmation");
  assert(goldenPathDoc.includes("../examples/golden-path/README.md"), "golden-path.md must link to the example kit");
  assert(goldenPathDoc.includes("first-pass receiver first response"), "golden-path.md must describe the first-pass example");
  assert(goldenPathDoc.includes("follow-up receiver first response"), "golden-path.md must describe the follow-up example");
  assert(goldenPathDoc.includes("No provider request"), "golden-path.md must reject provider requests");
  assert(goldenPathDoc.includes("No raw private output"), "golden-path.md must reject raw private output");
  assert(goldenPathDoc.includes("No runtime integration"), "golden-path.md must reject runtime integration");
  assert(goldenPathDoc.includes("No schema change"), "golden-path.md must reject schema changes");
  assert(goldenPathDoc.includes("No Auto Flow"), "golden-path.md must reject Auto Flow");
  assert(goldenPathDoc.includes("basebrief-project-state-v1"), "golden-path.md must preserve project-state schema");
  assert(goldenPathDoc.includes("basebrief-sidecar-v1"), "golden-path.md must preserve sidecar schema");
  assert(goldenPathV091ReleaseDoc.includes("Golden Path Closure Candidate"), "v0.9.1 release doc must define golden-path closure candidate");
  assert(goldenPathV091ReleaseDoc.includes("receiver-ready.md -> state-init/state-advance -> sidecar-build -> sidecar-check -> new-window-starter.md -> receiver first response"), "v0.9.1 release doc must define the golden path");
  assert(goldenPathV091ReleaseDoc.includes("pass/fail"), "v0.9.1 release doc must preserve receiver pass/fail reporting");
  assert(goldenPathV091ReleaseDoc.includes("No provider request"), "v0.9.1 release doc must reject provider requests");
  assert(goldenPathV091ReleaseDoc.includes("No raw private output"), "v0.9.1 release doc must reject raw private output");
  assert(goldenPathV091ReleaseDoc.includes("No runtime integration"), "v0.9.1 release doc must reject runtime integration");
  assert(goldenPathV091ReleaseDoc.includes("No schema change"), "v0.9.1 release doc must reject schema changes");
  assert(goldenPathV091ReleaseDoc.includes("No Auto Flow"), "v0.9.1 release doc must reject Auto Flow");
  assert(goldenPathV091ReleaseDoc.includes("provider_probe_status=skipped"), "v0.9.1 release doc must preserve skipped provider gate");
  assert(goldenPathExampleV092ReleaseDoc.includes("Golden Path Example Closure Candidate"), "v0.9.2 release doc must define golden-path example closure candidate");
  assert(goldenPathExampleV092ReleaseDoc.includes("receiver-ready.md -> state-init/state-advance -> sidecar-build -> sidecar-check -> new-window-starter.md -> receiver first response"), "v0.9.2 release doc must define the golden path");
  assert(goldenPathExampleV092ReleaseDoc.includes("examples/golden-path/"), "v0.9.2 release doc must mention the example kit");
  assert(goldenPathExampleV092ReleaseDoc.includes("No provider request"), "v0.9.2 release doc must reject provider requests");
  assert(goldenPathExampleV092ReleaseDoc.includes("No raw private output"), "v0.9.2 release doc must reject raw private output");
  assert(goldenPathExampleV092ReleaseDoc.includes("No runtime integration"), "v0.9.2 release doc must reject runtime integration");
  assert(goldenPathExampleV092ReleaseDoc.includes("No schema change"), "v0.9.2 release doc must reject schema changes");
  assert(goldenPathExampleV092ReleaseDoc.includes("No Auto Flow"), "v0.9.2 release doc must reject Auto Flow");
  assert(goldenPathExampleV092ReleaseDoc.includes("provider_probe_status=skipped"), "v0.9.2 release doc must preserve skipped provider gate");
  assert(goldenPathExampleReadme.includes("Golden Path Example Kit"), "golden-path example README must have a stable title");
  assert(goldenPathExampleReadme.includes("state-init --repo <target-repo> --source <receiver-ready.md>"), "golden-path example README must document first-pass command");
  assert(goldenPathExampleReadme.includes("state-advance --repo <target-repo> --source <receiver-ready.md>"), "golden-path example README must document follow-up command");
  assert(goldenPathExampleReadme.includes("sidecar-build --repo <target-repo>"), "golden-path example README must document sidecar-build");
  assert(goldenPathExampleReadme.includes("sidecar-check --input <sidecar-dir>"), "golden-path example README must document sidecar-check");
  assert(goldenPathExampleReadme.includes("new-window-starter.md"), "golden-path example README must mention the copyable starter");
  assert(goldenPathExampleReady.includes("handoff_status: ready_for_receiver"), "golden-path receiver-ready sample must stay reviewed");
  assert(goldenPathExampleReady.includes("No provider request"), "golden-path receiver-ready sample must keep no-provider boundary");
  assert(goldenPathExampleReady.includes("No raw private output"), "golden-path receiver-ready sample must keep no-raw-output boundary");
  assert(goldenPathExampleReady.includes("No runtime integration"), "golden-path receiver-ready sample must keep no-runtime boundary");
  assert(goldenPathExampleReady.includes("No schema change"), "golden-path receiver-ready sample must keep no-schema boundary");
  assert(goldenPathExampleReady.includes("No Auto Flow"), "golden-path receiver-ready sample must keep no-auto-flow boundary");
  assert(goldenPathExampleStateReference.includes("basebrief-project-state-v1"), "golden-path state reference must preserve project-state schema");
  assert(goldenPathExampleStateReference.includes("../project-state/state.json"), "golden-path state reference must point to the public project-state example");
  assert(goldenPathExampleFirstPass.includes("pass"), "first-pass receiver sample must report pass/fail outcome");
  assert(goldenPathExampleFirstPass.includes("wait"), "first-pass receiver sample must wait for confirmation");
  assert(goldenPathExampleFirstPass.includes("state-init"), "first-pass receiver sample must identify state-init branch");
  assert(goldenPathExampleFollowUp.includes("pass"), "follow-up receiver sample must report pass/fail outcome");
  assert(goldenPathExampleFollowUp.includes("wait"), "follow-up receiver sample must wait for confirmation");
  assert(goldenPathExampleFollowUp.includes("state-advance"), "follow-up receiver sample must identify state-advance branch");
  assert(goldenPathExampleBoundary.includes("No provider request"), "golden-path boundary note must reject provider requests");
  assert(goldenPathExampleBoundary.includes("No raw private output"), "golden-path boundary note must reject raw private output");
  assert(goldenPathExampleBoundary.includes("No runtime integration"), "golden-path boundary note must reject runtime integration");
  assert(goldenPathExampleBoundary.includes("No schema change"), "golden-path boundary note must reject schema changes");
  assert(goldenPathExampleBoundary.includes("No Auto Flow"), "golden-path boundary note must reject Auto Flow");
  assert(closureV093ReleaseDoc.includes("Final Closure / Freeze Candidate"), "v0.9.3 release doc must define closure/freeze candidate");
  assert(closureV093ReleaseDoc.includes("v0.9.0` defines it, `v0.9.1` explains it, `v0.9.2` gives"), "v0.9.3 release doc must summarize define/guide/example progression");
  assert(closureV093ReleaseDoc.includes("v0.9.3` closes and freezes"), "v0.9.3 release doc must define the close/freeze role");
  assert(closureV093ReleaseDoc.includes("No provider request"), "v0.9.3 release doc must reject provider requests");
  assert(closureV093ReleaseDoc.includes("No raw private output"), "v0.9.3 release doc must reject raw private output");
  assert(closureV093ReleaseDoc.includes("No runtime integration"), "v0.9.3 release doc must reject runtime integration");
  assert(closureV093ReleaseDoc.includes("No schema change"), "v0.9.3 release doc must reject schema changes");
  assert(closureV093ReleaseDoc.includes("No Auto Flow"), "v0.9.3 release doc must reject Auto Flow");
  assert(closureV093ReleaseDoc.includes("No v1.0 work"), "v0.9.3 release doc must keep v1.0 out of scope");
  assert(closureV093ReleaseDoc.includes("provider_probe_status=skipped"), "v0.9.3 release doc must preserve skipped provider gate");
  assert(v09xTestMatrixDoc.includes("v0.9.x Integrated Handoff Closure Matrix"), "v0.9.x matrix must have a stable title");
  assert(v09xTestMatrixDoc.includes("receiver-ready.md -> state-init/state-advance -> sidecar-build -> sidecar-check -> new-window-starter.md -> receiver first response"), "v0.9.x matrix must define the shared path");
  assert(v09xTestMatrixDoc.includes("v0.9.0 Integrated Handoff Readiness"), "v0.9.x matrix must include v0.9.0");
  assert(v09xTestMatrixDoc.includes("v0.9.1 Golden Path Closure"), "v0.9.x matrix must include v0.9.1");
  assert(v09xTestMatrixDoc.includes("v0.9.2 Golden Path Example Closure"), "v0.9.x matrix must include v0.9.2");
  assert(v09xTestMatrixDoc.includes("v0.9.3 Final Closure / Freeze"), "v0.9.x matrix must include v0.9.3");
  assert(v09xTestMatrixDoc.includes("provider_probe_status=skipped"), "v0.9.x matrix must preserve skipped provider gate");
  assert(v09xTestMatrixDoc.includes("No provider request"), "v0.9.x matrix must reject provider requests");
  assert(v09xTestMatrixDoc.includes("No raw private output"), "v0.9.x matrix must reject raw private output");
  assert(v09xTestMatrixDoc.includes("No runtime integration"), "v0.9.x matrix must reject runtime integration");
  assert(v09xTestMatrixDoc.includes("No schema change"), "v0.9.x matrix must reject schema changes");
  assert(v09xTestMatrixDoc.includes("No Auto Flow"), "v0.9.x matrix must reject Auto Flow");
  assert(v09xTestMatrixDoc.includes("No v1.0 work"), "v0.9.x matrix must keep v1.0 out of scope");
  assert(roadmapDoc.includes(".basebrief/state.json"), "roadmap baseline must describe project-state direction");
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
  assert(receiverCheckDoc.includes("`pass/fail`"), "Receiver Safe Check docs must distinguish human-facing pass/fail wording");
  assert(receiverCheckDoc.includes("`difference_found`"), "Receiver Safe Check docs must document difference_found semantics");
  assert(receiverCheckDoc.includes("`blocked`"), "Receiver Safe Check docs must document blocked semantics");
  assert(receiverCheckDoc.includes("不等于 Agent 执行失败"), "Receiver Safe Check docs must preserve difference_found wording");
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
  assert(reviewDraftReleaseDoc.includes("Review Draft Gate Candidate"), "v0.5.1 candidate must describe review draft gate");
  assert(reviewDraftReleaseDoc.includes("review-draft --draft <draft-context.md> --output <receiver-ready.md>"), "v0.5.1 candidate must document review-draft command");
  assert(reviewDraftReleaseDoc.includes("handoff_status: draft_needs_review"), "v0.5.1 candidate must require draft input status");
  assert(reviewDraftReleaseDoc.includes("ready_for_receiver"), "v0.5.1 candidate must document ready output status");
  assert(reviewDraftReleaseDoc.includes("BB9 handoff schema is unchanged"), "v0.5.1 candidate must protect BB9 schema");
  assert(reviewDraftReleaseDoc.includes("Receiver Safe Check config and result schemas are unchanged"), "v0.5.1 candidate must protect receiver schemas");
  assert(reviewDraftReleaseDoc.includes("provider_probe_status=skipped"), "v0.5.1 candidate must preserve skipped provider probe gate");
  assert(reviewDraftReleaseDoc.includes("No provider request"), "v0.5.1 candidate must state no provider request");
  assert(reviewDraftReleaseDoc.includes("No receiver-flow --extract"), "v0.5.1 candidate must state no extract mode");
  assert(reviewDraftReleaseDoc.includes("No Auto Flow"), "v0.5.1 candidate must state no Auto Flow");
  assert(reviewDraftReleaseDoc.includes("No `.basebrief/`"), "v0.5.1 candidate must state no .basebrief directory");
  assert(reviewDraftReleaseDoc.includes("No push, tag, or formal release"), "v0.5.1 candidate must keep release actions pending");
  assert(extractReceiverFlowReleaseDoc.includes("Receiver Flow Extract Candidate"), "v0.5.2 candidate must describe extract mode");
  assert(extractReceiverFlowReleaseDoc.includes("receiver-flow --repo <target-repo> --output-dir <dir> --extract --source <draft-or-context.md>"), "v0.5.2 candidate must document extract command");
  assert(extractReceiverFlowReleaseDoc.includes("[CANDIDATE]"), "v0.5.2 candidate must document candidate markers");
  assert(extractReceiverFlowReleaseDoc.includes("[NEEDS_REVIEW]"), "v0.5.2 candidate must document needs-review markers");
  assert(extractReceiverFlowReleaseDoc.includes("handoff_status: draft_needs_review"), "v0.5.2 candidate must keep draft status");
  assert(extractReceiverFlowReleaseDoc.includes("review-draft` continues to reject"), "v0.5.2 candidate must keep review-draft gate blocking candidates");
  assert(extractReceiverFlowReleaseDoc.includes("BB9 handoff schema is unchanged"), "v0.5.2 candidate must protect BB9 schema");
  assert(extractReceiverFlowReleaseDoc.includes("Receiver Safe Check config and result schemas are unchanged"), "v0.5.2 candidate must protect receiver schemas");
  assert(extractReceiverFlowReleaseDoc.includes("provider_probe_status=skipped"), "v0.5.2 candidate must preserve skipped provider probe gate");
  assert(extractReceiverFlowReleaseDoc.includes("No provider request"), "v0.5.2 candidate must state no provider request");
  assert(extractReceiverFlowReleaseDoc.includes("No automatic promotion to `ready_for_receiver`"), "v0.5.2 candidate must reject automatic ready promotion");
  assert(extractReceiverFlowReleaseDoc.includes("No Auto Flow"), "v0.5.2 candidate must state no Auto Flow");
  assert(extractReceiverFlowReleaseDoc.includes("No `.basebrief/`"), "v0.5.2 candidate must state no .basebrief directory");
  assert(extractReceiverFlowReleaseDoc.includes("No push, tag, or formal release"), "v0.5.2 candidate must keep release actions pending");
  assert(receiverFlowClosureReleaseDoc.includes("Receiver Flow Review Closure"), "v0.5.3 candidate must describe review closure");
  assert(receiverFlowClosureReleaseDoc.includes("does not add new CLI commands"), "v0.5.3 candidate must avoid new command scope");
  assert(receiverFlowClosureReleaseDoc.includes("rejected-candidate"), "v0.5.3 candidate must document rejected candidate example");
  assert(receiverFlowClosureReleaseDoc.includes("rejected-empty"), "v0.5.3 candidate must document rejected empty example");
  assert(receiverFlowClosureReleaseDoc.includes("receiver-flow --extract --source <file>` behavior remains unchanged"), "v0.5.3 candidate must protect extract behavior");
  assert(receiverFlowClosureReleaseDoc.includes("review-draft` behavior remains unchanged"), "v0.5.3 candidate must protect review-draft behavior");
  assert(receiverFlowClosureReleaseDoc.includes("BB9 handoff schema is unchanged"), "v0.5.3 candidate must protect BB9 schema");
  assert(receiverFlowClosureReleaseDoc.includes("Receiver Safe Check config and result schemas are unchanged"), "v0.5.3 candidate must protect receiver schemas");
  assert(receiverFlowClosureReleaseDoc.includes("provider_probe_status=skipped"), "v0.5.3 candidate must preserve skipped provider probe gate");
  assert(receiverFlowClosureReleaseDoc.includes("No provider request"), "v0.5.3 candidate must state no provider request");
  assert(receiverFlowClosureReleaseDoc.includes("No new CLI command"), "v0.5.3 candidate must state no new CLI command");
  assert(receiverFlowClosureReleaseDoc.includes("No Auto Flow"), "v0.5.3 candidate must state no Auto Flow");
  assert(receiverFlowClosureReleaseDoc.includes("No `.basebrief/`"), "v0.5.3 candidate must state no .basebrief directory");
  assert(receiverFlowClosureReleaseDoc.includes("No push, tag, or formal release"), "v0.5.3 candidate must keep release actions pending");
  assert(projectStateReleaseDoc.includes("Project State Directory Release"), "v0.6.0 release must describe project state");
  assert(projectStateReleaseDoc.includes(".basebrief/state.json"), "v0.6.0 release must document state output");
  assert(projectStateReleaseDoc.includes("basebrief-project-state-v1"), "v0.6.0 release must document schema version");
  assert(projectStateReleaseDoc.includes("state-init"), "v0.6.0 release must document state-init");
  assert(projectStateReleaseDoc.includes("state-read"), "v0.6.0 release must document state-read");
  assert(projectStateReleaseDoc.includes("handoff_status: ready_for_receiver"), "v0.6.0 release must require receiver-ready source");
  assert(projectStateReleaseDoc.includes("No provider request"), "v0.6.0 release must state no provider request");
  assert(projectStateReleaseDoc.includes("No Auto Flow"), "v0.6.0 release must state no Auto Flow");
  assert(projectStateReleaseDoc.includes("No receiver thread creation"), "v0.6.0 release must state no receiver thread creation");
  assert(projectStateReleaseDoc.includes("No provider gateway"), "v0.6.0 release must state no provider gateway");
  assert(projectStateReleaseDoc.includes("No published npm package"), "v0.6.0 release must state no published npm package");
  assert(projectStateReleaseDoc.includes("No global CLI installation"), "v0.6.0 release must state no global CLI");
  assert(projectStateReleaseDoc.includes("provider_probe_status=skipped"), "v0.6.0 release must preserve skipped provider probe gate");
  assert(projectStateReleaseDoc.includes("BB9 handoff schema is unchanged"), "v0.6.0 release must protect BB9 schema");
  assert(projectStateReleaseDoc.includes("Receiver Safe Check config and result schemas are unchanged"), "v0.6.0 release must protect receiver schemas");
  assert(v060PostReleaseBaselineDoc.includes("release tag: `v0.6.0`"), "v0.6.0 post-release baseline must record tag");
  assert(v060PostReleaseBaselineDoc.includes("provider_probe_status=skipped"), "v0.6.0 post-release baseline must preserve skipped provider wording");
  assert(v060PostReleaseBaselineDoc.includes("No Auto Flow implementation"), "v0.6.0 post-release baseline must keep Auto Flow deferred");
  assert(projectStateModelDoc.includes("not a memory store"), "project-state model doc must define non-goals");
  assert(projectStateModelDoc.includes("basebrief-project-state-v1"), "project-state model doc must name schema");
  assert(projectStateValidationRulesDoc.includes("handoff_status: ready_for_receiver"), "project-state validation doc must require ready source");
  assert(projectStateValidationRulesDoc.includes("BASEBRIEF_PROVIDER_API_KEY"), "project-state validation doc must document provider env shape only");
  assert(projectStateLifecycleReadinessDoc.includes("Project State Lifecycle Readiness"), "project-state lifecycle readiness doc must have stable title");
  assert(projectStateLifecycleReadinessDoc.includes("Readiness Criteria"), "project-state lifecycle readiness doc must define criteria");
  assert(projectStateLifecycleReadinessDoc.includes("basebrief-project-state-v1"), "project-state lifecycle readiness doc must preserve state schema");
  assert(projectStateLifecycleReadinessDoc.includes("No state lifecycle commands"), "project-state lifecycle readiness doc must state no lifecycle commands");
  assert(projectStateLifecycleReadinessDoc.includes("No Auto Flow"), "project-state lifecycle readiness doc must state no Auto Flow");
  assert(projectStateLifecycleReadinessDoc.includes("No provider request"), "project-state lifecycle readiness doc must state no provider request");
  assert(projectStateLifecycleReadinessDoc.includes("No schema change"), "project-state lifecycle readiness doc must state no schema change");
  assert(projectStateLifecycleReadinessDoc.includes("provider_probe_status=skipped"), "project-state lifecycle readiness doc must preserve skipped provider wording");
  assert(projectStateLifecycleReadinessDoc.includes("BASEBRIEF_PROVIDER_API_KEY"), "project-state lifecycle readiness doc must document provider env shape only");
  assert(projectStateLifecycleModelDoc.includes("Project State Lifecycle Model"), "project-state lifecycle model doc must have stable title");
  assert(projectStateLifecycleModelDoc.includes("state-status"), "project-state lifecycle model doc must document state-status");
  assert(projectStateLifecycleModelDoc.includes("state-validate"), "project-state lifecycle model doc must document state-validate");
  assert(projectStateLifecycleModelDoc.includes("state-history"), "project-state lifecycle model doc must document state-history");
  assert(projectStateLifecycleModelDoc.includes("state-advance"), "project-state lifecycle model doc must document state-advance");
  assert(projectStateLifecycleModelDoc.includes(".basebrief/history/"), "project-state lifecycle model doc must document history directory");
  assert(projectStateLifecycleModelDoc.includes("basebrief-project-state-v1"), "project-state lifecycle model doc must preserve state schema");
  assert(projectStateLifecycleModelDoc.includes("No Auto Flow"), "project-state lifecycle model doc must state no Auto Flow");
  assert(projectStateLifecycleModelDoc.includes("No provider request"), "project-state lifecycle model doc must state no provider request");
  assert(projectStateLifecycleModelDoc.includes("No schema change"), "project-state lifecycle model doc must state no schema change");
  assert(v06xTestMatrixDoc.includes("BaseBrief v0.6.x Test Matrix"), "v0.6.x test matrix must have a stable title");
  assert(v06xTestMatrixDoc.includes("provider_probe_status=skipped"), "v0.6.x test matrix must preserve skipped provider wording");
  assert(v06xTestMatrixDoc.includes("BASEBRIEF_PROVIDER_BASE_URL"), "v0.6.x test matrix must document provider env shape only");
  assert(v06xTestMatrixDoc.includes("v0.6.2 Self-Dogfooding Evidence"), "v0.6.x test matrix must document v0.6.2 evidence");
  assert(v06xTestMatrixDoc.includes("state-init-draft-rejected"), "v0.6.x test matrix must include draft rejection evidence");
  assert(v06xTestMatrixDoc.includes("state-init-env-source-rejected"), "v0.6.x test matrix must include .env source rejection evidence");
  assert(v06xTestMatrixDoc.includes("state-init-git-source-rejected"), "v0.6.x test matrix must include .git source rejection evidence");
  assert(v06xTestMatrixDoc.includes("state-init-duplicate-rejected"), "v0.6.x test matrix must include duplicate state rejection evidence");
  assert(v06xTestMatrixDoc.includes("v0.6.3 Lifecycle Readiness Gate"), "v0.6.x test matrix must document v0.6.3 readiness");
  assert(v06xTestMatrixDoc.includes("not automated yet"), "v0.6.x test matrix must classify deferred automation");
  assert(v06xTestMatrixDoc.includes("does not add state lifecycle commands"), "v0.6.x test matrix must keep lifecycle commands deferred");
  assert(v07xTestMatrixDoc.includes("BaseBrief v0.7.x Test Matrix"), "v0.7.x test matrix must have a stable title");
  assert(v07xTestMatrixDoc.includes("state-status-missing"), "v0.7.x test matrix must include missing status evidence");
  assert(v07xTestMatrixDoc.includes("state-validate-invalid"), "v0.7.x test matrix must include invalid validate evidence");
  assert(v07xTestMatrixDoc.includes("state-advance-archives-history"), "v0.7.x test matrix must include history archive evidence");
  assert(v07xTestMatrixDoc.includes("state-advance-draft-rejected"), "v0.7.x test matrix must include draft advance rejection evidence");
  assert(v07xTestMatrixDoc.includes("provider_probe_status=skipped"), "v0.7.x test matrix must preserve skipped provider wording");
  assert(v07xTestMatrixDoc.includes("BASEBRIEF_PROVIDER_BASE_URL"), "v0.7.x test matrix must document provider env shape only");
  assert(projectStateSelfDogfoodingDoc.includes("receiver-flow --guided"), "project-state self-dogfooding must document guided step");
  assert(projectStateSelfDogfoodingDoc.includes("state-read --json"), "project-state self-dogfooding must document state-read step");
  assert(projectStateSelfDogfoodingDoc.includes("No provider request"), "project-state self-dogfooding must state no provider request");
  assert(projectStateSelfDogfoodingV062Doc.includes("Project State Self-Dogfooding v0.6.2"), "v0.6.2 self-dogfooding must have stable title");
  assert(projectStateSelfDogfoodingV062Doc.includes("receiver-flow --guided"), "v0.6.2 self-dogfooding must document guided step");
  assert(projectStateSelfDogfoodingV062Doc.includes("review-draft"), "v0.6.2 self-dogfooding must document review-draft");
  assert(projectStateSelfDogfoodingV062Doc.includes("state-init"), "v0.6.2 self-dogfooding must document state-init");
  assert(projectStateSelfDogfoodingV062Doc.includes("state-read --json"), "v0.6.2 self-dogfooding must document state-read");
  assert(projectStateSelfDogfoodingV062Doc.includes("draft_needs_review"), "v0.6.2 self-dogfooding must document draft status");
  assert(projectStateSelfDogfoodingV062Doc.includes("ready_for_receiver"), "v0.6.2 self-dogfooding must document receiver-ready status");
  assert(projectStateSelfDogfoodingV062Doc.includes("basebrief-project-state-v1"), "v0.6.2 self-dogfooding must document state schema");
  assert(projectStateSelfDogfoodingV062Doc.includes("review-draft-unchecked"), "v0.6.2 self-dogfooding must include unchecked review evidence");
  assert(projectStateSelfDogfoodingV062Doc.includes("state-init-draft-rejected"), "v0.6.2 self-dogfooding must include draft rejection evidence");
  assert(projectStateSelfDogfoodingV062Doc.includes("state-read-missing-state"), "v0.6.2 self-dogfooding must include missing state evidence");
  assert(projectStateSelfDogfoodingV062Doc.includes("state-init-env-source-rejected"), "v0.6.2 self-dogfooding must include .env path rejection evidence");
  assert(projectStateSelfDogfoodingV062Doc.includes("state-init-git-source-rejected"), "v0.6.2 self-dogfooding must include .git path rejection evidence");
  assert(projectStateSelfDogfoodingV062Doc.includes("state-init-missing-field-rejected"), "v0.6.2 self-dogfooding must include missing field evidence");
  assert(projectStateSelfDogfoodingV062Doc.includes("state-init-duplicate-rejected"), "v0.6.2 self-dogfooding must include duplicate state evidence");
  assert(projectStateSelfDogfoodingV062Doc.includes("No provider request"), "v0.6.2 self-dogfooding must state no provider request");
  assert(projectStateSelfDogfoodingV062Doc.includes("not memory"), "v0.6.2 self-dogfooding must protect state model non-goals");
  assert(receiverFrictionDoc.includes("v0.6.2 Project-State Self-Dogfooding"), "receiver friction log must include v0.6.2 entry");
  assert(receiverFrictionDoc.includes("overreach_or_unwanted_automation"), "receiver friction log must track unwanted automation");
  assert(receiverFrictionDoc.includes("state-init-duplicate-rejected"), "receiver friction log must include duplicate state test case");
  assert(receiverFrictionDoc.includes("v0.6.3 Lifecycle Readiness Classification"), "receiver friction log must include v0.6.3 readiness classification");
  assert(receiverFrictionDoc.includes("lifecycle-readiness-v0.6.3"), "receiver friction log must include readiness test case id");
  assert(receiverFrictionDoc.includes("not_automated_yet"), "receiver friction log must classify deferred automation");
  assert(projectStateV062ReleaseDoc.includes("Self-Dogfooding Evidence Candidate"), "v0.6.2 release doc must describe evidence candidate");
  assert(projectStateV062ReleaseDoc.includes("basebrief-project-state-v1"), "v0.6.2 release doc must document state schema");
  assert(projectStateV062ReleaseDoc.includes("draft_needs_review"), "v0.6.2 release doc must document draft status");
  assert(projectStateV062ReleaseDoc.includes("ready_for_receiver"), "v0.6.2 release doc must document receiver-ready status");
  assert(projectStateV062ReleaseDoc.includes("state-init"), "v0.6.2 release doc must document state-init");
  assert(projectStateV062ReleaseDoc.includes("state-read --json"), "v0.6.2 release doc must document state-read");
  assert(projectStateV062ReleaseDoc.includes("state-init-draft-rejected"), "v0.6.2 release doc must include draft rejection evidence");
  assert(projectStateV062ReleaseDoc.includes("state-init-missing-field-rejected"), "v0.6.2 release doc must include missing field evidence");
  assert(projectStateV062ReleaseDoc.includes("state-init-duplicate-rejected"), "v0.6.2 release doc must include duplicate state evidence");
  assert(projectStateV062ReleaseDoc.includes("No provider request"), "v0.6.2 release doc must state no provider request");
  assert(projectStateV062ReleaseDoc.includes("No Auto Flow"), "v0.6.2 release doc must state no Auto Flow");
  assert(projectStateV062ReleaseDoc.includes("No state lifecycle commands"), "v0.6.2 release doc must state no state lifecycle commands");
  assert(projectStateV062ReleaseDoc.includes("No schema change"), "v0.6.2 release doc must state no schema change");
  assert(projectStateV062ReleaseDoc.includes("provider_probe_status=skipped"), "v0.6.2 release doc must preserve skipped provider probe gate");
  assert(projectStateV062ReleaseDoc.includes("BASEBRIEF_PROVIDER_API_KEY"), "v0.6.2 release doc must document provider env shape only");
  assert(projectStateLifecycleReadinessDogfoodingDoc.includes("Project State Lifecycle Readiness v0.6.3"), "v0.6.3 dogfooding doc must have stable title");
  assert(projectStateLifecycleReadinessDogfoodingDoc.includes("state-init-duplicate-rejected"), "v0.6.3 dogfooding doc must reference duplicate state friction");
  assert(projectStateLifecycleReadinessDogfoodingDoc.includes("state-read-missing-state"), "v0.6.3 dogfooding doc must reference missing state friction");
  assert(projectStateLifecycleReadinessDogfoodingDoc.includes("review-draft-unchecked"), "v0.6.3 dogfooding doc must reference review gate friction");
  assert(projectStateLifecycleReadinessDogfoodingDoc.includes("No state lifecycle commands"), "v0.6.3 dogfooding doc must state no lifecycle commands");
  assert(projectStateLifecycleReadinessDogfoodingDoc.includes("No Auto Flow"), "v0.6.3 dogfooding doc must state no Auto Flow");
  assert(projectStateLifecycleReadinessDogfoodingDoc.includes("No provider request"), "v0.6.3 dogfooding doc must state no provider request");
  assert(projectStateLifecycleReadinessDogfoodingDoc.includes("No schema change"), "v0.6.3 dogfooding doc must state no schema change");
  assert(projectStateLifecycleReadinessDogfoodingDoc.includes("provider_probe_status=skipped"), "v0.6.3 dogfooding doc must preserve skipped provider gate");
  assert(projectStateLifecycleDogfoodingV070Doc.includes("Project State Lifecycle v0.7.0"), "v0.7.0 dogfooding doc must have stable title");
  assert(projectStateLifecycleDogfoodingV070Doc.includes("state-status"), "v0.7.0 dogfooding doc must document state-status");
  assert(projectStateLifecycleDogfoodingV070Doc.includes("state-validate"), "v0.7.0 dogfooding doc must document state-validate");
  assert(projectStateLifecycleDogfoodingV070Doc.includes("state-history"), "v0.7.0 dogfooding doc must document state-history");
  assert(projectStateLifecycleDogfoodingV070Doc.includes("state-advance"), "v0.7.0 dogfooding doc must document state-advance");
  assert(projectStateLifecycleDogfoodingV070Doc.includes("state-advance-archives-history"), "v0.7.0 dogfooding doc must include history archive evidence");
  assert(projectStateLifecycleDogfoodingV070Doc.includes("No Auto Flow"), "v0.7.0 dogfooding doc must state no Auto Flow");
  assert(projectStateLifecycleDogfoodingV070Doc.includes("No provider request"), "v0.7.0 dogfooding doc must state no provider request");
  assert(projectStateLifecycleDogfoodingV070Doc.includes("No schema change"), "v0.7.0 dogfooding doc must state no schema change");
  assert(projectStateLifecycleDogfoodingV070Doc.includes("provider_probe_status=skipped"), "v0.7.0 dogfooding doc must preserve skipped provider gate");
  assert(basebriefSelfValidationPreV08Doc.includes("BaseBrief Self-Validation Pre-v0.8"), "Pre-v0.8 self-validation doc must have stable title");
  assert(basebriefSelfValidationPreV08Doc.includes("receiver-flow --guided"), "Pre-v0.8 self-validation doc must document guided command shape");
  assert(basebriefSelfValidationPreV08Doc.includes("review-draft"), "Pre-v0.8 self-validation doc must document review gate");
  assert(basebriefSelfValidationPreV08Doc.includes("state-init"), "Pre-v0.8 self-validation doc must document state-init");
  assert(basebriefSelfValidationPreV08Doc.includes("state-read --json"), "Pre-v0.8 self-validation doc must document state-read");
  assert(basebriefSelfValidationPreV08Doc.includes("basebrief-project-state-v1"), "Pre-v0.8 self-validation doc must preserve state schema");
  assert(basebriefSelfValidationPreV08Doc.includes("No provider request"), "Pre-v0.8 self-validation doc must state no provider request");
  assert(basebriefSelfValidationPreV08Doc.includes("No raw private output"), "Pre-v0.8 self-validation doc must reject raw private output");
  assert(basebriefSelfValidationPreV08Doc.includes("No v0.8 implementation yet"), "Pre-v0.8 self-validation doc must reject v0.8 implementation");
  assert(basebriefSelfValidationPreV08Doc.includes("provider_probe_status=skipped"), "Pre-v0.8 self-validation doc must preserve skipped provider gate");
  assert(basebriefSelfValidationPreV08Doc.includes("receiver-window-acceptance-retry"), "Pre-v0.8 self-validation doc must record receiver acceptance retry");
  assert(basebriefSelfValidationPreV08Doc.includes("wait for user confirmation"), "Pre-v0.8 self-validation doc must record explicit user-confirmation requirement");
  assert(preV08FrictionLogDoc.includes("Pre-v0.8 Friction Log"), "Pre-v0.8 friction log must have stable title");
  assert(preV08FrictionLogDoc.includes("review-checklist-required"), "Pre-v0.8 friction log must document review checklist friction");
  assert(preV08FrictionLogDoc.includes("state-artifact-local-only"), "Pre-v0.8 friction log must document local state artifact boundary");
  assert(preV08FrictionLogDoc.includes("receiver-acceptance-explicit-confirmation"), "Pre-v0.8 friction log must document explicit receiver confirmation friction");
  assert(preV08FrictionLogDoc.includes("receiver-acceptance-retry-passed"), "Pre-v0.8 friction log must document receiver retry pass");
  assert(preV08FrictionLogDoc.includes("No provider request"), "Pre-v0.8 friction log must state no provider request");
  assert(preV08FrictionLogDoc.includes("No raw private output"), "Pre-v0.8 friction log must reject raw private output");
  assert(preV08FrictionLogDoc.includes("No v0.8 implementation yet"), "Pre-v0.8 friction log must reject v0.8 implementation");
  assert(preV08FrictionLogDoc.includes("provider_probe_status=skipped"), "Pre-v0.8 friction log must preserve skipped provider gate");
  assert(docsIndex.includes("dogfooding/basebrief-self-validation-pre-v0.8.md"), "Docs index must link Pre-v0.8 self-validation evidence");
  assert(docsIndex.includes("dogfooding/pre-v0.8-friction-log.md"), "Docs index must link Pre-v0.8 friction log");
  assert(docsIndex.includes("dogfooding/sidecar-receiver-acceptance-v0.8.2.md"), "Docs index must link v0.8.2 sidecar receiver acceptance evidence");
  assert(docsIndex.includes("dogfooding/sidecar-external-receiver-smoke-v0.8.4.md"), "Docs index must link v0.8.4 sidecar external receiver smoke evidence");
  assert(docsIndex.includes("dogfooding/sidecar-manual-receiver-smoke-v0.8.5.md"), "Docs index must link v0.8.5 sidecar manual receiver smoke intake");
  assert(docsIndex.includes("dogfooding/sidecar-manual-receiver-smoke-v0.8.6.md"), "Docs index must link v0.8.6 sidecar manual receiver smoke evidence");
  assert(docsIndex.includes("dogfooding/sidecar-openclaw-hermes-manual-smoke-followup.md"), "Docs index must link OpenClaw/Hermes manual smoke follow-up");
  assert(projectStateV063ReleaseDoc.includes("Lifecycle Readiness Gate Candidate"), "v0.6.3 release doc must describe readiness candidate");
  assert(projectStateV063ReleaseDoc.includes("not a lifecycle release"), "v0.6.3 release doc must reject lifecycle release status");
  assert(projectStateV063ReleaseDoc.includes("No state lifecycle commands"), "v0.6.3 release doc must state no lifecycle commands");
  assert(projectStateV063ReleaseDoc.includes("No Auto Flow"), "v0.6.3 release doc must state no Auto Flow");
  assert(projectStateV063ReleaseDoc.includes("No provider request"), "v0.6.3 release doc must state no provider request");
  assert(projectStateV063ReleaseDoc.includes("No schema change"), "v0.6.3 release doc must state no schema change");
  assert(projectStateV063ReleaseDoc.includes("provider_probe_status=skipped"), "v0.6.3 release doc must preserve skipped provider probe gate");
  assert(projectStateV063ReleaseDoc.includes("BASEBRIEF_PROVIDER_API_KEY"), "v0.6.3 release doc must document provider env shape only");
  assert(projectStateV070ReleaseDoc.includes("Project State Lifecycle Candidate"), "v0.7.0 release doc must describe lifecycle candidate");
  assert(projectStateV070ReleaseDoc.includes("state-status"), "v0.7.0 release doc must document state-status");
  assert(projectStateV070ReleaseDoc.includes("state-validate"), "v0.7.0 release doc must document state-validate");
  assert(projectStateV070ReleaseDoc.includes("state-history"), "v0.7.0 release doc must document state-history");
  assert(projectStateV070ReleaseDoc.includes("state-advance"), "v0.7.0 release doc must document state-advance");
  assert(projectStateV070ReleaseDoc.includes(".basebrief/history/"), "v0.7.0 release doc must document history output");
  assert(projectStateV070ReleaseDoc.includes("No Auto Flow"), "v0.7.0 release doc must state no Auto Flow");
  assert(projectStateV070ReleaseDoc.includes("No provider request"), "v0.7.0 release doc must state no provider request");
  assert(projectStateV070ReleaseDoc.includes("No schema change"), "v0.7.0 release doc must state no schema change");
  assert(projectStateV070ReleaseDoc.includes("provider_probe_status=skipped"), "v0.7.0 release doc must preserve skipped provider probe gate");
  assert(projectStateV070ReleaseDoc.includes("BASEBRIEF_PROVIDER_API_KEY"), "v0.7.0 release doc must document provider env shape only");
  assert(sidecarV080ReleaseDoc.includes("Sidecar Handoff Bundle Candidate"), "v0.8.0 release doc must describe sidecar candidate");
  assert(sidecarV080ReleaseDoc.includes("sidecar-build --repo <target-repo>"), "v0.8.0 release doc must document sidecar-build");
  assert(sidecarV080ReleaseDoc.includes("basebrief-project-state-v1"), "v0.8.0 release doc must preserve project-state schema");
  assert(sidecarV080ReleaseDoc.includes("No provider request"), "v0.8.0 release doc must state no provider request");
  assert(sidecarV080ReleaseDoc.includes("No raw private output"), "v0.8.0 release doc must state no raw private output");
  assert(sidecarV080ReleaseDoc.includes("No runtime integration"), "v0.8.0 release doc must state no runtime integration");
  assert(sidecarV080ReleaseDoc.includes("No schema change"), "v0.8.0 release doc must state no schema change");
  assert(sidecarV080ReleaseDoc.includes("No Auto Flow"), "v0.8.0 release doc must state no Auto Flow");
  assert(sidecarV080ReleaseDoc.includes("Wait for user confirmation"), "v0.8.0 release doc must state user-confirmation boundary");
  assert(sidecarV080ReleaseDoc.includes("provider_probe_status=skipped"), "v0.8.0 release doc must preserve skipped provider gate");
  assert(sidecarV081ReleaseDoc.includes("Sidecar Check Hardening Candidate"), "v0.8.1 release doc must describe sidecar check candidate");
  assert(sidecarV081ReleaseDoc.includes("sidecar-check --input <sidecar-dir>"), "v0.8.1 release doc must document sidecar-check");
  assert(sidecarV081ReleaseDoc.includes("basebrief-sidecar-v1"), "v0.8.1 release doc must preserve sidecar schema");
  assert(sidecarV081ReleaseDoc.includes("basebrief-project-state-v1"), "v0.8.1 release doc must preserve project-state schema");
  assert(sidecarV081ReleaseDoc.includes("No provider request"), "v0.8.1 release doc must state no provider request");
  assert(sidecarV081ReleaseDoc.includes("No raw private output"), "v0.8.1 release doc must state no raw private output");
  assert(sidecarV081ReleaseDoc.includes("No runtime integration"), "v0.8.1 release doc must state no runtime integration");
  assert(sidecarV081ReleaseDoc.includes("No schema change"), "v0.8.1 release doc must state no schema change");
  assert(sidecarV081ReleaseDoc.includes("No Auto Flow"), "v0.8.1 release doc must state no Auto Flow");
  assert(sidecarV081ReleaseDoc.includes("wait for user confirmation"), "v0.8.1 release doc must state user-confirmation boundary");
  assert(sidecarV081ReleaseDoc.includes("provider_probe_status=skipped"), "v0.8.1 release doc must preserve skipped provider gate");
  assert(sidecarV082ReleaseDoc.includes("Sidecar Receiver Acceptance Evidence Candidate"), "v0.8.2 release doc must describe sidecar receiver acceptance evidence");
  assert(sidecarV082ReleaseDoc.includes("sidecar-build"), "v0.8.2 release doc must document sidecar-build evidence");
  assert(sidecarV082ReleaseDoc.includes("sidecar-check"), "v0.8.2 release doc must document sidecar-check evidence");
  assert(sidecarV082ReleaseDoc.includes("generic"), "v0.8.2 release doc must document generic target");
  assert(sidecarV082ReleaseDoc.includes("openclaw"), "v0.8.2 release doc must document openclaw target");
  assert(sidecarV082ReleaseDoc.includes("basebrief-project-state-v1"), "v0.8.2 release doc must preserve project-state schema");
  assert(sidecarV082ReleaseDoc.includes("basebrief-sidecar-v1"), "v0.8.2 release doc must preserve sidecar schema");
  assert(sidecarV082ReleaseDoc.includes("No provider request"), "v0.8.2 release doc must state no provider request");
  assert(sidecarV082ReleaseDoc.includes("No raw private output"), "v0.8.2 release doc must state no raw private output");
  assert(sidecarV082ReleaseDoc.includes("No runtime integration"), "v0.8.2 release doc must state no runtime integration");
  assert(sidecarV082ReleaseDoc.includes("No schema change"), "v0.8.2 release doc must state no schema change");
  assert(sidecarV082ReleaseDoc.includes("No Auto Flow"), "v0.8.2 release doc must state no Auto Flow");
  assert(sidecarV082ReleaseDoc.includes("Wait for user confirmation"), "v0.8.2 release doc must state user-confirmation boundary");
  assert(sidecarV082ReleaseDoc.includes("provider_probe_status=skipped"), "v0.8.2 release doc must preserve skipped provider gate");
  assert(sidecarV083ReleaseDoc.includes("Sidecar Discoverability Polish Candidate"), "v0.8.3 release doc must describe sidecar discoverability polish");
  assert(sidecarV083ReleaseDoc.includes("sidecar-build"), "v0.8.3 release doc must document sidecar-build");
  assert(sidecarV083ReleaseDoc.includes("sidecar-check"), "v0.8.3 release doc must document sidecar-check");
  assert(sidecarV083ReleaseDoc.includes("generic"), "v0.8.3 release doc must document generic target");
  assert(sidecarV083ReleaseDoc.includes("openclaw"), "v0.8.3 release doc must document openclaw target");
  assert(sidecarV083ReleaseDoc.includes("basebrief-project-state-v1"), "v0.8.3 release doc must preserve project-state schema");
  assert(sidecarV083ReleaseDoc.includes("basebrief-sidecar-v1"), "v0.8.3 release doc must preserve sidecar schema");
  assert(sidecarV083ReleaseDoc.includes("No provider request"), "v0.8.3 release doc must state no provider request");
  assert(sidecarV083ReleaseDoc.includes("No raw private output"), "v0.8.3 release doc must state no raw private output");
  assert(sidecarV083ReleaseDoc.includes("No runtime integration"), "v0.8.3 release doc must state no runtime integration");
  assert(sidecarV083ReleaseDoc.includes("No schema change"), "v0.8.3 release doc must state no schema change");
  assert(sidecarV083ReleaseDoc.includes("No Auto Flow"), "v0.8.3 release doc must state no Auto Flow");
  assert(sidecarV083ReleaseDoc.includes("Wait for user confirmation"), "v0.8.3 release doc must state user-confirmation boundary");
  assert(sidecarV083ReleaseDoc.includes("provider_probe_status=skipped"), "v0.8.3 release doc must preserve skipped provider gate");
  assert(sidecarV084ReleaseDoc.includes("External Receiver Smoke Evidence Candidate"), "v0.8.4 release doc must describe external receiver smoke evidence");
  assert(sidecarV084ReleaseDoc.includes("sidecar-build"), "v0.8.4 release doc must document sidecar-build");
  assert(sidecarV084ReleaseDoc.includes("sidecar-check"), "v0.8.4 release doc must document sidecar-check");
  assert(sidecarV084ReleaseDoc.includes("generic"), "v0.8.4 release doc must document generic target");
  assert(sidecarV084ReleaseDoc.includes("openclaw"), "v0.8.4 release doc must document openclaw target");
  assert(sidecarV084ReleaseDoc.includes("OpenCode"), "v0.8.4 release doc must mention OpenCode status");
  assert(sidecarV084ReleaseDoc.includes("Claude Code"), "v0.8.4 release doc must mention Claude Code status");
  assert(sidecarV084ReleaseDoc.includes("manual_required"), "v0.8.4 release doc must avoid claiming external receiver pass");
  assert(sidecarV084ReleaseDoc.includes("basebrief-project-state-v1"), "v0.8.4 release doc must preserve project-state schema");
  assert(sidecarV084ReleaseDoc.includes("basebrief-sidecar-v1"), "v0.8.4 release doc must preserve sidecar schema");
  assert(sidecarV084ReleaseDoc.includes("No provider request"), "v0.8.4 release doc must state no provider request");
  assert(sidecarV084ReleaseDoc.includes("No raw private output"), "v0.8.4 release doc must state no raw private output");
  assert(sidecarV084ReleaseDoc.includes("No runtime integration"), "v0.8.4 release doc must state no runtime integration");
  assert(sidecarV084ReleaseDoc.includes("No schema change"), "v0.8.4 release doc must state no schema change");
  assert(sidecarV084ReleaseDoc.includes("No Auto Flow"), "v0.8.4 release doc must state no Auto Flow");
  assert(sidecarV084ReleaseDoc.includes("Wait for user confirmation"), "v0.8.4 release doc must state user-confirmation boundary");
  assert(sidecarV084ReleaseDoc.includes("provider_probe_status=skipped"), "v0.8.4 release doc must preserve skipped provider gate");
  assert(sidecarV085ReleaseDoc.includes("Manual Receiver Smoke Result Intake Candidate"), "v0.8.5 release doc must describe manual receiver smoke intake");
  assert(sidecarV085ReleaseDoc.includes("OpenCode"), "v0.8.5 release doc must mention OpenCode");
  assert(sidecarV085ReleaseDoc.includes("Claude Code"), "v0.8.5 release doc must mention Claude Code");
  assert(sidecarV085ReleaseDoc.includes("not_run"), "v0.8.5 release doc must preserve not-run status");
  assert(sidecarV085ReleaseDoc.includes("manual_required"), "v0.8.5 release doc must preserve manual-required status");
  assert(sidecarV085ReleaseDoc.includes("sidecar-build"), "v0.8.5 release doc must mention sidecar-build");
  assert(sidecarV085ReleaseDoc.includes("sidecar-check"), "v0.8.5 release doc must mention sidecar-check");
  assert(sidecarV085ReleaseDoc.includes("generic"), "v0.8.5 release doc must document generic target");
  assert(sidecarV085ReleaseDoc.includes("openclaw"), "v0.8.5 release doc must document openclaw target");
  assert(sidecarV085ReleaseDoc.includes("basebrief-project-state-v1"), "v0.8.5 release doc must preserve project-state schema");
  assert(sidecarV085ReleaseDoc.includes("basebrief-sidecar-v1"), "v0.8.5 release doc must preserve sidecar schema");
  assert(sidecarV085ReleaseDoc.includes("new-window-starter.md"), "v0.8.5 release doc must connect to new-window-starter.md");
  assert(sidecarV085ReleaseDoc.includes("pass/fail"), "v0.8.5 release doc must preserve pass/fail wording");
  assert(sidecarV085ReleaseDoc.includes("No provider request"), "v0.8.5 release doc must state no provider request");
  assert(sidecarV085ReleaseDoc.includes("No raw private output"), "v0.8.5 release doc must state no raw private output");
  assert(sidecarV085ReleaseDoc.includes("No runtime integration"), "v0.8.5 release doc must state no runtime integration");
  assert(sidecarV085ReleaseDoc.includes("No schema change"), "v0.8.5 release doc must state no schema change");
  assert(sidecarV085ReleaseDoc.includes("No Auto Flow"), "v0.8.5 release doc must state no Auto Flow");
  assert(sidecarV085ReleaseDoc.includes("Wait for user confirmation"), "v0.8.5 release doc must state user-confirmation boundary");
  assert(sidecarV085ReleaseDoc.includes("provider_probe_status=skipped"), "v0.8.5 release doc must preserve skipped provider gate");
  assert(!sidecarV085ReleaseDoc.includes("OpenCode generic receiver smoke: passed"), "v0.8.5 release doc must not claim OpenCode generic pass");
  assert(!sidecarV085ReleaseDoc.includes("Claude Code generic receiver smoke: passed"), "v0.8.5 release doc must not claim Claude Code generic pass");
  assert(sidecarV086ReleaseDoc.includes("Manual Receiver Smoke Result Intake Evidence Candidate"), "v0.8.6 release doc must describe manual receiver smoke evidence");
  assert(sidecarV086ReleaseDoc.includes("OpenCode generic receiver smoke: passed"), "v0.8.6 release doc must record OpenCode generic passed status");
  assert(sidecarV086ReleaseDoc.includes("Claude Code generic receiver smoke: passed"), "v0.8.6 release doc must record Claude Code generic passed status");
  assert(sidecarV086ReleaseDoc.includes("OpenCode openclaw receiver smoke: not_run"), "v0.8.6 release doc must preserve OpenCode openclaw not-run status");
  assert(sidecarV086ReleaseDoc.includes("Claude Code openclaw receiver smoke: not_run"), "v0.8.6 release doc must preserve Claude Code openclaw not-run status");
  assert(sidecarV086ReleaseDoc.includes("manual_required"), "v0.8.6 release doc must preserve manual-required status");
  assert(sidecarV086ReleaseDoc.includes("Only the two generic receiver smoke rows are marked `passed`"), "v0.8.6 release doc must scope passed rows to generic");
  assert(sidecarV086ReleaseDoc.includes("basebrief-project-state-v1"), "v0.8.6 release doc must preserve project-state schema");
  assert(sidecarV086ReleaseDoc.includes("basebrief-sidecar-v1"), "v0.8.6 release doc must preserve sidecar schema");
  assert(sidecarV086ReleaseDoc.includes("new-window-starter.md"), "v0.8.6 release doc must connect to new-window-starter.md");
  assert(sidecarV086ReleaseDoc.includes("pass/fail"), "v0.8.6 release doc must preserve pass/fail wording");
  assert(sidecarV086ReleaseDoc.includes("No raw private output"), "v0.8.6 release doc must state raw-output boundary");
  assert(sidecarV086ReleaseDoc.includes("No runtime integration"), "v0.8.6 release doc must state runtime boundary");
  assert(sidecarV086ReleaseDoc.includes("No schema change"), "v0.8.6 release doc must state schema boundary");
  assert(sidecarV086ReleaseDoc.includes("No Auto Flow"), "v0.8.6 release doc must state Auto Flow boundary");
  assert(sidecarV086ReleaseDoc.includes("Wait for user confirmation"), "v0.8.6 release doc must state user-confirmation boundary");
  assert(sidecarV086ReleaseDoc.includes("provider_probe_status=skipped"), "v0.8.6 release doc must preserve skipped provider gate");
  assert(!sidecarV086ReleaseDoc.includes("OpenCode openclaw receiver smoke: passed"), "v0.8.6 release doc must not claim OpenCode openclaw pass");
  assert(!sidecarV086ReleaseDoc.includes("Claude Code openclaw receiver smoke: passed"), "v0.8.6 release doc must not claim Claude Code openclaw pass");
  assert(sidecarV087ReleaseDoc.includes("Copyable New-Window Starter Candidate"), "v0.8.7 release doc must describe copyable starter candidate");
  assert(sidecarV087ReleaseDoc.includes("new-window-starter.md"), "v0.8.7 release doc must mention new-window-starter.md");
  assert(sidecarV087ReleaseDoc.includes("output_files.newWindowStarter"), "v0.8.7 release doc must document manifest output key");
  assert(sidecarV087ReleaseDoc.includes("new_window_starter=<path>"), "v0.8.7 release doc must document CLI human output");
  assert(sidecarV087ReleaseDoc.includes("pass/fail"), "v0.8.7 release doc must document receiver pass/fail reporting");
  assert(sidecarV087ReleaseDoc.includes("old v0.8 bundles"), "v0.8.7 release doc must document old bundle compatibility");
  assert(sidecarV087ReleaseDoc.includes("No provider request"), "v0.8.7 release doc must state no provider request");
  assert(sidecarV087ReleaseDoc.includes("No raw private output"), "v0.8.7 release doc must state raw-output boundary");
  assert(sidecarV087ReleaseDoc.includes("No runtime integration"), "v0.8.7 release doc must state runtime boundary");
  assert(sidecarV087ReleaseDoc.includes("No schema change"), "v0.8.7 release doc must state schema boundary");
  assert(sidecarV087ReleaseDoc.includes("No Auto Flow"), "v0.8.7 release doc must state Auto Flow boundary");
  assert(sidecarV087ReleaseDoc.includes("Wait for user confirmation"), "v0.8.7 release doc must state user-confirmation boundary");
  assert(sidecarV087ReleaseDoc.includes("No clipboard automation"), "v0.8.7 release doc must reject clipboard automation");
  assert(sidecarV087ReleaseDoc.includes("No UI integration"), "v0.8.7 release doc must reject UI integration");
  assert(sidecarV087ReleaseDoc.includes("basebrief-project-state-v1"), "v0.8.7 release doc must preserve project-state schema");
  assert(sidecarV087ReleaseDoc.includes("basebrief-sidecar-v1"), "v0.8.7 release doc must preserve sidecar schema");
  assert(sidecarV087ReleaseDoc.includes("provider_probe_status=skipped"), "v0.8.7 release doc must preserve skipped provider gate");
  assert(sidecarV088ReleaseDoc.includes("Starter Language Routing Candidate"), "v0.8.8 release doc must describe starter language routing");
  assert(sidecarV088ReleaseDoc.includes("--starter-language auto|zh-CN|en|ja"), "v0.8.8 release doc must document starter language option");
  assert(sidecarV088ReleaseDoc.includes("buildSidecarBundle({ starterLanguage })"), "v0.8.8 release doc must document JS API option");
  assert(sidecarV088ReleaseDoc.includes("falls back to `zh-CN`"), "v0.8.8 release doc must document zh-CN fallback");
  assert(sidecarV088ReleaseDoc.includes("No automatic translation service"), "v0.8.8 release doc must reject translation-service scope");
  assert(sidecarV088ReleaseDoc.includes("pass/fail"), "v0.8.8 release doc must preserve receiver pass/fail anchor");
  assert(sidecarV088ReleaseDoc.includes("basebrief-project-state-v1"), "v0.8.8 release doc must preserve project-state schema");
  assert(sidecarV088ReleaseDoc.includes("basebrief-sidecar-v1"), "v0.8.8 release doc must preserve sidecar schema");
  assert(sidecarV088ReleaseDoc.includes("No provider request"), "v0.8.8 release doc must state no provider request");
  assert(sidecarV088ReleaseDoc.includes("No raw private output"), "v0.8.8 release doc must state raw-output boundary");
  assert(sidecarV088ReleaseDoc.includes("No runtime integration"), "v0.8.8 release doc must state runtime boundary");
  assert(sidecarV088ReleaseDoc.includes("No schema change"), "v0.8.8 release doc must state schema boundary");
  assert(sidecarV088ReleaseDoc.includes("No Auto Flow"), "v0.8.8 release doc must state Auto Flow boundary");
  assert(sidecarV088ReleaseDoc.includes("provider_probe_status=skipped"), "v0.8.8 release doc must preserve skipped provider gate");
  assert(readinessV090ReleaseDoc.includes("Integrated Handoff Readiness Candidate"), "v0.9.0 release doc must define readiness candidate");
  assert(readinessV090ReleaseDoc.includes("receiver-ready handoff -> Project State -> Sidecar bundle -> receiver first response"), "v0.9.0 release doc must define integrated handoff path");
  assert(readinessV090ReleaseDoc.includes("No provider request"), "v0.9.0 release doc must reject provider requests");
  assert(readinessV090ReleaseDoc.includes("No raw private output"), "v0.9.0 release doc must reject raw private output");
  assert(readinessV090ReleaseDoc.includes("No runtime integration"), "v0.9.0 release doc must reject runtime integration");
  assert(readinessV090ReleaseDoc.includes("No schema change"), "v0.9.0 release doc must reject schema changes");
  assert(readinessV090ReleaseDoc.includes("No Auto Flow"), "v0.9.0 release doc must reject Auto Flow");
  assert(readinessV090ReleaseDoc.includes("No plugin or platform work"), "v0.9.0 release doc must reject plugin/platform scope");
  assert(readinessV090ReleaseDoc.includes("No v1.0 claim"), "v0.9.0 release doc must reject v1.0 claims");
  assert(readinessV090ReleaseDoc.includes("No cross-provider cache claim"), "v0.9.0 release doc must reject cross-provider cache claims");
  assert(readinessV090ReleaseDoc.includes("No claim based on audited billing records"), "v0.9.0 release doc must reject billing audit claims");
  assert(readinessV090ReleaseDoc.includes("provider_probe_status=skipped"), "v0.9.0 release doc must preserve skipped provider gate");
  assert(sidecarReceiverAcceptanceV082Doc.includes("Sidecar Receiver Acceptance v0.8.2"), "v0.8.2 dogfooding doc must have stable title");
  assert(sidecarReceiverAcceptanceV082Doc.includes("sidecar-build"), "v0.8.2 dogfooding doc must document sidecar-build");
  assert(sidecarReceiverAcceptanceV082Doc.includes("sidecar-check"), "v0.8.2 dogfooding doc must document sidecar-check");
  assert(sidecarReceiverAcceptanceV082Doc.includes("generic bundle | passed"), "v0.8.2 dogfooding doc must record generic pass");
  assert(sidecarReceiverAcceptanceV082Doc.includes("openclaw bundle | passed"), "v0.8.2 dogfooding doc must record openclaw pass");
  assert(sidecarReceiverAcceptanceV082Doc.includes("0 errors, 0 warnings"), "v0.8.2 dogfooding doc must record artifact checker result");
  assert(sidecarReceiverAcceptanceV082Doc.includes("No provider request"), "v0.8.2 dogfooding doc must state no provider request");
  assert(sidecarReceiverAcceptanceV082Doc.includes("No raw private output"), "v0.8.2 dogfooding doc must state no raw private output");
  assert(sidecarReceiverAcceptanceV082Doc.includes("No runtime integration"), "v0.8.2 dogfooding doc must state no runtime integration");
  assert(sidecarReceiverAcceptanceV082Doc.includes("No schema change"), "v0.8.2 dogfooding doc must state no schema change");
  assert(sidecarReceiverAcceptanceV082Doc.includes("provider_probe_status=skipped"), "v0.8.2 dogfooding doc must preserve skipped provider gate");
  assert(sidecarExternalReceiverSmokeV084Doc.includes("Sidecar External Receiver Smoke v0.8.4"), "v0.8.4 dogfooding doc must have stable title");
  assert(sidecarExternalReceiverSmokeV084Doc.includes("sidecar-build"), "v0.8.4 dogfooding doc must document sidecar-build");
  assert(sidecarExternalReceiverSmokeV084Doc.includes("sidecar-check"), "v0.8.4 dogfooding doc must document sidecar-check");
  assert(sidecarExternalReceiverSmokeV084Doc.includes("generic"), "v0.8.4 dogfooding doc must document generic target");
  assert(sidecarExternalReceiverSmokeV084Doc.includes("openclaw"), "v0.8.4 dogfooding doc must document openclaw target");
  assert(sidecarExternalReceiverSmokeV084Doc.includes("OpenCode CLI availability | available"), "v0.8.4 dogfooding doc must record OpenCode availability");
  assert(sidecarExternalReceiverSmokeV084Doc.includes("Claude Code CLI availability | available"), "v0.8.4 dogfooding doc must record Claude Code availability");
  assert(sidecarExternalReceiverSmokeV084Doc.includes("manual_required"), "v0.8.4 dogfooding doc must record manual-required external execution");
  assert(sidecarExternalReceiverSmokeV084Doc.includes("0 errors, 0 warnings"), "v0.8.4 dogfooding doc must record artifact checker result");
  assert(sidecarExternalReceiverSmokeV084Doc.includes("No provider request"), "v0.8.4 dogfooding doc must state no provider request");
  assert(sidecarExternalReceiverSmokeV084Doc.includes("No raw private output"), "v0.8.4 dogfooding doc must state no raw private output");
  assert(sidecarExternalReceiverSmokeV084Doc.includes("No runtime integration"), "v0.8.4 dogfooding doc must state no runtime integration");
  assert(sidecarExternalReceiverSmokeV084Doc.includes("No schema change"), "v0.8.4 dogfooding doc must state no schema change");
  assert(sidecarExternalReceiverSmokeV084Doc.includes("wait for user confirmation"), "v0.8.4 dogfooding doc must state user-confirmation boundary");
  assert(sidecarExternalReceiverSmokeV084Doc.includes("provider_probe_status=skipped"), "v0.8.4 dogfooding doc must preserve skipped provider gate");
  assert(sidecarManualReceiverSmokeV085Doc.includes("Sidecar Manual Receiver Smoke v0.8.5"), "v0.8.5 dogfooding doc must have stable title");
  assert(sidecarManualReceiverSmokeV085Doc.includes("opencode | generic | not_run | manual_required"), "v0.8.5 dogfooding doc must record OpenCode generic not-run status");
  assert(sidecarManualReceiverSmokeV085Doc.includes("claude-code | generic | not_run | manual_required"), "v0.8.5 dogfooding doc must record Claude Code generic not-run status");
  assert(sidecarManualReceiverSmokeV085Doc.includes("tool: opencode | claude-code"), "v0.8.5 dogfooding doc must document tool intake field");
  assert(sidecarManualReceiverSmokeV085Doc.includes("target: generic | openclaw"), "v0.8.5 dogfooding doc must document target intake field");
  assert(sidecarManualReceiverSmokeV085Doc.includes("status: passed | failed | timed_out | unavailable | not_run"), "v0.8.5 dogfooding doc must document status intake field");
  assert(sidecarManualReceiverSmokeV085Doc.includes("basebrief_identified"), "v0.8.5 dogfooding doc must require BaseBrief acceptance field");
  assert(sidecarManualReceiverSmokeV085Doc.includes("v08x_identified"), "v0.8.5 dogfooding doc must require v0.8.x acceptance field");
  assert(sidecarManualReceiverSmokeV085Doc.includes("current_commit_identified"), "v0.8.5 dogfooding doc must require current commit acceptance field");
  assert(sidecarManualReceiverSmokeV085Doc.includes("current_goal_repeated"), "v0.8.5 dogfooding doc must require current_goal acceptance field");
  assert(sidecarManualReceiverSmokeV085Doc.includes("receiver_entry_task_repeated"), "v0.8.5 dogfooding doc must require receiver task acceptance field");
  assert(sidecarManualReceiverSmokeV085Doc.includes("risk_boundaries_count"), "v0.8.5 dogfooding doc must require risk boundary count");
  assert(sidecarManualReceiverSmokeV085Doc.includes("wait_for_user_confirmation"), "v0.8.5 dogfooding doc must require user confirmation field");
  assert(sidecarManualReceiverSmokeV085Doc.includes("no_auto_advance"), "v0.8.5 dogfooding doc must require no-auto-advance field");
  assert(sidecarManualReceiverSmokeV085Doc.includes("no_provider"), "v0.8.5 dogfooding doc must require no-provider field");
  assert(sidecarManualReceiverSmokeV085Doc.includes("no_runtime"), "v0.8.5 dogfooding doc must require no-runtime field");
  assert(sidecarManualReceiverSmokeV085Doc.includes("new-window-starter.md"), "v0.8.5 dogfooding doc must link to the starter acceptance anchor");
  assert(sidecarManualReceiverSmokeV085Doc.includes("pass/fail"), "v0.8.5 dogfooding doc must preserve pass/fail wording");
  assert(sidecarManualReceiverSmokeV085Doc.includes("human-facing `pass`"), "v0.8.5 dogfooding doc must require human-facing pass for passed rows");
  assert(sidecarManualReceiverSmokeV085Doc.includes("human-facing `fail`"), "v0.8.5 dogfooding doc must explain failed human-facing reports");
  assert(sidecarManualReceiverSmokeV085Doc.includes("No provider request"), "v0.8.5 dogfooding doc must state no provider request");
  assert(sidecarManualReceiverSmokeV085Doc.includes("No raw private output"), "v0.8.5 dogfooding doc must state no raw private output");
  assert(sidecarManualReceiverSmokeV085Doc.includes("No runtime integration"), "v0.8.5 dogfooding doc must state no runtime integration");
  assert(sidecarManualReceiverSmokeV085Doc.includes("No schema change"), "v0.8.5 dogfooding doc must state no schema change");
  assert(sidecarManualReceiverSmokeV085Doc.includes("Wait for user confirmation"), "v0.8.5 dogfooding doc must state user-confirmation boundary");
  assert(sidecarManualReceiverSmokeV085Doc.includes("provider_probe_status=skipped"), "v0.8.5 dogfooding doc must preserve skipped provider gate");
  assert(!sidecarManualReceiverSmokeV085Doc.includes("opencode | generic | passed"), "v0.8.5 dogfooding doc must not claim OpenCode generic pass");
  assert(!sidecarManualReceiverSmokeV085Doc.includes("claude-code | generic | passed"), "v0.8.5 dogfooding doc must not claim Claude Code generic pass");
  assert(sidecarManualReceiverSmokeV086Doc.includes("Sidecar Manual Receiver Smoke v0.8.6"), "v0.8.6 dogfooding doc must have stable title");
  assert(sidecarManualReceiverSmokeV086Doc.includes("opencode | generic | passed"), "v0.8.6 dogfooding doc must record OpenCode generic passed status");
  assert(sidecarManualReceiverSmokeV086Doc.includes("claude-code | generic | passed"), "v0.8.6 dogfooding doc must record Claude Code generic passed status");
  assert(sidecarManualReceiverSmokeV086Doc.includes("opencode | openclaw | not_run | manual_required"), "v0.8.6 dogfooding doc must preserve OpenCode openclaw not-run status");
  assert(sidecarManualReceiverSmokeV086Doc.includes("claude-code | openclaw | not_run | manual_required"), "v0.8.6 dogfooding doc must preserve Claude Code openclaw not-run status");
  assert(sidecarManualReceiverSmokeV086Doc.includes("v08x_identified: yes"), "v0.8.6 dogfooding doc must record v0.8.x acceptance field");
  assert(sidecarManualReceiverSmokeV086Doc.includes("risk_boundaries_count: 7"), "v0.8.6 dogfooding doc must record risk boundary count");
  assert(sidecarManualReceiverSmokeV086Doc.includes("wait_for_user_confirmation: yes"), "v0.8.6 dogfooding doc must record user confirmation field");
  assert(sidecarManualReceiverSmokeV086Doc.includes("no_auto_advance: yes"), "v0.8.6 dogfooding doc must record no-auto-advance field");
  assert(sidecarManualReceiverSmokeV086Doc.includes("no_provider: yes"), "v0.8.6 dogfooding doc must record no-provider field");
  assert(sidecarManualReceiverSmokeV086Doc.includes("no_runtime: yes"), "v0.8.6 dogfooding doc must record no-runtime field");
  assert(sidecarManualReceiverSmokeV086Doc.includes("new-window-starter.md"), "v0.8.6 dogfooding doc must link to the starter acceptance anchor");
  assert(sidecarManualReceiverSmokeV086Doc.includes("reported `pass`"), "v0.8.6 dogfooding doc must preserve pass evidence");
  assert(sidecarManualReceiverSmokeV086Doc.includes("No provider request"), "v0.8.6 dogfooding doc must reject provider requests");
  assert(sidecarManualReceiverSmokeV086Doc.includes("Only the two generic rows are marked `passed`"), "v0.8.6 dogfooding doc must scope passed rows to generic");
  assert(sidecarManualReceiverSmokeV086Doc.includes("No raw private output"), "v0.8.6 dogfooding doc must state raw-output boundary");
  assert(sidecarManualReceiverSmokeV086Doc.includes("No runtime integration"), "v0.8.6 dogfooding doc must state runtime boundary");
  assert(sidecarManualReceiverSmokeV086Doc.includes("No schema change"), "v0.8.6 dogfooding doc must state schema boundary");
  assert(sidecarManualReceiverSmokeV086Doc.includes("basebrief-project-state-v1"), "v0.8.6 dogfooding doc must preserve project-state schema");
  assert(sidecarManualReceiverSmokeV086Doc.includes("basebrief-sidecar-v1"), "v0.8.6 dogfooding doc must preserve sidecar schema");
  assert(sidecarManualReceiverSmokeV086Doc.includes("provider_probe_status=skipped"), "v0.8.6 dogfooding doc must preserve skipped provider gate");
  assert(!sidecarManualReceiverSmokeV086Doc.includes("opencode | openclaw | passed"), "v0.8.6 dogfooding doc must not claim OpenCode openclaw pass");
  assert(!sidecarManualReceiverSmokeV086Doc.includes("claude-code | openclaw | passed"), "v0.8.6 dogfooding doc must not claim Claude Code openclaw pass");
  assert(sidecarOpenClawHermesManualSmokeFollowupDoc.includes("Sidecar OpenClaw/Hermes Manual Smoke Follow-up"), "OpenClaw/Hermes follow-up doc must have stable title");
  assert(sidecarOpenClawHermesManualSmokeFollowupDoc.includes("user-supplied private summary file"), "OpenClaw/Hermes follow-up doc must describe the private summary source");
  assert(sidecarOpenClawHermesManualSmokeFollowupDoc.includes("six named files read by absolute path"), "OpenClaw/Hermes follow-up doc must require six-file absolute-path reads");
  assert(sidecarOpenClawHermesManualSmokeFollowupDoc.includes("`hermes-agent` | passed"), "OpenClaw/Hermes follow-up doc must record Hermes passed status");
  assert(sidecarOpenClawHermesManualSmokeFollowupDoc.includes("`openclaw-agent` | passed"), "OpenClaw/Hermes follow-up doc must record OpenClaw passed status");
  assert(sidecarOpenClawHermesManualSmokeFollowupDoc.includes("strict six-file absolute-path recheck"), "OpenClaw/Hermes follow-up doc must record the strict recheck");
  assert(sidecarOpenClawHermesManualSmokeFollowupDoc.includes("reported `pass`"), "OpenClaw/Hermes follow-up doc must preserve pass reporting");
  assert(sidecarOpenClawHermesManualSmokeFollowupDoc.includes("waited for user confirmation"), "OpenClaw/Hermes follow-up doc must preserve the confirmation gate");
  assert(sidecarOpenClawHermesManualSmokeFollowupDoc.includes("does not define or"), "OpenClaw/Hermes follow-up doc must reject v0.9.0 expansion");
  assert(sidecarOpenClawHermesManualSmokeFollowupDoc.includes("start `v0.9.0`"), "OpenClaw/Hermes follow-up doc must reject v0.9.0 start");
  assert(sidecarOpenClawHermesManualSmokeFollowupDoc.includes("No provider request"), "OpenClaw/Hermes follow-up doc must state no provider request");
  assert(sidecarOpenClawHermesManualSmokeFollowupDoc.includes("No runtime integration"), "OpenClaw/Hermes follow-up doc must state no runtime integration");
  assert(sidecarOpenClawHermesManualSmokeFollowupDoc.includes("Do not write OpenClaw/Hermes profile/config/memory/workspace files"), "OpenClaw/Hermes follow-up doc must state no-write boundary");
  assert(sidecarOpenClawHermesManualSmokeFollowupDoc.includes("latest freshly rebuilt `openclaw` bundle"), "OpenClaw/Hermes follow-up doc must preserve the rebuilt-bundle limitation");
  assert(sidecarOpenClawHermesManualSmokeFollowupDoc.includes("provider_probe_status=skipped"), "OpenClaw/Hermes follow-up doc must preserve skipped provider gate");
  assert(deltaHandoffFreshReceiverDoc.includes("Delta Handoff Fresh Receiver Dogfooding v1.0"), "Delta dogfooding doc must have stable title");
  assert(deltaHandoffFreshReceiverDoc.includes("receiver_task_status: completed"), "Delta dogfooding doc must record completed receiver status");
  assert(deltaHandoffFreshReceiverDoc.includes("repository_state_status: match"), "Delta dogfooding doc must record repository match");
  assert(deltaHandoffFreshReceiverDoc.includes("handoff_acceptance: pass"), "Delta dogfooding doc must record pass acceptance");
  assert(deltaHandoffFreshReceiverDoc.includes("blocking_or_repair_notes: none"), "Delta dogfooding doc must record no repair notes");
  assert(deltaHandoffFreshReceiverDoc.includes("No provider request"), "Delta dogfooding doc must preserve provider boundary");
  assert(deltaHandoffFreshReceiverDoc.includes("No runtime integration"), "Delta dogfooding doc must preserve runtime boundary");
  assert(deltaHandoffFreshReceiverDoc.includes("No schema-v2 work"), "Delta dogfooding doc must reject schema-v2 work");
  assert(deltaHandoffFreshReceiverDoc.includes("No raw private output"), "Delta dogfooding doc must reject raw private output");
  assert(deltaHandoffFreshReceiverDoc.includes("provider_probe_status=skipped"), "Delta dogfooding doc must preserve skipped provider gate");
  assert(deltaHandoffBaselineAdvanceDoc.includes("Delta Handoff Baseline-Advance Dogfooding v1.0"), "Delta baseline-advance doc must have stable title");
  assert(deltaHandoffBaselineAdvanceDoc.includes("delta --advance-baseline"), "Delta baseline-advance doc must document advance-baseline command");
  assert(deltaHandoffBaselineAdvanceDoc.includes("First run wrote local baseline"), "Delta baseline-advance doc must record first-run baseline write");
  assert(deltaHandoffBaselineAdvanceDoc.includes("Second run no longer reported `baseline_source: missing`"), "Delta baseline-advance doc must record baseline-present transition");
  assert(deltaHandoffBaselineAdvanceDoc.includes(".basebrief/delta-baseline.json"), "Delta baseline-advance doc must document local baseline path");
  assert(deltaHandoffBaselineAdvanceDoc.includes(".gitignore"), "Delta baseline-advance doc must document local-only ignored boundary");
  assert(deltaHandoffBaselineAdvanceDoc.includes("basebrief-project-state-v1"), "Delta baseline-advance doc must preserve project-state schema");
  assert(deltaHandoffBaselineAdvanceDoc.includes("handoff_acceptance: pass"), "Delta baseline-advance doc must record receiver pass");
  assert(deltaHandoffBaselineAdvanceDoc.includes("provider_probe_status=skipped"), "Delta baseline-advance doc must preserve skipped provider gate");
  assert(deltaReceiverAcceptanceDoc.includes("Delta Receiver Acceptance Dogfooding v1.1"), "Delta receiver acceptance doc must have stable title");
  assert(deltaReceiverAcceptanceDoc.includes("receiver_task_status"), "Delta receiver acceptance doc must require receiver task status");
  assert(deltaReceiverAcceptanceDoc.includes("repository_state_status"), "Delta receiver acceptance doc must require repository state status");
  assert(deltaReceiverAcceptanceDoc.includes("handoff_acceptance"), "Delta receiver acceptance doc must require handoff acceptance");
  assert(deltaReceiverAcceptanceDoc.includes("blocking_or_repair_notes"), "Delta receiver acceptance doc must require repair notes");
  assert(deltaReceiverAcceptanceDoc.includes("live repository state"), "Delta receiver acceptance doc must require live repository state");
  assert(deltaReceiverAcceptanceDoc.includes("inherited handoff facts"), "Delta receiver acceptance doc must separate inherited facts");
  assert(deltaReceiverAcceptanceDoc.includes("difference_found"), "Delta receiver acceptance doc must define difference handling");
  assert(deltaReceiverAcceptanceDoc.includes("Local Dry-Run Result"), "Delta receiver acceptance doc must record dry-run result");
  assert(deltaReceiverAcceptanceDoc.includes("handoff_acceptance: difference_found"), "Delta receiver acceptance doc must record stale-handoff difference");
  assert(deltaReceiverAcceptanceDoc.includes("handoff_acceptance: pass"), "Delta receiver acceptance doc must record refreshed-handoff pass");
  assert(deltaReceiverAcceptanceDoc.includes("commits_in_range: 3"), "Delta receiver acceptance doc must record refreshed commit count");
  assert(deltaReceiverAcceptanceDoc.includes("worktreeChangedFiles: []"), "Delta receiver acceptance doc must record clean refreshed worktree");
  assert(deltaReceiverAcceptanceDoc.includes("no baseline advance"), "Delta receiver acceptance doc must keep baseline unadvanced");
  assert(deltaReceiverAcceptanceDoc.includes("No provider request"), "Delta receiver acceptance doc must reject provider scope");
  assert(deltaReceiverAcceptanceDoc.includes("No runtime integration"), "Delta receiver acceptance doc must reject runtime scope");
  assert(deltaReceiverAcceptanceDoc.includes("No plugin, MCP, IDE"), "Delta receiver acceptance doc must reject plugin/MCP/IDE scope");
  assert(deltaReceiverAcceptanceDoc.includes("No schema-v2 work"), "Delta receiver acceptance doc must reject schema-v2 scope");
  assert(deltaReceiverAcceptanceDoc.includes("provider_probe_status=skipped"), "Delta receiver acceptance doc must preserve skipped provider gate");
  assert(v08xTestMatrixDoc.includes("v0.8.x Sidecar Test Matrix"), "v0.8.x matrix must have stable title");
  assert(v08xTestMatrixDoc.includes("sidecar-build"), "v0.8.x matrix must document sidecar-build");
  assert(v08xTestMatrixDoc.includes("sidecar-check"), "v0.8.x matrix must document sidecar-check");
  assert(v08xTestMatrixDoc.includes("generic"), "v0.8.x matrix must document generic target");
  assert(v08xTestMatrixDoc.includes("openclaw"), "v0.8.x matrix must document openclaw target");
  assert(v08xTestMatrixDoc.includes("basebrief-project-state-v1"), "v0.8.x matrix must preserve project-state schema");
  assert(v08xTestMatrixDoc.includes("No provider request"), "v0.8.x matrix must state no provider request");
  assert(v08xTestMatrixDoc.includes("No raw private output"), "v0.8.x matrix must state no raw private output");
  assert(v08xTestMatrixDoc.includes("No runtime integration"), "v0.8.x matrix must state no runtime integration");
  assert(v08xTestMatrixDoc.includes("No schema change"), "v0.8.x matrix must state no schema change");
  assert(v08xTestMatrixDoc.includes("v0.8.3 Discoverability Polish"), "v0.8.x matrix must document v0.8.3 discoverability polish");
  assert(v08xTestMatrixDoc.includes("v0.8.4 External Receiver Smoke Evidence"), "v0.8.x matrix must document v0.8.4 external receiver smoke evidence");
  assert(v08xTestMatrixDoc.includes("v0.8.5 Manual Receiver Smoke Result Intake"), "v0.8.x matrix must document v0.8.5 manual receiver smoke intake");
  assert(v08xTestMatrixDoc.includes("v0.8.6 Manual Receiver Smoke Result Intake Evidence"), "v0.8.x matrix must document v0.8.6 manual receiver smoke evidence");
  assert(v08xTestMatrixDoc.includes("OpenClaw/Hermes Manual Receiver Smoke Follow-up"), "v0.8.x matrix must document OpenClaw/Hermes manual smoke follow-up");
  assert(v08xTestMatrixDoc.includes("v0.8.7 Copyable New-Window Starter"), "v0.8.x matrix must document v0.8.7 copyable starter");
  assert(v08xTestMatrixDoc.includes("v0.8.8 Starter Language Routing"), "v0.8.x matrix must document v0.8.8 starter language routing");
  assert(v08xTestMatrixDoc.includes("--starter-language auto|zh-CN|en|ja"), "v0.8.x matrix must document starter language option");
  assert(v08xTestMatrixDoc.includes("falls back to `zh-CN`"), "v0.8.x matrix must document zh-CN starter fallback");
  assert(v08xTestMatrixDoc.includes("new-window-starter.md"), "v0.8.x matrix must document new-window-starter.md");
  assert(v08xTestMatrixDoc.includes("pass/fail"), "v0.8.x matrix must document receiver pass/fail reporting");
  assert(v08xTestMatrixDoc.includes("output_files.newWindowStarter"), "v0.8.x matrix must document starter manifest output key");
  assert(v08xTestMatrixDoc.includes("Old v0.8 bundles"), "v0.8.x matrix must document old bundle compatibility");
  assert(v08xTestMatrixDoc.includes("Claude Code generic as `passed`"), "v0.8.x matrix must document Claude Code passed result");
  assert(v08xTestMatrixDoc.includes("OpenCode generic as `passed`"), "v0.8.x matrix must document OpenCode passed result");
  assert(v08xTestMatrixDoc.includes("manual_required"), "v0.8.x matrix must preserve manual-required external status");
  assert(v08xTestMatrixDoc.includes("not_run"), "v0.8.x matrix must preserve not-run external status");
  assert(v08xTestMatrixDoc.includes("basebrief-sidecar-v1"), "v0.8.x matrix must preserve sidecar schema");
  assert(v08xTestMatrixDoc.includes("provider_probe_status=skipped"), "v0.8.x matrix must preserve skipped provider gate");
  assert(projectStateSchema.properties.schemaVersion.const === "basebrief-project-state-v1", "Project State schema version mismatch");
  assert(projectStateExample.schemaVersion === "basebrief-project-state-v1", "Project State example schema version mismatch");
  assert(projectStateExample.source.handoff_status === "ready_for_receiver", "Project State example must use ready source status");
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
    /\bsk-[A-Za-z0-9]{10,}/,
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
      relative === "scripts/basebrief_check_artifacts.js" ||
      relative === "scripts/basebrief_project_state.js"
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
    "examples/receiver-flow-review/valid-ready/README.md",
    "examples/receiver-flow-review/valid-ready/draft-context.md",
    "examples/receiver-flow-review/valid-ready/receiver-ready.md",
    "examples/receiver-flow-review/rejected-candidate/README.md",
    "examples/receiver-flow-review/rejected-candidate/draft-context.md",
    "examples/receiver-flow-review/rejected-empty/README.md",
    "examples/receiver-flow-review/rejected-empty/draft-context.md",
    "examples/project-state/README.md",
    "examples/project-state/state.json",
    "examples/golden-path/README.md",
    "examples/golden-path/receiver-ready.md",
    "examples/golden-path/state-reference.md",
    "examples/golden-path/first-pass-receiver-report.md",
    "examples/golden-path/follow-up-receiver-report.md",
    "examples/golden-path/sidecar-output-boundary.md",
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
    "docs/dogfooding/receiver-flow-review-draft-dogfooding.md",
    "docs/dogfooding/receiver-flow-extract-dogfooding.md",
    "docs/dogfooding/project-state-dogfooding.md",
    "docs/dogfooding/project-state-self-dogfooding-v0.6.x.md",
    "docs/dogfooding/project-state-self-dogfooding-v0.6.2.md",
    "docs/dogfooding/project-state-lifecycle-readiness-v0.6.3.md",
    "docs/dogfooding/project-state-lifecycle-v0.7.0.md",
    "docs/baselines/v0.4.0-post-release-baseline.md",
    "docs/baselines/v0.6.0-post-release-baseline.md",
    "docs/design/project-state-model.md",
    "docs/design/project-state-validation-rules.md",
    "docs/design/project-state-lifecycle-readiness.md",
    "docs/design/project-state-lifecycle-model.md",
    "docs/testing-v0.4.x-test-matrix.md",
    "docs/testing-v0.6.x-test-matrix.md",
    "docs/testing-v0.7.x-test-matrix.md",
    "docs/receiver-check.md",
    "docs/receiver-flow.md",
    "docs/project-state.md",
    "docs/releases/v0.3.0.md",
    "docs/releases/v0.3.1.md",
    "docs/releases/v0.3.2.md",
    "docs/releases/v0.3.3.md",
    "docs/releases/v0.4.0.md",
    "docs/releases/v0.4.1.md",
    "docs/releases/v0.5.0.md",
    "docs/releases/v0.5.1.md",
    "docs/releases/v0.5.2.md",
    "docs/releases/v0.5.3.md",
    "docs/releases/v0.6.0.md",
    "docs/releases/v0.6.2.md",
    "docs/releases/v0.6.3.md",
    "docs/releases/v0.7.0.md",
    "docs/releases/v0.8.0.md",
    "docs/releases/v0.8.1.md",
    "docs/releases/v0.8.2.md",
    "docs/releases/v0.8.3.md",
    "docs/releases/v0.8.4.md",
    "docs/releases/v0.8.5.md",
    "docs/releases/v0.8.6.md",
    "docs/releases/v0.8.7.md",
    "docs/releases/v0.9.1.md",
    "docs/releases/v0.9.2.md",
    "docs/releases/v0.9.3.md",
    "docs/releases/v0.9.0.md",
    "docs/releases/v1.0.0.md",
    "docs/releases/v1.0.0-plan.md",
    "docs/releases/v1.0.0-rc-review.md",
    "docs/releases/v1.0.1.md",
    "docs/releases/v1.1.0.md",
    "docs/releases/v1.1.0-plan.md",
    "docs/testing-v0.9.x-test-matrix.md",
    "docs/dogfooding/sidecar-external-receiver-smoke-v0.8.4.md",
    "docs/dogfooding/sidecar-manual-receiver-smoke-v0.8.5.md",
    "docs/dogfooding/sidecar-manual-receiver-smoke-v0.8.6.md",
    "docs/dogfooding/sidecar-openclaw-hermes-manual-smoke-followup.md",
    "docs/dogfooding/delta-handoff-fresh-receiver-v1.0.md",
    "docs/dogfooding/delta-handoff-baseline-advance-v1.0.md",
    "docs/dogfooding/delta-receiver-acceptance-v1.1.md",
    "examples/receiver-check-config.json",
    "examples/receiver/difference-found",
    "examples/receiver/blocked",
    "examples/receiver/language-routing",
    "examples/receiver-flow/clean-repo",
    "examples/receiver-flow/dirty-repo",
    "examples/receiver-flow/visible-output",
    "examples/receiver-flow-review/valid-ready",
    "examples/receiver-flow-review/rejected-candidate",
    "examples/receiver-flow-review/rejected-empty",
    "examples/project-state",
    "examples/golden-path",
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
    assert(helpStdout.includes("receiver-flow --repo <target-repo> --output-dir <dir> --extract --source <draft-or-context.md>"), "CLI help must expose Receiver Flow Extract");
    assert(helpStdout.includes("review-draft --draft <draft-context.md> --output <receiver-ready.md>"), "CLI help must expose Review Draft Gate");
    assert(helpStdout.includes("state-init --repo <target-repo> --source <receiver-ready.md>"), "CLI help must expose Project State init");
    assert(helpStdout.includes("state-read --repo <target-repo>"), "CLI help must expose Project State read");
    assert(helpStdout.includes("state-status --repo <target-repo>"), "CLI help must expose Project State status");
    assert(helpStdout.includes("state-validate --repo <target-repo>"), "CLI help must expose Project State validate");
    assert(helpStdout.includes("state-history --repo <target-repo>"), "CLI help must expose Project State history");
    assert(helpStdout.includes("state-advance --repo <target-repo> --source <receiver-ready.md>"), "CLI help must expose Project State advance");
    assert(helpStdout.includes("sidecar-build --repo <target-repo>"), "CLI help must expose Sidecar build");
    assert(helpStdout.includes("--starter-language auto|zh-CN|en|ja"), "CLI help must expose starter language option");
    assert(helpStdout.includes("sidecar-check --input <sidecar-dir>"), "CLI help must expose Sidecar check");

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

    const extractSourcePath = path.join(tempRoot, "extract-source.md");
    fs.writeFileSync(extractSourcePath, [
      "# Extract Source",
      "",
      "## current_goal",
      "",
      "Create extract candidates in the release check.",
      "",
      "## verified_facts",
      "",
      "This source file is a local release-check fixture.",
      "",
      "## confirmed_decisions",
      "",
      "Extract output stays draft-only.",
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
    ].join(os.EOL), "utf8");
    const receiverFlowExtractDir = path.join(tempRoot, "receiver-flow-extract");
    const receiverFlowExtractStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "receiver-flow",
      "--repo",
      receiverRepo,
      "--output-dir",
      receiverFlowExtractDir,
      "--extract",
      "--source",
      extractSourcePath,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const receiverFlowExtractResult = JSON.parse(receiverFlowExtractStdout);
    assert(receiverFlowExtractResult.command === "receiver-flow", "CLI receiver-flow extract must return command metadata");
    assert(receiverFlowExtractResult.extract === true, "CLI receiver-flow extract must report extract mode");
    assert(receiverFlowExtractResult.handoff_status === "draft_needs_review", "CLI receiver-flow extract must keep draft status");
    assert(receiverFlowExtractResult.outputFiles.extractCandidates.endsWith("extract-candidates.json"), "CLI receiver-flow extract must report extract candidates path");
    assert(fs.existsSync(path.join(receiverFlowExtractDir, "extract-candidates.json")), "CLI receiver-flow extract must write extract candidates");

    const guidedFlowDir = path.join(tempRoot, "guided-flow");
    const guidedInput = [
      "Prepare a reviewed receiver handoff.",
      "The release check generated a local fixture draft.",
      "Only an explicit review gate can produce receiver-ready output.",
      "Do not read env files or write provider credentials.",
      "Inspect the receiver-ready handoff first.",
      "No open questions remain for this fixture.",
    ].join(os.EOL);
    execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "receiver-flow",
      "--repo",
      receiverRepo,
      "--output-dir",
      guidedFlowDir,
      "--guided",
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      input: guidedInput,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    const guidedDraftPath = path.join(guidedFlowDir, "draft-context.md");
    fs.writeFileSync(guidedDraftPath, fs.readFileSync(guidedDraftPath, "utf8").replace(/- \[ \]/g, "- [x]"), "utf8");
    const receiverReadyPath = path.join(tempRoot, "receiver-ready.md");
    const reviewDraftStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "review-draft",
      "--draft",
      guidedDraftPath,
      "--output",
      receiverReadyPath,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const reviewDraftResult = JSON.parse(reviewDraftStdout);
    assert(reviewDraftResult.command === "review-draft", "CLI review-draft must return command metadata");
    assert(reviewDraftResult.handoff_status === "ready_for_receiver", "CLI review-draft must return ready status");
    assert(reviewDraftResult.output.startsWith("tests"), "CLI review-draft must return a public-safe relative output path");
    assert(fs.existsSync(receiverReadyPath), "CLI review-draft must write receiver-ready output");

    const stateInitStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "state-init",
      "--repo",
      receiverRepo,
      "--source",
      receiverReadyPath,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const stateInitResult = JSON.parse(stateInitStdout);
    assert(stateInitResult.command === "state-init", "CLI state-init must return command metadata");
    assert(stateInitResult.schemaVersion === "basebrief-project-state-v1", "CLI state-init must return project-state schema");
    assert(stateInitResult.output.replace(/\\/g, "/").endsWith(".basebrief/state.json"), "CLI state-init must report state output");
    assert(fs.existsSync(path.join(receiverRepo, ".basebrief", "state.json")), "CLI state-init must write local project state");

    const stateReadStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "state-read",
      "--repo",
      receiverRepo,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const stateReadResult = JSON.parse(stateReadStdout);
    assert(stateReadResult.command === "state-read", "CLI state-read must return command metadata");
    assert(stateReadResult.schemaVersion === "basebrief-project-state-v1", "CLI state-read must return project-state schema");
    assert(stateReadResult.input.replace(/\\/g, "/").endsWith(".basebrief/state.json"), "CLI state-read must report state input");
    assert(stateReadResult.state.source.handoff_status === "ready_for_receiver", "CLI state-read must return ready source status");

    const stateStatusStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "state-status",
      "--repo",
      receiverRepo,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const stateStatusResult = JSON.parse(stateStatusStdout);
    assert(stateStatusResult.command === "state-status", "CLI state-status must return command metadata");
    assert(stateStatusResult.exists === true, "CLI state-status must report existing state");
    assert(stateStatusResult.validation_status === "passed", "CLI state-status must report valid state");
    assert(stateStatusResult.input.replace(/\\/g, "/").endsWith(".basebrief/state.json"), "CLI state-status must report state input");

    const stateValidateStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "state-validate",
      "--repo",
      receiverRepo,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const stateValidateResult = JSON.parse(stateValidateStdout);
    assert(stateValidateResult.command === "state-validate", "CLI state-validate must return command metadata");
    assert(stateValidateResult.validation_status === "passed", "CLI state-validate must pass after state-init");
    assert(Array.isArray(stateValidateResult.errors) && stateValidateResult.errors.length === 0, "CLI state-validate must return zero errors for valid state");

    const stateHistoryBeforeStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "state-history",
      "--repo",
      receiverRepo,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const stateHistoryBeforeResult = JSON.parse(stateHistoryBeforeStdout);
    assert(stateHistoryBeforeResult.command === "state-history", "CLI state-history must return command metadata");
    assert(stateHistoryBeforeResult.history_status === "not_initialized", "CLI state-history must be empty before state-advance");

    const stateAdvanceStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "state-advance",
      "--repo",
      receiverRepo,
      "--source",
      receiverReadyPath,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const stateAdvanceResult = JSON.parse(stateAdvanceStdout);
    assert(stateAdvanceResult.command === "state-advance", "CLI state-advance must return command metadata");
    assert(stateAdvanceResult.schemaVersion === "basebrief-project-state-v1", "CLI state-advance must preserve project-state schema");
    assert(stateAdvanceResult.history_output.replace(/\\/g, "/").includes(".basebrief/history/"), "CLI state-advance must write history output");
    assert(fs.existsSync(path.join(receiverRepo, ".basebrief", "history")), "CLI state-advance must create local history directory");

    const stateHistoryAfterStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "state-history",
      "--repo",
      receiverRepo,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const stateHistoryAfterResult = JSON.parse(stateHistoryAfterStdout);
    assert(stateHistoryAfterResult.history_status === "available", "CLI state-history must report available history after state-advance");
    assert(stateHistoryAfterResult.entries.length === 1, "CLI state-history must report one archived entry");
    assert(stateHistoryAfterResult.entries[0].validation_status === "passed", "CLI state-history archived entry must validate");

    const deltaDir = path.join(tempRoot, "delta");
    const deltaStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "delta",
      "--repo",
      receiverRepo,
      "--output-dir",
      deltaDir,
      "--advance-baseline",
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const deltaResult = JSON.parse(deltaStdout);
    assert(deltaResult.command === "delta", "CLI delta must return command metadata");
    assert(deltaResult.schemaVersion === "basebrief-delta-handoff-v1", "CLI delta must return delta handoff schema");
    assert(deltaResult.baselineSchemaVersion === "basebrief-delta-baseline-v1", "CLI delta must return baseline schema");
    assert(deltaResult.outputFiles.deltaHandoff.startsWith("tests"), "CLI delta must return public-safe output path");
    assert(deltaResult.projectState.schemaVersion === "basebrief-project-state-v1", "CLI delta must preserve project-state schema");
    assert(deltaResult.baseline.advanced === true, "CLI delta must advance baseline only when requested");
    assert(fs.existsSync(path.join(deltaDir, "delta-handoff.md")), "CLI delta must write delta-handoff.md");
    assert(fs.existsSync(path.join(receiverRepo, ".basebrief", "delta-baseline.json")), "CLI delta must write local baseline when requested");

    const sidecarDir = path.join(tempRoot, "sidecar-generic");
    const sidecarBuildStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "sidecar-build",
      "--repo",
      receiverRepo,
      "--starter-language",
      "zh-CN",
      "--output-dir",
      sidecarDir,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const sidecarBuildResult = JSON.parse(sidecarBuildStdout);
    assert(sidecarBuildResult.command === "sidecar-build", "CLI sidecar-build must return command metadata");
    assert(sidecarBuildResult.starterLanguage === "zh-CN", "CLI sidecar-build must return requested starter language");
    assert(sidecarBuildResult.outputDir.startsWith("tests"), "CLI sidecar-build must return a public-safe output path");
    assert(sidecarBuildResult.outputFiles.newWindowStarter.startsWith("tests"), "CLI sidecar-build must return a public-safe starter path");
    assert(sidecarBuildResult.manifest.output_files.newWindowStarter === "new-window-starter.md", "CLI sidecar-build manifest must expose new-window-starter.md");

    const sidecarCheckStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "sidecar-check",
      "--input",
      sidecarDir,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const sidecarCheckResult = JSON.parse(sidecarCheckStdout);
    assert(sidecarCheckResult.command === "sidecar-check", "CLI sidecar-check must return command metadata");
    assert(sidecarCheckResult.check_status === "passed", "CLI sidecar-check must pass valid generated sidecar");
    assert(sidecarCheckResult.input.startsWith("tests"), "CLI sidecar-check must return a public-safe input path");

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
  return 20;
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
    assert(!JSON.stringify(summary).match(/[A-Z]:\\|\/home\/|\bsk-[A-Za-z0-9]{10,}/), "Benchmark summary contains private path or key-like content");
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
