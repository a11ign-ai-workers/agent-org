Class `ready-queue-empty` (agent-org#910, Move 3 of a11ign/a11ign#4505): "is any shelved row promotable" is a `DecisionClass` a one-shot run can serve, Haiku by default. A file and its test; nothing is switched on (`seatModeOf("ready-queue-empty")` stays `seat`).

**What changes.**
- `src/decision-run/classes/ready-queue-empty.ts`: the question (the order, default `none-promotable`, allowed `none-promotable | promote | escalate`), `actionsFor` (`none-promotable` posts the reason on each examined row; `promote` posts and sets `ready` per row, guarded as `unclaimed-blocker-cleared` is; `escalate` and anything else is no action), `tierQuestion` (default `haiku`, allowed `haiku | sonnet`), a role excerpt capped at `ROLE_EXCERPT_CAP_BYTES` (1400).
- **Assumptions, said so:** (1) the order names a queue, not a row, so the served item is the record issue a11ign#928 (as `org-health`) and "the gap is gone" is read per examined row: a named row no longer in `backlog`/no state, or unreadable, makes the whole answer no action. (2) Rows come from the answer's `rows`, re-read through the port `buildQuestion` was handed when the answer is applied; at most `MAX_ROWS` (10). (3) The order carries no `Head: <sha>` today, so `promote` is unavailable until the gate stamps one (outside this Region). (4) `serveByRun` applies one post and at most one change on the served item, so an answer naming several rows falls back to the seat; the test pins that, and it is filed as a row. (5) The confidence floor is the provider's; the class names the two tiers.

**Baseline** (Done-when 3), measured: `outcomeSplit` over `readStore(~/.cache/a11ign/trace/events.ndjson)`, window 2026-10-05T00:00Z to 2026-10-12T00:00Z: `ready-queue-empty` 77 wakes, 75 wrote (97.4%), 0 no-op, 0 escalated, 2 null, 0 unsettled (all causes: 6,115 wakes, 5,020 wrote). Read-only; no ingest was run.

Mutation: default moved to `promote` (1 red); the shelved check dropped from `shelvedRows` (1 red); each restore byte-identical (copy in the scratchpad, `diff`).

Evidence: `npx rstest run ... ready-queue-empty.test.ts` 7 of 7 at this head; `pnpm run typecheck` reports no error. Measured, not inferred. `pnpm run verify` was not run here.

Acceptance:
```bash
git grep -q "POSITIVE CONTROL" -- src/decision-run/classes/ready-queue-empty.test.ts
git grep -q "NEGATIVE CONTROL" -- src/decision-run/classes/ready-queue-empty.test.ts
bash -c 'cd "$(git rev-parse --show-toplevel)" && npx rstest run --config scripts/rstest/rstest.config.ts src/decision-run/classes/ready-queue-empty.test.ts'
```

Closes a11ign/agent-org#910.

platform: n/a (a class file for the registry the row's predecessor built)
