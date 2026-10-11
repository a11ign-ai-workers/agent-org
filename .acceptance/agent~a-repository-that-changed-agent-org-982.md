A repository that changed with no event behind it at a webhook-mode reconcile is now reported once as a missed delivery, naming the repository, the window and the probe that moved (`issues list` or `actions/runs`). The rule is `src/event-drift.ts`; `refreshTickSnapshot` runs the probe pair once when a repository is due and files through `recordIncident` (label, dedupe and refusal handling reused). Part of a11ign/a11ign#5043; the revert is `"source": "poll"`.

Acceptance:
```bash
git grep -q "POSITIVE CONTROL" -- src/event-drift.test.ts
git grep -q "NEGATIVE CONTROL" -- src/event-drift.test.ts
npx rstest run --config scripts/rstest/rstest.config.ts src/event-drift.test.ts
```

Mutation: four mutants, each killed by its own tests (the event check removed: NEGATIVE CONTROL; the rule never firing: POSITIVE CONTROL plus the two window tests; a baseline reading counted as drift: the baseline test plus both controls; a refused filing advancing the window: the retry test).
