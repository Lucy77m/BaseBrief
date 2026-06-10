const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { HELP_TEXT, commandContinue, commandProfileInit, formatHuman, run } = require("../scripts/basebrief");
const {
  PROJECT_PROFILE_CONTRACT_VERSION,
  loadProjectProfile,
  optionsFromProfile,
  runProfileInit,
  validateProjectProfile,
} = require("../scripts/basebrief_project_profile");

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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "basebrief-profile-"));
  const repoDir = path.join(tempRoot, "repo");
  try {
    fs.mkdirSync(path.join(repoDir, "docs"), { recursive: true });
    fs.mkdirSync(path.join(repoDir, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(repoDir, "README.md"), "# Fixture\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "docs", "index.md"), "# Docs\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "scripts", "safe.js"), "const safe = true;\n", "utf8");
    git(repoDir, ["init"]);
    git(repoDir, ["config", "user.email", "basebrief@example.invalid"]);
    git(repoDir, ["config", "user.name", "BaseBrief Project Profile Test"]);
    git(repoDir, ["add", "."]);
    git(repoDir, ["commit", "-m", "project profile fixture"]);
    return fn({ tempRoot, repoDir });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

test("Project Profile Lite init writes a public-safe reviewable profile", () => {
  withFixtureRepo(({ tempRoot, repoDir }) => {
    const output = path.join(tempRoot, "profile", "basebrief-profile.json");
    const result = runProfileInit({ repo: repoDir, output, recipe: "small-delta" });

    assert.equal(result.command, "profile-init");
    assert.equal(result.contractVersion, PROJECT_PROFILE_CONTRACT_VERSION);
    assert.equal(result.profile.schemaVersion, PROJECT_PROFILE_CONTRACT_VERSION);
    assert.equal(result.profile.recipe, "small-delta");
    assert.equal(result.profile.defaults.max_files, 8);
    assert.equal(result.profile.starter_language, "auto");
    assert.match(result.profile.risk_boundaries.join("\n"), /No provider request/);
    assert.match(result.profile.non_goals.join("\n"), /No Workflow Runner/);
    assert.equal(fs.existsSync(output), true);

    const stored = readJson(output);
    assert.equal(stored.schemaVersion, PROJECT_PROFILE_CONTRACT_VERSION);
    assert.equal(stored.recipe, "small-delta");
    assert.doesNotMatch(JSON.stringify(stored), /[A-Za-z]:[\\/]|\\\\|Bearer|token|secret|api_key/i);

    const loaded = loadProjectProfile(output);
    assert.equal(loaded.profile.recipe, "small-delta");
    assert.match(formatHuman(result), /BaseBrief project profile written/);
    assert.match(HELP_TEXT, /profile-init --repo <target-repo> --output <profile\.json>/);
    assert.equal(commandProfileInit({ repo: repoDir, output: path.join(tempRoot, "command-profile.json") }).command, "profile-init");
  });
});

test("continue --profile applies profile defaults and stays public-safe in JSON", () => {
  withFixtureRepo(({ tempRoot, repoDir }) => {
    const profilePath = path.join(tempRoot, "profile.json");
    runProfileInit({ repo: repoDir, output: profilePath, recipe: "review-heavy" });

    const outputDir = path.join(tempRoot, "continue-profile");
    const result = commandContinue({ profile: profilePath, "output-dir": outputDir });

    assert.equal(result.command, "continue");
    assert.equal(result.status, "ready_for_receiver");
    assert.equal(result.recipe, "review-heavy");
    assert.equal(result.profile, path.resolve(profilePath));
    assert.deepEqual(result.profileDefaultsApplied, {
      repo: true,
      since: false,
      maxFiles: true,
    });

    const meta = readJson(path.join(outputDir, "continuation.meta.json"));
    assert.equal(meta.continuationStatus, "ready_for_receiver");
    assert.equal(meta.outputs.contextPack, "context-pack/");

    const cli = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "continue",
      "--profile",
      profilePath,
      "--output-dir",
      path.join(tempRoot, "cli-continue-profile"),
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });

    assert.equal(cli.status, 0, cli.stderr);
    const parsed = JSON.parse(cli.stdout);
    assert.equal(parsed.command, "continue");
    assert.equal(parsed.recipe, "review-heavy");
    assert.equal(parsed.profile, "[outside-cwd]");
    assert.equal(parsed.outputDir, "[outside-cwd]");
    assert.equal(Object.hasOwn(parsed, "prompt"), false);
    assert.equal(Object.hasOwn(parsed, "next_step"), false);
    assert.doesNotMatch(cli.stdout, /[A-Za-z]:[\\/]|\\\\|Bearer|token|secret|api_key/i);
  });
});

test("continue --profile lets explicit CLI options override profile defaults", () => {
  withFixtureRepo(({ tempRoot, repoDir }) => {
    const profilePath = path.join(tempRoot, "profile.json");
    runProfileInit({ repo: repoDir, output: profilePath, recipe: "review-heavy" });
    const profile = readJson(profilePath);
    profile.defaults.max_files = 20;
    fs.writeFileSync(profilePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");

    const result = commandContinue({
      profile: profilePath,
      repo: repoDir,
      "output-dir": path.join(tempRoot, "override-continue"),
      "max-files": "2",
    });

    assert.equal(result.status, "ready_for_receiver");
    assert.equal(result.profileDefaultsApplied.repo, false);
    assert.equal(result.profileDefaultsApplied.maxFiles, false);
    const keyFiles = readText(path.join(tempRoot, "override-continue", "context-pack", "KEY_FILES.md"));
    const rows = keyFiles.split(/\r?\n/).filter((line) => /^\| `/.test(line));
    assert(rows.length <= 2, `expected override max-files to limit rows, got ${rows.length}`);

    const loaded = loadProjectProfile(profilePath);
    const merged = optionsFromProfile(loaded.path, loaded.profile, { "max-files": "2" });
    assert.equal(merged["max-files"], "2");
  });
});

test("Project Profile Lite rejects sensitive fields, private paths, and unsafe outputs", () => {
  withFixtureRepo(({ tempRoot, repoDir }) => {
    assert.throws(
      () => runProfileInit({ repo: repoDir, output: path.join(tempRoot, ".env", "profile.json") }),
      /must not use an \.env path/,
    );
    const profilePath = path.join(tempRoot, "profile.json");
    runProfileInit({ repo: repoDir, output: profilePath });
    const profile = readJson(profilePath);

    assert.throws(
      () => validateProjectProfile({ ...profile, api_key: "abc" }),
      /unsupported sensitive field/,
    );
    const bearerPrefix = ["Be", "arer"].join("");
    assert.throws(
      () => validateProjectProfile({ ...profile, review_notes: [`${bearerPrefix} abcdefghijklmnop`] }),
      /secret-like values/,
    );
    const privateRepoHint = process.platform === "win32"
      ? ["C:", "Users", "example", "repo"].join(path.win32.sep)
      : path.posix.join(path.posix.sep, "home", "example", "repo");
    assert.throws(
      () => validateProjectProfile({ ...profile, repo_hint: privateRepoHint }),
      /private absolute paths/,
    );
    assert.throws(
      () => validateProjectProfile({ ...profile, defaults: { max_files: 0 } }),
      /integer from 1 to 200/,
    );
  });
});

test("Project Profile Lite keeps existing continue --repo behavior unchanged", () => {
  withFixtureRepo(({ tempRoot, repoDir }) => {
    const result = run([
      "node",
      "scripts/basebrief.js",
      "continue",
      "--repo",
      repoDir,
      "--output-dir",
      path.join(tempRoot, "plain-continue"),
      "--max-files",
      "3",
    ]);

    assert.equal(result.command, "continue");
    assert.equal(result.status, "ready_for_receiver");
    assert.equal(Object.hasOwn(result, "profile"), false);
    assert.match(formatHuman(result), /next_step=copy NEXT_WINDOW_STARTER\.md into the receiver window after review/);
  });
});
