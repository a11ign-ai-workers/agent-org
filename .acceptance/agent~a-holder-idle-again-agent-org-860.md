A holder that was nudged and is idle again a full period after the nudge was DELIVERED files a `claimed-worker-stalled` incident from the tick, on any declared tracker, and `IDLE_CLAIMANT_MINUTES` is 30 (a11ign/agent-org#860, a11ign#4957 cause 3).

**What changes.**
- *The tick writes the incident.* `claim-stall.ts` marks a `nudged` reading `idleAgain` (`idleAgainReading`) when the holder's herdr status has been `idle`/`done` for one period (`idleLimitMs`: M for a stopped holder or one under the declaration regime, N otherwise), counted from the later of its first idle tick after the nudge and the nudge's DELIVERY. `stalledNudgeEvents` writes it with the ref a release uses (`<session>/#<row>/<nudgedAt>`), so a release later is the same ledger line. The run's start is kept in `claim-stalls.json` and dropped the tick the holder is not idle.
- *N is 30.* `IDLE_CLAIMANT_MINUTES` 45 to 30; M (10) and `IDLE_CLAIM_INCIDENT_MINUTES` (60) are unchanged.
- *Not read, and said:* "no wake since the nudge" is not subtracted; a declared wait, a pending check (regime off) and a worker that moved are, through the overlay's existing readings.

Mutation (each restore byte-identical, `diff` of a scratchpad copy): the writer never fires (6 red of the new file's 8, none elsewhere); it fires on every `nudged` reading (9 red, including `only an UNANSWERED nudge is an event` and the old "a fresh nudge appends NOTHING"); the period ignored (6 red); an undelivered nudge counted (2 red, the never-told case and the old #2999 PR holder case).

Evidence: `src/work-gate-idle-again-incident.test.ts` 8 of 8; the 51 `node:test` files naming idle-claimant, claim-stall, idle-claim-incident or org-retro pass together (1447 tests) after the three numeric pins of 45 and one 30-minute fixture were moved; `pnpm run typecheck` is clean. `work-gate-stale-blocker-cleared.test.ts` is an rstest file and fails under `node --test` for want of the `rs` API, as it does on `main`.

Acceptance: `git grep -q "POSITIVE CONTROL" -- src/work-gate-idle-again-incident.test.ts && AGENT_ORG_HOST=$HOME/repos/role-product-manager/.agent-org/host.json node --test src/work-gate-idle-again-incident.test.ts src/work-gate-claim-stalled.test.ts`

Outside-Region: src/idle-claimant-stopped.test.ts — pins `IDLE_CLAIMANT_MINUTES` at 45 (a numeric pin, moved by the change that moves it).
Outside-Region: src/packaging/idle-claimant.test.ts — the same pin, and the boundary test around it.
Outside-Region: src/idle-claim-incident.test.ts — the idle-nudge fixture dates its run by `IDLE_CLAIMANT_MINUTES`; the nudge is now 45 minutes ago to keep the 75-minute figure.

platform: n/a (a clock and a ledger line; nothing GitHub, pnpm, systemd or git does)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
