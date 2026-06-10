#!/usr/bin/env node

const { CONTINUATION_CONTRACT_VERSION, runContinuationHarness } = require("./basebrief_continuation_harness");
const { loadProjectProfile, optionsFromProfile } = require("./basebrief_project_profile");

const WORKFLOW_CONTRACT_VERSION = "basebrief-workflow-lite-v1";

const WORKFLOW_BOUNDARIES = [
  "No provider request.",
  "No raw private output.",
  "No runtime integration.",
  "No plugin.",
  "No MCP server.",
  "No MCP tools.",
  "No schema-v2.",
  "No daemon.",
  "No watcher.",
  "No CI workflow.",
  "No automatic project task implementation.",
  "No automatic commit, push, tag, release, pull request, npm publish, or global CLI install.",
  "No credential storage.",
];

function profileDefaultsApplied({ options, profile }) {
  return {
    repo: !options.repo,
    since: !options.since && Boolean(profile.defaults.since),
    maxFiles: !options["max-files"],
  };
}

function workflowOutputFiles(outputFiles) {
  return {
    report: outputFiles.report,
    contextPack: outputFiles.contextPackDir,
    starter: outputFiles.starter,
    checkSummary: outputFiles.checkSummary,
    meta: outputFiles.meta,
  };
}

function runWorkflow(options) {
  if (!options.profile) throw new Error("Missing --profile <profile.json>");
  if (!options["output-dir"]) throw new Error("Missing --output-dir <dir>");

  const loaded = loadProjectProfile(options.profile);
  const profileOptions = optionsFromProfile(loaded.path, loaded.profile, {
    repo: options.repo || "",
    since: options.since || "",
    "max-files": options["max-files"] || "",
  });
  const continuation = runContinuationHarness({
    ...profileOptions,
    "output-dir": options["output-dir"],
  });

  return {
    command: "workflow",
    workflowContractVersion: WORKFLOW_CONTRACT_VERSION,
    status: continuation.status,
    profile: loaded.path,
    recipe: loaded.profile.recipe,
    profileDefaultsApplied: profileDefaultsApplied({ options, profile: loaded.profile }),
    steps: {
      continue: continuation.status,
      contextPack: continuation.steps.contextPack,
      check: continuation.steps.check,
      resume: continuation.steps.resume,
    },
    outputDir: continuation.outputDir,
    outputFiles: workflowOutputFiles(continuation.outputFiles),
    continuationContractVersion: CONTINUATION_CONTRACT_VERSION,
    boundaries: WORKFLOW_BOUNDARIES,
  };
}

module.exports = {
  WORKFLOW_BOUNDARIES,
  WORKFLOW_CONTRACT_VERSION,
  runWorkflow,
};
