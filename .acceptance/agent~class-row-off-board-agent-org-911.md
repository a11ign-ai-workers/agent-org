The `row-off-board` class exists (agent-org#911, Move 3 of a11ign/a11ign#4505): the unlabelled remainder the gate cannot place is decided by a one-shot run. Nothing is switched on: `seatModeOf("row-off-board")` is `seat` until a project says `run`, and the revert is deleting `src/decision-run/classes/row-off-board.ts`.

**What it is.** `src/decision-run/classes/row-off-board.ts` default-exports a `DecisionClass`: the question (default `backlog`, allowed `backlog | ready | parked | epic | escalate`), `actionsFor` (each state answer is one `post` of kind `row-off-board` plus one state change through the port; `ready` only when the item has no blocker, Waiting-for, `hold`, answer owed or future Not-before; `parked` only when it declares an edge, Waiting-for, Not-before or answer owed; `epic` is Backlog in lane any; `escalate` and every doubt yield no action, which `serve-by-run` hands to the seat), `tierQuestion` (Haiku by default; Sonnet when the pick or an under-the-floor answer says so, thresholds named as constants) and a role excerpt pinned under 900 bytes.

**Two things the row did not state, decided here.** (1) `actionsFor` receives only the answer and the order, and its rules are about the item, so `buildQuestion` keeps what it read in a WeakMap keyed on the order object; an order whose question was never built yields no action. (2) "An item that no longer carries the order's flag" is read as: it has a state other than `parked`, which the gate boards itself (#490). A multi-row order (`<a>.<b>` key) names no one item; `itemOfKey` already refuses it with `no-item` before a run is spent, so a set of several rows is still the seat's. Splitting such an order into one per row is a gate change outside this Region.

**Baseline** (measured 2026-10-12T09:34Z by `outcomeSplit` over `readStore` of `~/.cache/a11ign/trace/events.ndjson`, window the 7 days to the read): cause `row-off-board` 46 wakes, 35 wrote (76%), 0 no-op, 0 escalated, 11 null, 0 unsettled; all causes 6,171 wakes, 5,076 wrote.

Measured at this head: `src/decision-run/classes/row-off-board.test.ts` 14 of 14; `src/decision-run` and `src/serve-by-run.test.ts` pass; `tsc --noEmit` clean.

Mutation: each run and reverted byte-identical (copy in the scratchpad, `diff`): (1) the allowed-answer check removed -- only the outside-`allowed` NEGATIVE CONTROL fails; (2) `gapOpen` always true -- only the gap-gone NEGATIVE CONTROL fails; (3) `gapOpen` always false -- the POSITIVE CONTROLs fail (5) and no NEGATIVE CONTROL; (4) the `ready` startable check removed and (5) the `parked` condition check removed -- each fails only the ready/parked NEGATIVE CONTROL.

Not run: the live reading, and `pnpm run verify` (this checkout's package.json has no `verify` or `lint` script; `typecheck` was run). The Acceptance as filed began with `cd ~/repos/agent-org`, the primary clone, where this branch does not exist (the same correction agent-org#904 made); it is run from the worktree below.

Acceptance:
git grep -q "POSITIVE CONTROL" -- src/decision-run/classes/row-off-board.test.ts
git grep -q "NEGATIVE CONTROL" -- src/decision-run/classes/row-off-board.test.ts
npx rstest run --config scripts/rstest/rstest.config.ts src/decision-run/classes/row-off-board.test.ts

Closes: a11ign/agent-org#911

platform: n/a (a class module over the ticket port; nothing is built that GitHub, pnpm, systemd or git does)
