The gate's conditional-read and per-tick budget building blocks (a11ign/a11ign#5128): `src/gh-conditional.ts` gives `conditionalGate` (the ETag/304 reader, over the trace publisher's `conditionalReader`), `partitionUnchanged` (a pull request whose head and `updatedAt` are unchanged is not re-read), `budgetOf` (a tick's GraphQL points, refused at the cap, spent by cause), `budgetLine` (the `gate-budget` line), and `restConditionalOn` (the `gate-rest-conditional` marker that is the flag). The gate's own reads are NOT yet routed through them: that wiring is in `src/work-gate/reads.ts` and `src/work-gate/tick.ts`, outside this row's Region (see the PR body).

Acceptance:

```bash
bash -c 'cd ~/repos/agent-org-wt-5128 && npx rstest run --config scripts/rstest/rstest.config.ts src/gh-conditional.test.ts'
```

Closes: none -- a11ign/a11ign#5128 stays open: the gate wiring is outside the row's Region, and the one-hour measurement needs the live gate
