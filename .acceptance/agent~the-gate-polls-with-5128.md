The gate's conditional-read and per-tick budget building blocks (a11ign/a11ign#5128), in `src/gh-conditional.ts`: `conditionalGate` (the ETag/304 reader, over the trace publisher's `conditionalReader`), `partitionUnchanged` (a pull request whose head AND `updatedAt` are unchanged is not re-read), `budgetOf` (a tick's GraphQL points, refused at the cap, spent by cause), `budgetLine` (the `gate-budget` line), `restConditionalOn` (the `gate-rest-conditional` marker, which is the flag), and `meteredRun` / `meteredBatch` (the seams that would charge the gate's GraphQL reads to the tick's budget). NOT WIRED IN THIS PR: no gate read calls any of them. The wiring of `readPrs`/`readOpenRows` and the tick budget, and the live one-hour measurement, are row a11ign/a11ign#5169 (blocked by #5128), whose branch is `agent/the-gate-reads-wiring-5169`.

Acceptance:

```bash
bash -c 'AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/gh-conditional.test.ts'
```

Closes a11ign/a11ign#5128
