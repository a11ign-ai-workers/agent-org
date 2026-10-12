A Ready row whose body declares an open `Waiting-for: merged <ref>` (or `closed <ref>`) is shelved in `blocked` and not offered to the pool. The reason names the line. A wait that is unknown (an unreadable line, `manual`, or a reference the facts do not hold) and a tick with no wait facts are still offered: a failed read never shelves a row. `partitionUnclaimed` takes the facts as `waitFacts` and checks each declared wait with `conditionHolds` from `wait-condition.ts`; `decide` passes them through (`tick.ts`), and `main` reads them once ahead of the decision (`waitReadsBeforeDecide`) and hands the same read to `orgHealthNow`'s `readWaits`, so the gate makes the wait reads it already made.

Acceptance:

```bash
cd /home/agent/repos/wt-agent-org-1075 && npx rstest run --config scripts/rstest/rstest.config.ts src/work-gate-waiting-for-offer.test.ts
```

Closes a11ign/agent-org#1075

Measured: that command printed `VERDICT pass: 5 tests in 1 file`. The five cases are the open `merged` ref shelved with its reason named; the same row offered once the ref is merged (control); a `closed` wait shelved while open and offered once closed; an unreadable wait, an unread reference and absent facts all offered; and `decide` offering nothing for the shelved row and one for its control.

Mutation: with the new `blocked.push` replaced by a no-op (`void ({...})`) in `src/work-gate/causes/rows-claims.ts`, the same command printed `VERDICT fail: 1 of 5 tests failed`. The file was restored from a copy and `diff` confirmed it identical before the rerun printed `VERDICT pass: 5 tests in 1 file`.

Related checks, run on this branch: `src/packaging/gh-call-ratchet.test.ts` and `src/packaging/work-gate.test.ts` pass unchanged, and the work-gate offer tests (`src/work-gate*.test.ts`, `src/work-gate/`) and `src/claimed-region-overlap.test.ts` pass except for one test that already fails on clean `HEAD` (`src/work-gate-other-scopes-concurrent.test.ts`, "each other repository's `main` is asked in the same wave": `14 !== 16` at line 117, reproduced on a clean worktree of `HEAD`, not this change). `src/unpark-satisfied.test.ts` has one pin updated: its source match was for the `readWaits: unparkingWaits(waitTickFacts, ...)` call site, which now takes the one read made ahead of the decision (`() => waitReads`), and it also asserts that read. `pnpm run typecheck` prints no errors. There is no `lint` script in `package.json`.

platform: n/a (gate offer path)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
