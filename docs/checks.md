# BaseBrief Checks

`basebrief_check_artifacts.js` is a small local checker for generated BaseBrief artifacts. It is a deterministic quality gate, not a full security audit, secret scanner, or compliance tool.

Run it with an explicit file or directory:

```text
node scripts/basebrief_check_artifacts.js --input examples/adapter-codex-task.md
node scripts/basebrief_check_artifacts.js --input examples/adapter-codex-task.md --json
```

The checker never scans the whole repository by default. Directory input scans only `.md`, `.json`, and `.txt` files, while skipping generated or dependency directories such as `.git`, `node_modules`, `dist`, `.cache`, `coverage`, and `private`.

## Result Shape

`--json` returns a stable summary:

```json
{
  "status": "passed",
  "errorCount": 0,
  "warningCount": 0,
  "findings": []
}
```

Errors make the command exit nonzero. Warnings keep the command exit code at zero.

## Rules

Errors:

- secret-like strings, including `sk-` style values, bearer-token shaped values, and obvious key/token/secret assignments
- private absolute paths, including Windows drive paths and Unix home paths
- provider-only sidecar, cache PAD, or cache-only prompt text inside adapter outputs
- missing risk boundaries in handoff or adapter artifacts

Warnings:

- missing open questions in handoff or adapter artifacts
- provider-specific evidence written as provider-general savings, proof, or billing-audit language

## Receiver Lint

v1.5 extends the same checker with receiver-specific rules for explicit
receiver artifacts. It does not scan the whole repository for receiver
keywords.

Receiver-specific checks only trigger for:

- receiver result JSON with
  `schemaVersion: basebrief-receiver-check-result-v1`
- starter-style receiver Markdown with machine fields plus starter report
  sections such as `receiver_entry_task`,
  `source_window_inherited_facts`, and `receiver_window_rechecks`
- delta-style receiver Markdown with machine fields plus delta report sections
  such as `blocking_or_repair_notes`, `live_repo_state`, and
  `inherited_fact_differences`

Receiver errors:

- `receiver.missing-machine-field`
- `receiver.missing-report-section`
- `receiver.missing-human-anchor`
- `receiver.missing-fact-layer`
- `receiver.invalid-result-consistency`

Receiver warnings:

- `receiver.missing-difference-semantics`
- `receiver.missing-drift-semantics`

The receiver checker keeps `difference_found` as a completed verification
result, not an agent failure.

## Receiver Lint Fixtures

v1.6 adds a public fixture pack for learning the receiver rule families:

```text
examples/receiver/lint/
```

Use `clean-pass-receiver-report.md` as the copyable clean reference. The other
fixtures intentionally trigger one primary error or warning family so authors
can compare a broken shape with the clean one before copying a report.

v1.7 adds a repair pack for moving from a rule ID to a fixed public-safe shape:

```text
examples/receiver/lint/repair/
```

Use the repair pack when a fixture explains what failed but you need the
smallest correct replacement shape. v1.8 records public-safe dogfooding evidence
for the fixture and repair packs in
`docs/dogfooding/delta-receiver-lint-dogfooding-v1.8.md`.

Example:

```text
node scripts/basebrief.js check --input examples/receiver/lint/clean-pass-receiver-report.md --json
node scripts/basebrief.js check --input examples/receiver/lint/delta-missing-section-receiver-report.md --json
node scripts/basebrief.js check --input examples/receiver/lint/repair/fixed-starter-report.md --json
```

## Receiver Lint Adoption Path

Use this path when a public receiver author is unsure what to open next:

1. Route through `docs/receiver-usage-pack.md` and
   `examples/receiver/usage-pack/README.md`.
2. Use `examples/receiver/lint/README.md` to learn the failing or warning rule.
3. Use `examples/receiver/lint/repair/README.md` to find the fixed reference.
4. Copy the final report shape from the existing receiver examples:
   `examples/receiver/delta-report-pass/README.md`,
   `examples/receiver/delta-report-difference-found/README.md`,
   `examples/receiver/blocked/README.md`,
   `examples/receiver/language-routing/README.md`, or
   `examples/golden-path/`.

The v1.9 discoverability/adoption plan lives in
`docs/releases/v1.9.0-plan.md`. It does not add checker behavior, rule
families, schemas, CLI commands, or command output changes.

## Boundary

Use this checker on public examples and generated handoff or adapter artifacts before sharing them. It can catch common BaseBrief publication mistakes, but it cannot prove that an artifact contains no secret, no private project detail, or no misleading claim.
