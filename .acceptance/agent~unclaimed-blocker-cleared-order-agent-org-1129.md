Closes a11ign/agent-org#1129

## Cause
`promotionOrder` (`src/work-gate/causes/rows-blocker-cleared.ts`) stated no head, and the `unclaimed-blocker-cleared` class guards `promote` on a `Head: <sha>` line in the order's prompt (`HEAD_PATTERN`, #907 / PR #1128), so the class held on every order.

## Change
- `unclaimedBlockerClearedOrders` takes `head` and `promotionOrder` appends a `Head: <sha>` line of its own when it is 7-40 lowercase hex; otherwise no line. `causeKey` and `discriminator` do not carry it.
- `tick.ts` passes `primaryDrift?.originSha` (the `refs/remotes/origin/main` sha the gate already reads once per tick) as `head`. Outside the row's original Region: amended on the row (comment 2026-10-12, as the row instructs).

## Acceptance
```bash
npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/blocker-cleared-promotion-head.test.ts
```

## Evidence
- The row's own command `cd`s into the primary checkout, which does not hold this branch's test file; the Acceptance above is the same command run in the worktree.
- `VERDICT pass: 4 tests in 1 file` for the file above; with `work-gate.test.ts`, `wake-order-shape.test.ts` and `idle-hold-detector-in-gate.test.ts`, `VERDICT pass: 444 tests in 4 files`. `pnpm run typecheck` printed no errors.
- Positive control: the same order with no head (`undefined`, `null`, `""`, `"unknown"`, `"origin/main"`, non-hex, 6 hex chars) carries no `Head:` line.
- The class itself (PR #1128, open) is not on main, so the test asserts the prompt line and not the class, as the row's Open-check says.

Mutation: `tick.ts` passing no head failed only the `decide` test; the builder never emitting the line failed the builder test and the `decide` test; the builder emitting it with no validation (`true ?`) failed the positive control and the `decide` test. Each file restored byte-identical (`diff` against a copy).

Not run: `pnpm run verify` and the full `test:org` (this package has no such script; its own `test` is the rstest run above).

Measured: `VERDICT pass: 4 tests in 1 file` for the acceptance file, and `VERDICT pass: 444 tests in 4 files` with `work-gate.test.ts`, `wake-order-shape.test.ts` and `idle-hold-detector-in-gate.test.ts`, both read from the rstest run's own VERDICT line.
