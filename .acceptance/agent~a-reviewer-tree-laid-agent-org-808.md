A reviewer tree laid before a tool-checkout prune can be installed into (a11ign/agent-org#808). `installIntoTree` removes the tree's top-level `node_modules` links that no longer resolve before `pnpm install` runs, so pnpm no longer `mkdir`s through a dangling `@rstest`-shaped link and the order stops being `UNDELIVERED` every tick.

**What changes.** `clearDanglingLinks` in `src/wake.ts`, called once from `installIntoTree`: for each entry of `<tree>/node_modules`, `lstat` says link and `existsSync` (which follows it) says no, then `rmSync` removes the link. A link that resolves, and a directory the tree owns, are left alone. The clone is never written. A removal that throws is a refusal naming the tree, not a thrown tick.

**Region.** `src/wake.ts`, `src/packaging/keyed-repo-review.test.ts`, plus the changeset entry `.changeset/reviewer-tree-clears-dangling-links-808.md`.

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json node --test src/packaging/keyed-repo-review.test.ts`

Mutation: the clear never fires (`if (false)`) -> 2 red (the positive and the control, since the install then throws as pnpm did); the clear removes every link, resolving or not -> 2 red (the positive, because the tree loses `yaml` and the install does not restore it, and the control). Each restored with `cp` and `diff`ed byte-identical.

Evidence: `keyed-repo-review.test.ts` 20 of 20 (18 existing, 2 new: `#808 (positive)` and `#808 (control)`, run with `node --test`, measured). The row's own Acceptance one-liner, run against this worktree's `src/wake.ts`, exits 0 (measured; it exits 1 on `origin/main` per the row, not re-measured here). `tsc --noEmit -p tsconfig.json` printed nothing.

Not done: Done-when 2 (no `UNDELIVERED reviewer-agent-org-782` line across the next release that changes a dependency) is a live reading of the tick journal and cannot be made before the release; the row's Open-check covers it.

Closes: a11ign/agent-org#808

🤖 Generated with [Claude Code](https://claude.com/claude-code)
