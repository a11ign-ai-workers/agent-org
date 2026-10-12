The claim guard that refuses a worktree's removal reads its row in the repository the tree belongs to. `treeRepo` (`src/worktree-removal.ts`) maps a `wt-<key>-<n>` directory to the tracker keyed `<key>`, and a `wt-<n>` directory or one naming no key to the first tracker. `claimRefusal` and `rowsClosed` read the row there, so `wt-agent-org-1159` no longer reads `a11ign/a11ign#1159`. A key no tracker declares is refused as "could not be determined" and no row is read. Nothing else in the guard changes.

Acceptance: `grep -q "same number in the primary" src/worktree-removal.test.ts && npx rstest run --config scripts/rstest/rstest.config.ts src/worktree-removal.test.ts`

Measured: the acceptance command above, run in this worktree, 5 of 5 pass.

Fail before, pass after: with `src/worktree-removal.ts` restored to `origin/main` and the test file's `treeRepo` import removed (so the file loads against the old module), 4 of 5 fail. The failure reproduces the incident: `wt-agent-org-1159 belongs to row #1159, which still carries session:worker-judge`, which is the primary's row. The one that passes is the primary-tree test, which is correct on both sides.

Mutation, in both directions, with `src/worktree-removal.ts` restored byte-identical each time (`cmp` against a copy):
- key ignored, always the primary: 4 of 5 fail (the primary-tree test correctly passes);
- undetermined fires for a keyed tree: 3 of 5 fail (the two agent-org `claimRefusal` tests and the `rowsClosed` test), the primary-tree and undeclared-key tests pass as they should.

Other suites: `npx rstest run --config scripts/rstest/rstest.config.ts` over `src/packaging/gh-call-ratchet.test.ts`, `src/packaging/host-units.test.ts`, `src/packaging/carry-branch.test.ts`, `src/packaging/prune-tmp.test.ts`, `src/packaging/prune-worktrees.test.ts`, `src/prune-tmp-janitor.test.ts`, `src/prune-worktrees-closed-row.test.ts`, `src/prune-worktrees-commits-only.test.ts` and `src/wake-reviewer-instance.test.ts`, with the new file: 410 of 410 pass in 10 files. `pnpm run typecheck` exits 0. There is no `lint` or `verify` script in this repository, so neither was run.

Not here, and named: `rowsClosed` (#3850) read the primary's row by the same bare number, so it moves to the same repository lookup. The `gh` call sites and their count are unchanged (the ratchet passes). The `Claimed-worktree:` record is not read separately: the guard receives only the tree's path and branch, and the `wt-<key>-<n>` directory name is the same key `claimNames` writes into that record.

Closes a11ign/agent-org#1216

platform: the lookup reads the tracker declaration `project-config.ts` already parses (`homeProjectDeclaration().tracker`), adding no machinery.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
