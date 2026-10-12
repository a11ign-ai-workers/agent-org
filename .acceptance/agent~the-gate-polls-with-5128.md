The gate's conditional-read and per-tick budget building blocks (a11ign/a11ign#5128): `src/gh-conditional.ts` gives `conditionalGate` (the ETag/304 reader, over the trace publisher's `conditionalReader`), `partitionUnchanged` (a pull request whose head and `updatedAt` are unchanged is not re-read), `budgetOf` (a tick's GraphQL points, refused at the cap, spent by cause), `budgetLine` (the `gate-budget` line), `restConditionalOn` (the `gate-rest-conditional` marker that is the flag), `meteredRun` (the seam that charges each GraphQL read in `src/work-gate/reads.ts`'s `defaultRun` and `capturedRun` to the tick's budget when the flag is on), and `meteredBatch` (the same charge for the calls `runBatch` sends together, so the first-wave batches that default readers make are not outside the cap; a refused call is answered as a failed one and never sent). NOT YET WIRED: no gate read consumes `conditionalGate` or `partitionUnchanged` (the hot GraphQL lists have no REST form with the same fields; the paged files reader already keys its cache by head sha), and the live one-hour measurement is not made. See the PR body.

Acceptance:

```bash
bash -c 'cd ~/repos/agent-org-wt-5128 && npx rstest run --config scripts/rstest/rstest.config.ts src/gh-conditional.test.ts'
```

Closes a11ign/a11ign#5128
