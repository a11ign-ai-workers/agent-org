`blocker-cleared` is no longer typed for an other-tracker row whose open pull request closes it by the tracker's own reference. `rowsWithOpenPr` (`src/work-gate.ts`) read every closing reference against the PRIMARY tracker, so `Closes a11ign/agent-org#806` resumed nothing, and the holder was asked to pick the row up again while its work was in review. A reference is now read against the tracker the row is in (`row.repo`, set by `tagged` for every non-primary tracker), and a bare `#806` counts only when the pull request is in that same repository. `blockerClearedReading` asks the new predicate per row (`src/work-gate/tick.ts`).

Acceptance: `npx rstest run --config scripts/rstest/rstest.config.ts src/work-gate-stale-blocker-cleared.test.ts`

Measured: the acceptance command above, run in this worktree, 22 of 22 pass. `src/packaging/work-gate.test.ts` and `src/work-gate-cross-repo-pr-owner.test.ts` pass together (429 tests).

Fail before, pass after: the new test `agent-org#1162 an other-tracker row whose open pull request closes it is NOT re-offered, however the reference is written` fails on the unchanged code (1 of 22 red). Its probe reading before the change: `Closes a11ign/agent-org#806` typed one order, and `Closes #806` typed none.

Mutation: the tracker argument reverted to the primary (`trackerRepo: undefined`) with `src/work-gate.ts` otherwise unchanged, then restored and checked: 2 of 22 red (the new test, and the agent-org#805 THE POPULATION test, whose other-tracker placement now calls `blockerClearedReading` with a qualified closing reference).

Typecheck: `pnpm run typecheck` clean. There is no `lint` script in `package.json`, so no lint run.

Full suite: `pnpm test` gives 10974 tests in 646 files, 4 red: `host-install-agent-org-launcher.test.ts` (1), `live-tree-independence.test.ts` (2), `release-tag-on-merge.test.ts` (1). The same 4 are red on the unmodified base (checked by reverting, running those three files, and restoring the patch), so they are not from this change.

Not run: `agent-org wakes:per-row --from 2026-10-05 --to 2026-10-12` timed out at 300 s with no output. The command reads historical wakes, so its figure would describe wakes before this fix and could not show the fix's effect. The stale-0 reading the row asks for is left open for the next measurement window.

Not here, and named: a closing reference from a PR in ANOTHER code repository (for example `a11ign/a11y-witness` closing `a11ign/agent-org#806`) still does not reach blocker-cleared. `scopeTick` passes the scope's own `owned.prs` to `decide`, not the sibling PRs it already reads (`read.siblingPrs`). The same-repository case is covered by this change; the cross-repository one is open.

Closes a11ign/agent-org#1162

platform: a primary row is still resumed only by a reference to the primary tracker. One behaviour does change: a bare `#N` in a pull request of ANOTHER repository no longer resumes the primary row `#N`, because that reference names the other repository's `#N`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
