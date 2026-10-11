The trace-freshness check is tested against healthy schedules (a11ign/agent-org#837). `src/trace/freshness-healthy-schedules.test.ts` generates 200 seeded transcript schedules and drives each through the real `ingestTranscripts`, then reads `storeFreshness` with `sessionsWorking` at the same `now` on 5-minute ticks. A session that is working must never read STALE at a post-ingest tick, except for two named exclusions.

**The shapes.** The generator carries the two false alarms of production: a finished session that keeps rewriting its bookkeeping (#704), and a state file lost in the middle of a run, which rebuilds the store and ends it with an old Codex rollout (#709). A tool result is written only when the next message comes after it (seed 183), and a burst ends on an assistant record (seed 56).

**The exclusions, named.**
- `known836` (agent-org#836): a stale reading whose stored turn is the last message before a transcript silence of at least 10 minutes. Seeds 78 and 105 are of this shape (transcript silence 12.9 and 10.7 minutes). A turn from before the schedule (the old Codex rollout) is never excluded.
- `knownHoldBackGap` (agent-org#842, the freshness.ts fix row): a stored turn held back 6 to 10 minutes behind the newest message, while the message is still inside the quiet window.

**Positive controls.** A session whose ingest is stopped for fifteen minutes must read STALE at the ten-minute mark. A session with the 6-to-10-minute gap must read STALE, so the `knownHoldBackGap` exclusion has to come out when `freshness.ts` is fixed.

**What changes.** Test and changeset only. `src/trace/freshness.ts` is untouched.

Mutation: two, each red and each restore byte-identical (`cmp` with the scratchpad copy, and `git diff --quiet`): pre-#704 (`79a8bdc9^`, working by mtime) 104 of 202 fail; pre-#709 (`2a17faa9^`, single 1 MiB tail) 66 of 202 fail. HEAD passes 202 of 202.

Measured: HEAD `node --import tsx --test src/trace/freshness-healthy-schedules.test.ts`: 202 tests, 202 pass, 0 fail, about 65 s, on this branch. Not run on `main` directly; `node_modules` is empty in this worktree, so rstest is not available here.

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json node --import tsx --test src/trace/freshness-healthy-schedules.test.ts`

Closes: a11ign/agent-org#837

platform: n/a (no GitHub, pnpm, systemd or git feature beyond the test runner)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
