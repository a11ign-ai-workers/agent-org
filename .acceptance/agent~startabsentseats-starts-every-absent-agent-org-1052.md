`startAbsentSeats` shares the tick's start budget (agent-org#1025), so the `seats` phase cannot wait N x 30 s on a herdr restart (agent-org#1052).

**What changes.**
- `src/wake.ts`: `startAbsentSeats` times each `herdr agent start` through the same `startBudgetOf` / `START_BUDGET_MS` (60 s) that `deliver` uses. A seat whose start would begin with the budget spent is left absent and named `SEATS DEFERRED: <name> ...`; the next tick reads it absent again and starts it, so no queue is kept. It takes an optional `now` clock, defaulting to `Date.now`, which is the seam the test drives.
- `src/packaging/wake-seat-start-budget.test.ts` (new): three absent seats of 30 s each start two and defer one, and the next tick starts the third. Controls: a fast start is started, a present seat gets no write, and an incomplete listing starts nothing.

**Mutation, both directions.** Guard removed (`if (false)`): the done-when goes red (1 failing). Guard forced (`if (true)`): the fast-start and present-seat controls and the done-when go red (3 failing). Each restore is byte-identical.

**Before the change**, the done-when fails: all three seats are started. **After**, the file passes 4 of 4, and the 127 test files that import `wake.ts` pass 2636 of 2636. `pnpm run typecheck` exits 0.

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json node --test src/packaging/wake-seat-start-budget.test.ts`

The row's own command cds into `~/repos/agent-org`, which has no `wake-seat-start-budget.test.ts` until this PR merges, so it cannot pass for this PR. The command here runs the same file from the repository root.

Closes a11ign/agent-org#1052.

platform: n/a (a budget already exists in `wake.ts`; this reuses it for a second caller)
