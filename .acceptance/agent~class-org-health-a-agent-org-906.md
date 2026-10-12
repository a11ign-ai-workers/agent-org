Class `org-health` (agent-org#906, Move 3 of a11ign/a11ign#4505): the gate's board-truth reading is a `DecisionClass` a one-shot run can serve, Haiku by default. A file and its test; nothing is switched on (`seatModeOf("org-health")` stays `seat`).

**What changes.**
- `src/decision-run/classes/org-health.ts`: the question (the order, default `escalate`, allowed `posted | escalate`), `actionsFor` (`posted` posts the table as a `board-truth` decision on the record issue the record issue (a11ign#928, its repository read from the project declaration) and writes nothing else; `escalate`, anything else, and a `posted` whose text directs a per-row write are no action, so `serveByRun` falls back to the seat), `tierQuestion` (default `haiku`, allowed `haiku | sonnet`), and a role excerpt capped at `ROLE_EXCERPT_CAP_BYTES` (1400).
- **Assumptions, said so:** the order's flag is `org-health:<session>` on the record issue (no such flag is declared today; the class reads it as a string, and a project that names another changes one function); the post item is the record issue for every `org-health` order, so the caller's `itemOf` must resolve to it; `posted` removes no flag.
- The tier thresholds are the provider's: `serveByRun` already moves to Sonnet on a pick or an answer under the floor; the class names the two tiers and its default.

**Baseline** (Done-when 3), measured: `outcomeSplit` over `readStore(~/.cache/a11ign/trace/events.ndjson)`, window 2026-10-05T00:00Z to 2026-10-12T00:00Z: `org-health` 477 wakes, 410 wrote (86.0%), 1 no-op, 0 escalated, 66 null, 0 unsettled (all causes: 6,115 wakes, 5,020 wrote). Read-only; no ingest was run.

Mutation: flag check never firing (1 red) and always firing (3 red); `posted`-only guard dropped (3 red); per-row-write check dropped (1 red); Haiku default moved to Sonnet (2 red); each restore byte-identical (copy in the scratchpad, `diff`).

Evidence: the Acceptance command's rstest run, 8 of 8 (the tool's modules resolve the project's host at import, so the command supplies `AGENT_ORG_HOST` when the shell has none) at this head; `pnpm run typecheck` reports no error naming the files. Measured, not inferred.

Acceptance:
```bash
git grep -q "POSITIVE CONTROL" -- src/decision-run/classes/org-health.test.ts
git grep -q "NEGATIVE CONTROL" -- src/decision-run/classes/org-health.test.ts
bash -c 'cd "$(git rev-parse --show-toplevel)" && export AGENT_ORG_HOST="${AGENT_ORG_HOST:-$HOME/repos/a11y-witness/.agent-org/host.json}" && npx rstest run --config scripts/rstest/rstest.config.ts src/decision-run/classes/org-health.test.ts'
```

Closes a11ign/agent-org#906.

platform: n/a (a class file for the registry the row's predecessor built)
