A decision run can be executed (a11ign/agent-org#900, Move 3 harness of a11ign/a11ign#4505): `src/decision-run/run.ts` adds `decisionRunArgv` and `runDecision`, with an injected `exec`, a timeout, a structural schema check, and named failures (`timeout`, `exit-nonzero`, `unparseable`, `schema-mismatch`, `over-budget`). It never throws and never retries. No caller, class or ticket write is added.

**Flags** were checked against the installed `claude --help` 2.1.296; `--max-turns` is accepted but not listed by `--help` (a real call ran with it). **Real call**, `claude -p --model haiku --output-format json --json-schema '{...enum ok|no}'` on a trivial prompt, returned `structured_output: {"answer":"ok"}`, `session_id`, `total_cost_usd: 0.0048`, `usage.cache_read_input_tokens: 22264`, `usage.cache_creation_input_tokens: 22374`, `is_error: false`, `subtype: "success"`; the parser reads exactly those fields.

**Assumption:** a missing or non-positive cap is reported as `over-budget` (the row's reason list has no other name for it), refused before `exec`.

Mutation: deleting the `checkAgainstSchema` line in `runDecision` (the raw output is returned as the decision) turns "JSON that fails the schema is schema-mismatch" red (1 of 10); restored byte-identical (`diff` of a scratchpad copy).

Evidence: `run.test.ts` 10 of 10; `tsc --noEmit` clean.

Acceptance: `npx rstest run --config scripts/rstest/rstest.config.ts src/decision-run/run.test.ts`

Closes: a11ign/agent-org#900

platform: n/a (pure code; spawning is the caller's injected exec)
