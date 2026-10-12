The org-health lab-jobs test no longer reads the host's live claim-refusal ledger or its declared copies. `orgHealthNow` (src/work-gate/org-health.ts) now takes an optional `readRefusals` and forwards it to `orgHealthTick` only when a caller supplies one, so production keeps the real ledger read by default. `tickOver` in src/packaging/org-health-queued-lab-jobs.test.ts passes `readRefusals: () => []` and `readCopies: () => null`, so a busy host (more than 10 `claim-refused` lines in 15 min) or a drifted checkout cannot trip `claim-refusal-storm` or `copies-drifted` in the test. `decideArgs.claimRefusals` is deliberately left alone: the row names it as the per-row streak record, not the ledger.

Acceptance: `bash -c 'cd /home/agent/repos/agent-org-wt-5157 && npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/org-health-queued-lab-jobs.test.ts'`

Mutation: the `readRefusals` forward removed from the `orgHealthTick` call in `orgHealthNow` (so the test's `() => []` is never used and the host ledger is read) failed 4 of 10 tests, with `claim-refusal-storm` present in the tick's orders. `src/work-gate/org-health.ts` restored byte-identical from a copy (`diff` against the copy).

Measured: `VERDICT pass: 10 tests in 1 file` for the acceptance file. `pnpm run typecheck` exits 0. Full `pnpm test`: `VERDICT fail: 15 of 10385 tests failed in 588 files`. The same 10 files fail with the same counts on a clean origin/main worktree (detached, run per file), so none of the 15 is caused by this change. Those 10 files are listed on the row as a finding and are not fixed here: `src/org-health-auto-off-refusal.test.ts`, `src/org-health-release-failed.test.ts`, `src/packaging/org-health-fleet-and-copies.test.ts`, `src/packaging/org-health.test.ts`, `src/packaging/wait-condition.test.ts` and `src/release-behind-main.test.ts` read the host ledger or copies through `orgHealthTick` (the same defect class, outside this row's Region); `src/packaging/live-tree-independence.test.ts` (`Cannot find module 'tsx/package.json'`), `src/packaging/release-tag-on-merge.test.ts` (pnpm-lock assertion), `src/work-gate-other-scopes-concurrent.test.ts` (`14 !== 16`) and `src/worker-stop-hook.test.ts` (`project-config.ts:518`) fail for other reasons.

Closes a11ign/a11ign#5157

Flag: none -- production passes no `readRefusals`, so the tick reads the failure ledger exactly as before; the only new path is the test's own stub.
Health-signals: claims-refused
Revert: revert this PR (it is a test seam and one optional forwarded argument).

platform: n/a (a test seam and a forwarded optional argument; no GitHub, pnpm, systemd or git feature reads or writes the ledger here).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
