The trace-freshness check is tested against healthy schedules (a11ign/agent-org#837). `src/trace/freshness-healthy-schedules.test.ts` generates 200 seeded transcript schedules and drives each through the real `ingestTranscripts`, then reads `storeFreshness` with `sessionsWorking` at the same `now` on 5-minute ticks. A session that is working must never read STALE at a post-ingest tick. No shape is excluded.

**The shapes.** The generator carries the two false alarms of production: a finished session that keeps rewriting its bookkeeping (#704), and a state file lost in the middle of a run, which rebuilds the store and ends it with an old Codex rollout (#709). A tool result is written only when the next message comes after it (seed 183), and a burst ends on an assistant record (seed 56).

**The hold-back shapes are fixed, so nothing is excluded.** Two shapes were excluded while `freshness.ts` still counted held-back messages as work: the #836 shape (a session silent for ten minutes that speaks again inside the hold-back), and the 6-to-10-minute gap between two messages of one working session (agent-org#842). The #836 fix merged to `main` as #856 (`67f39ed0`), and with it no healthy schedule reads stale. The exclusions and the positive control that asserted the gap still read STALE were removed in the same change, because that control was written to go red the day `freshness.ts` is fixed.

**Positive control.** A session whose ingest is stopped for fifteen minutes must read STALE at the ten-minute mark.

Mutation: two single-line mutants of `freshness.ts`, each red and each restored byte-identical (`cmp` with the backup, and `git diff --quiet` against `origin/main`). The #704 mutant (`sessionsWorking` counts any touched transcript as working): 200 of 200 seeds fail. The #709 mutant (`newestTurnAt` stops after the first tail chunk, with no walk back): 55 of 200 fail, 13 of them at the cold-start tick and 42 at other ticks where the reader returns an older turn. HEAD passes 201 of 201.

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json node --import tsx --test src/trace/freshness-healthy-schedules.test.ts`

Measured: HEAD, `node --import tsx --test src/trace/freshness-healthy-schedules.test.ts`: 201 tests (200 seeds and the positive control), 201 pass, 0 fail, about 65 s, on this branch merged with `origin/main` at `239a8d6c`. Not run through rstest: `node_modules` is empty in this worktree.

Closes: a11ign/agent-org#837

platform: n/a (no GitHub, pnpm, systemd or git feature beyond the test runner)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
