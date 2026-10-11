`laneReason` honours a record of a spawn (`src/row-claim/lane-stand-in.ts`): a one-shot seat is not refused a lane owner's row when a fresh record names that seat, that row and that owner. An ordinary seat with no record, the same seat for a different row, `worker-capture`, and a `lane:ceo` row for the same seat are all still refused.

Acceptance:

```bash
git grep -q "positive control: the same seat and row with NO record is refused" -- src/row-claim/lane-one-shot-claim.test.ts
bash -c 'cd ~/repos/wt-agent-org-947 && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/row-claim/lane-one-shot-claim.test.ts'
```

Mutation: `standsIn` made to return `false` fails 2 of 11 tests (the pass case and the `decideClaim` pass); made to ignore seat, row and owner fails 5 of 11 (the no-record, other-row, other-seat, `lane:ceo` and two-lane controls). Each run and restored byte-identical (`diff` against a scratchpad copy).
