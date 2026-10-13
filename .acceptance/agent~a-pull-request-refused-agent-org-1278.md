A pull request refused for a red cross-repo leg is disarmed, not only commented on. On a `cross-repo-red` verdict `runArmPr` runs `gh pr merge --disable-auto` (`disarmRedLeg` in `src/arm-pr.ts`), then reads the pull request's state back: the auto-merge request and the merge-queue seat, as the evidence. The exit code of the write is never trusted. A queued pull request is dequeued through the existing `dequeuePullRequestOf`. The outcome is `disarmed`, `already in the queue` or `already merged`, and it is written to the marker comment's first line (`**Disarmed: yes|no (…)**`) and to the log line. A refused dequeue, or a PR still armed or queued after the write, exits `CANNOT_ASK` and names the command to run by hand. The read and the write live in `src/ticket-port/auto-merge-disarm.ts`, under the ratchet's exemption, so the `gh` call count in `arm-pr.ts` is unchanged.

The marker comment's dedupe is lead-aware: a comment made before this change (its marker, no disarm line) does not stand for this run's outcome, so a PR refused earlier is disarmed and gets a new comment carrying the outcome. A comment that already carries the same marker AND the same outcome line is not repeated.

Acceptance: `node --test src/packaging/cross-repo-red-disarms.test.ts`
Measured: the acceptance command above, run in this worktree, 8 of 8 pass.

Fail before: with `src/arm-pr.ts` restored to `18eb0f55`, 2 of 8 pass and 6 fail. The two that pass are the armed-declared control (6), correct on both sides, and the repeat-tick check (8), where the base's marker dedupe already posts nothing.

Control, disarm write (red when the write is removed): the write at `src/arm-pr.ts:335` (`disableAutoMergeOf(port)`) replaced by a no-op, 5 of 8 fail: (1) auto-merge enabled and not queued, (2) in the merge queue, (5) the outcome read back, (7) the pre-change refusal, (8) the repeat tick, whose seat stays armed so the outcome is `NOT disarmed`. The file is restored byte-identical (`cmp` against a copy).

Control, lead-aware dedupe (red when the dedupe ignores the lead): `body.includes(marker) && (!lead || body.includes(lead))` replaced by `body.includes(marker)`, 1 of 8 fails: (7), the pre-change refusal, which is no longer disarm-reported. (8) stays green, as it should: that comment carries the lead too. The file is restored byte-identical.

Same hole, the other two refusals (`open-blocker`, `ejected`), driven through `runArmPr` with the same seat states (armed and not queued; armed and queued), in a scratch drive that is not committed: both refuse with exit DONE, send no `--disable-auto` and no dequeue, and leave the seat as it was. Neither is changed by this row, as the row asks. The comment for those two still says nothing about the PR's state.

The #992 pin follows the new behaviour. `src/packaging/cross-repo-red-refusal.test.ts` (in this row's Region by the product-manager's ruling on the row) changes two things, and no #992 assertion is removed or loosened:
- `world()` answers the seat read with `{ id, merged: false, autoMergeRequest: null, mergeQueueEntry: null }`, and `driveArm`'s `merged` counts only merges without `--disable-auto`. Before this, `#992 (5)` failed (exit 2, the seat read answered nothing).
- The repeat-tick case seeds the comment the current code writes (its marker, `**Disarmed: yes (disarmed).**`, its refusal), not the pre-change marker-only comment. With the lead-aware dedupe, the old seed posts a second comment, which is the intended change from the reviewer's finding (b); the assertion "ONE comment for one file set" is unchanged.

Result: `cross-repo-red-disarms.test.ts` and `cross-repo-red-refusal.test.ts` together, 28 of 28 pass.

Full suite, `pnpm run test`: 6 of 11082 fail. Four are the same as on `18eb0f55`: `host-install-agent-org-launcher.test.ts` (3), `live-tree-independence.test.ts` (#3233 and its positive control), `release-tag-on-merge.test.ts` (the lockfile check). Two are new in this checkout and not caused by this change: `row-claim-refusal-record.test.ts` (the claim tool refuses with "this checkout's copy of the rule is 1 commit(s) behind the release the host runs"). This branch does not contain `8011fc45` (`Refuse a claim on a row whose Waiting-for is unmet`, touching `src/row-claim.ts`) which is on `origin/main`; the checkout is stale, and the three files this change edits are not on that path. `pnpm run typecheck` exits 0. The `gh-call-ratchet` test passes (8 of 8).

Not in this change: `src/auto-arm-sweep.ts:494` also announces a `cross-repo-red` refusal without disarming; it is the same hole, outside this row's Region, and is not changed here.

Post-merge: the next refused lab pull request must read `autoMergeRequest: null` after its refusal; that reading is a11ign/agent-org#1292. It needs a real refused lab PR, after the merge; it is not checked here.

Closes a11ign/agent-org#1278
