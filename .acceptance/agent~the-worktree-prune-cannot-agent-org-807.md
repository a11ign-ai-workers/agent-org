The salvage ref of a dirty tree is named per tree, not per directory basename: `<basename>-<8 hex of sha256(absolute path)>-<epoch>` (and `…-head-<epoch>` for a detached HEAD), so three trees named `tree` under different parents pin to three refs instead of colliding on `reference already exists`. A failed `git stash create` or `update-ref` now names git's own stderr in the "could not be pinned" line (first 200 characters, whitespace collapsed), not only the command that failed.

Acceptance: `pnpm exec node --import tsx --test src/prune-worktrees-commits-only.test.ts`

Mutation: the name made per basename again (`salvageTreeKey` → `salvageTreeName` at the `salvageTracked` call) failed 3 of 23 tests: SALVAGE, SAME NAME and DETACHED; the reason made message-only again (`failureDetail(cause)` → the old `message.split("\n")[0]`) failed SALVAGE CONTROL 2b/4 only. `src/prune-worktrees.ts` restored byte-identical each time (`cmp` against a copy of the fixed file).

Measured: `ℹ tests 23`, `ℹ pass 23`, `ℹ fail 0` for the acceptance file (SAME NAME: three `a|b|c/tree` trees get three distinct refs, each ref's `app.txt` carries its own edit; SALVAGE CONTROL 2b/4: a failed `stash create` names its stderr). `pnpm run typecheck` exits 0. The related `src/packaging/*` tests (led by `primary-checkout-guard.test.ts`) show 15 failures in a run over a pristine HEAD archive (`pass 116`, `fail 15`); they are fixture git/origin failures that predate this change, and are not fixed here. The four packaging files that refuse at import without `AGENT_ORG_HOST` were run against a scratch host declaration, not a live one.

Not here, and named: the second cause of the "could not be pinned" line seen in the journal for `wt-3347` (`agent/bring-the-four-published-3347`) is not fixed in this PR. Its stderr is `error: Entry 'packages/agent-org/.github/CODEOWNERS' not uptodate. Cannot merge.` followed by `Cannot save the current worktree state`: the index holds staged entries that no longer match their working-tree files, so `stash create` refuses. That is a state of that worktree, not of the naming, and filing it is the row's item 3.

Closes a11ign/agent-org#807

platform: Linux, git 2.53.0 `stash create` / `update-ref` / `for-each-ref` under `refs/salvage/*`, Node 24 with `tsx`; the prune runs as `a11ign-worktree-prune.service`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
