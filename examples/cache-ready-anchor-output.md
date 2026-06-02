# BB3 Cache Anchor Example

BB3 stores possible tail requests in the stable prefix. The dynamic tail only selects one option.

```text
BB3
P=A showcase project used for bounded AI-assisted continuation.
G=Clarify one hero section boundary without widening scope.
F=The task belongs to the presentation layer only. ; This round does not touch backend or deployment.
D=Do not widen scope. ; Keep the work inside one or two files.
R=Stop if backend, provider, .env, deployment, state, memory, or gateway becomes relevant.
X=backend ; provider ; .env ; deployment ; real runtime
O=A compact BB3 anchor prompt for cache-economics experiments.
QAA=Restate the project state briefly, then give only the next safe step.
QAB=Generate a short next-chat opener using only the verified facts.
--
Q=A
```

Use BB3 only for cache-economics experiments. For ordinary continuation, use `full` or `lite`.
