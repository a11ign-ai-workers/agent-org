`readPrs` (`src/work-gate/reads.ts`) no longer writes `work-gate: the open list is read whole (too-old: ...)` for a repository whose open list is empty. An empty list is never remembered, so a repository that went empty kept its old entry, which aged past the reconcile and logged the line every tick: 60 consecutive ticks on 2026-10-13 while a11ign/a11ign had no open pull request (last merge 05:27:12Z, next PR 07:47:31Z). The read is unchanged; the line is written after it, and only for a list that is not empty or a refused read.

Acceptance: `npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/work-gate-scopes-and-due-index.test.ts`, run from the worktree with `AGENT_ORG_HOST` and `GH_REPO` set as the tick's unit sets them.

Mutation: the guard removed (the line written unconditionally, as before) turns the new test red (1 of 26); restored, 26 of 26 pass. The same test's second half is the positive control: a stale memory with a non-empty list still says `too-old`.

Not measured: the full suite was not run, and no live tick was observed after the change.

Closes a11ign/agent-org#1300

🤖 Generated with [Claude Code](https://claude.com/claude-code)
