A claim on a row whose `Waiting-for:` line is unmet is refused before any write, and accepted once the condition is true. `claim-stall.ts` gains `unmetWaitingFor`, the same `conditionHolds` reading the gate's release acts on, and `row-claim.ts` asks it on every new claim (a resume is not refused). An unknown condition never refuses.

Acceptance:
```bash
npx rstest run --config scripts/rstest/rstest.config.ts src/row-claim.test.ts src/claim-stall.test.ts
```

Mutation: the refusal never firing fails the two #1281 tests in `row-claim.test.ts` and no other; the refusal always firing fails ten tests of that file.

Consumer-declaration: none -- nothing a consumer sets changes.
