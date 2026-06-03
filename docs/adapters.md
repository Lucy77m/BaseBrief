# BaseBrief Adapters

Adapter v1 exports BaseBrief handoff data into simple file-based context documents.

It is not an official Codex integration, not an official Claude integration, and not a plugin. It does not modify tool configuration files. It only writes files to an explicit output directory.

## Targets

`codex`

- Output: `codex-task.md`
- Shape: execution handoff for a coding agent.
- Focus: goal, verified facts, confirmed decisions, risk boundaries, forbidden scope, next task, and open questions.

`claude`

- Output: `claude-project-context.md`
- Shape: project context document.
- Focus: project identity, current goal, verified facts, decisions, assumptions, risk boundaries, open questions, and expected output.

`all`

- Writes both outputs plus `adapter.meta.json`.

## Command

```text
node scripts/basebrief_build_adapters.js --input examples/structured-handoff-full.md --output-dir tests/outputs/private/adapters --target all
```

Inputs follow the same rules as the handoff builder:

- `.json` input is read directly as BB9 handoff input.
- Markdown input must contain the marked `BASEBRIEF_HANDOFF_JSON_BEGIN` / `BASEBRIEF_HANDOFF_JSON_END` fenced JSON block.
- Free-form Markdown is not parsed.

## Metadata

`adapter.meta.json` records:

- input mode
- selected targets
- output files
- source schema
- safety boundary

It must not copy full prompt text, sidecar text, cache PAD content, provider keys, bearer tokens, or private absolute paths.

## Examples

```text
examples/adapter-codex-task.md
examples/adapter-claude-project-context.md
```

