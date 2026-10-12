A failure entry the ledger REFUSED no longer wakes `orchestrator`: `repeatedOrdersNow` returns no order when `recordFailures` reports `refused`, as it already did for `skipped`, so the order is sent only for a filing that happened (fix-forward of a11ign/agent-org#1098, a11ign/a11ign#5147). `src/order-verify.ts` changes one guard (`skipped > 0 || refused !== null`), and `src/order-verify.test.ts` gains the test that is red on the old line and green after.

Acceptance:

```bash
npx rstest run --config scripts/rstest/rstest.config.ts src/order-verify.test.ts
```

Closes a11ign/agent-org#1101

Measured at this head, in this worktree: the command above printed `VERDICT pass: 11 tests in 1 file`, and before the one-line change the same command printed `VERDICT fail: 1 of 11 tests failed in 1 file`, the failing test being "a repeat whose failure entry was REFUSED wakes nobody". `pnpm run typecheck` exits 0. The neighbouring set `src/order-verify.test.ts src/failure-ledger.test.ts src/decision-provider.test.ts src/work-gate.test.ts` printed `VERDICT pass: 64 tests in 4 files`.

Mutations, applied to the new guard in `src/order-verify.ts`, run, and restored byte-identical (`cmp` against a copy): (A) the guard never fires (`|| false`): the refused test fails, 1 of 11; (B) the guard always fires (`if (true)`): the switch-on test, the off control and the refused control fail, 3 of 11.

Done-when 3 (the reviewer's second finding): `node --experimental-strip-types -e "import('./src/cause-declaration.ts')"` imports cleanly at this head. Line 80 of that file is an ordinary function declaration, not a ReferenceError, so the import cycle did not reproduce here.

Open-check: `git grep -n "refused" origin/main -- src/order-verify.ts` showed only the comment at line 84 before this change, so the sentence "a refused failure entry wakes nobody" was false on main and is true on this branch.
