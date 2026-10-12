An order whose class a project sets to `run` is served by a one-shot decision run and falls back to its standing seat on any failure (agent-org#904, Move 3 cutover seam of a11ign/a11ign#4505). The default is OFF and the revert is one line: delete `.agent-org/seats.json`, or set the cause to `seat`.

**What it is.** `src/serve-by-run.ts` holds `serveByRun(order, deps)`: registry lookup, `seatModeOf`, `leaseItem`, `buildBrief`, the class's `tierQuestion` through `decide` (Haiku unless the pick or an under-the-floor answer says Sonnet), `runDecision`, `applyDecision`; it returns `served` or `fallback` with a named reason and never throws. `serveOrdersByRun` is the tick's half: it serves at most 3 orders (`MAX_RUNS_PER_TICK`) before `deliver` and hands back `causeKey -> record`. `wake.ts` gains the `serve` option of `deliver`, consulted once per order in the loop (after the delivery cap, before the target is chosen): a served order is recorded in the ledger like any delivery and is NOT prompted; every other order, and every fallback, goes on unchanged. A served wake is appended to `served-by-run`; `settleWakeOutcomes` (`src/trace/trace.ts`) turns each line into a wake event with `servedBy: "run"`, the run id and the told outcome `wrote`, and writes `servedBy: "seat"` on the wakes a seat served.

**Why `deliver` is not awaiting the run.** `deliver` is synchronous (its callers, `deliverHandoffs` and 30-odd tests, read its return directly) and a run is not. So the run happens in the tick right before `deliver`, behind the same flag, and `deliver`'s loop asks `serve` for the answer already in hand. The row says "`wake.ts` is edited at that one call site only"; it is edited at that loop and, necessarily, at the tick's one `await` that fills the map. `deliver`'s signature gains one optional field and its return is untouched.

**Not shipped here.** No class file exists under `src/decision-run/classes/` (a class is a later row), so with every class on `seat` -- today every cause -- `serveOrdersByRun` returns an empty map after loading an absent directory. `laneReason`, `ROUTED_TO`, `FLEET_LAB_PATTERNS` and `SPAWN_CAUSES` are untouched: `serve-by-run.test.ts` pins the sha256 of each one's source text (same method as `orchestrator-one-shot.test.ts`) and edits a fixture of each to prove the check moves.

Measured at this head: `src/serve-by-run.test.ts` 16 of 16. The flag-off delivery is byte-identical to a delivery with no seam: the same herdr calls and the same typed order (a 160-byte literal) with the seats file set to `seat`, absent, malformed and `{}`, and the typed prompt is 1341 bytes with `serve` absent (what `origin/main`'s `deliver` is) and 1341 bytes with `serve` answering `null` (measured through `deliver` at this head with a fake herdr, the header's order id pinned).

Mutation: each run and reverted byte-identical (copy in the scratchpad, `diff`): (1) `deliver` never serves -- the POSITIVE CONTROL fails and no other; (2) the seat-mode check removed from `serveByRun` -- the `serveByRun itself reads seat` NEGATIVE CONTROL fails and no other (the tick's pre-filter would otherwise hide it); (3) the apply outcome ignored -- the stale-apply NEGATIVE CONTROL fails and no other; (4) the lease result ignored -- the held-lease NEGATIVE CONTROL fails and no other.

Not run: the live reading. No class exists, so nothing can be served by a run in production until a class row lands. The Acceptance as filed named `src/wake.test.ts`, which does not exist in this repository (the `deliver` tests are `src/packaging/wake-*.test.ts`), and a `cd ~/repos/agent-org`, the primary clone, where this branch does not exist; both are corrected below.

Four tests fail at this head AND on the primary clone's `main` (`ee38d189`) and are not touched by this change: `src/packaging/wait-condition.test.ts` (2), `src/work-gate-other-scopes-concurrent.test.ts` (1), `src/worker-stop-hook.test.ts` (1).

Acceptance:
git grep -q "POSITIVE CONTROL" -- src/serve-by-run.test.ts
git grep -q "NEGATIVE CONTROL" -- src/serve-by-run.test.ts
npx rstest run --config scripts/rstest/rstest.config.ts src/serve-by-run.test.ts src/packaging/trace-wake-outcome.test.ts src/trace/manager-spend.test.ts

Closes: a11ign/agent-org#904

Outside-Region: .changeset/an-order-can-be-served-by-a-run.md — the entry a project that pins a tag reads.

platform: n/a (a lease file and `node:child_process` for one `claude -p`; the tracker is reached through the ticket port)
