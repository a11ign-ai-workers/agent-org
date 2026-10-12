The board audit reads two switch rows for different flags as near-duplicates no longer (agent-org#1200, a11ign#5216-#5219 and #5230). `nearDuplicates` refuses a pair whose `Switch on the flag of <repo>#<n>` titles name different references, beside the class-repeat rule (`namesDifferentFlags`). A title not of that form, or two naming the same reference, are compared by words as before.

**What changes.**
- `src/board-truth-audit.ts`: `namesDifferentFlags` and its `switchRowRefOf` reader, next to `namesDifferentFailureClasses`; `nearDuplicates` gains one `!namesDifferentFlags` term. Nothing else moves: the repository rule, the class-repeat rule, the thresholds and `Superseded by` are untouched.
- `src/board-truth-audit.test.ts`: one test, named `switch-row titles naming different flags are not near-duplicates (agent-org#1200)`, with the a11ign#5216 and #5217 titles as the fixture.

Mutation: predicate forced to never fire (the new test red, 1 of 57); forced to always fire (6 of 57 red, the new test among them); each restore byte-identical (copy in the scratchpad, `diff`).

Evidence: `src/board-truth-audit.test.ts` 57 of 57 at this head; the test fails on the base files at its first assertion (#5217 read as a twin of #5216). `tsc --noEmit` clean. Full `rstest run`: 10839 pass, 4 fail in `src/packaging/` (launcher, live-tree-independence, release-tag-on-merge), the same 4 on the base files, so not this change.

Acceptance: `bash -c 'cd /home/agent/repos/agent-org && grep -q "switch-row titles" src/board-truth-audit.test.ts && npx rstest run --config scripts/rstest/rstest.config.ts src/board-truth-audit.test.ts'`

Note: that command reads the primary checkout, which has no `switch-row titles` test until this lands; run in this worktree it passes.

Closes a11ign/agent-org#1200.

platform: n/a (a title predicate inside the board audit's own near-duplicate rule; no platform feature does this)
