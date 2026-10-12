The daily retrospective's read has its own per-tick budget (a11ign/agent-org#1089). Once DORA was complete, the rest of the retro read (merged lists, open pull requests, journal, transcripts, GitHub reads) ran in one tick with no budget, past the gate's 300 s, so the tick was cut before the order was written and the day was never delivered. **The fix:** the read is ordered classes (`retroClasses`), and `readRetroClasses` does not start a class once `RETRO_TICK_BUDGET_MS` (60 s) has passed in the tick, always reading at least one. Each class's fields are kept in `retro-read-classes.json` as they are read, with the memory's used marks, so the next tick resumes at the first unread class. The order is offered only when every class is read; a cut tick logs `org-retro: read stopped at <class> after <n> s` on stderr.

**Mutation (two, each restored byte-identical with `cp` from the scratchpad and `cmp`):** `RETRO_TICK_BUDGET_MS` set to `600 * 1000` (3 red: THE CUT, THE RESUME, THE BUDGET IS WELL UNDER THE GATE'S; THE CONTROL stays green, as it must); the skip of classes already read removed (1 red: THE RESUME, the merged lists read a second time).

**Before the change:** the source at HEAD fails all 4 tests of the new file (`VERDICT fail: 4 of 4 tests failed in 1 file`).

**Evidence:** the Acceptance below, 4 of 4. The related retro suites (`org-retro-dora-resumes`, `packaging/org-retro`, `spec-lint` (which calls `readAll`), the three incident tests and `untiered-ready-rows`) run together: 170 passed, 0 failed. `tsc --noEmit` exits 0. The full rstest run has 15 failing tests in 10 files (`org-health*`, `live-tree-independence`, `release-tag-on-merge`, `wait-condition`, `release-behind-main`, `work-gate-other-scopes-concurrent`, `worker-stop-hook`); the same 15 fail with HEAD's `org-retro.ts`, so they are not from this change.

Acceptance: `npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/org-retro-tick-budget.test.ts`

Outside-Region: none. The Region is `src/org-retro.ts`, `src/packaging/org-retro-tick-budget.test.ts` and `.changeset/the-retro-read-has-its-own-tick-budget.md`.

platform: n/a (no GitHub, pnpm, systemd or git feature beyond the file reads and the rstest run)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
