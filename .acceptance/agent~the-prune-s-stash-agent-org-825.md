The prune refuses a dirty tree that holds intent-to-add entries (`git add -N`) before any ref is written, and the reason names those entries (the first three paths and a count) and git's stderr. Such a tree cannot be pinned by `git stash create`, which refuses it with `not uptodate. Cannot merge.`. Pinning their content is out of scope (product-manager's ruling, 2026-10-12).

Acceptance: `AGENT_ORG_HOST=$HOME/repos/role-product-manager/.agent-org/host.json node --test src/prune-worktrees-commits-only.test.ts`

Mutation: the three new `#4620 INTENT-TO-ADD` tests fail before the change (23 pass, 3 fail) and pass after it (26 of 26). Two mutation runs of the source each turned tests red (1 failing in one, 3 in the other), and the source was restored byte-identical to its backup (`diff` clean).

Measured: the acceptance file runs 26 of 26 at this head. `pnpm run typecheck` exits 0. The real tree `wt-3347` is refused with a reason naming 551 intent-to-add entries, and no `refs/salvage/` ref is written for it (read-only check).

Not run: `pnpm run lint` (this package has no lint script) and `pnpm run verify` (no verify script). The full `pnpm test` was not a clean pass here: 10 rstest files fail, and none of them imports the prune modules. Whether they also fail on the base commit is not checked, so this is not a claim that the whole suite passes.

Closes a11ign/agent-org#825

🤖 Generated with [Claude Code](https://claude.com/claude-code)
