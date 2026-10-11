The merge guard decides whether an approval covers the head: an approval covers it when every PR commit after the approved one is a merge from `main` (a commit with two or more parents, none after the first among the PR's own `main...head` commits). Any other commit after the approval makes the `--ci-gate` verdict REFUSED with `APPROVAL DOES NOT COVER THE HEAD`; an unreadable review or compare is CANNOT_ASK, never covered. Comments never count, a later CHANGES_REQUESTED replaces an approval, and no approval at all raises no reason (branch protection requires one, and `gate` does not rerun on a review event).

Mutation: `isMergeFromMain` returning true always turns 4 of 8 tests red; returning false always turns the covered test red; each restore was byte-identical (`diff` of a copy in `${TMPDIR}`).

Not done: the "diff from the approved commit to head equals the diff main brought in" form (a rebase) reads as new work, conservatively. The live reading (a refreshed approved PR merges with no re-review) is posted on the row after merge. `tsc` and `eslint` could not run in this worktree (no installed toolchain types), so CI's reading stands in.

Acceptance: `bash -c 'cd /home/agent/repos/agent-org-wt-5038 && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/merge-guard-approval-head.test.ts'`

Closes a11ign/a11ign#5038
