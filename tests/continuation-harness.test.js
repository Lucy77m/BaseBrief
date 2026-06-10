const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { checkArtifacts } = require("../scripts/basebrief_check_artifacts");
const { HELP_TEXT, commandContinue, formatHuman, run } = require("../scripts/basebrief");
const {
  CONTINUATION_CONTRACT_VERSION,
  CONTINUATION_FILES,
  runContinuationHarness,
  safePromptForOutput,
} = require("../scripts/basebrief_continuation_harness");

const repoRoot = path.resolve(__dirname, "..");

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function withFixtureRepo(fn) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "basebrief-continuation-"));
  const repoDir = path.join(tempRoot, "repo");
  try {
    fs.mkdirSync(path.join(repoDir, "docs"), { recursive: true });
    fs.mkdirSync(path.join(repoDir, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(repoDir, "README.md"), "# Fixture\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "docs", "index.md"), "# Docs\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "scripts", "safe.js"), "const safe = true;\n", "utf8");
    git(repoDir, ["init"]);
    git(repoDir, ["config", "user.email", "basebrief@example.invalid"]);
    git(repoDir, ["config", "user.name", "BaseBrief Continuation Harness Test"]);
    git(repoDir, ["add", "."]);
    git(repoDir, ["commit", "-m", "continuation harness fixture"]);
    return fn({ tempRoot, repoDir });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

test("Continuation Harness Lite writes a ready receiver package for a clean repo", () => {
  withFixtureRepo(({ tempRoot, repoDir }) => {
    const outputDir = path.join(tempRoot, "continue");
    const result = runContinuationHarness({ repo: repoDir, "output-dir": outputDir, "max-files": "3" });

    assert.equal(result.command, "continue");
    assert.equal(result.contractVersion, CONTINUATION_CONTRACT_VERSION);
    assert.equal(result.status, "ready_for_receiver");
    assert.equal(result.steps.contextPack, "generated");
    assert.equal(result.steps.check, "passed");
    assert.equal(result.steps.resume, "ready");
    assert.equal(result.steps.doctor, "skipped");
    assert.equal(result.steps.export, "skipped");
    assert.equal(result.check.errorCount, 0);
    assert.equal(result.check.warningCount, 0);

    for (const fileName of [
      CONTINUATION_FILES.report,
      CONTINUATION_FILES.starter,
      CONTINUATION_FILES.checkSummary,
      CONTINUATION_FILES.meta,
    ]) {
      assert.equal(fs.existsSync(path.join(outputDir, fileName)), true, fileName);
    }
    for (const fileName of [
      "MANIFEST.md",
      "REPO_MAP.md",
      "KEY_FILES.md",
      "RECENT_DELTA.md",
      "RISK_BOUNDARIES.md",
      "RECEIVER_STATE.md",
      "NEXT_WINDOW_STARTER.md",
    ]) {
      assert.equal(fs.existsSync(path.join(outputDir, "context-pack", fileName)), true, fileName);
    }

    const report = readText(path.join(outputDir, CONTINUATION_FILES.report));
    assert.match(report, /continuation_status: ready_for_receiver/);
    assert.match(report, /context-pack\/MANIFEST\.md/);
    assert.match(report, /No provider request/);
    assert.match(report, /No Workflow Runner/);
    assert.match(report, /No automatic commit, push, tag, release, or pull request/);
    assert.doesNotMatch(report, /[A-Za-z]:[\\/]/);

    const starter = readText(path.join(outputDir, CONTINUATION_FILES.starter));
    assert.match(starter, /BaseBrief Resume Prompt/);
    assert.match(starter, /Input directory:/);
    assert.match(starter, /`context-pack`/);
    assert.doesNotMatch(starter, /[A-Za-z]:[\\/]/);

    const summary = readText(path.join(outputDir, CONTINUATION_FILES.checkSummary));
    assert.match(summary, /check_status: passed/);
    assert.match(summary, /- none/);

    const meta = JSON.parse(readText(path.join(outputDir, CONTINUATION_FILES.meta)));
    assert.equal(meta.command, "continue");
    assert.equal(meta.contractVersion, CONTINUATION_CONTRACT_VERSION);
    assert.equal(meta.continuationStatus, "ready_for_receiver");
    assert.equal(meta.outputs.starter, "NEXT_WINDOW_STARTER.md");
    assert.equal(meta.outputs.contextPack, "context-pack/");
    assert.equal(Object.hasOwn(meta, "prompt"), false);
    assert.doesNotMatch(JSON.stringify(meta), /[A-Za-z]:[\\/]/);

    assert.equal(checkArtifacts({ inputPath: outputDir }).errorCount, 0);
    assert.match(formatHuman(result), /next_step=copy NEXT_WINDOW_STARTER\.md into the receiver window after review/);
    assert.match(HELP_TEXT, /continue --repo <target-repo> --output-dir <dir>/);
    assert.equal(run(["node", "scripts/basebrief.js", "continue", "--repo", repoDir, "--output-dir", path.join(tempRoot, "run")]).command, "continue");
    assert.equal(commandContinue({ repo: repoDir, "output-dir": path.join(tempRoot, "command") }).status, "ready_for_receiver");
  });
});

test("Continuation Harness Lite marks dirty repositories as needs_review", () => {
  withFixtureRepo(({ tempRoot, repoDir }) => {
    fs.appendFileSync(path.join(repoDir, "README.md"), "\nUncommitted note.\n", "utf8");
    const outputDir = path.join(tempRoot, "dirty-continue");
    const result = runContinuationHarness({ repo: repoDir, "output-dir": outputDir });

    assert.equal(result.status, "needs_review");
    assert.equal(result.git.worktree_status, "dirty");
    assert.equal(result.steps.resume, "ready");
    const report = readText(path.join(outputDir, CONTINUATION_FILES.report));
    assert.match(report, /continuation_status: needs_review/);
    assert.match(report, /worktree_status: dirty/);
    assert.match(formatHuman(result), /next_step=review CONTINUATION_REPORT\.md before copying NEXT_WINDOW_STARTER\.md/);
  });
});

test("Continuation Harness Lite CLI keeps JSON public-safe", () => {
  withFixtureRepo(({ tempRoot, repoDir }) => {
    const outputDir = path.join(tempRoot, "cli-continue");
    const cli = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "continue",
      "--repo",
      repoDir,
      "--output-dir",
      outputDir,
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });

    assert.equal(cli.status, 0, cli.stderr);
    const parsed = JSON.parse(cli.stdout);
    assert.equal(parsed.command, "continue");
    assert.equal(parsed.status, "ready_for_receiver");
    assert.equal(parsed.outputDir, "[outside-cwd]");
    assert.equal(parsed.outputFiles.report, "[outside-cwd]");
    assert.equal(Object.hasOwn(parsed, "prompt"), false);
    assert.equal(Object.hasOwn(parsed, "next_step"), false);
    assert.doesNotMatch(cli.stdout, /[A-Za-z]:[\\/]/);
  });
});

test("Continuation Harness Lite rejects unsafe or non-empty outputs", () => {
  withFixtureRepo(({ tempRoot, repoDir }) => {
    const nonEmptyDir = path.join(tempRoot, "non-empty");
    fs.mkdirSync(nonEmptyDir);
    fs.writeFileSync(path.join(nonEmptyDir, "existing.md"), "# Existing\n", "utf8");
    assert.throws(
      () => runContinuationHarness({ repo: repoDir, "output-dir": nonEmptyDir }),
      /already exists and is not empty/,
    );
    assert.throws(
      () => runContinuationHarness({ repo: repoDir, "output-dir": path.join(tempRoot, ".env", "continue") }),
      /must not use an \.env path/,
    );
  });
});

test("Continuation Harness Lite removes context-pack absolute paths from copied starter", () => {
  const drive = ["C", ":"].join("");
  const slashPackPath = [drive, "Users", "example", "project", "tests", "outputs", "private", "pack"].join("/");
  const backslashPackPath = [drive, "Users", "example", "project", "tests", "outputs", "private", "pack"].join("\\");
  const prompt = [
    "# Prompt",
    "",
    "Input directory:",
    "",
    `\`${slashPackPath}\``,
    slashPackPath,
  ].join("\n");

  const safe = safePromptForOutput(prompt, backslashPackPath);
  assert.match(safe, /`context-pack`/);
  assert.doesNotMatch(safe, /C:[\\/]/);
});
