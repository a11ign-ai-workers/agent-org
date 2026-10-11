Closes a11ign/agent-org#1025

## Cause
`deliver` starts each spawned worker in turn and every `herdr agent start` may wait the whole 30 s of `defaultRun`'s `timeout`. `MAX_SPAWNS_PER_TICK` holds a plain engineer to one, but a chairman row (`startFresh`) and a reviewer are not held by it, so a tick with three starts waited three timeouts (the 402 s tick: 30,024 / 30,030 / 30,031 ms). The cost line could not say so: `--session` was not a value option, so the value `org` was read as the first subcommand word and all 75 `herdr` calls were filed as `herdr org agent`.

## Change
- `src/wake.ts`: the starts of one tick share `START_BUDGET_MS` (60 s). `deliver` times each `agent start` (a start that threw counts), and a start that would BEGIN with the budget spent is refused before its claim, pane or review checkout, as `...; deferred: this tick's agent starts have used their start budget (N s of the 60 s budget spent on agent starts): started on the next tick`. `splitRefusals` reads it as a wait (CAPACITY's 30-minute limit), so the tick does not exit ATTENTION, and the tick log prints `START BUDGET: N start(s) deferred`.
- `src/lib/spawn-census.ts`: `--session` is a value option, so the cost line names `herdr agent start` apart from `herdr agent list` / `agent read`.
- A tick therefore waits at most the budget plus one timeout (90 s) on starts. The budget is a third of the 180 s limit, not a measured optimum.

## Acceptance
```bash
AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json node --test src/packaging/wake-start-budget.test.ts
```

The row's own command is the same with `cd ~/repos/agent-org &&` in front; that is the primary clone, which holds the new test file only once this merges, so the PR's job runs it in the PR's own checkout.

Class: serial-blocking-start-in-one-tick -- any other loop that runs `herdr agent start` (or another call with `defaultRun`'s 30 s timeout) once per item inside a tick waits item x 30 s; guard: `wake-start-budget.test.ts` pins the budget for `deliver`'s starts, and the one other such loop, `startAbsentSeats` (the `seats` phase), is filed as agent-org#1052 with its own test.

## Evidence
- `src/packaging/wake-start-budget.test.ts` (new): 10 pass, 0 fail. `pnpm run typecheck` clean. `pnpm test`: 12 of 10,258 fail, the same 12 of 80 in the seven files they sit in with `origin/main`'s `wake.ts` and `spawn-census.ts` swapped in (git-spawn-classification, live-tree-independence, org-health-queued-lab-jobs, release-tag-on-merge, wait-condition, work-gate-other-scopes-concurrent, worker-stop-hook): an environment failure (`AGENT_ORG_HOST` unset in their subprocesses), not this change.
- The unknown, read from the code and not from a journal: a start killed at 30 s THROWS, so `spawnWorker` returns `herdr refused to start ...`, closes the workspace it opened and releases the claim (`unwound`, `closedNote`). It is neither a running agent nor an orphan pane, and it is a wasted claim: the next tick derives the order again. That is why the bound is "do not begin more starts than the budget allows" and not `READY_BOUND_MS`, which polls an agent that did start. The 2026-10-10 journal lines for the three starts are not in this host's `~/.cache/a11ign/tick-cost.jsonl` (308 records from 2026-10-11T10:00Z, none with a `herdr` call over 10 s), so the line itself is not quoted: could not determine, which is not "none happened".

Mutation (both directions, restored byte-identical each time, `diff` clean):
- the hold never fires: 5 red (three-starts, timeouts, boundary, reviewer, wait classification); the three controls stay green.
- the hold always fires: 8 red, including both fast-start controls and the live-seat prompt control.
- `--session` dropped from the value options: only the census test red.
- the deferral read as a fault: only the wait-classification test red.
- a start that threw not counted: only the timeout test red.
- boundary `<=` for `<`: 5 red, the exact-60,000 ms case among them.
- engineer path unheld: 4 red, the reviewer test green; reviewer path unheld: only the reviewer test red.

## Open
Done-when 4, the live reading (the first tick with two or more spawns after this ships has a `wake` phase under 120 s in `tick-cost.jsonl`), cannot be quoted before the release: a new row for the gate's reading, not a reason to hold this claim.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
