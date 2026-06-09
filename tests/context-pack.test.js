const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { EXPORT_FILES, FILE_EXPORT_CONTRACT_VERSION, runExport } = require("../scripts/basebrief_export");
const { DOCTOR_CONTRACT_VERSION, runDoctor } = require("../scripts/basebrief_doctor");
const { checkArtifacts } = require("../scripts/basebrief_check_artifacts");
const { HELP_TEXT, commandContextPack, commandDoctor, commandExport, commandResume, formatHuman, run } = require("../scripts/basebrief");
const { CONTEXT_PACK_FILES, DEFAULT_MAX_FILES, buildContextPack } = require("../scripts/basebrief_context_pack");

const repoRoot = path.resolve(__dirname, "..");

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function withTempDir(fn) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "basebrief-context-pack-"));
  try {
    return fn(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

test("v2.0.0 Context Pack Lite example and closeout stay public-safe and discoverable", () => {
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const cliLite = readText("docs/cli-lite.md");
  const docsIndex = readText("docs/index.md");
  const testing = readText("docs/testing.md");
  const roadmap = readText("docs/roadmap/basebrief-long-term-baseline.md");
  const closeout = readText("docs/releases/v2.0.0.md");
  const dogfooding = readText("docs/dogfooding/context-pack-lite-fresh-receiver-v2.0.0.md");
  const exampleReadme = readText("examples/context-pack-lite/README.md");
  const exampleManifest = readText("examples/context-pack-lite/MANIFEST.md");
  const exampleReceiverState = readText("examples/context-pack-lite/RECEIVER_STATE.md");

  for (const fileName of [
    "README.md",
    "MANIFEST.md",
    "REPO_MAP.md",
    "KEY_FILES.md",
    "RECENT_DELTA.md",
    "RISK_BOUNDARIES.md",
    "RECEIVER_STATE.md",
    "NEXT_WINDOW_STARTER.md",
  ]) {
    assert.equal(fs.existsSync(path.join(repoRoot, "examples", "context-pack-lite", fileName)), true, fileName);
  }

  assert.match(readme, /context-pack/);
  assert.match(docsIndex, /\.\.\/examples\/context-pack-lite\/README\.md/);
  assert.match(docsIndex, /dogfooding\/context-pack-lite-fresh-receiver-v2\.0\.0\.md/);
  assert.match(englishReadme, /context-pack/);
  assert.match(docsIndex, /releases\/v2\.0\.0\.md/);
  assert.match(cliLite, /context-pack --repo <target-repo> --output-dir <dir>/);
  assert.match(docsIndex, /releases\/v2\.0\.0\.md/);
  assert.match(docsIndex, /dogfooding\/context-pack-lite-fresh-receiver-v2\.0\.0\.md/);
  assert.match(docsIndex, /\.\.\/examples\/context-pack-lite\/README\.md/);
  assert.match(testing, /v2\.0\.0 Context Pack Lite Local Closeout/);
  assert.match(testing, /provider_probe_status=skipped/);
  assert.match(roadmap, /Local v2\.0 Context Pack Lite closeout status/);
  assert.match(roadmap, /v2\.1 Context Pack Check/);

  assert.match(closeout, /v2\.0-A/);
  assert.match(closeout, /v2\.0-B/);
  assert.match(closeout, /v2\.0-C/);
  assert.match(closeout, /No provider request/);
  assert.match(closeout, /No runtime integration/);
  assert.match(closeout, /No schema-v2/);
  assert.match(closeout, /No Workflow Runner/);
  assert.match(closeout, /provider_probe_status=skipped/);

  assert.match(dogfooding, /receiver_task_status: completed/);
  assert.match(dogfooding, /handoff_acceptance: pass/);
  assert.match(dogfooding, /Observed Friction/);
  assert.match(dogfooding, /Next Fix Candidate/);
  assert.match(dogfooding, /No raw private output/);
  assert.match(dogfooding, /No provider request/);

  assert.match(exampleReadme, /Context Pack Lite Example Kit/);
  assert.match(exampleManifest, /Review status: generated/);
  assert.match(exampleReceiverState, /not_available/);
  assert.match(exampleReceiverState, /not_applicable/);

  for (const relativePath of [
    "examples/context-pack-lite",
    "docs/dogfooding/context-pack-lite-fresh-receiver-v2.0.0.md",
    "docs/releases/v2.0.0.md",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
    assert.equal(result.warningCount, 0, relativePath);
  }
});

test("v2.1.0 Context Pack Check closeout stays public-safe and discoverable", () => {
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const docsIndex = readText("docs/index.md");
  const testing = readText("docs/testing.md");
  const roadmap = readText("docs/roadmap/basebrief-long-term-baseline.md");
  const closeout = readText("docs/releases/v2.1.0.md");
  const dogfooding = readText("docs/dogfooding/context-pack-check-acceptance-v2.1.0.md");

  assert.match(docsIndex, /releases\/v2\.1\.0\.md/);
  assert.match(docsIndex, /dogfooding\/context-pack-check-acceptance-v2\.1\.0\.md/);
  assert.match(docsIndex, /releases\/v2\.1\.0\.md/);
  assert.match(docsIndex, /dogfooding\/context-pack-check-acceptance-v2\.1\.0\.md/);
  assert.match(docsIndex, /releases\/v2\.1\.0\.md/);
  assert.match(docsIndex, /dogfooding\/context-pack-check-acceptance-v2\.1\.0\.md/);
  assert.match(testing, /v2\.1\.0 Context Pack Check Local Closeout/);
  assert.match(testing, /context-pack\.too-thick/);
  assert.match(testing, /provider_probe_status=skipped/);
  assert.match(roadmap, /Local v2\.1 Context Pack Check closeout status/);
  assert.match(roadmap, /v2\.2 should prefer One-command Resume \/ New-window Prompt/);

  assert.match(closeout, /v2\.1-A/);
  assert.match(closeout, /v2\.1-B/);
  assert.match(closeout, /v2\.1-C/);
  assert.match(closeout, /No new top-level `context-pack-check` command/);
  assert.match(closeout, /No provider request/);
  assert.match(closeout, /No runtime integration/);
  assert.match(closeout, /No schema-v2/);
  assert.match(closeout, /No Workflow Runner/);
  assert.match(closeout, /provider_probe_status=skipped/);

  assert.match(dogfooding, /clean_pack_status: pass/);
  assert.match(dogfooding, /broken_pack_status: pass/);
  assert.match(dogfooding, /thickness_warning_status: pass/);
  assert.match(dogfooding, /public_safety_passthrough_status: pass/);
  assert.match(dogfooding, /No raw private output/);
  assert.match(dogfooding, /No provider request/);

  for (const relativePath of [
    "docs/releases/v2.1.0.md",
    "docs/dogfooding/context-pack-check-acceptance-v2.1.0.md",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
    assert.equal(result.warningCount, 0, relativePath);
  }
});

test("v2.2.0 Context Pack Resume contract is docs-first and discoverable", () => {
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const docsIndex = readText("docs/index.md");
  const cliLite = readText("docs/cli-lite.md");
  const testing = readText("docs/testing.md");
  const roadmap = readText("docs/roadmap/basebrief-long-term-baseline.md");
  const v2Roadmap = readText("docs/roadmap/basebrief-v2-context-pack-lite.md");
  const plan = readText("docs/releases/v2.2.0-plan.md");
  const closeout = readText("docs/releases/v2.2.0.md");
  const spec = readText("docs/specs/context-pack-resume.md");
  const dogfooding = readText("docs/dogfooding/context-pack-resume-v2.2.0.md");

  assert.match(docsIndex, /releases\/v2\.2\.0-plan\.md/);
  assert.match(docsIndex, /releases\/v2\.2\.0\.md/);
  assert.match(docsIndex, /specs\/context-pack-resume\.md/);
  assert.match(docsIndex, /releases\/v2\.3\.0-plan\.md/);
  assert.match(docsIndex, /specs\/basebrief-format\.md/);
  assert.match(docsIndex, /releases\/v2\.2\.0-plan\.md/);
  assert.match(docsIndex, /releases\/v2\.2\.0\.md/);
  assert.match(docsIndex, /specs\/context-pack-resume\.md/);
  assert.match(docsIndex, /releases\/v2\.3\.0-plan\.md/);
  assert.match(docsIndex, /specs\/basebrief-format\.md/);
  assert.match(docsIndex, /releases\/v2\.2\.0-plan\.md/);
  assert.match(docsIndex, /releases\/v2\.2\.0\.md/);
  assert.match(docsIndex, /specs\/context-pack-resume\.md/);
  assert.match(docsIndex, /dogfooding\/context-pack-resume-v2\.2\.0\.md/);
  assert.match(docsIndex, /releases\/v2\.3\.0-plan\.md/);
  assert.match(docsIndex, /specs\/basebrief-format\.md/);
  assert.match(cliLite, /resume --input <context-pack-dir>/);
  assert.match(testing, /v2\.2\.0 One-command Resume \/ New-window Prompt Plan/);
  assert.match(testing, /v2\.3\.0 BaseBrief Format Plan/);
  assert.match(roadmap, /Local v2\.2 One-command Resume \/ New-window Prompt contract status/);
  assert.match(roadmap, /Local v2\.2 closeout status/);
  assert.match(roadmap, /Local v2\.3 BaseBrief Format contract status/);
  assert.match(v2Roadmap, /v2\.2 One-command Resume \/ New-window Prompt/);
  assert.match(v2Roadmap, /v2\.3 BaseBrief Format/);

  assert.match(plan, /Status: v2\.2-A contract freeze/);
  assert.match(plan, /resume --input <context-pack-dir>/);
  assert.match(plan, /warning-only packs still produce a prompt/);
  assert.match(plan, /error findings stop the command/);
  assert.match(plan, /No provider request/i);
  assert.match(plan, /No runtime integration/i);
  assert.match(plan, /No Workflow Runner/);
  assert.match(plan, /No context-pack generator output change/i);
  assert.match(plan, /No `check --input <dir> --json` top-level shape change/i);
  assert.match(plan, /provider_probe_status=skipped/);

  assert.match(closeout, /v2\.2\.0 One-command Resume \/ New-window Prompt Local Closeout/);
  assert.match(closeout, /v2\.2-A/);
  assert.match(closeout, /v2\.2-B/);
  assert.match(closeout, /v2\.2-C/);
  assert.match(closeout, /Warning-only Context Pack inputs still produce a prompt/);
  assert.match(closeout, /Errored Context Pack inputs stop before prompt output/);
  assert.match(closeout, /No Context Pack Lite generator output change/);
  assert.match(closeout, /No `check --input <dir> --json` top-level shape change/);
  assert.match(closeout, /No Workflow Runner/);
  assert.match(closeout, /provider_probe_status=skipped/);

  assert.match(spec, /Context Pack Resume Spec/);
  assert.match(spec, /Status: v2\.2-A contract freeze/);
  assert.match(spec, /resume --input <context-pack-dir>/);
  assert.match(spec, /warning-only findings/);
  assert.match(spec, /one or more errors: stop before prompt output/);
  assert.match(spec, /basebrief-resume-v1/);
  assert.match(spec, /does not change the checker command's own JSON shape/);

  assert.match(dogfooding, /Context Pack Resume Dogfooding v2\.2\.0/);
  assert.match(dogfooding, /clean_resume_status: pass/);
  assert.match(dogfooding, /warning_only_resume_status: pass/);
  assert.match(dogfooding, /error_resume_status: pass/);
  assert.match(dogfooding, /No raw private output/);
  assert.match(dogfooding, /No Workflow Runner/);
  assert.match(dogfooding, /provider_probe_status=skipped/);

  for (const relativePath of [
    "docs/releases/v2.2.0-plan.md",
    "docs/releases/v2.2.0.md",
    "docs/specs/context-pack-resume.md",
    "docs/dogfooding/context-pack-resume-v2.2.0.md",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
    assert.equal(result.warningCount, 0, relativePath);
  }
});

test("v2.3.0 BaseBrief Format stays docs-first and local-only", () => {
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const docsIndex = readText("docs/index.md");
  const testing = readText("docs/testing.md");
  const roadmap = readText("docs/roadmap/basebrief-long-term-baseline.md");
  const v2Roadmap = readText("docs/roadmap/basebrief-v2-context-pack-lite.md");
  const plan = readText("docs/releases/v2.3.0-plan.md");
  const spec = readText("docs/specs/basebrief-format.md");

  assert.match(docsIndex, /releases\/v2\.3\.0-plan\.md/);
  assert.match(docsIndex, /specs\/basebrief-format\.md/);
  assert.match(docsIndex, /releases\/v2\.3\.0-plan\.md/);
  assert.match(docsIndex, /specs\/basebrief-format\.md/);
  assert.match(docsIndex, /releases\/v2\.3\.0-plan\.md/);
  assert.match(docsIndex, /specs\/basebrief-format\.md/);
  assert.match(testing, /v2\.3\.0 BaseBrief Format Plan/);
  assert.match(roadmap, /Local v2\.3 BaseBrief Format contract status/);
  assert.match(v2Roadmap, /v2\.3 BaseBrief Format/);

  assert.match(plan, /v2\.3\.0 BaseBrief Format Plan/);
  assert.match(plan, /Status: v2\.3-A contract freeze/);
  assert.match(plan, /context-pack\//);
  assert.match(plan, /context-pack\.md/);
  assert.match(plan, /context\.json/);
  assert.match(plan, /No command\./);
  assert.match(plan, /No implementation\./);
  assert.match(plan, /No generator\./);
  assert.match(plan, /No JSON schema file\./);
  assert.match(plan, /No schema-v2\./);
  assert.match(plan, /No Workflow Runner\./);
  assert.match(plan, /provider_probe_status=skipped/);

  assert.match(spec, /BaseBrief Format Spec/);
  assert.match(spec, /Status: v2\.3-A contract freeze/);
  assert.match(spec, /context-pack\//);
  assert.match(spec, /context-pack\.md/);
  assert.match(spec, /context\.json/);
  assert.match(spec, /does not implement a command/);
  assert.match(spec, /schema-v2/);
  assert.match(spec, /Workflow Runner/);
  assert.match(spec, /Context Pack Lite generator output/);

  for (const relativePath of [
    "docs/releases/v2.3.0-plan.md",
    "docs/specs/basebrief-format.md",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
    assert.equal(result.warningCount, 0, relativePath);
  }
});

test("v2.4.0 File-only Export stays docs-first and MCP-friendly only", () => {
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const docsIndex = readText("docs/index.md");
  const cliLite = readText("docs/cli-lite.md");
  const testing = readText("docs/testing.md");
  const v2Roadmap = readText("docs/roadmap/basebrief-v2-context-pack-lite.md");
  const plan = readText("docs/releases/v2.4.0-plan.md");
  const closeout = readText("docs/releases/v2.4.0.md");
  const spec = readText("docs/specs/file-only-export.md");
  const dogfooding = readText("docs/dogfooding/file-only-export-v2.4.0.md");
  const exampleReadme = readText("examples/file-only-export/README.md");
  const exampleManifest = readJson("examples/file-only-export/exports/manifest.json");
  const exampleContext = readJson("examples/file-only-export/exports/context.json");
  const exampleContextPack = readText("examples/file-only-export/exports/context-pack.md");
  const exampleAdapterNotes = readText("examples/file-only-export/exports/adapter-notes.md");

  assert.match(docsIndex, /releases\/v2\.4\.0-plan\.md/);
  assert.match(docsIndex, /releases\/v2\.4\.0\.md/);
  assert.match(docsIndex, /specs\/file-only-export\.md/);
  assert.match(docsIndex, /dogfooding\/file-only-export-v2\.4\.0\.md/);
  assert.match(docsIndex, /\.\.\/examples\/file-only-export\/README\.md/);
  assert.match(readme, /export --input <context-pack-dir> --output-dir <dir>/);
  assert.match(readme, /MCP-friendly means future tool-consumable files/);
  assert.match(docsIndex, /releases\/v2\.4\.0-plan\.md/);
  assert.match(docsIndex, /releases\/v2\.4\.0\.md/);
  assert.match(docsIndex, /specs\/file-only-export\.md/);
  assert.match(docsIndex, /dogfooding\/file-only-export-v2\.4\.0\.md/);
  assert.match(docsIndex, /\.\.\/examples\/file-only-export\/README\.md/);
  assert.match(englishReadme, /export --input <context-pack-dir> --output-dir <dir>/);
  assert.match(englishReadme, /MCP-friendly means future tool-consumable files/);
  assert.match(docsIndex, /releases\/v2\.4\.0-plan\.md/);
  assert.match(docsIndex, /releases\/v2\.4\.0\.md/);
  assert.match(docsIndex, /specs\/file-only-export\.md/);
  assert.match(docsIndex, /dogfooding\/file-only-export-v2\.4\.0\.md/);
  assert.match(docsIndex, /\.\.\/examples\/file-only-export\/README\.md/);
  assert.match(cliLite, /export --input <context-pack-dir> --output-dir <dir>/);
  assert.match(cliLite, /manifest\.json/);
  assert.match(cliLite, /context-pack\.md/);
  assert.match(cliLite, /context\.json/);
  assert.match(cliLite, /adapter-notes\.md/);
  assert.match(cliLite, /dogfooding\/file-only-export-v2\.4\.0\.md/);
  assert.match(cliLite, /\.\.\/examples\/file-only-export\/README\.md/);
  assert.match(testing, /v2\.4\.0 File-only Adapter \/ MCP-friendly Export Plan/);
  assert.match(testing, /File-only Export Dogfooding v2\.4\.0/);
  assert.match(testing, /\.\.\/examples\/file-only-export\/README\.md/);
  assert.match(testing, /receiver_style_acceptance: pass/);
  assert.match(testing, /examples\/file-only-export\/exports\/` is a recommended example output directory/);
  assert.match(v2Roadmap, /v2\.4 File-only Adapter \/ MCP-friendly Export/);
  assert.match(v2Roadmap, /v2\.4-C is dogfooding evidence/);
  assert.match(v2Roadmap, /v2\.4-D is example-kit and contract-wording polish/);
  assert.match(v2Roadmap, /examples\/file-only-export\//);
  assert.match(v2Roadmap, /exports\/manifest\.json/);
  assert.match(v2Roadmap, /exports\/context-pack\.md/);
  assert.match(v2Roadmap, /exports\/context\.json/);
  assert.match(v2Roadmap, /exports\/adapter-notes\.md/);
  assert.match(v2Roadmap, /not an auto-created nested directory/);

  assert.match(plan, /v2\.4\.0 File-only Adapter \/ MCP-friendly Export Plan/);
  assert.match(plan, /Status: v2\.4-A contract freeze/);
  assert.match(plan, /exports\/manifest\.json/);
  assert.match(plan, /exports\/context-pack\.md/);
  assert.match(plan, /exports\/context\.json/);
  assert.match(plan, /exports\/adapter-notes\.md/);
  assert.match(plan, /MCP-friendly means file shapes/);
  assert.match(plan, /No command\./);
  assert.match(plan, /No exporter\./);
  assert.match(plan, /No JSON schema file\./);
  assert.match(plan, /No schema-v2\./);
  assert.match(plan, /No Workflow Runner\./);
  assert.match(plan, /No change to Context Pack Lite generator output\./);
  assert.match(plan, /No change to `check --input <dir> --json` top-level shape\./);
  assert.match(plan, /No change to existing `resume --input <context-pack-dir>` behavior\./);
  assert.match(plan, /provider_probe_status=skipped/);

  assert.match(spec, /File-only Export Spec/);
  assert.match(spec, /Status: v2\.4-A contract freeze/);
  assert.match(spec, /exports\/manifest\.json/);
  assert.match(spec, /exports\/context-pack\.md/);
  assert.match(spec, /exports\/context\.json/);
  assert.match(spec, /exports\/adapter-notes\.md/);
  assert.match(spec, /recommended explicit output directory name/);
  assert.match(spec, /does not create an additional nested `exports\/` directory/);
  assert.match(spec, /Implemented surface:/);
  assert.match(spec, /export --input <context-pack-dir> --output-dir <dir>/);
  assert.match(spec, /MCP-friendly means/);
  assert.match(spec, /MCP server/);
  assert.match(spec, /schema-v2/);
  assert.match(spec, /Workflow Runner/);
  assert.match(spec, /Context Pack Lite generator output/);

  assert.match(closeout, /v2\.4\.0 File-only Adapter \/ MCP-friendly Export Local Closeout/);
  assert.match(closeout, /scripts\/basebrief_export\.js/);
  assert.match(closeout, /export --input <context-pack-dir> --output-dir <dir>/);
  assert.match(closeout, /manifest\.json/);
  assert.match(closeout, /context-pack\.md/);
  assert.match(closeout, /context\.json/);
  assert.match(closeout, /adapter-notes\.md/);
  assert.match(closeout, /examples\/file-only-export\//);
  assert.match(closeout, /recommended example output directory name/);
  assert.match(closeout, /No Context Pack Lite generator output change/);
  assert.match(closeout, /No `check --input <dir> --json` top-level shape change/);
  assert.match(closeout, /No `resume --input <context-pack-dir>` behavior change/);
  assert.match(closeout, /provider_probe_status=skipped/);

  assert.match(dogfooding, /File-only Export Dogfooding v2\.4\.0/);
  assert.match(dogfooding, /clean_export_status: pass/);
  assert.match(dogfooding, /export_bundle_check_status: pass/);
  assert.match(dogfooding, /receiver_style_acceptance: pass/);
  assert.match(dogfooding, /public_safety_status: pass/);
  assert.match(dogfooding, /provider_probe_status=skipped/);
  assert.match(dogfooding, /manifest\.json/);
  assert.match(dogfooding, /context-pack\.md/);
  assert.match(dogfooding, /context\.json/);
  assert.match(dogfooding, /adapter-notes\.md/);
  assert.match(dogfooding, /contract version: `basebrief-file-export-v1`/);
  assert.match(dogfooding, /live repo fact recheck requirement/);
  assert.match(dogfooding, /warning\/error distinction/);
  assert.match(dogfooding, /No provider request/);
  assert.match(dogfooding, /No MCP server/);
  assert.match(dogfooding, /No Workflow Runner/);

  assert.match(exampleReadme, /File-only Export Example Kit/);
  assert.match(exampleReadme, /export --input examples\/context-pack-lite --output-dir examples\/file-only-export\/exports --json/);
  assert.match(exampleReadme, /recommended example output directory name/);
  assert.match(exampleReadme, /directly under the explicit `--output-dir`/);
  assert.match(exampleReadme, /does not create or discover a nested `exports\/` directory/);
  assert.match(exampleReadme, /No provider request/);
  assert.match(exampleReadme, /No MCP server/);
  assert.match(exampleReadme, /No Workflow Runner/);
  assert.match(exampleReadme, /provider_probe_status=skipped/);
  assert.deepEqual(
    fs.readdirSync(path.join(repoRoot, "examples", "file-only-export", "exports")).sort(),
    ["adapter-notes.md", "context-pack.md", "context.json", "manifest.json"],
  );
  assert.equal(exampleManifest.contractVersion, FILE_EXPORT_CONTRACT_VERSION);
  assert.equal(exampleManifest.sourceKind, "context-pack-lite");
  assert.equal(exampleManifest.generatedAt, "2026-06-08T00:00:00.000Z");
  assert.deepEqual(exampleManifest.sourceFiles, Object.values(CONTEXT_PACK_FILES));
  assert.deepEqual(Object.values(exampleManifest.outputFiles).sort(), Object.values(EXPORT_FILES).sort());
  assert.equal(exampleManifest.check.status, "passed");
  assert.equal(exampleManifest.check.errorCount, 0);
  assert.equal(exampleManifest.check.warningCount, 0);
  assert.equal(exampleManifest.review.liveRepoRecheckRequired, true);
  assert.equal(exampleContext.contractVersion, FILE_EXPORT_CONTRACT_VERSION);
  assert.equal(exampleContext.sourceKind, "context-pack-lite");
  assert.equal(exampleContext.generatedAt, "2026-06-08T00:00:00.000Z");
  assert.deepEqual(exampleContext.sourceFiles, Object.values(CONTEXT_PACK_FILES));
  assert.deepEqual(Object.values(exampleContext.outputFiles).sort(), Object.values(EXPORT_FILES).sort());
  assert.equal(exampleContext.check.status, "passed");
  assert.equal(exampleContext.check.errorCount, 0);
  assert.equal(exampleContext.check.warningCount, 0);
  assert.equal(exampleContext.review.liveRepoRecheckRequired, true);
  assert.equal(exampleContext.pack.project, "basebrief-example-repo");
  assert.equal(exampleContext.pack.worktreeStatus, "clean");
  assert.equal(exampleContext.pack.worktreeChangedFiles, "0");
  assert.match(exampleContext.boundaries.join("\n"), /No provider request/);
  assert.match(exampleContext.boundaries.join("\n"), /No MCP server/);
  assert.match(exampleContext.boundaries.join("\n"), /No Workflow Runner/);
  for (const sourceFile of Object.values(CONTEXT_PACK_FILES)) {
    assert.match(exampleContextPack, new RegExp(`BASEBRIEF_SOURCE_FILE: ${sourceFile.replace(".", "\\.")}`));
  }
  assert.match(exampleAdapterNotes, /No provider request/);
  assert.match(exampleAdapterNotes, /No MCP server/);
  assert.match(exampleAdapterNotes, /No Workflow Runner/);
  const publicJson = JSON.stringify({ manifest: exampleManifest, context: exampleContext });
  assert.doesNotMatch(publicJson, /[A-Za-z]:[\\/]/);
  assert.doesNotMatch(publicJson, /\\\\/);
  assert.doesNotMatch(publicJson, /tests\/outputs\/private/);

  for (const relativePath of [
    "docs/releases/v2.4.0-plan.md",
    "docs/releases/v2.4.0.md",
    "docs/specs/file-only-export.md",
    "docs/dogfooding/file-only-export-v2.4.0.md",
    "examples/file-only-export",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
    assert.equal(result.warningCount, 0, relativePath);
  }
});

test("v2.5.0 Context Pack Doctor stays read-only and local-only", () => {
  const readme = readText("README.md");
  const englishReadme = readText("README.en.md");
  const docsIndex = readText("docs/index.md");
  const cliLite = readText("docs/cli-lite.md");
  const testing = readText("docs/testing.md");
  const v2Roadmap = readText("docs/roadmap/basebrief-v2-context-pack-lite.md");
  const plan = readText("docs/releases/v2.5.0-plan.md");
  const closeout = readText("docs/releases/v2.5.0.md");
  const spec = readText("docs/specs/context-pack-doctor.md");
  const dogfooding = readText("docs/dogfooding/context-pack-doctor-v2.5.0.md");
  const dogfooding251 = readText("docs/dogfooding/context-pack-doctor-v2.5.1.md");
  const exampleReadme = readText("examples/context-pack-doctor/README.md");

  assert.match(readme, /doctor --repo <target-repo> --context-pack <context-pack-dir>/);
  assert.match(docsIndex, /releases\/v2\.5\.0-plan\.md/);
  assert.match(docsIndex, /releases\/v2\.5\.0\.md/);
  assert.match(docsIndex, /specs\/context-pack-doctor\.md/);
  assert.match(docsIndex, /dogfooding\/context-pack-doctor-v2\.5\.0\.md/);
  assert.match(docsIndex, /\.\.\/examples\/context-pack-doctor\/README\.md/);
  assert.match(englishReadme, /doctor --repo <target-repo> --context-pack <context-pack-dir>/);
  assert.match(docsIndex, /releases\/v2\.5\.0-plan\.md/);
  assert.match(docsIndex, /releases\/v2\.5\.0\.md/);
  assert.match(docsIndex, /specs\/context-pack-doctor\.md/);
  assert.match(docsIndex, /dogfooding\/context-pack-doctor-v2\.5\.0\.md/);
  assert.match(docsIndex, /\.\.\/examples\/context-pack-doctor\/README\.md/);
  assert.match(docsIndex, /releases\/v2\.5\.0-plan\.md/);
  assert.match(docsIndex, /releases\/v2\.5\.0\.md/);
  assert.match(docsIndex, /specs\/context-pack-doctor\.md/);
  assert.match(docsIndex, /dogfooding\/context-pack-doctor-v2\.5\.0\.md/);
  assert.match(docsIndex, /\.\.\/examples\/context-pack-doctor\/README\.md/);
  assert.match(cliLite, /doctor --repo <target-repo> --context-pack <context-pack-dir>/);
  assert.match(cliLite, /basebrief-doctor-v1/);
  assert.match(cliLite, /read-only/);
  assert.match(cliLite, /dogfooding\/context-pack-doctor-v2\.5\.0\.md/);
  assert.match(cliLite, /\.\.\/examples\/context-pack-doctor\/README\.md/);
  assert.match(testing, /v2\.5\.0 Context Pack Doctor/);
  assert.match(testing, /dogfooding\/context-pack-doctor-v2\.5\.1\.md/);
  assert.match(testing, /doctor_contract_version: basebrief-doctor-v1/);
  assert.match(testing, /post_commit_doctor_status: passed/);
  assert.match(testing, /no_provider_boundary_warning_status: absent/);
  assert.match(testing, /export_bundle_check_status: passed/);
  assert.match(testing, /checker_error_propagation_status: pass/);
  assert.match(testing, /provider_probe_status=skipped/);
  assert.match(v2Roadmap, /v2\.5 Context Pack Doctor/);
  assert.match(v2Roadmap, /state-status` already/);
  assert.match(v2Roadmap, /examples\/context-pack-doctor\//);
  assert.match(v2Roadmap, /no MCP server\/tools/);

  assert.match(plan, /v2\.5\.0 Context Pack Doctor Plan/);
  assert.match(plan, /Status: v2\.5-A contract freeze/);
  assert.match(plan, /basebrief-doctor-v1/);
  assert.match(plan, /doctor\.worktree-dirty/);
  assert.match(plan, /doctor\.pack-head-stale/);
  assert.match(plan, /doctor\.pack-check-error/);
  assert.match(plan, /doctor\.live-recheck-required/);
  assert.match(plan, /No `status` command in v2\.5/);
  assert.match(plan, /No provider request/);
  assert.match(plan, /No MCP server/);
  assert.match(plan, /No MCP tools/);
  assert.match(plan, /No schema-v2/);
  assert.match(plan, /No Workflow Runner/);
  assert.match(plan, /provider_probe_status=skipped/);

  assert.match(spec, /Context Pack Doctor Spec/);
  assert.match(spec, /Status: v2\.5-A contract freeze/);
  assert.match(spec, /basebrief-doctor-v1/);
  assert.match(spec, /"command": "doctor"/);
  assert.match(spec, /"severity": "error\|warning\|info"/);
  assert.match(spec, /doctor\.pack-branch-mismatch/);
  assert.match(spec, /Context Pack Check JSON top-level shape/);
  assert.match(spec, /not a Workflow Runner/);
  assert.match(spec, /MCP tools/);

  assert.match(closeout, /v2\.5\.0 Context Pack Doctor Local Closeout/);
  assert.match(closeout, /scripts\/basebrief_doctor\.js/);
  assert.match(closeout, /doctor --repo <target-repo> --context-pack <context-pack-dir>/);
  assert.match(closeout, /No `status` command in v2\.5/);
  assert.match(closeout, /No `export --input <context-pack-dir> --output-dir <dir>` contract change/);
  assert.match(closeout, /provider_probe_status=skipped/);

  assert.match(dogfooding, /Context Pack Doctor Dogfooding v2\.5\.0/);
  assert.match(dogfooding, /doctor_contract_version: basebrief-doctor-v1/);
  assert.match(dogfooding, /doctor_command_status: warning/);
  assert.match(dogfooding, /checker_error_propagation_status: pass/);
  assert.match(dogfooding, /public_safety_status: pass/);
  assert.match(dogfooding, /read_only_status: pass/);
  assert.match(dogfooding, /provider_probe_status=skipped/);
  assert.match(dogfooding, /No `status` command/);
  assert.match(dogfooding, /No MCP server/);
  assert.match(dogfooding, /No Workflow Runner/);

  assert.match(dogfooding251, /Context Pack Doctor Dogfooding v2\.5\.1/);
  assert.match(dogfooding251, /doctor_contract_version: basebrief-doctor-v1/);
  assert.match(dogfooding251, /post_commit_doctor_status: passed/);
  assert.match(dogfooding251, /post_commit_doctor_warning_count: 0/);
  assert.match(dogfooding251, /post_commit_doctor_findings: doctor\.live-recheck-required/);
  assert.match(dogfooding251, /no_provider_boundary_warning_status: absent/);
  assert.match(dogfooding251, /stale_pack_findings: doctor\.pack-head-stale, doctor\.pack-branch-mismatch, doctor\.live-recheck-required/);
  assert.match(dogfooding251, /broken_pack_findings: doctor\.pack-check-error, doctor\.live-recheck-required/);
  assert.match(dogfooding251, /export_bundle_check_status: passed/);
  assert.match(dogfooding251, /provider_probe_status=skipped/);
  assert.match(dogfooding251, /No `status` command/);
  assert.match(dogfooding251, /No provider request/);
  assert.match(dogfooding251, /No MCP server/);
  assert.match(dogfooding251, /No Workflow Runner/);
  assert.doesNotMatch(dogfooding251, /[A-Za-z]:[\\/]/);
  assert.doesNotMatch(dogfooding251, /\\\\/);

  assert.match(exampleReadme, /Context Pack Doctor Example Kit/);
  assert.match(exampleReadme, /basebrief-doctor-v1/);
  assert.match(exampleReadme, /"repo": "examples\/example-repo"/);
  assert.match(exampleReadme, /"contextPack": "examples\/context-pack-lite"/);
  assert.match(exampleReadme, /doctor\.pack-head-stale/);
  assert.match(exampleReadme, /doctor\.live-recheck-required/);
  assert.match(exampleReadme, /No provider request/);
  assert.match(exampleReadme, /No MCP server/);
  assert.match(exampleReadme, /No MCP tools/);
  assert.match(exampleReadme, /No Workflow Runner/);
  assert.match(exampleReadme, /provider_probe_status=skipped/);
  assert.doesNotMatch(exampleReadme, /[A-Za-z]:[\\/]/);
  assert.doesNotMatch(exampleReadme, /\\\\/);
  assert.doesNotMatch(exampleReadme, /tests\/outputs\/private/);

  for (const relativePath of [
    "docs/releases/v2.5.0-plan.md",
    "docs/releases/v2.5.0.md",
    "docs/specs/context-pack-doctor.md",
    "docs/dogfooding/context-pack-doctor-v2.5.0.md",
    "docs/dogfooding/context-pack-doctor-v2.5.1.md",
    "examples/context-pack-doctor/README.md",
  ]) {
    const result = checkArtifacts({ inputPath: path.join(repoRoot, relativePath) });
    assert.equal(result.status, "passed", relativePath);
    assert.equal(result.errorCount, 0, relativePath);
    assert.equal(result.warningCount, 0, relativePath);
  }
});

test("File-only Export writes four public-safe files from checked context-pack input", () => {
  const tempRoot = path.join(repoRoot, "tests", "outputs", "private", `file-export-${Date.now()}`);
  const repoDir = path.join(tempRoot, "repo");
  const packDir = path.join(tempRoot, "pack");
  const exportDir = path.join(tempRoot, "export");
  const cliDir = path.join(tempRoot, "cli-export");
  const runDir = path.join(tempRoot, "run-export");
  const thickDir = path.join(tempRoot, "thick");
  const warningExportDir = path.join(tempRoot, "warning-export");
  const brokenDir = path.join(tempRoot, "broken");
  const brokenExportDir = path.join(tempRoot, "broken-export");
  const nonEmptyDir = path.join(tempRoot, "nonempty");
  const envDir = path.join(tempRoot, ".env", "file-export");
  try {
    fs.mkdirSync(path.join(repoDir, "docs"), { recursive: true });
    fs.writeFileSync(path.join(repoDir, "README.md"), "# Fixture\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "docs", "index.md"), "# Docs\n", "utf8");
    git(repoDir, ["init"]);
    git(repoDir, ["config", "user.email", "basebrief@example.invalid"]);
    git(repoDir, ["config", "user.name", "BaseBrief File Export Test"]);
    git(repoDir, ["add", "."]);
    git(repoDir, ["commit", "-m", "file export fixture"]);

    buildContextPack({ repoPath: repoDir, outputDir: packDir, maxFiles: 3 });

    const result = runExport({ input: packDir, "output-dir": exportDir });
    assert.equal(result.command, "export");
    assert.equal(result.contractVersion, FILE_EXPORT_CONTRACT_VERSION);
    assert.equal(result.sourceKind, "context-pack-lite");
    assert.equal(result.status, "generated");
    assert.equal(result.check.errorCount, 0);
    assert.equal(result.check.warningCount, 0);
    assert.deepEqual(Object.keys(result.outputFiles).sort(), Object.keys(EXPORT_FILES).sort());
    for (const fileName of Object.values(EXPORT_FILES)) {
      assert.equal(fs.existsSync(path.join(exportDir, fileName)), true, fileName);
    }

    const contextPack = fs.readFileSync(path.join(exportDir, "context-pack.md"), "utf8");
    const manifest = JSON.parse(fs.readFileSync(path.join(exportDir, "manifest.json"), "utf8"));
    const context = JSON.parse(fs.readFileSync(path.join(exportDir, "context.json"), "utf8"));
    const adapterNotes = fs.readFileSync(path.join(exportDir, "adapter-notes.md"), "utf8");
    assert.match(contextPack, /BASEBRIEF_SOURCE_FILE: MANIFEST\.md/);
    assert.match(contextPack, /# BaseBrief Context Pack Manifest/);
    assert.equal(manifest.contractVersion, FILE_EXPORT_CONTRACT_VERSION);
    assert.equal(manifest.sourceKind, "context-pack-lite");
    assert.equal(manifest.check.status, "passed");
    assert.equal(manifest.check.errorCount, 0);
    assert.equal(manifest.check.warningCount, 0);
    assert.equal(context.contractVersion, FILE_EXPORT_CONTRACT_VERSION);
    assert.equal(context.sourceKind, "context-pack-lite");
    assert.deepEqual(context.sourceFiles, Object.values(CONTEXT_PACK_FILES));
    assert.equal(context.outputFiles.contextPack, "context-pack.md");
    assert.equal(context.outputFiles.context, "context.json");
    assert.equal(context.outputFiles.manifest, "manifest.json");
    assert.equal(context.outputFiles.adapterNotes, "adapter-notes.md");
    assert.equal(context.review.liveRepoRecheckRequired, true);
    assert.equal(context.check.errorCount, 0);
    assert.equal(context.check.warningCount, 0);
    assert.doesNotMatch(JSON.stringify(context), /[A-Za-z]:[\\/]/);
    assert.match(adapterNotes, /No provider request/);
    assert.match(adapterNotes, /No MCP server/);
    assert.match(adapterNotes, /No Workflow Runner/);
    assert.match(formatHuman(commandExport({ input: packDir, "output-dir": runDir })), /BaseBrief file-only export written/);
    assert.match(HELP_TEXT, /export --input <context-pack-dir> --output-dir <dir>/);
    assert.equal(run(["node", "scripts/basebrief.js", "export", "--input", packDir, "--output-dir", path.join(tempRoot, "run-via-run")]).command, "export");

    const cli = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "export",
      "--input",
      packDir,
      "--output-dir",
      cliDir,
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(cli.status, 0, cli.stderr);
    const cliResult = JSON.parse(cli.stdout);
    assert.equal(cliResult.command, "export");
    assert.equal(cliResult.input.startsWith("tests"), true);
    assert.equal(cliResult.outputDir.startsWith("tests"), true);
    assert.equal(cliResult.outputFiles.contextPack.startsWith("tests"), true);
    assert.equal(cliResult.check.errorCount, 0);
    assert.equal(cliResult.check.warningCount, 0);

    const checkedExport = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "check",
      "--input",
      exportDir,
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(checkedExport.status, 0, checkedExport.stderr);
    const checkedExportResult = JSON.parse(checkedExport.stdout);
    assert.equal(checkedExportResult.check.status, "passed");
    assert.equal(checkedExportResult.check.errorCount, 0);

    fs.cpSync(packDir, thickDir, { recursive: true });
    fs.appendFileSync(path.join(thickDir, "REPO_MAP.md"), `\n${"D".repeat(21050)}\n`, "utf8");
    const warningOnly = runExport({ input: thickDir, "output-dir": warningExportDir });
    assert.equal(warningOnly.status, "generated");
    assert.equal(warningOnly.check.errorCount, 0);
    assert(warningOnly.check.warningCount > 0);
    const warningManifest = JSON.parse(fs.readFileSync(path.join(warningExportDir, "manifest.json"), "utf8"));
    const warningContext = JSON.parse(fs.readFileSync(path.join(warningExportDir, "context.json"), "utf8"));
    const warningNotes = fs.readFileSync(path.join(warningExportDir, "adapter-notes.md"), "utf8");
    assert(warningManifest.check.findings.some((finding) => finding.ruleId === "context-pack.too-thick"));
    assert(warningContext.check.findings.some((finding) => finding.ruleId === "context-pack.too-thick"));
    assert.match(warningNotes, /context-pack\.too-thick/);

    fs.cpSync(packDir, brokenDir, { recursive: true });
    fs.writeFileSync(
      path.join(brokenDir, "REPO_MAP.md"),
      fs.readFileSync(path.join(brokenDir, "REPO_MAP.md"), "utf8").replace(/^Trust: .+$/m, "Trust: certain"),
      "utf8",
    );
    assert.throws(
      () => runExport({ input: brokenDir, "output-dir": brokenExportDir }),
      /Context pack check failed: errors=1/,
    );
    assert.equal(fs.existsSync(brokenExportDir), false);

    fs.mkdirSync(nonEmptyDir, { recursive: true });
    fs.writeFileSync(path.join(nonEmptyDir, "occupied.txt"), "busy\n", "utf8");
    assert.throws(
      () => runExport({ input: packDir, "output-dir": nonEmptyDir }),
      /output directory already exists and is not empty/,
    );
    assert.throws(
      () => runExport({ input: packDir, "output-dir": envDir }),
      /must not use an \.env path/,
    );
    assert.throws(
      () => runExport({ input: path.join(repoDir, ".git"), "output-dir": path.join(tempRoot, "bad-git") }),
      /must not use a \.git path/,
    );
    assert.throws(
      () => runExport({ input: path.join(tempRoot, "missing-pack"), "output-dir": path.join(tempRoot, "bad") }),
      /Context pack input does not exist/,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Context Pack Doctor reports conservative read-only diagnostics", () => {
  const tempRoot = path.join(repoRoot, "tests", "outputs", "private", `context-pack-doctor-${Date.now()}`);
  const repoDir = path.join(tempRoot, "repo");
  const packDir = path.join(tempRoot, "pack");
  const stalePackDir = path.join(tempRoot, "stale-pack");
  const dirtyPackDir = path.join(tempRoot, "dirty-pack");
  const brokenPackDir = path.join(tempRoot, "broken-pack");
  try {
    fs.mkdirSync(path.join(repoDir, "docs"), { recursive: true });
    fs.writeFileSync(path.join(repoDir, "README.md"), "# Doctor Fixture\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "docs", "index.md"), "# Docs\n", "utf8");
    git(repoDir, ["init"]);
    git(repoDir, ["config", "user.email", "basebrief@example.invalid"]);
    git(repoDir, ["config", "user.name", "BaseBrief Doctor Test"]);
    git(repoDir, ["add", "."]);
    git(repoDir, ["commit", "-m", "doctor fixture"]);

    buildContextPack({ repoPath: repoDir, outputDir: packDir, maxFiles: 4 });

    const clean = runDoctor({ repo: repoDir, "context-pack": packDir });
    assert.equal(clean.command, "doctor");
    assert.equal(clean.contractVersion, DOCTOR_CONTRACT_VERSION);
    assert.equal(clean.status, "passed");
    assert.equal(clean.summary.errorCount, 0);
    assert.equal(clean.summary.warningCount, 0);
    assert.equal(clean.summary.infoCount, 1);
    assert(clean.findings.some((finding) => finding.ruleId === "doctor.live-recheck-required"));
    assert.equal(clean.findings.some((finding) => finding.ruleId === "doctor.no-provider-boundary"), false);

    fs.cpSync(packDir, stalePackDir, { recursive: true });
    fs.writeFileSync(path.join(repoDir, "README.md"), "# Doctor Fixture\n\nUpdated.\n", "utf8");
    git(repoDir, ["add", "."]);
    git(repoDir, ["commit", "-m", "doctor stale fixture"]);
    const stale = runDoctor({ repo: repoDir, "context-pack": stalePackDir });
    assert.equal(stale.status, "warning");
    assert(stale.findings.some((finding) => finding.ruleId === "doctor.pack-head-stale"));

    buildContextPack({ repoPath: repoDir, outputDir: dirtyPackDir, maxFiles: 4 });
    fs.writeFileSync(path.join(repoDir, "dirty-note.md"), "dirty\n", "utf8");
    const dirty = runDoctor({ repo: repoDir, "context-pack": dirtyPackDir });
    assert.equal(dirty.status, "warning");
    assert(dirty.findings.some((finding) => finding.ruleId === "doctor.worktree-dirty"));

    fs.cpSync(dirtyPackDir, brokenPackDir, { recursive: true });
    fs.rmSync(path.join(brokenPackDir, "KEY_FILES.md"));
    const broken = runDoctor({ repo: repoDir, "context-pack": brokenPackDir });
    assert.equal(broken.status, "failed");
    assert(broken.findings.some((finding) => finding.ruleId === "doctor.pack-check-error"));
    assert(broken.findings.some((finding) => finding.evidence.includes("context-pack.missing-file")));

    const boundary = runDoctor({ repo: repoDir, "context-pack": dirtyPackDir });
    assert.equal(boundary.findings.some((finding) => finding.ruleId === "doctor.no-provider-boundary"), false);
    const missingBoundaryDir = path.join(tempRoot, "missing-boundary-pack");
    fs.cpSync(dirtyPackDir, missingBoundaryDir, { recursive: true });
    fs.writeFileSync(
      path.join(missingBoundaryDir, "RISK_BOUNDARIES.md"),
      fs.readFileSync(path.join(missingBoundaryDir, "RISK_BOUNDARIES.md"), "utf8").replace(/^- No Workflow Runner\.\r?\n/m, ""),
      "utf8",
    );
    fs.writeFileSync(
      path.join(missingBoundaryDir, "NEXT_WINDOW_STARTER.md"),
      fs.readFileSync(path.join(missingBoundaryDir, "NEXT_WINDOW_STARTER.md"), "utf8").replace(/^- No Workflow Runner\.\r?\n/m, ""),
      "utf8",
    );
    const missingBoundary = runDoctor({ repo: repoDir, "context-pack": missingBoundaryDir });
    assert(missingBoundary.findings.some((finding) => finding.ruleId === "doctor.no-provider-boundary"));

    assert.match(formatHuman(commandDoctor({ repo: repoDir, "context-pack": dirtyPackDir })), /BaseBrief doctor warning/);
    assert.match(HELP_TEXT, /doctor --repo <target-repo> --context-pack <context-pack-dir>/);
    assert.equal(run(["node", "scripts/basebrief.js", "doctor", "--repo", repoDir, "--context-pack", dirtyPackDir]).command, "doctor");

    const cli = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "doctor",
      "--repo",
      repoDir,
      "--context-pack",
      dirtyPackDir,
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(cli.status, 0, cli.stderr);
    const cliResult = JSON.parse(cli.stdout);
    assert.equal(cliResult.command, "doctor");
    assert.equal(cliResult.contractVersion, DOCTOR_CONTRACT_VERSION);
    assert.equal(cliResult.repo.startsWith("tests"), true);
    assert.equal(cliResult.contextPack.startsWith("tests"), true);
    assert.doesNotMatch(JSON.stringify(cliResult), /[A-Za-z]:[\\/]/);
    assert.doesNotMatch(JSON.stringify(cliResult), /\\\\/);

    assert.throws(
      () => runDoctor({ repo: repoDir, "context-pack": path.join(tempRoot, ".env", "pack") }),
      /must not use an \.env path/,
    );
    assert.throws(
      () => runDoctor({ repo: path.join(repoDir, ".git"), "context-pack": dirtyPackDir }),
      /must not use a \.git path/,
    );
    assert.throws(
      () => runDoctor({ repo: repoDir, "context-pack": path.join(tempRoot, "missing-pack") }),
      /Context pack input does not exist/,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Context Pack Lite writes seven reviewable artifacts without expanding scope", () => {
  const repoDir = path.join(repoRoot, "tests", "outputs", "private", `context-pack-repo-${Date.now()}`);
  const outputDir = path.join(repoRoot, "tests", "outputs", "private", `context-pack-output-${Date.now()}`);
  const cliOutputDir = path.join(repoRoot, "tests", "outputs", "private", `context-pack-cli-${Date.now()}`);
  const commandOutputDir = path.join(repoRoot, "tests", "outputs", "private", `context-pack-command-${Date.now()}`);
  const nonEmptyDir = path.join(repoRoot, "tests", "outputs", "private", `context-pack-nonempty-${Date.now()}`);
  const nonGitDir = path.join(repoRoot, "tests", "outputs", "private", `context-pack-nongit-${Date.now()}`);
  try {
    fs.mkdirSync(path.join(repoDir, "docs"), { recursive: true });
    fs.mkdirSync(path.join(repoDir, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(repoDir, "README.md"), "# Fixture\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "docs", "index.md"), "# Docs\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "scripts", "basebrief.js"), "console.log('fixture');\n", "utf8");
    git(repoDir, ["init"]);
    git(repoDir, ["config", "user.email", "basebrief@example.invalid"]);
    git(repoDir, ["config", "user.name", "BaseBrief Context Pack Test"]);
    git(repoDir, ["add", "."]);
    git(repoDir, ["commit", "-m", "context fixture"]);
    fs.writeFileSync(path.join(repoDir, "notes.md"), "dirty note\n", "utf8");

    const result = buildContextPack({ repoPath: repoDir, outputDir, maxFiles: 2 });
    assert.equal(result.command, "context-pack");
    assert.equal(result.status, "generated");
    assert.equal(result.limits.maxFiles, 2);
    assert.equal(result.limits.includedFiles, 2);
    assert.equal(result.limits.truncated, true);
    assert.equal(Object.keys(result.outputFiles).length, 7);
    for (const fileName of Object.values(CONTEXT_PACK_FILES)) {
      assert.equal(fs.existsSync(path.join(outputDir, fileName)), true, fileName);
    }
    const manifest = fs.readFileSync(path.join(outputDir, "MANIFEST.md"), "utf8");
    const riskBoundaries = fs.readFileSync(path.join(outputDir, "RISK_BOUNDARIES.md"), "utf8");
    const receiverState = fs.readFileSync(path.join(outputDir, "RECEIVER_STATE.md"), "utf8");
    const recentDelta = fs.readFileSync(path.join(outputDir, "RECENT_DELTA.md"), "utf8");
    const starter = fs.readFileSync(path.join(outputDir, "NEXT_WINDOW_STARTER.md"), "utf8");
    assert.match(manifest, /Review status: generated/);
    assert.match(manifest, /Worktree status: dirty/);
    assert.match(receiverState, /\.basebrief\/state\.json`: not_available/);
    assert.match(receiverState, /\.basebrief\/delta-baseline\.json`: not_available/);
    assert.match(recentDelta, /notes\.md/);
    assert.match(riskBoundaries, /No Workflow Runner\./);
    assert.match(starter, /Continuation rules:/);
    assert.match(starter, /Treat this pack as inherited context/);
    assert.match(starter, /Use the latest user instruction as the real current goal/);
    assert.doesNotMatch(starter, /v2\.0 Context Pack Lite implementation slice/);
    assert.match(starter, /No provider/);
    assert.match(starter, /schema-v2/);
    assert.match(starter, /No Workflow Runner\./);

    const cli = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "context-pack",
      "--repo",
      repoDir,
      "--output-dir",
      cliOutputDir,
      "--max-files",
      "2",
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(cli.status, 0, cli.stderr);
    const cliResult = JSON.parse(cli.stdout);
    assert.equal(cliResult.command, "context-pack");
    assert.equal(cliResult.repo.startsWith("tests"), true);
    assert.equal(cliResult.outputDir.startsWith("tests"), true);
    assert.equal(cliResult.outputFiles.manifest.startsWith("tests"), true);
    assert.equal(cliResult.git.worktree_status, "dirty");
    assert.equal(cliResult.limits.maxFiles, 2);

    assert.match(formatHuman(commandContextPack({ repo: repoDir, "output-dir": commandOutputDir })), /BaseBrief context pack written/);
    assert.match(HELP_TEXT, /context-pack --repo <target-repo> --output-dir <dir>/);

    fs.mkdirSync(nonEmptyDir, { recursive: true });
    fs.writeFileSync(path.join(nonEmptyDir, "existing.md"), "occupied\n", "utf8");
    assert.throws(
      () => buildContextPack({ repoPath: repoDir, outputDir: nonEmptyDir }),
      /output directory already exists and is not empty/,
    );
    assert.throws(
      () => buildContextPack({ repoPath: repoDir, outputDir: path.join(repoDir, ".env", "context-pack") }),
      /must not use an \.env path/,
    );
    fs.mkdirSync(nonGitDir, { recursive: true });
    assert.throws(
      () => buildContextPack({ repoPath: nonGitDir, outputDir: path.join(nonGitDir, "out") }),
      /target repository root|not a git repository|failed/,
    );
    assert.throws(
      () => buildContextPack({ repoPath: repoDir, outputDir: path.join(repoRoot, "tests", "outputs", "private", `context-pack-bad-${Date.now()}`), maxFiles: "0" }),
      /--max-files must be a positive integer/,
    );
    assert.equal(DEFAULT_MAX_FILES, 80);
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.rmSync(cliOutputDir, { recursive: true, force: true });
    fs.rmSync(commandOutputDir, { recursive: true, force: true });
    fs.rmSync(nonEmptyDir, { recursive: true, force: true });
    fs.rmSync(nonGitDir, { recursive: true, force: true });
  }
});

test("Context Pack Check validates clean and broken pack directories through existing check surface", () => {
  const tempRoot = path.join(repoRoot, "tests", "outputs", "private", `context-pack-check-${Date.now()}`);
  const repoDir = path.join(tempRoot, "repo");
  const packDir = path.join(tempRoot, "pack");
  const cliPackDir = path.join(tempRoot, "cli-pack");
  try {
    fs.mkdirSync(path.join(repoDir, "docs"), { recursive: true });
    fs.mkdirSync(path.join(repoDir, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(repoDir, "README.md"), "# Fixture\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "docs", "index.md"), "# Docs\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "scripts", "safe.js"), "const safe = true;\n", "utf8");
    git(repoDir, ["init"]);
    git(repoDir, ["config", "user.email", "basebrief@example.invalid"]);
    git(repoDir, ["config", "user.name", "BaseBrief Context Pack Check Test"]);
    git(repoDir, ["add", "."]);
    git(repoDir, ["commit", "-m", "context pack check fixture"]);

    buildContextPack({ repoPath: repoDir, outputDir: packDir, maxFiles: 3 });
    const clean = checkArtifacts({ inputPath: packDir });
    assert.equal(clean.status, "passed");
    assert.equal(clean.errorCount, 0);
    assert.equal(clean.warningCount, 0);
    assert.equal(clean.findings.some((finding) => finding.ruleId.startsWith("context-pack.")), false);

    const cli = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "check",
      "--input",
      packDir,
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(cli.status, 0, cli.stderr);
    const cliResult = JSON.parse(cli.stdout);
    assert.equal(cliResult.command, "check");
    assert.equal(cliResult.check.status, "passed");
    assert.equal(cliResult.check.errorCount, 0);
    assert.equal(cliResult.check.findings.some((finding) => finding.ruleId.startsWith("context-pack.")), false);

    const brokenCases = [
      {
        name: "missing-file",
        mutate(dir) {
          fs.rmSync(path.join(dir, "KEY_FILES.md"));
        },
        ruleId: "context-pack.missing-file",
      },
      {
        name: "missing-metadata",
        mutate(dir) {
          const filePath = path.join(dir, "REPO_MAP.md");
          fs.writeFileSync(filePath, fs.readFileSync(filePath, "utf8").replace(/^Trust: .+\r?\n/m, ""), "utf8");
        },
        ruleId: "context-pack.missing-metadata",
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
        name: "missing-manifest-field",
        mutate(dir) {
          const filePath = path.join(dir, "MANIFEST.md");
          fs.writeFileSync(filePath, fs.readFileSync(filePath, "utf8").replace(/^- Branch: .+\r?\n/m, ""), "utf8");
        },
        ruleId: "context-pack.missing-manifest-field",
      },
      {
        name: "missing-risk-boundary",
        mutate(dir) {
          const filePath = path.join(dir, "RISK_BOUNDARIES.md");
          fs.writeFileSync(filePath, fs.readFileSync(filePath, "utf8").replace(/^- No provider request\.\r?\n/m, ""), "utf8");
        },
        ruleId: "context-pack.missing-risk-boundary",
      },
      {
        name: "missing-receiver-state-semantics",
        mutate(dir) {
          const filePath = path.join(dir, "RECEIVER_STATE.md");
          const content = fs.readFileSync(filePath, "utf8")
            .replace(/not_available/g, "missing")
            .replace(/not_applicable/g, "absent")
            .replace(/needs-review/g, "review-needed");
          fs.writeFileSync(filePath, content, "utf8");
        },
        ruleId: "context-pack.missing-receiver-state-semantics",
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
      {
        name: "secret-like",
        mutate(dir) {
          const fakeSecret = ["sk", "1234567890abcdef"].join("-");
          const fakeTokenLabel = ["to", "ken"].join("");
          fs.appendFileSync(path.join(dir, "MANIFEST.md"), `\n- Debug ${fakeTokenLabel}: ${fakeSecret}\n`, "utf8");
        },
        ruleId: "secret.sk",
      },
    ];

    for (const testCase of brokenCases) {
      const brokenDir = path.join(tempRoot, testCase.name);
      fs.cpSync(packDir, brokenDir, { recursive: true });
      testCase.mutate(brokenDir);
      const result = checkArtifacts({ inputPath: brokenDir });
      assert.equal(result.status, "failed", testCase.name);
      assert(
        result.findings.some((finding) => finding.ruleId === testCase.ruleId),
        `${testCase.name} must report ${testCase.ruleId}`,
      );
    }

    const thickDir = path.join(tempRoot, "too-thick");
    fs.cpSync(packDir, thickDir, { recursive: true });
    fs.appendFileSync(path.join(thickDir, "REPO_MAP.md"), `\n${"A".repeat(21050)}\n`, "utf8");
    const thick = checkArtifacts({ inputPath: thickDir });
    assert.equal(thick.status, "passed");
    assert.equal(thick.errorCount, 0);
    assert(thick.warningCount > 0);
    assert(thick.findings.some((finding) => finding.ruleId === "context-pack.too-thick"));

    fs.cpSync(packDir, cliPackDir, { recursive: true });
    const cliMapPath = path.join(cliPackDir, "REPO_MAP.md");
    fs.writeFileSync(
      cliMapPath,
      fs.readFileSync(cliMapPath, "utf8").replace(/^Trust: .+$/m, "Trust: certain"),
      "utf8",
    );
    const failedCli = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "check",
      "--input",
      cliPackDir,
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.notEqual(failedCli.status, 0);
    const failedCliResult = JSON.parse(failedCli.stdout);
    assert.equal(failedCliResult.check.status, "failed");
    assert(failedCliResult.check.findings.some((finding) => finding.ruleId === "context-pack.invalid-metadata"));

    const thickCliDir = path.join(tempRoot, "cli-too-thick");
    fs.cpSync(packDir, thickCliDir, { recursive: true });
    fs.appendFileSync(path.join(thickCliDir, "REPO_MAP.md"), `\n${"B".repeat(21050)}\n`, "utf8");
    const thickCli = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "check",
      "--input",
      thickCliDir,
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(thickCli.status, 0, thickCli.stderr);
    const thickCliResult = JSON.parse(thickCli.stdout);
    assert.equal(thickCliResult.check.status, "passed");
    assert.equal(thickCliResult.check.errorCount, 0);
    assert(thickCliResult.check.warningCount > 0);
    assert(thickCliResult.check.findings.some((finding) => finding.ruleId === "context-pack.too-thick"));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Context Pack Resume prints copyable prompt from checked pack input", () => {
  const tempRoot = path.join(repoRoot, "tests", "outputs", "private", `context-pack-resume-${Date.now()}`);
  const repoDir = path.join(tempRoot, "repo");
  const packDir = path.join(tempRoot, "pack");
  const thickDir = path.join(tempRoot, "thick");
  const brokenDir = path.join(tempRoot, "broken");
  try {
    fs.mkdirSync(path.join(repoDir, "docs"), { recursive: true });
    fs.writeFileSync(path.join(repoDir, "README.md"), "# Fixture\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "docs", "index.md"), "# Docs\n", "utf8");
    git(repoDir, ["init"]);
    git(repoDir, ["config", "user.email", "basebrief@example.invalid"]);
    git(repoDir, ["config", "user.name", "BaseBrief Resume Test"]);
    git(repoDir, ["add", "."]);
    git(repoDir, ["commit", "-m", "resume fixture"]);

    buildContextPack({ repoPath: repoDir, outputDir: packDir, maxFiles: 3 });
    const result = commandResume({ input: packDir });
    assert.equal(result.command, "resume");
    assert.equal(result.contractVersion, "basebrief-resume-v1");
    assert.equal(result.status, "ready");
    assert.equal(result.check.errorCount, 0);
    assert.match(result.prompt, /BaseBrief Resume Prompt/);
    assert.match(result.prompt, /NEXT_WINDOW_STARTER\.md/);
    assert.match(result.prompt, /Recheck current cwd, git branch, HEAD, and worktree status/);
    assert.match(result.prompt, /check_findings: none/);
    assert.match(formatHuman(result), /BaseBrief Resume Prompt/);
    assert.match(HELP_TEXT, /resume --input <context-pack-dir>/);
    assert.equal(run(["node", "scripts/basebrief.js", "resume", "--input", packDir]).command, "resume");

    const cli = spawnSync(process.execPath, [
      "scripts/basebrief.js",
      "resume",
      "--input",
      packDir,
      "--json",
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(cli.status, 0, cli.stderr);
    const cliResult = JSON.parse(cli.stdout);
    assert.equal(cliResult.command, "resume");
    assert.equal(cliResult.input.startsWith("tests"), true);
    assert.match(cliResult.prompt, /tests\/outputs\/private\/context-pack-resume-/);
    assert.doesNotMatch(cliResult.prompt, /[A-Za-z]:[\\/]/);

    fs.cpSync(packDir, thickDir, { recursive: true });
    fs.appendFileSync(path.join(thickDir, "REPO_MAP.md"), `\n${"C".repeat(21050)}\n`, "utf8");
    const warningOnly = commandResume({ input: thickDir });
    assert.equal(warningOnly.status, "ready");
    assert.equal(warningOnly.check.errorCount, 0);
    assert(warningOnly.check.warningCount > 0);
    assert.match(warningOnly.prompt, /context-pack\.too-thick/);

    fs.cpSync(packDir, brokenDir, { recursive: true });
    fs.writeFileSync(
      path.join(brokenDir, "REPO_MAP.md"),
      fs.readFileSync(path.join(brokenDir, "REPO_MAP.md"), "utf8").replace(/^Trust: .+$/m, "Trust: certain"),
      "utf8",
    );
    assert.throws(
      () => commandResume({ input: brokenDir }),
      /Context pack check failed: errors=1/,
    );
    assert.throws(
      () => commandResume({ input: packDir, output: path.join(tempRoot, "resume.md") }),
      /stdout only/,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
