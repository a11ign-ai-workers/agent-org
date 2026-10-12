With `workers.ceoOneShot` on, a ready `lane:ceo` row's order is addressed to `engineers` with a sibling cause (`ready-ceo-row-unclaimed`) and `briefRole: "ceo"`, so the spawn path starts the row's own seat, briefs it with `ceo.md`, writes a record of the spawn before the claim (`ceo`'s ruling B, #947), and holds a second fleet-or-lab row while one ceo run is live. The real `laneReason` honours that record for the seat and still refuses a standing non-ceo session. With the flag off (the default) the order, what `deliver` does with it and the record file are what they were: the flag-OFF order is 367 bytes before and after.

Acceptance:

```bash
git grep -q "POSITIVE CONTROL" -- src/ceo-one-shot.test.ts
git grep -q "NEGATIVE CONTROL" -- src/ceo-one-shot.test.ts
npx rstest run --config scripts/rstest/rstest.config.ts src/ceo-one-shot.test.ts src/spawn-role-brief.test.ts
```

The row's own Acceptance runs `cd ~/repos/agent-org`, the primary checkout, which does not hold the new test file; the same commands were run in the worktree.

Mutation, each run and restored byte-identical (`cmp` against a backup): the record never written fails 3 of 12 (the record case, the refused-claim case and the flag-off control); the hold never firing fails 1 (the fleet-lab case); the flag check removed from the transform body fails 2 (the byte-identical case and the flag-off control). Changing only the transform's DEFAULT for `enabled` fails nothing, because every test passes `enabled` explicitly; that gap is open and reported in the PR.
