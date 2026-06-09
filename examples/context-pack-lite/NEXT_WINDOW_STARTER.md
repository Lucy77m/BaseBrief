# Next Window Starter

Review status: generated
Source: normalized Context Pack Lite generator output
Trust: medium
Stale: false

You are continuing work from a BaseBrief Context Pack Lite bundle.

Start by reading:

1. `MANIFEST.md`
2. `RECENT_DELTA.md`
3. `RISK_BOUNDARIES.md`
4. `REPO_MAP.md`
5. `KEY_FILES.md`
6. `RECEIVER_STATE.md`

Before editing, recheck the live repository facts:

- expected_branch_from_pack: main
- expected_head_from_pack: example-head-redacted

Continuation rules:

- Treat this pack as inherited context, not as this window's task by itself.
- Use the latest user instruction as the real current goal after reading and live-rechecking the pack.
- Do not continue historical release slices or frozen lines unless explicitly asked.
- No provider request.
- No runtime integration.
- No schema-v2.
- No Workflow Runner.
- Do not add provider, runtime, plugin, MCP, IDE, hosted, cloud-memory, schema-v2, AI auto-summary, vector, embedding, or repo-dump behavior.
- If an input is missing, report `not_available`, `not_applicable`, or `needs-review`.

Expected first response:

- Report live repo facts.
- Separate inherited pack facts from live rechecks.
- State whether the pack is understandable enough to continue.
- List any gaps before proposing implementation work.
