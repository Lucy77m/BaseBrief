# Context Pack Lite Spec

Status: planning baseline

Context Pack Lite is the planned v2.0 artifact layer for BaseBrief. It compiles
local repository context into a small set of Markdown files that can be reviewed
and handed to a new AI window or coding agent.

This spec defines the artifact contract only. It does not define a JSON schema,
new CLI command, provider request, runtime behavior, MCP server, plugin, IDE
integration, or Workflow Runner.

## Pack Directory

Recommended output:

```text
.basebrief/out/context-pack/
  MANIFEST.md
  REPO_MAP.md
  KEY_FILES.md
  RECENT_DELTA.md
  RISK_BOUNDARIES.md
  RECEIVER_STATE.md
  NEXT_WINDOW_STARTER.md
```

The directory may be copied, trimmed, or reviewed before it is handed to a new
window. A missing input should create a marked gap, not a fabricated summary.

Minimal generator command:

```text
node scripts/basebrief.js context-pack --repo <target-repo> --output-dir <dir> [--since <commit>] [--max-files <n>] [--json]
```

The generator is rule-based and file-based. It writes the Markdown artifact
set above and reports a public-safe summary; it does not define schema-v2,
provider behavior, runtime behavior, plugin surfaces, MCP, IDE integration, or
Workflow Runner behavior.

## Shared Metadata

Each artifact may include a metadata block:

```text
Review status: reviewed | needs-review | generated | not_available | not_applicable | stale
Source: <file, command, artifact, or not_available>
Trust: high | medium | low
Stale: true | false
```

Definitions:

- `reviewed`: accepted by a human or inherited from a reviewed BaseBrief
  artifact
- `needs-review`: generated or inferred and waiting for human acceptance
- `generated`: mechanically collected from local files, git facts, or known
  BaseBrief artifacts
- `not_available`: expected source was absent
- `not_applicable`: source or section does not apply to this repository
- `stale`: inherited from an earlier handoff and not reverified against current
  live facts

`source` names the evidence. `trust` is a local confidence label, not a proof.
`stale` tells the receiver whether to recheck before acting.

## MANIFEST.md

Purpose: identify the pack and explain how to read it.

Recommended sections:

- Pack identity
- Live repo facts
- Input sources
- Reading order
- Safety notes
- Known gaps

Required behavior:

- include branch, HEAD, worktree status, and generation time when available
- separate live facts from inherited source-window facts
- mark unknown fields as `not_available` instead of guessing

## REPO_MAP.md

Purpose: summarize repository shape.

Recommended sections:

- Top-level layout
- Core implementation entry points
- Documentation entry points
- Test and validation entry points
- Generated or excluded paths

Required behavior:

- keep the map small
- exclude `.git`, dependency folders, `.env`, credentials, private notes, raw
  conversation logs, and generated output unless explicitly requested
- avoid becoming a repo dump

## KEY_FILES.md

Purpose: tell the receiver which files to inspect first.

Recommended sections:

- Project entry
- Current cycle
- CLI and checks
- Specs
- Templates
- Examples

Required behavior:

- keep the list bounded
- prefer files with stable roles over broad directory listings
- use `not_available` when an expected file is missing

## RECENT_DELTA.md

Purpose: summarize recent change context.

Recommended sections:

- Commit range
- Recent commits
- Changed files
- Decisions changed
- Risks changed
- Needs review
- Already reviewed

Required behavior:

- preserve `reviewed` versus `needs-review`
- mark stale inherited delta facts as `stale`
- keep historical `commits_in_range` drift non-blocking when live branch, HEAD,
  and worktree facts are rechecked

## RISK_BOUNDARIES.md

Purpose: centralize boundaries before any implementation proposal.

Recommended sections:

- Do not touch
- Requires explicit approval
- Frozen lines
- Sensitive inputs

Required behavior:

- include secrets, `.env`, token, key, and credential boundaries
- preserve no provider, no runtime, no plugin, no MCP, no IDE, no hosted, no
  cloud-memory, no schema-v2, and no repo-dump boundaries
- mark publication actions such as push, tag, release, pull request, npm
  publish, and global CLI install as approval-only

## RECEIVER_STATE.md

Purpose: describe receiver-side state without forcing every repo to have
receiver history.

Recommended sections:

- Current receiver contract
- Acceptance state
- Lint state
- Fixture and repair state
- Dogfooding state
- Known receiver limitations
- Receiver next action

Required behavior:

- allow `not_applicable` when the repo has no receiver workflow
- allow `not_available` when receiver artifacts are absent
- do not invent receiver history

## NEXT_WINDOW_STARTER.md

Purpose: provide a copyable starter prompt for the next window.

Recommended sections:

- Reading order
- Live fact recheck instructions
- Current task
- Risk boundaries
- Expected receiver response

Required behavior:

- tell the receiver to read `MANIFEST.md`, `RECENT_DELTA.md`,
  `RISK_BOUNDARIES.md`, `REPO_MAP.md`, and `KEY_FILES.md` first
- require a live repo fact check before edits
- require gaps to be reported instead of filled by guesswork
- keep v1.x Delta Receiver frozen unless the user explicitly reopens that line

## Public Safety

Context Pack Lite must stay public-safe by default:

- no secrets
- no `.env` contents
- no API keys, tokens, credentials, or bearer strings
- no raw private output
- no private absolute paths in public examples
- no provider request
- no runtime integration
- no plugin, MCP, IDE, hosted service, or cloud-memory behavior
- no schema-v2 claim
- no AI automatic summary, embedding, vector, or semantic-index claim

## Future Check Direction

The later Context Pack Check line may verify:

- all seven files exist
- live facts are present
- review metadata is present where needed
- missing inputs are marked explicitly
- pack thickness stays bounded
- unsafe strings are absent
- v1.x frozen-line boundaries remain visible

Prefer integrating this with the existing check surface before adding extra
top-level commands.
