const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { HELP_TEXT, commandContinue, commandWorkflow, formatHuman, run } = require("../scripts/basebrief");
const { runProfileInit } = require("../scripts/basebrief_project_profile");
const { WORKFLOW_CONTRACT_VERSION, runWorkflow } = require("../scripts/basebrief_workflow");

const repoRoot = path.resolve(__dirname, "..");

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function withFixtureRepo(fn) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "basebrief-workflow-"));
  const repoDir = path.join(tempRoot, "repo");
  try {
    fs.mkdirSync(path.join(repoDir, "docs"), { recursive: true });
    fs.mkdirSync(path.join(repoDir, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(repoDir, "README.md"), "# Fixture\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "docs", "index.md"), "# Docs\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "docs", "notes.md"), "# Notes\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "scripts", "safe.js"), "const safe = true;\n", "utf8");
    git(repoDir, ["init"]);
    git(repoDir, ["config", "user.email", "basebrief@example.invalid"]);
    git(repoDir, ["config", "user.name", "BaseBrief Workflow Test"]);
    git(repoDir, ["add", "."]);
    git(repoDir, ["commit", "-m", "workflow fixture"]);
    return fn({ tempRoot, repoDir });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

test("Workflow Runner Lite wraps profile continuation without leaking prompt data", () => {
  withFixtureRepo(({ tempRoot }) => {
    const profilePath = path.join(tempRoot, "profile.json");
    const outputDir = path.join(tempRoot, "workflow");
    runProfileInit({ repo: path.join(tempRoot, "repo"), output: profilePath, recipe: "review-heavy" });

    const result = runWorkflow({ profile: profilePath, "output-dir": outputDir });

    assert.equal(result.command, "workflow");
    assert.equal(result.workflowContractVersion, WORKFLOW_CONTRACT_VERSION);
    assert.equal(result.status, "ready_for_receiver");
    assert.equal(result.recipe, "review-heavy");
    assert.equal(result.steps.continue, "ready_for_receiver");
    assert.equal(result.steps.contextPack, "generated");
    assert.equal(result.steps.check, "passed");
    assert.equal(result.steps.resume, "ready");
    assert.deepEqual(result.profileDefaultsApplied, {
      repo: true,
      since: false,
      maxFiles: true,
    });
    assert.match(result.boundaries.join("\n"), /No provider request/);
    assert.match(result.boundaries.join("\n"), /No automatic commit, push, tag, release/);
    assert.equal(Object.hasOwn(result, "prompt"), false);
    assert.equal(Object.hasOwn(result, "next_step"), false);

    assert.equal(fs.existsSync(path.join(outputDir, "CONTINUATION_REPORT.md")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "CHECK_SUMMARY.md")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "NEXT_WINDOW_STARTER.md")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "context-pack", "MANIFEST.md")), true);

    const meta = readJson(path.join(outputDir, "continuation.meta.json"));
    assert.equal(meta.command, "continue");
    assert.equal(meta.continuationStatus, "ready_for_receiver");
    assert.equal(result.outputFiles.contextPack, path.join(outputDir, "context-pack"));
    assert.match(formatHuman(result), /BaseBrief workflow runner ready_for_receiver/);
    assert.match(formatHuman(result), /next_step=copy NEXT_WINDOW_STARTER\.md into the receiver window after review/);
  });
});

test("Workflow Runner Lite CLI keeps JSON public-safe", () => {
  withFixtureRepo(({ tempRoot, repoDir }) => {
    const profilePath = path.join(tempRoot, "profile.json");
    runProfileInit({ repo: repoDir, output: profilePath });

    const cli = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "workflow",
      "--profile",
      profilePath,
      "--output-dir",
      path.join(tempRoot, "cli-workflow"),
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });

    assert.equal(cli.status, 0, cli.stderr);
    const parsed = JSON.parse(cli.stdout);
    assert.equal(parsed.command, "workflow");
    assert.equal(parsed.workflowContractVersion, WORKFLOW_CONTRACT_VERSION);
    assert.equal(parsed.status, "ready_for_receiver");
    assert.equal(parsed.profile, "[outside-cwd]");
    assert.equal(parsed.outputDir, "[outside-cwd]");
    assert.equal(parsed.outputFiles.report, "[outside-cwd]");
    assert.equal(Object.hasOwn(parsed, "prompt"), false);
    assert.equal(Object.hasOwn(parsed, "next_step"), false);
    assert.doesNotMatch(cli.stdout, /[A-Za-z]:[\\/]|\\\\|Bearer|token|secret|api_key/i);
  });
});

test("Workflow Runner Lite marks dirty repositories as needs_review without project actions", () => {
  withFixtureRepo(({ tempRoot, repoDir }) => {
    const profilePath = path.join(tempRoot, "profile.json");
    runProfileInit({ repo: repoDir, output: profilePath });
    fs.appendFileSync(path.join(repoDir, "README.md"), "\nUncommitted workflow note.\n", "utf8");
    const beforeHead = git(repoDir, ["rev-parse", "HEAD"]);

    const result = runWorkflow({ profile: profilePath, "output-dir": path.join(tempRoot, "dirty-workflow") });

    assert.equal(result.status, "needs_review");
    assert.equal(result.steps.resume, "ready");
    assert.equal(git(repoDir, ["rev-parse", "HEAD"]), beforeHead);
    assert.match(git(repoDir, ["status", "--short"]), /README\.md/);
    assert.match(formatHuman(result), /next_step=review CONTINUATION_REPORT\.md before copying NEXT_WINDOW_STARTER\.md/);
  });
});

test("Workflow Runner Lite lets explicit CLI options override profile defaults", () => {
  withFixtureRepo(({ tempRoot, repoDir }) => {
    const profilePath = path.join(tempRoot, "profile.json");
    runProfileInit({ repo: repoDir, output: profilePath, recipe: "review-heavy" });
    const profile = readJson(profilePath);
    profile.defaults.since = "HEAD";
    profile.defaults.max_files = 20;
    fs.writeFileSync(profilePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");

    const result = commandWorkflow({
      profile: profilePath,
      repo: repoDir,
      since: "HEAD",
      "output-dir": path.join(tempRoot, "override-workflow"),
      "max-files": "2",
    });

    assert.equal(result.status, "ready_for_receiver");
    assert.deepEqual(result.profileDefaultsApplied, {
      repo: false,
      since: false,
      maxFiles: false,
    });
    const keyFiles = readText(path.join(tempRoot, "override-workflow", "context-pack", "KEY_FILES.md"));
    const rows = keyFiles.split(/\r?\n/).filter((line) => /^\| `/.test(line));
    assert(rows.length <= 2, `expected override max-files to limit rows, got ${rows.length}`);
  });
});

test("Workflow Runner Lite rejects missing profile, unsafe profile, and non-empty output", () => {
  withFixtureRepo(({ tempRoot, repoDir }) => {
    const profilePath = path.join(tempRoot, "profile.json");
    runProfileInit({ repo: repoDir, output: profilePath });

    assert.throws(
      () => runWorkflow({ "output-dir": path.join(tempRoot, "missing-profile") }),
      /Missing --profile <profile\.json>/,
    );

    const unsafeProfile = readJson(profilePath);
    unsafeProfile.api_key = "abc";
    const unsafeProfilePath = path.join(tempRoot, "unsafe-profile.json");
    fs.writeFileSync(unsafeProfilePath, `${JSON.stringify(unsafeProfile, null, 2)}\n`, "utf8");
    assert.throws(
      () => runWorkflow({ profile: unsafeProfilePath, "output-dir": path.join(tempRoot, "unsafe-workflow") }),
      /unsupported sensitive field/,
    );

    const nonEmptyOutput = path.join(tempRoot, "non-empty");
    fs.mkdirSync(nonEmptyOutput);
    fs.writeFileSync(path.join(nonEmptyOutput, "existing.md"), "# Existing\n", "utf8");
    assert.throws(
      () => runWorkflow({ profile: profilePath, "output-dir": nonEmptyOutput }),
      /already exists and is not empty/,
    );
  });
});

test("Workflow Runner Lite does not change continue commands", () => {
  withFixtureRepo(({ tempRoot, repoDir }) => {
    const profilePath = path.join(tempRoot, "profile.json");
    runProfileInit({ repo: repoDir, output: profilePath });

    const profileResult = commandContinue({
      profile: profilePath,
      "output-dir": path.join(tempRoot, "plain-profile-continue"),
    });
    const repoResult = run([
      "node",
      "scripts/basebrief.js",
      "continue",
      "--repo",
      repoDir,
      "--output-dir",
      path.join(tempRoot, "plain-repo-continue"),
    ]);

    assert.equal(profileResult.command, "continue");
    assert.equal(profileResult.status, "ready_for_receiver");
    assert.equal(repoResult.command, "continue");
    assert.equal(repoResult.status, "ready_for_receiver");
    assert.match(HELP_TEXT, /workflow --profile <profile\.json> --output-dir <dir>/);
  });
});
