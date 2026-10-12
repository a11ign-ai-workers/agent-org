A pull request the reviewer approved at its head, that GitHub still holds as `REVIEW_REQUIRED`, is filed under `pr-approval-not-counted` to `ceo`, not `pr-checks-failing` to its owner. Green-approved (`gate` present, settled) takes the draft order's branch in `draftOrder`; approved with `gate` absent and quiet 30 minutes takes the unordered branch in `unorderedPrOrders`. A red head keeps `pr-checks-failing` (the red order comes first), a draft keeps the reviewer's order, and a stale-head approval or an unapproved PR is unchanged.

Acceptance: `node --test src/pr-approved-not-counted-cause.test.ts`

Mutation: the draft branch removed failed tests 1, 3 and 7; the unordered branch removed failed test 2 only; the predicate forced on failed tests 4, 5 and 6. `src/work-gate/pr-orders.ts` restored byte-identical each time (`diff` against a copy).

Measured: `ℹ tests 7 / pass 7 / fail 0` for the acceptance file, and `ℹ tests 12 / pass 12` for `src/work-gate-unordered-review-pr.test.ts`. `pnpm run typecheck` exits 0. Full `pnpm test`: the three packaging and host files that fail (`live-tree-independence`, `release-tag-on-merge`, `host-config`) fail the same way on a clean HEAD worktree; `project-roles` and `work-gate` packaging lists are updated for the new cause.

Closes a11ign/agent-org#1249

platform: the order is a fact the gate already reads (`reviewStateOf`, `approvedAtHead`); no new `gh` call.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
