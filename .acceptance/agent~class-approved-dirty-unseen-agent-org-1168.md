An approved pull request that has been DIRTY for more than 30 minutes, with no push to its head inside that window, is a named org-health finding with its age, and clears when the PR rebases or merges. The three readings (`approved-pr-dirty`, `holds-per-pr`, `rerun-failed-the-same-way`) sit behind `health.approvedDirty`, which ships OFF: with the flag off they return nothing. The reading takes `dirtySince` from the caller, because GitHub gives no DIRTY timestamp; an undated DIRTY PR is unknown, not clear.

Acceptance: `bash -c 'cd /home/agent/repos/wt-agent-org-1168 && node --test src/org-health-approved-dirty.test.ts'`

Mutation: dropping the over-30-min check failed 1 test (the 29-min negative control); always tripping failed 5; ignoring the flag failed 2; ignoring the head push failed 1; a holds threshold of 1 failed 1; a rerun that ignores same-ness failed 1. `src/org-health.ts` restored byte-identical each time (`cmp` against a scratch copy).

Measured: `ℹ pass 14, ℹ fail 0` for the acceptance file; against the committed `src/org-health.ts` the same file fails at import (`does not provide an export named 'APPROVED_DIRTY_FLAG'`). With `src/org-health*.test.ts`, `src/work-gate/org-health*.test.ts` and `src/packaging/flag-switch-ledger.test.ts`: 97 pass. `pnpm run typecheck` exit 0.

Not here, and named: the live gate (`src/work-gate/org-health.ts`) does not yet pass `approvedDirty` facts; the suppression table (`src/work-gate/org-health-suppression.ts`) does not yet register the three classes; the a11ign switch row for `health.approvedDirty` is not yet filed. `pnpm test` (rstest) fails one test in `src/packaging/org-health.test.ts` on the committed code as well.

Closes a11ign/agent-org#1168

🤖 Generated with [Claude Code](https://claude.com/claude-code)
