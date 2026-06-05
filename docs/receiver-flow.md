# Receiver Flow Draft

Receiver Flow Draft is a local draft helper for preparing receiver handoff material before it is shared.

It is not Auto Flow, not an agent runtime, not a provider call, and not a replacement for Receiver Safe Check. It collects mechanical repository facts and writes a draft that must be reviewed by a human.

## Usage

```text
node scripts/basebrief.js receiver-flow --repo <target-repo> --output-dir <dir> --json
node scripts/basebrief.js receiver-flow --repo <target-repo> --output-dir <dir> --guided --json
node scripts/basebrief.js receiver-flow --repo <target-repo> --output-dir <dir> --extract --source <draft-or-context.md> --json
```

The command writes three default files:

- `flow-summary.json`
- `receiver-check.json`
- `draft-context.md`
- `extract-candidates.json` only when `--extract` is used

With `--guided`, the command also records six human-provided draft fields:
`current_goal`, `verified_facts`, `confirmed_decisions`, `risk_boundaries`,
`receiver_entry_task`, and `open_questions`. Empty guided answers are written as
`[EMPTY]`.

With `--extract`, the command reads only the explicit local Markdown file passed
with `--source`. It copies recognized sections into candidate fields marked
`[CANDIDATE]`, writes missing fields as `[NEEDS_REVIEW]`, and keeps the draft
blocked until a human review rewrites those markers.

The draft always uses:

```text
handoff_status: draft_needs_review
```

Do not share it as a final receiver-ready handoff until it has been reviewed and edited into the normal receiver-ready format.

After `receiver-flow --guided`, the local review gate is:

```text
node scripts/basebrief.js review-draft --draft <draft-context.md> --output <receiver-ready.md> --json
```

`review-draft` is not automatic promotion. It only accepts a draft whose human
fields have been explicitly reviewed, whose checklist lines are checked, and
whose blocked markers are gone.

After a reviewed `receiver-ready.md` exists, `v0.6.0` can store local continuity
state with:

```text
node scripts/basebrief.js state-init --repo <target-repo> --source <receiver-ready.md> --json
node scripts/basebrief.js state-read --repo <target-repo> --json
```

Project state is stored at `.basebrief/state.json`. It is local continuity
state, not Auto Flow and not a receiver thread.

## What It Collects

- target repository branch
- exact HEAD
- current changed files
- generation time
- state-only Receiver Safe Check config
- draft receiver context for review
- optional human-provided fields when `--guided` is used
- optional extracted candidate fields when `--extract --source <file>` is used

If the output directory is inside the target repository and visible to Git, the generated draft files are added to `expected_changed_files`. Ignored output directories stay out of the manifest.

## Safety Boundary

- Does not accept raw shell commands.
- Does not read `.env`, `.env.*`, `.git`, tokens, credentials, or provider keys.
- Does not make provider requests.
- Does not create receiver threads.
- Does not promote guided or extracted content to `ready_for_receiver`.
- Does not run extract mode unless `--extract --source <file>` is explicit.
- Does not infer extracted fields without an explicit `--source` file.
- Does not overwrite existing output files.
- Does not write tracked target-repository files.
- Does not set `handoff_status: ready_for_receiver`.
- Project state requires a separate reviewed `receiver-ready.md` source.

Use `receiver-check` only after the draft and generated config have been reviewed.
