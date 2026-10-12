No claim-stalled or blocker-cleared wake is typed for a row whose holder has an open pull request, except the red-check nudge (agent-org#805).

An open pull request of the holder's is the holder working, so it is never a claim-stalled nudge. The one exception is the red-check nudge (`redCheckNudgePrompt`), which the #1151 ruling names: a red own pull request is still nudged. A held pull request (`hold:` label) stays out of blocker-cleared's own-pull-request drop, as before (#2493); that is the one deliberate exception to the strict reading.

Closes a11ign/agent-org#805

Acceptance: `npx rstest run --config scripts/rstest/rstest.config.ts src/work-gate-stale-blocker-cleared.test.ts` gives `VERDICT pass: 20 tests in 1 file`. Acceptance file: `.acceptance/agent~no-claim-stalled-or-agent-org-805.md`.

What changed:

1. **Claim-stall** (`src/claim-stall.ts`, `overlayReading`). A non-red open pull request of the holder's returns the clock reading (`pr-owned`) and never a nudge. The young-pull-request regime that typed nudges for an open pull request is removed, and its `#4017` note with it. A red own pull request still goes through the nudge path (`redOwnPrs`).
2. **Population test** (`src/work-gate-stale-blocker-cleared.test.ts`, "agent-org#805 THE POPULATION"). It runs `claimStallTick` every 5 minutes for 240 minutes, with memory carried, and `blockerClearedReading` for home rows, for a held row with an open closing pull request in each tracker. It asserts no order is typed. The positive control is the same row without the open pull request, which is typed. The population test reproduced the stale wakes before the fix.
3. **Out-of-Region test updates** (`src/packaging/idle-claimant.test.ts`, `src/idle-claimant-stopped.test.ts`, `src/work-gate-claim-stalled.test.ts`, `src/work-gate-idle-again-incident.test.ts`, `src/worker-state.test.ts`). Expectations that a green open pull request is counted or nudged are flipped to `pr-owned`, with no order. The #743 counted-nudge controls use a red pull request, so the red exception is what they measure. Each changed assertion carries an `agent-org#805` comment.
4. **Changeset** (patch).

Per-path table (wakes in the retro window, from the wake log; `stale` = typed after the holder's pull request opened):

| path that typed the wake | wakes | stale | minutes after the pull request opened |
|---|---|---|---|
| claim-stalled (overlayReading, young-pull-request regime) | 40 | 20 | 11 to 116 |
| blocker-cleared (agent-org rows, other tracker; `tick.ts` feeds home rows only) | 16 | 7 | 1 to 107 |
| total | 56 | 27 | |

19 of the 56 wakes had no pull request found. The claim-stalled stale wakes come from the path this PR removes. The 7 blocker-cleared stale wakes are the other-tracker gap, filed as a11ign/agent-org#1162. The retro reads `stale` at 0 for claim-stalled after this lands; the 7 blocker-cleared remainders stay until #1162 merges.

Measured:
- `npx rstest run --config scripts/rstest/rstest.config.ts src/work-gate-stale-blocker-cleared.test.ts`: `VERDICT pass: 20 tests in 1 file`.
- `src/packaging/idle-claimant.test.ts`: `VERDICT pass: 41 tests in 1 file`.
- Acceptance file plus the claim, idle, worker-state and red-pull-request suites (13 files): `VERDICT pass: 314 tests in 13 files`.
- `pnpm run typecheck`: exit 0, no errors.
- `pnpm test`: `VERDICT fail: 5 of 10781 tests failed in 628 files`. Four are the pre-existing failures: `host-install-agent-org-launcher` (test 3), `live-tree-independence` (2), `release-tag-on-merge`. The fifth is `org-health` "a refused merge read is said on stderr as an UNKNOWN". It fails when run alone, and its output contains a real GitHub incident read from githubstatus.com. The test stubs `gh` but not that status fetch, so the failure looks environmental. I have not run it on `main` to confirm. `work-gate-other-scopes-concurrent` and `worker-stop-hook` failed in an earlier full run and passed in this one.

Not here, and named:
- The other-tracker blocker-cleared gap (a11ign/agent-org#1162). The population test covers blocker-cleared for home rows only.
- The wakes-per-row reader's handling of a corrupt line (a11ign/agent-org#1163), found while reading the retro's input.

Outside-Region: src/packaging/idle-claimant.test.ts — the #743 assertions that a green open pull request is counted or nudged; flipped to pr-owned by this row (agent-org#805).
Outside-Region: src/idle-claimant-stopped.test.ts — the twin test for an open pull request held by a green holder, same expectation flipped (agent-org#805).
Outside-Region: src/work-gate-claim-stalled.test.ts — the claim-stalled tick expectations for an open pull request, flipped to pr-owned (agent-org#805).
Outside-Region: src/work-gate-idle-again-incident.test.ts — the idle-again incident expectations for an open pull request, flipped to pr-owned (agent-org#805).
Outside-Region: src/worker-state.test.ts — the worker-state expectation for a holder with an open pull request, flipped to pr-owned (agent-org#805).

Flag: none -- the defect is the typed wake itself, so a flag left on would keep the wrong nudge and a flag left off ships nothing; the release path is unchanged and what this stops is a nudge, so the bound is a revert.

Health-signals: claims-refused, wakes-held

Revert: revert this pull request. No state is added, so nothing needs cleaning.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
