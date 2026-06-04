# BaseBrief Known Limitations

BaseBrief is a small local handoff toolchain. These limitations are intentional unless real usage demonstrates a need to change them.

## Input

- The handoff builder accepts BB9 JSON or Markdown containing the marked structured JSON block.
- Free-form Markdown is not automatically converted into structured handoff data.
- Facts, decisions, risks, and open questions still require human or agent review.

## CLI

- CLI Lite requires explicit input and output paths.
- It does not scan a project automatically, maintain background state, or modify host-tool configuration.
- It is a repository script, not an installed global command or published package.

## Checks

- The artifact checker detects a small set of deterministic publication hazards.
- It cannot prove that an artifact contains no secret, private detail, incorrect fact, or misleading claim.
- Warnings require review even though they keep a zero exit code.

## Seal/Diff

- Seal/Diff compares structured BaseBrief handoff fields.
- It is not a Git diff, source-code audit, project timeline, or release system.
- It does not detect repository changes that are absent from the handoff data.

## Provider Evidence

- Provider-facing behavior follows explicit provider profiles and fallback rules.
- Estimated-cost evidence remains scoped to the tested provider, model, fixtures, and benchmark conditions.
- BaseBrief does not perform billing audits or guarantee cost, cache, or latency outcomes.

## Integrations

- Codex and Claude adapters are file exports, not official integrations or plugins.
- BaseBrief does not automatically send artifacts to an AI tool or provider.
