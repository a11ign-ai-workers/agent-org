A claim that meets an existing local branch of its own row adopts it, with its commits, instead of refusing it, when an earlier claim record names that branch or its trailing row number is this row's and origin holds it. `worktreeTargetReason` read only the NEWEST claim record, and a gate release names no branch, so a released row's own unmerged work could never be picked up again. `claimWithWorktree` makes the tree with `git worktree add <tree> <branch>` for an adopted branch, and the failed-claim undo keeps an adopted branch rather than `git branch -D`ing its commits. Another row's branch, a local-only branch no record names, and a branch a tree already stands on are still refused, each with its remedy.

Acceptance: `bash -c 'cd /home/agent/repos/wt-agent-org-1285 && node --test src/row-claim-existing-branch.test.ts'`

Mutation: `isOwnRowBranch` made to return `true` at its start (adopt every local branch) failed the two refusal controls (another row's branch, and a local-only branch no record names); made to return `false` at its start (adopt nothing) failed the three adoption cases, including the lost-claim case that keeps the branch; the origin check removed from the trailing-number path (`&& true`) failed the local-only refusal. Each mutant was a copy in a scratch directory, and the real `row-claim.ts` was not changed.

Measured: against the original `row-claim.ts` from HEAD, 4 of 6 fail (the adoption and lost-claim cases) and both refusal controls pass. `node --test` on `row-claim-existing-branch`, `row-claim-worktree-cap`, `row-claim-writes`, `row-claim-installs-worktree` and `row-claim`: 64 of 64 pass. `pnpm run typecheck` exits 0. Full `pnpm test`: 5 of 11,178 fail in four packaging files (`host-install-agent-org-launcher`, `live-tree-independence`, `multi-board-gate`, `release-tag-on-merge`), the same 5 of 30 on untouched HEAD.

Not here, and named: an origin-only branch with no local ref still goes through `rowBranchRefusal` as before; this change covers a local branch only. The repository declares no lint script or lint configuration, so lint was not run.

Closes a11ign/agent-org#1285
