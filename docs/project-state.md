# BaseBrief Project State

`v0.6.0` adds a local project state directory for reviewed receiver handoffs:

```bash
node scripts/basebrief.js state-init --repo <target-repo> --source <receiver-ready.md> --json
node scripts/basebrief.js state-read --repo <target-repo> --json
```

`state-init` writes `<target-repo>/.basebrief/state.json` from an explicit
`receiver-ready.md` source. The source must already contain:

```text
handoff_status: ready_for_receiver
```

The command records only local, mechanical state:

- `schemaVersion: basebrief-project-state-v1`
- repository branch, HEAD, and changed files
- source file basename and `handoff_status: ready_for_receiver`
- confirmed handoff fields: `current_goal`, `verified_facts`,
  `confirmed_decisions`, `risk_boundaries`, `receiver_entry_task`,
  `open_questions`
- non-goal markers for provider requests, Auto Flow, receiver thread creation,
  and secret storage

`state-read` reads the existing `.basebrief/state.json` and validates the schema
version. It does not modify the target repo.

## Boundaries

- No provider request.
- No Auto Flow.
- No receiver thread creation.
- No secret storage.
- No automatic promotion from draft to ready.
- BB9 handoff schema is unchanged.
- Receiver Safe Check config and result schemas are unchanged.

`state-init` refuses to overwrite an existing state file and rejects `.env` or
`.git` source/output paths. The state file is intended for local continuity only;
review the receiver-ready source before creating it.
