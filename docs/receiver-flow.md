# Receiver Flow Draft

Receiver Flow Draft is a local draft helper for preparing receiver handoff material before it is shared.

It is not Auto Flow, not an agent runtime, not a provider call, and not a replacement for Receiver Safe Check. It collects mechanical repository facts and writes a draft that must be reviewed by a human.

## Usage

```text
node scripts/basebrief.js receiver-flow --repo <target-repo> --output-dir <dir> --json
```

The command writes three files:

- `flow-summary.json`
- `receiver-check.json`
- `draft-context.md`

The draft always uses:

```text
handoff_status: draft_needs_review
```

Do not share it as a final receiver-ready handoff until it has been reviewed and edited into the normal receiver-ready format.

## What It Collects

- target repository branch
- exact HEAD
- current changed files
- generation time
- state-only Receiver Safe Check config
- draft receiver context for review

If the output directory is inside the target repository and visible to Git, the generated draft files are added to `expected_changed_files`. Ignored output directories stay out of the manifest.

## Safety Boundary

- Does not accept raw shell commands.
- Does not read `.env`, `.env.*`, `.git`, tokens, credentials, or provider keys.
- Does not make provider requests.
- Does not create receiver threads.
- Does not overwrite existing output files.
- Does not write tracked target-repository files.
- Does not set `handoff_status: ready_for_receiver`.

Use `receiver-check` only after the draft and generated config have been reviewed.
