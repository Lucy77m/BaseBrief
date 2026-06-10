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
const { checkArtifacts } = require("./basebrief_check_artifacts");

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

function normalizePhrase(value) {
  return value.replace(/\s+/g, " ").trim();
}

function includesPhrase(haystack, needle) {
  return normalizePhrase(haystack).includes(normalizePhrase(needle));
}

function assertIncludesPhrase(haystack, needle, message) {
  assert(includesPhrase(haystack, needle), message);
}

function assertDogfoodingDocCommonBoundaries(doc, label, options = {}) {
  const boundaries = [
    ["No new CLI command", "reject new commands"],
    ["No release-check output shape change", "preserve release-check output shape"],
    ["No Context Pack seven-file structure change", "preserve seven-file structure"],
    ["No `check --input <dir> --json` top-level shape change", "preserve checker JSON shape"],
    ["No Resume JSON contract change", "preserve resume JSON contract"],
    ["No Doctor JSON contract change", "preserve doctor JSON contract"],
    ["No Export JSON contract change", "preserve export JSON contract"],
    ["No Status command", "reject status command"],
    ["No Workflow Runner", "reject workflow runner"],
    ["No provider request", "reject provider requests"],
    ["No runtime integration", "reject runtime integration"],
    ["No MCP server", "reject MCP server"],
    ["No MCP tools", "reject MCP tools"],
    ["No plugin", "reject plugin scope"],
    ["No schema-v2", "reject schema-v2"],
    ["No daemon", "reject daemon scope"],
    ["No watcher", "reject watcher scope"],
    ["No hosted memory", "reject hosted memory"],
  ];

  if (options.doctorExpansion) {
    boundaries.splice(9, 0, ["No Doctor expansion", "reject doctor expansion"]);
  }

  boundaries.forEach(([phrase, intent]) => {
    assert(doc.includes(phrase), `${label} must ${intent}`);
  });
}

function assertDogfoodingDocValidationGate(doc, label) {
  assert(doc.includes("npm run release-check") && doc.includes("npm test") && doc.includes("git diff --check"), `${label} must preserve validation gate`);
}

function assertDogfoodingDocReleaseCheckMetrics(doc, label) {
  assert(doc.includes("mode_cases") && doc.includes("checked_links") && doc.includes("cli_lite_commands") && doc.includes("independent_test_files"), `${label} must preserve release-check metric lines`);
}

function assertDogfoodingDocNoPrivatePaths(doc, label) {
  assert(!/(^|[^A-Za-z])[A-Za-z]:[\\/]/.test(doc), `${label} must not expose drive-letter absolute paths`);
  assert(!/\\\\/.test(doc), `${label} must not expose UNC paths`);
}

function assertDogfoodingDocSharedReleaseChecks(doc, label) {
  assertDogfoodingDocValidationGate(doc, label);
  assertDogfoodingDocReleaseCheckMetrics(doc, label);
  assertDogfoodingDocNoPrivatePaths(doc, label);
}

function assertContinuationHarnessLiteBoundaries(doc, label) {
  [
    ["No provider request", "reject provider requests"],
    ["No raw private output", "reject raw private output"],
    ["No runtime integration", "reject runtime integration"],
    ["No plugin", "reject plugin scope"],
    ["No MCP server", "reject MCP server"],
    ["No MCP tools", "reject MCP tools"],
    ["No schema-v2", "reject schema-v2"],
    ["No Workflow Runner", "reject workflow runner"],
    ["No Doctor expansion", "reject doctor expansion"],
    ["No Export expansion", "reject export expansion"],
    ["No automatic", "reject automatic side effects"],
    ["No Context Pack seven-file structure change", "preserve seven-file structure"],
  ].forEach(([phrase, intent]) => {
    assert(doc.includes(phrase), `${label} must ${intent}`);
  });
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
    "docs/why-basebrief.md",
    "docs/concepts-simple.md",
    "docs/advanced.md",
    "docs/quickstart-5min.md",
    "docs/known-limitations.md",
    "docs/receiver-usage-pack.md",
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
    "docs/dogfooding/delta-receiver-report-kit-v1.2.md",
    "docs/dogfooding/delta-receiver-lint-dogfooding-v1.8.md",
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
    "docs/specs/delta-handoff.md",
    "docs/releases/v2.0.0-plan.md",
    "docs/releases/v2.0.0.md",
    "docs/specs/context-pack-lite.md",
    "docs/releases/v2.1.0.md",
    "docs/releases/v2.1.0-plan.md",
    "docs/specs/context-pack-check.md",
    "docs/releases/v2.2.0-plan.md",
    "docs/releases/v2.2.0.md",
    "docs/releases/v2.3.0-plan.md",
    "docs/releases/v2.4.0-plan.md",
    "docs/releases/v2.4.0.md",
    "docs/releases/v2.5.0-plan.md",
    "docs/releases/v2.5.0.md",
    "docs/releases/v2.6.0.md",
    "docs/releases/v2.7.0-plan.md",
    "docs/releases/v2.7.0.md",
    "docs/releases/v2.8.0-plan.md",
    "docs/releases/v2.8.0.md",
    "docs/releases/v2.9.0-plan.md",
    "docs/releases/v2.9.0.md",
    "docs/releases/v2.9.1.md",
    "docs/releases/v2.10.0.md",
    "docs/releases/v3.0.0-plan.md",
    "docs/specs/context-pack-resume.md",
    "docs/specs/basebrief-format.md",
    "docs/specs/file-only-export.md",
    "docs/specs/context-pack-doctor.md",
    "docs/roadmap/basebrief-v2-context-pack-lite.md",
    "docs/dogfooding/context-pack-lite-fresh-receiver-v2.0.0.md",
    "docs/dogfooding/context-pack-check-acceptance-v2.1.0.md",
    "docs/dogfooding/context-pack-resume-v2.2.0.md",
    "docs/dogfooding/file-only-export-v2.4.0.md",
    "docs/dogfooding/context-pack-doctor-v2.5.0.md",
    "docs/dogfooding/context-pack-human-next-step-hints-dogfooding-v2.7.1.md",
    "docs/dogfooding/continuation-harness-lite-v2.8.0.md",
    "docs/dogfooding/context-pack-adoption-notes-v2.6.1.md",
    "docs/dogfooding/context-engineering-reference-notes-v2.6.4.md",
    "docs/dogfooding/context-pack-adoption-scenario-matrix-v2.6.5.md",
    "docs/dogfooding/context-pack-first-run-fixture-lab-v2.6.6.md",
    "docs/dogfooding/context-pack-first-run-rehearsal-audit-v2.6.7.md",
    "docs/dogfooding/context-pack-first-run-friction-repair-v2.6.8.md",
    "docs/dogfooding/context-pack-adoption-decision-checkpoint-v2.6.9.md",
    "docs/dogfooding/context-pack-pre-release-bundle-audit-v2.6.10.md",
    "docs/dogfooding/context-pack-feature-feasibility-spike-v2.6.11.md",
    "docs/dogfooding/context-pack-local-bundle-review-rehearsal-v2.6.12.md",
    "docs/dogfooding/context-pack-local-bundle-compression-v2.6.13.md",
    "docs/dogfooding/context-pack-release-check-maintainability-v2.6.14.md",
    "docs/dogfooding/context-pack-major-release-candidate-shape-v2.6.15.md",
    "docs/dogfooding/context-pack-continuation-harness-decision-spec-v2.6.16.md",
    "docs/dogfooding/context-pack-ahead14-bundle-review-v2.6.17.md",
    "docs/dogfooding/context-pack-minimal-feature-candidate-decision-v2.6.18.md",
    "docs/dogfooding/context-pack-first-run-handoff-validation.md",
    "docs/dogfooding/context-pack-continuation-harness-lite-design-sketch.md",
    "docs/dogfooding/context-pack-continuation-harness-lite-paper-rehearsal.md",
    "docs/dogfooding/context-pack-local-bundle-compression-v2.6.20.md",
    "docs/dogfooding/context-pack-implementation-gate-decision-v2.6.21.md",
    "docs/dogfooding/context-pack-release-check-maintainability-plan-v2.6.22.md",
    "docs/dogfooding/context-pack-runnable-recipes-plan-v2.6.23.md",
    "docs/dogfooding/context-pack-first-run-smoke-path-consolidation-v2.6.24.md",
    "docs/dogfooding/context-pack-output-ux-polish-v2.6.25.md",
    "docs/dogfooding/context-pack-test-file-split-plan-v2.6.26.md",
    "docs/dogfooding/context-pack-test-file-split-v2.6.27.md",
    "docs/dogfooding/context-pack-test-file-split-second-candidate-v2.6.28.md",
    "docs/dogfooding/context-pack-cache-ready-benchmark-test-split-v2.6.29.md",
    "docs/dogfooding/context-pack-test-split-stability-check-v2.6.30.md",
    "docs/dogfooding/context-pack-v2.6x-local-closeout-gate-v2.6.31.md",
    "docs/dogfooding/context-pack-release-candidate-decision-v2.6.32.md",
    "docs/dogfooding/context-pack-release-candidate-summary-draft-v2.6.33.md",
    "docs/dogfooding/context-pack-release-closeout-go-no-go-plan-v2.6.34.md",
    "docs/dogfooding/context-pack-release-closeout-prep-draft-v2.6.35.md",
    "docs/dogfooding/context-pack-formal-local-release-closeout-draft-v2.6.36.md",
    "docs/dogfooding/context-pack-release-closeout-review-packet-v2.6.37.md",
    "docs/testing-v0.4.x-test-matrix.md",
    "docs/testing-v0.6.x-test-matrix.md",
    "docs/testing-v0.7.x-test-matrix.md",
    "docs/testing-v0.8.x-test-matrix.md",
    "docs/testing-v0.9.x-test-matrix.md",
    "docs/testing-v1.x-delta-receiver-closure-matrix.md",
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
    "scripts/basebrief_context_pack.js",
    "scripts/basebrief_export.js",
    "scripts/basebrief_doctor.js",
    "scripts/basebrief_resume.js",
    "scripts/basebrief_continuation_harness.js",
    "scripts/basebrief_project_profile.js",
    "scripts/basebrief_workflow.js",
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
    "examples/context-pack-lite/README.md",
    "examples/context-pack-lite/MANIFEST.md",
    "examples/context-pack-lite/REPO_MAP.md",
    "examples/context-pack-lite/KEY_FILES.md",
    "examples/context-pack-lite/RECENT_DELTA.md",
    "examples/context-pack-lite/RISK_BOUNDARIES.md",
    "examples/context-pack-lite/RECEIVER_STATE.md",
    "examples/context-pack-lite/NEXT_WINDOW_STARTER.md",
    "examples/file-only-export/README.md",
    "examples/file-only-export/exports/manifest.json",
    "examples/file-only-export/exports/context-pack.md",
    "examples/file-only-export/exports/context.json",
    "examples/file-only-export/exports/adapter-notes.md",
    "examples/context-pack-doctor/README.md",
    "examples/project-profile-lite/README.md",
    "examples/project-profile-lite/basebrief-profile.json",
    "examples/next-chat-example.md",
    "examples/receiver-check-config.json",
    "examples/receiver/difference-found/README.md",
    "examples/receiver/difference-found/receiver-check-config.json",
    "examples/receiver/difference-found/receiver-check-result.json",
    "examples/receiver/blocked/README.md",
    "examples/receiver/blocked/blocked-result.json",
    "examples/receiver/language-routing/README.md",
    "examples/receiver/language-routing/receiver-report.md",
    "examples/receiver/delta-report-pass/README.md",
    "examples/receiver/delta-report-difference-found/README.md",
    "examples/receiver/usage-pack/README.md",
    "examples/receiver/usage-pack/starter-report-outline.md",
    "examples/receiver/lint/README.md",
    "examples/receiver/lint/clean-pass-receiver-report.md",
    "examples/receiver/lint/delta-missing-section-receiver-report.md",
    "examples/receiver/lint/starter-missing-pass-fail-starter-report.md",
    "examples/receiver/lint/starter-missing-wait-starter-report.md",
    "examples/receiver/lint/starter-missing-fact-layer-starter-report.md",
    "examples/receiver/lint/json-invalid-result-consistency.json",
    "examples/receiver/lint/difference-found-warning-receiver-report.md",
    "examples/receiver/lint/historical-drift-warning-starter-report.md",
    "examples/receiver/lint/repair/README.md",
    "examples/receiver/lint/repair/fixed-delta-receiver-report.md",
    "examples/receiver/lint/repair/fixed-starter-report.md",
    "examples/receiver/lint/repair/fixed-result.json",
    "examples/context-pack-lite/README.md",
    "examples/context-pack-lite/MANIFEST.md",
    "examples/context-pack-lite/REPO_MAP.md",
    "examples/context-pack-lite/KEY_FILES.md",
    "examples/context-pack-lite/RECENT_DELTA.md",
    "examples/context-pack-lite/RISK_BOUNDARIES.md",
    "examples/context-pack-lite/RECEIVER_STATE.md",
    "examples/context-pack-lite/NEXT_WINDOW_STARTER.md",
    "examples/context-pack-continuation/README.md",
    "examples/project-profile-lite/README.md",
    "examples/project-profile-lite/basebrief-profile.json",
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
    "examples/simple-continuation/README.md",
    "examples/simple-continuation/input/PROJECT_STATE.md",
    "examples/simple-continuation/input/NOTES.md",
    "examples/simple-continuation/output/CONTINUATION_REPORT.md",
    "examples/simple-continuation/output/CHECK_SUMMARY.md",
    "examples/simple-continuation/output/NEXT_WINDOW_STARTER.md",
    "tests/continuation-harness.test.js",
    "tests/workflow-runner.test.js",
    ".github/ISSUE_TEMPLATE/usability_feedback.md",
  ];
  required.forEach((relativePath) => {
    assert(fs.existsSync(path.join(repoRoot, relativePath)), `Missing required file: ${relativePath}`);
  });
}

function checkV2ContextPackDocs(context) {
  const {
    docsIndex,
    testingDoc,
    v2ContextPackRoadmapDoc,
    contextPackHumanNextStepHintsDogfoodingV271Doc,
    v280PlanDoc,
    v280ReleaseDoc,
    v290PlanDoc,
    v290ReleaseDoc,
    v291ReleaseDoc,
    v300PlanDoc,
    continuationHarnessDogfoodingDoc,
    basebriefCliScript,
    basebriefContinuationHarnessScript,
    basebriefProjectProfileScript,
    basebriefWorkflowScript,
    continuationExampleReadme,
    projectProfileExampleReadme,
    projectProfileExample,
  } = context;

  assert(testingDoc.includes("v2.0.0 Context Pack Lite Local Closeout"), "Testing docs must document v2.0.0 context pack closeout");
  assert(testingDoc.includes("v2.1.0 Context Pack Check Local Closeout"), "Testing docs must document v2.1.0 context pack check closeout");
  assert(testingDoc.includes("v2.2.0 One-command Resume / New-window Prompt Plan"), "Testing docs must document v2.2.0 resume plan");
  assert(testingDoc.includes("v2.3.0 BaseBrief Format Plan"), "Testing docs must document v2.3.0 format plan");
  assert(testingDoc.includes("File-only Export Dogfooding v2.4.0"), "Testing docs must document v2.4 file-only export dogfooding");
  assert(testingDoc.includes("../examples/file-only-export/README.md"), "Testing docs must link file-only export example kit");
  assert(testingDoc.includes("examples/file-only-export/exports/` is a recommended example output directory"), "Testing docs must clarify example export directory naming");
  assert(testingDoc.includes("receiver_style_acceptance: pass"), "Testing docs must record v2.4 export receiver-style acceptance");
  assert(testingDoc.includes("v2.5.0 Context Pack Doctor"), "Testing docs must document v2.5 context pack doctor");
  assert(testingDoc.includes("doctor --repo <target-repo> --context-pack <context-pack-dir>"), "Testing docs must document doctor command");
  assert(testingDoc.includes("Context Pack Doctor Dogfooding v2.5.0"), "Testing docs must link v2.5 doctor dogfooding");
  assert(testingDoc.includes("Context Pack Doctor Dogfooding v2.5.1"), "Testing docs must link v2.5.1 doctor dogfooding");
  assert(testingDoc.includes("../examples/context-pack-doctor/README.md"), "Testing docs must link context pack doctor example kit");
  assert(testingDoc.includes("doctor_contract_version: basebrief-doctor-v1"), "Testing docs must record doctor contract version");
  assert(testingDoc.includes("post_commit_doctor_status: passed"), "Testing docs must record v2.5.1 post-commit doctor status");
  assert(testingDoc.includes("no_provider_boundary_warning_status: absent"), "Testing docs must record v2.5.1 boundary warning absence");
  assert(testingDoc.includes("export_bundle_check_status: passed"), "Testing docs must record v2.5.1 export bundle check");
  assert(testingDoc.includes("v2.6.0 First-Run / Adoption Polish Local Closeout"), "Testing docs must document v2.6 adoption polish closeout");
  assert(testingDoc.includes("docs/examples/release-check adoption polish"), "Testing docs must scope v2.6 as docs/examples/release-check polish");
  assert(testingDoc.includes("no always-on status command"), "Testing docs must keep v2.6 out of status scope");
  assert(testingDoc.includes("v2.6.1 Context Pack Adoption Notes"), "Testing docs must document v2.6.1 adoption notes");
  assert(testingDoc.includes("dogfooding/context-pack-adoption-notes-v2.6.1.md"), "Testing docs must link v2.6.1 adoption notes");
  assert(testingDoc.includes("`blocking`, `confusing`, or `nice-to-have`"), "Testing docs must record v2.6.1 friction classes");
  assert(testingDoc.includes("not a new feature line or contract"), "Testing docs must keep v2.6.1 out of feature and contract scope");
  assert(testingDoc.includes("v2.6.4 Context Engineering Reference Notes"), "Testing docs must document v2.6.4 reference notes");
  assert(testingDoc.includes("dogfooding/context-engineering-reference-notes-v2.6.4.md"), "Testing docs must link v2.6.4 reference notes");
  assert(testingDoc.includes("own your") && testingDoc.includes("stateless reducer") && testingDoc.includes("handoff artifact") && testingDoc.includes("memory hygiene") && testingDoc.includes("context compression"), "Testing docs must summarize v2.6.4 external context themes");
  assert(testingDoc.includes("v3 Continuation Harness") && testingDoc.includes("Workflow Runner Lite") && testingDoc.includes("repeated real") && testingDoc.includes("friction"), "Testing docs must keep v3 behind repeated friction");
  assert(testingDoc.includes("v2.6.5 Context Pack Adoption Scenario Matrix"), "Testing docs must document v2.6.5 scenario matrix");
  assert(testingDoc.includes("dogfooding/context-pack-adoption-scenario-matrix-v2.6.5.md"), "Testing docs must link v2.6.5 scenario matrix");
  assert(testingDoc.includes("clean packs") && testingDoc.includes("context-pack.too-thick") && testingDoc.includes("stale HEAD") && testingDoc.includes("broken pack") && testingDoc.includes("doctor.live-recheck-required"), "Testing docs must summarize v2.6.5 scenario coverage");
  assert(testingDoc.includes("`check` as the pack validity gate") && testingDoc.includes("`resume` as the copyable") && testingDoc.includes("`doctor` as live repo comparison"), "Testing docs must preserve v2.6.5 command roles");
  assert(testingDoc.includes("v2.6.6 Context Pack First-Run Fixture Lab"), "Testing docs must document v2.6.6 fixture lab");
  assert(testingDoc.includes("dogfooding/context-pack-first-run-fixture-lab-v2.6.6.md"), "Testing docs must link v2.6.6 fixture lab");
  assert(testingDoc.includes("branch mismatch") && testingDoc.includes("Continuation rules:"), "Testing docs must summarize v2.6.6 fixture lab coverage");
  assert(testingDoc.includes("`check` as the structural review gate") && testingDoc.includes("`resume` as the copyable") && testingDoc.includes("`doctor` as live repo comparison"), "Testing docs must preserve v2.6.6 command roles");
  assert(testingDoc.includes("v2.6.7 Context Pack First-Run Rehearsal Audit"), "Testing docs must document v2.6.7 rehearsal audit");
  assert(testingDoc.includes("dogfooding/context-pack-first-run-rehearsal-audit-v2.6.7.md"), "Testing docs must link v2.6.7 rehearsal audit");
  assert(testingDoc.includes("clean generated pack") && testingDoc.includes("doctor.pack-head-stale") && testingDoc.includes("No blocking adoption friction was found"), "Testing docs must summarize v2.6.7 rehearsal results");
  assert(testingDoc.includes("v2.6.8 Context Pack First-Run Friction Repair"), "Testing docs must document v2.6.8 friction repair");
  assert(testingDoc.includes("dogfooding/context-pack-first-run-friction-repair-v2.6.8.md"), "Testing docs must link v2.6.8 friction repair");
  assert(testingDoc.includes("Get-Content -Encoding UTF8 <file>") && testingDoc.includes("最短闭环 -> 路径 B -> 路径 B3"), "Testing docs must summarize v2.6.8 repair coverage");
  assert(testingDoc.includes("v2.6.9 Context Pack Adoption Decision Checkpoint"), "Testing docs must document v2.6.9 decision checkpoint");
  assert(testingDoc.includes("dogfooding/context-pack-adoption-decision-checkpoint-v2.6.9.md"), "Testing docs must link v2.6.9 decision checkpoint");
  assert(testingDoc.includes("v2.6.x local adoption incubation") && testingDoc.includes("current evidence does not justify Status"), "Testing docs must summarize v2.6.9 decision");
  assert(testingDoc.includes("v2.6.10 Context Pack Pre-Release Bundle Audit"), "Testing docs must document v2.6.10 bundle audit");
  assert(testingDoc.includes("dogfooding/context-pack-pre-release-bundle-audit-v2.6.10.md"), "Testing docs must link v2.6.10 bundle audit");
  assert(testingDoc.includes("ahead-7 local adoption bundle") && testingDoc.includes("docs/examples/release-check/adoption polish only"), "Testing docs must summarize v2.6.10 bundle scope");
  assert(testingDoc.includes("v2.6.11 Context Pack Feature Feasibility Spike"), "Testing docs must document v2.6.11 feasibility spike");
  assert(testingDoc.includes("dogfooding/context-pack-feature-feasibility-spike-v2.6.11.md"), "Testing docs must link v2.6.11 feasibility spike");
  assert(testingDoc.includes("Continuation Harness Lite") && testingDoc.includes("implementation_status: not_started"), "Testing docs must keep v2.6.11 not started");
  assert(testingDoc.includes("context-pack -> check -> resume -> live recheck"), "Testing docs must summarize v2.6.11 feasibility question");
  assert(testingDoc.includes("v2.6.12 Context Pack Local Bundle Review / Handoff Rehearsal"), "Testing docs must document v2.6.12 bundle review rehearsal");
  assert(testingDoc.includes("dogfooding/context-pack-local-bundle-review-rehearsal-v2.6.12.md"), "Testing docs must link v2.6.12 bundle review rehearsal");
  assert(testingDoc.includes("ahead-9 local adoption bundle") && testingDoc.includes("context_pack_status: generated"), "Testing docs must summarize v2.6.12 bundle and rehearsal");
  assert(testingDoc.includes("doctor_info_findings: doctor.live-recheck-required"), "Testing docs must record v2.6.12 doctor info finding");
  assert(testingDoc.includes("v2.6.13 Context Pack Local Bundle Compression"), "Testing docs must document v2.6.13 bundle compression");
  assert(testingDoc.includes("dogfooding/context-pack-local-bundle-compression-v2.6.13.md"), "Testing docs must link v2.6.13 bundle compression");
  assert(testingDoc.includes("ahead-10 local adoption bundle") && testingDoc.includes("starter wording repair") && testingDoc.includes("adoption examples/evidence"), "Testing docs must summarize v2.6.13 compressed bundle");
  assert(testingDoc.includes("future major-release candidate wording") && testingDoc.includes("JSON contract changes out of scope"), "Testing docs must keep v2.6.13 in compression scope");
  assert(testingDoc.includes("v2.6.14 Context Pack Release-Check Maintainability"), "Testing docs must document v2.6.14 release-check maintainability");
  assert(testingDoc.includes("dogfooding/context-pack-release-check-maintainability-v2.6.14.md"), "Testing docs must link v2.6.14 release-check maintainability");
  assertIncludesPhrase(testingDoc, "whitespace-normalized phrase matching for long prose assertions", "Testing docs must summarize v2.6.14 whitespace-normalized matching");
  assert(testingDoc.includes("rule IDs") && testingDoc.includes("contract versions") && testingDoc.includes("JSON keys"), "Testing docs must keep exact technical literals exact");
  assert(testingDoc.includes("v2.6.15 Context Pack Major-Release Candidate Shape"), "Testing docs must document v2.6.15 major-release candidate shape");
  assert(testingDoc.includes("dogfooding/context-pack-major-release-candidate-shape-v2.6.15.md"), "Testing docs must link v2.6.15 major-release candidate shape");
  assertIncludesPhrase(testingDoc, "separates public release-note material from details that should remain dogfooding evidence", "Testing docs must summarize v2.6.15 release-note separation");
  assertIncludesPhrase(testingDoc, "first-run adoption polish, Context Pack interpretation, diagnostics confidence", "Testing docs must summarize v2.6.15 public story");
  assert(testingDoc.includes("commit hashes") && testingDoc.includes("private output paths") && testingDoc.includes("assertion wording"), "Testing docs must keep dogfooding-only details out of release notes");
  assert(testingDoc.includes("v2.6.16 Context Pack Continuation Harness Decision Spec"), "Testing docs must document v2.6.16 harness decision spec");
  assert(testingDoc.includes("dogfooding/context-pack-continuation-harness-decision-spec-v2.6.16.md"), "Testing docs must link v2.6.16 harness decision spec");
  assert(testingDoc.includes("implementation_status: not_started"), "Testing docs must keep v2.6.16 implementation not started");
  assertIncludesPhrase(testingDoc, "evidence thresholds that must be met before any future harness work begins", "Testing docs must summarize v2.6.16 evidence threshold");
  assertIncludesPhrase(testingDoc, "context-pack -> check -> resume -> live recheck", "Testing docs must summarize v2.6.16 handoff sequence");
  assert(testingDoc.includes("Status") && testingDoc.includes("Workflow Runner") && testingDoc.includes("JSON contract changes out of scope"), "Testing docs must keep v2.6.16 out of behavior scope");
  assert(testingDoc.includes("v2.6.17 Context Pack Ahead-14 Bundle Review"), "Testing docs must document v2.6.17 ahead-14 bundle review");
  assert(testingDoc.includes("dogfooding/context-pack-ahead14-bundle-review-v2.6.17.md"), "Testing docs must link v2.6.17 ahead-14 bundle review");
  assertIncludesPhrase(testingDoc, "separates release-note candidates, dogfooding-only evidence, and future feature gates", "Testing docs must summarize v2.6.17 three-way split");
  assertIncludesPhrase(testingDoc, "without becoming frequent push/tag/release churn", "Testing docs must keep v2.6.17 out of publish churn");
  assert(testingDoc.includes("Continuation Harness Lite") && testingDoc.includes("Status") && testingDoc.includes("Workflow Runner") && testingDoc.includes("JSON contract changes out of scope"), "Testing docs must keep v2.6.17 out of behavior scope");
  assert(testingDoc.includes("v2.6.18 Context Pack Minimal Feature Candidate Decision"), "Testing docs must document v2.6.18 minimal feature candidate decision");
  assert(testingDoc.includes("dogfooding/context-pack-minimal-feature-candidate-decision-v2.6.18.md"), "Testing docs must link v2.6.18 minimal feature candidate decision");
  assertIncludesPhrase(testingDoc, "Continuation Harness Lite as a design-sketch candidate only", "Testing docs must keep v2.6.18 harness as design sketch only");
  assert(testingDoc.includes("rejects Status") && testingDoc.includes("Workflow Runner") && testingDoc.includes("Doctor expansion") && testingDoc.includes("JSON contract changes for now"), "Testing docs must summarize v2.6.18 rejected candidates");
  assertIncludesPhrase(testingDoc, "real first-run/handoff validation", "Testing docs must point v2.6.18 to validation before implementation");
  assertIncludesPhrase(testingDoc, "push, tag, release, and PR actions out of scope", "Testing docs must keep v2.6.18 out of publish scope");
  assert(testingDoc.includes("Context Pack First-Run / Handoff Validation"), "Testing docs must document first-run handoff validation");
  assert(testingDoc.includes("dogfooding/context-pack-first-run-handoff-validation.md"), "Testing docs must link first-run handoff validation");
  assertIncludesPhrase(testingDoc, "context-pack -> check -> resume -> doctor", "Testing docs must summarize first-run validation path");
  assert(testingDoc.includes("clean `check`") && testingDoc.includes("Continuation rules:") && testingDoc.includes("basebrief-doctor-v1") && testingDoc.includes("doctor.live-recheck-required"), "Testing docs must summarize first-run validation results");
  assertIncludesPhrase(testingDoc, "did not observe blocking or repeated confusing friction", "Testing docs must record no repeated friction");
  assertIncludesPhrase(testingDoc, "does not trigger Continuation Harness Lite implementation, Status, Workflow Runner, or JSON contract changes", "Testing docs must keep validation out of feature implementation scope");
  assert(testingDoc.includes("Context Pack Continuation Harness Lite Design Sketch"), "Testing docs must document harness lite design sketch");
  assert(testingDoc.includes("dogfooding/context-pack-continuation-harness-lite-design-sketch.md"), "Testing docs must link harness lite design sketch");
  assertIncludesPhrase(testingDoc, "planning material only, not an implementation", "Testing docs must keep harness lite design sketch non-implementation");
  assertIncludesPhrase(testingDoc, "five-step human flow from inherited Context Pack to live recheck", "Testing docs must summarize harness lite five-step flow");
  assert(testingDoc.includes("user_goal_required"), "Testing docs must include harness lite final state");
  assert(testingDoc.includes("command_status: not_started") && testingDoc.includes("implementation_status: not_started"), "Testing docs must keep harness lite command and implementation not started");
  assert(testingDoc.includes("Status") && testingDoc.includes("Workflow Runner") && testingDoc.includes("JSON contract changes out of scope"), "Testing docs must keep harness lite out of behavior scope");
  assert(testingDoc.includes("Context Pack Continuation Harness Lite Paper Rehearsal"), "Testing docs must document harness lite paper rehearsal");
  assert(testingDoc.includes("dogfooding/context-pack-continuation-harness-lite-paper-rehearsal.md"), "Testing docs must link harness lite paper rehearsal");
  assertIncludesPhrase(testingDoc, "planning validation only, not an implementation", "Testing docs must keep harness lite rehearsal non-implementation");
  assert(testingDoc.includes("clean pack") && testingDoc.includes("too-thick warning") && testingDoc.includes("broken pack") && testingDoc.includes("stale/live drift") && testingDoc.includes("missing pack"), "Testing docs must summarize harness lite rehearsal scenarios");
  assert(testingDoc.includes("check_passed + live_match -> resume_ready -> user_goal_required"), "Testing docs must include harness lite clean-pack transition");
  assert(testingDoc.includes("check_warning -> human_review"), "Testing docs must include harness lite warning transition");
  assert(testingDoc.includes("check_failed -> repair_pack"), "Testing docs must include harness lite broken transition");
  assert(testingDoc.includes("check_passed + live_drift -> doctor_or_refresh"), "Testing docs must include harness lite drift transition");
  assert(testingDoc.includes("pack_missing -> blocked"), "Testing docs must include harness lite missing-pack transition");
  assert(testingDoc.includes("implementation_status: not_started") && testingDoc.includes("command_status: not_started"), "Testing docs must keep harness lite paper rehearsal command and implementation not started");
  assert(testingDoc.includes("v2.6.20 Context Pack Local Bundle Compression"), "Testing docs must document v2.6.20 bundle compression");
  assert(testingDoc.includes("dogfooding/context-pack-local-bundle-compression-v2.6.20.md"), "Testing docs must link v2.6.20 bundle compression");
  assertIncludesPhrase(testingDoc, "ahead-19 local adoption and design bundle", "Testing docs must summarize v2.6.20 ahead-19 bundle");
  assertIncludesPhrase(testingDoc, "future release-note candidates, dogfooding-only evidence, release-check / contract protections, and feature gates / deferred candidates", "Testing docs must summarize v2.6.20 categories");
  assertIncludesPhrase(testingDoc, "local bundle compression only, not a release closeout, push, tag, release, PR, or feature implementation", "Testing docs must keep v2.6.20 local only");
  assert(testingDoc.includes("v2.6.21 Context Pack Implementation Gate Decision"), "Testing docs must document v2.6.21 implementation gate decision");
  assert(testingDoc.includes("dogfooding/context-pack-implementation-gate-decision-v2.6.21.md"), "Testing docs must link v2.6.21 implementation gate decision");
  assertIncludesPhrase(testingDoc, "closes the current implementation gate for Continuation Harness Lite", "Testing docs must summarize v2.6.21 gate closure");
  assertIncludesPhrase(testingDoc, "current evidence still lacks repeated real blocking or high-frequency confusing friction", "Testing docs must keep v2.6.21 evidence below implementation threshold");
  assertIncludesPhrase(testingDoc, "no new CLI command, no JSON shape change, no Status, no Workflow Runner, no Doctor expansion", "Testing docs must keep v2.6.21 out of new behavior scope");
  assert(testingDoc.includes("v2.6.22 Context Pack Release-Check Maintainability Plan"), "Testing docs must document v2.6.22 release-check maintainability plan");
  assert(testingDoc.includes("dogfooding/context-pack-release-check-maintainability-plan-v2.6.22.md"), "Testing docs must link v2.6.22 release-check maintainability plan");
  assertIncludesPhrase(testingDoc, "local maintainability plan, not an implementation", "Testing docs must keep v2.6.22 as plan only");
  assertIncludesPhrase(testingDoc, "v2.x dogfooding/documentation assertion cluster inside `scripts/run_release_checks.js`", "Testing docs must summarize v2.6.22 first slice");
  assertIncludesPhrase(testingDoc, "keeping `npm run release-check` output unchanged", "Testing docs must preserve release-check output for v2.6.22");
  assertIncludesPhrase(testingDoc, "does not add a command, change release-check output, change test commands", "Testing docs must keep v2.6.22 out of behavior scope");
  assert(testingDoc.includes("v2.6.23 Context Pack Runnable Recipes"), "Testing docs must document v2.6.23 runnable recipes");
  assert(testingDoc.includes("dogfooding/context-pack-runnable-recipes-plan-v2.6.23.md"), "Testing docs must link v2.6.23 runnable recipes plan");
  assertIncludesPhrase(testingDoc, "local examples recipe enhancement, not a command or contract change", "Testing docs must keep v2.6.23 in examples recipe scope");
  assert(testingDoc.includes("README -> quickstart -> examples/minimal"), "Testing docs must summarize minimal recipe path");
  assert(testingDoc.includes("context-pack -> check -> resume -> doctor"), "Testing docs must summarize Context Pack recipe path");
  assert(testingDoc.includes("check -> doctor"), "Testing docs must summarize doctor recipe path");
  assert(testingDoc.includes("check -> export"), "Testing docs must summarize export recipe path");
  assertIncludesPhrase(testingDoc, "does not add a CLI command, change package scripts, change release-check output", "Testing docs must preserve v2.6.23 command and output boundaries");
  assert(testingDoc.includes("v2.6.24 Context Pack First-Run Smoke Path Consolidation"), "Testing docs must document v2.6.24 first-run smoke path consolidation");
  assert(testingDoc.includes("dogfooding/context-pack-first-run-smoke-path-consolidation-v2.6.24.md"), "Testing docs must link v2.6.24 first-run smoke path consolidation");
  assertIncludesPhrase(testingDoc, "local first-run path consolidation, not a command or contract change", "Testing docs must keep v2.6.24 in first-run path scope");
  assert(testingDoc.includes("README -> docs/index.md -> docs/quickstart-5min.md -> examples/minimal -> examples/context-pack-lite"), "Testing docs must include canonical v2.6.24 first-run smoke path");
  assert(testingDoc.includes("npm run check"), "Testing docs must include v2.6.24 local validation gate");
  assertIncludesPhrase(testingDoc, "Doctor and File-only Export as follow-up recipes, not mandatory first-run steps", "Testing docs must keep v2.6.24 follow-up recipes out of mandatory first-run scope");
  assertIncludesPhrase(testingDoc, "does not add a CLI command, change package scripts, change release-check output", "Testing docs must preserve v2.6.24 command and output boundaries");
  assert(testingDoc.includes("v2.6.25 Context Pack Output UX Polish"), "Testing docs must document v2.6.25 output UX polish");
  assert(testingDoc.includes("dogfooding/context-pack-output-ux-polish-v2.6.25.md"), "Testing docs must link v2.6.25 output UX polish");
  assertIncludesPhrase(testingDoc, "local output UX polish only, not a command or contract change", "Testing docs must keep v2.6.25 in output UX scope");
  assertIncludesPhrase(testingDoc, "live repo facts are stale-prone and must be rechecked before edits", "Testing docs must summarize v2.6.25 stale-prone live facts wording");
  assert(testingDoc.includes("not_available") && testingDoc.includes("not_applicable") && testingDoc.includes("needs-review") && testingDoc.includes("missing-input semantics rather than failure states"), "Testing docs must summarize v2.6.25 missing-input semantics");
  assertIncludesPhrase(testingDoc, "separate inherited pack facts from live rechecks", "Testing docs must summarize v2.6.25 expected first response separation");
  assertIncludesPhrase(testingDoc, "does not add a CLI command, change package scripts, change release-check output", "Testing docs must preserve v2.6.25 command and output boundaries");
  assert(testingDoc.includes("v2.6.26 Context Pack Test-File Split Plan"), "Testing docs must document v2.6.26 test-file split plan");
  assert(testingDoc.includes("dogfooding/context-pack-test-file-split-plan-v2.6.26.md"), "Testing docs must link v2.6.26 test-file split plan");
  assertIncludesPhrase(testingDoc, "local test maintainability plan only, not a test-runner or contract change", "Testing docs must keep v2.6.26 in test maintainability scope");
  assert(testingDoc.includes("tests/basebrief.test.js") && testingDoc.includes("tests/context-pack.test.js"), "Testing docs must summarize v2.6.26 current and candidate test files");
  assert(testingDoc.includes("Context Pack v2") && testingDoc.includes("cache-ready generators") && testingDoc.includes("Receiver workflows") && testingDoc.includes("Project State"), "Testing docs must summarize v2.6.26 test clusters");
  assertIncludesPhrase(testingDoc, "does not split tests yet, add a CLI command, change package scripts, change release-check output", "Testing docs must preserve v2.6.26 planning-only boundaries");
  assert(testingDoc.includes("v2.6.27 Context Pack Test-File Split"), "Testing docs must document v2.6.27 test-file split");
  assert(testingDoc.includes("dogfooding/context-pack-test-file-split-v2.6.27.md"), "Testing docs must link v2.6.27 test-file split");
  assert(testingDoc.includes("tests/basebrief.test.js") && testingDoc.includes("tests/context-pack.test.js"), "Testing docs must document v2.6.27 two-file test baseline");
  assertIncludesPhrase(testingDoc, "node --test tests/basebrief.test.js tests/context-pack.test.js", "Testing docs must document v2.6.27 npm test command");
  assert(testingDoc.includes("Expected test count remains 175 tests") && testingDoc.includes("independent_test_files=2"), "Testing docs must document v2.6.27 test count and independent file count");
  assertIncludesPhrase(testingDoc, "does not add a CLI command, change release-check output shape", "Testing docs must preserve v2.6.27 command and output boundaries");
  assert(testingDoc.includes("v2.6.28 Context Pack Test-File Split Second Candidate"), "Testing docs must document v2.6.28 second split candidate");
  assert(testingDoc.includes("dogfooding/context-pack-test-file-split-second-candidate-v2.6.28.md"), "Testing docs must link v2.6.28 second split candidate");
  assert(testingDoc.includes("tests/cache-ready-benchmark.test.js"), "Testing docs must name v2.6.28 second candidate file");
  assert(testingDoc.includes("cache-ready generators") && testingDoc.includes("benchmark summaries") && testingDoc.includes("relay usage audit"), "Testing docs must summarize v2.6.28 selected scope");
  assert(testingDoc.includes("Receiver, Project State, Sidecar") && testingDoc.includes("docs/release-line assertion splits remain deferred"), "Testing docs must defer broader v2.6.28 clusters");
  assertIncludesPhrase(testingDoc, "node --test tests/basebrief.test.js tests/context-pack.test.js", "Testing docs must keep v2.6.28 npm test command");
  assert(testingDoc.includes("Expected test count remains 175 tests") && testingDoc.includes("independent_test_files=2"), "Testing docs must keep v2.6.28 test count and independent file count");
  assertIncludesPhrase(testingDoc, "does not add a CLI command, add a new test file, change package scripts", "Testing docs must keep v2.6.28 planning-only boundaries");
  assert(testingDoc.includes("v2.6.29 Context Pack Cache-Ready Benchmark Test Split"), "Testing docs must document v2.6.29 cache-ready benchmark test split");
  assert(testingDoc.includes("dogfooding/context-pack-cache-ready-benchmark-test-split-v2.6.29.md"), "Testing docs must link v2.6.29 cache-ready benchmark test split");
  assert(testingDoc.includes("tests/cache-ready-benchmark.test.js"), "Testing docs must name v2.6.29 split file");
  assert(testingDoc.includes("cache-ready generators") && testingDoc.includes("benchmark summaries") && testingDoc.includes("relay usage audit"), "Testing docs must summarize v2.6.29 moved scope");
  assertIncludesPhrase(testingDoc, "node --test tests/basebrief.test.js tests/context-pack.test.js tests/cache-ready-benchmark.test.js", "Testing docs must document v2.6.29 npm test command");
  assert(testingDoc.includes("Expected test count remains 175 tests") && testingDoc.includes("independent_test_files=3"), "Testing docs must document v2.6.29 test count and independent file count");
  assert(testingDoc.includes("Receiver, Project State, Sidecar") && testingDoc.includes("Context Pack v2, File-only Export, Doctor, and Resume"), "Testing docs must summarize v2.6.29 remaining file responsibilities");
  assertIncludesPhrase(testingDoc, "does not add a CLI command, change release-check output shape", "Testing docs must preserve v2.6.29 command and output boundaries");
  assert(testingDoc.includes("v2.6.30 Context Pack Test Split Stability Check"), "Testing docs must document v2.6.30 test split stability check");
  assert(testingDoc.includes("dogfooding/context-pack-test-split-stability-check-v2.6.30.md"), "Testing docs must link v2.6.30 stability check");
  assert(testingDoc.includes("tests/basebrief.test.js: 118 tests") && testingDoc.includes("tests/context-pack.test.js: 11 tests") && testingDoc.includes("tests/cache-ready-benchmark.test.js: 46 tests"), "Testing docs must document v2.6.30 test distribution");
  assertIncludesPhrase(testingDoc, "node --test tests/basebrief.test.js tests/context-pack.test.js tests/cache-ready-benchmark.test.js", "Testing docs must keep v2.6.30 npm test command");
  assert(testingDoc.includes("Expected test count remains 175 tests") && testingDoc.includes("independent_test_files=3"), "Testing docs must keep v2.6.30 test count and independent file count");
  assert(testingDoc.includes("Receiver, Project State, Sidecar") && testingDoc.includes("docs/release-line assertion splits remain deferred"), "Testing docs must defer broader v2.6.30 clusters");
  assertIncludesPhrase(testingDoc, "does not add a CLI command, add a new test file, change package scripts", "Testing docs must keep v2.6.30 stability-only boundaries");
  assert(testingDoc.includes("v2.6.31 Context Pack v2.6.x Local Closeout Gate"), "Testing docs must document v2.6.31 local closeout gate");
  assert(testingDoc.includes("dogfooding/context-pack-v2.6x-local-closeout-gate-v2.6.31.md"), "Testing docs must link v2.6.31 local closeout gate");
  assertIncludesPhrase(testingDoc, "the three recommended items are completed: cache-ready benchmark test split implementation, post-split stability check, and release-check maintainability helper refactor", "Testing docs must summarize completed v2.6.31 recommended items");
  assertIncludesPhrase(testingDoc, "The v2.6.x local line can stop here", "Testing docs must close the local v2.6.x line");
  assertIncludesPhrase(testingDoc, "either a v2.7 planning/implementation line or a release-candidate decision", "Testing docs must point v2.6.31 to next direction");
  assertIncludesPhrase(testingDoc, "keeps Continuation Harness Lite as a future candidate only", "Testing docs must keep v2.6.31 harness deferred");
  assertIncludesPhrase(testingDoc, "does not add a CLI command, change package scripts, change release-check output", "Testing docs must preserve v2.6.31 command and output boundaries");
  assert(testingDoc.includes("v2.6.32 Context Pack Release-Candidate Direction Decision"), "Testing docs must document v2.6.32 release-candidate direction decision");
  assert(testingDoc.includes("dogfooding/context-pack-release-candidate-decision-v2.6.32.md"), "Testing docs must link v2.6.32 release-candidate direction decision");
  assertIncludesPhrase(testingDoc, "selects the release-candidate decision path after the v2.6.x local closeout gate", "Testing docs must summarize v2.6.32 selected path");
  assertIncludesPhrase(testingDoc, "future release-note candidates, dogfooding-only evidence, release-check / contract protections, and deferred feature gates", "Testing docs must summarize v2.6.32 compression categories");
  assert(testingDoc.includes("release_candidate_status: decision_ready_not_published"), "Testing docs must record v2.6.32 release-candidate status");
  assertIncludesPhrase(testingDoc, "keeps v2.7 implementation deferred until the release-candidate decision explains any remaining user-facing gap", "Testing docs must defer v2.7 after v2.6.32 decision");
  assertIncludesPhrase(testingDoc, "does not add a CLI command, change package scripts, change release-check output", "Testing docs must preserve v2.6.32 command and output boundaries");
  assert(testingDoc.includes("v2.6.33 Context Pack Release-Candidate Summary Draft"), "Testing docs must document v2.6.33 release-candidate summary draft");
  assert(testingDoc.includes("dogfooding/context-pack-release-candidate-summary-draft-v2.6.33.md"), "Testing docs must link v2.6.33 release-candidate summary draft");
  assertIncludesPhrase(testingDoc, "separates a public release-note draft from dogfooding-only evidence", "Testing docs must summarize v2.6.33 public and dogfooding split");
  assert(testingDoc.includes("first-run discoverability") && testingDoc.includes("runnable recipes") && testingDoc.includes("receiver-facing Context Pack wording"), "Testing docs must summarize v2.6.33 public story");
  assert(testingDoc.includes("three independent test files") && testingDoc.includes("release-check assertions"), "Testing docs must summarize v2.6.33 validation confidence");
  assertIncludesPhrase(testingDoc, "release closeout prep versus a narrow v2.7 implementation plan", "Testing docs must preserve v2.6.33 open decision");
  assert(testingDoc.includes("decision_ready_not_published"), "Testing docs must keep v2.6.33 not published");
  assertIncludesPhrase(testingDoc, "does not add a CLI command, change package scripts, change release-check output", "Testing docs must preserve v2.6.33 command and output boundaries");
  assert(testingDoc.includes("v2.6.34 Context Pack Release Closeout Go/No-Go Plan"), "Testing docs must document v2.6.34 release closeout go/no-go plan");
  assert(testingDoc.includes("dogfooding/context-pack-release-closeout-go-no-go-plan-v2.6.34.md"), "Testing docs must link v2.6.34 release closeout go/no-go plan");
  assert(testingDoc.includes("go_to_release_closeout_prep"), "Testing docs must record v2.6.34 go/no-go result");
  assertIncludesPhrase(testingDoc, "coherent enough to prepare a release closeout draft", "Testing docs must summarize v2.6.34 go rationale");
  assertIncludesPhrase(testingDoc, "no concrete user-facing gap has been identified that would justify starting v2.7 first", "Testing docs must defer v2.7 in v2.6.34");
  assertIncludesPhrase(testingDoc, "convert the public release-note draft into closeout-ready wording", "Testing docs must summarize v2.6.34 next slice");
  assertIncludesPhrase(testingDoc, "publish, push, tag, release, and PR actions `not_started`", "Testing docs must keep v2.6.34 release actions not started");
  assertIncludesPhrase(testingDoc, "does not add a CLI command, change package scripts, change release-check output", "Testing docs must preserve v2.6.34 command and output boundaries");
  assert(testingDoc.includes("v2.6.35 Context Pack Release Closeout Prep Draft"), "Testing docs must document v2.6.35 release closeout prep draft");
  assert(testingDoc.includes("dogfooding/context-pack-release-closeout-prep-draft-v2.6.35.md"), "Testing docs must link v2.6.35 release closeout prep draft");
  assertIncludesPhrase(testingDoc, "converts the v2.6.33 public summary draft and v2.6.34 go/no-go decision into closeout-prep wording", "Testing docs must summarize v2.6.35 prep source");
  assert(testingDoc.includes("first-run discoverability") && testingDoc.includes("runnable examples") && testingDoc.includes("receiver-facing Context Pack wording"), "Testing docs must summarize v2.6.35 public story");
  assert(testingDoc.includes("release_check_status: passed_current_slice") && testingDoc.includes("npm_test_status:"), "Testing docs must record v2.6.35 validation statuses");
  assert(testingDoc.includes("passed_175_tests_current_slice") && testingDoc.includes("git_diff_check_status: passed_existing_crlf_warnings_only"), "Testing docs must record v2.6.35 test and diff-check statuses");
  assertIncludesPhrase(testingDoc, "Release-check metric lines such as `mode_cases`, `checked_links`, `cli_lite_commands`, and `independent_test_files` remain preserved", "Testing docs must preserve v2.6.35 metric lines");
  assertIncludesPhrase(testingDoc, "does not add a CLI command, change package scripts, change release-check output", "Testing docs must preserve v2.6.35 command and output boundaries");
  assert(testingDoc.includes("v2.6.36 Context Pack Formal Local Release Closeout Draft"), "Testing docs must document v2.6.36 formal local release closeout draft");
  assert(testingDoc.includes("dogfooding/context-pack-formal-local-release-closeout-draft-v2.6.36.md"), "Testing docs must link v2.6.36 formal local release closeout draft");
  assertIncludesPhrase(testingDoc, "drafts the formal local release closeout text for the Context Pack Lite v2.6.x local bundle", "Testing docs must summarize v2.6.36 closeout draft");
  assert(testingDoc.includes("first-run discoverability") && testingDoc.includes("runnable examples") && testingDoc.includes("receiver-facing Context Pack wording"), "Testing docs must summarize v2.6.36 public story");
  assert(testingDoc.includes("release_check_status: passed_current_slice") && testingDoc.includes("passed_175_tests_current_slice"), "Testing docs must record v2.6.36 validation statuses");
  assert(testingDoc.includes("git_diff_check_status:") && testingDoc.includes("independent_test_files=3"), "Testing docs must record v2.6.36 diff-check and independent files");
  assertIncludesPhrase(testingDoc, "Any actual publication action still requires separate explicit confirmation", "Testing docs must keep v2.6.36 publication separately confirmed");
  assertIncludesPhrase(testingDoc, "does not add a CLI command, change package scripts, change release-check output", "Testing docs must preserve v2.6.36 command and output boundaries");
  assert(testingDoc.includes("v2.6.37 Context Pack Release Closeout Review Packet"), "Testing docs must document v2.6.37 release closeout review packet");
  assert(testingDoc.includes("dogfooding/context-pack-release-closeout-review-packet-v2.6.37.md"), "Testing docs must link v2.6.37 release closeout review packet");
  assertIncludesPhrase(testingDoc, "prepares a local review packet for the Context Pack Lite v2.6.x release closeout", "Testing docs must summarize v2.6.37 review packet");
  assertIncludesPhrase(testingDoc, "release story, validation evidence, protected boundaries, and remaining external actions", "Testing docs must summarize v2.6.37 packet sections");
  assert(testingDoc.includes("first-run discoverability") && testingDoc.includes("runnable examples") && testingDoc.includes("receiver-facing Context Pack wording"), "Testing docs must summarize v2.6.37 public story");
  assert(testingDoc.includes("release_check_status: passed_current_slice") && testingDoc.includes("passed_175_tests_current_slice"), "Testing docs must record v2.6.37 validation statuses");
  assert(testingDoc.includes("git_diff_check_status:") && testingDoc.includes("independent_test_files=3"), "Testing docs must record v2.6.37 diff-check and independent files");
  assertIncludesPhrase(testingDoc, "Any actual publication action still requires separate explicit confirmation", "Testing docs must keep v2.6.37 publication separately confirmed");
  assertIncludesPhrase(testingDoc, "does not add a CLI command, change package scripts, change release-check output", "Testing docs must preserve v2.6.37 command and output boundaries");
  assert(testingDoc.includes("v2.7.0 Context Pack Human Next-Step Hints Plan"), "Testing docs must document v2.7.0 human next-step hints plan");
  assert(testingDoc.includes("releases/v2.7.0-plan.md"), "Testing docs must link v2.7.0 plan");
  assertIncludesPhrase(testingDoc, "narrow human-output usability line after the v2.6.x local closeout review packet", "Testing docs must summarize v2.7.0 scope");
  assertIncludesPhrase(testingDoc, "non-JSON CLI output for `context-pack`, `check`, `export`, and `doctor`", "Testing docs must name v2.7.0 human output targets");
  assertIncludesPhrase(testingDoc, "hints are guidance text only", "Testing docs must keep v2.7.0 hints as guidance text only");
  assertIncludesPhrase(testingDoc, "preserves `--json` output shape, command exit semantics", "Testing docs must preserve v2.7.0 JSON and exit semantics");
  assertIncludesPhrase(testingDoc, "does not add Status, Workflow Runner", "Testing docs must reject v2.7.0 status and runner scope");
  assert(testingDoc.includes("Continuation Harness Lite"), "Testing docs must reject v2.7.0 harness scope");
  assert(testingDoc.includes("Provider-free release checks must continue to print") && testingDoc.includes("provider_probe_status=skipped"), "Testing docs must preserve v2.7.0 skipped provider gate");
  assert(testingDoc.includes("v2.7.0 Context Pack Human Next-Step Hints Local Closeout"), "Testing docs must document v2.7.0 human next-step hints closeout");
  assert(testingDoc.includes("releases/v2.7.0.md"), "Testing docs must link v2.7.0 closeout");
  assertIncludesPhrase(testingDoc, "adds `next_step=` guidance to existing non-JSON CLI output for `context-pack`, `check`, `export`, and `doctor`", "Testing docs must summarize v2.7.0 implemented hints");
  assert(testingDoc.includes("optional_next_step="), "Testing docs must mention v2.7.0 optional next-step hints");
  assertIncludesPhrase(testingDoc, "human output contains the new hints and that `--json` output does not gain a `next_step` field", "Testing docs must preserve v2.7.0 human-only JSON boundary");
  assertIncludesPhrase(testingDoc, "node --test tests/context-pack.test.js --test-name-pattern \"Context Pack|Export|Doctor\"", "Testing docs must record v2.7.0 focused test command");
  assert(testingDoc.includes("v2.7.1 Context Pack Human Next-Step Hints Dogfooding"), "Testing docs must document v2.7.1 human next-step hints dogfooding");
  assert(testingDoc.includes("dogfooding/context-pack-human-next-step-hints-dogfooding-v2.7.1.md"), "Testing docs must link v2.7.1 dogfooding");
  assertIncludesPhrase(testingDoc, "export -> check", "Testing docs must document v2.7.1 export check path");
  assertIncludesPhrase(testingDoc, "should not suggest `resume --input <export-dir>` or `doctor --context-pack <export-dir>`", "Testing docs must record v2.7.1 misleading hint repair");
  assertIncludesPhrase(testingDoc, "narrows human `check` hints by input kind", "Testing docs must summarize v2.7.1 input-kind repair");
  assertIncludesPhrase(testingDoc, "hidden input-kind helper does not appear in `--json` output", "Testing docs must preserve v2.7.1 JSON boundary");
  assert(testingDoc.includes("checker_error_propagation_status: pass"), "Testing docs must record checker-error propagation");
  assert(testingDoc.includes("context-pack --repo <target-repo>"), "Testing docs must document context-pack command");
  assert(testingDoc.includes("resume --input <context-pack-dir>"), "Testing docs must document resume command");
  assert(testingDoc.includes("context-pack.md"), "Testing docs must mention context-pack.md");
  assert(testingDoc.includes("context.json"), "Testing docs must mention context.json");
  assert(testingDoc.includes("../examples/context-pack-lite/README.md"), "Testing docs must link context pack example kit");
  assert(testingDoc.includes("dogfooding/context-pack-lite-fresh-receiver-v2.0.0.md"), "Testing docs must link context pack dogfooding");
  assert(testingDoc.includes("dogfooding/context-pack-check-acceptance-v2.1.0.md"), "Testing docs must link v2.1 context pack check dogfooding");
  assert(testingDoc.includes("context-pack.too-thick"), "Testing docs must mention the context pack thickness warning");
  assert(docsIndex.includes("roadmap/basebrief-v2-context-pack-lite.md"), "Docs index must link v2 context pack roadmap");
  assert(docsIndex.includes("releases/v2.0.0-plan.md"), "Docs index must link v2.0.0 context pack plan");
  assert(docsIndex.includes("releases/v2.0.0.md"), "Docs index must link v2.0.0 context pack closeout");
  assert(docsIndex.includes("releases/v2.1.0.md"), "Docs index must link v2.1.0 context pack check closeout");
  assert(docsIndex.includes("releases/v2.2.0-plan.md"), "Docs index must link v2.2.0 resume plan");
  assert(docsIndex.includes("releases/v2.2.0.md"), "Docs index must link v2.2.0 resume closeout");
  assert(docsIndex.includes("releases/v2.3.0-plan.md"), "Docs index must link v2.3.0 format plan");
  assert(docsIndex.includes("releases/v2.4.0-plan.md"), "Docs index must link v2.4.0 file-only export plan");
  assert(docsIndex.includes("releases/v2.4.0.md"), "Docs index must link v2.4.0 file-only export closeout");
  assert(docsIndex.includes("dogfooding/file-only-export-v2.4.0.md"), "Docs index must link v2.4.0 file-only export dogfooding");
  assert(docsIndex.includes("../examples/file-only-export/README.md"), "Docs index must link file-only export example kit");
  assert(docsIndex.includes("releases/v2.5.0-plan.md"), "Docs index must link v2.5.0 doctor plan");
  assert(docsIndex.includes("releases/v2.5.0.md"), "Docs index must link v2.5.0 doctor closeout");
  assert(docsIndex.includes("releases/v2.6.0.md"), "Docs index must link v2.6.0 adoption polish closeout");
  assert(docsIndex.includes("releases/v2.7.0-plan.md"), "Docs index must link v2.7.0 human next-step hints plan");
  assert(docsIndex.includes("releases/v2.7.0.md"), "Docs index must link v2.7.0 human next-step hints closeout");
  assert(docsIndex.includes("dogfooding/context-pack-human-next-step-hints-dogfooding-v2.7.1.md"), "Docs index must link v2.7.1 human next-step hints dogfooding");
  assert(docsIndex.includes("specs/context-pack-doctor.md"), "Docs index must link context pack doctor spec");
  assert(docsIndex.includes("dogfooding/context-pack-doctor-v2.5.0.md"), "Docs index must link v2.5.0 doctor dogfooding");
  assert(docsIndex.includes("../examples/context-pack-doctor/README.md"), "Docs index must link context pack doctor example kit");
  assert(docsIndex.includes("dogfooding/context-pack-adoption-notes-v2.6.1.md"), "Docs index must link v2.6.1 adoption notes");
  assert(docsIndex.includes("dogfooding/context-engineering-reference-notes-v2.6.4.md"), "Docs index must link v2.6.4 reference notes");
  assert(docsIndex.includes("dogfooding/context-pack-adoption-scenario-matrix-v2.6.5.md"), "Docs index must link v2.6.5 scenario matrix");
  assert(docsIndex.includes("dogfooding/context-pack-first-run-fixture-lab-v2.6.6.md"), "Docs index must link v2.6.6 fixture lab");
  assert(docsIndex.includes("dogfooding/context-pack-first-run-rehearsal-audit-v2.6.7.md"), "Docs index must link v2.6.7 rehearsal audit");
  assert(docsIndex.includes("dogfooding/context-pack-first-run-friction-repair-v2.6.8.md"), "Docs index must link v2.6.8 friction repair");
  assert(docsIndex.includes("dogfooding/context-pack-adoption-decision-checkpoint-v2.6.9.md"), "Docs index must link v2.6.9 decision checkpoint");
  assert(docsIndex.includes("dogfooding/context-pack-pre-release-bundle-audit-v2.6.10.md"), "Docs index must link v2.6.10 bundle audit");
  assert(docsIndex.includes("dogfooding/context-pack-feature-feasibility-spike-v2.6.11.md"), "Docs index must link v2.6.11 feasibility spike");
  assert(docsIndex.includes("dogfooding/context-pack-local-bundle-review-rehearsal-v2.6.12.md"), "Docs index must link v2.6.12 bundle review rehearsal");
  assert(docsIndex.includes("dogfooding/context-pack-local-bundle-compression-v2.6.13.md"), "Docs index must link v2.6.13 bundle compression");
  assert(docsIndex.includes("dogfooding/context-pack-release-check-maintainability-v2.6.14.md"), "Docs index must link v2.6.14 release-check maintainability");
  assert(docsIndex.includes("dogfooding/context-pack-major-release-candidate-shape-v2.6.15.md"), "Docs index must link v2.6.15 major-release candidate shape");
  assert(docsIndex.includes("dogfooding/context-pack-continuation-harness-decision-spec-v2.6.16.md"), "Docs index must link v2.6.16 harness decision spec");
  assert(docsIndex.includes("dogfooding/context-pack-ahead14-bundle-review-v2.6.17.md"), "Docs index must link v2.6.17 ahead-14 bundle review");
  assert(docsIndex.includes("dogfooding/context-pack-minimal-feature-candidate-decision-v2.6.18.md"), "Docs index must link v2.6.18 minimal feature candidate decision");
  assert(docsIndex.includes("dogfooding/context-pack-first-run-handoff-validation.md"), "Docs index must link first-run handoff validation");
  assert(docsIndex.includes("dogfooding/context-pack-continuation-harness-lite-design-sketch.md"), "Docs index must link harness lite design sketch");
  assert(docsIndex.includes("dogfooding/context-pack-continuation-harness-lite-paper-rehearsal.md"), "Docs index must link harness lite paper rehearsal");
  assert(docsIndex.includes("dogfooding/context-pack-local-bundle-compression-v2.6.20.md"), "Docs index must link v2.6.20 bundle compression");
  assert(docsIndex.includes("dogfooding/context-pack-implementation-gate-decision-v2.6.21.md"), "Docs index must link v2.6.21 implementation gate decision");
  assert(docsIndex.includes("dogfooding/context-pack-release-check-maintainability-plan-v2.6.22.md"), "Docs index must link v2.6.22 release-check maintainability plan");
  assert(docsIndex.includes("dogfooding/context-pack-runnable-recipes-plan-v2.6.23.md"), "Docs index must link v2.6.23 runnable recipes plan");
  assert(docsIndex.includes("dogfooding/context-pack-first-run-smoke-path-consolidation-v2.6.24.md"), "Docs index must link v2.6.24 first-run smoke path consolidation");
  assert(docsIndex.includes("dogfooding/context-pack-output-ux-polish-v2.6.25.md"), "Docs index must link v2.6.25 output UX polish");
  assert(docsIndex.includes("dogfooding/context-pack-test-file-split-plan-v2.6.26.md"), "Docs index must link v2.6.26 test-file split plan");
  assert(docsIndex.includes("dogfooding/context-pack-test-file-split-v2.6.27.md"), "Docs index must link v2.6.27 test-file split");
  assert(docsIndex.includes("dogfooding/context-pack-test-file-split-second-candidate-v2.6.28.md"), "Docs index must link v2.6.28 second split candidate");
  assert(docsIndex.includes("dogfooding/context-pack-cache-ready-benchmark-test-split-v2.6.29.md"), "Docs index must link v2.6.29 cache-ready benchmark test split");
  assert(docsIndex.includes("dogfooding/context-pack-test-split-stability-check-v2.6.30.md"), "Docs index must link v2.6.30 test split stability check");
  assert(docsIndex.includes("dogfooding/context-pack-v2.6x-local-closeout-gate-v2.6.31.md"), "Docs index must link v2.6.31 local closeout gate");
  assert(docsIndex.includes("dogfooding/context-pack-release-candidate-decision-v2.6.32.md"), "Docs index must link v2.6.32 release-candidate direction decision");
  assert(docsIndex.includes("dogfooding/context-pack-release-candidate-summary-draft-v2.6.33.md"), "Docs index must link v2.6.33 release-candidate summary draft");
  assert(docsIndex.includes("dogfooding/context-pack-release-closeout-go-no-go-plan-v2.6.34.md"), "Docs index must link v2.6.34 release closeout go/no-go plan");
  assert(docsIndex.includes("dogfooding/context-pack-release-closeout-prep-draft-v2.6.35.md"), "Docs index must link v2.6.35 release closeout prep draft");
  assert(docsIndex.includes("dogfooding/context-pack-formal-local-release-closeout-draft-v2.6.36.md"), "Docs index must link v2.6.36 formal local release closeout draft");
  assert(docsIndex.includes("dogfooding/context-pack-release-closeout-review-packet-v2.6.37.md"), "Docs index must link v2.6.37 release closeout review packet");
  assert(docsIndex.includes("specs/context-pack-lite.md"), "Docs index must link context pack lite spec");
  assert(docsIndex.includes("specs/context-pack-resume.md"), "Docs index must link context pack resume spec");
  assert(docsIndex.includes("specs/basebrief-format.md"), "Docs index must link basebrief format spec");
  assert(docsIndex.includes("specs/file-only-export.md"), "Docs index must link file-only export spec");
  assert(docsIndex.includes("dogfooding/context-pack-lite-fresh-receiver-v2.0.0.md"), "Docs index must link context pack dogfooding");
  assert(docsIndex.includes("dogfooding/context-pack-check-acceptance-v2.1.0.md"), "Docs index must link v2.1 context pack check dogfooding");
  assert(docsIndex.includes("dogfooding/context-pack-resume-v2.2.0.md"), "Docs index must link v2.2 resume dogfooding");
  assert(docsIndex.includes("../examples/context-pack-lite/README.md"), "Docs index must link context pack example kit");
  assert(v2ContextPackRoadmapDoc.includes("BaseBrief v2.0 is Context Pack Lite"), "v2 roadmap must freeze Context Pack Lite direction");
  assert(v2ContextPackRoadmapDoc.includes("v1.x answers: what changed"), "v2 roadmap must define relationship to v1.x");
  assert(v2ContextPackRoadmapDoc.includes("v2.0 Context Pack Lite"), "v2 roadmap must order Context Pack Lite before later work");
  assert(v2ContextPackRoadmapDoc.includes("v2.1 Context Pack Check"), "v2 roadmap must keep check as later line");
  assert(v2ContextPackRoadmapDoc.includes("v2.2 One-command Resume / New-window Prompt"), "v2 roadmap must make one-command resume the v2.2 line");
  assert(v2ContextPackRoadmapDoc.includes("resume --input <context-pack-dir>"), "v2 roadmap must freeze resume command shape");
  assert(v2ContextPackRoadmapDoc.includes("docs/specs/context-pack-resume.md"), "v2 roadmap must link resume spec");
  assert(v2ContextPackRoadmapDoc.includes("v2.3 BaseBrief Format"), "v2 roadmap must reserve BaseBrief Format for v2.3");
  assert(v2ContextPackRoadmapDoc.includes("context-pack.md"), "v2 roadmap must define context-pack.md");
  assert(v2ContextPackRoadmapDoc.includes("context.json"), "v2 roadmap must define context.json");
  assert(v2ContextPackRoadmapDoc.includes("docs/releases/v2.3.0-plan.md"), "v2 roadmap must link v2.3 plan");
  assert(v2ContextPackRoadmapDoc.includes("docs/specs/basebrief-format.md"), "v2 roadmap must link v2.3 spec");
  assert(v2ContextPackRoadmapDoc.includes("v2.4 File-only Adapter / MCP-friendly Export"), "v2 roadmap must reserve file-only export for v2.4");
  assert(v2ContextPackRoadmapDoc.includes("docs/releases/v2.4.0-plan.md"), "v2 roadmap must link v2.4 plan");
  assert(v2ContextPackRoadmapDoc.includes("docs/releases/v2.4.0.md"), "v2 roadmap must link v2.4 closeout");
  assert(v2ContextPackRoadmapDoc.includes("docs/specs/file-only-export.md"), "v2 roadmap must link file-only export spec");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/file-only-export-v2.4.0.md"), "v2 roadmap must link v2.4 dogfooding");
  assert(v2ContextPackRoadmapDoc.includes("v2.4-C is dogfooding evidence"), "v2 roadmap must name v2.4-C dogfooding");
  assert(v2ContextPackRoadmapDoc.includes("v2.4-D is example-kit and contract-wording polish"), "v2 roadmap must name v2.4-D example polish");
  assert(v2ContextPackRoadmapDoc.includes("examples/file-only-export/"), "v2 roadmap must link file-only export example kit");
  assert(v2ContextPackRoadmapDoc.includes("not an auto-created nested directory"), "v2 roadmap must clarify export directory naming");
  assert(v2ContextPackRoadmapDoc.includes("v2.5 Context Pack Doctor"), "v2 roadmap must reserve doctor for v2.5");
  assert(v2ContextPackRoadmapDoc.includes("docs/releases/v2.5.0-plan.md"), "v2 roadmap must link v2.5 plan");
  assert(v2ContextPackRoadmapDoc.includes("docs/releases/v2.5.0.md"), "v2 roadmap must link v2.5 closeout");
  assert(v2ContextPackRoadmapDoc.includes("docs/specs/context-pack-doctor.md"), "v2 roadmap must link doctor spec");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-doctor-v2.5.0.md"), "v2 roadmap must link doctor dogfooding");
  assert(v2ContextPackRoadmapDoc.includes("examples/context-pack-doctor/"), "v2 roadmap must link doctor example kit");
  assert(v2ContextPackRoadmapDoc.includes("state-status` already"), "v2 roadmap must explain why doctor precedes broader status");
  assert(v2ContextPackRoadmapDoc.includes("basebrief-doctor-v1"), "v2 roadmap must name doctor contract version");
  assert(v2ContextPackRoadmapDoc.includes("v2.6 First-Run / Adoption Polish"), "v2 roadmap must name v2.6 adoption polish");
  assert(v2ContextPackRoadmapDoc.includes("docs/releases/v2.6.0.md"), "v2 roadmap must link v2.6 closeout");
  assert(v2ContextPackRoadmapDoc.includes("It is adoption polish only"), "v2 roadmap must scope v2.6 as adoption polish");
  assert(v2ContextPackRoadmapDoc.includes("does not add a command"), "v2 roadmap must keep v2.6 out of command scope");
  assert(v2ContextPackRoadmapDoc.includes("v2.6.x Local Adoption Notes"), "v2 roadmap must name v2.6.1 adoption notes");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-adoption-notes-v2.6.1.md"), "v2 roadmap must link v2.6.1 adoption notes");
  assert(v2ContextPackRoadmapDoc.includes("blocking`, `confusing`, or `nice-to-have`"), "v2 roadmap must preserve v2.6.x friction classification");
  assert(v2ContextPackRoadmapDoc.includes("command or contract line"), "v2 roadmap must keep v2.6.x out of command and contract scope");
  assert(v2ContextPackRoadmapDoc.includes("v2.6.4 External Reference Alignment"), "v2 roadmap must document v2.6.4 reference alignment");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-engineering-reference-notes-v2.6.4.md"), "v2 roadmap must link v2.6.4 reference notes");
  assert(v2ContextPackRoadmapDoc.includes("context engineering") && v2ContextPackRoadmapDoc.includes("handoff artifact") && v2ContextPackRoadmapDoc.includes("memory hygiene") && v2ContextPackRoadmapDoc.includes("stateless reducer") && v2ContextPackRoadmapDoc.includes("context compression"), "v2 roadmap must summarize v2.6.4 reference themes");
  assert(v2ContextPackRoadmapDoc.includes("not a new feature line or contract"), "v2 roadmap must keep v2.6.4 out of feature and contract scope");
  assert(v2ContextPackRoadmapDoc.includes("wait until repeated real adoption friction"), "v2 roadmap must keep v3 behind repeated friction");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-adoption-scenario-matrix-v2.6.5.md"), "v2 roadmap must link v2.6.5 scenario matrix");
  assert(v2ContextPackRoadmapDoc.includes("check/resume/doctor decision matrix"), "v2 roadmap must describe v2.6.5 matrix purpose");
  assert(v2ContextPackRoadmapDoc.includes("adoption") && v2ContextPackRoadmapDoc.includes("evidence") && v2ContextPackRoadmapDoc.includes("not a new command line"), "v2 roadmap must keep v2.6.5 out of command scope");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-first-run-fixture-lab-v2.6.6.md"), "v2 roadmap must link v2.6.6 fixture lab");
  assert(v2ContextPackRoadmapDoc.includes("first-run fixture-reading lab"), "v2 roadmap must describe v2.6.6 fixture lab purpose");
  assert(v2ContextPackRoadmapDoc.includes("not new fixture generation") && v2ContextPackRoadmapDoc.includes("not a JSON contract change"), "v2 roadmap must keep v2.6.6 out of fixture-generation and contract scope");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-first-run-rehearsal-audit-v2.6.7.md"), "v2 roadmap must link v2.6.7 rehearsal audit");
  assert(v2ContextPackRoadmapDoc.includes("real first-run rehearsal through README, quickstart, minimal examples"), "v2 roadmap must summarize v2.6.7 rehearsal route");
  assert(v2ContextPackRoadmapDoc.includes("no blocking friction was found"), "v2 roadmap must record v2.6.7 blocking result");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-first-run-friction-repair-v2.6.8.md"), "v2 roadmap must link v2.6.8 friction repair");
  assert(v2ContextPackRoadmapDoc.includes("quickstart route") && v2ContextPackRoadmapDoc.includes("Windows/PowerShell UTF-8 display handling"), "v2 roadmap must summarize v2.6.8 repair coverage");
  assert(v2ContextPackRoadmapDoc.includes("docs/examples") && v2ContextPackRoadmapDoc.includes("polish only"), "v2 roadmap must keep v2.6.8 in adoption polish scope");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-adoption-decision-checkpoint-v2.6.9.md"), "v2 roadmap must link v2.6.9 decision checkpoint");
  assert(v2ContextPackRoadmapDoc.includes("continue v2.6.x local adoption") && v2ContextPackRoadmapDoc.includes("Current evidence does not justify Status"), "v2 roadmap must summarize v2.6.9 decision");
  assert(v2ContextPackRoadmapDoc.includes("v3 Continuation Harness") && v2ContextPackRoadmapDoc.includes("new public fixture generation"), "v2 roadmap must keep v2.6.9 feature gates closed");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-pre-release-bundle-audit-v2.6.10.md"), "v2 roadmap must link v2.6.10 bundle audit");
  assert(v2ContextPackRoadmapDoc.includes("ahead-7 local adoption bundle") && v2ContextPackRoadmapDoc.includes("not a release closeout"), "v2 roadmap must summarize v2.6.10 bundle audit");
  assert(v2ContextPackRoadmapDoc.includes("docs/examples/release-check/adoption polish only") && v2ContextPackRoadmapDoc.includes("not a release closeout, feature implementation, CLI behavior change"), "v2 roadmap must keep v2.6.10 out of behavior scope");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-feature-feasibility-spike-v2.6.11.md"), "v2 roadmap must link v2.6.11 feasibility spike");
  assert(v2ContextPackRoadmapDoc.includes("Continuation Harness Lite") && v2ContextPackRoadmapDoc.includes("implementation_status: not_started"), "v2 roadmap must keep v2.6.11 not started");
  assert(v2ContextPackRoadmapDoc.includes("context-pack -> check -> resume -> live recheck") && v2ContextPackRoadmapDoc.includes("not a feature implementation, new command, Status command, Workflow Runner, or JSON contract change"), "v2 roadmap must keep v2.6.11 in feasibility scope");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-local-bundle-review-rehearsal-v2.6.12.md"), "v2 roadmap must link v2.6.12 bundle review rehearsal");
  assert(v2ContextPackRoadmapDoc.includes("ahead-9 local adoption bundle") && v2ContextPackRoadmapDoc.includes("check_status: passed") && v2ContextPackRoadmapDoc.includes("resume_status: ready"), "v2 roadmap must summarize v2.6.12 rehearsal results");
  assert(v2ContextPackRoadmapDoc.includes("doctor_info_findings: doctor.live-recheck-required") && v2ContextPackRoadmapDoc.includes("Continuation Harness Lite, Status, Workflow Runner, and JSON contract changes"), "v2 roadmap must keep v2.6.12 feature gates closed");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-local-bundle-compression-v2.6.13.md"), "v2 roadmap must link v2.6.13 bundle compression");
  assert(v2ContextPackRoadmapDoc.includes("ahead-10 local adoption bundle") && v2ContextPackRoadmapDoc.includes("future major-release candidate"), "v2 roadmap must summarize v2.6.13 compression");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "not a release closeout, feature implementation, new command", "v2 roadmap must keep v2.6.13 out of release and command scope");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "Continuation Harness implementation, or JSON contract change", "v2 roadmap must keep v2.6.13 out of harness and JSON scope");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-release-check-maintainability-v2.6.14.md"), "v2 roadmap must link v2.6.14 release-check maintainability");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "release-check fragility by adding whitespace-normalized phrase matching", "v2 roadmap must summarize v2.6.14 normalized matching");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "not a command, feature implementation, Status command, Workflow Runner, or JSON contract change", "v2 roadmap must keep v2.6.14 out of behavior scope");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-major-release-candidate-shape-v2.6.15.md"), "v2 roadmap must link v2.6.15 major-release candidate shape");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "future major-release candidate outline", "v2 roadmap must summarize v2.6.15 candidate shape");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "not a release closeout, publish action, feature implementation", "v2 roadmap must keep v2.6.15 out of release scope");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "Continuation Harness implementation, or JSON contract change", "v2 roadmap must keep v2.6.15 out of harness and JSON scope");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-continuation-harness-decision-spec-v2.6.16.md"), "v2 roadmap must link v2.6.16 harness decision spec");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "defines the evidence thresholds for considering Continuation Harness Lite", "v2 roadmap must summarize v2.6.16 evidence thresholds");
  assert(v2ContextPackRoadmapDoc.includes("implementation_status: not_started"), "v2 roadmap must keep v2.6.16 implementation not started");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "does not add a command, Status command, Workflow Runner", "v2 roadmap must keep v2.6.16 out of command and runner scope");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "provider request, runtime integration, MCP server/tools, plugin, schema-v2, hosted memory, or JSON contract change", "v2 roadmap must keep v2.6.16 out of integration and JSON scope");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-ahead14-bundle-review-v2.6.17.md"), "v2 roadmap must link v2.6.17 ahead-14 bundle review");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "ahead-14 local adoption bundle", "v2 roadmap must summarize v2.6.17 ahead-14 bundle");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "release-note candidates, dogfooding-only evidence, and future feature gates", "v2 roadmap must summarize v2.6.17 three-way split");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "not a release closeout, push/tag/release action, feature implementation", "v2 roadmap must keep v2.6.17 out of release and feature scope");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "Continuation Harness implementation, Status command, Workflow Runner, or JSON contract change", "v2 roadmap must keep v2.6.17 out of behavior scope");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-minimal-feature-candidate-decision-v2.6.18.md"), "v2 roadmap must link v2.6.18 minimal feature candidate decision");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "Continuation Harness Lite as a design-sketch candidate only", "v2 roadmap must keep v2.6.18 harness as design sketch only");
  assert(v2ContextPackRoadmapDoc.includes("rejects") && v2ContextPackRoadmapDoc.includes("Status") && v2ContextPackRoadmapDoc.includes("Workflow Runner") && v2ContextPackRoadmapDoc.includes("Doctor expansion") && v2ContextPackRoadmapDoc.includes("JSON contract changes for now"), "v2 roadmap must summarize v2.6.18 rejected candidates");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "requires repeated real handoff friction before any implementation", "v2 roadmap must keep v2.6.18 evidence-gated");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "does not add a command, provider request, runtime integration", "v2 roadmap must keep v2.6.18 out of command and integration scope");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-first-run-handoff-validation.md"), "v2 roadmap must link first-run handoff validation");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "context-pack -> check -> resume -> doctor", "v2 roadmap must summarize first-run validation path");
  assert(v2ContextPackRoadmapDoc.includes("clean `check`") && v2ContextPackRoadmapDoc.includes("Continuation rules:") && v2ContextPackRoadmapDoc.includes("basebrief-doctor-v1") && v2ContextPackRoadmapDoc.includes("doctor.live-recheck-required"), "v2 roadmap must summarize first-run validation results");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "did not meet the feature trigger for Continuation Harness Lite, Status, Workflow Runner, or JSON contract changes", "v2 roadmap must keep first-run validation out of feature scope");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-continuation-harness-lite-design-sketch.md"), "v2 roadmap must link harness lite design sketch");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "paper Continuation Harness Lite sketch only", "v2 roadmap must keep harness lite design sketch paper-only");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "five-step human flow", "v2 roadmap must summarize harness lite flow");
  assert(v2ContextPackRoadmapDoc.includes("pack_missing") && v2ContextPackRoadmapDoc.includes("user_goal_required"), "v2 roadmap must summarize harness lite state machine");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "command_status: not_started, implementation_status: not_started", "v2 roadmap must keep harness lite command and implementation not started");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "Status, Workflow Runner, provider/runtime/MCP/plugin/schema-v2/hosted-memory scope, and JSON contract changes closed", "v2 roadmap must keep harness lite out of behavior and integration scope");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-continuation-harness-lite-paper-rehearsal.md"), "v2 roadmap must link harness lite paper rehearsal");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "rehearses the sketch against clean pack, too-thick warning, broken pack, stale/live drift, and missing pack scenarios", "v2 roadmap must summarize harness lite paper rehearsal scenarios");
  assert(v2ContextPackRoadmapDoc.includes("check_passed + live_match -> resume_ready -> user_goal_required"), "v2 roadmap must include harness lite clean-pack transition");
  assert(v2ContextPackRoadmapDoc.includes("check_warning -> human_review"), "v2 roadmap must include harness lite warning transition");
  assert(v2ContextPackRoadmapDoc.includes("check_failed -> repair_pack"), "v2 roadmap must include harness lite broken transition");
  assert(v2ContextPackRoadmapDoc.includes("check_passed + live_drift -> doctor_or_refresh"), "v2 roadmap must include harness lite drift transition");
  assert(v2ContextPackRoadmapDoc.includes("pack_missing -> blocked"), "v2 roadmap must include harness lite missing-pack transition");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "does not trigger implementation and keeps implementation_status: not_started, command_status: not_started", "v2 roadmap must keep harness lite paper rehearsal not started");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-local-bundle-compression-v2.6.20.md"), "v2 roadmap must link v2.6.20 bundle compression");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "ahead-19 local adoption and design bundle", "v2 roadmap must summarize v2.6.20 ahead-19 bundle");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "future release-note candidates, dogfooding-only evidence, release-check / contract protections, and feature gates / deferred candidates", "v2 roadmap must summarize v2.6.20 categories");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "not a release closeout, push/tag/release action, PR, feature implementation, new command", "v2 roadmap must keep v2.6.20 out of release and command scope");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-implementation-gate-decision-v2.6.21.md"), "v2 roadmap must link v2.6.21 implementation gate decision");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "closes the implementation gate for now", "v2 roadmap must summarize v2.6.21 gate decision");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "does not show repeated real blocking or high-frequency confusing friction", "v2 roadmap must keep v2.6.21 evidence below implementation threshold");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "no new CLI command, no JSON shape change, no Status, no Workflow Runner, no Doctor expansion", "v2 roadmap must keep v2.6.21 out of new behavior scope");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-release-check-maintainability-plan-v2.6.22.md"), "v2 roadmap must link v2.6.22 release-check maintainability plan");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "selects release-check maintainability modularization as the next near-term direction", "v2 roadmap must summarize v2.6.22 near-term direction");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "v2.x dogfooding/documentation assertion cluster inside `scripts/run_release_checks.js`", "v2 roadmap must summarize v2.6.22 first slice");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "keeps release-check output unchanged", "v2 roadmap must preserve release-check output for v2.6.22");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "does not add a command, change JSON contracts, start CI", "v2 roadmap must keep v2.6.22 out of behavior and CI scope");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-runnable-recipes-plan-v2.6.23.md"), "v2 roadmap must link v2.6.23 runnable recipes plan");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "selects examples as runnable recipes as the next small usability direction", "v2 roadmap must summarize v2.6.23 direction");
  assert(v2ContextPackRoadmapDoc.includes("README -> quickstart -> examples/minimal"), "v2 roadmap must summarize minimal recipe path");
  assert(v2ContextPackRoadmapDoc.includes("context-pack -> check -> resume -> doctor"), "v2 roadmap must summarize Context Pack recipe path");
  assert(v2ContextPackRoadmapDoc.includes("check -> doctor"), "v2 roadmap must summarize doctor recipe path");
  assert(v2ContextPackRoadmapDoc.includes("check -> export"), "v2 roadmap must summarize export recipe path");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "does not add a command, change package scripts, change release-check output", "v2 roadmap must preserve v2.6.23 command and output boundaries");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "alter the Context Pack seven-file structure", "v2 roadmap must preserve Context Pack structure for v2.6.23");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-first-run-smoke-path-consolidation-v2.6.24.md"), "v2 roadmap must link v2.6.24 first-run smoke path consolidation");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "consolidates the canonical first-run smoke path after the runnable recipe pass", "v2 roadmap must summarize v2.6.24 direction");
  assert(v2ContextPackRoadmapDoc.includes("README -> docs/index.md -> docs/quickstart-5min.md -> examples/minimal"), "v2 roadmap must summarize v2.6.24 first-run path");
  assert(v2ContextPackRoadmapDoc.includes("examples/context-pack-lite") && v2ContextPackRoadmapDoc.includes("npm run check"), "v2 roadmap must include v2.6.24 Context Pack example and validation gate");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "Doctor and File-only Export as follow-up recipes, not mandatory first-run steps", "v2 roadmap must keep v2.6.24 follow-up recipes optional");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "does not add a command, change package scripts, change release-check output", "v2 roadmap must preserve v2.6.24 command and output boundaries");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-output-ux-polish-v2.6.25.md"), "v2 roadmap must link v2.6.25 output UX polish");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "polishes generated Context Pack Lite text without changing contracts", "v2 roadmap must summarize v2.6.25 output UX direction");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "live repo facts are stale-prone and must be rechecked before edits", "v2 roadmap must summarize v2.6.25 stale-prone live facts wording");
  assert(v2ContextPackRoadmapDoc.includes("not_available") && v2ContextPackRoadmapDoc.includes("not_applicable") && v2ContextPackRoadmapDoc.includes("needs-review") && v2ContextPackRoadmapDoc.includes("missing-input semantics rather than failure states"), "v2 roadmap must summarize v2.6.25 missing-input semantics");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "separate inherited pack facts from live rechecks", "v2 roadmap must summarize v2.6.25 expected first response separation");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "does not add a command, change package scripts, change release-check output", "v2 roadmap must preserve v2.6.25 command and output boundaries");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-test-file-split-plan-v2.6.26.md"), "v2 roadmap must link v2.6.26 test-file split plan");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "plans the first safe split path for the large `tests/basebrief.test.js` file", "v2 roadmap must summarize v2.6.26 test split direction");
  assert(v2ContextPackRoadmapDoc.includes("tests/context-pack.test.js") && v2ContextPackRoadmapDoc.includes("Context Pack v2 tests"), "v2 roadmap must summarize v2.6.26 first candidate test file");
  assert(v2ContextPackRoadmapDoc.includes("cache-ready / benchmark tests") && v2ContextPackRoadmapDoc.includes("Receiver / Project State workflow tests"), "v2 roadmap must defer later v2.6.26 split clusters");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "does not split tests yet", "v2 roadmap must keep v2.6.26 planning-only");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "change package scripts, change release-check output", "v2 roadmap must preserve v2.6.26 command and output boundaries");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-test-file-split-v2.6.27.md"), "v2 roadmap must link v2.6.27 test-file split");
  assert(v2ContextPackRoadmapDoc.includes("Context Pack v2, File-only Export") && v2ContextPackRoadmapDoc.includes("tests/context-pack.test.js"), "v2 roadmap must summarize v2.6.27 moved test cluster");
  assert(v2ContextPackRoadmapDoc.includes("tests/basebrief.test.js") && v2ContextPackRoadmapDoc.includes("cache-ready, benchmark, and relay audit coverage"), "v2 roadmap must summarize v2.6.27 remaining test cluster");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "node --test tests/basebrief.test.js tests/context-pack.test.js", "v2 roadmap must document v2.6.27 npm test command");
  assert(v2ContextPackRoadmapDoc.includes("expected test count still 175") && v2ContextPackRoadmapDoc.includes("independent_test_files=2"), "v2 roadmap must document v2.6.27 test count and independent files");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "does not add a CLI command, change release-check output shape", "v2 roadmap must preserve v2.6.27 command and output boundaries");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-test-file-split-second-candidate-v2.6.28.md"), "v2 roadmap must link v2.6.28 second split candidate");
  assert(v2ContextPackRoadmapDoc.includes("tests/cache-ready-benchmark.test.js"), "v2 roadmap must name v2.6.28 second candidate file");
  assert(v2ContextPackRoadmapDoc.includes("cache-ready generators") && v2ContextPackRoadmapDoc.includes("benchmark summaries") && v2ContextPackRoadmapDoc.includes("relay usage audit"), "v2 roadmap must summarize v2.6.28 selected scope");
  assert(v2ContextPackRoadmapDoc.includes("Receiver, Project State, Sidecar") && v2ContextPackRoadmapDoc.includes("docs/release-line assertion"), "v2 roadmap must defer broader v2.6.28 clusters");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "node --test tests/basebrief.test.js tests/context-pack.test.js", "v2 roadmap must keep v2.6.28 npm test command");
  assert(v2ContextPackRoadmapDoc.includes("expected test count still 175") && v2ContextPackRoadmapDoc.includes("independent_test_files=2"), "v2 roadmap must keep v2.6.28 test count and independent files");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "does not add a CLI command, add a new test file, change package scripts", "v2 roadmap must keep v2.6.28 planning-only boundaries");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-cache-ready-benchmark-test-split-v2.6.29.md"), "v2 roadmap must link v2.6.29 cache-ready benchmark test split");
  assert(v2ContextPackRoadmapDoc.includes("tests/cache-ready-benchmark.test.js"), "v2 roadmap must name v2.6.29 split file");
  assert(v2ContextPackRoadmapDoc.includes("cache-ready generators") && v2ContextPackRoadmapDoc.includes("benchmark summaries") && v2ContextPackRoadmapDoc.includes("relay usage audit"), "v2 roadmap must summarize v2.6.29 moved scope");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "node --test tests/basebrief.test.js tests/context-pack.test.js tests/cache-ready-benchmark.test.js", "v2 roadmap must document v2.6.29 npm test command");
  assert(v2ContextPackRoadmapDoc.includes("expected test count still 175") && v2ContextPackRoadmapDoc.includes("independent_test_files=3"), "v2 roadmap must document v2.6.29 test count and independent files");
  assert(v2ContextPackRoadmapDoc.includes("Receiver, Project State, Sidecar") && v2ContextPackRoadmapDoc.includes("Context Pack v2, File-only Export, Doctor, and Resume"), "v2 roadmap must summarize v2.6.29 remaining file responsibilities");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "does not add a CLI command, change release-check output shape", "v2 roadmap must preserve v2.6.29 command and output boundaries");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-test-split-stability-check-v2.6.30.md"), "v2 roadmap must link v2.6.30 test split stability check");
  assert(v2ContextPackRoadmapDoc.includes("tests/basebrief.test.js` with 118 tests") && v2ContextPackRoadmapDoc.includes("tests/context-pack.test.js` with 11 tests") && v2ContextPackRoadmapDoc.includes("tests/cache-ready-benchmark.test.js` with 46 tests"), "v2 roadmap must document v2.6.30 test distribution");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "node --test tests/basebrief.test.js tests/context-pack.test.js tests/cache-ready-benchmark.test.js", "v2 roadmap must keep v2.6.30 npm test command");
  assert(v2ContextPackRoadmapDoc.includes("expected test count still 175") && v2ContextPackRoadmapDoc.includes("independent_test_files=3"), "v2 roadmap must keep v2.6.30 test count and independent files");
  assert(v2ContextPackRoadmapDoc.includes("Receiver, Project State, Sidecar") && v2ContextPackRoadmapDoc.includes("docs/release-line assertion splits remain deferred"), "v2 roadmap must defer broader v2.6.30 clusters");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "does not add a CLI command, add a new test file, change package scripts", "v2 roadmap must keep v2.6.30 stability-only boundaries");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-v2.6x-local-closeout-gate-v2.6.31.md"), "v2 roadmap must link v2.6.31 local closeout gate");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "closes the current local v2.6.x dogfooding and maintainability line for now", "v2 roadmap must summarize v2.6.31 closeout gate");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "cache-ready benchmark test split implementation, post-split stability check, and release-check maintainability helper refactor", "v2 roadmap must summarize completed v2.6.31 recommended items");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "either a v2.7 planning/implementation line or a release-candidate decision", "v2 roadmap must point v2.6.31 to next direction");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "Continuation Harness Lite remains a future candidate only", "v2 roadmap must keep v2.6.31 harness deferred");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "Status, Workflow Runner, Doctor expansion", "v2 roadmap must keep v2.6.31 behavior gates closed");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-release-candidate-decision-v2.6.32.md"), "v2 roadmap must link v2.6.32 release-candidate direction decision");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "chooses the release-candidate decision path before v2.7 implementation", "v2 roadmap must summarize v2.6.32 direction");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "ahead-28 local bundle into future release-note candidates, dogfooding-only evidence, release-check / contract protections, and deferred feature gates", "v2 roadmap must summarize v2.6.32 bundle compression");
  assert(v2ContextPackRoadmapDoc.includes("release_candidate_status: decision_ready_not_published"), "v2 roadmap must record v2.6.32 release-candidate status");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "keeps v2.7 implementation deferred until the decision explains any remaining user-facing gap", "v2 roadmap must defer v2.7 after v2.6.32 decision");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "new commands, package scripts, release-check output shape", "v2 roadmap must preserve v2.6.32 command and output boundaries");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-release-candidate-summary-draft-v2.6.33.md"), "v2 roadmap must link v2.6.33 release-candidate summary draft");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "drafts the release-candidate story without starting release closeout", "v2 roadmap must summarize v2.6.33 local draft status");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "separates a public release-note draft from dogfooding-only evidence", "v2 roadmap must summarize v2.6.33 public and dogfooding split");
  assert(v2ContextPackRoadmapDoc.includes("first-run discoverability") && v2ContextPackRoadmapDoc.includes("runnable recipes") && v2ContextPackRoadmapDoc.includes("receiver-facing Context Pack wording"), "v2 roadmap must summarize v2.6.33 public story");
  assert(v2ContextPackRoadmapDoc.includes("three independent test files") && v2ContextPackRoadmapDoc.includes("release-check assertions"), "v2 roadmap must summarize v2.6.33 validation confidence");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "release closeout prep versus a narrow v2.7 implementation plan", "v2 roadmap must preserve v2.6.33 open decision");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "no command, package script, release-check output", "v2 roadmap must preserve v2.6.33 command and output boundaries");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-release-closeout-go-no-go-plan-v2.6.34.md"), "v2 roadmap must link v2.6.34 release closeout go/no-go plan");
  assert(v2ContextPackRoadmapDoc.includes("release_closeout_go_no_go_status: go_to_release_closeout_prep"), "v2 roadmap must record v2.6.34 go/no-go result");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "public story is coherent and no concrete user-facing v2.7 gap has been found", "v2 roadmap must summarize v2.6.34 go rationale");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "convert the public release-note draft into closeout-ready wording", "v2 roadmap must summarize v2.6.34 next slice");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "publish, push, tag, release, and PR actions not_started until separately confirmed", "v2 roadmap must keep v2.6.34 release actions not started");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "No command, package script, release-check output", "v2 roadmap must preserve v2.6.34 command and output boundaries");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-release-closeout-prep-draft-v2.6.35.md"), "v2 roadmap must link v2.6.35 release closeout prep draft");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "converts the public summary draft and go/no-go decision into closeout-prep wording", "v2 roadmap must summarize v2.6.35 prep source");
  assert(v2ContextPackRoadmapDoc.includes("first-run discoverability") && v2ContextPackRoadmapDoc.includes("runnable examples") && v2ContextPackRoadmapDoc.includes("receiver-facing Context Pack wording"), "v2 roadmap must summarize v2.6.35 public story");
  assert(v2ContextPackRoadmapDoc.includes("expected current-slice results") && v2ContextPackRoadmapDoc.includes("preserved release-check metric lines"), "v2 roadmap must summarize v2.6.35 validation capture");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "publish, push, tag, release, and PR actions not_started", "v2 roadmap must keep v2.6.35 release actions not started");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "No command, package script, release-check output", "v2 roadmap must preserve v2.6.35 command and output boundaries");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-formal-local-release-closeout-draft-v2.6.36.md"), "v2 roadmap must link v2.6.36 formal local release closeout draft");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "drafts the formal local release closeout text for review", "v2 roadmap must summarize v2.6.36 closeout draft");
  assert(v2ContextPackRoadmapDoc.includes("first-run discoverability") && v2ContextPackRoadmapDoc.includes("runnable examples") && v2ContextPackRoadmapDoc.includes("receiver-facing Context Pack wording"), "v2 roadmap must summarize v2.6.36 public story");
  assert(v2ContextPackRoadmapDoc.includes("provider_probe_status=skipped") && v2ContextPackRoadmapDoc.includes("independent_test_files=3"), "v2 roadmap must preserve v2.6.36 validation metrics");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "publish, push, tag, release, and PR actions not_started", "v2 roadmap must keep v2.6.36 release actions not started");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "No command, package script, release-check output", "v2 roadmap must preserve v2.6.36 command and output boundaries");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-release-closeout-review-packet-v2.6.37.md"), "v2 roadmap must link v2.6.37 release closeout review packet");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "prepares a local release closeout review packet", "v2 roadmap must summarize v2.6.37 review packet");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "release story, validation evidence, protected boundaries, and remaining external actions", "v2 roadmap must summarize v2.6.37 packet sections");
  assert(v2ContextPackRoadmapDoc.includes("first-run discoverability") && v2ContextPackRoadmapDoc.includes("runnable examples") && v2ContextPackRoadmapDoc.includes("receiver-facing Context Pack wording"), "v2 roadmap must summarize v2.6.37 public story");
  assert(v2ContextPackRoadmapDoc.includes("provider_probe_status=skipped") && v2ContextPackRoadmapDoc.includes("independent_test_files=3"), "v2 roadmap must preserve v2.6.37 validation metrics");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "publish, push, tag, release, and PR actions not_started", "v2 roadmap must keep v2.6.37 release actions not started");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "No command, package script, release-check output", "v2 roadmap must preserve v2.6.37 command and output boundaries");
  assert(v2ContextPackRoadmapDoc.includes("v2.7 Context Pack Human Next-Step Hints"), "v2 roadmap must name v2.7 human next-step hints");
  assert(v2ContextPackRoadmapDoc.includes("docs/releases/v2.7.0-plan.md"), "v2 roadmap must link v2.7.0 plan");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "narrow human-output usability line after the v2.6.x closeout review packet", "v2 roadmap must summarize v2.7.0 scope");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "existing non-JSON CLI output for `context-pack`, `check`, `export`, and `doctor`", "v2 roadmap must name v2.7.0 human output targets");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "guidance text only", "v2 roadmap must keep v2.7.0 hints as guidance only");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "preserve `--json` output shape, command exit semantics", "v2 roadmap must preserve v2.7.0 JSON and exit semantics");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "does not add Status, Workflow Runner", "v2 roadmap must reject v2.7.0 status and runner scope");
  assert(v2ContextPackRoadmapDoc.includes("Continuation Harness Lite"), "v2 roadmap must reject v2.7.0 harness scope");
  assert(v2ContextPackRoadmapDoc.includes("docs/releases/v2.7.0.md"), "v2 roadmap must link v2.7.0 closeout");
  assert(v2ContextPackRoadmapDoc.includes("next_step=") && v2ContextPackRoadmapDoc.includes("optional_next_step="), "v2 roadmap must summarize v2.7.0 hint line prefixes");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "keeping `--json` output free of a `next_step` field", "v2 roadmap must keep v2.7.0 hints out of JSON");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "human-only `next_step=` and `optional_next_step=` hints under the existing `formatHuman()` path", "v2 roadmap must keep v2.7.0 implementation under formatHuman");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/context-pack-human-next-step-hints-dogfooding-v2.7.1.md"), "v2 roadmap must link v2.7.1 human next-step hints dogfooding");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "reality-check pass through `context-pack -> check -> resume`, `context-pack -> check -> doctor`, `export -> check`, warning-only pack, and broken pack paths", "v2 roadmap must summarize v2.7.1 dogfooding paths");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "should not suggest `resume --input <export-dir>` or `doctor --context-pack <export-dir>`", "v2 roadmap must record v2.7.1 export-check repair");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "narrows human `check` hints by input kind", "v2 roadmap must summarize v2.7.1 input-kind repair");
  assertIncludesPhrase(v2ContextPackRoadmapDoc, "preserving command surfaces, JSON contracts, Context Pack structure", "v2 roadmap must preserve v2.7.1 contract boundaries");

  assert(contextPackHumanNextStepHintsDogfoodingV271Doc.includes("Context Pack Human Next-Step Hints Dogfooding v2.7.1"), "v2.7.1 dogfooding doc must have stable title");
  assert(contextPackHumanNextStepHintsDogfoodingV271Doc.includes("context_pack_hint_status: pass"), "v2.7.1 dogfooding doc must record context-pack hint pass");
  assert(contextPackHumanNextStepHintsDogfoodingV271Doc.includes("export_check_hint_status: repaired"), "v2.7.1 dogfooding doc must record repaired export check hint");
  assert(contextPackHumanNextStepHintsDogfoodingV271Doc.includes("json_hint_leak_status: absent"), "v2.7.1 dogfooding doc must record JSON hint absence");
  assertIncludesPhrase(contextPackHumanNextStepHintsDogfoodingV271Doc, "file-only export directory is not a seven-file Context Pack Lite directory", "v2.7.1 dogfooding doc must explain export-check mismatch");
  assertIncludesPhrase(contextPackHumanNextStepHintsDogfoodingV271Doc, "The hidden input-kind helper is not serialized into `--json` output", "v2.7.1 dogfooding doc must keep input kind out of JSON");
  assertDogfoodingDocCommonBoundaries(contextPackHumanNextStepHintsDogfoodingV271Doc, "v2.7.1 human next-step hints dogfooding", { doctorExpansion: true });
  assertDogfoodingDocSharedReleaseChecks(contextPackHumanNextStepHintsDogfoodingV271Doc, "v2.7.1 human next-step hints dogfooding");

  assert(testingDoc.includes("v2.8.0 Continuation Harness Lite"), "Testing docs must document v2.8 continuation harness");
  assert(testingDoc.includes("dogfooding/continuation-harness-lite-v2.8.0.md"), "Testing docs must link v2.8 dogfooding");
  assert(testingDoc.includes("tests/continuation-harness.test.js"), "Testing docs must name continuation harness tests");
  assert(testingDoc.includes("Expected test count is 180 tests") && testingDoc.includes("independent_test_files=4"), "Testing docs must document v2.8 test count and independent files");
  assert(testingDoc.includes("v2.9.0 Project Profile / Recipes Lite"), "Testing docs must document v2.9 project profile");
  assert(testingDoc.includes("Expected test count is 185 tests") && testingDoc.includes("independent_test_files=5"), "Testing docs must document v2.9 test count and independent files");
  assert(testingDoc.includes("v2.9.1 Project Profile CWD Hint Polish"), "Testing docs must document v2.9.1 project profile polish");
  assert(testingDoc.includes("Expected test count is 186 tests") && testingDoc.includes("independent_test_files=5"), "Testing docs must document v2.9.1 test count and independent files");
  assert(docsIndex.includes("releases/v2.8.0-plan.md"), "Docs index must link v2.8 continuation harness plan");
  assert(docsIndex.includes("releases/v2.8.0.md"), "Docs index must link v2.8 continuation harness closeout");
  assert(docsIndex.includes("dogfooding/continuation-harness-lite-v2.8.0.md"), "Docs index must link v2.8 dogfooding");
  assert(docsIndex.includes("../examples/context-pack-continuation/README.md"), "Docs index must link continuation harness example kit");
  assert(docsIndex.includes("releases/v2.9.0-plan.md"), "Docs index must link v2.9 project profile plan");
  assert(docsIndex.includes("releases/v2.9.0.md"), "Docs index must link v2.9 project profile closeout");
  assert(docsIndex.includes("releases/v2.9.1.md"), "Docs index must link v2.9.1 project profile polish");
  assert(docsIndex.includes("releases/v3.0.0-plan.md"), "Docs index must link v3.0 workflow runner plan");
  assert(docsIndex.includes("../examples/project-profile-lite/README.md"), "Docs index must link project profile example kit");
  assert(testingDoc.includes("v3.0.0 Workflow Runner Lite") && testingDoc.includes("research/spec") && testingDoc.includes("v3.0-B"), "Testing docs must document v3.0 workflow runner implementation");
  assert(v2ContextPackRoadmapDoc.includes("v2.8 Continuation Harness Lite"), "v2 roadmap must name v2.8 continuation harness");
  assert(v2ContextPackRoadmapDoc.includes("docs/dogfooding/continuation-harness-lite-v2.8.0.md"), "v2 roadmap must link v2.8 dogfooding");
  assert(v2ContextPackRoadmapDoc.includes("expected test count") && v2ContextPackRoadmapDoc.includes("independent_test_files=4"), "v2 roadmap must document v2.8 validation metrics");
  assert(v2ContextPackRoadmapDoc.includes("v2.9 Project Profile / Recipes Lite"), "v2 roadmap must name v2.9 project profile");
  assert(v2ContextPackRoadmapDoc.includes("docs/releases/v2.9.0-plan.md"), "v2 roadmap must link v2.9 plan");
  assert(v2ContextPackRoadmapDoc.includes("tests/project-profile.test.js") && v2ContextPackRoadmapDoc.includes("independent_test_files=5"), "v2 roadmap must document v2.9 validation metrics");
  assert(v2ContextPackRoadmapDoc.includes("docs/releases/v2.9.1.md"), "v2 roadmap must link v2.9.1 polish");
  assert(v2ContextPackRoadmapDoc.includes("current working directory") && v2ContextPackRoadmapDoc.includes("Expected test count is 186"), "v2 roadmap must document v2.9.1 cwd hint polish");
  assert(v2ContextPackRoadmapDoc.includes("v3.0 Workflow Runner Lite Research") && v2ContextPackRoadmapDoc.includes("v3.0-B"), "v2 roadmap must name v3.0 workflow runner implementation");
  assert(v2ContextPackRoadmapDoc.includes("Project Profile -> Continue -> Context Pack -> Check -> Resume starter"), "v2 roadmap must preserve v3.0 proposed workflow chain");

  assert(v280PlanDoc.includes("v2.8.0 Continuation Harness Lite Plan"), "v2.8 plan must have stable title");
  assert(v280PlanDoc.includes("context-pack -> check -> resume"), "v2.8 plan must preserve command sequence");
  assert(v280PlanDoc.includes("node scripts/basebrief.js continue --repo <target-repo> --output-dir <dir>"), "v2.8 plan must document command shape");
  assert(v280PlanDoc.includes("CONTINUATION_REPORT.md") && v280PlanDoc.includes("continuation.meta.json") && v280PlanDoc.includes("context-pack/"), "v2.8 plan must define output shape");
  assert(v280PlanDoc.includes("ready_for_receiver") && v280PlanDoc.includes("needs_review") && v280PlanDoc.includes("blocked"), "v2.8 plan must define status semantics");
  assert(v280PlanDoc.includes("must not include the full resume") && v280PlanDoc.includes("next_step"), "v2.8 plan must keep prompt and human hints out of JSON");
  assert(v280PlanDoc.includes("clean repo -> continue -> ready_for_receiver") && v280PlanDoc.includes("dirty repo -> continue -> needs_review"), "v2.8 plan must preserve acceptance matrix");
  assertContinuationHarnessLiteBoundaries(v280PlanDoc, "v2.8 plan");

  assert(v280ReleaseDoc.includes("v2.8.0 Continuation Harness Lite Local Closeout"), "v2.8 closeout must have stable title");
  assert(v280ReleaseDoc.includes("scripts/basebrief_continuation_harness.js"), "v2.8 closeout must name harness script");
  assert(v280ReleaseDoc.includes("tests/continuation-harness.test.js"), "v2.8 closeout must name independent tests");
  assert(v280ReleaseDoc.includes("docs/dogfooding/continuation-harness-lite-v2.8.0.md"), "v2.8 closeout must link dogfooding evidence");
  assertIncludesPhrase(v280ReleaseDoc, "does not include the full resume prompt body and does not add human-only `next_step` fields", "v2.8 closeout must preserve JSON boundary");
  assertContinuationHarnessLiteBoundaries(v280ReleaseDoc, "v2.8 closeout");

  assert(continuationHarnessDogfoodingDoc.includes("Continuation Harness Lite Dogfooding v2.8.0"), "v2.8 dogfooding doc must have stable title");
  assert(continuationHarnessDogfoodingDoc.includes("continuation_status: needs_review"), "v2.8 dogfooding must record dirty-worktree needs_review");
  assert(continuationHarnessDogfoodingDoc.includes("context_pack_step: generated") && continuationHarnessDogfoodingDoc.includes("check_step: passed") && continuationHarnessDogfoodingDoc.includes("resume_step: ready"), "v2.8 dogfooding must record harness step results");
  assert(continuationHarnessDogfoodingDoc.includes("continuation_package_check_status: passed"), "v2.8 dogfooding must record package check pass");
  assert(continuationHarnessDogfoodingDoc.includes("json_prompt_leak_status: absent") && continuationHarnessDogfoodingDoc.includes("json_next_step_leak_status: absent"), "v2.8 dogfooding must record JSON leak absence");
  assert(continuationHarnessDogfoodingDoc.includes("copied_starter_private_path_status: absent") && continuationHarnessDogfoodingDoc.includes("report_private_path_status: absent") && continuationHarnessDogfoodingDoc.includes("metadata_private_path_status: absent"), "v2.8 dogfooding must record private path absence");
  assert(continuationHarnessDogfoodingDoc.includes("independent_test_files=4") && continuationHarnessDogfoodingDoc.includes("provider_probe_status=skipped"), "v2.8 dogfooding must record expected release-check metrics");
  assertContinuationHarnessLiteBoundaries(continuationHarnessDogfoodingDoc, "v2.8 dogfooding");
  assertDogfoodingDocSharedReleaseChecks(continuationHarnessDogfoodingDoc, "v2.8 dogfooding");

  assert(continuationExampleReadme.includes("Continuation Harness Lite Example Kit"), "Continuation example kit must have stable title");
  assert(continuationExampleReadme.includes("CONTINUATION_REPORT.md") && continuationExampleReadme.includes("continuation.meta.json") && continuationExampleReadme.includes("context-pack/"), "Continuation example kit must define output shape");
  assert(continuationExampleReadme.includes("ready_for_receiver") && continuationExampleReadme.includes("needs_review") && continuationExampleReadme.includes("blocked"), "Continuation example kit must define status semantics");
  assert(continuationExampleReadme.includes("inherited context, not proof"), "Continuation example kit must preserve receiver recheck rule");
  assert(continuationExampleReadme.includes("does not call providers") && continuationExampleReadme.includes("does not run a Workflow") && continuationExampleReadme.includes("does not create an MCP server"), "Continuation example kit must preserve non-goals");

  assert(basebriefCliScript.includes("runContinuationHarness"), "CLI must import continuation harness");
  assert(basebriefCliScript.includes("continue --repo <target-repo> --output-dir <dir>"), "CLI must expose continue help");
  assert(basebriefCliScript.includes('if (command === "continue") return commandContinue(options);'), "CLI must route continue command");
  assert(basebriefCliScript.includes("next_step=copy NEXT_WINDOW_STARTER.md"), "CLI human output must guide ready receiver copy");
  assert(basebriefCliScript.includes("next_step=review CONTINUATION_REPORT.md"), "CLI human output must guide needs-review status");

  assert(basebriefContinuationHarnessScript.includes("basebrief-continuation-harness-v1"), "Harness script must define v1 contract");
  assert(basebriefContinuationHarnessScript.includes("CONTINUATION_REPORT.md") && basebriefContinuationHarnessScript.includes("CHECK_SUMMARY.md") && basebriefContinuationHarnessScript.includes("continuation.meta.json"), "Harness script must define v2.8 files");
  assert(basebriefContinuationHarnessScript.includes("ready_for_receiver") && basebriefContinuationHarnessScript.includes("needs_review") && basebriefContinuationHarnessScript.includes("blocked"), "Harness script must implement status semantics");
  assert(basebriefContinuationHarnessScript.includes("safePromptForOutput"), "Harness script must normalize copied starter paths");
  assert(basebriefContinuationHarnessScript.includes("No provider request.") && basebriefContinuationHarnessScript.includes("No Workflow Runner."), "Harness script must preserve hard boundaries");

  assert(v290PlanDoc.includes("v2.9.0 Project Profile / Recipes Lite Plan"), "v2.9 plan must have stable title");
  assert(v290PlanDoc.includes("profile-init -> review profile -> continue --profile"), "v2.9 plan must preserve command sequence");
  assert(v290PlanDoc.includes("basebrief-project-profile-v1"), "v2.9 plan must define profile contract");
  assert(v290PlanDoc.includes("continuation-default") && v290PlanDoc.includes("small-delta") && v290PlanDoc.includes("review-heavy"), "v2.9 plan must define initial recipes");
  assert(v290PlanDoc.includes("Explicit `continue` CLI flags override profile defaults"), "v2.9 plan must preserve override semantics");
  assert(v290PlanDoc.includes("unsafe profile field -> rejected") && v290PlanDoc.includes("continue --repo -> unchanged from v2.8"), "v2.9 plan must preserve acceptance matrix");
  assert(v290PlanDoc.includes("No Workflow Runner") && v290PlanDoc.includes("No global config") && v290PlanDoc.includes("No secret store"), "v2.9 plan must preserve profile boundaries");

  assert(v290ReleaseDoc.includes("v2.9.0 Project Profile / Recipes Lite Local Closeout"), "v2.9 closeout must have stable title");
  assert(v290ReleaseDoc.includes("scripts/basebrief_project_profile.js"), "v2.9 closeout must name project profile script");
  assert(v290ReleaseDoc.includes("tests/project-profile.test.js"), "v2.9 closeout must name independent tests");
  assert(v290ReleaseDoc.includes("examples/project-profile-lite/"), "v2.9 closeout must link example kit");
  assertIncludesPhrase(v290ReleaseDoc, "does not include the full resume prompt body and does not add human-only `next_step` fields", "v2.9 closeout must preserve JSON boundary");
  assert(v290ReleaseDoc.includes("No Workflow Runner") && v290ReleaseDoc.includes("No global config") && v290ReleaseDoc.includes("No secret store"), "v2.9 closeout must preserve profile boundaries");

  assert(v291ReleaseDoc.includes("v2.9.1 Project Profile CWD Hint Polish"), "v2.9.1 closeout must have stable title");
  assert(v291ReleaseDoc.includes("basebrief-project-profile-v1") && v291ReleaseDoc.includes("contract unchanged"), "v2.9.1 closeout must preserve profile contract");
  assert(v291ReleaseDoc.includes("current working directory") && v291ReleaseDoc.includes("repo_hint"), "v2.9.1 closeout must document cwd repo hint fallback");
  assert(v291ReleaseDoc.includes("profile-init --repo . --output <temp>/basebrief-profile.json") && v291ReleaseDoc.includes("continue --profile <temp>/basebrief-profile.json"), "v2.9.1 closeout must record dogfooding scenario");
  assert(v291ReleaseDoc.includes("No Workflow Runner") && v291ReleaseDoc.includes("No global config") && v291ReleaseDoc.includes("No secret store"), "v2.9.1 closeout must preserve profile boundaries");

  assert(v300PlanDoc.includes("v3.0.0 Workflow Runner Lite Plan"), "v3.0 plan must have stable title");
  assert(v300PlanDoc.includes("v3.0-A") && v300PlanDoc.includes("research/spec"), "v3.0 plan must record research/spec status");
  assert(v300PlanDoc.includes("v3.0-B minimal implementation"), "v3.0 plan must record minimal implementation status");
  assert(v300PlanDoc.includes("thin local wrapper") && v300PlanDoc.includes("scripts/basebrief_workflow.js"), "v3.0 plan must document the thin workflow implementation");
  assert(v300PlanDoc.includes("Project Profile -> Continue -> Context Pack -> Check -> Resume starter"), "v3.0 plan must preserve proposed workflow chain");
  assert(v300PlanDoc.includes("node scripts/basebrief.js workflow --profile <profile.json> --output-dir <dir>"), "v3.0 plan must document future command shape");
  assert(v300PlanDoc.includes("basebrief-workflow-lite-v1"), "v3.0 plan must define future workflow contract");
  assert(v300PlanDoc.includes("must not include the full resume prompt body") && v300PlanDoc.includes("human-only `next_step`"), "v3.0 plan must keep prompt and human hints out of JSON");
  assert(v300PlanDoc.includes("No provider request.") && v300PlanDoc.includes("No raw private output."), "v3.0 plan must preserve public-safe provider boundaries");
  assert(v300PlanDoc.includes("No runtime integration.") && v300PlanDoc.includes("No plugin."), "v3.0 plan must reject runtime and plugin scope");
  assert(v300PlanDoc.includes("No MCP server.") && v300PlanDoc.includes("No MCP tools."), "v3.0 plan must reject MCP scope");
  assert(v300PlanDoc.includes("No schema-v2.") && v300PlanDoc.includes("No CI workflow."), "v3.0 plan must reject schema-v2 and CI scope");
  assert(v300PlanDoc.includes("No daemon.") && v300PlanDoc.includes("No watcher."), "v3.0 plan must reject background automation");
  assert(v300PlanDoc.includes("No automatic project task implementation."), "v3.0 plan must reject automatic project work");
  assert(v300PlanDoc.includes("No automatic commit, push, tag, release"), "v3.0 plan must reject automatic release actions");
  assert(v300PlanDoc.includes("Expected test count is 192 tests") && v300PlanDoc.includes("independent_test_files=6"), "v3.0 plan must record workflow validation metrics");

  assert(projectProfileExampleReadme.includes("Project Profile Lite Example Kit"), "Project Profile example kit must have stable title");
  assert(projectProfileExampleReadme.includes("basebrief-project-profile-v1"), "Project Profile example kit must name contract");
  assert(projectProfileExampleReadme.includes("continuation-default") && projectProfileExampleReadme.includes("small-delta") && projectProfileExampleReadme.includes("review-heavy"), "Project Profile example kit must define recipes");
  assert(projectProfileExampleReadme.includes("inherited preference context, not proof"), "Project Profile example kit must preserve receiver recheck rule");
  assert(projectProfileExampleReadme.includes("does not call providers") && projectProfileExampleReadme.includes("does not store secrets") && projectProfileExampleReadme.includes("does not write global config"), "Project Profile example kit must preserve non-goals");
  assert(projectProfileExample.schemaVersion === "basebrief-project-profile-v1", "Project Profile example must use v1 contract");
  assert(projectProfileExample.recipe === "continuation-default", "Project Profile example must use default recipe");
  assert(projectProfileExample.defaults.max_files === 12, "Project Profile example must preserve default max files");
  assert(!JSON.stringify(projectProfileExample).match(/[A-Z]:\\|\\\\|\/home\/|\b(?:sk|gho|ghp|github_pat|Bearer)\b/i), "Project Profile example must not contain private paths or secret-like values");

  assert(basebriefCliScript.includes("runProfileInit"), "CLI must import project profile init");
  assert(basebriefCliScript.includes("loadProjectProfile"), "CLI must load project profiles");
  assert(basebriefCliScript.includes("profile-init --repo <target-repo> --output <profile.json>"), "CLI must expose profile-init help");
  assert(basebriefCliScript.includes("continue --profile <profile.json> --output-dir <dir>"), "CLI must expose continue profile help");
  assert(basebriefCliScript.includes("workflow --profile <profile.json> --output-dir <dir>"), "CLI must expose workflow profile help");
  assert(basebriefCliScript.includes('if (command === "profile-init") return commandProfileInit(options);'), "CLI must route profile-init command");
  assert(basebriefCliScript.includes('if (command === "workflow") return commandWorkflow(options);'), "CLI must route workflow command");
  assert(basebriefCliScript.includes('if (result.command === "workflow")') && basebriefCliScript.includes("BaseBrief workflow runner"), "CLI must format workflow output");
  assert(basebriefCliScript.includes("profileDefaultsApplied"), "CLI continue profile must report applied defaults");
  assert(basebriefProjectProfileScript.includes("basebrief-project-profile-v1"), "Project Profile script must define v1 contract");
  assert(basebriefProjectProfileScript.includes("continuation-default") && basebriefProjectProfileScript.includes("small-delta") && basebriefProjectProfileScript.includes("review-heavy"), "Project Profile script must define recipes");
  assert(basebriefProjectProfileScript.includes("SENSITIVE_KEY_PATTERN") && basebriefProjectProfileScript.includes("SECRET_VALUE_PATTERN"), "Project Profile script must scan sensitive fields and values");
  assert(basebriefProjectProfileScript.includes("cwdCandidate") && basebriefProjectProfileScript.includes("path.basename(cwd) === repoHint"), "Project Profile script must resolve public repo hints from cwd");
  assert(basebriefWorkflowScript.includes("WORKFLOW_CONTRACT_VERSION") && basebriefWorkflowScript.includes("basebrief-workflow-lite-v1"), "Workflow script must define v1 contract");
  assert(basebriefWorkflowScript.includes("runContinuationHarness") && basebriefWorkflowScript.includes("optionsFromProfile"), "Workflow script must wrap profile continuation");
  assert(basebriefWorkflowScript.includes("No provider request.") && basebriefWorkflowScript.includes("No MCP server.") && basebriefWorkflowScript.includes("No schema-v2."), "Workflow script must preserve hard boundaries");
  assert(basebriefWorkflowScript.includes("No automatic commit, push, tag, release"), "Workflow script must reject automatic release actions");
  assert(!basebriefWorkflowScript.includes("runDoctor") && !basebriefWorkflowScript.includes("runExport") && !basebriefWorkflowScript.includes("runDelta"), "Workflow script must not call doctor, export, or delta");

  assert(v2ContextPackRoadmapDoc.includes("exports/manifest.json"), "v2 roadmap must define export manifest");
  assert(v2ContextPackRoadmapDoc.includes("exports/context-pack.md"), "v2 roadmap must define readable export");
  assert(v2ContextPackRoadmapDoc.includes("exports/context.json"), "v2 roadmap must define machine-readable export");
  assert(v2ContextPackRoadmapDoc.includes("exports/adapter-notes.md"), "v2 roadmap must define adapter notes export");
  assert(v2ContextPackRoadmapDoc.includes("Workflow Runner Lite or watcher/dashboard work"), "v2 roadmap must keep runner and watcher work later");
  assert(v2ContextPackRoadmapDoc.includes("MANIFEST.md"), "v2 roadmap must define manifest artifact");
  assert(v2ContextPackRoadmapDoc.includes("REPO_MAP.md"), "v2 roadmap must define repo map artifact");
  assert(v2ContextPackRoadmapDoc.includes("KEY_FILES.md"), "v2 roadmap must define key files artifact");
  assert(v2ContextPackRoadmapDoc.includes("RECENT_DELTA.md"), "v2 roadmap must define recent delta artifact");
  assert(v2ContextPackRoadmapDoc.includes("RISK_BOUNDARIES.md"), "v2 roadmap must define risk boundaries artifact");
  assert(v2ContextPackRoadmapDoc.includes("RECEIVER_STATE.md"), "v2 roadmap must define receiver state artifact");
  assert(v2ContextPackRoadmapDoc.includes("NEXT_WINDOW_STARTER.md"), "v2 roadmap must define next-window starter artifact");
  assert(v2ContextPackRoadmapDoc.includes("a provider request path"), "v2 roadmap must preserve provider boundary");
  assert(v2ContextPackRoadmapDoc.includes("not_available"), "v2 roadmap must allow missing-input degradation");
}

function checkV26DogfoodingDocs(context) {
  const {
    contextPackAdoptionNotesV261Doc,
    contextEngineeringReferenceNotesV264Doc,
    contextPackAdoptionScenarioMatrixV265Doc,
    contextPackFirstRunFixtureLabV266Doc,
    contextPackFirstRunRehearsalAuditV267Doc,
    contextPackFirstRunFrictionRepairV268Doc,
    contextPackAdoptionDecisionCheckpointV269Doc,
    contextPackPreReleaseBundleAuditV2610Doc,
    contextPackFeatureFeasibilitySpikeV2611Doc,
    contextPackLocalBundleReviewRehearsalV2612Doc,
    contextPackLocalBundleCompressionV2613Doc,
    contextPackReleaseCheckMaintainabilityV2614Doc,
    contextPackMajorReleaseCandidateShapeV2615Doc,
    contextPackContinuationHarnessDecisionSpecV2616Doc,
    contextPackAhead14BundleReviewV2617Doc,
    contextPackMinimalFeatureCandidateDecisionV2618Doc,
    contextPackFirstRunHandoffValidationDoc,
    contextPackContinuationHarnessLiteDesignSketchDoc,
    contextPackContinuationHarnessLitePaperRehearsalDoc,
    contextPackLocalBundleCompressionV2620Doc,
    contextPackImplementationGateDecisionV2621Doc,
    contextPackReleaseCheckMaintainabilityPlanV2622Doc,
    contextPackRunnableRecipesPlanV2623Doc,
    contextPackFirstRunSmokePathConsolidationV2624Doc,
    contextPackOutputUxPolishV2625Doc,
    contextPackTestFileSplitPlanV2626Doc,
    contextPackTestFileSplitV2627Doc,
    contextPackTestFileSplitSecondCandidateV2628Doc,
    contextPackCacheReadyBenchmarkTestSplitV2629Doc,
    contextPackTestSplitStabilityCheckV2630Doc,
    contextPackV26xLocalCloseoutGateV2631Doc,
    contextPackReleaseCandidateDecisionV2632Doc,
    contextPackReleaseCandidateSummaryDraftV2633Doc,
    contextPackReleaseCloseoutGoNoGoPlanV2634Doc,
    contextPackReleaseCloseoutPrepDraftV2635Doc,
    contextPackFormalLocalReleaseCloseoutDraftV2636Doc,
    contextPackReleaseCloseoutReviewPacketV2637Doc,
  } = context;

  assert(contextPackAdoptionNotesV261Doc.includes("Context Pack Adoption Notes v2.6.1"), "v2.6.1 adoption notes doc must have stable title");
  assert(contextPackAdoptionNotesV261Doc.includes("not a new minor-version line"), "v2.6.1 adoption notes must avoid contract claims");
  assert(contextPackAdoptionNotesV261Doc.includes("contract, command, schema, or release"), "v2.6.1 adoption notes must avoid contract claims");
  assert(contextPackAdoptionNotesV261Doc.includes("README -> docs/quickstart-5min.md -> examples/minimal/README.md"), "v2.6.1 adoption notes must record first-run route");
  assert(contextPackAdoptionNotesV261Doc.includes("context-pack -> check -> resume -> doctor"), "v2.6.1 adoption notes must record context-pack command route");
  assert(contextPackAdoptionNotesV261Doc.includes("`blocking`"), "v2.6.1 adoption notes must define blocking friction");
  assert(contextPackAdoptionNotesV261Doc.includes("`confusing`"), "v2.6.1 adoption notes must define confusing friction");
  assert(contextPackAdoptionNotesV261Doc.includes("`nice-to-have`"), "v2.6.1 adoption notes must define nice-to-have friction");
  assert(contextPackAdoptionNotesV261Doc.includes("build_status: passed"), "v2.6.1 adoption notes must record first-run build result");
  assert(contextPackAdoptionNotesV261Doc.includes("context_pack_check_status: passed"), "v2.6.1 adoption notes must record context pack check result");
  assert(contextPackAdoptionNotesV261Doc.includes("resume_status: ready"), "v2.6.1 adoption notes must record resume result");
  assert(contextPackAdoptionNotesV261Doc.includes("doctor_contract_version: basebrief-doctor-v1"), "v2.6.1 adoption notes must preserve doctor contract version");
  assert(contextPackAdoptionNotesV261Doc.includes("doctor_info_findings: doctor.live-recheck-required"), "v2.6.1 adoption notes must record live recheck info");
  assert(contextPackAdoptionNotesV261Doc.includes("context-pack.too-thick"), "v2.6.1 adoption notes must preserve thickness warning interpretation");
  assert(contextPackAdoptionNotesV261Doc.includes("doctor.pack-head-stale"), "v2.6.1 adoption notes must preserve stale doctor interpretation");
  assert(contextPackAdoptionNotesV261Doc.includes("doctor.pack-check-error"), "v2.6.1 adoption notes must preserve broken-pack doctor interpretation");
  assert(contextPackAdoptionNotesV261Doc.includes("repair_candidate: v2.6.2 starter wording repair"), "v2.6.1 adoption notes must record the v2.6.2 repair candidate");
  assert(contextPackAdoptionNotesV261Doc.includes("Do not turn Doctor into an always-on Status command"), "v2.6.1 adoption notes must reject always-on status scope");
  assert(contextPackAdoptionNotesV261Doc.includes("No Status command"), "v2.6.1 adoption notes must reject status command scope");
  assert(contextPackAdoptionNotesV261Doc.includes("No provider request"), "v2.6.1 adoption notes must reject provider requests");
  assert(contextPackAdoptionNotesV261Doc.includes("No MCP server"), "v2.6.1 adoption notes must reject MCP server scope");
  assert(contextPackAdoptionNotesV261Doc.includes("No MCP tools"), "v2.6.1 adoption notes must reject MCP tools scope");
  assert(contextPackAdoptionNotesV261Doc.includes("No schema-v2"), "v2.6.1 adoption notes must reject schema-v2");
  assert(contextPackAdoptionNotesV261Doc.includes("No Workflow Runner"), "v2.6.1 adoption notes must keep runner out of scope");
  assert(contextPackAdoptionNotesV261Doc.includes("No `check --input <dir> --json` top-level shape change"), "v2.6.1 adoption notes must preserve checker JSON shape");
  assert(contextPackAdoptionNotesV261Doc.includes("No Doctor JSON contract change"), "v2.6.1 adoption notes must preserve doctor JSON shape");
  assert(contextPackAdoptionNotesV261Doc.includes("provider_probe_status=skipped"), "v2.6.1 adoption notes must preserve skipped provider gate");
  assert(!/[A-Za-z]:[\\/]/.test(contextPackAdoptionNotesV261Doc), "v2.6.1 adoption notes must not expose drive-letter absolute paths");
  assert(!/\\\\/.test(contextPackAdoptionNotesV261Doc), "v2.6.1 adoption notes must not expose UNC paths");
  assert(contextEngineeringReferenceNotesV264Doc.includes("Context Engineering Reference Notes v2.6.4"), "v2.6.4 reference notes doc must have stable title");
  assert(contextEngineeringReferenceNotesV264Doc.includes("not a release closeout, command, contract, schema"), "v2.6.4 reference notes must avoid contract claims");
  assert(contextEngineeringReferenceNotesV264Doc.includes("own your context window"), "v2.6.4 reference notes must mention own-your-context-window theme");
  assert(contextEngineeringReferenceNotesV264Doc.includes("stateless reducer"), "v2.6.4 reference notes must mention stateless reducer theme");
  assert(contextEngineeringReferenceNotesV264Doc.includes("handoff artifact"), "v2.6.4 reference notes must mention handoff artifact theme");
  assert(contextEngineeringReferenceNotesV264Doc.includes("memory hygiene"), "v2.6.4 reference notes must mention memory hygiene theme");
  assert(contextEngineeringReferenceNotesV264Doc.includes("context compression"), "v2.6.4 reference notes must mention context compression theme");
  assert(contextEngineeringReferenceNotesV264Doc.includes("Context Pack is the handoff artifact"), "v2.6.4 reference notes must map Context Pack to handoff artifact");
  assert(contextEngineeringReferenceNotesV264Doc.includes("Context Pack Check is the review gate"), "v2.6.4 reference notes must map check to review gate");
  assert(contextEngineeringReferenceNotesV264Doc.includes("Resume turns a checked pack"), "v2.6.4 reference notes must map resume to next-window prompt");
  assert(contextEngineeringReferenceNotesV264Doc.includes("Doctor compares inherited pack facts with live repo facts"), "v2.6.4 reference notes must map doctor to live recheck");
  assert(contextEngineeringReferenceNotesV264Doc.includes("File-only Export makes the pack consumable as plain files"), "v2.6.4 reference notes must map file-only export");
  assert(contextEngineeringReferenceNotesV264Doc.includes("v3 Continuation Harness") && contextEngineeringReferenceNotesV264Doc.includes("Workflow Runner Lite") && contextEngineeringReferenceNotesV264Doc.includes("repeated") && contextEngineeringReferenceNotesV264Doc.includes("real friction"), "v2.6.4 reference notes must keep v3 behind repeated friction");
  assert(contextEngineeringReferenceNotesV264Doc.includes("Do not start v3 merely because external references mention agents"), "v2.6.4 reference notes must reject hype-driven v3 scope");
  assert(contextEngineeringReferenceNotesV264Doc.includes("No Status command"), "v2.6.4 reference notes must reject status command scope");
  assert(contextEngineeringReferenceNotesV264Doc.includes("No Workflow Runner"), "v2.6.4 reference notes must keep runner out of scope");
  assert(contextEngineeringReferenceNotesV264Doc.includes("No provider request"), "v2.6.4 reference notes must reject provider requests");
  assert(contextEngineeringReferenceNotesV264Doc.includes("No runtime integration"), "v2.6.4 reference notes must reject runtime integration");
  assert(contextEngineeringReferenceNotesV264Doc.includes("No MCP server"), "v2.6.4 reference notes must reject MCP server scope");
  assert(contextEngineeringReferenceNotesV264Doc.includes("No MCP tools"), "v2.6.4 reference notes must reject MCP tools scope");
  assert(contextEngineeringReferenceNotesV264Doc.includes("No schema-v2"), "v2.6.4 reference notes must reject schema-v2");
  assert(contextEngineeringReferenceNotesV264Doc.includes("No `check --input <dir> --json` top-level shape change"), "v2.6.4 reference notes must preserve checker JSON shape");
  assert(contextEngineeringReferenceNotesV264Doc.includes("No Doctor JSON contract change"), "v2.6.4 reference notes must preserve doctor JSON shape");
  assert(contextEngineeringReferenceNotesV264Doc.includes("No Export JSON contract change"), "v2.6.4 reference notes must preserve export JSON shape");
  assert(contextEngineeringReferenceNotesV264Doc.includes("provider_probe_status=skipped"), "v2.6.4 reference notes must preserve skipped provider gate");
  assert(!/(^|[^A-Za-z])[A-Za-z]:[\\/]/.test(contextEngineeringReferenceNotesV264Doc), "v2.6.4 reference notes must not expose drive-letter absolute paths");
  assert(!/\\\\/.test(contextEngineeringReferenceNotesV264Doc), "v2.6.4 reference notes must not expose UNC paths");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("Context Pack Adoption Scenario Matrix v2.6.5"), "v2.6.5 scenario matrix doc must have stable title");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("local adoption evidence, not a release closeout"), "v2.6.5 scenario matrix must avoid release closeout claims");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("`check` is the pack validity gate"), "v2.6.5 scenario matrix must define check role");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("`resume` is the copyable next-window prompt surface"), "v2.6.5 scenario matrix must define resume role");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("`doctor` is the live repo comparison surface"), "v2.6.5 scenario matrix must define doctor role");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("Doctor is not an always-on Status command"), "v2.6.5 scenario matrix must reject always-on status scope");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("clean pack"), "v2.6.5 scenario matrix must include clean pack scenario");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("too-thick warning"), "v2.6.5 scenario matrix must include too-thick warning scenario");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("stale HEAD"), "v2.6.5 scenario matrix must include stale HEAD scenario");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("broken pack"), "v2.6.5 scenario matrix must include broken pack scenario");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("doctor live-recheck info"), "v2.6.5 scenario matrix must include live-recheck info scenario");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("starter inherited-context handoff"), "v2.6.5 scenario matrix must include starter handoff scenario");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("context-pack.too-thick"), "v2.6.5 scenario matrix must preserve thickness warning rule id");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("doctor.pack-head-stale"), "v2.6.5 scenario matrix must preserve stale HEAD rule id");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("doctor.pack-branch-mismatch"), "v2.6.5 scenario matrix must preserve branch mismatch rule id");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("doctor.pack-check-error"), "v2.6.5 scenario matrix must preserve pack check error rule id");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("doctor.live-recheck-required"), "v2.6.5 scenario matrix must preserve live recheck info rule id");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("Continuation rules:"), "v2.6.5 scenario matrix must preserve starter continuation rules wording");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("No Status command"), "v2.6.5 scenario matrix must reject status command scope");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("No Workflow Runner"), "v2.6.5 scenario matrix must reject workflow runner scope");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("No provider request"), "v2.6.5 scenario matrix must reject provider requests");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("No runtime integration"), "v2.6.5 scenario matrix must reject runtime integration");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("No MCP server"), "v2.6.5 scenario matrix must reject MCP server scope");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("No MCP tools"), "v2.6.5 scenario matrix must reject MCP tools scope");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("No schema-v2"), "v2.6.5 scenario matrix must reject schema-v2");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("No `check --input <dir> --json` top-level shape change"), "v2.6.5 scenario matrix must preserve checker JSON shape");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("No Resume JSON contract change"), "v2.6.5 scenario matrix must preserve resume JSON contract");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("No Doctor JSON contract change"), "v2.6.5 scenario matrix must preserve doctor JSON contract");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("No Export JSON contract change"), "v2.6.5 scenario matrix must preserve export JSON contract");
  assert(contextPackAdoptionScenarioMatrixV265Doc.includes("provider_probe_status=skipped"), "v2.6.5 scenario matrix must preserve skipped provider gate");
  assert(!/(^|[^A-Za-z])[A-Za-z]:[\\/]/.test(contextPackAdoptionScenarioMatrixV265Doc), "v2.6.5 scenario matrix must not expose drive-letter absolute paths");
  assert(!/\\\\/.test(contextPackAdoptionScenarioMatrixV265Doc), "v2.6.5 scenario matrix must not expose UNC paths");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("Context Pack First-Run Fixture Lab v2.6.6"), "v2.6.6 fixture lab doc must have stable title");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("local adoption evidence, not a release closeout"), "v2.6.6 fixture lab must avoid release closeout claims");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("examples/context-pack-lite/README.md"), "v2.6.6 fixture lab must link Context Pack Lite example kit");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("examples/context-pack-doctor/README.md"), "v2.6.6 fixture lab must link Doctor example kit");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("docs/dogfooding/context-pack-adoption-scenario-matrix-v2.6.5.md"), "v2.6.6 fixture lab must link v2.6.5 matrix");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("docs/dogfooding/context-pack-check-acceptance-v2.1.0.md"), "v2.6.6 fixture lab must link check acceptance record");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("docs/dogfooding/context-pack-doctor-v2.5.1.md"), "v2.6.6 fixture lab must link Doctor dogfooding summary");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("clean pack"), "v2.6.6 fixture lab must include clean pack scenario");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("context-pack.too-thick"), "v2.6.6 fixture lab must preserve thickness warning rule id");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("doctor.pack-head-stale"), "v2.6.6 fixture lab must preserve stale HEAD rule id");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("doctor.pack-branch-mismatch"), "v2.6.6 fixture lab must preserve branch mismatch rule id");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("doctor.pack-check-error"), "v2.6.6 fixture lab must preserve pack check error rule id");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("doctor.live-recheck-required"), "v2.6.6 fixture lab must preserve live recheck info rule id");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("Continuation rules:"), "v2.6.6 fixture lab must preserve starter continuation rules wording");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("`check` answers whether a Context Pack directory is structurally reviewable"), "v2.6.6 fixture lab must define check role");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("`resume` produces a copyable next-window prompt"), "v2.6.6 fixture lab must define resume role");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("`doctor` compares inherited pack facts with live repo facts"), "v2.6.6 fixture lab must define doctor role");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("Doctor is not an always-on Status command"), "v2.6.6 fixture lab must reject always-on status scope");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("No Status command"), "v2.6.6 fixture lab must reject status command scope");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("No Workflow Runner"), "v2.6.6 fixture lab must reject workflow runner scope");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("No provider request"), "v2.6.6 fixture lab must reject provider requests");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("No runtime integration"), "v2.6.6 fixture lab must reject runtime integration");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("No MCP server"), "v2.6.6 fixture lab must reject MCP server scope");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("No MCP tools"), "v2.6.6 fixture lab must reject MCP tools scope");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("No schema-v2"), "v2.6.6 fixture lab must reject schema-v2");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("No `check --input <dir> --json` top-level shape change"), "v2.6.6 fixture lab must preserve checker JSON shape");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("No Resume JSON contract change"), "v2.6.6 fixture lab must preserve resume JSON contract");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("No Doctor JSON contract change"), "v2.6.6 fixture lab must preserve doctor JSON contract");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("No Export JSON contract change"), "v2.6.6 fixture lab must preserve export JSON contract");
  assert(contextPackFirstRunFixtureLabV266Doc.includes("provider_probe_status=skipped"), "v2.6.6 fixture lab must preserve skipped provider gate");
  assert(!/(^|[^A-Za-z])[A-Za-z]:[\\/]/.test(contextPackFirstRunFixtureLabV266Doc), "v2.6.6 fixture lab must not expose drive-letter absolute paths");
  assert(!/\\\\/.test(contextPackFirstRunFixtureLabV266Doc), "v2.6.6 fixture lab must not expose UNC paths");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("Context Pack First-Run Rehearsal Audit v2.6.7"), "v2.6.7 rehearsal audit doc must have stable title");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("local adoption evidence, not a release closeout"), "v2.6.7 rehearsal audit must avoid release closeout claims");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("README.md") && contextPackFirstRunRehearsalAuditV267Doc.includes("docs/quickstart-5min.md") && contextPackFirstRunRehearsalAuditV267Doc.includes("examples/minimal/README.md"), "v2.6.7 rehearsal audit must include first-run route");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("examples/context-pack-lite/README.md") && contextPackFirstRunRehearsalAuditV267Doc.includes("examples/context-pack-doctor/README.md"), "v2.6.7 rehearsal audit must include example kits");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("build_status: passed"), "v2.6.7 rehearsal audit must record build status");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("context_pack_status: generated"), "v2.6.7 rehearsal audit must record context pack generation");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("context_pack_check_status: passed"), "v2.6.7 rehearsal audit must record check pass");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("context_pack_check_warning_count: 0"), "v2.6.7 rehearsal audit must record no generated pack warnings");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("resume_starter_contains: Continuation rules:"), "v2.6.7 rehearsal audit must record starter continuation rules");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("doctor_contract_version: basebrief-doctor-v1"), "v2.6.7 rehearsal audit must record doctor contract version");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("doctor_status: passed"), "v2.6.7 rehearsal audit must record generated doctor pass");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("doctor.live-recheck-required"), "v2.6.7 rehearsal audit must preserve live recheck info rule id");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("example_pack_check_status: passed"), "v2.6.7 rehearsal audit must record example pack check pass");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("example_pack_doctor_status: warning"), "v2.6.7 rehearsal audit must record example doctor warning");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("doctor.pack-head-stale"), "v2.6.7 rehearsal audit must preserve stale HEAD rule id");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("blocking | None observed"), "v2.6.7 rehearsal audit must record no blocking friction");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("No command, contract, or schema change"), "v2.6.7 rehearsal audit must avoid expanding behavior after no blocking friction");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("No Status command"), "v2.6.7 rehearsal audit must reject status command scope");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("No Workflow Runner"), "v2.6.7 rehearsal audit must reject workflow runner scope");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("No provider request"), "v2.6.7 rehearsal audit must reject provider requests");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("No runtime integration"), "v2.6.7 rehearsal audit must reject runtime integration");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("No MCP server"), "v2.6.7 rehearsal audit must reject MCP server scope");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("No MCP tools"), "v2.6.7 rehearsal audit must reject MCP tools scope");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("No schema-v2"), "v2.6.7 rehearsal audit must reject schema-v2");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("No `check --input <dir> --json` top-level shape change"), "v2.6.7 rehearsal audit must preserve checker JSON shape");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("No Resume JSON contract change"), "v2.6.7 rehearsal audit must preserve resume JSON contract");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("No Doctor JSON contract change"), "v2.6.7 rehearsal audit must preserve doctor JSON contract");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("No Export JSON contract change"), "v2.6.7 rehearsal audit must preserve export JSON contract");
  assert(contextPackFirstRunRehearsalAuditV267Doc.includes("provider_probe_status=skipped"), "v2.6.7 rehearsal audit must preserve skipped provider gate");
  assert(!/(^|[^A-Za-z])[A-Za-z]:[\\/]/.test(contextPackFirstRunRehearsalAuditV267Doc), "v2.6.7 rehearsal audit must not expose drive-letter absolute paths");
  assert(!/\\\\/.test(contextPackFirstRunRehearsalAuditV267Doc), "v2.6.7 rehearsal audit must not expose UNC paths");
  assert(contextPackFirstRunFrictionRepairV268Doc.includes("Context Pack First-Run Friction Repair v2.6.8"), "v2.6.8 friction repair doc must have stable title");
  assert(contextPackFirstRunFrictionRepairV268Doc.includes("v2.6.7 first-run rehearsal audit"), "v2.6.8 friction repair must cite v2.6.7 source evidence");
  assert(contextPackFirstRunFrictionRepairV268Doc.includes("blocking_friction: none"), "v2.6.8 friction repair must record no blocking friction");
  assert(contextPackFirstRunFrictionRepairV268Doc.includes("quickstart_primary_route: 最短闭环 -> 路径 B -> 路径 B3"), "v2.6.8 friction repair must record first-run route");
  assert(contextPackFirstRunFrictionRepairV268Doc.includes("windows_utf8_note: Get-Content -Encoding UTF8 <file>"), "v2.6.8 friction repair must record Windows UTF-8 note");
  assert(contextPackFirstRunFrictionRepairV268Doc.includes("behavior_change: none"), "v2.6.8 friction repair must avoid behavior changes");
  assert(contextPackFirstRunFrictionRepairV268Doc.includes("No Status command"), "v2.6.8 friction repair must reject status command scope");
  assert(contextPackFirstRunFrictionRepairV268Doc.includes("No Workflow Runner"), "v2.6.8 friction repair must reject workflow runner scope");
  assert(contextPackFirstRunFrictionRepairV268Doc.includes("No provider request"), "v2.6.8 friction repair must reject provider requests");
  assert(contextPackFirstRunFrictionRepairV268Doc.includes("No runtime integration"), "v2.6.8 friction repair must reject runtime integration");
  assert(contextPackFirstRunFrictionRepairV268Doc.includes("No MCP server"), "v2.6.8 friction repair must reject MCP server scope");
  assert(contextPackFirstRunFrictionRepairV268Doc.includes("No MCP tools"), "v2.6.8 friction repair must reject MCP tools scope");
  assert(contextPackFirstRunFrictionRepairV268Doc.includes("No schema-v2"), "v2.6.8 friction repair must reject schema-v2");
  assert(contextPackFirstRunFrictionRepairV268Doc.includes("No `check --input <dir> --json` top-level shape change"), "v2.6.8 friction repair must preserve checker JSON shape");
  assert(contextPackFirstRunFrictionRepairV268Doc.includes("No Resume JSON contract change"), "v2.6.8 friction repair must preserve resume JSON contract");
  assert(contextPackFirstRunFrictionRepairV268Doc.includes("No Doctor JSON contract change"), "v2.6.8 friction repair must preserve doctor JSON contract");
  assert(contextPackFirstRunFrictionRepairV268Doc.includes("No Export JSON contract change"), "v2.6.8 friction repair must preserve export JSON contract");
  assert(contextPackFirstRunFrictionRepairV268Doc.includes("provider_probe_status=skipped"), "v2.6.8 friction repair must preserve skipped provider gate");
  assert(!/(^|[^A-Za-z])[A-Za-z]:[\\/]/.test(contextPackFirstRunFrictionRepairV268Doc), "v2.6.8 friction repair must not expose drive-letter absolute paths");
  assert(!/\\\\/.test(contextPackFirstRunFrictionRepairV268Doc), "v2.6.8 friction repair must not expose UNC paths");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("Context Pack Adoption Decision Checkpoint v2.6.9"), "v2.6.9 decision checkpoint doc must have stable title");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("local adoption evidence, not a release closeout"), "v2.6.9 decision checkpoint must avoid release closeout claims");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("context-pack-adoption-notes-v2.6.1.md"), "v2.6.9 decision checkpoint must cite v2.6.1 evidence");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("context-engineering-reference-notes-v2.6.4.md"), "v2.6.9 decision checkpoint must cite v2.6.4 evidence");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("context-pack-adoption-scenario-matrix-v2.6.5.md"), "v2.6.9 decision checkpoint must cite v2.6.5 evidence");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("context-pack-first-run-fixture-lab-v2.6.6.md"), "v2.6.9 decision checkpoint must cite v2.6.6 evidence");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("context-pack-first-run-rehearsal-audit-v2.6.7.md"), "v2.6.9 decision checkpoint must cite v2.6.7 evidence");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("context-pack-first-run-friction-repair-v2.6.8.md"), "v2.6.9 decision checkpoint must cite v2.6.8 evidence");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("decision: continue v2.6.x local adoption incubation"), "v2.6.9 decision checkpoint must record incubation decision");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("feature_line_status: not_started"), "v2.6.9 decision checkpoint must keep feature line closed");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("status_command_status: not_started"), "v2.6.9 decision checkpoint must keep status command closed");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("workflow_runner_status: not_started"), "v2.6.9 decision checkpoint must keep workflow runner closed");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("v3_continuation_harness_status: not_started"), "v2.6.9 decision checkpoint must keep v3 harness closed");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("repeated real usage") && contextPackAdoptionDecisionCheckpointV269Doc.includes("blocking or high-frequency confusing friction"), "v2.6.9 decision checkpoint must define escalation criteria");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("Do not turn Doctor into an always-on Status command"), "v2.6.9 decision checkpoint must reject always-on status");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("Do not turn Check into a live repository comparison surface"), "v2.6.9 decision checkpoint must preserve check role");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("No Status command"), "v2.6.9 decision checkpoint must reject status command scope");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("No Workflow Runner"), "v2.6.9 decision checkpoint must reject workflow runner scope");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("No v3 Continuation Harness"), "v2.6.9 decision checkpoint must reject v3 harness scope");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("No provider request"), "v2.6.9 decision checkpoint must reject provider requests");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("No runtime integration"), "v2.6.9 decision checkpoint must reject runtime integration");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("No MCP server"), "v2.6.9 decision checkpoint must reject MCP server scope");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("No MCP tools"), "v2.6.9 decision checkpoint must reject MCP tools scope");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("No schema-v2"), "v2.6.9 decision checkpoint must reject schema-v2");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("No `check --input <dir> --json` top-level shape change"), "v2.6.9 decision checkpoint must preserve checker JSON shape");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("No Resume JSON contract change"), "v2.6.9 decision checkpoint must preserve resume JSON contract");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("No Doctor JSON contract change"), "v2.6.9 decision checkpoint must preserve doctor JSON contract");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("No Export JSON contract change"), "v2.6.9 decision checkpoint must preserve export JSON contract");
  assert(contextPackAdoptionDecisionCheckpointV269Doc.includes("provider_probe_status=skipped"), "v2.6.9 decision checkpoint must preserve skipped provider gate");
  assert(!/(^|[^A-Za-z])[A-Za-z]:[\\/]/.test(contextPackAdoptionDecisionCheckpointV269Doc), "v2.6.9 decision checkpoint must not expose drive-letter absolute paths");
  assert(!/\\\\/.test(contextPackAdoptionDecisionCheckpointV269Doc), "v2.6.9 decision checkpoint must not expose UNC paths");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("Context Pack Pre-Release Bundle Audit v2.6.10"), "v2.6.10 bundle audit doc must have stable title");
  assertIncludesPhrase(contextPackPreReleaseBundleAuditV2610Doc, "local adoption bundle audit, not a release closeout", "v2.6.10 bundle audit must avoid release closeout claims");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("ahead-7 local sedimentation"), "v2.6.10 bundle audit must preserve ahead-7 semantics");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("starter wording repair"), "v2.6.10 bundle audit must include starter wording repair");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("v2.6.4 reference notes"), "v2.6.10 bundle audit must include v2.6.4 reference notes");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("v2.6.5 scenario matrix"), "v2.6.10 bundle audit must include v2.6.5 scenario matrix");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("v2.6.6 fixture lab"), "v2.6.10 bundle audit must include v2.6.6 fixture lab");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("v2.6.7 rehearsal audit"), "v2.6.10 bundle audit must include v2.6.7 rehearsal audit");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("v2.6.8 friction repair"), "v2.6.10 bundle audit must include v2.6.8 friction repair");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("v2.6.9 decision checkpoint"), "v2.6.10 bundle audit must include v2.6.9 decision checkpoint");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("bundle_status: local_adoption_bundle"), "v2.6.10 bundle audit must record local bundle status");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("release_closeout_status: not_started"), "v2.6.10 bundle audit must keep release closeout not started");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("push_status: not_started"), "v2.6.10 bundle audit must keep push not started");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("tag_status: not_started"), "v2.6.10 bundle audit must keep tag not started");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("release_status: not_started"), "v2.6.10 bundle audit must keep release not started");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("docs/examples/release-check/adoption polish"), "v2.6.10 bundle audit must scope bundle as adoption polish");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("does not introduce CLI behavior"), "v2.6.10 bundle audit must reject CLI behavior changes");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("does not add a new command"), "v2.6.10 bundle audit must reject new commands");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("does not change any public JSON contract"), "v2.6.10 bundle audit must reject JSON contract changes");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("Context Pack seven-file structure"), "v2.6.10 bundle audit must preserve seven-file structure");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("`check --input <dir> --json` top-level shape"), "v2.6.10 bundle audit must preserve checker JSON shape");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("Resume JSON contract"), "v2.6.10 bundle audit must preserve resume JSON contract");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("Doctor JSON contract"), "v2.6.10 bundle audit must preserve doctor JSON contract");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("Export JSON contract"), "v2.6.10 bundle audit must preserve export JSON contract");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("does not implement Status"), "v2.6.10 bundle audit must reject status implementation");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("Workflow Runner"), "v2.6.10 bundle audit must reject workflow runner scope");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("Continuation Harness Lite"), "v2.6.10 bundle audit must keep continuation harness as future-only");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("provider request"), "v2.6.10 bundle audit must reject provider request scope");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("runtime integration"), "v2.6.10 bundle audit must reject runtime scope");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("MCP server/tools"), "v2.6.10 bundle audit must reject MCP scope");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("schema-v2"), "v2.6.10 bundle audit must reject schema-v2");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("hosted memory"), "v2.6.10 bundle audit must reject hosted memory");
  assert(contextPackPreReleaseBundleAuditV2610Doc.includes("provider_probe_status=skipped"), "v2.6.10 bundle audit must preserve skipped provider gate");
  assert(!/(^|[^A-Za-z])[A-Za-z]:[\\/]/.test(contextPackPreReleaseBundleAuditV2610Doc), "v2.6.10 bundle audit must not expose drive-letter absolute paths");
  assert(!/\\\\/.test(contextPackPreReleaseBundleAuditV2610Doc), "v2.6.10 bundle audit must not expose UNC paths");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("Context Pack Feature Feasibility Spike v2.6.11"), "v2.6.11 feasibility spike doc must have stable title");
  assertIncludesPhrase(contextPackFeatureFeasibilitySpikeV2611Doc, "feasibility spike only, not a release", "v2.6.11 feasibility spike must avoid release claims");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("feature_candidate: Continuation Harness Lite"), "v2.6.11 feasibility spike must name the candidate");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("implementation_status: not_started"), "v2.6.11 feasibility spike must keep implementation not started");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("release_closeout_status: not_started"), "v2.6.11 feasibility spike must keep release closeout not started");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("push_status: not_started"), "v2.6.11 feasibility spike must keep push not started");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("tag_status: not_started"), "v2.6.11 feasibility spike must keep tag not started");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("release_status: not_started"), "v2.6.11 feasibility spike must keep release not started");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("Do real users need a narrower helper around context-pack -> check -> resume -> live recheck?"), "v2.6.11 feasibility spike must define the core question");
  assertIncludesPhrase(contextPackFeatureFeasibilitySpikeV2611Doc, "repeatedly show the same blocking or high-frequency confusing friction", "v2.6.11 feasibility spike must gate future work on repeated friction");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("Keep `check` as the pack validity gate"), "v2.6.11 feasibility spike must preserve check role");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("Keep `resume` as the copyable next-window prompt surface"), "v2.6.11 feasibility spike must preserve resume role");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("Keep `doctor` as live repo comparison, not always-on Status"), "v2.6.11 feasibility spike must preserve doctor role");
  assertIncludesPhrase(contextPackFeatureFeasibilitySpikeV2611Doc, "does not define a command name, output format, JSON shape, schema, or runtime behavior", "v2.6.11 feasibility spike must avoid implementation details");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("Status"), "v2.6.11 feasibility spike must reject status scope");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("Workflow Runner"), "v2.6.11 feasibility spike must reject workflow runner scope");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("Provider request") || contextPackFeatureFeasibilitySpikeV2611Doc.includes("provider request"), "v2.6.11 feasibility spike must reject provider requests");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("Runtime integration") || contextPackFeatureFeasibilitySpikeV2611Doc.includes("runtime integration"), "v2.6.11 feasibility spike must reject runtime scope");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("MCP server"), "v2.6.11 feasibility spike must reject MCP server scope");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("MCP tools"), "v2.6.11 feasibility spike must reject MCP tools scope");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("Schema-v2") || contextPackFeatureFeasibilitySpikeV2611Doc.includes("schema-v2"), "v2.6.11 feasibility spike must reject schema-v2");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("Daemon") || contextPackFeatureFeasibilitySpikeV2611Doc.includes("daemon"), "v2.6.11 feasibility spike must reject daemon scope");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("Watcher") || contextPackFeatureFeasibilitySpikeV2611Doc.includes("watcher"), "v2.6.11 feasibility spike must reject watcher scope");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("Hosted memory") || contextPackFeatureFeasibilitySpikeV2611Doc.includes("hosted memory"), "v2.6.11 feasibility spike must reject hosted memory");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("No new CLI command"), "v2.6.11 feasibility spike must reject new commands");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("No Context Pack seven-file structure change"), "v2.6.11 feasibility spike must preserve seven-file structure");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("No `check --input <dir> --json` top-level shape change"), "v2.6.11 feasibility spike must preserve checker JSON shape");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("No Resume JSON contract change"), "v2.6.11 feasibility spike must preserve resume JSON contract");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("No Doctor JSON contract change"), "v2.6.11 feasibility spike must preserve doctor JSON contract");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("No Export JSON contract change"), "v2.6.11 feasibility spike must preserve export JSON contract");
  assert(contextPackFeatureFeasibilitySpikeV2611Doc.includes("provider_probe_status=skipped"), "v2.6.11 feasibility spike must preserve skipped provider gate");
  assert(!/(^|[^A-Za-z])[A-Za-z]:[\\/]/.test(contextPackFeatureFeasibilitySpikeV2611Doc), "v2.6.11 feasibility spike must not expose drive-letter absolute paths");
  assert(!/\\\\/.test(contextPackFeatureFeasibilitySpikeV2611Doc), "v2.6.11 feasibility spike must not expose UNC paths");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("Context Pack Local Bundle Review / Handoff Rehearsal v2.6.12"), "v2.6.12 bundle review rehearsal doc must have stable title");
  assertIncludesPhrase(contextPackLocalBundleReviewRehearsalV2612Doc, "local adoption evidence, not a release closeout", "v2.6.12 bundle review rehearsal must avoid release closeout claims");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("ahead-9 v2.6.x adoption bundle"), "v2.6.12 bundle review rehearsal must name ahead-9 bundle");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("bundle_status: local_adoption_bundle"), "v2.6.12 bundle review rehearsal must record local bundle status");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("bundle_scope: docs/examples/release-check/adoption polish"), "v2.6.12 bundle review rehearsal must scope bundle");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("release_closeout_status: not_started"), "v2.6.12 bundle review rehearsal must keep release closeout not started");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("push_status: not_started"), "v2.6.12 bundle review rehearsal must keep push not started");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("tag_status: not_started"), "v2.6.12 bundle review rehearsal must keep tag not started");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("release_status: not_started"), "v2.6.12 bundle review rehearsal must keep release not started");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("50c3565") && contextPackLocalBundleReviewRehearsalV2612Doc.includes("75185e6") && contextPackLocalBundleReviewRehearsalV2612Doc.includes("00a787e"), "v2.6.12 bundle review rehearsal must summarize local bundle commits");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("No commit in this bundle is intended to add CLI behavior"), "v2.6.12 bundle review rehearsal must reject CLI behavior changes");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("context_pack_status: generated"), "v2.6.12 bundle review rehearsal must record context pack generation");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("context_pack_git_status: clean"), "v2.6.12 bundle review rehearsal must record clean source state");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("context_pack_included_files: 23"), "v2.6.12 bundle review rehearsal must record included file count");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("context_pack_truncated: false"), "v2.6.12 bundle review rehearsal must record no truncation");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("check_status: passed"), "v2.6.12 bundle review rehearsal must record check pass");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("check_error_count: 0"), "v2.6.12 bundle review rehearsal must record zero check errors");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("check_warning_count: 0"), "v2.6.12 bundle review rehearsal must record zero check warnings");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("resume_status: ready"), "v2.6.12 bundle review rehearsal must record resume ready");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("resume_contract_version: basebrief-resume-v1"), "v2.6.12 bundle review rehearsal must preserve resume contract version");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("resume_prompt_contains: Continuation rules:"), "v2.6.12 bundle review rehearsal must record starter continuation rules");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("doctor_status: passed"), "v2.6.12 bundle review rehearsal must record doctor pass");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("doctor_contract_version: basebrief-doctor-v1"), "v2.6.12 bundle review rehearsal must preserve doctor contract version");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("doctor_info_findings: doctor.live-recheck-required"), "v2.6.12 bundle review rehearsal must record doctor live recheck info");
  assertIncludesPhrase(contextPackLocalBundleReviewRehearsalV2612Doc, "did not reproduce blocking or high-frequency confusing friction", "v2.6.12 bundle review rehearsal must record no repeated friction");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("continuation_harness_lite_status: not_started"), "v2.6.12 bundle review rehearsal must keep continuation harness not started");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("status_command_status: not_started"), "v2.6.12 bundle review rehearsal must keep status command not started");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("workflow_runner_status: not_started"), "v2.6.12 bundle review rehearsal must keep workflow runner not started");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("feature_implementation_status: not_started"), "v2.6.12 bundle review rehearsal must keep feature implementation not started");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("No new CLI command"), "v2.6.12 bundle review rehearsal must reject new commands");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("No Context Pack seven-file structure change"), "v2.6.12 bundle review rehearsal must preserve seven-file structure");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("No `check --input <dir> --json` top-level shape change"), "v2.6.12 bundle review rehearsal must preserve checker JSON shape");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("No Resume JSON contract change"), "v2.6.12 bundle review rehearsal must preserve resume JSON contract");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("No Doctor JSON contract change"), "v2.6.12 bundle review rehearsal must preserve doctor JSON contract");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("No Export JSON contract change"), "v2.6.12 bundle review rehearsal must preserve export JSON contract");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("No Continuation Harness Lite implementation"), "v2.6.12 bundle review rehearsal must reject harness implementation");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("No provider request"), "v2.6.12 bundle review rehearsal must reject provider requests");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("No runtime integration"), "v2.6.12 bundle review rehearsal must reject runtime scope");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("No MCP server"), "v2.6.12 bundle review rehearsal must reject MCP server scope");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("No MCP tools"), "v2.6.12 bundle review rehearsal must reject MCP tools scope");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("No schema-v2"), "v2.6.12 bundle review rehearsal must reject schema-v2");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("No daemon"), "v2.6.12 bundle review rehearsal must reject daemon scope");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("No watcher"), "v2.6.12 bundle review rehearsal must reject watcher scope");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("No hosted memory"), "v2.6.12 bundle review rehearsal must reject hosted memory");
  assert(contextPackLocalBundleReviewRehearsalV2612Doc.includes("provider_probe_status=skipped"), "v2.6.12 bundle review rehearsal must preserve skipped provider gate");
  assert(!/(^|[^A-Za-z])[A-Za-z]:[\\/]/.test(contextPackLocalBundleReviewRehearsalV2612Doc), "v2.6.12 bundle review rehearsal must not expose drive-letter absolute paths");
  assert(!/\\\\/.test(contextPackLocalBundleReviewRehearsalV2612Doc), "v2.6.12 bundle review rehearsal must not expose UNC paths");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("Context Pack Local Bundle Compression v2.6.13"), "v2.6.13 bundle compression doc must have stable title");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("local ahead-10 v2.6.x adoption bundle"), "v2.6.13 bundle compression must name ahead-10 bundle");
  assertIncludesPhrase(contextPackLocalBundleCompressionV2613Doc, "local adoption sedimentation, not a frequent release line", "v2.6.13 bundle compression must avoid frequent release framing");
  assertIncludesPhrase(contextPackLocalBundleCompressionV2613Doc, "not a frequent release line, release closeout, push, tag", "v2.6.13 bundle compression must reject release actions");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("bundle_status: local_adoption_sedimentation"), "v2.6.13 bundle compression must record sedimentation status");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("bundle_scope: ahead-10 docs/examples/release-check/adoption polish"), "v2.6.13 bundle compression must scope ahead-10 bundle");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("future_release_shape: larger version package, not frequent v2.6.x publishing"), "v2.6.13 bundle compression must prefer larger release package");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("release_closeout_status: not_started"), "v2.6.13 bundle compression must keep release closeout not started");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("push_status: not_started"), "v2.6.13 bundle compression must keep push not started");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("tag_status: not_started"), "v2.6.13 bundle compression must keep tag not started");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("release_status: not_started"), "v2.6.13 bundle compression must keep release not started");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("starter wording repair"), "v2.6.13 bundle compression must include starter wording repair group");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("adoption examples/evidence"), "v2.6.13 bundle compression must include adoption examples group");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("external alignment/feature gates"), "v2.6.13 bundle compression must include external alignment group");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("bundle audit + rehearsal verification"), "v2.6.13 bundle compression must include audit and rehearsal group");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("00a787e") && contextPackLocalBundleCompressionV2613Doc.includes("754e808"), "v2.6.13 bundle compression must cite local bundle endpoints");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("Future release notes may reuse this compressed summary"), "v2.6.13 bundle compression must provide reusable release-note summary");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("new runtime behavior") && contextPackLocalBundleCompressionV2613Doc.includes("Doctor interpretation"), "v2.6.13 bundle compression must summarize future release-note wording");
  assertIncludesPhrase(contextPackLocalBundleCompressionV2613Doc, "does not support implementing Continuation Harness", "v2.6.13 bundle compression must reject harness implementation");
  assertIncludesPhrase(contextPackLocalBundleCompressionV2613Doc, "Status, Workflow Runner, or any JSON contract change", "v2.6.13 bundle compression must reject status runner and JSON changes");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("continuation_harness_lite_status: not_started"), "v2.6.13 bundle compression must keep harness not started");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("status_command_status: not_started"), "v2.6.13 bundle compression must keep status command not started");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("workflow_runner_status: not_started"), "v2.6.13 bundle compression must keep workflow runner not started");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("json_contract_change_status: not_started"), "v2.6.13 bundle compression must keep JSON contract change not started");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("No new CLI command"), "v2.6.13 bundle compression must reject new commands");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("No Context Pack seven-file structure change"), "v2.6.13 bundle compression must preserve seven-file structure");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("No `check --input <dir> --json` top-level shape change"), "v2.6.13 bundle compression must preserve checker JSON shape");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("No Resume JSON contract change"), "v2.6.13 bundle compression must preserve resume JSON contract");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("No Doctor JSON contract change"), "v2.6.13 bundle compression must preserve doctor JSON contract");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("No Export JSON contract change"), "v2.6.13 bundle compression must preserve export JSON contract");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("No Status command"), "v2.6.13 bundle compression must reject status command");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("No Workflow Runner"), "v2.6.13 bundle compression must reject workflow runner");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("No Continuation Harness Lite implementation"), "v2.6.13 bundle compression must reject harness implementation");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("No provider request"), "v2.6.13 bundle compression must reject provider requests");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("No runtime integration"), "v2.6.13 bundle compression must reject runtime integration");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("No MCP server"), "v2.6.13 bundle compression must reject MCP server");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("No MCP tools"), "v2.6.13 bundle compression must reject MCP tools");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("No plugin"), "v2.6.13 bundle compression must reject plugin scope");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("No schema-v2"), "v2.6.13 bundle compression must reject schema-v2");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("No daemon"), "v2.6.13 bundle compression must reject daemon");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("No watcher"), "v2.6.13 bundle compression must reject watcher");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("No hosted memory"), "v2.6.13 bundle compression must reject hosted memory");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("No push, tag, release"), "v2.6.13 bundle compression must reject publication actions");
  assert(contextPackLocalBundleCompressionV2613Doc.includes("provider_probe_status=skipped"), "v2.6.13 bundle compression must preserve skipped provider gate");
  assert(!/(^|[^A-Za-z])[A-Za-z]:[\\/]/.test(contextPackLocalBundleCompressionV2613Doc), "v2.6.13 bundle compression must not expose drive-letter absolute paths");
  assert(!/\\\\/.test(contextPackLocalBundleCompressionV2613Doc), "v2.6.13 bundle compression must not expose UNC paths");
  assert(contextPackReleaseCheckMaintainabilityV2614Doc.includes("Context Pack Release-Check Maintainability v2.6.14"), "v2.6.14 release-check maintainability doc must have stable title");
  assertIncludesPhrase(contextPackReleaseCheckMaintainabilityV2614Doc, "local release-check maintainability repair, not a release closeout", "v2.6.14 release-check maintainability must avoid release closeout claims");
  assert(contextPackReleaseCheckMaintainabilityV2614Doc.includes("repair_status: implemented"), "v2.6.14 release-check maintainability must record repair status");
  assert(contextPackReleaseCheckMaintainabilityV2614Doc.includes("repair_scope: release-check whitespace-normalized phrase matching"), "v2.6.14 release-check maintainability must record normalized matching scope");
  assert(contextPackReleaseCheckMaintainabilityV2614Doc.includes("release_closeout_status: not_started"), "v2.6.14 release-check maintainability must keep release closeout not started");
  assert(contextPackReleaseCheckMaintainabilityV2614Doc.includes("push_status: not_started"), "v2.6.14 release-check maintainability must keep push not started");
  assert(contextPackReleaseCheckMaintainabilityV2614Doc.includes("tag_status: not_started"), "v2.6.14 release-check maintainability must keep tag not started");
  assert(contextPackReleaseCheckMaintainabilityV2614Doc.includes("release_status: not_started"), "v2.6.14 release-check maintainability must keep release not started");
  assertIncludesPhrase(contextPackReleaseCheckMaintainabilityV2614Doc, "whitespace-normalized phrase matching", "v2.6.14 release-check maintainability must mention normalized phrase matching");
  assertIncludesPhrase(contextPackReleaseCheckMaintainabilityV2614Doc, "Markdown wrapping should not change the contract", "v2.6.14 release-check maintainability must explain markdown wrapping goal");
  assert(contextPackReleaseCheckMaintainabilityV2614Doc.includes("Do not use it to weaken exact technical literals"), "v2.6.14 release-check maintainability must preserve exact literals");
  assert(contextPackReleaseCheckMaintainabilityV2614Doc.includes("rule IDs") && contextPackReleaseCheckMaintainabilityV2614Doc.includes("contract versions") && contextPackReleaseCheckMaintainabilityV2614Doc.includes("JSON keys"), "v2.6.14 release-check maintainability must list exact literal categories");
  assert(contextPackReleaseCheckMaintainabilityV2614Doc.includes("No new CLI command"), "v2.6.14 release-check maintainability must reject new commands");
  assert(contextPackReleaseCheckMaintainabilityV2614Doc.includes("No `check --input <dir> --json` top-level shape change"), "v2.6.14 release-check maintainability must preserve checker JSON shape");
  assert(contextPackReleaseCheckMaintainabilityV2614Doc.includes("No Status command"), "v2.6.14 release-check maintainability must reject status command");
  assert(contextPackReleaseCheckMaintainabilityV2614Doc.includes("No Workflow Runner"), "v2.6.14 release-check maintainability must reject workflow runner");
  assert(contextPackReleaseCheckMaintainabilityV2614Doc.includes("No Continuation Harness Lite implementation"), "v2.6.14 release-check maintainability must reject harness implementation");
  assert(contextPackReleaseCheckMaintainabilityV2614Doc.includes("No provider request"), "v2.6.14 release-check maintainability must reject provider requests");
  assert(contextPackReleaseCheckMaintainabilityV2614Doc.includes("No runtime integration"), "v2.6.14 release-check maintainability must reject runtime integration");
  assert(contextPackReleaseCheckMaintainabilityV2614Doc.includes("No MCP server"), "v2.6.14 release-check maintainability must reject MCP server");
  assert(contextPackReleaseCheckMaintainabilityV2614Doc.includes("No MCP tools"), "v2.6.14 release-check maintainability must reject MCP tools");
  assert(contextPackReleaseCheckMaintainabilityV2614Doc.includes("No schema-v2"), "v2.6.14 release-check maintainability must reject schema-v2");
  assert(contextPackReleaseCheckMaintainabilityV2614Doc.includes("provider_probe_status=skipped"), "v2.6.14 release-check maintainability must preserve skipped provider gate");
  assert(!/(^|[^A-Za-z])[A-Za-z]:[\\/]/.test(contextPackReleaseCheckMaintainabilityV2614Doc), "v2.6.14 release-check maintainability must not expose drive-letter absolute paths");
  assert(!/\\\\/.test(contextPackReleaseCheckMaintainabilityV2614Doc), "v2.6.14 release-check maintainability must not expose UNC paths");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("Context Pack Major-Release Candidate Shape v2.6.15"), "v2.6.15 major-release candidate shape doc must have stable title");
  assertIncludesPhrase(contextPackMajorReleaseCandidateShapeV2615Doc, "release-candidate shape only, not a release closeout", "v2.6.15 major-release candidate shape must avoid release closeout claims");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("candidate_shape_status: draft_only"), "v2.6.15 major-release candidate shape must stay draft only");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("release_closeout_status: not_started"), "v2.6.15 major-release candidate shape must keep release closeout not started");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("push_status: not_started"), "v2.6.15 major-release candidate shape must keep push not started");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("tag_status: not_started"), "v2.6.15 major-release candidate shape must keep tag not started");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("release_status: not_started"), "v2.6.15 major-release candidate shape must keep release not started");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("First-run adoption polish"), "v2.6.15 major-release candidate shape must include first-run adoption polish");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("Context Pack interpretation"), "v2.6.15 major-release candidate shape must include Context Pack interpretation");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("Diagnostics confidence"), "v2.6.15 major-release candidate shape must include diagnostics confidence");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("Maintenance hardening"), "v2.6.15 major-release candidate shape must include maintenance hardening");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("Per-slice v2.6.1 through v2.6.15 chronology"), "v2.6.15 major-release candidate shape must keep chronology in dogfooding evidence");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("Individual local commit hashes"), "v2.6.15 major-release candidate shape must keep commit hashes out of release notes");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("Private output paths or raw generated handoff contents"), "v2.6.15 major-release candidate shape must reject private output in release notes");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("Detailed release-check assertion wording"), "v2.6.15 major-release candidate shape must keep assertion wording out of release notes");
  assertIncludesPhrase(contextPackMajorReleaseCandidateShapeV2615Doc, "Future major release notes may reuse this concise shape", "v2.6.15 major-release candidate shape must provide release-note draft");
  assertIncludesPhrase(contextPackMajorReleaseCandidateShapeV2615Doc, "does not add hosted memory, provider requests, runtime integration, MCP tools, Status, Workflow Runner, Continuation Harness implementation, or JSON contract changes", "v2.6.15 release-note draft must preserve boundary wording");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("publish_status: not_started"), "v2.6.15 major-release candidate shape must keep publish not started");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("major_release_status: not_started"), "v2.6.15 major-release candidate shape must keep major release not started");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("continuation_harness_lite_status: not_started"), "v2.6.15 major-release candidate shape must keep harness not started");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("status_command_status: not_started"), "v2.6.15 major-release candidate shape must keep status command not started");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("workflow_runner_status: not_started"), "v2.6.15 major-release candidate shape must keep workflow runner not started");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("json_contract_change_status: not_started"), "v2.6.15 major-release candidate shape must keep JSON contract change not started");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("No new CLI command"), "v2.6.15 major-release candidate shape must reject new commands");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("No Context Pack seven-file structure change"), "v2.6.15 major-release candidate shape must preserve seven-file structure");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("No `check --input <dir> --json` top-level shape change"), "v2.6.15 major-release candidate shape must preserve checker JSON shape");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("No Resume JSON contract change"), "v2.6.15 major-release candidate shape must preserve resume JSON contract");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("No Doctor JSON contract change"), "v2.6.15 major-release candidate shape must preserve doctor JSON contract");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("No Export JSON contract change"), "v2.6.15 major-release candidate shape must preserve export JSON contract");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("No Status command"), "v2.6.15 major-release candidate shape must reject status command");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("No Workflow Runner"), "v2.6.15 major-release candidate shape must reject workflow runner");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("No Continuation Harness Lite implementation"), "v2.6.15 major-release candidate shape must reject harness implementation");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("No provider request"), "v2.6.15 major-release candidate shape must reject provider requests");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("No runtime integration"), "v2.6.15 major-release candidate shape must reject runtime integration");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("No MCP server"), "v2.6.15 major-release candidate shape must reject MCP server");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("No MCP tools"), "v2.6.15 major-release candidate shape must reject MCP tools");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("No schema-v2"), "v2.6.15 major-release candidate shape must reject schema-v2");
  assert(contextPackMajorReleaseCandidateShapeV2615Doc.includes("provider_probe_status=skipped"), "v2.6.15 major-release candidate shape must preserve skipped provider gate");
  assert(!/(^|[^A-Za-z])[A-Za-z]:[\\/]/.test(contextPackMajorReleaseCandidateShapeV2615Doc), "v2.6.15 major-release candidate shape must not expose drive-letter absolute paths");
  assert(!/\\\\/.test(contextPackMajorReleaseCandidateShapeV2615Doc), "v2.6.15 major-release candidate shape must not expose UNC paths");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("Context Pack Continuation Harness Decision Spec v2.6.16"), "v2.6.16 harness decision spec doc must have stable title");
  assertIncludesPhrase(contextPackContinuationHarnessDecisionSpecV2616Doc, "local decision spec only, not a feature implementation", "v2.6.16 harness decision spec must avoid feature claims");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("decision_spec_status: draft_only"), "v2.6.16 harness decision spec must stay draft only");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("implementation_status: not_started"), "v2.6.16 harness decision spec must keep implementation not started");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("release_closeout_status: not_started"), "v2.6.16 harness decision spec must keep release closeout not started");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("push_status: not_started"), "v2.6.16 harness decision spec must keep push not started");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("tag_status: not_started"), "v2.6.16 harness decision spec must keep tag not started");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("release_status: not_started"), "v2.6.16 harness decision spec must keep release not started");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("continuation_harness_lite_status: not_started"), "v2.6.16 harness decision spec must keep harness not started");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("status_command_status: not_started"), "v2.6.16 harness decision spec must keep status command not started");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("workflow_runner_status: not_started"), "v2.6.16 harness decision spec must keep workflow runner not started");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("json_contract_change_status: not_started"), "v2.6.16 harness decision spec must keep JSON contract change not started");
  assertIncludesPhrase(contextPackContinuationHarnessDecisionSpecV2616Doc, "context-pack -> check -> resume -> live recheck", "v2.6.16 harness decision spec must define sequence under review");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("blocking_threshold: at least three public-safe real handoff observations"), "v2.6.16 harness decision spec must define blocking threshold");
  assertIncludesPhrase(contextPackContinuationHarnessDecisionSpecV2616Doc, "confusion_threshold: repeated confusing friction survives a docs/examples repair attempt", "v2.6.16 harness decision spec must define confusion threshold");
  assertIncludesPhrase(contextPackContinuationHarnessDecisionSpecV2616Doc, "command_threshold: the user cannot reliably choose between `check`, `resume`, and `doctor`", "v2.6.16 harness decision spec must define command threshold");
  assertIncludesPhrase(contextPackContinuationHarnessDecisionSpecV2616Doc, "safety_threshold: the proposed helper can preserve live recheck", "v2.6.16 harness decision spec must define safety threshold");
  assertIncludesPhrase(contextPackContinuationHarnessDecisionSpecV2616Doc, "Do not implement Continuation Harness Lite yet", "v2.6.16 harness decision spec must keep harness closed");
  assertIncludesPhrase(contextPackContinuationHarnessDecisionSpecV2616Doc, "No new CLI command", "v2.6.16 harness decision spec must reject new commands");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("No Context Pack seven-file structure change"), "v2.6.16 harness decision spec must preserve seven-file structure");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("No `check --input <dir> --json` top-level shape change"), "v2.6.16 harness decision spec must preserve checker JSON shape");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("No Resume JSON contract change"), "v2.6.16 harness decision spec must preserve resume JSON contract");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("No Doctor JSON contract change"), "v2.6.16 harness decision spec must preserve doctor JSON contract");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("No Export JSON contract change"), "v2.6.16 harness decision spec must preserve export JSON contract");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("No Status command"), "v2.6.16 harness decision spec must reject status command");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("No Workflow Runner"), "v2.6.16 harness decision spec must reject workflow runner");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("No Continuation Harness Lite implementation"), "v2.6.16 harness decision spec must reject harness implementation");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("No provider request"), "v2.6.16 harness decision spec must reject provider requests");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("No runtime integration"), "v2.6.16 harness decision spec must reject runtime integration");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("No MCP server"), "v2.6.16 harness decision spec must reject MCP server");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("No MCP tools"), "v2.6.16 harness decision spec must reject MCP tools");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("No plugin"), "v2.6.16 harness decision spec must reject plugin scope");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("No schema-v2"), "v2.6.16 harness decision spec must reject schema-v2");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("No hosted memory"), "v2.6.16 harness decision spec must reject hosted memory");
  assert(contextPackContinuationHarnessDecisionSpecV2616Doc.includes("provider_probe_status=skipped"), "v2.6.16 harness decision spec must preserve skipped provider gate");
  assert(!/(^|[^A-Za-z])[A-Za-z]:[\\/]/.test(contextPackContinuationHarnessDecisionSpecV2616Doc), "v2.6.16 harness decision spec must not expose drive-letter absolute paths");
  assert(!/\\\\/.test(contextPackContinuationHarnessDecisionSpecV2616Doc), "v2.6.16 harness decision spec must not expose UNC paths");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("Context Pack Ahead-14 Bundle Review v2.6.17"), "v2.6.17 ahead-14 bundle review doc must have stable title");
  assertIncludesPhrase(contextPackAhead14BundleReviewV2617Doc, "local bundle review only, not a release closeout", "v2.6.17 ahead-14 bundle review must avoid release closeout claims");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("bundle_review_status: draft_only"), "v2.6.17 ahead-14 bundle review must stay draft only");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("local_bundle_status: ahead-14 adoption sedimentation"), "v2.6.17 ahead-14 bundle review must record ahead-14 status");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("release_closeout_status: not_started"), "v2.6.17 ahead-14 bundle review must keep release closeout not started");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("push_status: not_started"), "v2.6.17 ahead-14 bundle review must keep push not started");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("tag_status: not_started"), "v2.6.17 ahead-14 bundle review must keep tag not started");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("release_status: not_started"), "v2.6.17 ahead-14 bundle review must keep release not started");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("implementation_status: not_started"), "v2.6.17 ahead-14 bundle review must keep implementation not started");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("continuation_harness_lite_status: not_started"), "v2.6.17 ahead-14 bundle review must keep harness not started");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("status_command_status: not_started"), "v2.6.17 ahead-14 bundle review must keep status command not started");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("workflow_runner_status: not_started"), "v2.6.17 ahead-14 bundle review must keep workflow runner not started");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("json_contract_change_status: not_started"), "v2.6.17 ahead-14 bundle review must keep JSON contract change not started");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("## Release-Note Candidates"), "v2.6.17 ahead-14 bundle review must include release-note candidates");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("## Dogfooding-Only Evidence"), "v2.6.17 ahead-14 bundle review must include dogfooding-only evidence");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("## Future Feature Gates"), "v2.6.17 ahead-14 bundle review must include future feature gates");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("First-run adoption polish") && contextPackAhead14BundleReviewV2617Doc.includes("Context Pack interpretation") && contextPackAhead14BundleReviewV2617Doc.includes("Diagnostics confidence") && contextPackAhead14BundleReviewV2617Doc.includes("Maintenance hardening"), "v2.6.17 ahead-14 bundle review must classify release-note candidates");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("Per-slice v2.6.x local chronology") && contextPackAhead14BundleReviewV2617Doc.includes("Private output paths") && contextPackAhead14BundleReviewV2617Doc.includes("Detailed release-check assertion wording"), "v2.6.17 ahead-14 bundle review must classify dogfooding-only evidence");
  assertIncludesPhrase(contextPackAhead14BundleReviewV2617Doc, "Keep the ahead-14 bundle local", "v2.6.17 ahead-14 bundle review must keep bundle local");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("No new CLI command"), "v2.6.17 ahead-14 bundle review must reject new commands");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("No Context Pack seven-file structure change"), "v2.6.17 ahead-14 bundle review must preserve seven-file structure");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("No `check --input <dir> --json` top-level shape change"), "v2.6.17 ahead-14 bundle review must preserve checker JSON shape");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("No Resume JSON contract change"), "v2.6.17 ahead-14 bundle review must preserve resume JSON contract");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("No Doctor JSON contract change"), "v2.6.17 ahead-14 bundle review must preserve doctor JSON contract");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("No Export JSON contract change"), "v2.6.17 ahead-14 bundle review must preserve export JSON contract");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("No Status command"), "v2.6.17 ahead-14 bundle review must reject status command");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("No Workflow Runner"), "v2.6.17 ahead-14 bundle review must reject workflow runner");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("No Continuation Harness Lite implementation"), "v2.6.17 ahead-14 bundle review must reject harness implementation");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("No provider request"), "v2.6.17 ahead-14 bundle review must reject provider requests");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("No runtime integration"), "v2.6.17 ahead-14 bundle review must reject runtime integration");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("No MCP server"), "v2.6.17 ahead-14 bundle review must reject MCP server");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("No MCP tools"), "v2.6.17 ahead-14 bundle review must reject MCP tools");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("No plugin"), "v2.6.17 ahead-14 bundle review must reject plugin scope");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("No schema-v2"), "v2.6.17 ahead-14 bundle review must reject schema-v2");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("No hosted memory"), "v2.6.17 ahead-14 bundle review must reject hosted memory");
  assert(contextPackAhead14BundleReviewV2617Doc.includes("provider_probe_status=skipped"), "v2.6.17 ahead-14 bundle review must preserve skipped provider gate");
  assert(!/(^|[^A-Za-z])[A-Za-z]:[\\/]/.test(contextPackAhead14BundleReviewV2617Doc), "v2.6.17 ahead-14 bundle review must not expose drive-letter absolute paths");
  assert(!/\\\\/.test(contextPackAhead14BundleReviewV2617Doc), "v2.6.17 ahead-14 bundle review must not expose UNC paths");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("Context Pack Minimal Feature Candidate Decision v2.6.18"), "v2.6.18 minimal feature candidate decision doc must have stable title");
  assertIncludesPhrase(contextPackMinimalFeatureCandidateDecisionV2618Doc, "local feature-candidate decision only, not an implementation", "v2.6.18 minimal feature candidate decision must avoid implementation claims");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("feature_candidate_status: design_sketch_candidate"), "v2.6.18 minimal feature candidate decision must record design sketch candidate");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("implementation_status: not_started"), "v2.6.18 minimal feature candidate decision must keep implementation not started");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("release_closeout_status: not_started"), "v2.6.18 minimal feature candidate decision must keep release closeout not started");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("push_status: not_started"), "v2.6.18 minimal feature candidate decision must keep push not started");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("tag_status: not_started"), "v2.6.18 minimal feature candidate decision must keep tag not started");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("release_status: not_started"), "v2.6.18 minimal feature candidate decision must keep release not started");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("continuation_harness_lite_status: design_sketch_candidate"), "v2.6.18 minimal feature candidate decision must keep harness as design sketch candidate");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("status_command_status: not_started"), "v2.6.18 minimal feature candidate decision must keep status command not started");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("workflow_runner_status: not_started"), "v2.6.18 minimal feature candidate decision must keep workflow runner not started");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("json_contract_change_status: not_started"), "v2.6.18 minimal feature candidate decision must keep JSON contract change not started");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("## Candidate Ranking"), "v2.6.18 minimal feature candidate decision must include candidate ranking");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("Continuation Harness Lite design sketch: keep watching"), "v2.6.18 minimal feature candidate decision must keep harness watching");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("Status command: reject for now"), "v2.6.18 minimal feature candidate decision must reject status command");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("Workflow Runner Lite: reject for now"), "v2.6.18 minimal feature candidate decision must reject workflow runner");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("Doctor expansion: reject for now"), "v2.6.18 minimal feature candidate decision must reject doctor expansion");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("JSON contract change: reject for now"), "v2.6.18 minimal feature candidate decision must reject JSON contract change");
  assertIncludesPhrase(contextPackMinimalFeatureCandidateDecisionV2618Doc, "inherited Context Pack material through `check`, `resume`, and live recheck", "v2.6.18 minimal feature candidate decision must define harness uncertainty");
  assertIncludesPhrase(contextPackMinimalFeatureCandidateDecisionV2618Doc, "At least three public-safe real handoffs show the same blocking or high-frequency confusing friction", "v2.6.18 minimal feature candidate decision must define evidence count threshold");
  assertIncludesPhrase(contextPackMinimalFeatureCandidateDecisionV2618Doc, "friction survives a docs/examples/release-check repair attempt", "v2.6.18 minimal feature candidate decision must require repair attempt before implementation");
  assertIncludesPhrase(contextPackMinimalFeatureCandidateDecisionV2618Doc, "sequencing `context-pack -> check -> resume -> live recheck`", "v2.6.18 minimal feature candidate decision must require sequence-specific friction");
  assertIncludesPhrase(contextPackMinimalFeatureCandidateDecisionV2618Doc, "real first-run/handoff validation pass", "v2.6.18 minimal feature candidate decision must point to validation pass");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("No new CLI command"), "v2.6.18 minimal feature candidate decision must reject new commands");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("No Context Pack seven-file structure change"), "v2.6.18 minimal feature candidate decision must preserve seven-file structure");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("No `check --input <dir> --json` top-level shape change"), "v2.6.18 minimal feature candidate decision must preserve checker JSON shape");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("No Resume JSON contract change"), "v2.6.18 minimal feature candidate decision must preserve resume JSON contract");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("No Doctor JSON contract change"), "v2.6.18 minimal feature candidate decision must preserve doctor JSON contract");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("No Export JSON contract change"), "v2.6.18 minimal feature candidate decision must preserve export JSON contract");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("No Status command"), "v2.6.18 minimal feature candidate decision must reject status command");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("No Workflow Runner"), "v2.6.18 minimal feature candidate decision must reject workflow runner");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("No Continuation Harness Lite implementation"), "v2.6.18 minimal feature candidate decision must reject harness implementation");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("No provider request"), "v2.6.18 minimal feature candidate decision must reject provider requests");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("No runtime integration"), "v2.6.18 minimal feature candidate decision must reject runtime integration");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("No MCP server"), "v2.6.18 minimal feature candidate decision must reject MCP server");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("No MCP tools"), "v2.6.18 minimal feature candidate decision must reject MCP tools");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("No plugin"), "v2.6.18 minimal feature candidate decision must reject plugin scope");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("No schema-v2"), "v2.6.18 minimal feature candidate decision must reject schema-v2");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("No hosted memory"), "v2.6.18 minimal feature candidate decision must reject hosted memory");
  assert(contextPackMinimalFeatureCandidateDecisionV2618Doc.includes("provider_probe_status=skipped"), "v2.6.18 minimal feature candidate decision must preserve skipped provider gate");
  assert(!/(^|[^A-Za-z])[A-Za-z]:[\\/]/.test(contextPackMinimalFeatureCandidateDecisionV2618Doc), "v2.6.18 minimal feature candidate decision must not expose drive-letter absolute paths");
  assert(!/\\\\/.test(contextPackMinimalFeatureCandidateDecisionV2618Doc), "v2.6.18 minimal feature candidate decision must not expose UNC paths");
  assert(contextPackFirstRunHandoffValidationDoc.includes("Context Pack First-Run / Handoff Validation"), "first-run handoff validation doc must have stable title");
  assertIncludesPhrase(contextPackFirstRunHandoffValidationDoc, "local validation evidence only, not a release closeout", "first-run handoff validation must avoid release closeout claims");
  assert(contextPackFirstRunHandoffValidationDoc.includes("validation_status: passed"), "first-run handoff validation must record passed status");
  assert(contextPackFirstRunHandoffValidationDoc.includes("blocking_friction_status: not_observed"), "first-run handoff validation must record no blocking friction");
  assert(contextPackFirstRunHandoffValidationDoc.includes("confusing_friction_status: not_observed"), "first-run handoff validation must record no confusing friction");
  assert(contextPackFirstRunHandoffValidationDoc.includes("feature_trigger_status: not_met"), "first-run handoff validation must keep feature trigger unmet");
  assert(contextPackFirstRunHandoffValidationDoc.includes("implementation_status: not_started"), "first-run handoff validation must keep implementation not started");
  assert(contextPackFirstRunHandoffValidationDoc.includes("release_closeout_status: not_started"), "first-run handoff validation must keep release closeout not started");
  assert(contextPackFirstRunHandoffValidationDoc.includes("push_status: not_started"), "first-run handoff validation must keep push not started");
  assert(contextPackFirstRunHandoffValidationDoc.includes("tag_status: not_started"), "first-run handoff validation must keep tag not started");
  assert(contextPackFirstRunHandoffValidationDoc.includes("release_status: not_started"), "first-run handoff validation must keep release not started");
  assert(contextPackFirstRunHandoffValidationDoc.includes("continuation_harness_lite_status: design_sketch_candidate_only"), "first-run handoff validation must keep harness as design sketch only");
  assert(contextPackFirstRunHandoffValidationDoc.includes("status_command_status: not_started"), "first-run handoff validation must keep status command not started");
  assert(contextPackFirstRunHandoffValidationDoc.includes("workflow_runner_status: not_started"), "first-run handoff validation must keep workflow runner not started");
  assert(contextPackFirstRunHandoffValidationDoc.includes("json_contract_change_status: not_started"), "first-run handoff validation must keep JSON contract change not started");
  assertIncludesPhrase(contextPackFirstRunHandoffValidationDoc, "context-pack -> check -> resume -> doctor", "first-run handoff validation must record validation path");
  assert(contextPackFirstRunHandoffValidationDoc.includes("node scripts/basebrief.js context-pack --repo . --output-dir tests/outputs/private/context-pack-validation --json"), "first-run handoff validation must record context-pack command");
  assert(contextPackFirstRunHandoffValidationDoc.includes("node scripts/basebrief.js check --input tests/outputs/private/context-pack-validation --json"), "first-run handoff validation must record check command");
  assert(contextPackFirstRunHandoffValidationDoc.includes("node scripts/basebrief.js resume --input tests/outputs/private/context-pack-validation"), "first-run handoff validation must record resume command");
  assert(contextPackFirstRunHandoffValidationDoc.includes("node scripts/basebrief.js doctor --repo . --context-pack tests/outputs/private/context-pack-validation --json"), "first-run handoff validation must record doctor command");
  assert(contextPackFirstRunHandoffValidationDoc.includes("`check` returned `status=passed`, `errorCount=0`, `warningCount=0`"), "first-run handoff validation must record clean check result");
  assert(contextPackFirstRunHandoffValidationDoc.includes("`resume` produced a copyable prompt and preserved `Continuation rules:`"), "first-run handoff validation must record resume starter result");
  assert(contextPackFirstRunHandoffValidationDoc.includes("`v2.0 Context Pack Lite implementation slice`"), "first-run handoff validation must record old starter wording absence");
  assert(contextPackFirstRunHandoffValidationDoc.includes("contractVersion=basebrief-doctor-v1") && contextPackFirstRunHandoffValidationDoc.includes("doctor.live-recheck-required"), "first-run handoff validation must record doctor result");
  assertIncludesPhrase(contextPackFirstRunHandoffValidationDoc, "This pass does not meet the threshold for implementing Continuation Harness Lite", "first-run handoff validation must keep harness trigger closed");
  assert(contextPackFirstRunHandoffValidationDoc.includes("No new CLI command"), "first-run handoff validation must reject new commands");
  assert(contextPackFirstRunHandoffValidationDoc.includes("No Context Pack seven-file structure change"), "first-run handoff validation must preserve seven-file structure");
  assert(contextPackFirstRunHandoffValidationDoc.includes("No `check --input <dir> --json` top-level shape change"), "first-run handoff validation must preserve checker JSON shape");
  assert(contextPackFirstRunHandoffValidationDoc.includes("No Resume JSON contract change"), "first-run handoff validation must preserve resume JSON contract");
  assert(contextPackFirstRunHandoffValidationDoc.includes("No Doctor JSON contract change"), "first-run handoff validation must preserve doctor JSON contract");
  assert(contextPackFirstRunHandoffValidationDoc.includes("No Export JSON contract change"), "first-run handoff validation must preserve export JSON contract");
  assert(contextPackFirstRunHandoffValidationDoc.includes("No Status command"), "first-run handoff validation must reject status command");
  assert(contextPackFirstRunHandoffValidationDoc.includes("No Workflow Runner"), "first-run handoff validation must reject workflow runner");
  assert(contextPackFirstRunHandoffValidationDoc.includes("No Continuation Harness Lite implementation"), "first-run handoff validation must reject harness implementation");
  assert(contextPackFirstRunHandoffValidationDoc.includes("No provider request"), "first-run handoff validation must reject provider requests");
  assert(contextPackFirstRunHandoffValidationDoc.includes("No runtime integration"), "first-run handoff validation must reject runtime integration");
  assert(contextPackFirstRunHandoffValidationDoc.includes("No MCP server"), "first-run handoff validation must reject MCP server");
  assert(contextPackFirstRunHandoffValidationDoc.includes("No MCP tools"), "first-run handoff validation must reject MCP tools");
  assert(contextPackFirstRunHandoffValidationDoc.includes("No plugin"), "first-run handoff validation must reject plugin scope");
  assert(contextPackFirstRunHandoffValidationDoc.includes("No schema-v2"), "first-run handoff validation must reject schema-v2");
  assert(contextPackFirstRunHandoffValidationDoc.includes("No hosted memory"), "first-run handoff validation must reject hosted memory");
  assert(contextPackFirstRunHandoffValidationDoc.includes("provider_probe_status=skipped"), "first-run handoff validation must preserve skipped provider gate");
  assert(!/(^|[^A-Za-z])[A-Za-z]:[\\/]/.test(contextPackFirstRunHandoffValidationDoc), "first-run handoff validation must not expose drive-letter absolute paths");
  assert(!/\\\\/.test(contextPackFirstRunHandoffValidationDoc), "first-run handoff validation must not expose UNC paths");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("Context Pack Continuation Harness Lite Design Sketch"), "harness lite design sketch doc must have stable title");
  assertIncludesPhrase(contextPackContinuationHarnessLiteDesignSketchDoc, "local design sketch only, not an implementation", "harness lite design sketch must avoid implementation claims");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("design_sketch_status: draft_only"), "harness lite design sketch must stay draft only");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("implementation_status: not_started"), "harness lite design sketch must keep implementation not started");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("command_status: not_started"), "harness lite design sketch must keep command not started");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("release_closeout_status: not_started"), "harness lite design sketch must keep release closeout not started");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("push_status: not_started"), "harness lite design sketch must keep push not started");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("tag_status: not_started"), "harness lite design sketch must keep tag not started");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("release_status: not_started"), "harness lite design sketch must keep release not started");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("continuation_harness_lite_status: design_sketch_only"), "harness lite design sketch must keep harness as design sketch only");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("status_command_status: not_started"), "harness lite design sketch must keep status command not started");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("workflow_runner_status: not_started"), "harness lite design sketch must keep workflow runner not started");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("json_contract_change_status: not_started"), "harness lite design sketch must keep JSON contract change not started");
  assertIncludesPhrase(contextPackContinuationHarnessLiteDesignSketchDoc, "paper harness, not a CLI command or product surface", "harness lite design sketch must stay paper harness");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("Own the context window"), "harness lite design sketch must include context-window principle");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("Keep the reducer stateless"), "harness lite design sketch must include stateless reducer principle");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("Prefer handoff artifacts"), "harness lite design sketch must include handoff artifact principle");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("Practice memory hygiene"), "harness lite design sketch must include memory hygiene principle");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("Compress by decision"), "harness lite design sketch must include decision compression principle");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("Read the Context Pack as inherited context"), "harness lite design sketch must include read step");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("Run the existing pack validity gate with `check`"), "harness lite design sketch must include check step");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("Generate or point to the existing copyable `resume` prompt"), "harness lite design sketch must include resume step");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("Recheck live repo facts: cwd, branch, HEAD, and worktree status"), "harness lite design sketch must include live recheck step");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("Decide: continue, refresh pack, run Doctor, or stop"), "harness lite design sketch must include decide step");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("Doctor remains conditional"), "harness lite design sketch must keep Doctor conditional");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("pack_missing -> blocked"), "harness lite design sketch must include pack missing transition");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("check_failed -> repair_pack"), "harness lite design sketch must include check failed transition");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("check_warning -> human_review"), "harness lite design sketch must include check warning transition");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("check_passed + live_match -> resume_ready"), "harness lite design sketch must include live match transition");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("check_passed + live_drift -> doctor_or_refresh"), "harness lite design sketch must include live drift transition");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("resume_ready -> user_goal_required"), "harness lite design sketch must include user goal transition");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("This sketch does not define a new JSON shape"), "harness lite design sketch must avoid JSON shape claims");
  assertIncludesPhrase(contextPackContinuationHarnessLiteDesignSketchDoc, "At least three public-safe real handoffs show the same blocking or high-frequency confusing friction", "harness lite design sketch must keep evidence threshold");
  assertIncludesPhrase(contextPackContinuationHarnessLiteDesignSketchDoc, "latest first-run/handoff validation passed without blocking or repeated confusing friction", "harness lite design sketch must reference current validation result");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("No new CLI command"), "harness lite design sketch must reject new commands");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("No Context Pack seven-file structure change"), "harness lite design sketch must preserve seven-file structure");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("No `check --input <dir> --json` top-level shape change"), "harness lite design sketch must preserve checker JSON shape");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("No Resume JSON contract change"), "harness lite design sketch must preserve resume JSON contract");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("No Doctor JSON contract change"), "harness lite design sketch must preserve doctor JSON contract");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("No Export JSON contract change"), "harness lite design sketch must preserve export JSON contract");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("No Status command"), "harness lite design sketch must reject status command");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("No Workflow Runner"), "harness lite design sketch must reject workflow runner");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("No Continuation Harness Lite implementation"), "harness lite design sketch must reject harness implementation");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("No provider request"), "harness lite design sketch must reject provider requests");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("No runtime integration"), "harness lite design sketch must reject runtime integration");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("No MCP server"), "harness lite design sketch must reject MCP server");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("No MCP tools"), "harness lite design sketch must reject MCP tools");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("No plugin"), "harness lite design sketch must reject plugin scope");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("No schema-v2"), "harness lite design sketch must reject schema-v2");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("No hosted memory"), "harness lite design sketch must reject hosted memory");
  assert(contextPackContinuationHarnessLiteDesignSketchDoc.includes("provider_probe_status=skipped"), "harness lite design sketch must preserve skipped provider gate");
  assert(!/(^|[^A-Za-z])[A-Za-z]:[\\/]/.test(contextPackContinuationHarnessLiteDesignSketchDoc), "harness lite design sketch must not expose drive-letter absolute paths");
  assert(!/\\\\/.test(contextPackContinuationHarnessLiteDesignSketchDoc), "harness lite design sketch must not expose UNC paths");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("Context Pack Continuation Harness Lite Paper Rehearsal"), "harness lite paper rehearsal doc must have stable title");
  assertIncludesPhrase(contextPackContinuationHarnessLitePaperRehearsalDoc, "local paper rehearsal only, not implementation", "harness lite paper rehearsal must avoid implementation claims");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("paper_rehearsal_status: completed"), "harness lite paper rehearsal must record completed paper rehearsal");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("implementation_status: not_started"), "harness lite paper rehearsal must keep implementation not started");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("command_status: not_started"), "harness lite paper rehearsal must keep command not started");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("status_command_status: not_started"), "harness lite paper rehearsal must keep status command not started");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("workflow_runner_status: not_started"), "harness lite paper rehearsal must keep workflow runner not started");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("json_contract_change_status: not_started"), "harness lite paper rehearsal must keep JSON contract change not started");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("provider_probe_status=skipped"), "harness lite paper rehearsal must preserve skipped provider gate");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("clean pack"), "harness lite paper rehearsal must cover clean pack");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("too-thick warning"), "harness lite paper rehearsal must cover too-thick warning");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("broken pack"), "harness lite paper rehearsal must cover broken pack");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("stale/live drift"), "harness lite paper rehearsal must cover stale/live drift");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("missing pack"), "harness lite paper rehearsal must cover missing pack");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("check_passed + live_match -> resume_ready -> user_goal_required"), "harness lite paper rehearsal must include clean-pack transition");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("check_warning -> human_review"), "harness lite paper rehearsal must include warning transition");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("check_failed -> repair_pack"), "harness lite paper rehearsal must include broken-pack transition");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("check_passed + live_drift -> doctor_or_refresh"), "harness lite paper rehearsal must include live-drift transition");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("pack_missing -> blocked"), "harness lite paper rehearsal must include missing-pack transition");
  assert((contextPackContinuationHarnessLitePaperRehearsalDoc.match(/input signal:/g) || []).length === 5, "harness lite paper rehearsal must record five input signals");
  assert((contextPackContinuationHarnessLitePaperRehearsalDoc.match(/state transition:/g) || []).length === 5, "harness lite paper rehearsal must record five state transitions");
  assert((contextPackContinuationHarnessLitePaperRehearsalDoc.match(/recommended next step:/g) || []).length === 5, "harness lite paper rehearsal must record five recommended next steps");
  assert((contextPackContinuationHarnessLitePaperRehearsalDoc.match(/not-a-trigger:/g) || []).length === 5, "harness lite paper rehearsal must record five not-a-trigger notes");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("Current evidence still does not trigger implementation"), "harness lite paper rehearsal must keep current evidence below implementation threshold");
  assertIncludesPhrase(contextPackContinuationHarnessLitePaperRehearsalDoc, "Harness Lite remains design sketch only", "harness lite paper rehearsal must keep harness as design sketch only");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("No new CLI command"), "harness lite paper rehearsal must reject new commands");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("No Context Pack seven-file structure change"), "harness lite paper rehearsal must preserve seven-file structure");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("No `check --input <dir> --json` top-level shape change"), "harness lite paper rehearsal must preserve checker JSON shape");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("No Resume JSON contract change"), "harness lite paper rehearsal must preserve resume JSON contract");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("No Doctor JSON contract change"), "harness lite paper rehearsal must preserve doctor JSON contract");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("No Export JSON contract change"), "harness lite paper rehearsal must preserve export JSON contract");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("No JSON shape change"), "harness lite paper rehearsal must reject JSON shape changes");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("No Status command"), "harness lite paper rehearsal must reject status command");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("No Workflow Runner"), "harness lite paper rehearsal must reject workflow runner");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("No Continuation Harness Lite implementation"), "harness lite paper rehearsal must reject harness implementation");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("No provider request"), "harness lite paper rehearsal must reject provider requests");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("No runtime integration"), "harness lite paper rehearsal must reject runtime integration");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("No MCP server"), "harness lite paper rehearsal must reject MCP server");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("No MCP tools"), "harness lite paper rehearsal must reject MCP tools");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("No plugin"), "harness lite paper rehearsal must reject plugin scope");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("No schema-v2"), "harness lite paper rehearsal must reject schema-v2");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("No daemon"), "harness lite paper rehearsal must reject daemon scope");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("No watcher"), "harness lite paper rehearsal must reject watcher scope");
  assert(contextPackContinuationHarnessLitePaperRehearsalDoc.includes("No hosted memory"), "harness lite paper rehearsal must reject hosted memory");
  assert(!/(^|[^A-Za-z])[A-Za-z]:[\\/]/.test(contextPackContinuationHarnessLitePaperRehearsalDoc), "harness lite paper rehearsal must not expose drive-letter absolute paths");
  assert(!/\\\\/.test(contextPackContinuationHarnessLitePaperRehearsalDoc), "harness lite paper rehearsal must not expose UNC paths");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("Context Pack Local Bundle Compression v2.6.20"), "v2.6.20 bundle compression doc must have stable title");
  assertIncludesPhrase(contextPackLocalBundleCompressionV2620Doc, "local bundle compression only, not a release closeout", "v2.6.20 bundle compression must avoid release closeout claims");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("local_bundle_status: ahead-19 adoption and design sedimentation"), "v2.6.20 bundle compression must preserve ahead-19 semantics");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("bundle_compression_status: completed"), "v2.6.20 bundle compression must record local compression status");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("release_closeout_status: not_started"), "v2.6.20 bundle compression must keep release closeout not started");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("push_status: not_started"), "v2.6.20 bundle compression must keep push not started");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("tag_status: not_started"), "v2.6.20 bundle compression must keep tag not started");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("release_status: not_started"), "v2.6.20 bundle compression must keep release not started");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("pr_status: not_started"), "v2.6.20 bundle compression must keep PR not started");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("provider_probe_status=skipped"), "v2.6.20 bundle compression must preserve skipped provider gate");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("## Future Release-Note Candidates"), "v2.6.20 bundle compression must include release-note candidates");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("## Dogfooding-Only Evidence"), "v2.6.20 bundle compression must include dogfooding-only evidence");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("## Release-Check / Contract Protections"), "v2.6.20 bundle compression must include contract protections");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("## Feature Gates / Deferred Candidates"), "v2.6.20 bundle compression must include deferred feature gates");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("First-run confidence") && contextPackLocalBundleCompressionV2620Doc.includes("Context Pack interpretation") && contextPackLocalBundleCompressionV2620Doc.includes("Adoption UX") && contextPackLocalBundleCompressionV2620Doc.includes("Maintenance hardening"), "v2.6.20 bundle compression must classify release-note candidates");
  assertIncludesPhrase(contextPackLocalBundleCompressionV2620Doc, "Keep the ahead-19 bundle local and compressed", "v2.6.20 bundle compression must keep ahead-19 local");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("No new CLI command"), "v2.6.20 bundle compression must reject new commands");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("No Context Pack seven-file structure change"), "v2.6.20 bundle compression must preserve seven-file structure");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("No `check --input <dir> --json` top-level shape change"), "v2.6.20 bundle compression must preserve checker JSON shape");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("No Resume JSON contract change"), "v2.6.20 bundle compression must preserve resume JSON contract");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("No Doctor JSON contract change"), "v2.6.20 bundle compression must preserve doctor JSON contract");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("No Export JSON contract change"), "v2.6.20 bundle compression must preserve export JSON contract");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("No Status command"), "v2.6.20 bundle compression must reject status command");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("No Workflow Runner"), "v2.6.20 bundle compression must reject workflow runner");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("No Continuation Harness Lite implementation"), "v2.6.20 bundle compression must reject harness implementation");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("No provider request"), "v2.6.20 bundle compression must reject provider requests");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("No runtime integration"), "v2.6.20 bundle compression must reject runtime integration");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("No MCP server"), "v2.6.20 bundle compression must reject MCP server");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("No MCP tools"), "v2.6.20 bundle compression must reject MCP tools");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("No plugin"), "v2.6.20 bundle compression must reject plugin scope");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("No schema-v2"), "v2.6.20 bundle compression must reject schema-v2");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("No daemon"), "v2.6.20 bundle compression must reject daemon scope");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("No watcher"), "v2.6.20 bundle compression must reject watcher scope");
  assert(contextPackLocalBundleCompressionV2620Doc.includes("No hosted memory"), "v2.6.20 bundle compression must reject hosted memory");
  assert(!/(^|[^A-Za-z])[A-Za-z]:[\\/]/.test(contextPackLocalBundleCompressionV2620Doc), "v2.6.20 bundle compression must not expose drive-letter absolute paths");
  assert(!/\\\\/.test(contextPackLocalBundleCompressionV2620Doc), "v2.6.20 bundle compression must not expose UNC paths");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("Context Pack Implementation Gate Decision v2.6.21"), "v2.6.21 implementation gate doc must have stable title");
  assertIncludesPhrase(contextPackImplementationGateDecisionV2621Doc, "local implementation gate decision only, not implementation", "v2.6.21 implementation gate must avoid implementation claims");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("implementation_gate_status: closed_for_now"), "v2.6.21 implementation gate must be closed for now");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("implementation_status: not_started"), "v2.6.21 implementation gate must keep implementation not started");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("command_status: not_started"), "v2.6.21 implementation gate must keep command not started");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("continuation_harness_lite_status: future_candidate"), "v2.6.21 implementation gate must keep harness as future candidate");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("status_command_status: not_started"), "v2.6.21 implementation gate must keep status command not started");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("workflow_runner_status: not_started"), "v2.6.21 implementation gate must keep workflow runner not started");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("doctor_expansion_status: not_started"), "v2.6.21 implementation gate must keep doctor expansion not started");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("json_contract_change_status: not_started"), "v2.6.21 implementation gate must keep JSON contract change not started");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("Do not implement Continuation Harness Lite yet"), "v2.6.21 implementation gate must explicitly reject implementation now");
  assertIncludesPhrase(contextPackImplementationGateDecisionV2621Doc, "not enough implementation evidence", "v2.6.21 implementation gate must distinguish design from implementation evidence");
  assertIncludesPhrase(contextPackImplementationGateDecisionV2621Doc, "at least three public-safe real handoffs", "v2.6.21 implementation gate must preserve evidence threshold");
  assertIncludesPhrase(contextPackImplementationGateDecisionV2621Doc, "sequencing `context-pack -> check -> resume -> live recheck`", "v2.6.21 implementation gate must preserve sequence-specific friction threshold");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("No new CLI command"), "v2.6.21 implementation gate must reject new commands");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("No JSON shape change"), "v2.6.21 implementation gate must reject JSON shape changes");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("No Status command"), "v2.6.21 implementation gate must reject status command");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("No Workflow Runner"), "v2.6.21 implementation gate must reject workflow runner");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("No Doctor expansion"), "v2.6.21 implementation gate must reject doctor expansion");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("No provider request"), "v2.6.21 implementation gate must reject provider requests");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("No runtime integration"), "v2.6.21 implementation gate must reject runtime integration");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("No MCP server"), "v2.6.21 implementation gate must reject MCP server");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("No MCP tools"), "v2.6.21 implementation gate must reject MCP tools");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("No plugin"), "v2.6.21 implementation gate must reject plugin scope");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("No schema-v2"), "v2.6.21 implementation gate must reject schema-v2");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("No daemon"), "v2.6.21 implementation gate must reject daemon scope");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("No watcher"), "v2.6.21 implementation gate must reject watcher scope");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("No hosted memory"), "v2.6.21 implementation gate must reject hosted memory");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("Keep the Context Pack seven-file structure unchanged"), "v2.6.21 implementation gate must preserve seven-file structure");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("Keep `check --input <dir> --json` top-level shape unchanged"), "v2.6.21 implementation gate must preserve checker JSON shape");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("Keep Resume JSON contract unchanged"), "v2.6.21 implementation gate must preserve resume JSON contract");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("Keep Doctor JSON contract unchanged"), "v2.6.21 implementation gate must preserve doctor JSON contract");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("Keep Export JSON contract unchanged"), "v2.6.21 implementation gate must preserve export JSON contract");
  assert(contextPackImplementationGateDecisionV2621Doc.includes("provider_probe_status=skipped"), "v2.6.21 implementation gate must preserve skipped provider gate");
  assert(!/(^|[^A-Za-z])[A-Za-z]:[\\/]/.test(contextPackImplementationGateDecisionV2621Doc), "v2.6.21 implementation gate must not expose drive-letter absolute paths");
  assert(!/\\\\/.test(contextPackImplementationGateDecisionV2621Doc), "v2.6.21 implementation gate must not expose UNC paths");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("Context Pack Release-Check Maintainability Plan v2.6.22"), "v2.6.22 release-check maintainability plan doc must have stable title");
  assertIncludesPhrase(contextPackReleaseCheckMaintainabilityPlanV2622Doc, "local maintainability plan only, not implementation", "v2.6.22 release-check maintainability plan must avoid implementation claims");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("plan_status: drafted"), "v2.6.22 release-check maintainability plan must record drafted status");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("implementation_status: not_started"), "v2.6.22 release-check maintainability plan must keep implementation not started");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("command_status: unchanged"), "v2.6.22 release-check maintainability plan must keep command status unchanged");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("json_contract_change_status: not_started"), "v2.6.22 release-check maintainability plan must keep JSON contract change not started");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("test_split_status: deferred"), "v2.6.22 release-check maintainability plan must defer test split");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("ci_status: not_started"), "v2.6.22 release-check maintainability plan must keep CI not started");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("provider_probe_status=skipped"), "v2.6.22 release-check maintainability plan must preserve skipped provider gate");
  assertIncludesPhrase(contextPackReleaseCheckMaintainabilityPlanV2622Doc, "release-check maintainability modularization", "v2.6.22 release-check maintainability plan must choose modularization");
  assertIncludesPhrase(contextPackReleaseCheckMaintainabilityPlanV2622Doc, "without weakening the coverage", "v2.6.22 release-check maintainability plan must preserve coverage");
  assertIncludesPhrase(contextPackReleaseCheckMaintainabilityPlanV2622Doc, "reduce navigation pressure in `run_release_checks.js`", "v2.6.22 release-check maintainability plan must target release-check navigation pressure");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("## Recommended First Implementation Slice"), "v2.6.22 release-check maintainability plan must include first implementation slice");
  assertIncludesPhrase(contextPackReleaseCheckMaintainabilityPlanV2622Doc, "Start with the v2.x dogfooding/documentation assertion cluster", "v2.6.22 release-check maintainability plan must choose v2.x docs cluster");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("checkV2ContextPackDocs") && contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("checkV26DogfoodingDocs"), "v2.6.22 release-check maintainability plan must name proposed helper groups");
  assertIncludesPhrase(contextPackReleaseCheckMaintainabilityPlanV2622Doc, "stay inside `scripts/run_release_checks.js` for the first slice", "v2.6.22 release-check maintainability plan must keep first slice local to release-check script");
  assertIncludesPhrase(contextPackReleaseCheckMaintainabilityPlanV2622Doc, "separate helper file should wait until the internal grouping is proven useful", "v2.6.22 release-check maintainability plan must defer helper file extraction");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("No new CLI command"), "v2.6.22 release-check maintainability plan must reject new commands");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("No release-check output shape change"), "v2.6.22 release-check maintainability plan must preserve release-check output shape");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("No test command change"), "v2.6.22 release-check maintainability plan must preserve test command");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("No Context Pack seven-file structure change"), "v2.6.22 release-check maintainability plan must preserve seven-file structure");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("No `check --input <dir> --json` top-level shape change"), "v2.6.22 release-check maintainability plan must preserve checker JSON shape");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("No Resume JSON contract change"), "v2.6.22 release-check maintainability plan must preserve resume JSON contract");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("No Doctor JSON contract change"), "v2.6.22 release-check maintainability plan must preserve doctor JSON contract");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("No Export JSON contract change"), "v2.6.22 release-check maintainability plan must preserve export JSON contract");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("No Status command"), "v2.6.22 release-check maintainability plan must reject status command");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("No Workflow Runner"), "v2.6.22 release-check maintainability plan must reject workflow runner");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("No Continuation Harness Lite implementation"), "v2.6.22 release-check maintainability plan must reject harness implementation");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("No provider request"), "v2.6.22 release-check maintainability plan must reject provider requests");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("No runtime integration"), "v2.6.22 release-check maintainability plan must reject runtime integration");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("No MCP server"), "v2.6.22 release-check maintainability plan must reject MCP server");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("No MCP tools"), "v2.6.22 release-check maintainability plan must reject MCP tools");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("No plugin"), "v2.6.22 release-check maintainability plan must reject plugin scope");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("No schema-v2"), "v2.6.22 release-check maintainability plan must reject schema-v2");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("No daemon"), "v2.6.22 release-check maintainability plan must reject daemon scope");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("No watcher"), "v2.6.22 release-check maintainability plan must reject watcher scope");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("No hosted memory"), "v2.6.22 release-check maintainability plan must reject hosted memory");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("No GitHub Actions CI in this slice"), "v2.6.22 release-check maintainability plan must keep CI out of this slice");
  assert(contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("npm run release-check") && contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("npm test") && contextPackReleaseCheckMaintainabilityPlanV2622Doc.includes("git diff --check"), "v2.6.22 release-check maintainability plan must preserve validation gate");
  assert(!/(^|[^A-Za-z])[A-Za-z]:[\\/]/.test(contextPackReleaseCheckMaintainabilityPlanV2622Doc), "v2.6.22 release-check maintainability plan must not expose drive-letter absolute paths");
  assert(!/\\\\/.test(contextPackReleaseCheckMaintainabilityPlanV2622Doc), "v2.6.22 release-check maintainability plan must not expose UNC paths");
  assert(contextPackRunnableRecipesPlanV2623Doc.includes("Context Pack Runnable Recipes Plan v2.6.23"), "v2.6.23 runnable recipes plan doc must have stable title");
  assertIncludesPhrase(contextPackRunnableRecipesPlanV2623Doc, "local examples recipe enhancement, not a command or contract change", "v2.6.23 runnable recipes plan must avoid command and contract claims");
  assert(contextPackRunnableRecipesPlanV2623Doc.includes("plan_status: implemented"), "v2.6.23 runnable recipes plan must record implemented plan status");
  assert(contextPackRunnableRecipesPlanV2623Doc.includes("recipe_status: documented"), "v2.6.23 runnable recipes plan must record documented recipe status");
  assert(contextPackRunnableRecipesPlanV2623Doc.includes("command_status: unchanged"), "v2.6.23 runnable recipes plan must keep command status unchanged");
  assert(contextPackRunnableRecipesPlanV2623Doc.includes("package_script_status: unchanged"), "v2.6.23 runnable recipes plan must keep package scripts unchanged");
  assert(contextPackRunnableRecipesPlanV2623Doc.includes("json_contract_change_status: not_started"), "v2.6.23 runnable recipes plan must keep JSON contract changes not started");
  assert(contextPackRunnableRecipesPlanV2623Doc.includes("context_pack_structure_status: unchanged"), "v2.6.23 runnable recipes plan must keep Context Pack structure unchanged");
  assert(contextPackRunnableRecipesPlanV2623Doc.includes("provider_probe_status=skipped"), "v2.6.23 runnable recipes plan must preserve skipped provider gate");
  assert(contextPackRunnableRecipesPlanV2623Doc.includes("examples/minimal/README.md"), "v2.6.23 runnable recipes plan must include minimal example target");
  assert(contextPackRunnableRecipesPlanV2623Doc.includes("examples/context-pack-lite/README.md"), "v2.6.23 runnable recipes plan must include Context Pack Lite example target");
  assert(contextPackRunnableRecipesPlanV2623Doc.includes("examples/context-pack-doctor/README.md"), "v2.6.23 runnable recipes plan must include Doctor example target");
  assert(contextPackRunnableRecipesPlanV2623Doc.includes("examples/file-only-export/README.md"), "v2.6.23 runnable recipes plan must include file-only export example target");
  assert(contextPackRunnableRecipesPlanV2623Doc.includes("README -> quickstart -> examples/minimal"), "v2.6.23 runnable recipes plan must include minimal recipe path");
  assert(contextPackRunnableRecipesPlanV2623Doc.includes("context-pack -> check -> resume -> doctor"), "v2.6.23 runnable recipes plan must include Context Pack recipe path");
  assert(contextPackRunnableRecipesPlanV2623Doc.includes("check -> doctor"), "v2.6.23 runnable recipes plan must include Doctor recipe path");
  assert(contextPackRunnableRecipesPlanV2623Doc.includes("check -> export"), "v2.6.23 runnable recipes plan must include export recipe path");
  assert(contextPackRunnableRecipesPlanV2623Doc.includes("No package script change"), "v2.6.23 runnable recipes plan must preserve package scripts");
  assertDogfoodingDocCommonBoundaries(contextPackRunnableRecipesPlanV2623Doc, "v2.6.23 runnable recipes plan");
  assertDogfoodingDocSharedReleaseChecks(contextPackRunnableRecipesPlanV2623Doc, "v2.6.23 runnable recipes plan");
  assert(contextPackFirstRunSmokePathConsolidationV2624Doc.includes("Context Pack First-Run Smoke Path Consolidation v2.6.24"), "v2.6.24 first-run smoke path consolidation doc must have stable title");
  assertIncludesPhrase(contextPackFirstRunSmokePathConsolidationV2624Doc, "local first-run path consolidation, not a command or contract change", "v2.6.24 first-run smoke path consolidation must avoid command and contract claims");
  assert(contextPackFirstRunSmokePathConsolidationV2624Doc.includes("plan_status: implemented"), "v2.6.24 first-run smoke path consolidation must record implemented plan status");
  assert(contextPackFirstRunSmokePathConsolidationV2624Doc.includes("smoke_path_status: documented"), "v2.6.24 first-run smoke path consolidation must record documented smoke path status");
  assert(contextPackFirstRunSmokePathConsolidationV2624Doc.includes("command_status: unchanged"), "v2.6.24 first-run smoke path consolidation must keep command status unchanged");
  assert(contextPackFirstRunSmokePathConsolidationV2624Doc.includes("package_script_status: unchanged"), "v2.6.24 first-run smoke path consolidation must keep package scripts unchanged");
  assert(contextPackFirstRunSmokePathConsolidationV2624Doc.includes("json_contract_change_status: not_started"), "v2.6.24 first-run smoke path consolidation must keep JSON contract changes not started");
  assert(contextPackFirstRunSmokePathConsolidationV2624Doc.includes("context_pack_structure_status: unchanged"), "v2.6.24 first-run smoke path consolidation must keep Context Pack structure unchanged");
  assert(contextPackFirstRunSmokePathConsolidationV2624Doc.includes("provider_probe_status=skipped"), "v2.6.24 first-run smoke path consolidation must preserve skipped provider gate");
  assert(contextPackFirstRunSmokePathConsolidationV2624Doc.includes("README -> docs/index.md -> docs/quickstart-5min.md -> examples/minimal -> examples/context-pack-lite"), "v2.6.24 first-run smoke path consolidation must include canonical first-run path");
  assert(contextPackFirstRunSmokePathConsolidationV2624Doc.includes("npm run check"), "v2.6.24 first-run smoke path consolidation must include local validation gate");
  assert(contextPackFirstRunSmokePathConsolidationV2624Doc.includes("Doctor and File-only Export as follow-up recipes"), "v2.6.24 first-run smoke path consolidation must keep follow-up recipes optional");
  assert(contextPackFirstRunSmokePathConsolidationV2624Doc.includes("No package script change"), "v2.6.24 first-run smoke path consolidation must preserve package scripts");
  assertDogfoodingDocCommonBoundaries(contextPackFirstRunSmokePathConsolidationV2624Doc, "v2.6.24 first-run smoke path consolidation");
  assertDogfoodingDocSharedReleaseChecks(contextPackFirstRunSmokePathConsolidationV2624Doc, "v2.6.24 first-run smoke path consolidation");
  assert(contextPackOutputUxPolishV2625Doc.includes("Context Pack Output UX Polish v2.6.25"), "v2.6.25 output UX polish doc must have stable title");
  assertIncludesPhrase(contextPackOutputUxPolishV2625Doc, "local output UX polish only, not a command or contract change", "v2.6.25 output UX polish must avoid command and contract claims");
  assert(contextPackOutputUxPolishV2625Doc.includes("plan_status: implemented"), "v2.6.25 output UX polish must record implemented plan status");
  assert(contextPackOutputUxPolishV2625Doc.includes("output_ux_status: documented"), "v2.6.25 output UX polish must record documented output UX status");
  assert(contextPackOutputUxPolishV2625Doc.includes("command_status: unchanged"), "v2.6.25 output UX polish must keep command status unchanged");
  assert(contextPackOutputUxPolishV2625Doc.includes("package_script_status: unchanged"), "v2.6.25 output UX polish must keep package scripts unchanged");
  assert(contextPackOutputUxPolishV2625Doc.includes("json_contract_change_status: not_started"), "v2.6.25 output UX polish must keep JSON contract changes not started");
  assert(contextPackOutputUxPolishV2625Doc.includes("context_pack_structure_status: unchanged"), "v2.6.25 output UX polish must keep Context Pack structure unchanged");
  assert(contextPackOutputUxPolishV2625Doc.includes("provider_probe_status=skipped"), "v2.6.25 output UX polish must preserve skipped provider gate");
  assertIncludesPhrase(contextPackOutputUxPolishV2625Doc, "live repo facts are stale-prone and must be rechecked before edits", "v2.6.25 output UX polish must document stale-prone live facts");
  assert(contextPackOutputUxPolishV2625Doc.includes("not_available") && contextPackOutputUxPolishV2625Doc.includes("not_applicable") && contextPackOutputUxPolishV2625Doc.includes("needs-review") && contextPackOutputUxPolishV2625Doc.includes("missing-input semantics") && contextPackOutputUxPolishV2625Doc.includes("not failure states"), "v2.6.25 output UX polish must document missing-input semantics");
  assertIncludesPhrase(contextPackOutputUxPolishV2625Doc, "separate inherited pack facts from live rechecks", "v2.6.25 output UX polish must document inherited versus live fact separation");
  assert(contextPackOutputUxPolishV2625Doc.includes("No package script change"), "v2.6.25 output UX polish must preserve package scripts");
  assertDogfoodingDocCommonBoundaries(contextPackOutputUxPolishV2625Doc, "v2.6.25 output UX polish", { doctorExpansion: true });
  assertDogfoodingDocSharedReleaseChecks(contextPackOutputUxPolishV2625Doc, "v2.6.25 output UX polish");
  assert(contextPackTestFileSplitPlanV2626Doc.includes("Context Pack Test-File Split Plan v2.6.26"), "v2.6.26 test-file split plan must have stable title");
  assertIncludesPhrase(contextPackTestFileSplitPlanV2626Doc, "local test maintainability plan only, not a test-runner or contract change", "v2.6.26 test-file split plan must avoid test-runner and contract claims");
  assert(contextPackTestFileSplitPlanV2626Doc.includes("plan_status: drafted"), "v2.6.26 test-file split plan must record drafted plan status");
  assert(contextPackTestFileSplitPlanV2626Doc.includes("implementation_status: not_started"), "v2.6.26 test-file split plan must keep implementation not started");
  assert(contextPackTestFileSplitPlanV2626Doc.includes("test_split_status: planned"), "v2.6.26 test-file split plan must record planned test split status");
  assert(contextPackTestFileSplitPlanV2626Doc.includes("command_status: unchanged"), "v2.6.26 test-file split plan must keep command status unchanged");
  assert(contextPackTestFileSplitPlanV2626Doc.includes("package_script_status: unchanged"), "v2.6.26 test-file split plan must keep package scripts unchanged");
  assert(contextPackTestFileSplitPlanV2626Doc.includes("json_contract_change_status: not_started"), "v2.6.26 test-file split plan must keep JSON contract changes not started");
  assert(contextPackTestFileSplitPlanV2626Doc.includes("context_pack_structure_status: unchanged"), "v2.6.26 test-file split plan must keep Context Pack structure unchanged");
  assert(contextPackTestFileSplitPlanV2626Doc.includes("provider_probe_status=skipped"), "v2.6.26 test-file split plan must preserve skipped provider gate");
  assert(contextPackTestFileSplitPlanV2626Doc.includes("tests/basebrief.test.js"), "v2.6.26 test-file split plan must identify current monolithic test file");
  assert(contextPackTestFileSplitPlanV2626Doc.includes("tests/context-pack.test.js"), "v2.6.26 test-file split plan must identify first candidate split file");
  assert(contextPackTestFileSplitPlanV2626Doc.includes("Context Pack v2 tests") && contextPackTestFileSplitPlanV2626Doc.includes("cache-ready and benchmark summary tests") && contextPackTestFileSplitPlanV2626Doc.includes("Receiver and Project State workflow tests"), "v2.6.26 test-file split plan must order split clusters");
  assertIncludesPhrase(contextPackTestFileSplitPlanV2626Doc, "preserve 175 passing tests", "v2.6.26 test-file split plan must preserve current test count unless later coverage is added");
  assert(contextPackTestFileSplitPlanV2626Doc.includes("No package script change in this planning slice"), "v2.6.26 test-file split plan must preserve package scripts");
  assertDogfoodingDocCommonBoundaries(contextPackTestFileSplitPlanV2626Doc, "v2.6.26 test-file split plan", { doctorExpansion: true });
  assertDogfoodingDocSharedReleaseChecks(contextPackTestFileSplitPlanV2626Doc, "v2.6.26 test-file split plan");
  assert(contextPackTestFileSplitV2627Doc.includes("Context Pack Test-File Split v2.6.27"), "v2.6.27 test-file split doc must have stable title");
  assertIncludesPhrase(contextPackTestFileSplitV2627Doc, "local test maintainability implementation, not a product or contract change", "v2.6.27 test-file split doc must avoid product and contract claims");
  assert(contextPackTestFileSplitV2627Doc.includes("plan_status: implemented"), "v2.6.27 test-file split doc must record implemented plan status");
  assert(contextPackTestFileSplitV2627Doc.includes("implementation_status: completed"), "v2.6.27 test-file split doc must record completed implementation status");
  assert(contextPackTestFileSplitV2627Doc.includes("test_split_status: completed"), "v2.6.27 test-file split doc must record completed test split status");
  assert(contextPackTestFileSplitV2627Doc.includes("package_script_status: updated_for_test_entry_only"), "v2.6.27 test-file split doc must scope package script update to test entry");
  assert(contextPackTestFileSplitV2627Doc.includes("json_contract_change_status: not_started"), "v2.6.27 test-file split doc must keep JSON contract changes not started");
  assert(contextPackTestFileSplitV2627Doc.includes("context_pack_structure_status: unchanged"), "v2.6.27 test-file split doc must keep Context Pack structure unchanged");
  assert(contextPackTestFileSplitV2627Doc.includes("provider_probe_status=skipped"), "v2.6.27 test-file split doc must preserve skipped provider gate");
  assert(contextPackTestFileSplitV2627Doc.includes("tests/context-pack.test.js") && contextPackTestFileSplitV2627Doc.includes("tests/basebrief.test.js"), "v2.6.27 test-file split doc must document both test files");
  assertIncludesPhrase(contextPackTestFileSplitV2627Doc, "node --test tests/basebrief.test.js tests/context-pack.test.js", "v2.6.27 test-file split doc must document npm test command");
  assert(contextPackTestFileSplitV2627Doc.includes("Expected test count remains 175 tests") && contextPackTestFileSplitV2627Doc.includes("independent_test_files") && contextPackTestFileSplitV2627Doc.includes("2"), "v2.6.27 test-file split doc must record test count and independent file count");
  assert(contextPackTestFileSplitV2627Doc.includes("v2.0.0 Context Pack Lite") && contextPackTestFileSplitV2627Doc.includes("v2.5.0 Context Pack Doctor") && contextPackTestFileSplitV2627Doc.includes("Context Pack Resume prompt generation"), "v2.6.27 test-file split doc must list moved Context Pack cluster");
  assertDogfoodingDocCommonBoundaries(contextPackTestFileSplitV2627Doc, "v2.6.27 test-file split doc", { doctorExpansion: true });
  assertDogfoodingDocSharedReleaseChecks(contextPackTestFileSplitV2627Doc, "v2.6.27 test-file split doc");
  assert(contextPackTestFileSplitSecondCandidateV2628Doc.includes("Context Pack Test-File Split Second Candidate v2.6.28"), "v2.6.28 second split candidate doc must have stable title");
  assertIncludesPhrase(contextPackTestFileSplitSecondCandidateV2628Doc, "local test maintainability planning, not a test-runner or contract change", "v2.6.28 second split candidate doc must avoid test-runner and contract claims");
  assert(contextPackTestFileSplitSecondCandidateV2628Doc.includes("plan_status: drafted"), "v2.6.28 second split candidate doc must record drafted plan status");
  assert(contextPackTestFileSplitSecondCandidateV2628Doc.includes("implementation_status: not_started"), "v2.6.28 second split candidate doc must keep implementation not started");
  assert(contextPackTestFileSplitSecondCandidateV2628Doc.includes("test_split_status: candidate_selected"), "v2.6.28 second split candidate doc must record selected candidate");
  assert(contextPackTestFileSplitSecondCandidateV2628Doc.includes("package_script_status: unchanged"), "v2.6.28 second split candidate doc must keep package scripts unchanged");
  assert(contextPackTestFileSplitSecondCandidateV2628Doc.includes("json_contract_change_status: not_started"), "v2.6.28 second split candidate doc must keep JSON contract changes not started");
  assert(contextPackTestFileSplitSecondCandidateV2628Doc.includes("context_pack_structure_status: unchanged"), "v2.6.28 second split candidate doc must keep Context Pack structure unchanged");
  assert(contextPackTestFileSplitSecondCandidateV2628Doc.includes("provider_probe_status=skipped"), "v2.6.28 second split candidate doc must preserve skipped provider gate");
  assert(contextPackTestFileSplitSecondCandidateV2628Doc.includes("tests/cache-ready-benchmark.test.js"), "v2.6.28 second split candidate doc must name candidate test file");
  assert(contextPackTestFileSplitSecondCandidateV2628Doc.includes("tests/basebrief.test.js") && contextPackTestFileSplitSecondCandidateV2628Doc.includes("tests/context-pack.test.js"), "v2.6.28 second split candidate doc must document current two-file baseline");
  assertIncludesPhrase(contextPackTestFileSplitSecondCandidateV2628Doc, "node --test tests/basebrief.test.js tests/context-pack.test.js", "v2.6.28 second split candidate doc must document current npm test command");
  assert(contextPackTestFileSplitSecondCandidateV2628Doc.includes("Expected test count remains 175 tests") && contextPackTestFileSplitSecondCandidateV2628Doc.includes("independent_test_files=2"), "v2.6.28 second split candidate doc must record test count and independent files");
  assert(contextPackTestFileSplitSecondCandidateV2628Doc.includes("cache-ready generators") && contextPackTestFileSplitSecondCandidateV2628Doc.includes("benchmark summaries") && contextPackTestFileSplitSecondCandidateV2628Doc.includes("relay usage audit"), "v2.6.28 second split candidate doc must document selected scope");
  assert(contextPackTestFileSplitSecondCandidateV2628Doc.includes("Receiver, Project State, Sidecar") && contextPackTestFileSplitSecondCandidateV2628Doc.includes("docs/release-line assertion") && contextPackTestFileSplitSecondCandidateV2628Doc.includes("splits remain") && contextPackTestFileSplitSecondCandidateV2628Doc.includes("deferred"), "v2.6.28 second split candidate doc must defer broader clusters");
  assert(contextPackTestFileSplitSecondCandidateV2628Doc.includes("No new test file in this planning slice"), "v2.6.28 second split candidate doc must reject test-file creation");
  assert(contextPackTestFileSplitSecondCandidateV2628Doc.includes("No package script change"), "v2.6.28 second split candidate doc must preserve package scripts");
  assertDogfoodingDocCommonBoundaries(contextPackTestFileSplitSecondCandidateV2628Doc, "v2.6.28 second split candidate doc", { doctorExpansion: true });
  assertDogfoodingDocSharedReleaseChecks(contextPackTestFileSplitSecondCandidateV2628Doc, "v2.6.28 second split candidate doc");
  assert(contextPackCacheReadyBenchmarkTestSplitV2629Doc.includes("Context Pack Cache-Ready Benchmark Test Split v2.6.29"), "v2.6.29 cache-ready benchmark test split doc must have stable title");
  assertIncludesPhrase(contextPackCacheReadyBenchmarkTestSplitV2629Doc, "local test maintainability implementation, not a product or contract change", "v2.6.29 cache-ready benchmark test split doc must avoid product and contract claims");
  assert(contextPackCacheReadyBenchmarkTestSplitV2629Doc.includes("plan_status: implemented"), "v2.6.29 cache-ready benchmark test split doc must record implemented plan status");
  assert(contextPackCacheReadyBenchmarkTestSplitV2629Doc.includes("implementation_status: completed"), "v2.6.29 cache-ready benchmark test split doc must record completed implementation status");
  assert(contextPackCacheReadyBenchmarkTestSplitV2629Doc.includes("test_split_status: completed"), "v2.6.29 cache-ready benchmark test split doc must record completed test split status");
  assert(contextPackCacheReadyBenchmarkTestSplitV2629Doc.includes("package_script_status: updated_for_test_entry_only"), "v2.6.29 cache-ready benchmark test split doc must scope package script update to test entry");
  assert(contextPackCacheReadyBenchmarkTestSplitV2629Doc.includes("json_contract_change_status: not_started"), "v2.6.29 cache-ready benchmark test split doc must keep JSON contract changes not started");
  assert(contextPackCacheReadyBenchmarkTestSplitV2629Doc.includes("context_pack_structure_status: unchanged"), "v2.6.29 cache-ready benchmark test split doc must keep Context Pack structure unchanged");
  assert(contextPackCacheReadyBenchmarkTestSplitV2629Doc.includes("provider_probe_status=skipped"), "v2.6.29 cache-ready benchmark test split doc must preserve skipped provider gate");
  assert(contextPackCacheReadyBenchmarkTestSplitV2629Doc.includes("tests/cache-ready-benchmark.test.js"), "v2.6.29 cache-ready benchmark test split doc must document split test file");
  assert(contextPackCacheReadyBenchmarkTestSplitV2629Doc.includes("tests/basebrief.test.js") && contextPackCacheReadyBenchmarkTestSplitV2629Doc.includes("tests/context-pack.test.js"), "v2.6.29 cache-ready benchmark test split doc must document remaining test files");
  assertIncludesPhrase(contextPackCacheReadyBenchmarkTestSplitV2629Doc, "node --test tests/basebrief.test.js tests/context-pack.test.js tests/cache-ready-benchmark.test.js", "v2.6.29 cache-ready benchmark test split doc must document npm test command");
  assert(contextPackCacheReadyBenchmarkTestSplitV2629Doc.includes("Expected test count remains 175 tests") && contextPackCacheReadyBenchmarkTestSplitV2629Doc.includes("independent_test_files") && contextPackCacheReadyBenchmarkTestSplitV2629Doc.includes("3"), "v2.6.29 cache-ready benchmark test split doc must record test count and independent file count");
  assert(contextPackCacheReadyBenchmarkTestSplitV2629Doc.includes("cache-ready generator") && contextPackCacheReadyBenchmarkTestSplitV2629Doc.includes("benchmark summary") && contextPackCacheReadyBenchmarkTestSplitV2629Doc.includes("relay usage audit"), "v2.6.29 cache-ready benchmark test split doc must list moved cluster");
  assertDogfoodingDocCommonBoundaries(contextPackCacheReadyBenchmarkTestSplitV2629Doc, "v2.6.29 cache-ready benchmark test split doc", { doctorExpansion: true });
  assertDogfoodingDocSharedReleaseChecks(contextPackCacheReadyBenchmarkTestSplitV2629Doc, "v2.6.29 cache-ready benchmark test split doc");
  assert(contextPackTestSplitStabilityCheckV2630Doc.includes("Context Pack Test Split Stability Check v2.6.30"), "v2.6.30 test split stability check doc must have stable title");
  assertIncludesPhrase(contextPackTestSplitStabilityCheckV2630Doc, "local test maintainability stability check, not a product or contract change", "v2.6.30 stability check doc must avoid product and contract claims");
  assert(contextPackTestSplitStabilityCheckV2630Doc.includes("test_split_status: stable_three_file_baseline"), "v2.6.30 stability check doc must record stable three-file baseline");
  assert(contextPackTestSplitStabilityCheckV2630Doc.includes("receiver_project_state_split_status: deferred"), "v2.6.30 stability check doc must defer receiver/project-state split");
  assert(contextPackTestSplitStabilityCheckV2630Doc.includes("package_script_status: unchanged"), "v2.6.30 stability check doc must keep package script unchanged");
  assert(contextPackTestSplitStabilityCheckV2630Doc.includes("json_contract_change_status: not_started"), "v2.6.30 stability check doc must keep JSON contract changes not started");
  assert(contextPackTestSplitStabilityCheckV2630Doc.includes("context_pack_structure_status: unchanged"), "v2.6.30 stability check doc must keep Context Pack structure unchanged");
  assert(contextPackTestSplitStabilityCheckV2630Doc.includes("provider_probe_status=skipped"), "v2.6.30 stability check doc must preserve skipped provider gate");
  assert(contextPackTestSplitStabilityCheckV2630Doc.includes("tests/basebrief.test.js`: 118 tests") && contextPackTestSplitStabilityCheckV2630Doc.includes("tests/context-pack.test.js`: 11 tests") && contextPackTestSplitStabilityCheckV2630Doc.includes("tests/cache-ready-benchmark.test.js`: 46 tests"), "v2.6.30 stability check doc must record test distribution");
  assertIncludesPhrase(contextPackTestSplitStabilityCheckV2630Doc, "node --test tests/basebrief.test.js tests/context-pack.test.js tests/cache-ready-benchmark.test.js", "v2.6.30 stability check doc must document npm test command");
  assert(contextPackTestSplitStabilityCheckV2630Doc.includes("Expected test count remains 175 tests") && contextPackTestSplitStabilityCheckV2630Doc.includes("independent_test_files=3"), "v2.6.30 stability check doc must record test count and independent files");
  assert(contextPackTestSplitStabilityCheckV2630Doc.includes("Do not immediately split Receiver, Project State, Sidecar") && contextPackTestSplitStabilityCheckV2630Doc.includes("docs/release-line") && contextPackTestSplitStabilityCheckV2630Doc.includes("fixture-heavy"), "v2.6.30 stability check doc must defer broader clusters");
  assert(contextPackTestSplitStabilityCheckV2630Doc.includes("No new test file in this stability slice"), "v2.6.30 stability check doc must reject test-file creation");
  assert(contextPackTestSplitStabilityCheckV2630Doc.includes("No package script change"), "v2.6.30 stability check doc must preserve package scripts");
  assertDogfoodingDocCommonBoundaries(contextPackTestSplitStabilityCheckV2630Doc, "v2.6.30 stability check doc", { doctorExpansion: true });
  assertDogfoodingDocSharedReleaseChecks(contextPackTestSplitStabilityCheckV2630Doc, "v2.6.30 stability check doc");
  assert(contextPackV26xLocalCloseoutGateV2631Doc.includes("Context Pack v2.6.x Local Closeout Gate v2.6.31"), "v2.6.31 local closeout gate doc must have stable title");
  assertIncludesPhrase(contextPackV26xLocalCloseoutGateV2631Doc, "local closeout gate only, not a release closeout or product change", "v2.6.31 local closeout gate must avoid product and release claims");
  assert(contextPackV26xLocalCloseoutGateV2631Doc.includes("local_line_status: closed_for_now"), "v2.6.31 local closeout gate must close local line for now");
  assert(contextPackV26xLocalCloseoutGateV2631Doc.includes("recommended_items_status: completed"), "v2.6.31 local closeout gate must record recommended items completed");
  assert(contextPackV26xLocalCloseoutGateV2631Doc.includes("release_closeout_status: not_started"), "v2.6.31 local closeout gate must keep release closeout not started");
  assert(contextPackV26xLocalCloseoutGateV2631Doc.includes("push_status: not_started"), "v2.6.31 local closeout gate must keep push not started");
  assert(contextPackV26xLocalCloseoutGateV2631Doc.includes("tag_status: not_started"), "v2.6.31 local closeout gate must keep tag not started");
  assert(contextPackV26xLocalCloseoutGateV2631Doc.includes("release_status: not_started"), "v2.6.31 local closeout gate must keep release not started");
  assert(contextPackV26xLocalCloseoutGateV2631Doc.includes("pr_status: not_started"), "v2.6.31 local closeout gate must keep PR not started");
  assert(contextPackV26xLocalCloseoutGateV2631Doc.includes("provider_probe_status=skipped"), "v2.6.31 local closeout gate must preserve skipped provider gate");
  assert(contextPackV26xLocalCloseoutGateV2631Doc.includes("command_status: unchanged"), "v2.6.31 local closeout gate must keep command status unchanged");
  assert(contextPackV26xLocalCloseoutGateV2631Doc.includes("package_script_status: unchanged"), "v2.6.31 local closeout gate must keep package scripts unchanged");
  assert(contextPackV26xLocalCloseoutGateV2631Doc.includes("json_contract_change_status: not_started"), "v2.6.31 local closeout gate must keep JSON contract changes not started");
  assert(contextPackV26xLocalCloseoutGateV2631Doc.includes("context_pack_structure_status: unchanged"), "v2.6.31 local closeout gate must keep Context Pack structure unchanged");
  assert(contextPackV26xLocalCloseoutGateV2631Doc.includes("continuation_harness_lite_status: future_candidate_only"), "v2.6.31 local closeout gate must keep harness future candidate only");
  assert(contextPackV26xLocalCloseoutGateV2631Doc.includes("cache-ready benchmark test split implementation"), "v2.6.31 local closeout gate must record cache-ready benchmark split completion");
  assert(contextPackV26xLocalCloseoutGateV2631Doc.includes("post-split stability check"), "v2.6.31 local closeout gate must record stability check completion");
  assert(contextPackV26xLocalCloseoutGateV2631Doc.includes("release-check maintainability helper refactor"), "v2.6.31 local closeout gate must record release-check helper refactor completion");
  assertIncludesPhrase(contextPackV26xLocalCloseoutGateV2631Doc, "The v2.6.x line can stop here locally", "v2.6.31 local closeout gate must stop local v2.6.x line");
  assertIncludesPhrase(contextPackV26xLocalCloseoutGateV2631Doc, "v2.7 planning/implementation line or a release-candidate decision", "v2.6.31 local closeout gate must point to next direction");
  assertIncludesPhrase(contextPackV26xLocalCloseoutGateV2631Doc, "current evidence still does not show repeated real blocking friction or high-frequency confusing friction", "v2.6.31 local closeout gate must keep harness below trigger threshold");
  assertIncludesPhrase(contextPackV26xLocalCloseoutGateV2631Doc, "Receiver, Project State, Sidecar, or docs/release-line assertion test splits", "v2.6.31 local closeout gate must defer broader test splits");
  assertIncludesPhrase(contextPackV26xLocalCloseoutGateV2631Doc, "node --test tests/basebrief.test.js tests/context-pack.test.js tests/cache-ready-benchmark.test.js", "v2.6.31 local closeout gate must document npm test command");
  assert(contextPackV26xLocalCloseoutGateV2631Doc.includes("Expected test count remains 175 tests") && contextPackV26xLocalCloseoutGateV2631Doc.includes("independent_test_files=3"), "v2.6.31 local closeout gate must record test count and independent files");
  assertDogfoodingDocCommonBoundaries(contextPackV26xLocalCloseoutGateV2631Doc, "v2.6.31 local closeout gate", { doctorExpansion: true });
  assert(contextPackV26xLocalCloseoutGateV2631Doc.includes("No Continuation Harness Lite implementation"), "v2.6.31 local closeout gate must reject harness implementation");
  assertDogfoodingDocSharedReleaseChecks(contextPackV26xLocalCloseoutGateV2631Doc, "v2.6.31 local closeout gate");
  assert(contextPackReleaseCandidateDecisionV2632Doc.includes("Context Pack Release-Candidate Direction Decision v2.6.32"), "v2.6.32 release-candidate decision doc must have stable title");
  assertIncludesPhrase(contextPackReleaseCandidateDecisionV2632Doc, "local release-candidate direction decision only, not a release closeout or product change", "v2.6.32 release-candidate decision must avoid product and release claims");
  assert(contextPackReleaseCandidateDecisionV2632Doc.includes("release_candidate_status: decision_ready_not_published"), "v2.6.32 release-candidate decision must record decision-ready not published status");
  assert(contextPackReleaseCandidateDecisionV2632Doc.includes("local_bundle_status: ahead_28_compressed"), "v2.6.32 release-candidate decision must record ahead-28 compression");
  assert(contextPackReleaseCandidateDecisionV2632Doc.includes("v2_7_implementation_status: deferred_until_after_release_candidate_decision"), "v2.6.32 release-candidate decision must defer v2.7 implementation");
  assert(contextPackReleaseCandidateDecisionV2632Doc.includes("release_closeout_status: not_started"), "v2.6.32 release-candidate decision must keep release closeout not started");
  assert(contextPackReleaseCandidateDecisionV2632Doc.includes("push_status: not_started"), "v2.6.32 release-candidate decision must keep push not started");
  assert(contextPackReleaseCandidateDecisionV2632Doc.includes("tag_status: not_started"), "v2.6.32 release-candidate decision must keep tag not started");
  assert(contextPackReleaseCandidateDecisionV2632Doc.includes("release_status: not_started"), "v2.6.32 release-candidate decision must keep release not started");
  assert(contextPackReleaseCandidateDecisionV2632Doc.includes("pr_status: not_started"), "v2.6.32 release-candidate decision must keep PR not started");
  assert(contextPackReleaseCandidateDecisionV2632Doc.includes("provider_probe_status=skipped"), "v2.6.32 release-candidate decision must preserve skipped provider gate");
  assert(contextPackReleaseCandidateDecisionV2632Doc.includes("command_status: unchanged"), "v2.6.32 release-candidate decision must keep command status unchanged");
  assert(contextPackReleaseCandidateDecisionV2632Doc.includes("package_script_status: unchanged"), "v2.6.32 release-candidate decision must keep package scripts unchanged");
  assert(contextPackReleaseCandidateDecisionV2632Doc.includes("json_contract_change_status: not_started"), "v2.6.32 release-candidate decision must keep JSON contract changes not started");
  assert(contextPackReleaseCandidateDecisionV2632Doc.includes("context_pack_structure_status: unchanged"), "v2.6.32 release-candidate decision must keep Context Pack structure unchanged");
  assert(contextPackReleaseCandidateDecisionV2632Doc.includes("continuation_harness_lite_status: future_candidate_only"), "v2.6.32 release-candidate decision must keep harness future candidate only");
  assertIncludesPhrase(contextPackReleaseCandidateDecisionV2632Doc, "release-candidate decision path after the local v2.6.x closeout gate", "v2.6.32 release-candidate decision must record selected path");
  assertIncludesPhrase(contextPackReleaseCandidateDecisionV2632Doc, "Future release-note candidates", "v2.6.32 release-candidate decision must list release-note candidates");
  assertIncludesPhrase(contextPackReleaseCandidateDecisionV2632Doc, "Dogfooding-only evidence", "v2.6.32 release-candidate decision must list dogfooding-only evidence");
  assertIncludesPhrase(contextPackReleaseCandidateDecisionV2632Doc, "Release-check / contract protections", "v2.6.32 release-candidate decision must list release-check protections");
  assertIncludesPhrase(contextPackReleaseCandidateDecisionV2632Doc, "Deferred feature gates", "v2.6.32 release-candidate decision must list deferred feature gates");
  assertIncludesPhrase(contextPackReleaseCandidateDecisionV2632Doc, "Release-candidate decision work should happen before v2.7 implementation", "v2.6.32 release-candidate decision must choose release-candidate before v2.7");
  assertIncludesPhrase(contextPackReleaseCandidateDecisionV2632Doc, "prepare a public release-candidate summary", "v2.6.32 release-candidate decision must identify next release-candidate summary path");
  assertIncludesPhrase(contextPackReleaseCandidateDecisionV2632Doc, "open a narrow v2.7 implementation plan using existing commands and contracts", "v2.6.32 release-candidate decision must identify gated v2.7 fallback path");
  assertDogfoodingDocCommonBoundaries(contextPackReleaseCandidateDecisionV2632Doc, "v2.6.32 release-candidate decision", { doctorExpansion: true });
  assert(contextPackReleaseCandidateDecisionV2632Doc.includes("No Continuation Harness Lite implementation"), "v2.6.32 release-candidate decision must reject harness implementation");
  assertDogfoodingDocSharedReleaseChecks(contextPackReleaseCandidateDecisionV2632Doc, "v2.6.32 release-candidate decision");
  assert(contextPackReleaseCandidateSummaryDraftV2633Doc.includes("Context Pack Release-Candidate Summary Draft v2.6.33"), "v2.6.33 release-candidate summary draft doc must have stable title");
  assertIncludesPhrase(contextPackReleaseCandidateSummaryDraftV2633Doc, "local release-candidate summary draft only, not a release closeout or publish action", "v2.6.33 release-candidate summary draft must avoid release and publish claims");
  assert(contextPackReleaseCandidateSummaryDraftV2633Doc.includes("release_candidate_summary_status: drafted_not_published"), "v2.6.33 release-candidate summary draft must record drafted-not-published status");
  assert(contextPackReleaseCandidateSummaryDraftV2633Doc.includes("release_candidate_status: decision_ready_not_published"), "v2.6.33 release-candidate summary draft must keep decision-ready not published status");
  assert(contextPackReleaseCandidateSummaryDraftV2633Doc.includes("local_bundle_status: ahead_29_summarized"), "v2.6.33 release-candidate summary draft must record ahead-29 summary");
  assert(contextPackReleaseCandidateSummaryDraftV2633Doc.includes("v2_7_implementation_status: deferred_until_release_candidate_review_finds_gap"), "v2.6.33 release-candidate summary draft must defer v2.7 until review finds a gap");
  assert(contextPackReleaseCandidateSummaryDraftV2633Doc.includes("release_closeout_status: not_started"), "v2.6.33 release-candidate summary draft must keep release closeout not started");
  assert(contextPackReleaseCandidateSummaryDraftV2633Doc.includes("push_status: not_started"), "v2.6.33 release-candidate summary draft must keep push not started");
  assert(contextPackReleaseCandidateSummaryDraftV2633Doc.includes("tag_status: not_started"), "v2.6.33 release-candidate summary draft must keep tag not started");
  assert(contextPackReleaseCandidateSummaryDraftV2633Doc.includes("release_status: not_started"), "v2.6.33 release-candidate summary draft must keep release not started");
  assert(contextPackReleaseCandidateSummaryDraftV2633Doc.includes("pr_status: not_started"), "v2.6.33 release-candidate summary draft must keep PR not started");
  assert(contextPackReleaseCandidateSummaryDraftV2633Doc.includes("provider_probe_status=skipped"), "v2.6.33 release-candidate summary draft must preserve skipped provider gate");
  assert(contextPackReleaseCandidateSummaryDraftV2633Doc.includes("command_status: unchanged"), "v2.6.33 release-candidate summary draft must keep command status unchanged");
  assert(contextPackReleaseCandidateSummaryDraftV2633Doc.includes("package_script_status: unchanged"), "v2.6.33 release-candidate summary draft must keep package scripts unchanged");
  assert(contextPackReleaseCandidateSummaryDraftV2633Doc.includes("json_contract_change_status: not_started"), "v2.6.33 release-candidate summary draft must keep JSON contract changes not started");
  assert(contextPackReleaseCandidateSummaryDraftV2633Doc.includes("context_pack_structure_status: unchanged"), "v2.6.33 release-candidate summary draft must keep Context Pack structure unchanged");
  assert(contextPackReleaseCandidateSummaryDraftV2633Doc.includes("continuation_harness_lite_status: future_candidate_only"), "v2.6.33 release-candidate summary draft must keep harness future candidate only");
  assertIncludesPhrase(contextPackReleaseCandidateSummaryDraftV2633Doc, "Potential public release-note summary", "v2.6.33 release-candidate summary draft must include public release-note draft");
  assert(contextPackReleaseCandidateSummaryDraftV2633Doc.includes("first-run discoverability") && contextPackReleaseCandidateSummaryDraftV2633Doc.includes("runnable example recipes") && contextPackReleaseCandidateSummaryDraftV2633Doc.includes("receiver-facing Context Pack wording"), "v2.6.33 release-candidate summary draft must summarize public story");
  assert(contextPackReleaseCandidateSummaryDraftV2633Doc.includes("maintained `provider_probe_status=skipped` semantics") && contextPackReleaseCandidateSummaryDraftV2633Doc.includes("expected 175-test baseline"), "v2.6.33 release-candidate summary draft must preserve validation story");
  assertIncludesPhrase(contextPackReleaseCandidateSummaryDraftV2633Doc, "avoid per-slice chronology, local ahead counts, private paths", "v2.6.33 release-candidate summary draft must keep local details out of release notes");
  assertIncludesPhrase(contextPackReleaseCandidateSummaryDraftV2633Doc, "Dogfooding-Only Appendix", "v2.6.33 release-candidate summary draft must include dogfooding-only appendix");
  assertIncludesPhrase(contextPackReleaseCandidateSummaryDraftV2633Doc, "release closeout prep", "v2.6.33 release-candidate summary draft must preserve release closeout prep option");
  assertIncludesPhrase(contextPackReleaseCandidateSummaryDraftV2633Doc, "a narrow v2.7 implementation plan", "v2.6.33 release-candidate summary draft must preserve narrow v2.7 option");
  assertDogfoodingDocCommonBoundaries(contextPackReleaseCandidateSummaryDraftV2633Doc, "v2.6.33 release-candidate summary draft", { doctorExpansion: true });
  assert(contextPackReleaseCandidateSummaryDraftV2633Doc.includes("No Continuation Harness Lite implementation"), "v2.6.33 release-candidate summary draft must reject harness implementation");
  assertDogfoodingDocSharedReleaseChecks(contextPackReleaseCandidateSummaryDraftV2633Doc, "v2.6.33 release-candidate summary draft");
  assert(contextPackReleaseCloseoutGoNoGoPlanV2634Doc.includes("Context Pack Release Closeout Go/No-Go Plan v2.6.34"), "v2.6.34 release closeout go/no-go plan doc must have stable title");
  assertIncludesPhrase(contextPackReleaseCloseoutGoNoGoPlanV2634Doc, "local release closeout go/no-go plan only, not a release closeout or publish action", "v2.6.34 release closeout go/no-go plan must avoid release and publish claims");
  assert(contextPackReleaseCloseoutGoNoGoPlanV2634Doc.includes("release_closeout_go_no_go_status: go_to_release_closeout_prep"), "v2.6.34 release closeout go/no-go plan must record go result");
  assert(contextPackReleaseCloseoutGoNoGoPlanV2634Doc.includes("release_candidate_status: decision_ready_not_published"), "v2.6.34 release closeout go/no-go plan must keep decision-ready not published status");
  assert(contextPackReleaseCloseoutGoNoGoPlanV2634Doc.includes("release_candidate_summary_status: drafted_not_published"), "v2.6.34 release closeout go/no-go plan must keep summary draft not published");
  assert(contextPackReleaseCloseoutGoNoGoPlanV2634Doc.includes("local_bundle_status: ahead_30_reviewed_for_go_no_go"), "v2.6.34 release closeout go/no-go plan must record ahead-30 review");
  assert(contextPackReleaseCloseoutGoNoGoPlanV2634Doc.includes("v2_7_implementation_status: deferred_no_concrete_gap_found"), "v2.6.34 release closeout go/no-go plan must defer v2.7 with no concrete gap");
  assert(contextPackReleaseCloseoutGoNoGoPlanV2634Doc.includes("release_closeout_status: not_started"), "v2.6.34 release closeout go/no-go plan must keep release closeout not started");
  assert(contextPackReleaseCloseoutGoNoGoPlanV2634Doc.includes("push_status: not_started"), "v2.6.34 release closeout go/no-go plan must keep push not started");
  assert(contextPackReleaseCloseoutGoNoGoPlanV2634Doc.includes("tag_status: not_started"), "v2.6.34 release closeout go/no-go plan must keep tag not started");
  assert(contextPackReleaseCloseoutGoNoGoPlanV2634Doc.includes("release_status: not_started"), "v2.6.34 release closeout go/no-go plan must keep release not started");
  assert(contextPackReleaseCloseoutGoNoGoPlanV2634Doc.includes("pr_status: not_started"), "v2.6.34 release closeout go/no-go plan must keep PR not started");
  assert(contextPackReleaseCloseoutGoNoGoPlanV2634Doc.includes("provider_probe_status=skipped"), "v2.6.34 release closeout go/no-go plan must preserve skipped provider gate");
  assert(contextPackReleaseCloseoutGoNoGoPlanV2634Doc.includes("command_status: unchanged"), "v2.6.34 release closeout go/no-go plan must keep command status unchanged");
  assert(contextPackReleaseCloseoutGoNoGoPlanV2634Doc.includes("package_script_status: unchanged"), "v2.6.34 release closeout go/no-go plan must keep package scripts unchanged");
  assert(contextPackReleaseCloseoutGoNoGoPlanV2634Doc.includes("json_contract_change_status: not_started"), "v2.6.34 release closeout go/no-go plan must keep JSON contract changes not started");
  assert(contextPackReleaseCloseoutGoNoGoPlanV2634Doc.includes("context_pack_structure_status: unchanged"), "v2.6.34 release closeout go/no-go plan must keep Context Pack structure unchanged");
  assert(contextPackReleaseCloseoutGoNoGoPlanV2634Doc.includes("continuation_harness_lite_status: future_candidate_only"), "v2.6.34 release closeout go/no-go plan must keep harness future candidate only");
  assertIncludesPhrase(contextPackReleaseCloseoutGoNoGoPlanV2634Doc, "go to release closeout prep", "v2.6.34 release closeout go/no-go plan must recommend release closeout prep");
  assertIncludesPhrase(contextPackReleaseCloseoutGoNoGoPlanV2634Doc, "No concrete user-facing gap has been identified", "v2.6.34 release closeout go/no-go plan must explain why v2.7 is deferred");
  assertIncludesPhrase(contextPackReleaseCloseoutGoNoGoPlanV2634Doc, "the public release-note draft is focused on first-run discoverability", "v2.6.34 release closeout go/no-go plan must preserve public story");
  assertIncludesPhrase(contextPackReleaseCloseoutGoNoGoPlanV2634Doc, "dogfooding-only evidence is separated from front-page release notes", "v2.6.34 release closeout go/no-go plan must preserve evidence split");
  assertIncludesPhrase(contextPackReleaseCloseoutGoNoGoPlanV2634Doc, "convert the public release-note draft into closeout-ready wording", "v2.6.34 release closeout go/no-go plan must identify next slice");
  assertIncludesPhrase(contextPackReleaseCloseoutGoNoGoPlanV2634Doc, "publish, push, tag, release, and PR actions not_started", "v2.6.34 release closeout go/no-go plan must keep release actions not started");
  assertDogfoodingDocCommonBoundaries(contextPackReleaseCloseoutGoNoGoPlanV2634Doc, "v2.6.34 release closeout go/no-go plan", { doctorExpansion: true });
  assert(contextPackReleaseCloseoutGoNoGoPlanV2634Doc.includes("No Continuation Harness Lite implementation"), "v2.6.34 release closeout go/no-go plan must reject harness implementation");
  assertDogfoodingDocSharedReleaseChecks(contextPackReleaseCloseoutGoNoGoPlanV2634Doc, "v2.6.34 release closeout go/no-go plan");
  assert(contextPackReleaseCloseoutPrepDraftV2635Doc.includes("Context Pack Release Closeout Prep Draft v2.6.35"), "v2.6.35 release closeout prep draft doc must have stable title");
  assertIncludesPhrase(contextPackReleaseCloseoutPrepDraftV2635Doc, "local release closeout prep draft only, not a release closeout or publish action", "v2.6.35 release closeout prep draft must avoid release and publish claims");
  assert(contextPackReleaseCloseoutPrepDraftV2635Doc.includes("release_closeout_prep_status: drafted_for_review"), "v2.6.35 release closeout prep draft must record drafted-for-review status");
  assert(contextPackReleaseCloseoutPrepDraftV2635Doc.includes("release_closeout_go_no_go_status: go_to_release_closeout_prep"), "v2.6.35 release closeout prep draft must keep go result");
  assert(contextPackReleaseCloseoutPrepDraftV2635Doc.includes("release_candidate_status: decision_ready_not_published"), "v2.6.35 release closeout prep draft must keep decision-ready not published status");
  assert(contextPackReleaseCloseoutPrepDraftV2635Doc.includes("local_bundle_status: ahead_31_prepped_for_closeout_review"), "v2.6.35 release closeout prep draft must record ahead-31 prep");
  assert(contextPackReleaseCloseoutPrepDraftV2635Doc.includes("v2_7_implementation_status: deferred_no_concrete_gap_found"), "v2.6.35 release closeout prep draft must keep v2.7 deferred");
  assert(contextPackReleaseCloseoutPrepDraftV2635Doc.includes("release_closeout_status: not_started"), "v2.6.35 release closeout prep draft must keep release closeout not started");
  assert(contextPackReleaseCloseoutPrepDraftV2635Doc.includes("push_status: not_started"), "v2.6.35 release closeout prep draft must keep push not started");
  assert(contextPackReleaseCloseoutPrepDraftV2635Doc.includes("tag_status: not_started"), "v2.6.35 release closeout prep draft must keep tag not started");
  assert(contextPackReleaseCloseoutPrepDraftV2635Doc.includes("release_status: not_started"), "v2.6.35 release closeout prep draft must keep release not started");
  assert(contextPackReleaseCloseoutPrepDraftV2635Doc.includes("pr_status: not_started"), "v2.6.35 release closeout prep draft must keep PR not started");
  assert(contextPackReleaseCloseoutPrepDraftV2635Doc.includes("provider_probe_status=skipped"), "v2.6.35 release closeout prep draft must preserve skipped provider gate");
  assert(contextPackReleaseCloseoutPrepDraftV2635Doc.includes("command_status: unchanged"), "v2.6.35 release closeout prep draft must keep command status unchanged");
  assert(contextPackReleaseCloseoutPrepDraftV2635Doc.includes("package_script_status: unchanged"), "v2.6.35 release closeout prep draft must keep package scripts unchanged");
  assert(contextPackReleaseCloseoutPrepDraftV2635Doc.includes("json_contract_change_status: not_started"), "v2.6.35 release closeout prep draft must keep JSON contract changes not started");
  assert(contextPackReleaseCloseoutPrepDraftV2635Doc.includes("context_pack_structure_status: unchanged"), "v2.6.35 release closeout prep draft must keep Context Pack structure unchanged");
  assert(contextPackReleaseCloseoutPrepDraftV2635Doc.includes("continuation_harness_lite_status: future_candidate_only"), "v2.6.35 release closeout prep draft must keep harness future candidate only");
  assertIncludesPhrase(contextPackReleaseCloseoutPrepDraftV2635Doc, "Potential closeout summary", "v2.6.35 release closeout prep draft must include closeout-ready summary");
  assert(contextPackReleaseCloseoutPrepDraftV2635Doc.includes("first-run discoverability") && contextPackReleaseCloseoutPrepDraftV2635Doc.includes("runnable examples") && contextPackReleaseCloseoutPrepDraftV2635Doc.includes("receiver-facing Context Pack wording"), "v2.6.35 release closeout prep draft must preserve public story");
  assert(contextPackReleaseCloseoutPrepDraftV2635Doc.includes("release_check_status: passed_current_slice") && contextPackReleaseCloseoutPrepDraftV2635Doc.includes("npm_test_status: passed_175_tests_current_slice"), "v2.6.35 release closeout prep draft must record validation statuses");
  assert(contextPackReleaseCloseoutPrepDraftV2635Doc.includes("git_diff_check_status: passed_existing_crlf_warnings_only"), "v2.6.35 release closeout prep draft must record diff-check status");
  assert(contextPackReleaseCloseoutPrepDraftV2635Doc.includes("publish_status: not_started") && contextPackReleaseCloseoutPrepDraftV2635Doc.includes("push_status: not_started") && contextPackReleaseCloseoutPrepDraftV2635Doc.includes("tag_status: not_started"), "v2.6.35 release closeout prep draft must keep release actions not started");
  assertIncludesPhrase(contextPackReleaseCloseoutPrepDraftV2635Doc, "formal local release closeout draft", "v2.6.35 release closeout prep draft must identify next slice");
  assertDogfoodingDocCommonBoundaries(contextPackReleaseCloseoutPrepDraftV2635Doc, "v2.6.35 release closeout prep draft", { doctorExpansion: true });
  assert(contextPackReleaseCloseoutPrepDraftV2635Doc.includes("No Continuation Harness Lite implementation"), "v2.6.35 release closeout prep draft must reject harness implementation");
  assertDogfoodingDocSharedReleaseChecks(contextPackReleaseCloseoutPrepDraftV2635Doc, "v2.6.35 release closeout prep draft");
  assert(contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("Context Pack Formal Local Release Closeout Draft v2.6.36"), "v2.6.36 formal local release closeout draft doc must have stable title");
  assertIncludesPhrase(contextPackFormalLocalReleaseCloseoutDraftV2636Doc, "formal local release closeout draft only, not a publish, push, tag, release, or PR action", "v2.6.36 formal local release closeout draft must avoid publication claims");
  assert(contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("release_closeout_draft_status: drafted_locally_for_review"), "v2.6.36 formal local release closeout draft must record local draft status");
  assert(contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("release_closeout_prep_status: drafted_for_review"), "v2.6.36 formal local release closeout draft must keep prep status");
  assert(contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("release_closeout_go_no_go_status: go_to_release_closeout_prep"), "v2.6.36 formal local release closeout draft must keep go result");
  assert(contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("release_candidate_status: decision_ready_not_published"), "v2.6.36 formal local release closeout draft must keep release candidate not published");
  assert(contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("local_bundle_status: ahead_32_closeout_drafted_locally"), "v2.6.36 formal local release closeout draft must record ahead-32 local draft");
  assert(contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("v2_7_implementation_status: deferred_no_concrete_gap_found"), "v2.6.36 formal local release closeout draft must keep v2.7 deferred");
  assert(contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("publish_status: not_started"), "v2.6.36 formal local release closeout draft must keep publish not started");
  assert(contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("push_status: not_started"), "v2.6.36 formal local release closeout draft must keep push not started");
  assert(contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("tag_status: not_started"), "v2.6.36 formal local release closeout draft must keep tag not started");
  assert(contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("release_status: not_started"), "v2.6.36 formal local release closeout draft must keep release not started");
  assert(contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("pr_status: not_started"), "v2.6.36 formal local release closeout draft must keep PR not started");
  assert(contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("provider_probe_status=skipped"), "v2.6.36 formal local release closeout draft must preserve skipped provider gate");
  assert(contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("command_status: unchanged"), "v2.6.36 formal local release closeout draft must keep command status unchanged");
  assert(contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("package_script_status: unchanged"), "v2.6.36 formal local release closeout draft must keep package scripts unchanged");
  assert(contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("json_contract_change_status: not_started"), "v2.6.36 formal local release closeout draft must keep JSON contract changes not started");
  assert(contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("context_pack_structure_status: unchanged"), "v2.6.36 formal local release closeout draft must keep Context Pack structure unchanged");
  assert(contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("continuation_harness_lite_status: future_candidate_only"), "v2.6.36 formal local release closeout draft must keep harness future candidate only");
  assertIncludesPhrase(contextPackFormalLocalReleaseCloseoutDraftV2636Doc, "Potential local closeout text", "v2.6.36 formal local release closeout draft must include local closeout text");
  assert(contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("first-run discoverability") && contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("runnable examples") && contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("receiver-facing Context Pack wording"), "v2.6.36 formal local release closeout draft must preserve public story");
  assert(contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("release_check_status: passed_current_slice") && contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("npm_test_status: passed_175_tests_current_slice"), "v2.6.36 formal local release closeout draft must record validation statuses");
  assert(contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("git_diff_check_status: passed_existing_crlf_warnings_only") && contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("independent_test_files=3"), "v2.6.36 formal local release closeout draft must record diff check and independent files");
  assertIncludesPhrase(contextPackFormalLocalReleaseCloseoutDraftV2636Doc, "Any actual publication action still requires separate explicit confirmation", "v2.6.36 formal local release closeout draft must require separate publication confirmation");
  assertDogfoodingDocCommonBoundaries(contextPackFormalLocalReleaseCloseoutDraftV2636Doc, "v2.6.36 formal local release closeout draft", { doctorExpansion: true });
  assert(contextPackFormalLocalReleaseCloseoutDraftV2636Doc.includes("No Continuation Harness Lite implementation"), "v2.6.36 formal local release closeout draft must reject harness implementation");
  assertDogfoodingDocSharedReleaseChecks(contextPackFormalLocalReleaseCloseoutDraftV2636Doc, "v2.6.36 formal local release closeout draft");
  assert(contextPackReleaseCloseoutReviewPacketV2637Doc.includes("Context Pack Release Closeout Review Packet v2.6.37"), "v2.6.37 release closeout review packet doc must have stable title");
  assertIncludesPhrase(contextPackReleaseCloseoutReviewPacketV2637Doc, "local release closeout review packet only, not a publish, push, tag, release, or PR action", "v2.6.37 release closeout review packet must avoid publication claims");
  assert(contextPackReleaseCloseoutReviewPacketV2637Doc.includes("release_closeout_review_packet_status: prepared_locally_for_review"), "v2.6.37 release closeout review packet must record local packet status");
  assert(contextPackReleaseCloseoutReviewPacketV2637Doc.includes("release_closeout_draft_status: drafted_locally_for_review"), "v2.6.37 release closeout review packet must keep closeout draft status");
  assert(contextPackReleaseCloseoutReviewPacketV2637Doc.includes("release_closeout_go_no_go_status: go_to_release_closeout_prep"), "v2.6.37 release closeout review packet must keep go result");
  assert(contextPackReleaseCloseoutReviewPacketV2637Doc.includes("release_candidate_status: decision_ready_not_published"), "v2.6.37 release closeout review packet must keep release candidate not published");
  assert(contextPackReleaseCloseoutReviewPacketV2637Doc.includes("local_bundle_status: ahead_33_review_packet_prepared_locally"), "v2.6.37 release closeout review packet must record ahead-33 local packet");
  assert(contextPackReleaseCloseoutReviewPacketV2637Doc.includes("v2_7_implementation_status: deferred_no_concrete_gap_found"), "v2.6.37 release closeout review packet must keep v2.7 deferred");
  assert(contextPackReleaseCloseoutReviewPacketV2637Doc.includes("publish_status: not_started"), "v2.6.37 release closeout review packet must keep publish not started");
  assert(contextPackReleaseCloseoutReviewPacketV2637Doc.includes("push_status: not_started"), "v2.6.37 release closeout review packet must keep push not started");
  assert(contextPackReleaseCloseoutReviewPacketV2637Doc.includes("tag_status: not_started"), "v2.6.37 release closeout review packet must keep tag not started");
  assert(contextPackReleaseCloseoutReviewPacketV2637Doc.includes("release_status: not_started"), "v2.6.37 release closeout review packet must keep release not started");
  assert(contextPackReleaseCloseoutReviewPacketV2637Doc.includes("pr_status: not_started"), "v2.6.37 release closeout review packet must keep PR not started");
  assert(contextPackReleaseCloseoutReviewPacketV2637Doc.includes("provider_probe_status=skipped"), "v2.6.37 release closeout review packet must preserve skipped provider gate");
  assert(contextPackReleaseCloseoutReviewPacketV2637Doc.includes("command_status: unchanged"), "v2.6.37 release closeout review packet must keep command status unchanged");
  assert(contextPackReleaseCloseoutReviewPacketV2637Doc.includes("package_script_status: unchanged"), "v2.6.37 release closeout review packet must keep package scripts unchanged");
  assert(contextPackReleaseCloseoutReviewPacketV2637Doc.includes("json_contract_change_status: not_started"), "v2.6.37 release closeout review packet must keep JSON contract changes not started");
  assert(contextPackReleaseCloseoutReviewPacketV2637Doc.includes("context_pack_structure_status: unchanged"), "v2.6.37 release closeout review packet must keep Context Pack structure unchanged");
  assert(contextPackReleaseCloseoutReviewPacketV2637Doc.includes("continuation_harness_lite_status: future_candidate_only"), "v2.6.37 release closeout review packet must keep harness future candidate only");
  assertIncludesPhrase(contextPackReleaseCloseoutReviewPacketV2637Doc, "Reviewer-facing packet", "v2.6.37 release closeout review packet must include review packet text");
  assert(contextPackReleaseCloseoutReviewPacketV2637Doc.includes("Release story:") && contextPackReleaseCloseoutReviewPacketV2637Doc.includes("Validation evidence:") && contextPackReleaseCloseoutReviewPacketV2637Doc.includes("Protected boundaries:") && contextPackReleaseCloseoutReviewPacketV2637Doc.includes("Remaining external actions:"), "v2.6.37 release closeout review packet must include packet sections");
  assert(contextPackReleaseCloseoutReviewPacketV2637Doc.includes("first-run discoverability") && contextPackReleaseCloseoutReviewPacketV2637Doc.includes("runnable examples") && contextPackReleaseCloseoutReviewPacketV2637Doc.includes("receiver-facing Context Pack wording"), "v2.6.37 release closeout review packet must preserve public story");
  assert(contextPackReleaseCloseoutReviewPacketV2637Doc.includes("release_check_status: passed_current_slice") && contextPackReleaseCloseoutReviewPacketV2637Doc.includes("npm_test_status: passed_175_tests_current_slice"), "v2.6.37 release closeout review packet must record validation statuses");
  assert(contextPackReleaseCloseoutReviewPacketV2637Doc.includes("git_diff_check_status: passed_existing_crlf_warnings_only") && contextPackReleaseCloseoutReviewPacketV2637Doc.includes("independent_test_files=3"), "v2.6.37 release closeout review packet must record diff check and independent files");
  assertIncludesPhrase(contextPackReleaseCloseoutReviewPacketV2637Doc, "Any actual publication action still requires separate explicit confirmation", "v2.6.37 release closeout review packet must require separate publication confirmation");
  assertDogfoodingDocCommonBoundaries(contextPackReleaseCloseoutReviewPacketV2637Doc, "v2.6.37 release closeout review packet", { doctorExpansion: true });
  assert(contextPackReleaseCloseoutReviewPacketV2637Doc.includes("No Continuation Harness Lite implementation"), "v2.6.37 release closeout review packet must reject harness implementation");
  assertDogfoodingDocSharedReleaseChecks(contextPackReleaseCloseoutReviewPacketV2637Doc, "v2.6.37 release closeout review packet");
}

function checkContentContracts() {
  const packageJson = readJson("package.json");
  const skill = readText("skills/basebrief/SKILL.md");
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const integrationsDoc = readText("docs/integrations.md");
  const docsIndex = readText("docs/index.md");
  const quickstartDoc = readText("docs/quickstart-5min.md");
  const whyBaseBriefDoc = readText("docs/why-basebrief.md");
  const conceptsSimpleDoc = readText("docs/concepts-simple.md");
  const advancedDoc = readText("docs/advanced.md");
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
  const deltaReceiverReportKitDoc = readText("docs/dogfooding/delta-receiver-report-kit-v1.2.md");
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
  const v120ReleaseDoc = readText("docs/releases/v1.2.0.md");
  const v120PlanDoc = readText("docs/releases/v1.2.0-plan.md");
  const v130ReleaseDoc = readText("docs/releases/v1.3.0.md");
  const v130PlanDoc = readText("docs/releases/v1.3.0-plan.md");
  const v140ReleaseDoc = readText("docs/releases/v1.4.0.md");
  const v140PlanDoc = readText("docs/releases/v1.4.0-plan.md");
  const v150ReleaseDoc = readText("docs/releases/v1.5.0.md");
  const v150PlanDoc = readText("docs/releases/v1.5.0-plan.md");
  const v160ReleaseDoc = readText("docs/releases/v1.6.0.md");
  const v160PlanDoc = readText("docs/releases/v1.6.0-plan.md");
  const v170ReleaseDoc = readText("docs/releases/v1.7.0.md");
  const v170PlanDoc = readText("docs/releases/v1.7.0-plan.md");
  const v180ReleaseDoc = readText("docs/releases/v1.8.0.md");
  const v180PlanDoc = readText("docs/releases/v1.8.0-plan.md");
  const v190ReleaseDoc = readText("docs/releases/v1.9.0.md");
  const v190PlanDoc = readText("docs/releases/v1.9.0-plan.md");
  const v191ReleaseDoc = readText("docs/releases/v1.9.1.md");
  const deltaHandoffSpecDoc = readText("docs/specs/delta-handoff.md");
  const v200PlanDoc = readText("docs/releases/v2.0.0-plan.md");
  const v200ReleaseDoc = readText("docs/releases/v2.0.0.md");
  const contextPackLiteSpecDoc = readText("docs/specs/context-pack-lite.md");
  const v210PlanDoc = readText("docs/releases/v2.1.0-plan.md");
  const v210ReleaseDoc = readText("docs/releases/v2.1.0.md");
  const contextPackCheckSpecDoc = readText("docs/specs/context-pack-check.md");
  const v220PlanDoc = readText("docs/releases/v2.2.0-plan.md");
  const v220ReleaseDoc = readText("docs/releases/v2.2.0.md");
  const v230PlanDoc = readText("docs/releases/v2.3.0-plan.md");
  const v240PlanDoc = readText("docs/releases/v2.4.0-plan.md");
  const v240ReleaseDoc = readText("docs/releases/v2.4.0.md");
  const v250PlanDoc = readText("docs/releases/v2.5.0-plan.md");
  const v250ReleaseDoc = readText("docs/releases/v2.5.0.md");
  const v260ReleaseDoc = readText("docs/releases/v2.6.0.md");
  const v270PlanDoc = readText("docs/releases/v2.7.0-plan.md");
  const v270ReleaseDoc = readText("docs/releases/v2.7.0.md");
  const v280PlanDoc = readText("docs/releases/v2.8.0-plan.md");
  const v280ReleaseDoc = readText("docs/releases/v2.8.0.md");
  const v290PlanDoc = readText("docs/releases/v2.9.0-plan.md");
  const v290ReleaseDoc = readText("docs/releases/v2.9.0.md");
  const v291ReleaseDoc = readText("docs/releases/v2.9.1.md");
  const v2100ReleaseDoc = readText("docs/releases/v2.10.0.md");
  const v300PlanDoc = readText("docs/releases/v3.0.0-plan.md");
  const contextPackResumeSpecDoc = readText("docs/specs/context-pack-resume.md");
  const basebriefFormatSpecDoc = readText("docs/specs/basebrief-format.md");
  const fileOnlyExportSpecDoc = readText("docs/specs/file-only-export.md");
  const contextPackDoctorSpecDoc = readText("docs/specs/context-pack-doctor.md");
  const basebriefCliScript = readText("scripts/basebrief.js");
  const basebriefContextPackScript = readText("scripts/basebrief_context_pack.js");
  const basebriefExportScript = readText("scripts/basebrief_export.js");
  const basebriefDoctorScript = readText("scripts/basebrief_doctor.js");
  const basebriefContinuationHarnessScript = readText("scripts/basebrief_continuation_harness.js");
  const basebriefProjectProfileScript = readText("scripts/basebrief_project_profile.js");
  const basebriefWorkflowScript = readText("scripts/basebrief_workflow.js");
  const v2ContextPackRoadmapDoc = readText("docs/roadmap/basebrief-v2-context-pack-lite.md");
  const contextPackLiteDogfoodingDoc = readText("docs/dogfooding/context-pack-lite-fresh-receiver-v2.0.0.md");
  const contextPackCheckDogfoodingDoc = readText("docs/dogfooding/context-pack-check-acceptance-v2.1.0.md");
  const contextPackResumeDogfoodingDoc = readText("docs/dogfooding/context-pack-resume-v2.2.0.md");
  const fileOnlyExportDogfoodingDoc = readText("docs/dogfooding/file-only-export-v2.4.0.md");
  const contextPackDoctorDogfoodingDoc = readText("docs/dogfooding/context-pack-doctor-v2.5.0.md");
  const contextPackDoctorDogfoodingV251Doc = readText("docs/dogfooding/context-pack-doctor-v2.5.1.md");
  const contextPackHumanNextStepHintsDogfoodingV271Doc = readText("docs/dogfooding/context-pack-human-next-step-hints-dogfooding-v2.7.1.md");
  const continuationHarnessDogfoodingDoc = readText("docs/dogfooding/continuation-harness-lite-v2.8.0.md");
  const contextPackAdoptionNotesV261Doc = readText("docs/dogfooding/context-pack-adoption-notes-v2.6.1.md");
  const contextEngineeringReferenceNotesV264Doc = readText("docs/dogfooding/context-engineering-reference-notes-v2.6.4.md");
  const contextPackAdoptionScenarioMatrixV265Doc = readText("docs/dogfooding/context-pack-adoption-scenario-matrix-v2.6.5.md");
  const contextPackFirstRunFixtureLabV266Doc = readText("docs/dogfooding/context-pack-first-run-fixture-lab-v2.6.6.md");
  const contextPackFirstRunRehearsalAuditV267Doc = readText("docs/dogfooding/context-pack-first-run-rehearsal-audit-v2.6.7.md");
  const contextPackFirstRunFrictionRepairV268Doc = readText("docs/dogfooding/context-pack-first-run-friction-repair-v2.6.8.md");
  const contextPackAdoptionDecisionCheckpointV269Doc = readText("docs/dogfooding/context-pack-adoption-decision-checkpoint-v2.6.9.md");
  const contextPackPreReleaseBundleAuditV2610Doc = readText("docs/dogfooding/context-pack-pre-release-bundle-audit-v2.6.10.md");
  const contextPackFeatureFeasibilitySpikeV2611Doc = readText("docs/dogfooding/context-pack-feature-feasibility-spike-v2.6.11.md");
  const contextPackLocalBundleReviewRehearsalV2612Doc = readText("docs/dogfooding/context-pack-local-bundle-review-rehearsal-v2.6.12.md");
  const contextPackLocalBundleCompressionV2613Doc = readText("docs/dogfooding/context-pack-local-bundle-compression-v2.6.13.md");
  const contextPackReleaseCheckMaintainabilityV2614Doc = readText("docs/dogfooding/context-pack-release-check-maintainability-v2.6.14.md");
  const contextPackMajorReleaseCandidateShapeV2615Doc = readText("docs/dogfooding/context-pack-major-release-candidate-shape-v2.6.15.md");
  const contextPackContinuationHarnessDecisionSpecV2616Doc = readText("docs/dogfooding/context-pack-continuation-harness-decision-spec-v2.6.16.md");
  const contextPackAhead14BundleReviewV2617Doc = readText("docs/dogfooding/context-pack-ahead14-bundle-review-v2.6.17.md");
  const contextPackMinimalFeatureCandidateDecisionV2618Doc = readText("docs/dogfooding/context-pack-minimal-feature-candidate-decision-v2.6.18.md");
  const contextPackFirstRunHandoffValidationDoc = readText("docs/dogfooding/context-pack-first-run-handoff-validation.md");
  const contextPackContinuationHarnessLiteDesignSketchDoc = readText("docs/dogfooding/context-pack-continuation-harness-lite-design-sketch.md");
  const contextPackContinuationHarnessLitePaperRehearsalDoc = readText("docs/dogfooding/context-pack-continuation-harness-lite-paper-rehearsal.md");
  const contextPackLocalBundleCompressionV2620Doc = readText("docs/dogfooding/context-pack-local-bundle-compression-v2.6.20.md");
  const contextPackImplementationGateDecisionV2621Doc = readText("docs/dogfooding/context-pack-implementation-gate-decision-v2.6.21.md");
  const contextPackReleaseCheckMaintainabilityPlanV2622Doc = readText("docs/dogfooding/context-pack-release-check-maintainability-plan-v2.6.22.md");
  const contextPackRunnableRecipesPlanV2623Doc = readText("docs/dogfooding/context-pack-runnable-recipes-plan-v2.6.23.md");
  const contextPackFirstRunSmokePathConsolidationV2624Doc = readText("docs/dogfooding/context-pack-first-run-smoke-path-consolidation-v2.6.24.md");
  const contextPackOutputUxPolishV2625Doc = readText("docs/dogfooding/context-pack-output-ux-polish-v2.6.25.md");
  const contextPackTestFileSplitPlanV2626Doc = readText("docs/dogfooding/context-pack-test-file-split-plan-v2.6.26.md");
  const contextPackTestFileSplitV2627Doc = readText("docs/dogfooding/context-pack-test-file-split-v2.6.27.md");
  const contextPackTestFileSplitSecondCandidateV2628Doc = readText("docs/dogfooding/context-pack-test-file-split-second-candidate-v2.6.28.md");
  const contextPackCacheReadyBenchmarkTestSplitV2629Doc = readText("docs/dogfooding/context-pack-cache-ready-benchmark-test-split-v2.6.29.md");
  const contextPackTestSplitStabilityCheckV2630Doc = readText("docs/dogfooding/context-pack-test-split-stability-check-v2.6.30.md");
  const contextPackV26xLocalCloseoutGateV2631Doc = readText("docs/dogfooding/context-pack-v2.6x-local-closeout-gate-v2.6.31.md");
  const contextPackReleaseCandidateDecisionV2632Doc = readText("docs/dogfooding/context-pack-release-candidate-decision-v2.6.32.md");
  const contextPackReleaseCandidateSummaryDraftV2633Doc = readText("docs/dogfooding/context-pack-release-candidate-summary-draft-v2.6.33.md");
  const contextPackReleaseCloseoutGoNoGoPlanV2634Doc = readText("docs/dogfooding/context-pack-release-closeout-go-no-go-plan-v2.6.34.md");
  const contextPackReleaseCloseoutPrepDraftV2635Doc = readText("docs/dogfooding/context-pack-release-closeout-prep-draft-v2.6.35.md");
  const contextPackFormalLocalReleaseCloseoutDraftV2636Doc = readText("docs/dogfooding/context-pack-formal-local-release-closeout-draft-v2.6.36.md");
  const contextPackReleaseCloseoutReviewPacketV2637Doc = readText("docs/dogfooding/context-pack-release-closeout-review-packet-v2.6.37.md");
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
  const v1xDeltaReceiverMatrixDoc = readText("docs/testing-v1.x-delta-receiver-closure-matrix.md");
  const cliLiteDoc = readText("docs/cli-lite.md");
  const receiverUsagePackDoc = readText("docs/receiver-usage-pack.md");
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
  const contextPackLiteExampleReadme = readText("examples/context-pack-lite/README.md");
  const contextPackLiteExampleManifest = readText("examples/context-pack-lite/MANIFEST.md");
  const contextPackLiteExampleReceiverState = readText("examples/context-pack-lite/RECEIVER_STATE.md");
  const contextPackLiteExampleStarter = readText("examples/context-pack-lite/NEXT_WINDOW_STARTER.md");
  const continuationExampleReadme = readText("examples/context-pack-continuation/README.md");
  const projectProfileExampleReadme = readText("examples/project-profile-lite/README.md");
  const projectProfileExample = readJson("examples/project-profile-lite/basebrief-profile.json");
  const fileOnlyExportExampleReadme = readText("examples/file-only-export/README.md");
  const fileOnlyExportExampleManifest = readJson("examples/file-only-export/exports/manifest.json");
  const fileOnlyExportExampleContext = readJson("examples/file-only-export/exports/context.json");
  const fileOnlyExportExampleContextPack = readText("examples/file-only-export/exports/context-pack.md");
  const fileOnlyExportExampleAdapterNotes = readText("examples/file-only-export/exports/adapter-notes.md");
  const contextPackDoctorExampleReadme = readText("examples/context-pack-doctor/README.md");
  const minimalExampleReadme = readText("examples/minimal/README.md");
  const simpleContinuationReadme = readText("examples/simple-continuation/README.md");
  const simpleContinuationReport = readText("examples/simple-continuation/output/CONTINUATION_REPORT.md");
  const simpleContinuationCheckSummary = readText("examples/simple-continuation/output/CHECK_SUMMARY.md");
  const simpleContinuationStarter = readText("examples/simple-continuation/output/NEXT_WINDOW_STARTER.md");
  const fileOnlyExportExpectedSourceFiles = [
    "MANIFEST.md",
    "REPO_MAP.md",
    "KEY_FILES.md",
    "RECENT_DELTA.md",
    "RISK_BOUNDARIES.md",
    "RECEIVER_STATE.md",
    "NEXT_WINDOW_STARTER.md",
  ];
  const fileOnlyExportExpectedOutputFiles = [
    "adapter-notes.md",
    "context-pack.md",
    "context.json",
    "manifest.json",
  ];
  const deltaReportPassExample = readText("examples/receiver/delta-report-pass/README.md");
  const deltaReportDifferenceExample = readText("examples/receiver/delta-report-difference-found/README.md");
  const receiverUsagePackReadme = readText("examples/receiver/usage-pack/README.md");
  const receiverUsagePackOutline = readText("examples/receiver/usage-pack/starter-report-outline.md");
  const receiverLintReadme = readText("examples/receiver/lint/README.md");
  const receiverLintRepairReadme = readText("examples/receiver/lint/repair/README.md");
  const receiverLintDogfoodingDoc = readText("docs/dogfooding/delta-receiver-lint-dogfooding-v1.8.md");
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
  assert(packageJson.scripts.test === "node --test tests/basebrief.test.js tests/context-pack.test.js tests/cache-ready-benchmark.test.js tests/continuation-harness.test.js tests/project-profile.test.js tests/workflow-runner.test.js", "npm test must wrap the independent tests");
  assert(packageJson.scripts["release-check"] === "node scripts/run_release_checks.js", "npm run release-check must wrap release checks");
  assert(packageJson.scripts.check === "npm test && npm run release-check", "npm run check must run tests before release checks");
  ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies", "bin", "publishConfig", "files"].forEach((key) => {
    assert(!(key in packageJson), `package.json must not define ${key}`);
  });

  ["full", "lite", "cache-ready"].forEach((mode) => {
    assert(skill.includes(mode), `SKILL.md must mention mode: ${mode}`);
  });
  assert(readme.split(/\r?\n/).length <= 85, "README.md should stay a 2-minute public front door");
  assert(englishReadme.split(/\r?\n/).length <= 90, "README.en.md should stay a 2-minute public front door");
  assert((readme.match(/\]\(/g) || []).length <= 12, "README.md should keep a small curated link set");
  assert((englishReadme.match(/\]\(/g) || []).length <= 12, "README.en.md should keep a small curated link set");
  assert(readme.includes("我会带着上下文，一万次回到那个项目现场。"), "README.md must keep the approved homepage hook");
  assert(englishReadme.includes("Stop losing context between AI coding sessions."), "README.en.md must keep the public-freeze homepage hook");
  assert(readme.includes("你想从 OpenCode 切到 Codex、Claude、Cursor 或另一个工具。"), "README.md must name OpenCode in the tool-switching example");
  assert(readme.includes("local-first"), "README.md must make the local-first positioning clear");
  assert(englishReadme.includes("local-first"), "README.en.md must make the local-first positioning clear");
  assert(readme.includes("README.en.md"), "README.md should link to README.en.md");
  assert(readme.includes("node scripts/basebrief.js continue --repo . --output-dir tests/outputs/private/continue"), "README.md must lead with the simple continue command");
  assert(englishReadme.includes("node scripts/basebrief.js continue --repo . --output-dir tests/outputs/private/continue"), "README.en.md must lead with the simple continue command");
  ["NEXT_WINDOW_STARTER.md", "CHECK_SUMMARY.md", "CONTINUATION_REPORT.md", "context-pack/"].forEach((entry) => {
    assert(readme.includes(entry), `README.md must explain first-run output: ${entry}`);
    assert(englishReadme.includes(entry), `README.en.md must explain first-run output: ${entry}`);
  });
  [
    "examples/simple-continuation/README.md",
    "docs/why-basebrief.md",
    "docs/concepts-simple.md",
    "docs/quickstart-5min.md",
    "docs/advanced.md",
    "docs/index.md",
  ].forEach((entry) => {
    assert(readme.includes(entry), `README.md should route to ${entry}`);
    assert(englishReadme.includes(entry), `README.en.md should route to ${entry}`);
  });
  assert(readme.includes("普通项目接续默认只在 `full` 和 `lite` 之间选择"), "README.md must keep full/lite as the normal route");
  assert(readme.includes("`cache-ready` 只保留为显式 prompt-cache 实验路线"), "README.md must keep cache-ready experimental");
  assert(englishReadme.includes("normal continuation path routes to `full` or `lite`"), "README.en.md must make full/lite the normal route");
  assert(englishReadme.includes("`cache-ready` remains an explicit prompt-cache experiment route"), "README.en.md must keep cache-ready experimental");
  [
    "context-pack --repo <target-repo> --output-dir <dir>",
    "export --input <context-pack-dir> --output-dir <dir>",
    "doctor --repo <target-repo> --context-pack <context-pack-dir>",
    "sidecar-build",
    "basebrief-project-state-v1",
  ].forEach((advancedPhrase) => {
    assert(!readme.includes(advancedPhrase), `README.md should route advanced detail away from first-run: ${advancedPhrase}`);
    assert(!englishReadme.includes(advancedPhrase), `README.en.md should route advanced detail away from first-run: ${advancedPhrase}`);
  });
  assert(readme.includes("provider_probe_status=skipped"), "README.md should preserve skipped provider probe wording");
  assert(readme.includes("npm run check"), "README.md must document npm validation shortcut");
  assert(readme.includes("不是发布到 npm 的 package"), "README.md must keep npm scripts out of published-package scope");
  assert(!readme.includes("sidecar-build"), "README.md should route Sidecar details to the docs index");
  assert(!readme.includes("basebrief-project-state-v1"), "README.md should route schema details to the docs index");
  assert(!readme.includes("docs/releases/v0.3.0.md"), "README.md should not be a full release archive");
  assert(!readme.includes("docs/dogfooding/receiver-flow-dogfooding.md"), "README.md should not be a full dogfooding archive");
  assert(!readme.includes("BaseBrief 当前不是 CLI"), "README.md must not describe CLI Lite as nonexistent");
  assert(!readme.includes("暂无 CLI"), "README.md must not contain the obsolete no-CLI status");
  assert(!readme.includes("BB2 experiment notes"), "README.md must keep experiment-history links out of the public entry");
  assert(englishReadme.includes("provider_probe_status=skipped"), "README.en.md should preserve skipped provider probe wording");
  assert(englishReadme.includes("npm run check"), "README.en.md must document npm validation shortcut");
  assert(englishReadme.includes("not a published npm package"), "README.en.md must keep npm scripts out of published-package scope");
  assert(!englishReadme.includes("sidecar-build"), "README.en.md should route Sidecar details to the docs index");
  assert(!englishReadme.includes("basebrief-project-state-v1"), "README.en.md should route schema details to the docs index");
  assert(!englishReadme.includes("docs/releases/v0.3.0.md"), "README.en.md should not be a full release archive");
  assert(!englishReadme.includes("docs/dogfooding/receiver-flow-dogfooding.md"), "README.en.md should not be a full dogfooding archive");
  assert(!englishReadme.includes("not a CLI or plugin yet"), "README.en.md must not contain the obsolete no-CLI status");
  assert(!/two skills/i.test(englishReadme), "README.en.md must not imply two skills");
  [
    "node scripts/basebrief.js context-pack --repo <target-repo> --output-dir <dir>",
    "node scripts/basebrief.js check --input <context-pack-dir>",
    "node scripts/basebrief.js resume --input <context-pack-dir>",
    "node scripts/basebrief.js profile-init --repo <target-repo>",
    "node scripts/basebrief.js continue --profile <profile.json> --output-dir <dir>",
    "node scripts/basebrief.js workflow --profile <profile.json> --output-dir <dir>",
    "node scripts/basebrief.js export --input <context-pack-dir> --output-dir <dir>",
    "node scripts/basebrief.js doctor --repo <target-repo> --context-pack <context-pack-dir>",
    "node scripts/basebrief.js sidecar-build --repo <target-repo>",
  ].forEach((command) => {
    assert(advancedDoc.includes(command), `Advanced docs must retain command: ${command}`);
  });
  assert(advancedDoc.includes("MCP-friendly means future tool-consumable files"), "Advanced docs must retain file-only MCP-friendly wording");
  assert(advancedDoc.includes("does not call providers") && advancedDoc.includes("MCP server") && advancedDoc.includes("daemon"), "Advanced docs must preserve integration boundaries");
  assert(whyBaseBriefDoc.includes("Why Not Just Paste Chat History?") && whyBaseBriefDoc.includes("NEXT_WINDOW_STARTER.md"), "Why BaseBrief docs must explain the handoff problem and starter file");
  assert(conceptsSimpleDoc.includes("## Continue") && conceptsSimpleDoc.includes("## Next Window Starter") && conceptsSimpleDoc.includes("## Workflow Runner Lite"), "Simple concepts docs must define first-run and advanced concepts");
  assert(conceptsSimpleDoc.includes("`cache-ready` is an explicit prompt-cache experiment route"), "Simple concepts docs must keep cache-ready experimental");
  assert(simpleContinuationReadme.includes("small Todo app"), "Simple continuation example must use a concrete small Todo app scenario");
  assert(simpleContinuationReadme.includes("node scripts/basebrief.js continue --repo . --output-dir tests/outputs/private/continue"), "Simple continuation example must use the first-run continue command");
  assert(simpleContinuationReadme.includes("output/NEXT_WINDOW_STARTER.md") && simpleContinuationReadme.includes("## Boundaries"), "Simple continuation example must identify the copyable starter and boundaries");
  assert(simpleContinuationReport.includes("small Todo app") && simpleContinuationReport.includes("Risk Boundaries"), "Simple continuation report must show a user-facing handoff report");
  assert(simpleContinuationCheckSummary.includes("status: needs_review") && simpleContinuationCheckSummary.includes("NEXT_WINDOW_STARTER.md"), "Simple continuation check summary must show review-needed receiver handoff guidance");
  assert(simpleContinuationStarter.includes("small Todo app") && simpleContinuationStarter.includes("Do not"), "Simple continuation starter must provide copyable next-window boundaries");
  assert(v2100ReleaseDoc.includes("v2.10.0 Adoption Polish / Public Freeze"), "v2.10 closeout doc must have stable title");
  assert(v2100ReleaseDoc.includes("one local command -> one continuation package -> copy NEXT_WINDOW_STARTER.md"), "v2.10 closeout doc must preserve the freeze story");
  assert(v2100ReleaseDoc.includes("docs/advanced.md") && v2100ReleaseDoc.includes("examples/simple-continuation/"), "v2.10 closeout doc must list docs and example changes");
  assert(v2100ReleaseDoc.includes("Do not add MCP") && v2100ReleaseDoc.includes("automatic commit/push/tag/release/PR"), "v2.10 closeout doc must preserve freeze boundaries");
  assert(v2100ReleaseDoc.includes("provider_probe_status=skipped"), "v2.10 closeout doc must preserve skipped provider probe wording");
  assert(testingDoc.includes("v2.10.0 Adoption Polish / Public Freeze"), "Testing docs must document v2.10 freeze polish");
  assert(testingDoc.includes("docs/why-basebrief.md") && testingDoc.includes("examples/simple-continuation/"), "Testing docs must list v2.10 support docs and example");
  assert(testingDoc.includes("Advanced commands remain available") && testingDoc.includes("Expected test count remains 192"), "Testing docs must preserve v2.10 validation expectations");
  [
    "quickstart-5min.md",
    "why-basebrief.md",
    "concepts-simple.md",
    "advanced.md",
    "cli-lite.md",
    "specs/context-pack-lite.md",
    "specs/context-pack-doctor.md",
    "handoff.md",
    "golden-path.md",
    "integrations.md",
    "receiver-check.md",
    "receiver-flow.md",
    "project-state.md",
    "seal-diff.md",
    "releases/v2.10.0.md",
    "../examples/simple-continuation/README.md",
    "../examples/context-pack-lite/README.md",
    "../examples/file-only-export/README.md",
    "../examples/context-pack-doctor/README.md",
  ].forEach((entry) => {
    assert(docsIndex.includes(entry), `docs index must preserve detailed README route: ${entry}`);
  });
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
  assert(quickstartDoc.includes("第一次跑通：最短闭环"), "quickstart must put the first-run loop before advanced routes");
  assert(quickstartDoc.includes("第一次只想跑通时，先按这个顺序走：`最短闭环 -> 路径 B -> 路径 B3`"), "quickstart must clarify the first-run route order");
  assert(quickstartDoc.includes("不是首次闭环必跑步骤"), "quickstart must keep optional paths out of the first-run route");
  assert(quickstartDoc.includes("2 到 5 分钟"), "quickstart must preserve the first-run timebox");
  assert(quickstartDoc.includes("常见失败解释"), "quickstart must explain first-run failure modes");
  assert(quickstartDoc.includes("Get-Content -Encoding UTF8 <file>"), "quickstart must explain Windows PowerShell UTF-8 display handling");
  assert(quickstartDoc.includes("不要把终端显示乱码直接当成文档内容错误"), "quickstart must prevent terminal mojibake from becoming a document defect");
  assert(quickstartDoc.includes("receiver_entry_task"), "quickstart must teach receiver entry task semantics");
  assert(quickstartDoc.includes("post_acceptance_next_action"), "quickstart must teach post-acceptance action semantics");
  assert(quickstartDoc.includes("不要把它当成每次都必须跑的 status 命令"), "quickstart must keep Doctor out of always-on status scope");
  assert(quickstartDoc.includes("golden-path.md"), "quickstart must link to the golden path guide");
  assert(quickstartDoc.includes("../examples/golden-path/README.md"), "quickstart must link to the golden-path example kit");
  assert(quickstartDoc.includes("../examples/minimal/README.md"), "quickstart must link to the minimal first-run example");
  assert(quickstartDoc.includes("../examples/context-pack-doctor/README.md"), "quickstart must link to the doctor example kit");
  assert(quickstartDoc.includes("context-pack.too-thick"), "quickstart must route users to warning-pack examples");
  assert(quickstartDoc.includes("doctor.pack-head-stale"), "quickstart must route users to stale-pack doctor examples");
  assert(quickstartDoc.includes("doctor.pack-check-error"), "quickstart must route users to broken-pack doctor examples");
  assert(quickstartDoc.includes("state-init -> sidecar-build -> sidecar-check"), "quickstart must document first-pass golden path");
  assert(quickstartDoc.includes("state-advance -> sidecar-build -> sidecar-check"), "quickstart must document follow-up golden path");
  assert(quickstartDoc.includes("tests/outputs/private/quickstart/build"), "quickstart build must use the ignored private output directory");
  assert(quickstartDoc.includes("tests/outputs/private/quickstart/before.json"), "quickstart seal must use the ignored private output directory");
  assert(readme.includes("docs/quickstart-5min.md") && readme.includes("examples/simple-continuation/README.md"), "README must route first-run details to quickstart and simple example");
  assert(readme.includes("docs/advanced.md") && readme.includes("它们不是第一次跑通的主路径"), "README must route advanced recipes out of the mandatory first-run scope");
  assert(englishReadme.includes("docs/advanced.md") && englishReadme.includes("They are not the first-run path."), "README.en.md must route advanced recipes out of the mandatory first-run scope");
  assert(quickstartDoc.includes("## First-Run Smoke Path"), "quickstart must expose a canonical first-run smoke path section");
  assert(quickstartDoc.includes("README -> docs/index.md -> docs/quickstart-5min.md -> examples/minimal -> examples/context-pack-lite"), "quickstart must preserve the canonical first-run smoke path");
  assert(quickstartDoc.includes("Doctor、File-only") && quickstartDoc.includes("不是首次") && quickstartDoc.includes("必经步骤"), "quickstart must keep follow-up paths out of the mandatory first-run smoke path");
  assert(docsIndex.includes("第一次跑通"), "Docs index must expose a first-run route before archives");
  assert(docsIndex.includes("常用接续"), "Docs index must group ordinary continuation docs before diagnostics");
  assert(docsIndex.includes("诊断与修复"), "Docs index must group Context Pack Doctor and checks separately from first-run docs");
  assert(docsIndex.includes("进阶参考"), "Docs index must keep advanced workflows out of the first-run route");
  assert(docsIndex.includes("版本档案入口"), "Docs index must push historical archives behind a clear archive heading");
  assert(docsIndex.includes("不要把历史版本档案当作 first-run 主路径"), "Docs index must keep archives out of the first-run path");
  assert(docsIndex.indexOf("## 第一次跑通") < docsIndex.indexOf("## 版本档案入口"), "Docs index must place first-run before archives");
  assert(docsIndex.indexOf("## 常用接续") < docsIndex.indexOf("## 版本档案入口"), "Docs index must place continuation docs before archives");
  assert(docsIndex.indexOf("## 诊断与修复") < docsIndex.indexOf("## 版本档案入口"), "Docs index must place diagnostic docs before archives");
  assert(docsIndex.includes("../examples/minimal/README.md"), "Docs index must link the minimal first-run example");
  assert(docsIndex.includes("First-run smoke path"), "Docs index must expose the first-run smoke path");
  assert(docsIndex.includes("README -> docs/index.md -> docs/quickstart-5min.md -> examples/minimal -> examples/context-pack-lite"), "Docs index must preserve the canonical first-run smoke path");
  assert(docsIndex.indexOf("../examples/context-pack-lite/README.md") < docsIndex.indexOf("## 常用接续"), "Docs index must include Context Pack Lite in first-run docs before continuation docs");
  assert(minimalExampleReadme.includes("2 分钟读法"), "Minimal example must include a short first-run reading path");
  assert(minimalExampleReadme.includes("预期闭环"), "Minimal example must document expected first-run loop");
  assert(minimalExampleReadme.includes("来源窗口已验证"), "Minimal example must separate source-window verification");
  assert(minimalExampleReadme.includes("接收窗口本轮已验证"), "Minimal example must separate receiver-window rechecks");
  assert(minimalExampleReadme.includes("difference_found"), "Minimal example must explain difference_found semantics");
  assert(minimalExampleReadme.includes("## Runnable Recipe"), "Minimal example must include a runnable recipe");
  assert(minimalExampleReadme.includes("README -> docs/quickstart-5min.md -> examples/minimal"), "Minimal example must include first-run route");
  assert(minimalExampleReadme.includes("npm run check"), "Minimal example must include local validation command");
  assert(minimalExampleReadme.includes("Canonical first-run smoke path"), "Minimal example must include the canonical first-run smoke path");
  assert(minimalExampleReadme.includes("README -> docs/index.md -> docs/quickstart-5min.md -> examples/minimal -> examples/context-pack-lite"), "Minimal example must preserve the canonical first-run smoke path");
  assert(minimalExampleReadme.includes("Doctor and File-only Export are") && minimalExampleReadme.includes("not required first-run steps"), "Minimal example must keep follow-up recipes optional");
  assert(contextPackLiteExampleReadme.includes("First-run scenarios"), "Context Pack Lite example must document first-run scenarios");
  assert(contextPackLiteExampleReadme.includes("Clean pack"), "Context Pack Lite example must explain clean pack handling");
  assert(contextPackLiteExampleReadme.includes("Warning pack"), "Context Pack Lite example must explain warning pack handling");
  assert(contextPackLiteExampleReadme.includes("Broken pack"), "Context Pack Lite example must explain broken pack handling");
  assert(contextPackLiteExampleReadme.includes("context-pack.too-thick"), "Context Pack Lite example must mention thickness warning");
  assert(contextPackLiteExampleReadme.includes("is this pack structurally reviewable"), "Context Pack Lite example must scope check to structural review");
  assert(contextPackLiteExampleReadme.includes("## Runnable Recipe"), "Context Pack Lite example must include a runnable recipe");
  assert(contextPackLiteExampleReadme.includes("context-pack -> check -> resume -> doctor"), "Context Pack Lite example must include full handoff recipe chain");
  assert(contextPackLiteExampleReadme.includes("node scripts/basebrief.js context-pack --repo <target-repo> --output-dir <context-pack-dir>"), "Context Pack Lite example must include generator command");
  assert(contextPackLiteExampleReadme.includes("node scripts/basebrief.js check --input <context-pack-dir> --json"), "Context Pack Lite example must include check command");
  assert(contextPackLiteExampleReadme.includes("node scripts/basebrief.js resume --input <context-pack-dir>"), "Context Pack Lite example must include resume command");
  assert(contextPackLiteExampleReadme.includes("node scripts/basebrief.js doctor --repo <target-repo> --context-pack <context-pack-dir> --json"), "Context Pack Lite example must include doctor command");
  assert(contextPackLiteExampleReadme.includes("Canonical first-run smoke path"), "Context Pack Lite example must include the canonical first-run smoke path");
  assert(contextPackLiteExampleReadme.includes("README -> docs/index.md -> docs/quickstart-5min.md -> examples/minimal -> examples/context-pack-lite"), "Context Pack Lite example must preserve the canonical first-run smoke path");
  assert(contextPackLiteExampleReadme.includes("Doctor and File-only Export") && contextPackLiteExampleReadme.includes("follow-up recipes") && contextPackLiteExampleReadme.includes("not") && contextPackLiteExampleReadme.includes("mandatory first-run steps"), "Context Pack Lite example must keep follow-up recipes optional");
  assert(contextPackDoctorExampleReadme.includes("Check vs Doctor"), "Doctor example must explain check versus doctor");
  assert(contextPackDoctorExampleReadme.includes("Clean/current pack"), "Doctor example must explain clean/current result handling");
  assert(contextPackDoctorExampleReadme.includes("Stale pack"), "Doctor example must explain stale pack handling");
  assert(contextPackDoctorExampleReadme.includes("Broken pack"), "Doctor example must explain broken pack handling");
  assert(contextPackDoctorExampleReadme.includes("basebrief-doctor-v1"), "Doctor example must preserve doctor contract version");
  assert(contextPackDoctorExampleReadme.includes("doctor.pack-head-stale"), "Doctor example must mention stale HEAD finding");
  assert(contextPackDoctorExampleReadme.includes("doctor.pack-check-error"), "Doctor example must mention pack check error finding");
  assert(contextPackDoctorExampleReadme.includes("not an always-on `status` command"), "Doctor example must keep Doctor out of always-on status scope");
  assert(contextPackDoctorExampleReadme.includes("## Runnable Recipe"), "Doctor example must include a runnable recipe");
  assert(contextPackDoctorExampleReadme.includes("check -> doctor"), "Doctor example must include diagnostic recipe chain");
  assert(contextPackDoctorExampleReadme.includes("node scripts/basebrief.js check --input examples/context-pack-lite --json"), "Doctor example must include check command");
  assert(contextPackDoctorExampleReadme.includes("node scripts/basebrief.js doctor --repo examples/example-repo --context-pack examples/context-pack-lite --json"), "Doctor example must include doctor command");
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
  assert(docsIndex.includes("receiver-usage-pack.md"), "Docs index must link Receiver Usage Pack docs");
  assert(docsIndex.includes("project-state.md"), "Docs index must link Project State docs");
  assert(docsIndex.includes("golden-path.md"), "Docs index must link golden path docs");
  assert(docsIndex.includes("design/project-state-model.md"), "Docs index must link project-state model docs");
  assert(docsIndex.includes("design/project-state-validation-rules.md"), "Docs index must link project-state validation docs");
  assert(docsIndex.includes("design/project-state-lifecycle-readiness.md"), "Docs index must link project-state lifecycle readiness docs");
  assert(docsIndex.includes("design/project-state-lifecycle-model.md"), "Docs index must link project-state lifecycle model docs");
  assert(docsIndex.includes("../examples/receiver/difference-found/README.md"), "Docs index should link receiver difference example");
  assert(docsIndex.includes("../examples/receiver/blocked/README.md"), "Docs index should link receiver blocked example");
  assert(docsIndex.includes("../examples/receiver/language-routing/README.md"), "Docs index should link receiver language routing example");
  assert(docsIndex.includes("releases/v1.2.0-plan.md"), "Docs index must link v1.2.0 report kit plan");
  assert(docsIndex.includes("releases/v1.2.0.md"), "Docs index must link v1.2.0 report kit closeout");
  assert(docsIndex.includes("releases/v1.3.0.md"), "Docs index must link v1.3.0 starter integration closeout");
  assert(docsIndex.includes("releases/v1.3.0-plan.md"), "Docs index must link v1.3.0 starter integration plan");
  assert(docsIndex.includes("releases/v1.4.0.md"), "Docs index must link v1.4.0 usage pack closeout");
  assert(docsIndex.includes("releases/v1.4.0-plan.md"), "Docs index must link v1.4.0 usage pack plan");
  assert(docsIndex.includes("releases/v1.5.0.md"), "Docs index must link v1.5.0 lint mini closeout");
  assert(docsIndex.includes("releases/v1.5.0-plan.md"), "Docs index must link v1.5.0 lint mini plan");
  assert(docsIndex.includes("releases/v1.6.0.md"), "Docs index must link v1.6.0 lint fixture pack closeout");
  assert(docsIndex.includes("releases/v1.6.0-plan.md"), "Docs index must link v1.6.0 lint fixture pack plan");
  assert(docsIndex.includes("releases/v1.7.0.md"), "Docs index must link v1.7.0 lint repair pack closeout");
  assert(docsIndex.includes("releases/v1.7.0-plan.md"), "Docs index must link v1.7.0 lint repair pack plan");
  assert(docsIndex.includes("releases/v1.8.0.md"), "Docs index must link v1.8.0 lint dogfooding closeout");
  assert(docsIndex.includes("releases/v1.8.0-plan.md"), "Docs index must link v1.8.0 lint dogfooding plan");
  assert(docsIndex.includes("releases/v1.9.0-plan.md"), "Docs index must link v1.9.0 lint adoption plan");
  assert(docsIndex.includes("releases/v1.9.0.md"), "Docs index must link v1.9.0 lint adoption closeout");
  assert(docsIndex.includes("releases/v1.9.1.md"), "Docs index must link v1.9.1 final closure");
  assert(docsIndex.includes("testing-v1.x-delta-receiver-closure-matrix.md"), "Docs index must link v1.x delta receiver closure matrix");
  assert(docsIndex.includes("dogfooding/delta-receiver-report-kit-v1.2.md"), "Docs index must link v1.2 report kit dogfooding");
  assert(docsIndex.includes("dogfooding/delta-receiver-lint-dogfooding-v1.8.md"), "Docs index must link v1.8 receiver lint dogfooding");
  assert(docsIndex.includes("../examples/receiver/delta-report-pass/README.md"), "Docs index should link delta receiver pass report example");
  assert(docsIndex.includes("../examples/receiver/delta-report-difference-found/README.md"), "Docs index should link delta receiver difference report example");
  assert(docsIndex.includes("../examples/receiver/usage-pack/README.md"), "Docs index should link receiver usage-pack example router");
  assert(docsIndex.includes("../examples/receiver/lint/README.md"), "Docs index should link receiver lint fixture pack");
  assert(docsIndex.includes("../examples/receiver/lint/repair/README.md"), "Docs index should link receiver lint repair pack");
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
  assert(receiverLanguageRoutingReport.includes("pass/fail"), "Receiver language-routing report must preserve pass/fail wording");
  assert(receiverLanguageRoutingReport.includes("receiver_task_status: completed"), "Receiver language-routing report must include receiver task status");
  assert(receiverLanguageRoutingReport.includes("declared_checks_status: skipped"), "Receiver language-routing report must explain skipped declared checks");
  assert(receiverLanguageRoutingReport.includes("handoff_acceptance: pass"), "Receiver language-routing report must include pass acceptance");
  assert(receiverLanguageRoutingReport.includes("source_window_inherited_facts"), "Receiver language-routing report must separate inherited facts");
  assert(receiverLanguageRoutingReport.includes("live_repo_state"), "Receiver language-routing report must include live repo facts");
  assert(receiverLanguageRoutingReport.includes("receiver_window_rechecks"), "Receiver language-routing report must include receiver rechecks");
  assert(receiverLanguageRoutingReport.includes("wait for user confirmation"), "Receiver language-routing report must stop at the confirmation gate");
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
  checkV2ContextPackDocs({
    docsIndex,
    testingDoc,
    v2ContextPackRoadmapDoc,
    contextPackHumanNextStepHintsDogfoodingV271Doc,
    v280PlanDoc,
    v280ReleaseDoc,
    v290PlanDoc,
    v290ReleaseDoc,
    v291ReleaseDoc,
    v300PlanDoc,
    continuationHarnessDogfoodingDoc,
    basebriefCliScript,
    basebriefContinuationHarnessScript,
    basebriefProjectProfileScript,
    basebriefWorkflowScript,
    continuationExampleReadme,
    projectProfileExampleReadme,
    projectProfileExample,
  });
  assert(testingDoc.includes("v1.5 Delta Receiver Lint Mini Plan"), "Testing docs must document the v1.5 lint mini plan");
  assert(testingDoc.includes("v1.5 Delta Receiver Lint Mini Local Closeout"), "Testing docs must document the v1.5 lint mini closeout");
  assert(testingDoc.includes("v1.6 Delta Receiver Lint Fixture Pack Plan"), "Testing docs must document the v1.6 lint fixture pack plan");
  assert(testingDoc.includes("v1.6 Delta Receiver Lint Fixture Pack Local Closeout"), "Testing docs must document the v1.6 lint fixture pack closeout");
  assert(testingDoc.includes("v1.7 Delta Receiver Lint Repair Pack Plan"), "Testing docs must document the v1.7 lint repair pack plan");
  assert(testingDoc.includes("v1.7 Delta Receiver Lint Repair Pack Local Closeout"), "Testing docs must document the v1.7 lint repair pack closeout");
  assert(testingDoc.includes("v1.8 Delta Receiver Lint Dogfooding Evidence Plan"), "Testing docs must document the v1.8 lint dogfooding plan");
  assert(testingDoc.includes("v1.8 Delta Receiver Lint Dogfooding Evidence Local Closeout"), "Testing docs must document the v1.8 lint dogfooding closeout");
  assert(testingDoc.includes("v1.9 Delta Receiver Lint Discoverability / Adoption Plan"), "Testing docs must document the v1.9 lint adoption plan");
  assert(testingDoc.includes("v1.9 Delta Receiver Lint Discoverability / Adoption Local Closeout"), "Testing docs must document the v1.9 lint adoption closeout");
  assert(testingDoc.includes("v1.9.1 Delta Receiver Final Closure / Freeze"), "Testing docs must document the v1.9.1 final closure");
  assert(testingDoc.includes("testing-v1.x-delta-receiver-closure-matrix.md"), "Testing docs must link the v1.x delta receiver closure matrix");
  assert(testingDoc.includes("existing receiver examples"), "Testing docs must preserve v1.9 adoption path");
  assert(testingDoc.includes("receiver-specific rule families"), "Testing docs must describe v1.5 receiver rule families");
  assert(testingDoc.includes("basebrief-receiver-check-result-v1"), "Testing docs must mention receiver result JSON coverage");
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
  assert(checksDoc.includes("## Receiver Lint"), "checks.md must document receiver lint");
  assert(checksDoc.includes("basebrief-receiver-check-result-v1"), "checks.md must keep receiver JSON detection explicit");
  assert(checksDoc.includes("receiver.missing-human-anchor"), "checks.md must list missing-human-anchor");
  assert(checksDoc.includes("receiver.invalid-result-consistency"), "checks.md must list invalid-result-consistency");
  assert(checksDoc.includes("receiver.missing-difference-semantics"), "checks.md must list difference-semantics warnings");
  assert(checksDoc.includes("completed verification"), "checks.md must preserve difference_found semantics");
  assert(checksDoc.includes("examples/receiver/lint/"), "checks.md must link receiver lint fixtures");
  assert(checksDoc.includes("examples/receiver/lint/repair/"), "checks.md must link receiver lint repairs");
  assert(checksDoc.includes("delta-receiver-lint-dogfooding-v1.8.md"), "checks.md must link receiver lint dogfooding evidence");
  assert(checksDoc.includes("Receiver Lint Adoption Path"), "checks.md must describe receiver lint adoption path");
  assert(checksDoc.includes("docs/releases/v1.9.0-plan.md"), "checks.md must link v1.9 lint adoption plan");
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
  assert(cliLiteDoc.includes("node scripts/basebrief.js context-pack --repo <target-repo> --output-dir <dir>"), "cli-lite.md must document context-pack command");
  assert(cliLiteDoc.includes("node scripts/basebrief.js resume --input <context-pack-dir>"), "cli-lite.md must document resume command");
  assert(cliLiteDoc.includes("node scripts/basebrief.js export --input <context-pack-dir> --output-dir <dir>"), "cli-lite.md must document export command");
  assert(cliLiteDoc.includes("node scripts/basebrief.js doctor --repo <target-repo> --context-pack <context-pack-dir>"), "cli-lite.md must document doctor command");
  assert(cliLiteDoc.includes("node scripts/basebrief.js check --input <context-pack-dir>"), "cli-lite.md must document context-pack human next step");
  assertIncludesPhrase(cliLiteDoc, "Human `check` output includes `next_step=` guidance", "cli-lite.md must document check human next-step guidance");
  assertIncludesPhrase(cliLiteDoc, "errored packs ask the user to fix reported errors before `resume`, `doctor`, or `export`", "cli-lite.md must document errored check guidance");
  assert(cliLiteDoc.includes("node scripts/basebrief.js check --input <export-dir>"), "cli-lite.md must document export human next step");
  assertIncludesPhrase(cliLiteDoc, "Human output includes `next_step=` guidance for warning and error findings", "cli-lite.md must document doctor human next-step guidance");
  assertIncludesPhrase(cliLiteDoc, "Human `next_step=` and `optional_next_step=` hints are not added to JSON output", "cli-lite.md must keep human hints out of JSON output");
  assert(cliLiteDoc.includes("manifest.json"), "cli-lite.md must document export manifest");
  assert(cliLiteDoc.includes("context-pack.md"), "cli-lite.md must document readable export file");
  assert(cliLiteDoc.includes("context.json"), "cli-lite.md must document machine-readable export file");
  assert(cliLiteDoc.includes("adapter-notes.md"), "cli-lite.md must document adapter notes export file");
  assert(cliLiteDoc.includes("releases/v2.2.0-plan.md"), "cli-lite.md must link v2.2.0 resume plan");
  assert(cliLiteDoc.includes("specs/context-pack-resume.md"), "cli-lite.md must link context pack resume spec");
  assert(cliLiteDoc.includes("releases/v2.4.0-plan.md"), "cli-lite.md must link v2.4.0 export plan");
  assert(cliLiteDoc.includes("releases/v2.4.0.md"), "cli-lite.md must link v2.4.0 export closeout");
  assert(cliLiteDoc.includes("specs/file-only-export.md"), "cli-lite.md must link file-only export spec");
  assert(cliLiteDoc.includes("dogfooding/file-only-export-v2.4.0.md"), "cli-lite.md must link file-only export dogfooding");
  assert(cliLiteDoc.includes("../examples/file-only-export/README.md"), "cli-lite.md must link file-only export example kit");
  assert(cliLiteDoc.includes("releases/v2.5.0-plan.md"), "cli-lite.md must link v2.5.0 doctor plan");
  assert(cliLiteDoc.includes("releases/v2.5.0.md"), "cli-lite.md must link v2.5.0 doctor closeout");
  assert(cliLiteDoc.includes("specs/context-pack-doctor.md"), "cli-lite.md must link context pack doctor spec");
  assert(cliLiteDoc.includes("dogfooding/context-pack-doctor-v2.5.0.md"), "cli-lite.md must link context pack doctor dogfooding");
  assert(cliLiteDoc.includes("../examples/context-pack-doctor/README.md"), "cli-lite.md must link context pack doctor example kit");
  assert(cliLiteDoc.includes("auto-created nested directory"), "cli-lite.md must clarify export directory naming");
  assert(cliLiteDoc.includes("examples/context-pack-lite/README.md"), "cli-lite.md must link context pack example kit");
  assert(cliLiteDoc.includes("releases/v2.0.0.md"), "cli-lite.md must link v2.0.0 closeout");
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
  assert(v110ReleaseDoc.includes("historical pre-commit closeout fact"), "v1.1.0 closeout doc must label the commit count as historical evidence");
  assert(v110ReleaseDoc.includes("count drift is non-blocking"), "v1.1.0 closeout doc must explain non-blocking historical count drift");
  assert(v110ReleaseDoc.includes("branch, HEAD, and worktree facts"), "v1.1.0 closeout doc must anchor later acceptance to refreshed live facts");
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
  assert(v120PlanDoc.includes("v1.2.0 Delta Receiver Report Kit Plan"), "v1.2.0 plan must have stable title");
  assert(v120PlanDoc.includes("Delta Receiver Report Kit"), "v1.2.0 plan must name the report kit");
  assert(v120PlanDoc.includes("Markdown/text reporting aid"), "v1.2.0 plan must define the kit as text reporting");
  assert(v120PlanDoc.includes("not a JSON schema"), "v1.2.0 plan must reject report schema scope");
  assert(v120PlanDoc.includes("not a push, tag, release"), "v1.2.0 plan must avoid publication claims");
  assert(v120PlanDoc.includes("receiver_task_status"), "v1.2.0 plan must require receiver task status");
  assert(v120PlanDoc.includes("repository_state_status"), "v1.2.0 plan must require repository state status");
  assert(v120PlanDoc.includes("handoff_acceptance"), "v1.2.0 plan must require handoff acceptance");
  assert(v120PlanDoc.includes("blocking_or_repair_notes"), "v1.2.0 plan must require repair notes");
  assert(v120PlanDoc.includes("current_goal"), "v1.2.0 plan must require current goal");
  assert(v120PlanDoc.includes("live_repo_state"), "v1.2.0 plan must require live repo state");
  assert(v120PlanDoc.includes("inherited_fact_differences"), "v1.2.0 plan must require inherited fact differences");
  assert(v120PlanDoc.includes("hard_boundaries"), "v1.2.0 plan must require hard boundaries");
  assert(v120PlanDoc.includes("next_narrow_slice"), "v1.2.0 plan must require next narrow slice");
  assert(v120PlanDoc.includes("source-window inherited facts"), "v1.2.0 plan must separate source-window facts");
  assert(v120PlanDoc.includes("receiver-window\nrechecks"), "v1.2.0 plan must separate receiver-window rechecks");
  assert(v120PlanDoc.includes("handoff_acceptance: pass"), "v1.2.0 plan must define pass");
  assert(v120PlanDoc.includes("handoff_acceptance: difference_found"), "v1.2.0 plan must define difference_found");
  assert(v120PlanDoc.includes("handoff_acceptance: blocked"), "v1.2.0 plan must define blocked");
  assert(v120PlanDoc.includes("historical count drift as non-blocking"), "v1.2.0 plan must explain non-blocking historical count drift");
  assert(v120PlanDoc.includes("basebrief-project-state-v1"), "v1.2.0 plan must preserve project-state schema");
  assert(v120PlanDoc.includes("basebrief-delta-handoff-v1"), "v1.2.0 plan must preserve delta handoff schema");
  assert(v120PlanDoc.includes("basebrief-delta-baseline-v1"), "v1.2.0 plan must preserve delta baseline schema");
  assert(v120PlanDoc.includes("No provider request"), "v1.2.0 plan must reject provider scope");
  assert(v120PlanDoc.includes("No runtime integration"), "v1.2.0 plan must reject runtime scope");
  assert(v120PlanDoc.includes("No plugin, MCP, IDE"), "v1.2.0 plan must reject plugin/MCP/IDE scope");
  assert(v120PlanDoc.includes("No schema-v2 work"), "v1.2.0 plan must reject schema-v2 scope");
  assert(v120PlanDoc.includes("No new CLI command"), "v1.2.0 plan must avoid new CLI commands");
  assert(v120PlanDoc.includes("No machine-readable JSON schema"), "v1.2.0 plan must avoid report schema work");
  assert(v120PlanDoc.includes("No command output format change"), "v1.2.0 plan must avoid command output changes");
  assert(v120PlanDoc.includes("provider_probe_status=skipped"), "v1.2.0 plan must preserve skipped provider gate");
  assert(v120ReleaseDoc.includes("v1.2.0 Delta Receiver Report Kit Local Closeout"), "v1.2.0 closeout doc must have stable title");
  assert(v120ReleaseDoc.includes("Delta Receiver Report Kit"), "v1.2.0 closeout doc must name the report kit");
  assert(v120ReleaseDoc.includes("docs/releases/v1.2.0-plan.md"), "v1.2.0 closeout doc must link planning baseline");
  assert(v120ReleaseDoc.includes("docs/dogfooding/delta-receiver-report-kit-v1.2.md"), "v1.2.0 closeout doc must link dogfooding record");
  assert(v120ReleaseDoc.includes("examples/receiver/delta-report-pass/README.md"), "v1.2.0 closeout doc must link pass example");
  assert(v120ReleaseDoc.includes("examples/receiver/delta-report-difference-found/README.md"), "v1.2.0 closeout doc must link difference example");
  assert(v120ReleaseDoc.includes("receiver_task_status"), "v1.2.0 closeout doc must require receiver task status");
  assert(v120ReleaseDoc.includes("repository_state_status"), "v1.2.0 closeout doc must require repository state status");
  assert(v120ReleaseDoc.includes("handoff_acceptance"), "v1.2.0 closeout doc must require handoff acceptance");
  assert(v120ReleaseDoc.includes("blocking_or_repair_notes"), "v1.2.0 closeout doc must require repair notes");
  assert(v120ReleaseDoc.includes("current_goal"), "v1.2.0 closeout doc must require current goal");
  assert(v120ReleaseDoc.includes("live_repo_state"), "v1.2.0 closeout doc must require live repo state");
  assert(v120ReleaseDoc.includes("inherited_fact_differences"), "v1.2.0 closeout doc must require inherited fact differences");
  assert(v120ReleaseDoc.includes("hard_boundaries"), "v1.2.0 closeout doc must require hard boundaries");
  assert(v120ReleaseDoc.includes("next_narrow_slice"), "v1.2.0 closeout doc must require next narrow slice");
  assert(v120ReleaseDoc.includes("source-window inherited facts"), "v1.2.0 closeout doc must separate source-window facts");
  assert(v120ReleaseDoc.includes("receiver-window\nrechecks"), "v1.2.0 closeout doc must separate receiver-window rechecks");
  assert(v120ReleaseDoc.includes("handoff_acceptance: pass"), "v1.2.0 closeout doc must define pass");
  assert(v120ReleaseDoc.includes("handoff_acceptance: difference_found"), "v1.2.0 closeout doc must define difference_found");
  assert(v120ReleaseDoc.includes("handoff_acceptance: blocked"), "v1.2.0 closeout doc must define blocked");
  assert(v120ReleaseDoc.includes("It is not an agent failure"), "v1.2.0 closeout doc must preserve difference_found semantics");
  assert(v120ReleaseDoc.includes("historical count drift is non-blocking"), "v1.2.0 closeout doc must explain non-blocking historical count drift");
  assert(v120ReleaseDoc.includes("basebrief-project-state-v2"), "v1.2.0 closeout doc must reject project-state v2");
  assert(v120ReleaseDoc.includes("No provider request"), "v1.2.0 closeout doc must reject provider scope");
  assert(v120ReleaseDoc.includes("No runtime integration"), "v1.2.0 closeout doc must reject runtime scope");
  assert(v120ReleaseDoc.includes("No plugin, MCP, IDE"), "v1.2.0 closeout doc must reject plugin/MCP/IDE scope");
  assert(v120ReleaseDoc.includes("No schema-v2 work"), "v1.2.0 closeout doc must reject schema-v2 scope");
  assert(v120ReleaseDoc.includes("No new CLI command"), "v1.2.0 closeout doc must avoid new CLI commands");
  assert(v120ReleaseDoc.includes("No machine-readable JSON schema"), "v1.2.0 closeout doc must avoid report schema work");
  assert(v120ReleaseDoc.includes("No command output format change"), "v1.2.0 closeout doc must avoid command output changes");
  assert(v120ReleaseDoc.includes("provider_probe_status=skipped"), "v1.2.0 closeout doc must preserve skipped provider gate");
  assert(v130PlanDoc.includes("v1.3.0 Delta Receiver Starter Integration Plan"), "v1.3.0 plan must have stable title");
  assert(v130PlanDoc.includes("Delta Receiver Starter Integration"), "v1.3.0 plan must name starter integration");
  assert(v130PlanDoc.includes("v1.2 report kit"), "v1.3.0 plan must build on the v1.2 report kit");
  assert(/starter-facing docs\s+and\s+examples/.test(v130PlanDoc), "v1.3.0 plan must stay starter-facing");
  assert(v130PlanDoc.includes("The goal is not to create a new runtime or command"), "v1.3.0 plan must reject runtime and command scope");
  assert(v130PlanDoc.includes("source-window inherited facts"), "v1.3.0 plan must preserve inherited facts separation");
  assert(v130PlanDoc.includes("receiver-window rechecks"), "v1.3.0 plan must preserve receiver rechecks");
  assert(v130PlanDoc.includes("difference_found"), "v1.3.0 plan must preserve difference_found semantics");
  assert(v130PlanDoc.includes("historical `commits_in_range` drift"), "v1.3.0 plan must preserve historical count drift guidance");
  assert(v130PlanDoc.includes("No provider request"), "v1.3.0 plan must reject provider scope");
  assert(v130PlanDoc.includes("No runtime integration"), "v1.3.0 plan must reject runtime scope");
  assert(v130PlanDoc.includes("No plugin, MCP, IDE"), "v1.3.0 plan must reject plugin/MCP/IDE scope");
  assert(v130PlanDoc.includes("No schema-v2 work"), "v1.3.0 plan must reject schema-v2 scope");
  assert(v130PlanDoc.includes("No new CLI command"), "v1.3.0 plan must avoid new CLI commands");
  assert(v130PlanDoc.includes("No machine-readable JSON schema"), "v1.3.0 plan must avoid report schema work");
  assert(v130PlanDoc.includes("No command output format change"), "v1.3.0 plan must avoid command output changes");
  assert(v130PlanDoc.includes("Thin command exploration"), "v1.3.0 plan must defer command exploration");
  assert(v130PlanDoc.includes("provider_probe_status=skipped"), "v1.3.0 plan must preserve skipped provider gate");
  assert(v130ReleaseDoc.includes("v1.3.0 Delta Receiver Starter Integration Local Closeout"), "v1.3.0 closeout doc must have stable title");
  assert(v130ReleaseDoc.includes("Delta Receiver Starter Integration"), "v1.3.0 closeout doc must name starter integration");
  assert(v130ReleaseDoc.includes("docs/releases/v1.3.0-plan.md"), "v1.3.0 closeout doc must link planning baseline");
  assert(v130ReleaseDoc.includes("docs/quickstart-5min.md"), "v1.3.0 closeout doc must link quickstart update");
  assert(v130ReleaseDoc.includes("docs/golden-path.md"), "v1.3.0 closeout doc must link golden-path update");
  assert(v130ReleaseDoc.includes("examples/golden-path/README.md"), "v1.3.0 closeout doc must link example README");
  assert(v130ReleaseDoc.includes("examples/golden-path/first-pass-receiver-report.md"), "v1.3.0 closeout doc must link first-pass example");
  assert(v130ReleaseDoc.includes("examples/golden-path/follow-up-receiver-report.md"), "v1.3.0 closeout doc must link follow-up example");
  assert(v130ReleaseDoc.includes("templates/zh-CN/NEXT_CHAT_PROMPT.md"), "v1.3.0 closeout doc must link starter template update");
  assert(v130ReleaseDoc.includes("pass/fail"), "v1.3.0 closeout doc must preserve pass/fail anchor");
  assert(v130ReleaseDoc.includes("wait for user confirmation"), "v1.3.0 closeout doc must preserve confirmation anchor");
  assert(v130ReleaseDoc.includes("declared_checks_status"), "v1.3.0 closeout doc must preserve declared checks status");
  assert(v130ReleaseDoc.includes("current_goal"), "v1.3.0 closeout doc must include current_goal");
  assert(v130ReleaseDoc.includes("live_repo_state"), "v1.3.0 closeout doc must include live_repo_state");
  assert(v130ReleaseDoc.includes("inherited_fact_differences"), "v1.3.0 closeout doc must include inherited_fact_differences");
  assert(v130ReleaseDoc.includes("hard_boundaries"), "v1.3.0 closeout doc must include hard_boundaries");
  assert(v130ReleaseDoc.includes("next_narrow_slice"), "v1.3.0 closeout doc must include next_narrow_slice");
  assert(v130ReleaseDoc.includes("source-window inherited facts"), "v1.3.0 closeout doc must separate inherited facts");
  assert(v130ReleaseDoc.includes("live repo\nfacts"), "v1.3.0 closeout doc must separate live repo facts");
  assert(v130ReleaseDoc.includes("receiver-window rechecks"), "v1.3.0 closeout doc must separate receiver rechecks");
  assert(v130ReleaseDoc.includes("difference_found"), "v1.3.0 closeout doc must preserve difference_found semantics");
  assert(v130ReleaseDoc.includes("historical count drift is non-blocking"), "v1.3.0 closeout doc must explain non-blocking historical count drift");
  assert(v130ReleaseDoc.includes("No provider request"), "v1.3.0 closeout doc must reject provider scope");
  assert(v130ReleaseDoc.includes("No runtime integration"), "v1.3.0 closeout doc must reject runtime scope");
  assert(v130ReleaseDoc.includes("No plugin, MCP, IDE"), "v1.3.0 closeout doc must reject plugin/MCP/IDE scope");
  assert(v130ReleaseDoc.includes("No schema-v2 work"), "v1.3.0 closeout doc must reject schema-v2 scope");
  assert(v130ReleaseDoc.includes("No new CLI command"), "v1.3.0 closeout doc must avoid new CLI commands");
  assert(v130ReleaseDoc.includes("No machine-readable JSON schema"), "v1.3.0 closeout doc must avoid report schema work");
  assert(v130ReleaseDoc.includes("No command output format change"), "v1.3.0 closeout doc must avoid command output changes");
  assert(v130ReleaseDoc.includes("provider_probe_status=skipped"), "v1.3.0 closeout doc must preserve skipped provider gate");
  assert(v140PlanDoc.includes("v1.4.0 Delta Receiver Usage Pack Plan"), "v1.4.0 plan must have stable title");
  assert(v140PlanDoc.includes("Delta Receiver Usage Pack"), "v1.4.0 plan must name usage pack");
  assert(v140PlanDoc.includes("public usage guide"), "v1.4.0 plan must add a public usage guide");
  assert(v140PlanDoc.includes("example router"), "v1.4.0 plan must add an example router");
  assert(v140PlanDoc.includes("copyable starter outline"), "v1.4.0 plan must add a copyable starter outline");
  assert(v140PlanDoc.includes("pass"), "v1.4.0 plan must preserve pass semantics");
  assert(v140PlanDoc.includes("difference_found"), "v1.4.0 plan must preserve difference_found semantics");
  assert(v140PlanDoc.includes("blocked"), "v1.4.0 plan must preserve blocked semantics");
  assert(v140PlanDoc.includes("source-window inherited facts"), "v1.4.0 plan must preserve inherited facts separation");
  assert(v140PlanDoc.includes("live repo facts"), "v1.4.0 plan must preserve live repo separation");
  assert(v140PlanDoc.includes("receiver-window\n  rechecks") || v140PlanDoc.includes("receiver-window rechecks"), "v1.4.0 plan must preserve receiver rechecks");
  assert(v140PlanDoc.includes("historical `commits_in_range` drift"), "v1.4.0 plan must preserve historical count drift guidance");
  assert(v140PlanDoc.includes("No provider request"), "v1.4.0 plan must reject provider scope");
  assert(v140PlanDoc.includes("No runtime integration"), "v1.4.0 plan must reject runtime scope");
  assert(v140PlanDoc.includes("No plugin, MCP, IDE"), "v1.4.0 plan must reject plugin/MCP/IDE scope");
  assert(v140PlanDoc.includes("No schema-v2 work"), "v1.4.0 plan must reject schema-v2 scope");
  assert(v140PlanDoc.includes("No new CLI command"), "v1.4.0 plan must avoid new CLI commands");
  assert(v140PlanDoc.includes("No machine-readable JSON schema"), "v1.4.0 plan must avoid report schema work");
  assert(v140PlanDoc.includes("No command output format change"), "v1.4.0 plan must avoid command output changes");
  assert(v140PlanDoc.includes("provider_probe_status=skipped"), "v1.4.0 plan must preserve skipped provider gate");
  assert(v140ReleaseDoc.includes("v1.4.0 Delta Receiver Usage Pack Local Closeout"), "v1.4.0 closeout doc must have stable title");
  assert(v140ReleaseDoc.includes("Delta Receiver Usage Pack"), "v1.4.0 closeout doc must name usage pack");
  assert(v140ReleaseDoc.includes("docs/releases/v1.4.0-plan.md"), "v1.4.0 closeout doc must link planning baseline");
  assert(v140ReleaseDoc.includes("docs/receiver-usage-pack.md"), "v1.4.0 closeout doc must link usage guide");
  assert(v140ReleaseDoc.includes("examples/receiver/usage-pack/README.md"), "v1.4.0 closeout doc must link usage-pack router");
  assert(v140ReleaseDoc.includes("examples/receiver/usage-pack/starter-report-outline.md"), "v1.4.0 closeout doc must link starter outline");
  assert(v140ReleaseDoc.includes("pass/fail"), "v1.4.0 closeout doc must preserve pass/fail anchor");
  assert(v140ReleaseDoc.includes("wait for user confirmation"), "v1.4.0 closeout doc must preserve confirmation anchor");
  assert(v140ReleaseDoc.includes("difference_found"), "v1.4.0 closeout doc must preserve difference_found semantics");
  assert(v140ReleaseDoc.includes("blocked"), "v1.4.0 closeout doc must preserve blocked semantics");
  assert(v140ReleaseDoc.includes("historical `commits_in_range` drift remains non-blocking"), "v1.4.0 closeout doc must explain non-blocking historical count drift");
  assert(v140ReleaseDoc.includes("No provider request"), "v1.4.0 closeout doc must reject provider scope");
  assert(v140ReleaseDoc.includes("No runtime integration"), "v1.4.0 closeout doc must reject runtime scope");
  assert(v140ReleaseDoc.includes("No plugin, MCP, IDE"), "v1.4.0 closeout doc must reject plugin/MCP/IDE scope");
  assert(v140ReleaseDoc.includes("No schema-v2 work"), "v1.4.0 closeout doc must reject schema-v2 scope");
  assert(v140ReleaseDoc.includes("No new CLI command"), "v1.4.0 closeout doc must avoid new CLI commands");
  assert(v140ReleaseDoc.includes("No machine-readable JSON schema"), "v1.4.0 closeout doc must avoid report schema work");
  assert(v140ReleaseDoc.includes("No command output format change"), "v1.4.0 closeout doc must avoid command output changes");
  assert(v140ReleaseDoc.includes("provider_probe_status=skipped"), "v1.4.0 closeout doc must preserve skipped provider gate");
  assert(v150PlanDoc.includes("v1.5.0 Delta Receiver Lint Mini Plan"), "v1.5.0 plan must have stable title");
  assert(v150PlanDoc.includes("Delta Receiver Lint Mini"), "v1.5.0 plan must name the lint line");
  assert(v150PlanDoc.includes("explicit receiver Markdown and receiver result JSON shapes"), "v1.5.0 plan must keep receiver detection explicit");
  assert(v150PlanDoc.includes("missing machine fields"), "v1.5.0 plan must classify missing machine fields as errors");
  assert(v150PlanDoc.includes("missing `difference_found` semantics"), "v1.5.0 plan must classify difference semantics gaps as warnings");
  assert(v150PlanDoc.includes("basebrief-receiver-check-result-v1"), "v1.5.0 plan must cover receiver result JSON");
  assert(v150PlanDoc.includes("No provider request"), "v1.5.0 plan must reject provider scope");
  assert(v150PlanDoc.includes("No runtime integration"), "v1.5.0 plan must reject runtime scope");
  assert(v150PlanDoc.includes("No plugin, MCP, IDE"), "v1.5.0 plan must reject plugin/MCP/IDE scope");
  assert(v150PlanDoc.includes("No schema-v2 work"), "v1.5.0 plan must reject schema-v2 scope");
  assert(v150PlanDoc.includes("No new CLI command"), "v1.5.0 plan must avoid new CLI commands");
  assert(v150PlanDoc.includes("No machine-readable JSON schema"), "v1.5.0 plan must avoid report schema work");
  assert(v150PlanDoc.includes("No command output format change"), "v1.5.0 plan must avoid command output changes");
  assert(v150PlanDoc.includes("provider_probe_status=skipped"), "v1.5.0 plan must preserve skipped provider gate");
  assert(v150ReleaseDoc.includes("v1.5.0 Delta Receiver Lint Mini Local Closeout"), "v1.5.0 closeout doc must have stable title");
  assert(v150ReleaseDoc.includes("Delta Receiver Lint Mini"), "v1.5.0 closeout doc must name the lint line");
  assert(v150ReleaseDoc.includes("docs/releases/v1.5.0-plan.md"), "v1.5.0 closeout doc must link the planning baseline");
  assert(v150ReleaseDoc.includes("scripts/basebrief_check_artifacts.js"), "v1.5.0 closeout doc must name the checker implementation");
  assert(v150ReleaseDoc.includes("docs/checks.md"), "v1.5.0 closeout doc must include checks doc coverage");
  assert(v150ReleaseDoc.includes("docs/receiver-check.md"), "v1.5.0 closeout doc must include receiver-check doc coverage");
  assert(v150ReleaseDoc.includes("docs/receiver-usage-pack.md"), "v1.5.0 closeout doc must include usage-pack doc coverage");
  assert(v150ReleaseDoc.includes("receiver.missing-machine-field"), "v1.5.0 closeout doc must list missing-machine-field");
  assert(v150ReleaseDoc.includes("receiver.invalid-result-consistency"), "v1.5.0 closeout doc must list invalid-result-consistency");
  assert(v150ReleaseDoc.includes("receiver.missing-drift-semantics"), "v1.5.0 closeout doc must list drift-semantics");
  assert(v150ReleaseDoc.includes("schemaVersion: basebrief-receiver-check-result-v1"), "v1.5.0 closeout doc must keep JSON detection explicit");
  assert(v150ReleaseDoc.includes("`difference_found` remains a completed verification result"), "v1.5.0 closeout doc must preserve difference_found semantics");
  assert(v150ReleaseDoc.includes("node scripts/basebrief.js check --input examples/receiver/language-routing/receiver-report.md --json"), "v1.5.0 closeout doc must record receiver markdown validation");
  assert(v150ReleaseDoc.includes("node scripts/basebrief.js check --input examples/receiver/difference-found/receiver-check-result.json --json"), "v1.5.0 closeout doc must record receiver JSON validation");
  assert(v150ReleaseDoc.includes("No provider request"), "v1.5.0 closeout doc must reject provider scope");
  assert(v150ReleaseDoc.includes("No runtime integration"), "v1.5.0 closeout doc must reject runtime scope");
  assert(v150ReleaseDoc.includes("No plugin, MCP, IDE"), "v1.5.0 closeout doc must reject plugin/MCP/IDE scope");
  assert(v150ReleaseDoc.includes("No schema-v2 work"), "v1.5.0 closeout doc must reject schema-v2 scope");
  assert(v150ReleaseDoc.includes("No new CLI command"), "v1.5.0 closeout doc must avoid new CLI commands");
  assert(v150ReleaseDoc.includes("No machine-readable JSON schema"), "v1.5.0 closeout doc must avoid report schema work");
  assert(v150ReleaseDoc.includes("No command output format change"), "v1.5.0 closeout doc must avoid command output changes");
  assert(v150ReleaseDoc.includes("provider_probe_status=skipped"), "v1.5.0 closeout doc must preserve skipped provider gate");
  assert(v160PlanDoc.includes("v1.6.0 Delta Receiver Lint Fixture Pack Plan"), "v1.6.0 plan must have stable title");
  assert(v160PlanDoc.includes("Delta Receiver Lint Fixture Pack"), "v1.6.0 plan must name the fixture pack");
  assert(v160PlanDoc.includes("examples/receiver/lint/"), "v1.6.0 plan must point to receiver lint fixtures");
  assert(v160PlanDoc.includes("clean pass"), "v1.6.0 plan must cover clean pass fixture");
  assert(v160PlanDoc.includes("receiver result JSON consistency error"), "v1.6.0 plan must cover JSON consistency fixture");
  assert(v160PlanDoc.includes("historical `commits_in_range` drift warning"), "v1.6.0 plan must cover drift warning fixture");
  assert(v160PlanDoc.includes("No new CLI command"), "v1.6.0 plan must avoid new CLI commands");
  assert(v160PlanDoc.includes("No machine-readable JSON schema"), "v1.6.0 plan must avoid schema work");
  assert(v160PlanDoc.includes("No command output format change"), "v1.6.0 plan must avoid command output changes");
  assert(v160PlanDoc.includes("provider_probe_status=skipped"), "v1.6.0 plan must preserve skipped provider gate");
  assert(v160ReleaseDoc.includes("v1.6.0 Delta Receiver Lint Fixture Pack Local Closeout"), "v1.6.0 closeout doc must have stable title");
  assert(v160ReleaseDoc.includes("Delta Receiver Lint Fixture Pack"), "v1.6.0 closeout doc must name the fixture pack");
  assert(v160ReleaseDoc.includes("docs/releases/v1.6.0-plan.md"), "v1.6.0 closeout doc must link the planning baseline");
  assert(v160ReleaseDoc.includes("examples/receiver/lint/README.md"), "v1.6.0 closeout doc must link the fixture guide");
  assert(v160ReleaseDoc.includes("receiver.missing-report-section"), "v1.6.0 closeout doc must list missing-report-section");
  assert(v160ReleaseDoc.includes("receiver.invalid-result-consistency"), "v1.6.0 closeout doc must list invalid-result-consistency");
  assert(v160ReleaseDoc.includes("receiver.missing-drift-semantics"), "v1.6.0 closeout doc must list drift-semantics");
  assert(v160ReleaseDoc.includes("node scripts/basebrief.js check --input examples/receiver/lint/clean-pass-receiver-report.md --json"), "v1.6.0 closeout doc must record clean fixture validation");
  assert(v160ReleaseDoc.includes("node scripts/basebrief.js check --input examples/receiver/lint/delta-missing-section-receiver-report.md --json"), "v1.6.0 closeout doc must record failing fixture validation");
  assert(v160ReleaseDoc.includes("No provider request"), "v1.6.0 closeout doc must reject provider scope");
  assert(v160ReleaseDoc.includes("No runtime integration"), "v1.6.0 closeout doc must reject runtime scope");
  assert(v160ReleaseDoc.includes("No plugin, MCP, IDE"), "v1.6.0 closeout doc must reject plugin/MCP/IDE scope");
  assert(v160ReleaseDoc.includes("No schema-v2 work"), "v1.6.0 closeout doc must reject schema-v2 scope");
  assert(v160ReleaseDoc.includes("No new CLI command"), "v1.6.0 closeout doc must avoid new CLI commands");
  assert(v160ReleaseDoc.includes("No machine-readable JSON schema"), "v1.6.0 closeout doc must avoid schema work");
  assert(v160ReleaseDoc.includes("No command output format change"), "v1.6.0 closeout doc must avoid command output changes");
  assert(v160ReleaseDoc.includes("provider_probe_status=skipped"), "v1.6.0 closeout doc must preserve skipped provider gate");
  assert(v170PlanDoc.includes("v1.7.0 Delta Receiver Lint Repair Pack Plan"), "v1.7.0 plan must have stable title");
  assert(v170PlanDoc.includes("Delta Receiver Lint Repair Pack"), "v1.7.0 plan must name the repair pack");
  assert(v170PlanDoc.includes("examples/receiver/lint/repair/"), "v1.7.0 plan must point to repair examples");
  assert(v170PlanDoc.includes("receiver.missing-human-anchor"), "v1.7.0 plan must cover missing-human-anchor repair");
  assert(v170PlanDoc.includes("receiver.missing-drift-semantics"), "v1.7.0 plan must cover drift-semantics repair");
  assert(v170PlanDoc.includes("No checker rule change"), "v1.7.0 plan must avoid checker rule changes");
  assert(v170PlanDoc.includes("No new CLI command"), "v1.7.0 plan must avoid new CLI commands");
  assert(v170PlanDoc.includes("No machine-readable JSON schema"), "v1.7.0 plan must avoid schema work");
  assert(v170PlanDoc.includes("provider_probe_status=skipped"), "v1.7.0 plan must preserve skipped provider gate");
  assert(v170ReleaseDoc.includes("v1.7.0 Delta Receiver Lint Repair Pack Local Closeout"), "v1.7.0 closeout doc must have stable title");
  assert(v170ReleaseDoc.includes("examples/receiver/lint/repair/README.md"), "v1.7.0 closeout doc must link repair guide");
  assert(v170ReleaseDoc.includes("fixed-delta-receiver-report.md"), "v1.7.0 closeout doc must link fixed Delta report");
  assert(v170ReleaseDoc.includes("fixed-starter-report.md"), "v1.7.0 closeout doc must link fixed starter report");
  assert(v170ReleaseDoc.includes("fixed-result.json"), "v1.7.0 closeout doc must link fixed result JSON");
  assert(v170ReleaseDoc.includes("receiver.invalid-result-consistency"), "v1.7.0 closeout doc must list invalid-result-consistency repair");
  assert(v170ReleaseDoc.includes("node scripts/basebrief.js check --input examples/receiver/lint/repair/fixed-delta-receiver-report.md --json"), "v1.7.0 closeout doc must record fixed Delta validation");
  assert(v170ReleaseDoc.includes("No checker rule change"), "v1.7.0 closeout doc must avoid checker rule changes");
  assert(v170ReleaseDoc.includes("provider_probe_status=skipped"), "v1.7.0 closeout doc must preserve skipped provider gate");
  assert(v180PlanDoc.includes("v1.8.0 Delta Receiver Lint Dogfooding Evidence Plan"), "v1.8.0 plan must have stable title");
  assert(v180PlanDoc.includes("Delta Receiver Lint Dogfooding Evidence"), "v1.8.0 plan must name the dogfooding line");
  assert(v180PlanDoc.includes("delta-receiver-lint-dogfooding-v1.8.md"), "v1.8.0 plan must point to dogfooding evidence");
  assert(v180PlanDoc.includes("v1.6 fixture behavior"), "v1.8.0 plan must cover v1.6 fixture behavior");
  assert(v180PlanDoc.includes("v1.7 repair"), "v1.8.0 plan must cover v1.7 repair behavior");
  assert(v180PlanDoc.includes("No checker rule change"), "v1.8.0 plan must avoid checker rule changes");
  assert(v180PlanDoc.includes("provider_probe_status=skipped"), "v1.8.0 plan must preserve skipped provider gate");
  assert(v180ReleaseDoc.includes("v1.8.0 Delta Receiver Lint Dogfooding Evidence Local Closeout"), "v1.8.0 closeout doc must have stable title");
  assert(v180ReleaseDoc.includes("docs/dogfooding/delta-receiver-lint-dogfooding-v1.8.md"), "v1.8.0 closeout doc must link dogfooding evidence");
  assert(v180ReleaseDoc.includes("fixed-delta-receiver-report.md"), "v1.8.0 closeout doc must link fixed Delta validation");
  assert(v180ReleaseDoc.includes("fixed-starter-report.md"), "v1.8.0 closeout doc must link fixed starter validation");
  assert(v180ReleaseDoc.includes("fixed-result.json"), "v1.8.0 closeout doc must link fixed result validation");
  assert(v180ReleaseDoc.includes("No checker rule change"), "v1.8.0 closeout doc must avoid checker rule changes");
  assert(v180ReleaseDoc.includes("provider_probe_status=skipped"), "v1.8.0 closeout doc must preserve skipped provider gate");
  assert(v190PlanDoc.includes("v1.9.0 Delta Receiver Lint Discoverability / Adoption Plan"), "v1.9.0 plan must have stable title");
  assert(v190PlanDoc.includes("Make the existing receiver lint public surface easier to find"), "v1.9.0 plan must define discoverability goal");
  assert(v190PlanDoc.includes("examples/receiver/usage-pack/README.md"), "v1.9.0 plan must route through usage-pack examples");
  assert(v190PlanDoc.includes("examples/receiver/lint/README.md"), "v1.9.0 plan must route through lint fixtures");
  assert(v190PlanDoc.includes("examples/receiver/lint/repair/README.md"), "v1.9.0 plan must route through lint repairs");
  assert(v190PlanDoc.includes("examples/receiver/delta-report-difference-found/README.md"), "v1.9.0 plan must map to existing difference_found example");
  assert(v190PlanDoc.includes("No checker rule change"), "v1.9.0 plan must avoid checker rule changes");
  assert(v190PlanDoc.includes("No new rule family"), "v1.9.0 plan must avoid new rule families");
  assert(v190PlanDoc.includes("No new CLI command"), "v1.9.0 plan must avoid new CLI commands");
  assert(v190PlanDoc.includes("No machine-readable JSON schema"), "v1.9.0 plan must avoid schema work");
  assert(v190PlanDoc.includes("No command output format change"), "v1.9.0 plan must avoid command output changes");
  assert(v190PlanDoc.includes("provider_probe_status=skipped"), "v1.9.0 plan must preserve skipped provider gate");
  assert(v190ReleaseDoc.includes("v1.9.0 Delta Receiver Lint Discoverability / Adoption Local Closeout"), "v1.9.0 closeout doc must have stable title");
  assert(v190ReleaseDoc.includes("docs/releases/v1.9.0-plan.md"), "v1.9.0 closeout doc must link planning baseline");
  assert(v190ReleaseDoc.includes("docs/receiver-usage-pack.md"), "v1.9.0 closeout doc must link usage-pack guide");
  assert(v190ReleaseDoc.includes("examples/receiver/usage-pack/README.md"), "v1.9.0 closeout doc must link usage-pack router");
  assert(v190ReleaseDoc.includes("examples/receiver/lint/README.md"), "v1.9.0 closeout doc must link lint fixture guide");
  assert(v190ReleaseDoc.includes("examples/receiver/lint/repair/README.md"), "v1.9.0 closeout doc must link lint repair guide");
  assert(v190ReleaseDoc.includes("examples/receiver/delta-report-difference-found/README.md"), "v1.9.0 closeout doc must link existing difference_found example");
  assert(v190ReleaseDoc.includes("Intentional failing fixtures remain learning inputs"), "v1.9.0 closeout doc must warn against copying broken fixtures");
  assert(v190ReleaseDoc.includes("difference_found` remains a completed verification result"), "v1.9.0 closeout doc must preserve difference_found semantics");
  assert(v190ReleaseDoc.includes("Historical `commits_in_range` drift remains non-blocking"), "v1.9.0 closeout doc must preserve drift semantics");
  assert(v190ReleaseDoc.includes("Receiver lint remains explicit-shape based"), "v1.9.0 closeout doc must preserve receiver lint detection scope");
  assert(v190ReleaseDoc.includes("No checker rule change"), "v1.9.0 closeout doc must avoid checker rule changes");
  assert(v190ReleaseDoc.includes("No new rule family"), "v1.9.0 closeout doc must avoid new rule families");
  assert(v190ReleaseDoc.includes("No new CLI command"), "v1.9.0 closeout doc must avoid new CLI commands");
  assert(v190ReleaseDoc.includes("No machine-readable JSON schema"), "v1.9.0 closeout doc must avoid schema work");
  assert(v190ReleaseDoc.includes("No command output format change"), "v1.9.0 closeout doc must avoid command output changes");
  assert(v190ReleaseDoc.includes("provider_probe_status=skipped"), "v1.9.0 closeout doc must preserve skipped provider gate");
  assert(v191ReleaseDoc.includes("v1.9.1 Delta Receiver Final Closure / Freeze"), "v1.9.1 final closure doc must have stable title");
  assert(v191ReleaseDoc.includes("docs/testing-v1.x-delta-receiver-closure-matrix.md"), "v1.9.1 final closure doc must link aggregate matrix");
  assert(v191ReleaseDoc.includes("v1.x Delta Receiver line is frozen"), "v1.9.1 final closure doc must define the freeze contract");
  assert(v191ReleaseDoc.includes("difference_found` remains a completed verification result"), "v1.9.1 final closure doc must preserve difference_found semantics");
  assert(v191ReleaseDoc.includes("Historical `commits_in_range` drift remains non-blocking"), "v1.9.1 final closure doc must preserve drift semantics");
  assert(v191ReleaseDoc.includes("Receiver lint remains explicit-shape based"), "v1.9.1 final closure doc must preserve lint detection scope");
  assert(v191ReleaseDoc.includes("No checker rule change"), "v1.9.1 final closure doc must avoid checker rule changes");
  assert(v191ReleaseDoc.includes("No new rule family"), "v1.9.1 final closure doc must avoid new rule families");
  assert(v191ReleaseDoc.includes("No new CLI command"), "v1.9.1 final closure doc must avoid new CLI commands");
  assert(v191ReleaseDoc.includes("No machine-readable JSON schema"), "v1.9.1 final closure doc must avoid schema work");
  assert(v191ReleaseDoc.includes("No command output format change"), "v1.9.1 final closure doc must avoid command output changes");
  assert(v191ReleaseDoc.includes("No v1.10 feature line"), "v1.9.1 final closure doc must avoid opening v1.10");
  assert(v191ReleaseDoc.includes("provider_probe_status=skipped"), "v1.9.1 final closure doc must preserve skipped provider gate");
  assert(v200PlanDoc.includes("No `context-pack` command in v2.0-A"), "v2 plan must stay docs-first");
  assert(v200PlanDoc.includes("context-pack --repo <target-repo>"), "v2 plan must document the v2.0-B context-pack command");
  assert(v200PlanDoc.includes("v2.0 Context Pack Lite"), "v2 plan must order Context Pack Lite first");
  assert(v200PlanDoc.includes("v2.1 Context Pack Check"), "v2 plan must keep check later");
  assert(v200PlanDoc.includes("not_available"), "v2 plan must define missing input degradation");
  assert(v200PlanDoc.includes("provider_probe_status=skipped"), "v2 plan must preserve skipped provider gate");
  assert(v200ReleaseDoc.includes("v2.0.0 Context Pack Lite Local Closeout"), "v2 closeout doc must have stable title");
  assert(v200ReleaseDoc.includes("v2.0-A"), "v2 closeout doc must record direction freeze");
  assert(v200ReleaseDoc.includes("v2.0-B"), "v2 closeout doc must record minimal generator");
  assert(v200ReleaseDoc.includes("v2.0-C"), "v2 closeout doc must record example and dogfooding closeout");
  assert(v200ReleaseDoc.includes("examples/context-pack-lite/"), "v2 closeout doc must mention context pack example kit");
  assert(v200ReleaseDoc.includes("context-pack-lite-fresh-receiver-v2.0.0.md"), "v2 closeout doc must mention dogfooding evidence");
  assert(v200ReleaseDoc.includes("No provider request"), "v2 closeout doc must preserve provider boundary");
  assert(v200ReleaseDoc.includes("No runtime integration"), "v2 closeout doc must preserve runtime boundary");
  assert(v200ReleaseDoc.includes("No schema-v2"), "v2 closeout doc must preserve schema-v2 boundary");
  assert(v200ReleaseDoc.includes("No Workflow Runner"), "v2 closeout doc must keep runner out of scope");
  assert(v200ReleaseDoc.includes("provider_probe_status=skipped"), "v2 closeout doc must preserve skipped provider gate");
  assert(contextPackLiteSpecDoc.includes("MANIFEST.md"), "context pack spec must define manifest artifact");
  assert(contextPackLiteSpecDoc.includes("REPO_MAP.md"), "context pack spec must define repo map artifact");
  assert(contextPackLiteSpecDoc.includes("KEY_FILES.md"), "context pack spec must define key files artifact");
  assert(contextPackLiteSpecDoc.includes("RECENT_DELTA.md"), "context pack spec must define recent delta artifact");
  assert(contextPackLiteSpecDoc.includes("RISK_BOUNDARIES.md"), "context pack spec must define risk boundaries artifact");
  assert(contextPackLiteSpecDoc.includes("RECEIVER_STATE.md"), "context pack spec must define receiver state artifact");
  assert(contextPackLiteSpecDoc.includes("NEXT_WINDOW_STARTER.md"), "context pack spec must define next-window starter artifact");
  assert(contextPackLiteSpecDoc.includes("context-pack --repo <target-repo>"), "context pack spec must document the minimal generator command");
  assert(contextPackLiteSpecDoc.includes("reviewed"), "context pack spec must define reviewed status");
  assert(contextPackLiteSpecDoc.includes("needs-review"), "context pack spec must define needs-review status");
  assert(contextPackLiteSpecDoc.includes("source"), "context pack spec must define source metadata");
  assert(contextPackLiteSpecDoc.includes("trust"), "context pack spec must define trust metadata");
  assert(contextPackLiteSpecDoc.includes("stale"), "context pack spec must define stale semantics");
  assert(contextPackLiteSpecDoc.includes("no provider request"), "context pack spec must preserve provider boundary");
  assert(contextPackLiteSpecDoc.includes("no AI automatic summary"), "context pack spec must avoid AI auto-summary");
  assert(v210PlanDoc.includes("v2.1.0 Context Pack Check Plan"), "v2.1 plan must have stable title");
  assert(v210PlanDoc.includes("v2.1-A check contract"), "v2.1 plan must name the contract freeze");
  assert(v210PlanDoc.includes("check --input <context-pack-dir>"), "v2.1 plan must prefer existing check input surface");
  assert(v210PlanDoc.includes("seven expected artifacts"), "v2.1 plan must require the seven artifact shape");
  assert(v210PlanDoc.includes("Review status"), "v2.1 plan must require review metadata");
  assert(v210PlanDoc.includes("No provider request") || v210PlanDoc.includes("provider request"), "v2.1 plan must preserve provider boundary");
  assert(v210PlanDoc.includes("No runtime integration") || v210PlanDoc.includes("runtime integration"), "v2.1 plan must preserve runtime boundary");
  assert(v210PlanDoc.includes("provider_probe_status=skipped"), "v2.1 plan must preserve skipped provider gate");
  assert(v210ReleaseDoc.includes("v2.1.0 Context Pack Check Local Closeout"), "v2.1 closeout doc must have stable title");
  assert(v210ReleaseDoc.includes("v2.1-A"), "v2.1 closeout doc must record contract freeze");
  assert(v210ReleaseDoc.includes("v2.1-B"), "v2.1 closeout doc must record minimal checker integration");
  assert(v210ReleaseDoc.includes("v2.1-C"), "v2.1 closeout doc must record evidence and closeout");
  assert(v210ReleaseDoc.includes("context-pack-check-acceptance-v2.1.0.md"), "v2.1 closeout doc must mention checker dogfooding evidence");
  assert(v210ReleaseDoc.includes("No new top-level `context-pack-check` command"), "v2.1 closeout doc must reject a new checker command");
  assert(v210ReleaseDoc.includes("No provider request"), "v2.1 closeout doc must preserve provider boundary");
  assert(v210ReleaseDoc.includes("No runtime integration"), "v2.1 closeout doc must preserve runtime boundary");
  assert(v210ReleaseDoc.includes("No schema-v2"), "v2.1 closeout doc must preserve schema-v2 boundary");
  assert(v210ReleaseDoc.includes("No Workflow Runner"), "v2.1 closeout doc must keep runner out of scope");
  assert(v210ReleaseDoc.includes("provider_probe_status=skipped"), "v2.1 closeout doc must preserve skipped provider gate");
  assert(contextPackCheckSpecDoc.includes("Context Pack Check Spec"), "context pack check spec must have stable title");
  assert(contextPackCheckSpecDoc.includes("Status: v2.1-A contract freeze"), "context pack check spec must mark contract freeze status");
  assert(contextPackCheckSpecDoc.includes("check --input <context-pack-dir>"), "context pack check spec must prefer existing check surface");
  assert(contextPackCheckSpecDoc.includes("Required Files"), "context pack check spec must define required files");
  assert(contextPackCheckSpecDoc.includes("Shared Metadata"), "context pack check spec must define shared metadata");
  assert(contextPackCheckSpecDoc.includes("Thickness"), "context pack check spec must define thickness direction");
  assert(contextPackCheckSpecDoc.includes("does not prove"), "context pack check spec must avoid live-fact proof claims");
  assert(v220PlanDoc.includes("v2.2.0 One-command Resume / New-window Prompt Plan"), "v2.2 plan must have stable title");
  assert(v220PlanDoc.includes("Status: v2.2-A contract freeze"), "v2.2 plan must mark contract freeze status");
  assert(v220PlanDoc.includes("resume --input <context-pack-dir>"), "v2.2 plan must document resume command");
  assert(v220PlanDoc.includes("warning-only packs still produce a prompt"), "v2.2 plan must allow warning-only resume");
  assert(v220PlanDoc.includes("error findings stop the command"), "v2.2 plan must block errored packs");
  assert(v220PlanDoc.includes("No context-pack generator output change"), "v2.2 plan must preserve generator output");
  assert(v220PlanDoc.includes("No `check --input <dir> --json` top-level shape change"), "v2.2 plan must preserve checker JSON shape");
  assert(v220PlanDoc.includes("No Workflow Runner"), "v2.2 plan must keep runner out of scope");
  assert(v220PlanDoc.includes("provider_probe_status=skipped"), "v2.2 plan must preserve skipped provider gate");
  assert(v220ReleaseDoc.includes("v2.2.0 One-command Resume / New-window Prompt Local Closeout"), "v2.2 closeout doc must have stable title");
  assert(v220ReleaseDoc.includes("v2.2-A"), "v2.2 closeout doc must record contract freeze");
  assert(v220ReleaseDoc.includes("v2.2-B"), "v2.2 closeout doc must record minimal implementation");
  assert(v220ReleaseDoc.includes("v2.2-C"), "v2.2 closeout doc must record dogfooding closeout");
  assert(v220ReleaseDoc.includes("Warning-only Context Pack inputs still produce a prompt"), "v2.2 closeout doc must preserve warning-only behavior");
  assert(v220ReleaseDoc.includes("Errored Context Pack inputs stop before prompt output"), "v2.2 closeout doc must preserve errored-pack blocking behavior");
  assert(v220ReleaseDoc.includes("No Context Pack Lite generator output change"), "v2.2 closeout doc must preserve generator output");
  assert(v220ReleaseDoc.includes("No `check --input <dir> --json` top-level shape change"), "v2.2 closeout doc must preserve checker JSON shape");
  assert(v220ReleaseDoc.includes("No Workflow Runner"), "v2.2 closeout doc must keep runner out of scope");
  assert(v220ReleaseDoc.includes("provider_probe_status=skipped"), "v2.2 closeout doc must preserve skipped provider gate");
  assert(v230PlanDoc.includes("v2.3.0 BaseBrief Format Plan"), "v2.3 plan must have stable title");
  assert(v230PlanDoc.includes("Status: v2.3-A contract freeze"), "v2.3 plan must mark contract freeze status");
  assert(v230PlanDoc.includes("context-pack/"), "v2.3 plan must define context-pack directory");
  assert(v230PlanDoc.includes("context-pack.md"), "v2.3 plan must define context-pack.md");
  assert(v230PlanDoc.includes("context.json"), "v2.3 plan must define context.json");
  assert(v230PlanDoc.includes("No command."), "v2.3 plan must stay docs-first");
  assert(v230PlanDoc.includes("No implementation."), "v2.3 plan must avoid implementation");
  assert(v230PlanDoc.includes("No JSON schema file."), "v2.3 plan must avoid schema-file work");
  assert(v230PlanDoc.includes("No schema-v2."), "v2.3 plan must avoid schema-v2");
  assert(v230PlanDoc.includes("No Workflow Runner."), "v2.3 plan must keep runner out of scope");
  assert(v230PlanDoc.includes("provider_probe_status=skipped"), "v2.3 plan must preserve skipped provider gate");
  assert(contextPackResumeSpecDoc.includes("Context Pack Resume Spec"), "context pack resume spec must have stable title");
  assert(contextPackResumeSpecDoc.includes("Status: v2.2-A contract freeze"), "context pack resume spec must mark contract freeze status");
  assert(contextPackResumeSpecDoc.includes("basebrief-resume-v1"), "context pack resume spec must name contract version");
  assert(contextPackResumeSpecDoc.includes("warning-only findings"), "context pack resume spec must define warning behavior");
  assert(contextPackResumeSpecDoc.includes("one or more errors: stop before prompt output"), "context pack resume spec must define error behavior");
  assert(contextPackResumeSpecDoc.includes("does not change the checker command's own JSON shape"), "context pack resume spec must preserve checker shape");
  assert(basebriefFormatSpecDoc.includes("BaseBrief Format Spec"), "basebrief format spec must have stable title");
  assert(basebriefFormatSpecDoc.includes("Status: v2.3-A contract freeze"), "basebrief format spec must mark contract freeze status");
  assert(basebriefFormatSpecDoc.includes("context-pack/"), "basebrief format spec must define context-pack directory");
  assert(basebriefFormatSpecDoc.includes("context-pack.md"), "basebrief format spec must define context-pack.md");
  assert(basebriefFormatSpecDoc.includes("context.json"), "basebrief format spec must define context.json");
  assert(basebriefFormatSpecDoc.includes("does not implement a command"), "basebrief format spec must stay docs-first");
  assert(basebriefFormatSpecDoc.includes("schema-v2"), "basebrief format spec must reject schema-v2");
  assert(basebriefFormatSpecDoc.includes("Workflow Runner"), "basebrief format spec must keep runner out of scope");
  assert(basebriefFormatSpecDoc.includes("Context Pack Lite generator output"), "basebrief format spec must preserve generator output");
  assert(v240PlanDoc.includes("v2.4.0 File-only Adapter / MCP-friendly Export Plan"), "v2.4 plan must have stable title");
  assert(v240PlanDoc.includes("Status: v2.4-A contract freeze"), "v2.4 plan must mark contract freeze status");
  assert(v240PlanDoc.includes("exports/manifest.json"), "v2.4 plan must define export manifest");
  assert(v240PlanDoc.includes("exports/context-pack.md"), "v2.4 plan must define readable export");
  assert(v240PlanDoc.includes("exports/context.json"), "v2.4 plan must define machine-readable export");
  assert(v240PlanDoc.includes("exports/adapter-notes.md"), "v2.4 plan must define adapter notes export");
  assert(v240PlanDoc.includes("MCP-friendly means file shapes"), "v2.4 plan must define MCP-friendly as file-only");
  assert(v240PlanDoc.includes("No command."), "v2.4 plan must stay docs-first");
  assert(v240PlanDoc.includes("No exporter."), "v2.4 plan must avoid exporter implementation");
  assert(v240PlanDoc.includes("No JSON schema file."), "v2.4 plan must avoid schema-file work");
  assert(v240PlanDoc.includes("No schema-v2."), "v2.4 plan must avoid schema-v2");
  assert(v240PlanDoc.includes("No Workflow Runner."), "v2.4 plan must keep runner out of scope");
  assert(v240PlanDoc.includes("No change to Context Pack Lite generator output."), "v2.4 plan must preserve context-pack generator output");
  assert(v240PlanDoc.includes("No change to `check --input <dir> --json` top-level shape."), "v2.4 plan must preserve checker JSON shape");
  assert(v240PlanDoc.includes("No change to existing `resume --input <context-pack-dir>` behavior."), "v2.4 plan must preserve resume behavior");
  assert(v240PlanDoc.includes("provider_probe_status=skipped"), "v2.4 plan must preserve skipped provider gate");
  assert(fileOnlyExportSpecDoc.includes("File-only Export Spec"), "file-only export spec must have stable title");
  assert(fileOnlyExportSpecDoc.includes("Status: v2.4-A contract freeze"), "file-only export spec must mark contract freeze status");
  assert(fileOnlyExportSpecDoc.includes("exports/manifest.json"), "file-only export spec must define export manifest");
  assert(fileOnlyExportSpecDoc.includes("exports/context-pack.md"), "file-only export spec must define readable export");
  assert(fileOnlyExportSpecDoc.includes("exports/context.json"), "file-only export spec must define machine-readable export");
  assert(fileOnlyExportSpecDoc.includes("exports/adapter-notes.md"), "file-only export spec must define adapter notes export");
  assert(fileOnlyExportSpecDoc.includes("recommended explicit output directory name"), "file-only export spec must clarify exports directory naming");
  assert(fileOnlyExportSpecDoc.includes("does not create an additional nested `exports/` directory"), "file-only export spec must reject nested exports auto-creation");
  assert(fileOnlyExportSpecDoc.includes("Implemented surface:"), "file-only export spec must name implemented surface");
  assert(fileOnlyExportSpecDoc.includes("export --input <context-pack-dir> --output-dir <dir>"), "file-only export spec must document export command");
  assert(fileOnlyExportSpecDoc.includes("MCP-friendly means"), "file-only export spec must define MCP-friendly boundary");
  assert(fileOnlyExportSpecDoc.includes("MCP server"), "file-only export spec must reject MCP server scope");
  assert(fileOnlyExportSpecDoc.includes("schema-v2"), "file-only export spec must reject schema-v2");
  assert(fileOnlyExportSpecDoc.includes("Workflow Runner"), "file-only export spec must keep runner out of scope");
  assert(fileOnlyExportSpecDoc.includes("Context Pack Lite generator output"), "file-only export spec must preserve generator output");
  assert(v240ReleaseDoc.includes("v2.4.0 File-only Adapter / MCP-friendly Export Local Closeout"), "v2.4 closeout doc must have stable title");
  assert(v240ReleaseDoc.includes("scripts/basebrief_export.js"), "v2.4 closeout doc must mention export module");
  assert(v240ReleaseDoc.includes("export --input <context-pack-dir> --output-dir <dir>"), "v2.4 closeout doc must document export command");
  assert(v240ReleaseDoc.includes("manifest.json"), "v2.4 closeout doc must mention export manifest");
  assert(v240ReleaseDoc.includes("context-pack.md"), "v2.4 closeout doc must mention readable export");
  assert(v240ReleaseDoc.includes("context.json"), "v2.4 closeout doc must mention machine-readable export");
  assert(v240ReleaseDoc.includes("adapter-notes.md"), "v2.4 closeout doc must mention adapter notes export");
  assert(v240ReleaseDoc.includes("examples/file-only-export/"), "v2.4 closeout doc must mention file-only export example kit");
  assert(v240ReleaseDoc.includes("recommended example output directory name"), "v2.4 closeout doc must clarify example export directory naming");
  assert(v240ReleaseDoc.includes("No Context Pack Lite generator output change"), "v2.4 closeout doc must preserve context-pack generator output");
  assert(v240ReleaseDoc.includes("No `check --input <dir> --json` top-level shape change"), "v2.4 closeout doc must preserve checker JSON shape");
  assert(v240ReleaseDoc.includes("No `resume --input <context-pack-dir>` behavior change"), "v2.4 closeout doc must preserve resume behavior");
  assert(v240ReleaseDoc.includes("provider_probe_status=skipped"), "v2.4 closeout doc must preserve skipped provider gate");
  assert(fileOnlyExportDogfoodingDoc.includes("File-only Export Dogfooding v2.4.0"), "v2.4 export dogfooding doc must have stable title");
  assert(fileOnlyExportDogfoodingDoc.includes("clean_export_status: pass"), "v2.4 export dogfooding must record clean export acceptance");
  assert(fileOnlyExportDogfoodingDoc.includes("export_bundle_check_status: pass"), "v2.4 export dogfooding must record export bundle check acceptance");
  assert(fileOnlyExportDogfoodingDoc.includes("receiver_style_acceptance: pass"), "v2.4 export dogfooding must record receiver-style acceptance");
  assert(fileOnlyExportDogfoodingDoc.includes("public_safety_status: pass"), "v2.4 export dogfooding must record public safety acceptance");
  assert(fileOnlyExportDogfoodingDoc.includes("provider_probe_status=skipped"), "v2.4 export dogfooding must preserve skipped provider gate");
  assert(fileOnlyExportDogfoodingDoc.includes("manifest.json"), "v2.4 export dogfooding must name manifest export");
  assert(fileOnlyExportDogfoodingDoc.includes("context-pack.md"), "v2.4 export dogfooding must name readable export");
  assert(fileOnlyExportDogfoodingDoc.includes("context.json"), "v2.4 export dogfooding must name machine-readable export");
  assert(fileOnlyExportDogfoodingDoc.includes("adapter-notes.md"), "v2.4 export dogfooding must name adapter notes export");
  assert(fileOnlyExportDogfoodingDoc.includes("basebrief-file-export-v1"), "v2.4 export dogfooding must record contract version");
  assert(fileOnlyExportDogfoodingDoc.includes("live repo fact recheck requirement"), "v2.4 export dogfooding must preserve live recheck requirement");
  assert(fileOnlyExportDogfoodingDoc.includes("warning/error distinction"), "v2.4 export dogfooding must preserve warning/error distinction");
  assert(fileOnlyExportDogfoodingDoc.includes("No provider request"), "v2.4 export dogfooding must preserve provider boundary");
  assert(fileOnlyExportDogfoodingDoc.includes("No MCP server"), "v2.4 export dogfooding must reject MCP server scope");
  assert(fileOnlyExportDogfoodingDoc.includes("No Workflow Runner"), "v2.4 export dogfooding must keep runner out of scope");
  assert(basebriefCliScript.includes('node scripts/basebrief.js export --input <context-pack-dir> --output-dir <dir> [--json]'), "CLI help must expose export command");
  assert(basebriefCliScript.includes('if (command === "export") return commandExport(options);'), "CLI must route export command");
  assert(basebriefExportScript.includes('basebrief-file-export-v1'), "export script must declare contract version");
  assert(basebriefExportScript.includes('Context pack check failed'), "export script must block errored packs");
  assert(basebriefExportScript.includes('manifest.json'), "export script must write manifest.json");
  assert(v250PlanDoc.includes("v2.5.0 Context Pack Doctor Plan"), "v2.5 plan must have stable title");
  assert(v250PlanDoc.includes("Status: v2.5-A contract freeze"), "v2.5 plan must mark contract freeze status");
  assert(v250PlanDoc.includes("doctor --repo <target-repo> --context-pack <context-pack-dir>"), "v2.5 plan must document doctor command");
  assert(v250PlanDoc.includes("basebrief-doctor-v1"), "v2.5 plan must name doctor contract version");
  assert(v250PlanDoc.includes("doctor.worktree-dirty"), "v2.5 plan must define dirty worktree rule");
  assert(v250PlanDoc.includes("doctor.pack-head-stale"), "v2.5 plan must define stale HEAD rule");
  assert(v250PlanDoc.includes("doctor.pack-check-error"), "v2.5 plan must define checker error rule");
  assert(v250PlanDoc.includes("doctor.live-recheck-required"), "v2.5 plan must define live recheck rule");
  assert(v250PlanDoc.includes("No `status` command in v2.5"), "v2.5 plan must leave broader status out of scope");
  assert(v250PlanDoc.includes("No provider request"), "v2.5 plan must preserve provider boundary");
  assert(v250PlanDoc.includes("No MCP server"), "v2.5 plan must reject MCP server scope");
  assert(v250PlanDoc.includes("No MCP tools"), "v2.5 plan must reject MCP tools scope");
  assert(v250PlanDoc.includes("No schema-v2"), "v2.5 plan must reject schema-v2");
  assert(v250PlanDoc.includes("No Workflow Runner"), "v2.5 plan must keep runner out of scope");
  assert(v250PlanDoc.includes("provider_probe_status=skipped"), "v2.5 plan must preserve skipped provider gate");
  assert(contextPackDoctorSpecDoc.includes("Context Pack Doctor Spec"), "doctor spec must have stable title");
  assert(contextPackDoctorSpecDoc.includes("Status: v2.5-A contract freeze"), "doctor spec must mark contract freeze status");
  assert(contextPackDoctorSpecDoc.includes("basebrief-doctor-v1"), "doctor spec must name contract version");
  assert(contextPackDoctorSpecDoc.includes('"command": "doctor"'), "doctor spec must define command field");
  assert(contextPackDoctorSpecDoc.includes('"severity": "error|warning|info"'), "doctor spec must define severity field");
  assert(contextPackDoctorSpecDoc.includes("doctor.pack-branch-mismatch"), "doctor spec must define branch mismatch rule");
  assert(contextPackDoctorSpecDoc.includes("Context Pack Check JSON top-level shape"), "doctor spec must preserve checker JSON shape");
  assert(contextPackDoctorSpecDoc.includes("not a Workflow Runner"), "doctor spec must reject runner scope");
  assert(contextPackDoctorSpecDoc.includes("MCP tools"), "doctor spec must reject MCP tools scope");
  assert(v250ReleaseDoc.includes("v2.5.0 Context Pack Doctor Local Closeout"), "v2.5 closeout doc must have stable title");
  assert(v250ReleaseDoc.includes("scripts/basebrief_doctor.js"), "v2.5 closeout doc must mention doctor module");
  assert(v250ReleaseDoc.includes("doctor --repo <target-repo> --context-pack <context-pack-dir>"), "v2.5 closeout doc must document doctor command");
  assert(v250ReleaseDoc.includes("No `status` command in v2.5"), "v2.5 closeout doc must leave broader status out of scope");
  assert(v250ReleaseDoc.includes("No `export --input <context-pack-dir> --output-dir <dir>` contract change"), "v2.5 closeout doc must preserve export contract");
  assert(v250ReleaseDoc.includes("provider_probe_status=skipped"), "v2.5 closeout doc must preserve skipped provider gate");
  assert(v260ReleaseDoc.includes("v2.6.0 First-Run / Adoption Polish Local Closeout"), "v2.6 closeout doc must have stable title");
  assert(v260ReleaseDoc.includes("2-5 minute local-first loop"), "v2.6 closeout doc must document first-run kit");
  assert(v260ReleaseDoc.includes("clean, warning, and broken Context Pack inputs"), "v2.6 closeout doc must document adoption examples");
  assert(v260ReleaseDoc.includes("Check vs Doctor"), "v2.6 closeout doc must document Check vs Doctor guidance");
  assert(v260ReleaseDoc.includes("context-pack.too-thick"), "v2.6 closeout doc must mention thickness warning");
  assert(v260ReleaseDoc.includes("doctor.pack-head-stale"), "v2.6 closeout doc must mention stale doctor finding");
  assert(v260ReleaseDoc.includes("doctor.pack-check-error"), "v2.6 closeout doc must mention broken-pack doctor finding");
  assert(v260ReleaseDoc.includes("documentation map with first-run, continuation"), "v2.6 closeout doc must document docs index IA");
  assert(v260ReleaseDoc.includes("No `status` command"), "v2.6 closeout doc must reject status scope");
  assert(v260ReleaseDoc.includes("No `check --input <dir> --json` top-level shape change"), "v2.6 closeout doc must preserve checker JSON shape");
  assert(v260ReleaseDoc.includes("No provider request"), "v2.6 closeout doc must reject provider requests");
  assert(v260ReleaseDoc.includes("No MCP server"), "v2.6 closeout doc must reject MCP server scope");
  assert(v260ReleaseDoc.includes("No MCP tools"), "v2.6 closeout doc must reject MCP tools scope");
  assert(v260ReleaseDoc.includes("No schema-v2"), "v2.6 closeout doc must reject schema-v2");
  assert(v260ReleaseDoc.includes("No Workflow Runner"), "v2.6 closeout doc must keep runner out of scope");
  assert(v260ReleaseDoc.includes("npm test"), "v2.6 closeout doc must include npm test gate");
  assert(v260ReleaseDoc.includes("npm run release-check"), "v2.6 closeout doc must include release-check gate");
  assert(v260ReleaseDoc.includes("git diff --check"), "v2.6 closeout doc must include whitespace gate");
  assert(v260ReleaseDoc.includes("provider_probe_status=skipped"), "v2.6 closeout doc must preserve skipped provider gate");
  assert(v260ReleaseDoc.includes("docs/examples/release-check polish"), "v2.6 closeout doc must scope release prep as polish");
  assert(v260ReleaseDoc.includes("does not reopen v2.2 resume scope"), "v2.6 closeout doc must avoid reopening earlier v2 scopes");
  assert(v270PlanDoc.includes("v2.7.0 Context Pack Human Next-Step Hints Plan"), "v2.7 plan must have stable title");
  assert(v270PlanDoc.includes("Status: v2.7-A human-output planning"), "v2.7 plan must mark human-output planning status");
  assert(v270PlanDoc.includes("concise next-step hints to existing non-JSON CLI output"), "v2.7 plan must scope hints to non-JSON output");
  assert(v270PlanDoc.includes("context-pack` success should point to `check --input <context-pack-dir>`"), "v2.7 plan must define context-pack hint");
  assert(v270PlanDoc.includes("check` pass with zero errors should point to `resume --input"), "v2.7 plan must define check pass hint");
  assert(v270PlanDoc.includes("export` success should point to `check --input <export-dir>`"), "v2.7 plan must define export hint");
  assert(v270PlanDoc.includes("doctor` warning or error output should point back to live repo recheck"), "v2.7 plan must define doctor hint");
  assert(v270PlanDoc.includes("affect human output only"), "v2.7 plan must keep scope human-output only");
  assert(v270PlanDoc.includes("keep `--json` output byte-shape-compatible"), "v2.7 plan must preserve JSON output shape");
  assert(v270PlanDoc.includes("keep command exit semantics unchanged"), "v2.7 plan must preserve exit semantics");
  assert(v270PlanDoc.includes("No new CLI command"), "v2.7 plan must reject new command scope");
  assert(v270PlanDoc.includes("No Context Pack seven-file structure change"), "v2.7 plan must preserve Context Pack structure");
  assert(v270PlanDoc.includes("No `check --input <dir> --json` top-level shape change"), "v2.7 plan must preserve checker JSON shape");
  assert(v270PlanDoc.includes("No Status command"), "v2.7 plan must reject status scope");
  assert(v270PlanDoc.includes("No Workflow Runner"), "v2.7 plan must keep runner out of scope");
  assert(v270PlanDoc.includes("No Doctor expansion"), "v2.7 plan must reject doctor expansion");
  assert(v270PlanDoc.includes("No provider request"), "v2.7 plan must reject provider requests");
  assert(v270PlanDoc.includes("No MCP server"), "v2.7 plan must reject MCP server scope");
  assert(v270PlanDoc.includes("No MCP tools"), "v2.7 plan must reject MCP tools scope");
  assert(v270PlanDoc.includes("No schema-v2"), "v2.7 plan must reject schema-v2");
  assert(v270PlanDoc.includes("No daemon") && v270PlanDoc.includes("No watcher") && v270PlanDoc.includes("No hosted service"), "v2.7 plan must reject daemon, watcher, and hosted scope");
  assert(v270PlanDoc.includes("npm run release-check") && v270PlanDoc.includes("npm test") && v270PlanDoc.includes("git diff --check"), "v2.7 plan must include validation gate");
  assert(v270PlanDoc.includes("provider_probe_status=skipped"), "v2.7 plan must preserve skipped provider gate");
  assertIncludesPhrase(v270PlanDoc, "If implementation would require JSON, command, or contract changes, stop", "v2.7 plan must define rollback stop condition");
  assert(v270ReleaseDoc.includes("v2.7.0 Context Pack Human Next-Step Hints Local Closeout"), "v2.7 closeout doc must have stable title");
  assert(v270ReleaseDoc.includes("Status: local closeout"), "v2.7 closeout doc must mark local closeout status");
  assertIncludesPhrase(v270ReleaseDoc, "adds concise next-step hints to existing non-JSON CLI output only", "v2.7 closeout doc must scope hints to non-JSON output");
  assert(v270ReleaseDoc.includes("next_step=") && v270ReleaseDoc.includes("optional_next_step="), "v2.7 closeout doc must name hint line prefixes");
  assert(v270ReleaseDoc.includes("next_step=node scripts/basebrief.js check --input <context-pack-dir>"), "v2.7 closeout doc must document context-pack next step");
  assert(v270ReleaseDoc.includes("next_step=node scripts/basebrief.js resume --input <context-pack-dir>"), "v2.7 closeout doc must document check next step");
  assert(v270ReleaseDoc.includes("optional_next_step=node scripts/basebrief.js doctor --repo <target-repo> --context-pack <context-pack-dir>"), "v2.7 closeout doc must document optional doctor next step");
  assert(v270ReleaseDoc.includes("next_step=node scripts/basebrief.js check --input <export-dir>"), "v2.7 closeout doc must document export next step");
  assert(v270ReleaseDoc.includes("next_step=recheck live repo facts and refresh the context pack if stale"), "v2.7 closeout doc must document doctor warning next step");
  assert(v270ReleaseDoc.includes("next_step=repair the context pack before resume or export"), "v2.7 closeout doc must document doctor error next step");
  assertIncludesPhrase(v270ReleaseDoc, "guidance text, not machine-readable contracts", "v2.7 closeout doc must keep hints non-contractual");
  assertIncludesPhrase(v270ReleaseDoc, "`--json` output does not gain a `next_step` field", "v2.7 closeout doc must preserve JSON output shape");
  assert(v270ReleaseDoc.includes("No new CLI command"), "v2.7 closeout doc must reject new command scope");
  assert(v270ReleaseDoc.includes("No package script change"), "v2.7 closeout doc must preserve package scripts");
  assert(v270ReleaseDoc.includes("No release-check output shape change"), "v2.7 closeout doc must preserve release-check output shape");
  assert(v270ReleaseDoc.includes("No Context Pack seven-file structure change"), "v2.7 closeout doc must preserve Context Pack structure");
  assert(v270ReleaseDoc.includes("No Context Pack Lite generator output change"), "v2.7 closeout doc must preserve generator output");
  assert(v270ReleaseDoc.includes("No `check --input <dir> --json` top-level shape change"), "v2.7 closeout doc must preserve checker JSON shape");
  assert(v270ReleaseDoc.includes("No `resume --input <context-pack-dir>` JSON contract change"), "v2.7 closeout doc must preserve resume JSON contract");
  assert(v270ReleaseDoc.includes("No `export --input <context-pack-dir> --output-dir <dir>` JSON contract"), "v2.7 closeout doc must preserve export JSON contract");
  assert(v270ReleaseDoc.includes("No `doctor --repo <target-repo> --context-pack <context-pack-dir>` JSON"), "v2.7 closeout doc must preserve doctor JSON contract");
  assert(v270ReleaseDoc.includes("No Status command"), "v2.7 closeout doc must reject status scope");
  assert(v270ReleaseDoc.includes("No Workflow Runner"), "v2.7 closeout doc must reject workflow runner scope");
  assert(v270ReleaseDoc.includes("No Doctor expansion"), "v2.7 closeout doc must reject doctor expansion");
  assert(v270ReleaseDoc.includes("No Continuation Harness Lite implementation"), "v2.7 closeout doc must reject harness implementation");
  assert(v270ReleaseDoc.includes("No provider request"), "v2.7 closeout doc must reject provider requests");
  assert(v270ReleaseDoc.includes("No runtime integration"), "v2.7 closeout doc must reject runtime integration");
  assert(v270ReleaseDoc.includes("No plugin"), "v2.7 closeout doc must reject plugin scope");
  assert(v270ReleaseDoc.includes("No MCP server") && v270ReleaseDoc.includes("No MCP tools"), "v2.7 closeout doc must reject MCP scope");
  assert(v270ReleaseDoc.includes("No schema-v2"), "v2.7 closeout doc must reject schema-v2");
  assert(v270ReleaseDoc.includes("No daemon") && v270ReleaseDoc.includes("No watcher"), "v2.7 closeout doc must reject daemon and watcher scope");
  assert(v270ReleaseDoc.includes("No push, tag, release, pull request, npm publish, or global CLI install"), "v2.7 closeout doc must reject external release actions");
  assert(v270ReleaseDoc.includes("node --test tests/context-pack.test.js --test-name-pattern \"Context Pack|Export|Doctor\""), "v2.7 closeout doc must include focused test gate");
  assert(v270ReleaseDoc.includes("npm run release-check") && v270ReleaseDoc.includes("npm test") && v270ReleaseDoc.includes("git diff --check"), "v2.7 closeout doc must include validation gate");
  assert(v270ReleaseDoc.includes("provider_probe_status=skipped"), "v2.7 closeout doc must preserve skipped provider gate");
  assert(basebriefCliScript.includes("function formatNextStepLines(result)"), "CLI formatter must define human next-step helper");
  assert(basebriefCliScript.includes("function detectCheckInputKind(inputPath)"), "CLI formatter must detect check input kind for human hints");
  assert(basebriefCliScript.includes("file-only-export"), "CLI formatter must distinguish file-only export check inputs");
  assert(basebriefCliScript.includes("...formatNextStepLines(result)"), "CLI human output must append next-step hints through formatHuman");
  assert(basebriefCliScript.includes("next_step=node scripts/basebrief.js check --input ${result.outputDir}"), "CLI formatter must point context-pack and export output to check");
  assert(basebriefCliScript.includes("next_step=node scripts/basebrief.js resume --input ${result.input}"), "CLI formatter must point clean checks to resume");
  assert(basebriefCliScript.includes("optional_next_step=node scripts/basebrief.js doctor --repo <target-repo> --context-pack ${result.input}"), "CLI formatter must expose optional doctor next step for clean checks");
  assert(basebriefCliScript.includes("next_step=review checked export files before sharing or tool intake"), "CLI formatter must avoid resume/doctor hints for checked export directories");
  assert(basebriefCliScript.includes("next_step=review check results before sharing"), "CLI formatter must keep generic checks from pointing to Context Pack commands");
  assert(basebriefCliScript.includes("next_step=review warnings before resume"), "CLI formatter must guide warning checks to human review");
  assert(basebriefCliScript.includes("next_step=fix reported errors before resume, doctor, or export"), "CLI formatter must guide errored checks to repair");
  assert(basebriefCliScript.includes("next_step=recheck live repo facts and refresh the context pack if stale"), "CLI formatter must guide warning doctor output to live recheck");
  assert(basebriefCliScript.includes("next_step=repair the context pack before resume or export"), "CLI formatter must guide failed doctor output to repair");
  checkV26DogfoodingDocs({
    contextPackAdoptionNotesV261Doc,
    contextEngineeringReferenceNotesV264Doc,
    contextPackAdoptionScenarioMatrixV265Doc,
    contextPackFirstRunFixtureLabV266Doc,
    contextPackFirstRunRehearsalAuditV267Doc,
    contextPackFirstRunFrictionRepairV268Doc,
    contextPackAdoptionDecisionCheckpointV269Doc,
    contextPackPreReleaseBundleAuditV2610Doc,
    contextPackFeatureFeasibilitySpikeV2611Doc,
    contextPackLocalBundleReviewRehearsalV2612Doc,
    contextPackLocalBundleCompressionV2613Doc,
    contextPackReleaseCheckMaintainabilityV2614Doc,
    contextPackMajorReleaseCandidateShapeV2615Doc,
    contextPackContinuationHarnessDecisionSpecV2616Doc,
    contextPackAhead14BundleReviewV2617Doc,
    contextPackMinimalFeatureCandidateDecisionV2618Doc,
    contextPackFirstRunHandoffValidationDoc,
    contextPackContinuationHarnessLiteDesignSketchDoc,
    contextPackContinuationHarnessLitePaperRehearsalDoc,
    contextPackLocalBundleCompressionV2620Doc,
    contextPackImplementationGateDecisionV2621Doc,
    contextPackReleaseCheckMaintainabilityPlanV2622Doc,
    contextPackRunnableRecipesPlanV2623Doc,
    contextPackFirstRunSmokePathConsolidationV2624Doc,
    contextPackOutputUxPolishV2625Doc,
    contextPackTestFileSplitPlanV2626Doc,
    contextPackTestFileSplitV2627Doc,
    contextPackTestFileSplitSecondCandidateV2628Doc,
    contextPackCacheReadyBenchmarkTestSplitV2629Doc,
    contextPackTestSplitStabilityCheckV2630Doc,
    contextPackV26xLocalCloseoutGateV2631Doc,
    contextPackReleaseCandidateDecisionV2632Doc,
    contextPackReleaseCandidateSummaryDraftV2633Doc,
    contextPackReleaseCloseoutGoNoGoPlanV2634Doc,
    contextPackReleaseCloseoutPrepDraftV2635Doc,
    contextPackFormalLocalReleaseCloseoutDraftV2636Doc,
    contextPackReleaseCloseoutReviewPacketV2637Doc,
  });
  assert(contextPackDoctorDogfoodingDoc.includes("Context Pack Doctor Dogfooding v2.5.0"), "doctor dogfooding doc must have stable title");
  assert(contextPackDoctorDogfoodingDoc.includes("doctor_contract_version: basebrief-doctor-v1"), "doctor dogfooding must record contract version");
  assert(contextPackDoctorDogfoodingDoc.includes("doctor_command_status: warning"), "doctor dogfooding must record warning status");
  assert(contextPackDoctorDogfoodingDoc.includes("checker_error_propagation_status: pass"), "doctor dogfooding must record checker-error propagation");
  assert(contextPackDoctorDogfoodingDoc.includes("public_safety_status: pass"), "doctor dogfooding must record public safety");
  assert(contextPackDoctorDogfoodingDoc.includes("read_only_status: pass"), "doctor dogfooding must record read-only status");
  assert(contextPackDoctorDogfoodingDoc.includes("provider_probe_status=skipped"), "doctor dogfooding must preserve skipped provider gate");
  assert(contextPackDoctorDogfoodingDoc.includes("No `status` command"), "doctor dogfooding must reject status scope");
  assert(contextPackDoctorDogfoodingDoc.includes("No MCP server"), "doctor dogfooding must reject MCP server scope");
  assert(contextPackDoctorDogfoodingDoc.includes("No Workflow Runner"), "doctor dogfooding must keep runner out of scope");
  assert(contextPackDoctorDogfoodingV251Doc.includes("Context Pack Doctor Dogfooding v2.5.1"), "v2.5.1 doctor dogfooding doc must have stable title");
  assert(contextPackDoctorDogfoodingV251Doc.includes("doctor_contract_version: basebrief-doctor-v1"), "v2.5.1 doctor dogfooding must record contract version");
  assert(contextPackDoctorDogfoodingV251Doc.includes("post_commit_doctor_status: passed"), "v2.5.1 doctor dogfooding must record post-commit pass");
  assert(contextPackDoctorDogfoodingV251Doc.includes("post_commit_doctor_warning_count: 0"), "v2.5.1 doctor dogfooding must record zero warnings");
  assert(contextPackDoctorDogfoodingV251Doc.includes("post_commit_doctor_findings: doctor.live-recheck-required"), "v2.5.1 doctor dogfooding must record live recheck finding only");
  assert(contextPackDoctorDogfoodingV251Doc.includes("no_provider_boundary_warning_status: absent"), "v2.5.1 doctor dogfooding must record boundary warning absence");
  assert(contextPackDoctorDogfoodingV251Doc.includes("stale_pack_findings: doctor.pack-head-stale, doctor.pack-branch-mismatch, doctor.live-recheck-required"), "v2.5.1 doctor dogfooding must record stale warnings");
  assert(contextPackDoctorDogfoodingV251Doc.includes("broken_pack_findings: doctor.pack-check-error, doctor.live-recheck-required"), "v2.5.1 doctor dogfooding must record broken pack error");
  assert(contextPackDoctorDogfoodingV251Doc.includes("export_bundle_check_status: passed"), "v2.5.1 doctor dogfooding must record export bundle check");
  assert(contextPackDoctorDogfoodingV251Doc.includes("provider_probe_status=skipped"), "v2.5.1 doctor dogfooding must preserve skipped provider gate");
  assert(contextPackDoctorDogfoodingV251Doc.includes("No `status` command"), "v2.5.1 doctor dogfooding must reject status scope");
  assert(contextPackDoctorDogfoodingV251Doc.includes("No provider request"), "v2.5.1 doctor dogfooding must reject provider requests");
  assert(contextPackDoctorDogfoodingV251Doc.includes("No MCP server"), "v2.5.1 doctor dogfooding must reject MCP server scope");
  assert(contextPackDoctorDogfoodingV251Doc.includes("No Workflow Runner"), "v2.5.1 doctor dogfooding must keep runner out of scope");
  assert(!/[A-Za-z]:[\\/]/.test(contextPackDoctorDogfoodingV251Doc), "v2.5.1 doctor dogfooding must not expose drive-letter absolute paths");
  assert(!/\\\\/.test(contextPackDoctorDogfoodingV251Doc), "v2.5.1 doctor dogfooding must not expose UNC paths");
  assert(basebriefCliScript.includes('node scripts/basebrief.js doctor --repo <target-repo> --context-pack <context-pack-dir> [--json]'), "CLI help must expose doctor command");
  assert(basebriefCliScript.includes('if (command === "doctor") return commandDoctor(options);'), "CLI must route doctor command");
  assert(basebriefDoctorScript.includes('basebrief-doctor-v1'), "doctor script must declare contract version");
  assert(basebriefDoctorScript.includes('doctor.pack-check-error'), "doctor script must propagate checker errors");
  assert(basebriefDoctorScript.includes('doctor.live-recheck-required'), "doctor script must emit live recheck info");
  assert(contextPackDoctorExampleReadme.includes("Context Pack Doctor Example Kit"), "doctor example readme must have stable title");
  assert(contextPackDoctorExampleReadme.includes("basebrief-doctor-v1"), "doctor example must show contract version");
  assert(contextPackDoctorExampleReadme.includes('"repo": "examples/example-repo"'), "doctor example must use relative repo path");
  assert(contextPackDoctorExampleReadme.includes('"contextPack": "examples/context-pack-lite"'), "doctor example must use relative context pack path");
  assert(contextPackDoctorExampleReadme.includes("doctor.pack-head-stale"), "doctor example must include stale HEAD finding");
  assert(contextPackDoctorExampleReadme.includes("doctor.live-recheck-required"), "doctor example must include live recheck finding");
  assert(contextPackDoctorExampleReadme.includes("No provider request"), "doctor example must preserve provider boundary");
  assert(contextPackDoctorExampleReadme.includes("No MCP server"), "doctor example must reject MCP server scope");
  assert(contextPackDoctorExampleReadme.includes("No MCP tools"), "doctor example must reject MCP tools scope");
  assert(contextPackDoctorExampleReadme.includes("No Workflow Runner"), "doctor example must keep runner out of scope");
  assert(contextPackDoctorExampleReadme.includes("provider_probe_status=skipped"), "doctor example must preserve skipped provider gate");
  assert(!/[A-Za-z]:[\\/]/.test(contextPackDoctorExampleReadme), "doctor example must not contain drive-letter absolute paths");
  assert(!/\\\\/.test(contextPackDoctorExampleReadme), "doctor example must not contain UNC paths");
  assert(!contextPackDoctorExampleReadme.includes("tests/outputs/private"), "doctor example must not contain private output paths");
  assert(contextPackLiteDogfoodingDoc.includes("Context Pack Lite Fresh Receiver Dogfooding v2.0.0"), "context pack dogfooding doc must have stable title");
  assert(contextPackLiteDogfoodingDoc.includes("receiver_task_status: completed"), "context pack dogfooding must record completed receiver status");
  assert(contextPackLiteDogfoodingDoc.includes("handoff_acceptance: pass"), "context pack dogfooding must record pass acceptance");
  assert(contextPackLiteDogfoodingDoc.includes("Observed Friction"), "context pack dogfooding must record friction");
  assert(contextPackLiteDogfoodingDoc.includes("Next Fix Candidate"), "context pack dogfooding must record next fix candidate");
  assert(contextPackLiteDogfoodingDoc.includes("No provider request"), "context pack dogfooding must preserve provider boundary");
  assert(contextPackLiteDogfoodingDoc.includes("No raw private output"), "context pack dogfooding must reject raw private output");
  assert(contextPackLiteDogfoodingDoc.includes("No runtime integration"), "context pack dogfooding must preserve runtime boundary");
  assert(contextPackLiteDogfoodingDoc.includes("provider_probe_status=skipped"), "context pack dogfooding must preserve skipped provider gate");
  assert(contextPackCheckDogfoodingDoc.includes("Context Pack Check Acceptance v2.1.0"), "context pack check dogfooding doc must have stable title");
  assert(contextPackCheckDogfoodingDoc.includes("clean_pack_status: pass"), "context pack check dogfooding must record clean-pack acceptance");
  assert(contextPackCheckDogfoodingDoc.includes("broken_pack_status: pass"), "context pack check dogfooding must record broken-pack acceptance");
  assert(contextPackCheckDogfoodingDoc.includes("thickness_warning_status: pass"), "context pack check dogfooding must record thickness warning acceptance");
  assert(contextPackCheckDogfoodingDoc.includes("public_safety_passthrough_status: pass"), "context pack check dogfooding must record public-safety passthrough");
  assert(contextPackCheckDogfoodingDoc.includes("No new top-level checker command"), "context pack check dogfooding must reject a new checker command");
  assert(contextPackCheckDogfoodingDoc.includes("No provider request"), "context pack check dogfooding must preserve provider boundary");
  assert(contextPackCheckDogfoodingDoc.includes("No raw private output"), "context pack check dogfooding must preserve raw-output boundary");
  assert(contextPackResumeDogfoodingDoc.includes("Context Pack Resume Dogfooding v2.2.0"), "context pack resume dogfooding doc must have stable title");
  assert(contextPackResumeDogfoodingDoc.includes("clean_resume_status: pass"), "context pack resume dogfooding must record clean-pack acceptance");
  assert(contextPackResumeDogfoodingDoc.includes("warning_only_resume_status: pass"), "context pack resume dogfooding must record warning-only acceptance");
  assert(contextPackResumeDogfoodingDoc.includes("error_resume_status: pass"), "context pack resume dogfooding must record errored-pack blocking acceptance");
  assert(contextPackResumeDogfoodingDoc.includes("No raw private output"), "context pack resume dogfooding must preserve raw-output boundary");
  assert(contextPackResumeDogfoodingDoc.includes("No Workflow Runner"), "context pack resume dogfooding must keep runner out of scope");
  assert(contextPackResumeDogfoodingDoc.includes("provider_probe_status=skipped"), "context pack resume dogfooding must preserve skipped provider gate");
  assert(contextPackLiteExampleReadme.includes("Context Pack Lite Example Kit"), "context pack example readme must have stable title");
  assert(contextPackLiteExampleReadme.includes("context-pack --repo <target-repo>"), "context pack example readme must document command shape");
  assert(basebriefContextPackScript.includes("Live repo facts are stale-prone and must be rechecked before edits."), "context pack generator must clarify stale-prone live repo facts");
  assert(basebriefContextPackScript.includes("Missing-input semantics: `not_available`, `not_applicable`, and `needs-review` are review cues, not failure states."), "context pack generator must clarify missing-input semantics");
  assert(basebriefContextPackScript.includes("Separate inherited pack facts from live rechecks."), "context pack generator must require inherited/live fact separation");
  assert(contextPackLiteExampleManifest.includes("MANIFEST.md"), "context pack example manifest must include reading order");
  assert(contextPackLiteExampleManifest.includes("Live repo facts are stale-prone and must be rechecked before edits."), "context pack example manifest must clarify stale-prone live repo facts");
  assert(contextPackLiteExampleReceiverState.includes("not_available"), "context pack example receiver state must show missing input degradation");
  assert(contextPackLiteExampleReceiverState.includes("not_applicable"), "context pack example receiver state must show not applicable receiver history");
  assert(contextPackLiteExampleReceiverState.includes("Missing-input semantics: `not_available`, `not_applicable`, and `needs-review` are review cues, not failure states."), "context pack example receiver state must clarify missing-input semantics");
  assert(contextPackLiteExampleStarter.includes("Continuation rules:"), "context pack example starter must use continuation rules");
  assert(contextPackLiteExampleStarter.includes("Treat this pack as inherited context"), "context pack example starter must treat the pack as inherited context");
  assert(contextPackLiteExampleStarter.includes("Use the latest user instruction as the real current goal"), "context pack example starter must preserve latest-user-goal wording");
  assert(contextPackLiteExampleStarter.includes("Separate inherited pack facts from live rechecks."), "context pack example starter must require inherited/live fact separation");
  assert(!contextPackLiteExampleStarter.includes("v2.0 Context Pack Lite implementation slice"), "context pack example starter must not hard-code old v2.0 task wording");
  assert(fileOnlyExportExampleReadme.includes("File-only Export Example Kit"), "file-only export example readme must have stable title");
  assert(fileOnlyExportExampleReadme.includes("export --input examples/context-pack-lite --output-dir examples/file-only-export/exports --json"), "file-only export example readme must document command shape");
  assert(fileOnlyExportExampleReadme.includes("recommended example output directory name"), "file-only export example readme must clarify exports directory naming");
  assert(fileOnlyExportExampleReadme.includes("directly under the explicit `--output-dir`"), "file-only export example readme must clarify output-dir root semantics");
  assert(fileOnlyExportExampleReadme.includes("does not create or discover a nested `exports/` directory"), "file-only export example readme must reject nested export discovery");
  assert(fileOnlyExportExampleReadme.includes("## Runnable Recipe"), "file-only export example readme must include a runnable recipe");
  assert(fileOnlyExportExampleReadme.includes("check -> export"), "file-only export example readme must include export recipe chain");
  assert(fileOnlyExportExampleReadme.includes("node scripts/basebrief.js check --input examples/context-pack-lite --json"), "file-only export example readme must include source pack check command");
  assert(fileOnlyExportExampleReadme.includes("node scripts/basebrief.js export --input examples/context-pack-lite --output-dir examples/file-only-export/exports --json"), "file-only export example readme must include export command");
  assert(fileOnlyExportExampleReadme.includes("No provider request"), "file-only export example readme must preserve provider boundary");
  assert(fileOnlyExportExampleReadme.includes("No MCP server"), "file-only export example readme must reject MCP server scope");
  assert(fileOnlyExportExampleReadme.includes("No Workflow Runner"), "file-only export example readme must keep runner out of scope");
  assert(fileOnlyExportExampleReadme.includes("provider_probe_status=skipped"), "file-only export example readme must preserve skipped provider gate");
  const fileOnlyExportExampleFileNames = fs.readdirSync(path.join(repoRoot, "examples/file-only-export/exports")).sort();
  assert(
    JSON.stringify(fileOnlyExportExampleFileNames) === JSON.stringify(fileOnlyExportExpectedOutputFiles),
    "file-only export example must contain exactly four export files",
  );
  assert(fileOnlyExportExampleManifest.contractVersion === "basebrief-file-export-v1", "file-only export manifest must use export contract version");
  assert(fileOnlyExportExampleManifest.sourceKind === "context-pack-lite", "file-only export manifest must record context-pack-lite source kind");
  assert(fileOnlyExportExampleManifest.generatedAt === "2026-06-08T00:00:00.000Z", "file-only export manifest must use fixed example timestamp");
  assert(JSON.stringify(fileOnlyExportExampleManifest.sourceFiles) === JSON.stringify(fileOnlyExportExpectedSourceFiles), "file-only export manifest must preserve source reading order");
  assert(JSON.stringify(Object.values(fileOnlyExportExampleManifest.outputFiles).sort()) === JSON.stringify(fileOnlyExportExpectedOutputFiles), "file-only export manifest must report four public output file names");
  assert(fileOnlyExportExampleManifest.check.status === "passed", "file-only export manifest must record passed check status");
  assert(fileOnlyExportExampleManifest.check.errorCount === 0, "file-only export manifest must record zero errors");
  assert(fileOnlyExportExampleManifest.check.warningCount === 0, "file-only export manifest must record zero warnings");
  assert(fileOnlyExportExampleManifest.review.liveRepoRecheckRequired === true, "file-only export manifest must preserve live recheck requirement");
  assert(fileOnlyExportExampleContext.contractVersion === "basebrief-file-export-v1", "file-only export context must use export contract version");
  assert(fileOnlyExportExampleContext.sourceKind === "context-pack-lite", "file-only export context must record context-pack-lite source kind");
  assert(fileOnlyExportExampleContext.generatedAt === "2026-06-08T00:00:00.000Z", "file-only export context must use fixed example timestamp");
  assert(JSON.stringify(fileOnlyExportExampleContext.sourceFiles) === JSON.stringify(fileOnlyExportExpectedSourceFiles), "file-only export context must preserve source reading order");
  assert(JSON.stringify(Object.values(fileOnlyExportExampleContext.outputFiles).sort()) === JSON.stringify(fileOnlyExportExpectedOutputFiles), "file-only export context must report four public output file names");
  assert(fileOnlyExportExampleContext.check.status === "passed", "file-only export context must record passed check status");
  assert(fileOnlyExportExampleContext.check.errorCount === 0, "file-only export context must record zero errors");
  assert(fileOnlyExportExampleContext.check.warningCount === 0, "file-only export context must record zero warnings");
  assert(fileOnlyExportExampleContext.review.liveRepoRecheckRequired === true, "file-only export context must preserve live recheck requirement");
  assert(fileOnlyExportExampleContext.pack.project === "basebrief-example-repo", "file-only export context must preserve example project identity");
  assert(fileOnlyExportExampleContext.pack.worktreeStatus === "clean", "file-only export context must preserve clean example worktree status");
  assert(fileOnlyExportExampleContext.pack.worktreeChangedFiles === "0", "file-only export context must preserve changed-file summary");
  assert(fileOnlyExportExampleContext.boundaries.includes("No provider request."), "file-only export context must preserve provider boundary");
  assert(fileOnlyExportExampleContext.boundaries.includes("No MCP server."), "file-only export context must reject MCP server scope");
  assert(fileOnlyExportExampleContext.boundaries.includes("No Workflow Runner."), "file-only export context must keep runner out of scope");
  fileOnlyExportExpectedSourceFiles.forEach((sourceFile) => {
    assert(fileOnlyExportExampleContextPack.includes(`BASEBRIEF_SOURCE_FILE: ${sourceFile}`), `file-only export context-pack must preserve source label for ${sourceFile}`);
  });
  assert(fileOnlyExportExampleContextPack.includes("Continuation rules:"), "file-only export context-pack must use continuation rules");
  assert(fileOnlyExportExampleContextPack.includes("Treat this pack as inherited context"), "file-only export context-pack must treat the pack as inherited context");
  assert(fileOnlyExportExampleContextPack.includes("Use the latest user instruction as the real current goal"), "file-only export context-pack must preserve latest-user-goal wording");
  assert(!fileOnlyExportExampleContextPack.includes("v2.0 Context Pack Lite implementation slice"), "file-only export context-pack must not hard-code old v2.0 task wording");
  assert(fileOnlyExportExampleAdapterNotes.includes("No provider request"), "file-only export adapter notes must preserve provider boundary");
  assert(fileOnlyExportExampleAdapterNotes.includes("No MCP server"), "file-only export adapter notes must reject MCP server scope");
  assert(fileOnlyExportExampleAdapterNotes.includes("No Workflow Runner"), "file-only export adapter notes must keep runner out of scope");
  const fileOnlyExportExampleJson = JSON.stringify({
    manifest: fileOnlyExportExampleManifest,
    context: fileOnlyExportExampleContext,
  });
  assert(!/[A-Za-z]:[\\/]/.test(fileOnlyExportExampleJson), "file-only export example JSON must not contain drive-letter absolute paths");
  assert(!/\\\\/.test(fileOnlyExportExampleJson), "file-only export example JSON must not contain UNC paths");
  assert(!fileOnlyExportExampleJson.includes("tests/outputs/private"), "file-only export example JSON must not contain private output paths");
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
  assert(roadmapDoc.includes("Closed v1.0-v1.2 Delta line"), "Roadmap must preserve the v1.0-v1.2 closure history");
  assert(roadmapDoc.includes("Phase 8B: Delta Handoff"), "Roadmap must document Delta Handoff phase");
  assert(roadmapDoc.includes("fresh receiver dogfooding has reported `handoff_acceptance: pass`"), "Roadmap must record fresh receiver pass");
  assert(roadmapDoc.includes("basebrief-project-state-v1` remains unchanged"), "Roadmap must preserve project-state schema in v1.0");
  assert(roadmapDoc.includes("v1.1 receiver acceptance closure"), "Roadmap must document v1.1 receiver acceptance closure");
  assert(roadmapDoc.includes("Delta Receiver Acceptance Kit"), "Roadmap must name v1.1 receiver acceptance kit");
  assert(roadmapDoc.includes("receiver contract, not an"), "Roadmap must keep v1.1 out of runtime scope");
  assert(roadmapDoc.includes("Local v1.1 closeout status"), "Roadmap must document v1.1 closeout status");
  assert(roadmapDoc.includes("docs/releases/v1.1.0.md"), "Roadmap must link v1.1 closeout doc");
  assert(roadmapDoc.includes("Local v1.2 closeout status"), "Roadmap must document v1.2 closeout status");
  assert(roadmapDoc.includes("docs/releases/v1.2.0.md"), "Roadmap must link v1.2 closeout doc");
  assert(roadmapDoc.includes("Local v1.3 closeout status"), "Roadmap must document v1.3 closeout status");
  assert(roadmapDoc.includes("docs/releases/v1.3.0.md"), "Roadmap must link v1.3 closeout doc");
  assert(roadmapDoc.includes("Delta Receiver Starter Integration"), "Roadmap must name v1.3 starter integration");
  assert(roadmapDoc.includes("v1.2 report kit"), "Roadmap must connect v1.3 to the v1.2 report kit");
  assert(roadmapDoc.includes("Local v1.4 closeout status"), "Roadmap must document v1.4 closeout status");
  assert(roadmapDoc.includes("docs/releases/v1.4.0.md"), "Roadmap must link v1.4 closeout doc");
  assert(roadmapDoc.includes("docs/receiver-usage-pack.md"), "Roadmap must link usage-pack guide");
  assert(roadmapDoc.includes("Delta Receiver Usage Pack"), "Roadmap must name v1.4 usage pack");
  assert(roadmapDoc.includes("Local v1.5 closeout status"), "Roadmap must document v1.5 closeout status");
  assert(roadmapDoc.includes("docs/releases/v1.5.0.md"), "Roadmap must link v1.5 closeout doc");
  assert(roadmapDoc.includes("docs/releases/v1.5.0-plan.md"), "Roadmap must link v1.5 plan doc");
  assert(roadmapDoc.includes("scripts/basebrief_check_artifacts.js"), "Roadmap must name the receiver lint implementation");
  assert(roadmapDoc.includes("Delta Receiver Lint Mini"), "Roadmap must name v1.5 lint mini");
  assert(roadmapDoc.includes("Planned v1.6 direction"), "Roadmap must document planned v1.6 direction");
  assert(roadmapDoc.includes("docs/releases/v1.6.0-plan.md"), "Roadmap must link v1.6 plan doc");
  assert(roadmapDoc.includes("Local v1.6 closeout status"), "Roadmap must document v1.6 closeout status");
  assert(roadmapDoc.includes("docs/releases/v1.6.0.md"), "Roadmap must link v1.6 closeout doc");
  assert(roadmapDoc.includes("examples/receiver/lint/"), "Roadmap must link receiver lint fixtures");
  assert(roadmapDoc.includes("Local v1.7 closeout status"), "Roadmap must document v1.7 closeout status");
  assert(roadmapDoc.includes("docs/releases/v1.7.0.md"), "Roadmap must link v1.7 closeout doc");
  assert(roadmapDoc.includes("examples/receiver/lint/repair/"), "Roadmap must link receiver lint repairs");
  assert(roadmapDoc.includes("Local v1.8 closeout status"), "Roadmap must document v1.8 closeout status");
  assert(roadmapDoc.includes("docs/releases/v1.8.0.md"), "Roadmap must link v1.8 closeout doc");
  assert(roadmapDoc.includes("delta-receiver-lint-dogfooding-v1.8.md"), "Roadmap must link receiver lint dogfooding evidence");
  assert(roadmapDoc.includes("Planned v1.9 direction"), "Roadmap must document v1.9 planning direction");
  assert(roadmapDoc.includes("docs/releases/v1.9.0-plan.md"), "Roadmap must link v1.9 adoption plan");
  assert(roadmapDoc.includes("map fixture -> repair -> existing receiver examples"), "Roadmap must preserve v1.9 adoption scope");
  assert(roadmapDoc.includes("Local v1.9 closeout status"), "Roadmap must document v1.9 closeout status");
  assert(roadmapDoc.includes("docs/releases/v1.9.0.md"), "Roadmap must link v1.9 closeout doc");
  assert(roadmapDoc.includes("usage pack -> usage-pack router -> lint fixture"), "Roadmap must preserve v1.9 public read order");
  assert(roadmapDoc.includes("closed and frozen the v1.x Delta Handoff"), "Roadmap must update current cycle through the v1.x final closure");
  assert(roadmapDoc.includes("Local v1.x final closeout status"), "Roadmap must document v1.x final closeout status");
  assert(roadmapDoc.includes("docs/releases/v1.9.1.md"), "Roadmap must link v1.9.1 final closure doc");
  assert(roadmapDoc.includes("docs/testing-v1.x-delta-receiver-closure-matrix.md"), "Roadmap must link v1.x delta receiver closure matrix");
  assert(roadmapDoc.includes("locally closed and frozen the v1.x Delta Handoff"), "Roadmap must mark the v1.x Delta line frozen");
  assert(roadmapDoc.includes("Local v2.0 Context Pack Lite closeout status"), "Roadmap must document v2.0 closeout status");
  assert(roadmapDoc.includes("docs/releases/v2.0.0.md"), "Roadmap must link v2.0.0 closeout");
  assert(roadmapDoc.includes("v2.1 Context Pack Check"), "Roadmap must prefer v2.1 context pack check next");
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
  assert(roadmapDoc.includes("The `v0.9.x` closure line is frozen"), "Roadmap must name the frozen v0.9.x closure line");
  assert(roadmapDoc.includes("v0.9.3 Final Closure / Freeze"), "Roadmap must include the v0.9.3 closure stage");
  assert(roadmapDoc.includes("`v0.9.x` closure line is frozen"), "Roadmap must preserve the frozen v0.9.x closure line");
  assert(roadmapDoc.includes("Keep the locally closed and frozen v1.x Delta Handoff / Receiver / Starter / Usage Pack / Lint / Fixture / Repair / Dogfooding / Adoption line reviewable"), "Roadmap must make the closed Delta line the first near-term priority");
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
  assert(goldenPathExampleReadme.includes("v1.2 Delta Receiver Report Kit"), "golden-path example README must link starter reports to the v1.2 report kit");
  assert(goldenPathExampleReadme.includes("live_repo_state"), "golden-path example README must mention live_repo_state");
  assert(goldenPathExampleReadme.includes("inherited_fact_differences"), "golden-path example README must mention inherited_fact_differences");
  assert(goldenPathExampleReadme.includes("hard_boundaries"), "golden-path example README must mention hard_boundaries");
  assert(goldenPathExampleReadme.includes("next_narrow_slice"), "golden-path example README must mention next_narrow_slice");
  assert(goldenPathExampleReadme.includes("receiver-window rechecks"), "golden-path example README must distinguish receiver rechecks");
  assert(goldenPathExampleReadme.includes("difference_found"), "golden-path example README must preserve difference_found semantics");
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
  assert(goldenPathExampleFirstPass.includes("live_repo_state"), "first-pass receiver sample must include live_repo_state");
  assert(goldenPathExampleFirstPass.includes("inherited_fact_differences"), "first-pass receiver sample must include inherited_fact_differences");
  assert(goldenPathExampleFirstPass.includes("hard_boundaries"), "first-pass receiver sample must include hard_boundaries");
  assert(goldenPathExampleFirstPass.includes("next_narrow_slice"), "first-pass receiver sample must include next_narrow_slice");
  assert(goldenPathExampleFirstPass.includes("difference_found"), "first-pass receiver sample must preserve difference_found semantics");
  assert(goldenPathExampleFollowUp.includes("pass"), "follow-up receiver sample must report pass/fail outcome");
  assert(goldenPathExampleFollowUp.includes("wait"), "follow-up receiver sample must wait for confirmation");
  assert(goldenPathExampleFollowUp.includes("state-advance"), "follow-up receiver sample must identify state-advance branch");
  assert(goldenPathExampleFollowUp.includes("live_repo_state"), "follow-up receiver sample must include live_repo_state");
  assert(goldenPathExampleFollowUp.includes("inherited_fact_differences"), "follow-up receiver sample must include inherited_fact_differences");
  assert(goldenPathExampleFollowUp.includes("hard_boundaries"), "follow-up receiver sample must include hard_boundaries");
  assert(goldenPathExampleFollowUp.includes("next_narrow_slice"), "follow-up receiver sample must include next_narrow_slice");
  assert(goldenPathExampleFollowUp.includes("difference_found"), "follow-up receiver sample must preserve difference_found semantics");
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
  assert(v1xDeltaReceiverMatrixDoc.includes("v1.x Delta Receiver Closure Matrix"), "v1.x delta receiver matrix must have a stable title");
  assert(v1xDeltaReceiverMatrixDoc.includes("delta-handoff.md -> receiver usage pack"), "v1.x delta receiver matrix must define the shared path");
  assert(v1xDeltaReceiverMatrixDoc.includes("v1.0 Delta Handoff"), "v1.x delta receiver matrix must include v1.0");
  assert(v1xDeltaReceiverMatrixDoc.includes("v1.9 Delta Receiver Lint Discoverability / Adoption"), "v1.x delta receiver matrix must include v1.9 adoption");
  assert(v1xDeltaReceiverMatrixDoc.includes("v1.9.1 Final Closure / Freeze"), "v1.x delta receiver matrix must include v1.9.1 final closure");
  assert(v1xDeltaReceiverMatrixDoc.includes("difference_found` remains a completed verification result"), "v1.x delta receiver matrix must preserve difference_found semantics");
  assert(v1xDeltaReceiverMatrixDoc.includes("Historical `commits_in_range` drift remains non-blocking"), "v1.x delta receiver matrix must preserve drift semantics");
  assert(v1xDeltaReceiverMatrixDoc.includes("provider_probe_status=skipped"), "v1.x delta receiver matrix must preserve skipped provider gate");
  assert(v1xDeltaReceiverMatrixDoc.includes("No provider request"), "v1.x delta receiver matrix must reject provider requests");
  assert(v1xDeltaReceiverMatrixDoc.includes("No checker rule change"), "v1.x delta receiver matrix must reject checker rule changes");
  assert(v1xDeltaReceiverMatrixDoc.includes("No new rule family"), "v1.x delta receiver matrix must reject new rule families");
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
  assert(nextChatTemplate.includes("pass/fail"), "NEXT_CHAT_PROMPT.md must preserve human-facing pass/fail");
  assert(nextChatTemplate.includes("等待用户确认"), "NEXT_CHAT_PROMPT.md must preserve wait-for-confirmation behavior");
  assert(nextChatTemplate.includes("live_repo_state"), "NEXT_CHAT_PROMPT.md must mention live_repo_state");
  assert(nextChatTemplate.includes("inherited_fact_differences"), "NEXT_CHAT_PROMPT.md must mention inherited_fact_differences");
  assert(nextChatTemplate.includes("hard_boundaries"), "NEXT_CHAT_PROMPT.md must mention hard_boundaries");
  assert(nextChatTemplate.includes("next_narrow_slice"), "NEXT_CHAT_PROMPT.md must mention next_narrow_slice");
  assert(nextChatTemplate.includes("source-window inherited facts"), "NEXT_CHAT_PROMPT.md must distinguish source-window inherited facts");
  assert(nextChatTemplate.includes("receiver-window rechecks"), "NEXT_CHAT_PROMPT.md must distinguish receiver-window rechecks");
  assert(nextChatTemplate.includes("historical drift"), "NEXT_CHAT_PROMPT.md must explain historical drift handling");
  assert(quickstartDoc.includes("receiver_entry_task"), "Quickstart must explain receiver entry task");
  assert(quickstartDoc.includes("post_acceptance_next_action"), "Quickstart must explain post-acceptance next action");
  assert(quickstartDoc.includes("match_latest_user_message"), "Quickstart must explain response language routing");
  assert(quickstartDoc.includes("expected_changed_files"), "Quickstart must explain exact changed-file comparison");
  assert(quickstartDoc.includes("handoff_acceptance"), "Quickstart must explain receiver acceptance status");
  assert(quickstartDoc.includes("v1.2 Delta Receiver Report Kit"), "Quickstart must point starter readers to the v1.2 report kit");
  assert(quickstartDoc.includes("live_repo_state"), "Quickstart must mention live_repo_state");
  assert(quickstartDoc.includes("inherited_fact_differences"), "Quickstart must mention inherited_fact_differences");
  assert(quickstartDoc.includes("hard_boundaries"), "Quickstart must mention hard_boundaries");
  assert(quickstartDoc.includes("next_narrow_slice"), "Quickstart must mention next_narrow_slice");
  assert(quickstartDoc.includes("historical count drift"), "Quickstart must explain historical count drift");
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
  assert(receiverCheckDoc.includes("## Artifact Checker Compatibility"), "Receiver Safe Check docs must document artifact checker compatibility");
  assert(receiverCheckDoc.includes("declared_checks_status"), "Receiver Safe Check docs must require declared_checks_status");
  assert(receiverCheckDoc.includes("repository_state_status: not_applicable"), "Receiver Safe Check docs must constrain not_applicable usage");
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
  assert(deltaReceiverAcceptanceDoc.includes("current_goal"), "Delta receiver acceptance doc must require current goal");
  assert(deltaReceiverAcceptanceDoc.includes("live_repo_state"), "Delta receiver acceptance doc must require live repo state field");
  assert(deltaReceiverAcceptanceDoc.includes("inherited_fact_differences"), "Delta receiver acceptance doc must require inherited fact differences");
  assert(deltaReceiverAcceptanceDoc.includes("hard_boundaries"), "Delta receiver acceptance doc must require hard boundaries");
  assert(deltaReceiverAcceptanceDoc.includes("next_narrow_slice"), "Delta receiver acceptance doc must require next narrow slice");
  assert(deltaReceiverAcceptanceDoc.includes("live repository state"), "Delta receiver acceptance doc must require live repository state");
  assert(deltaReceiverAcceptanceDoc.includes("inherited handoff facts"), "Delta receiver acceptance doc must separate inherited facts");
  assert(deltaReceiverAcceptanceDoc.includes("receiver-window rechecks"), "Delta receiver acceptance doc must require receiver-window rechecks");
  assert(deltaReceiverAcceptanceDoc.includes("difference_found"), "Delta receiver acceptance doc must define difference handling");
  assert(deltaReceiverAcceptanceDoc.includes("Local Dry-Run Result"), "Delta receiver acceptance doc must record dry-run result");
  assert(deltaReceiverAcceptanceDoc.includes("handoff_acceptance: difference_found"), "Delta receiver acceptance doc must record stale-handoff difference");
  assert(deltaReceiverAcceptanceDoc.includes("handoff_acceptance: pass"), "Delta receiver acceptance doc must record refreshed-handoff pass");
  assert(deltaReceiverAcceptanceDoc.indexOf("handoff_acceptance: difference_found") < deltaReceiverAcceptanceDoc.indexOf("handoff_acceptance: pass"), "Delta receiver acceptance doc must preserve difference-to-pass path");
  assert(deltaReceiverAcceptanceDoc.includes("commits_in_range: 3"), "Delta receiver acceptance doc must record refreshed commit count");
  assert(deltaReceiverAcceptanceDoc.includes("historical count drift"), "Delta receiver acceptance doc must explain historical count drift");
  assert(deltaReceiverAcceptanceDoc.includes("should not\ntreat an explainable historical count drift as blocking"), "Delta receiver acceptance doc must mark explainable drift non-blocking");
  assert(deltaReceiverAcceptanceDoc.includes("branch, HEAD, and worktree facts"), "Delta receiver acceptance doc must anchor pass to refreshed live facts");
  assert(deltaReceiverAcceptanceDoc.includes("worktreeChangedFiles: []"), "Delta receiver acceptance doc must record clean refreshed worktree");
  assert(deltaReceiverAcceptanceDoc.includes("no baseline advance"), "Delta receiver acceptance doc must keep baseline unadvanced");
  assert(deltaReceiverAcceptanceDoc.includes("No provider request"), "Delta receiver acceptance doc must reject provider scope");
  assert(deltaReceiverAcceptanceDoc.includes("No runtime integration"), "Delta receiver acceptance doc must reject runtime scope");
  assert(deltaReceiverAcceptanceDoc.includes("No plugin, MCP, IDE"), "Delta receiver acceptance doc must reject plugin/MCP/IDE scope");
  assert(deltaReceiverAcceptanceDoc.includes("No schema-v2 work"), "Delta receiver acceptance doc must reject schema-v2 scope");
  assert(deltaReceiverAcceptanceDoc.includes("provider_probe_status=skipped"), "Delta receiver acceptance doc must preserve skipped provider gate");
  assert(deltaReceiverReportKitDoc.includes("Delta Receiver Report Kit Dogfooding v1.2"), "Delta receiver report kit doc must have stable title");
  assert(deltaReceiverReportKitDoc.includes("receiver_task_status"), "Delta receiver report kit doc must require receiver task status");
  assert(deltaReceiverReportKitDoc.includes("repository_state_status"), "Delta receiver report kit doc must require repository state status");
  assert(deltaReceiverReportKitDoc.includes("handoff_acceptance"), "Delta receiver report kit doc must require handoff acceptance");
  assert(deltaReceiverReportKitDoc.includes("blocking_or_repair_notes"), "Delta receiver report kit doc must require repair notes");
  assert(deltaReceiverReportKitDoc.includes("current_goal"), "Delta receiver report kit doc must require current goal");
  assert(deltaReceiverReportKitDoc.includes("live_repo_state"), "Delta receiver report kit doc must require live repo state");
  assert(deltaReceiverReportKitDoc.includes("inherited_fact_differences"), "Delta receiver report kit doc must require inherited fact differences");
  assert(deltaReceiverReportKitDoc.includes("hard_boundaries"), "Delta receiver report kit doc must require hard boundaries");
  assert(deltaReceiverReportKitDoc.includes("next_narrow_slice"), "Delta receiver report kit doc must require next narrow slice");
  assert(deltaReceiverReportKitDoc.includes("source-window inherited facts"), "Delta receiver report kit doc must separate inherited facts");
  assert(deltaReceiverReportKitDoc.includes("receiver-window rechecks"), "Delta receiver report kit doc must separate receiver rechecks");
  assert(deltaReceiverReportKitDoc.includes("blocking differences versus non-blocking differences"), "Delta receiver report kit doc must distinguish blocking from non-blocking differences");
  assert(deltaReceiverReportKitDoc.includes("examples/receiver/delta-report-pass/README.md"), "Delta receiver report kit doc must link pass example");
  assert(deltaReceiverReportKitDoc.includes("examples/receiver/delta-report-difference-found/README.md"), "Delta receiver report kit doc must link difference example");
  assert(deltaReceiverReportKitDoc.includes("handoff_acceptance: pass"), "Delta receiver report kit doc must define pass");
  assert(deltaReceiverReportKitDoc.includes("handoff_acceptance: difference_found"), "Delta receiver report kit doc must define difference_found");
  assert(deltaReceiverReportKitDoc.includes("It is not an agent failure"), "Delta receiver report kit doc must state difference_found is not agent failure");
  assert(deltaReceiverReportKitDoc.includes("handoff_acceptance: blocked"), "Delta receiver report kit doc must define blocked");
  assert(deltaReceiverReportKitDoc.includes("historical count drift"), "Delta receiver report kit doc must explain historical count drift");
  assert(deltaReceiverReportKitDoc.includes("No provider request"), "Delta receiver report kit doc must reject provider scope");
  assert(deltaReceiverReportKitDoc.includes("No runtime integration"), "Delta receiver report kit doc must reject runtime scope");
  assert(deltaReceiverReportKitDoc.includes("No plugin, MCP, IDE"), "Delta receiver report kit doc must reject plugin/MCP/IDE scope");
  assert(deltaReceiverReportKitDoc.includes("No schema-v2 work"), "Delta receiver report kit doc must reject schema-v2 scope");
  assert(deltaReceiverReportKitDoc.includes("No new CLI command"), "Delta receiver report kit doc must avoid new CLI commands");
  assert(deltaReceiverReportKitDoc.includes("No machine-readable JSON schema"), "Delta receiver report kit doc must avoid report schema work");
  assert(deltaReceiverReportKitDoc.includes("No command output format change"), "Delta receiver report kit doc must avoid command output changes");
  assert(deltaReceiverReportKitDoc.includes("provider_probe_status=skipped"), "Delta receiver report kit doc must preserve skipped provider gate");
  assert(receiverUsagePackDoc.includes("Delta Receiver Usage Pack"), "Receiver usage-pack doc must have stable title");
  assert(receiverUsagePackDoc.includes("Minimum Read Order"), "Receiver usage-pack doc must define minimum read order");
  assert(receiverUsagePackDoc.includes("Decision Matrix"), "Receiver usage-pack doc must define decision matrix");
  assert(receiverUsagePackDoc.includes("pass"), "Receiver usage-pack doc must preserve pass routing");
  assert(receiverUsagePackDoc.includes("difference_found"), "Receiver usage-pack doc must preserve difference_found routing");
  assert(receiverUsagePackDoc.includes("blocked"), "Receiver usage-pack doc must preserve blocked routing");
  assert(/Human-facing `fail` can coexist with machine\s+`difference_found`/.test(receiverUsagePackDoc), "Receiver usage-pack doc must allow human fail with machine difference_found");
  assert(receiverUsagePackDoc.includes("source-window inherited facts"), "Receiver usage-pack doc must require inherited facts separation");
  assert(receiverUsagePackDoc.includes("live repo facts"), "Receiver usage-pack doc must require live repo separation");
  assert(receiverUsagePackDoc.includes("receiver-window rechecks"), "Receiver usage-pack doc must require receiver rechecks separation");
  assert(/Historical `commits_in_range` drift remains non-blocking/.test(receiverUsagePackDoc), "Receiver usage-pack doc must explain non-blocking historical count drift");
  assert(receiverUsagePackDoc.includes("docs/dogfooding/delta-receiver-report-kit-v1.2.md"), "Receiver usage-pack doc must point to the v1.2 report kit");
  assert(receiverUsagePackDoc.includes("examples/golden-path/first-pass-receiver-report.md"), "Receiver usage-pack doc must point to first-pass starter example");
  assert(receiverUsagePackDoc.includes("examples/golden-path/follow-up-receiver-report.md"), "Receiver usage-pack doc must point to follow-up starter example");
  assert(receiverUsagePackDoc.includes("## Checker Coverage"), "Receiver usage-pack doc must document checker coverage");
  assert(receiverUsagePackDoc.includes("Receiver-specific lint only applies to explicit receiver artifacts"), "Receiver usage-pack doc must keep lint detection explicit");
  assert(receiverUsagePackDoc.includes("Warnings cover missing `difference_found` semantics explanation"), "Receiver usage-pack doc must describe warning-only coverage");
  assert(receiverUsagePackDoc.includes("examples/receiver/lint/"), "Receiver usage-pack doc must point to lint fixtures");
  assert(receiverUsagePackDoc.includes("examples/receiver/lint/repair/"), "Receiver usage-pack doc must point to lint repairs");
  assert(receiverUsagePackDoc.includes("delta-receiver-lint-dogfooding-v1.8.md"), "Receiver usage-pack doc must point to lint dogfooding evidence");
  assert(receiverUsagePackDoc.includes("Fixture To Repair To Example Path"), "Receiver usage-pack doc must define fixture to repair to example path");
  assert(receiverUsagePackDoc.includes("docs/releases/v1.9.0-plan.md"), "Receiver usage-pack doc must point to v1.9 adoption plan");
  assert(receiverUsagePackDoc.includes("No provider request"), "Receiver usage-pack doc must reject provider scope");
  assert(receiverUsagePackDoc.includes("No runtime integration"), "Receiver usage-pack doc must reject runtime scope");
  assert(receiverUsagePackDoc.includes("No plugin, MCP, IDE"), "Receiver usage-pack doc must reject plugin/MCP/IDE scope");
  assert(receiverUsagePackDoc.includes("No schema-v2 work"), "Receiver usage-pack doc must reject schema-v2 scope");
  assert(receiverUsagePackDoc.includes("No new CLI command"), "Receiver usage-pack doc must avoid new CLI commands");
  assert(receiverUsagePackDoc.includes("No machine-readable JSON schema"), "Receiver usage-pack doc must avoid report schema work");
  assert(receiverUsagePackDoc.includes("No command output format change"), "Receiver usage-pack doc must avoid command output changes");
  assert(receiverUsagePackDoc.includes("provider_probe_status=skipped"), "Receiver usage-pack doc must preserve skipped provider gate");
  assert(receiverUsagePackReadme.includes("Receiver Usage Pack Example Router"), "Receiver usage-pack router must have stable title");
  assert(receiverUsagePackReadme.includes("../delta-report-pass/README.md"), "Receiver usage-pack router must link delta pass example");
  assert(receiverUsagePackReadme.includes("../delta-report-difference-found/README.md"), "Receiver usage-pack router must link delta difference example");
  assert(receiverUsagePackReadme.includes("../blocked/README.md"), "Receiver usage-pack router must link blocked example");
  assert(receiverUsagePackReadme.includes("../language-routing/README.md"), "Receiver usage-pack router must link language-routing example");
  assert(receiverUsagePackReadme.includes("../../golden-path/first-pass-receiver-report.md"), "Receiver usage-pack router must link golden-path first-pass example");
  assert(receiverUsagePackReadme.includes("../../golden-path/follow-up-receiver-report.md"), "Receiver usage-pack router must link golden-path follow-up example");
  assert(receiverUsagePackReadme.includes("starter-report-outline.md"), "Receiver usage-pack router must link starter outline");
  assert(receiverUsagePackReadme.includes("If A Receiver Lint Finding Sent You Here"), "Receiver usage-pack router must route lint findings");
  assert(receiverUsagePackReadme.includes("../lint/README.md"), "Receiver usage-pack router must link lint fixtures");
  assert(receiverUsagePackReadme.includes("../lint/repair/README.md"), "Receiver usage-pack router must link lint repairs");
  assert(receiverUsagePackReadme.includes("difference_found"), "Receiver usage-pack router must preserve difference_found semantics");
  assert(receiverUsagePackReadme.includes("historical `commits_in_range` drift remains non-blocking"), "Receiver usage-pack router must explain historical count drift");
  assert(receiverUsagePackReadme.includes("pass/fail"), "Receiver usage-pack router must preserve starter pass/fail anchor");
  assert(receiverUsagePackReadme.includes("provider_probe_status=skipped"), "Receiver usage-pack router must preserve skipped provider gate");
  assert(receiverUsagePackOutline.includes("source-window inherited facts"), "Receiver usage-pack outline must include inherited facts layer");
  assert(receiverUsagePackOutline.includes("live_repo_state"), "Receiver usage-pack outline must include live_repo_state");
  assert(receiverUsagePackOutline.includes("receiver_window_rechecks"), "Receiver usage-pack outline must include receiver rechecks");
  assert(receiverUsagePackOutline.includes("inherited_fact_differences"), "Receiver usage-pack outline must include inherited_fact_differences");
  assert(receiverUsagePackOutline.includes("hard_boundaries"), "Receiver usage-pack outline must include hard_boundaries");
  assert(receiverUsagePackOutline.includes("next_narrow_slice"), "Receiver usage-pack outline must include next_narrow_slice");
  assert(receiverUsagePackOutline.includes("wait for user confirmation"), "Receiver usage-pack outline must preserve confirmation anchor");
  assert(receiverUsagePackOutline.includes("declared_checks_status"), "Receiver usage-pack outline must include declared_checks_status");
  assert(receiverUsagePackOutline.includes("difference_found"), "Receiver usage-pack outline must preserve difference_found semantics");
  assert(receiverUsagePackOutline.includes("non-blocking"), "Receiver usage-pack outline must explain non-blocking historical drift");
  assert(receiverLintReadme.includes("clean-pass-receiver-report.md"), "Receiver lint README must link clean fixture");
  assert(receiverLintReadme.includes("receiver.missing-report-section"), "Receiver lint README must document missing-report-section fixture");
  assert(receiverLintReadme.includes("receiver.invalid-result-consistency"), "Receiver lint README must document JSON consistency fixture");
  assert(receiverLintReadme.includes("receiver.missing-drift-semantics"), "Receiver lint README must document drift warning fixture");
  assert(receiverLintReadme.includes("Public Read Order"), "Receiver lint README must document public read order");
  assert(receiverLintReadme.includes("../usage-pack/README.md"), "Receiver lint README must route back to usage-pack examples");
  assert(receiverLintRepairReadme.includes("fixed-delta-receiver-report.md"), "Receiver lint repair README must link fixed Delta report");
  assert(receiverLintRepairReadme.includes("fixed-result.json"), "Receiver lint repair README must link fixed result JSON");
  assert(receiverLintRepairReadme.includes("receiver.missing-human-anchor"), "Receiver lint repair README must document missing-human-anchor repair");
  assert(receiverLintRepairReadme.includes("After Repair"), "Receiver lint repair README must route after repair");
  assert(receiverLintRepairReadme.includes("../../delta-report-difference-found/README.md"), "Receiver lint repair README must link existing difference_found example");
  assert(receiverLintDogfoodingDoc.includes("Delta Receiver Lint Dogfooding v1.8"), "Receiver lint dogfooding doc must have stable title");
  assert(receiverLintDogfoodingDoc.includes("provider_request_performed: false"), "Receiver lint dogfooding doc must reject provider requests");
  assert(receiverLintDogfoodingDoc.includes("raw_private_output_copied: false"), "Receiver lint dogfooding doc must reject raw private output");
  assert(receiverLintDogfoodingDoc.includes("fixed-delta-receiver-report.md"), "Receiver lint dogfooding doc must reference fixed Delta report");
  assert(receiverLintDogfoodingDoc.includes("receiver.missing-report-section"), "Receiver lint dogfooding doc must record expected error fixture outcome");
  for (const reportExample of [deltaReportPassExample, deltaReportDifferenceExample]) {
    assert(reportExample.includes("receiver_task_status"), "Delta report examples must include receiver task status");
    assert(reportExample.includes("repository_state_status"), "Delta report examples must include repository state status");
    assert(reportExample.includes("handoff_acceptance"), "Delta report examples must include handoff acceptance");
    assert(reportExample.includes("blocking_or_repair_notes"), "Delta report examples must include repair notes");
    assert(reportExample.includes("current_goal"), "Delta report examples must include current goal");
    assert(reportExample.includes("live_repo_state"), "Delta report examples must include live repo state");
    assert(reportExample.includes("inherited_fact_differences"), "Delta report examples must include inherited fact differences");
    assert(reportExample.includes("hard_boundaries"), "Delta report examples must include hard boundaries");
    assert(reportExample.includes("next_narrow_slice"), "Delta report examples must include next narrow slice");
    assert(reportExample.includes("No provider request"), "Delta report examples must reject provider scope");
    assert(reportExample.includes("No runtime integration"), "Delta report examples must reject runtime scope");
    assert(reportExample.includes("No plugin, MCP, IDE"), "Delta report examples must reject plugin/MCP/IDE scope");
    assert(reportExample.includes("No schema-v2 work"), "Delta report examples must reject schema-v2 scope");
    assert(reportExample.includes("provider_probe_status=skipped"), "Delta report examples must preserve skipped provider gate");
  }
  assert(deltaReportPassExample.includes("Delta Receiver Report Example: pass"), "Delta pass report example must have stable title");
  assert(deltaReportPassExample.includes("repository_state_status: match"), "Delta pass report example must show matching repo state");
  assert(deltaReportPassExample.includes("handoff_acceptance: pass"), "Delta pass report example must show pass acceptance");
  assert(deltaReportPassExample.includes("Historical dry-run `commits_in_range` values may differ"), "Delta pass report example must explain historical count drift");
  assert(deltaReportDifferenceExample.includes("Delta Receiver Report Example: difference_found"), "Delta difference report example must have stable title");
  assert(deltaReportDifferenceExample.includes("repository_state_status: difference_found"), "Delta difference report example must show difference state");
  assert(deltaReportDifferenceExample.includes("handoff_acceptance: difference_found"), "Delta difference report example must show difference acceptance");
  assert(deltaReportDifferenceExample.includes("does not mean the agent failed"), "Delta difference report example must preserve difference semantics");
  assert(deltaReportDifferenceExample.includes("blocking: yes"), "Delta difference report example must identify blocking stale HEAD");
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
    "examples/file-only-export/README.md",
    "examples/file-only-export/exports/manifest.json",
    "examples/file-only-export/exports/context-pack.md",
    "examples/file-only-export/exports/context.json",
    "examples/file-only-export/exports/adapter-notes.md",
    "examples/context-pack-doctor/README.md",
    "examples/next-chat-example.md",
    "examples/receiver-check-config.json",
    "examples/receiver/difference-found/README.md",
    "examples/receiver/difference-found/receiver-check-config.json",
    "examples/receiver/difference-found/receiver-check-result.json",
    "examples/receiver/blocked/README.md",
    "examples/receiver/blocked/blocked-result.json",
    "examples/receiver/language-routing/README.md",
    "examples/receiver/language-routing/receiver-report.md",
    "examples/receiver/delta-report-pass/README.md",
    "examples/receiver/delta-report-difference-found/README.md",
    "examples/receiver/lint/README.md",
    "examples/receiver/lint/clean-pass-receiver-report.md",
    "examples/receiver/lint/delta-missing-section-receiver-report.md",
    "examples/receiver/lint/starter-missing-pass-fail-starter-report.md",
    "examples/receiver/lint/starter-missing-wait-starter-report.md",
    "examples/receiver/lint/starter-missing-fact-layer-starter-report.md",
    "examples/receiver/lint/json-invalid-result-consistency.json",
    "examples/receiver/lint/difference-found-warning-receiver-report.md",
    "examples/receiver/lint/historical-drift-warning-starter-report.md",
    "examples/receiver/lint/repair/README.md",
    "examples/receiver/lint/repair/fixed-delta-receiver-report.md",
    "examples/receiver/lint/repair/fixed-starter-report.md",
    "examples/receiver/lint/repair/fixed-result.json",
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
    "examples/simple-continuation/README.md",
    "examples/simple-continuation/input/PROJECT_STATE.md",
    "examples/simple-continuation/input/NOTES.md",
    "examples/simple-continuation/output/CONTINUATION_REPORT.md",
    "examples/simple-continuation/output/CHECK_SUMMARY.md",
    "examples/simple-continuation/output/NEXT_WINDOW_STARTER.md",
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
    "docs/checks.md",
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
    "docs/testing-v0.9.x-test-matrix.md",
    "docs/testing-v1.x-delta-receiver-closure-matrix.md",
    "docs/dogfooding/sidecar-external-receiver-smoke-v0.8.4.md",
    "docs/dogfooding/sidecar-manual-receiver-smoke-v0.8.5.md",
    "docs/dogfooding/sidecar-manual-receiver-smoke-v0.8.6.md",
    "docs/dogfooding/sidecar-openclaw-hermes-manual-smoke-followup.md",
    "docs/dogfooding/delta-handoff-fresh-receiver-v1.0.md",
    "docs/dogfooding/delta-handoff-baseline-advance-v1.0.md",
    "docs/dogfooding/delta-receiver-acceptance-v1.1.md",
    "docs/dogfooding/delta-receiver-report-kit-v1.2.md",
    "docs/dogfooding/delta-receiver-lint-dogfooding-v1.8.md",
    "docs/dogfooding/context-pack-lite-fresh-receiver-v2.0.0.md",
    "docs/dogfooding/context-pack-check-acceptance-v2.1.0.md",
    "docs/dogfooding/context-pack-human-next-step-hints-dogfooding-v2.7.1.md",
    "docs/releases/v2.0.0.md",
    "docs/releases/v2.1.0.md",
    "docs/releases/v2.1.0-plan.md",
    "docs/specs/context-pack-check.md",
    "examples/context-pack-lite",
    "examples/receiver-check-config.json",
    "examples/receiver/difference-found",
    "examples/receiver/blocked",
    "examples/receiver/language-routing",
    "examples/receiver/delta-report-pass",
    "examples/receiver/delta-report-difference-found",
    "examples/receiver/usage-pack",
    "examples/receiver/lint/README.md",
    "examples/receiver/lint/clean-pass-receiver-report.md",
    "examples/receiver/lint/repair/README.md",
    "examples/receiver/lint/repair/fixed-delta-receiver-report.md",
    "examples/receiver/lint/repair/fixed-starter-report.md",
    "examples/receiver/lint/repair/fixed-result.json",
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

function checkReceiverLintFixtures() {
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

  cases.forEach((testCase) => {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, testCase.relativePath) });
    assert(result.status === testCase.status, `Receiver lint fixture ${testCase.relativePath} must be ${testCase.status}`);
    assert(result.errorCount === testCase.errorCount, `Receiver lint fixture ${testCase.relativePath} error count mismatch`);
    assert(result.warningCount === testCase.warningCount, `Receiver lint fixture ${testCase.relativePath} warning count mismatch`);
    if (testCase.ruleId) {
      assert(
        result.findings.some((finding) => finding.ruleId === testCase.ruleId),
        `Receiver lint fixture ${testCase.relativePath} must report ${testCase.ruleId}`,
      );
    } else {
      assert(result.findings.length === 0, `Receiver lint fixture ${testCase.relativePath} must have no findings`);
    }
  });
  return cases.length;
}

function checkReceiverLintRepairs() {
  const cases = [
    "examples/receiver/lint/repair/fixed-delta-receiver-report.md",
    "examples/receiver/lint/repair/fixed-starter-report.md",
    "examples/receiver/lint/repair/fixed-result.json",
  ];

  cases.forEach((relativePath) => {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert(result.status === "passed", `Receiver lint repair ${relativePath} must pass`);
    assert(result.errorCount === 0, `Receiver lint repair ${relativePath} must report zero errors`);
    assert(result.warningCount === 0, `Receiver lint repair ${relativePath} must report zero warnings`);
    assert(result.findings.length === 0, `Receiver lint repair ${relativePath} must have no findings`);
  });

  return cases.length;
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
    assert(helpStdout.includes("continue --repo <target-repo> --output-dir <dir>"), "CLI help must expose Continuation Harness Lite");
    assert(helpStdout.includes("profile-init --repo <target-repo> --output <profile.json>"), "CLI help must expose Project Profile init");
    assert(helpStdout.includes("workflow --profile <profile.json> --output-dir <dir>"), "CLI help must expose Workflow Runner Lite");
    assert(helpStdout.includes("continue --profile <profile.json> --output-dir <dir>"), "CLI help must expose profile-backed continue");
    assert(helpStdout.includes("context-pack --repo <target-repo> --output-dir <dir>"), "CLI help must expose Context Pack Lite");
    assert(helpStdout.includes("resume --input <context-pack-dir>"), "CLI help must expose Context Pack Resume");
    assert(helpStdout.includes("doctor --repo <target-repo> --context-pack <context-pack-dir>"), "CLI help must expose Context Pack Doctor");
    assert(!helpStdout.includes("context-pack-check"), "CLI help must not add a context-pack-check command");

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

    const contextPackDir = path.join(tempRoot, "context-pack");
    const contextPackStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "context-pack",
      "--repo",
      receiverRepo,
      "--output-dir",
      contextPackDir,
      "--max-files",
      "4",
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const contextPackResult = JSON.parse(contextPackStdout);
    assert(contextPackResult.command === "context-pack", "CLI context-pack must return command metadata");
    assert(contextPackResult.status === "generated", "CLI context-pack must report generated status");
    assert(contextPackResult.outputDir.startsWith("tests"), "CLI context-pack must return a public-safe output path");
    assert(contextPackResult.outputFiles.manifest.endsWith("MANIFEST.md"), "CLI context-pack must report manifest path");
    assert(contextPackResult.limits.maxFiles === 4, "CLI context-pack must honor max-files");
    assert(fs.existsSync(path.join(contextPackDir, "MANIFEST.md")), "CLI context-pack must write MANIFEST.md");
    assert(fs.existsSync(path.join(contextPackDir, "NEXT_WINDOW_STARTER.md")), "CLI context-pack must write NEXT_WINDOW_STARTER.md");

    const profilePath = path.join(tempRoot, "basebrief-profile.json");
    const profileInitStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "profile-init",
      "--repo",
      receiverRepo,
      "--output",
      profilePath,
      "--recipe",
      "small-delta",
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const profileInitResult = JSON.parse(profileInitStdout);
    assert(profileInitResult.command === "profile-init", "CLI profile-init must return command metadata");
    assert(profileInitResult.contractVersion === "basebrief-project-profile-v1", "CLI profile-init must return profile contract");
    assert(profileInitResult.profile.recipe === "small-delta", "CLI profile-init must honor selected recipe");
    assert(fs.existsSync(profilePath), "CLI profile-init must write profile output");

    const profileContinueDir = path.join(tempRoot, "profile-continue");
    const profileContinueStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "continue",
      "--profile",
      profilePath,
      "--output-dir",
      profileContinueDir,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const profileContinueResult = JSON.parse(profileContinueStdout);
    assert(profileContinueResult.command === "continue", "CLI continue --profile must return continue metadata");
    assert(profileContinueResult.recipe === "small-delta", "CLI continue --profile must report recipe");
    assert(profileContinueResult.profileDefaultsApplied.repo === true, "CLI continue --profile must apply profile repo default");
    assert(!("prompt" in profileContinueResult), "CLI continue --profile JSON must not include prompt");
    assert(!("next_step" in profileContinueResult), "CLI continue --profile JSON must not include next_step");
    assert(fs.existsSync(path.join(profileContinueDir, "CONTINUATION_REPORT.md")), "CLI continue --profile must write continuation report");

    const workflowDir = path.join(tempRoot, "workflow");
    const workflowStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "workflow",
      "--profile",
      profilePath,
      "--output-dir",
      workflowDir,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const workflowResult = JSON.parse(workflowStdout);
    assert(workflowResult.command === "workflow", "CLI workflow must return workflow metadata");
    assert(workflowResult.workflowContractVersion === "basebrief-workflow-lite-v1", "CLI workflow must return workflow contract");
    assert(workflowResult.recipe === "small-delta", "CLI workflow must report profile recipe");
    assert(workflowResult.profileDefaultsApplied.repo === true, "CLI workflow must apply profile repo default");
    assert(workflowResult.steps.continue === workflowResult.status, "CLI workflow must expose continuation status in steps");
    assert(workflowResult.outputFiles.contextPack.endsWith("context-pack"), "CLI workflow must report context pack output");
    assert(!("prompt" in workflowResult), "CLI workflow JSON must not include prompt");
    assert(!("next_step" in workflowResult), "CLI workflow JSON must not include next_step");
    assert(!/[A-Za-z]:[\\/]/.test(workflowStdout), "CLI workflow JSON must not expose drive-letter absolute paths");
    assert(fs.existsSync(path.join(workflowDir, "CONTINUATION_REPORT.md")), "CLI workflow must write continuation report");
    assert(fs.existsSync(path.join(workflowDir, "context-pack", "MANIFEST.md")), "CLI workflow must write context pack");

    const contextPackCheckStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "check",
      "--input",
      contextPackDir,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const contextPackCheckResult = JSON.parse(contextPackCheckStdout);
    assert(contextPackCheckResult.command === "check", "CLI context pack check must use existing check command");
    assert(contextPackCheckResult.check.status === "passed", "CLI context pack check must pass a clean generated pack");
    assert(contextPackCheckResult.check.errorCount === 0, "CLI context pack check must report zero errors for clean pack");
    assert(
      !contextPackCheckResult.check.findings.some((finding) => finding.ruleId.startsWith("context-pack.")),
      "CLI context pack check must report no context-pack findings for clean pack",
    );

    const doctorStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "doctor",
      "--repo",
      receiverRepo,
      "--context-pack",
      contextPackDir,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const doctorResult = JSON.parse(doctorStdout);
    assert(doctorResult.command === "doctor", "CLI doctor must return command metadata");
    assert(doctorResult.contractVersion === "basebrief-doctor-v1", "CLI doctor must return doctor contract version");
    assert(doctorResult.repo.startsWith("tests"), "CLI doctor must return a public-safe repo path");
    assert(doctorResult.contextPack.startsWith("tests"), "CLI doctor must return a public-safe context pack path");
    assert(doctorResult.summary.errorCount === 0, "CLI doctor must report zero errors for generated pack smoke");
    assert(doctorResult.findings.some((finding) => finding.ruleId === "doctor.live-recheck-required"), "CLI doctor must emit live recheck info");
    assert(!doctorResult.findings.some((finding) => finding.ruleId === "doctor.no-provider-boundary"), "CLI doctor must not report no-provider-boundary for generated v2.5.1 pack");
    assert(!/[A-Za-z]:[\\/]/.test(JSON.stringify(doctorResult)), "CLI doctor JSON must not expose drive-letter absolute paths");
    assert(!/\\\\/.test(JSON.stringify(doctorResult)), "CLI doctor JSON must not expose UNC paths");

    const resumeStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "resume",
      "--input",
      contextPackDir,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const resumeResult = JSON.parse(resumeStdout);
    assert(resumeResult.command === "resume", "CLI resume must return command metadata");
    assert(resumeResult.contractVersion === "basebrief-resume-v1", "CLI resume must return resume contract version");
    assert(resumeResult.status === "ready", "CLI resume must report ready status for clean pack");
    assert(resumeResult.input.startsWith("tests"), "CLI resume must return public-safe input path");
    assert(resumeResult.check.errorCount === 0, "CLI resume must report zero checker errors for clean pack");
    assert(resumeResult.prompt.includes("BaseBrief Resume Prompt"), "CLI resume must include copyable prompt text");
    assert(!/[A-Za-z]:[\\/]/.test(resumeResult.prompt), "CLI resume prompt must not expose private absolute paths");

    const contextPackBrokenCases = [
      {
        name: "missing-file",
        mutate(dir) {
          fs.rmSync(path.join(dir, "KEY_FILES.md"));
        },
        ruleId: "context-pack.missing-file",
      },
      {
        name: "invalid-metadata",
        mutate(dir) {
          const filePath = path.join(dir, "REPO_MAP.md");
          fs.writeFileSync(filePath, fs.readFileSync(filePath, "utf8").replace(/^Trust: .+$/m, "Trust: certain"), "utf8");
        },
        ruleId: "context-pack.invalid-metadata",
      },
      {
        name: "missing-starter-instruction",
        mutate(dir) {
          const filePath = path.join(dir, "NEXT_WINDOW_STARTER.md");
          fs.writeFileSync(filePath, fs.readFileSync(filePath, "utf8").replace(/^- List any gaps before proposing implementation work\.\r?\n/m, ""), "utf8");
        },
        ruleId: "context-pack.missing-starter-instruction",
      },
      {
        name: "private-path",
        mutate(dir) {
          const fakePrivatePath = ["C:", "Users", "alice", "secret", "notes.md"].join("\\");
          fs.appendFileSync(path.join(dir, "MANIFEST.md"), `\n- Debug path: ${fakePrivatePath}\n`, "utf8");
        },
        ruleId: "private.absolute-path",
      },
    ];
    contextPackBrokenCases.forEach((testCase) => {
      const brokenDir = path.join(tempRoot, `context-pack-${testCase.name}`);
      fs.cpSync(contextPackDir, brokenDir, { recursive: true });
      testCase.mutate(brokenDir);
      const result = checkArtifacts({ inputPath: brokenDir });
      assert(result.status === "failed", `Context Pack broken fixture ${testCase.name} must fail`);
      assert(
        result.findings.some((finding) => finding.ruleId === testCase.ruleId),
        `Context Pack broken fixture ${testCase.name} must report ${testCase.ruleId}`,
      );
    });

    const thickDir = path.join(tempRoot, "context-pack-too-thick");
    fs.cpSync(contextPackDir, thickDir, { recursive: true });
    fs.appendFileSync(path.join(thickDir, "REPO_MAP.md"), `\n${"A".repeat(21050)}\n`, "utf8");
    const thickResult = checkArtifacts({ inputPath: thickDir });
    assert(thickResult.status === "passed", "Context Pack thick fixture must stay passed");
    assert(thickResult.errorCount === 0, "Context Pack thick fixture must report zero errors");
    assert(thickResult.warningCount > 0, "Context Pack thick fixture must report warnings");
    assert(
      thickResult.findings.some((finding) => finding.ruleId === "context-pack.too-thick"),
      "Context Pack thick fixture must report context-pack.too-thick",
    );

    const thickCheckStdout = execFileSync(process.execPath, [
      "scripts/basebrief.js",
      "check",
      "--input",
      thickDir,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const thickCheckResult = JSON.parse(thickCheckStdout);
    assert(thickCheckResult.command === "check", "CLI context pack thickness check must use existing check command");
    assert(thickCheckResult.check.status === "passed", "CLI context pack thickness check must stay passed");
    assert(thickCheckResult.check.errorCount === 0, "CLI context pack thickness check must report zero errors");
    assert(thickCheckResult.check.warningCount > 0, "CLI context pack thickness check must report warnings");
    assert(
      thickCheckResult.check.findings.some((finding) => finding.ruleId === "context-pack.too-thick"),
      "CLI context pack thickness check must report context-pack.too-thick",
    );

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
    return 24;
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
  const tests = ["tests/basebrief.test.js", "tests/context-pack.test.js", "tests/cache-ready-benchmark.test.js", "tests/continuation-harness.test.js", "tests/project-profile.test.js", "tests/workflow-runner.test.js"];
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
  const receiverLintFixtures = checkReceiverLintFixtures();
  const receiverLintRepairs = checkReceiverLintRepairs();
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
  console.log(`receiver_lint_fixtures=${receiverLintFixtures}`);
  console.log(`receiver_lint_repairs=${receiverLintRepairs}`);
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
