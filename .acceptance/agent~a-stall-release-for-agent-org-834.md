Closes a11ign/agent-org#834

## What it is
A stall release of a claimed row in a second declared tracker lands. `ReleaseRequest.tracker` (`src/claim-stall.ts`) carries the row's tracker key, absent for the home tracker's; `claim-stall-tick.ts`'s `namespacedOrder` fills it from the scope the row was read from, and the withholding agent-org#747 put in (`RELEASE_WAITS_ON`) is removed. `performRelease` (`src/wake.ts`) then does the whole release in that tracker: `stillHolds` reads the holder's `session:` label on that tracker's repository, the release comment is posted there, `row-claim decline` carries `--tracker=<key>`, and the tree is read and the launch worktree made in the host's clone of it (`releaseSite`).

- An unreadable tracker answers `null` (retried next tick), never "no longer held"; a key the project does not declare, or a clone the host does not give, is refused before anything is read, run or written.
- The kept-tree ledger is keyed by the home tracker's row number (`spawnClaimer` neither reads nor writes it for a keyed row), so a keyed release neither writes nor deletes under it.

## Acceptance
```bash
npx rstest run --config scripts/rstest/rstest.config.ts src/wake-release-other-tracker.test.ts src/work-gate-claim-stalled.test.ts src/work-gate-claim-stall-other-tracker.test.ts
```

## Evidence
- Printed: `VERDICT pass: 143 tests in 3 files`. `tsc --noEmit -p tsconfig.json` exits 0.
- The row's own command, `node --import tsx --test ...`, cannot run: `tsx` is not a dependency (`ERR_MODULE_NOT_FOUND` in this tree and in the `agent-org` clone), and the tests run under rstest's `node:test` shim. The same three files (the row's two plus `work-gate-claim-stall-other-tracker.test.ts`, whose withholding test this row had to change) also pass under `node --test`.
- **Not green, and not caused by this change**: `rstest run --config scripts/rstest/rstest.config.ts --changed=origin/main` reports 56 failures in 10 files (`engineer-route`, `packaging/row-file`, `packaging/milestone-clock*`, ...). The same 10 files with `wake.ts`, `claim-stall.ts` and `claim-stall-tick.ts` put back to `HEAD` print the same `56 of 375 tests failed`, so they fail on `main`. Measured, not inferred.

Mutation: nine, each broken by editing the source, each red in its own test only, each restored byte-identical (copy in the scratchpad, `filecmp` printed True):
- `decline` never carrying `--tracker=`: red in the second-tracker release test; carrying it always: red there and in the `tracker: ""` test (the home twin);
- `stillHolds` always reading the home repository: 3 red (the release, the stale and the unreadable tests);
- the comment always going to the home repository: 1 red; the kept ledger always written: 1 red (same test);
- the tree read in the primary and not the clone: 1 red (the branch is on `origin` only in the clone, so the tree is not kept);
- the release site always the home one: 5 red;
- an unread tracker read as `false`: 1 red, the unreadable test;
- the tick not naming the tracker on the order: 1 red, in `work-gate-claim-stall-other-tracker.test.ts`.

Outside-Region: src/work-gate-claim-stall-other-tracker.test.ts — it asserted the withholding this row's change 3 removes ("a release ... is NOT ordered ... waits on agent-org#834"); left as it was it would be a red test on main, so it now asserts the release IS ordered with the tracker's key and the home row's carries none.

platform: n/a (the row's own machinery: `gh`, `row-claim` and the host's clones are the platform it already calls)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
