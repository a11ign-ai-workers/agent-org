Class `answer-owed` (agent-org#905, Move 3 of a11ign/a11ign#4505): a worker's scope question on one row is a `DecisionClass` a one-shot run can serve, Haiku by default. A file and its test; nothing is switched on (`seatModeOf("answer-owed")` stays `seat`).

**What changes.**
- `src/decision-run/classes/answer-owed.ts`: the question (the order, default `escalate`, allowed `answered | relabel | escalate`), `actionsFor` (`answered` posts and removes `answer-owed:<session>`; `relabel` moves it to a session from the closed list `RELABEL_SESSIONS`; `escalate` and anything else is no action, so `serveByRun` falls back to the seat), `tierQuestion` (default `haiku`, allowed `haiku | sonnet`), and a role excerpt capped at `ROLE_EXCERPT_CAP_BYTES` (1600).
- A ruling, rule change, admin write or chairman decision is `escalate` in code as well as in the excerpt: such an item's question allows only `escalate` and `actionsFor` yields nothing for another answer. An item that no longer carries the order's flag is the same.
- The class is handed an order and no tracker scope, so it reads the repository of a tracker key from the project's declaration (`homeProjectDeclaration().tracker`), as `wake.ts` does (#2616); an undeclared key is no item and so no action. `actionsFor` is not given the item, so `buildQuestion` records what it read per `causeKey` for it.
- The tier thresholds are the provider's: `serveByRun` already moves to Sonnet on a pick or an answer under the floor; the class names the two tiers and its default.

Measured: (done-when 3) `outcomeSplit` over `readStore(~/.cache/a11ign/trace/events.ndjson)`, window 2026-10-05T00:00Z to 2026-10-12T00:00Z: `answer-owed` 759 wakes, 698 wrote (92.0%), 2 no-op, 0 escalated, 59 null, 0 unsettled (all causes: 6,115 wakes, 5,020 wrote). Read-only; no ingest was run.

Mutation: flag check never firing (1 red, the gone-flag case) and always firing (3 red); ruling check dropped (1 red); `answered`-only guard `chosen !== RELABEL` dropped (1 red); Haiku default moved to Sonnet (1 red); each restore byte-identical (copy in the scratchpad, `diff`).

Evidence: `node --test src/decision-run/classes/answer-owed.test.ts` 8 of 8 at this head; `pnpm run typecheck` reports no error naming the file. Measured, not inferred.

Acceptance:
```bash
git grep -q "POSITIVE CONTROL" -- src/decision-run/classes/answer-owed.test.ts
git grep -q "NEGATIVE CONTROL" -- src/decision-run/classes/answer-owed.test.ts
bash -c 'cd "$(git rev-parse --show-toplevel)" && npx rstest run --config scripts/rstest/rstest.config.ts src/decision-run/classes/answer-owed.test.ts'
```

Closes a11ign/agent-org#905.

platform: n/a (a class file for the registry the row's predecessor built)

Outside-Region: src/serve-by-run.test.ts — its "default registry holds no class" case asserted the premise this row ends (it failed CI); it now asserts the registry holds only `answer-owed`.
Outside-Region: .changeset/the-answer-owed-class-exists.md — the entry a project that pins a tag reads.
