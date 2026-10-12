A holder that declares its wait in a `Waiting-for:` line of the row's body is read `waiting` while the condition is unmet, so it is neither nudged nor ledgered as `claimed-worker-stalled` (agent-org#1183, class repeat of a11ign#5156).

**What changes.**
- `src/work-gate/claim-stall-tick.ts`: `declaredWaitOf` falls through to `waitingForOf` when the row's fields declare no wait. `waitingForOf` reads the body's `Waiting-for:` line (`declaredWaitsOf`, `waitItemOf`) and returns `{ kind: "waiting-for", phrase }` only when `conditionHolds` is `false`. A `null` (manual, unread reference, unreadable line) is not an excuse. `waitFacts` is threaded from the gate's own facts through `claimStallsWithFacts` (`src/work-gate/tick.ts`), `claimStallsNow`, and `claimStallTick` to `readClaims`; another tracker's rows read against no facts, since their bare `#n` are not the home repository's.
- `src/work-gate.ts`: passes `waitReads?.facts ?? null` to `claimStallsWithFacts`.
- `src/work-gate/claim-stall-waiting-for.test.ts`: six tests through the real `claimStallTick` and `recordStalledNudges`.
- `src/work-tick-cost.test.ts`, `src/packaging/closed-row-ends-instance.test.ts`: pinned call text updated for the new argument.
- `kind` stays out of `WAIT_RELEASE_KINDS`, so no change to `waitReading`.

**Measured.** `node --test src/work-gate/claim-stall-waiting-for.test.ts`: 6 of 6. Controls: the same row with no line is nudged at `STOPPED_CLAIMANT_MINUTES`; with the condition met it is nudged at the same minute and ledgered the same; a condition that flips to met at minute `FLIP` is nudged at `FLIP + STOPPED_CLAIMANT_MINUTES`, the grace from the first idle reading.

**Mutation.** `waitingForOf` disabled: tests (a), (b), (e) red; (d) green by design, since a met condition and no excuse both nudge at the figure. Unknown conditions treated as unmet: (f) red. Each restore byte-identical (`cmp` against a copy in the scratchpad).

**Evidence.** `pnpm run typecheck` exit 0. The related claim-stall suites (`work-gate-claim-stalled`, `claimed-worker-stalled-ledger`, `claim-stall-hand-start`, `work-gate-claim-stall-other-tracker`, `work-tick-cost`, `closed-row-ends-instance`, `idle-claimant-stopped`) plus the new file: 264 of 264. Full `pnpm test`: 5 of 10785 fail, all in `src/packaging/` (`org-health`, `release-tag-on-merge`, `host-install-agent-org-launcher`, `live-tree-independence`), which import none of the changed modules; those assertions concern the lockfile and launcher state, not this change. Not yet run on a clean HEAD.

Acceptance:
```bash
node --test src/work-gate/claim-stall-waiting-for.test.ts
```

Closes a11ign/agent-org#1183.

platform: n/a (claim-stall reader; no platform surface)

Outside-Region: src/work-gate.ts — passes the facts the gate already reads into the claim-stall pass, one argument.
Outside-Region: src/work-tick-cost.test.ts, src/packaging/closed-row-ends-instance.test.ts — pinned call text, updated for that argument.
Outside-Region: .changeset/a-holder-that-declares-its-wait-in-a-waiting-for-line-is-not-nudged.md — the entry a project that pins a tag reads.
