A pull request refused for a red cross-repo leg is disarmed, not only commented on. On a `cross-repo-red` verdict `runArmPr` runs `gh pr merge --disable-auto` (`disarmRedLeg` in `src/arm-pr.ts`), then reads the pull request's state back: the auto-merge request and the merge-queue seat, as the evidence. The exit code of the write is never trusted. A queued pull request is dequeued through the existing `dequeuePullRequestOf`. The outcome is `disarmed`, `already in the queue` or `already merged`, and it is written to the marker comment's first line (`**Disarmed: yes|no (…)**`) and to the log line. A refused dequeue, or a PR still armed or queued after the write, exits `CANNOT_ASK` and names the command to run by hand. The read and the write live in `src/ticket-port/auto-merge-disarm.ts`, under the ratchet's exemption, so the `gh` call count in `arm-pr.ts` is unchanged.

Acceptance: `node --test src/packaging/cross-repo-red-disarms.test.ts`

Measured: the acceptance command above, run in this worktree, 6 of 6 pass.

Fail before: with `src/arm-pr.ts` restored to `18eb0f55`, 1 of 6 passes and 5 fail. The one that passes is the armed-declared control (6), which is correct on both sides.

Control (red when the disarm is removed): the write at `src/arm-pr.ts:331` (`disableAutoMergeOf(port)`) replaced by a no-op, 3 of 6 fail: (1) auto-merge enabled and not queued, (2) in the merge queue, (5) the outcome read back. The file is restored byte-identical (`diff -q` against a copy).

Same hole, the other two refusals (`open-blocker`, `ejected`), driven through `runArmPr` with the same seat states (armed and not queued; armed and queued), in a scratch drive that is not committed: both refuse with exit DONE, send no `--disable-auto` and no dequeue, and leave the seat as it was. Neither is changed by this row, as the row asks. The comment for those two still says nothing about the PR's state.

The #992 pin follows the new behaviour. `src/packaging/cross-repo-red-refusal.test.ts` (in this row's Region by the product-manager's ruling on the row) answers the seat read in `world()` with `{ id, merged: false, autoMergeRequest: null, mergeQueueEntry: null }`, and `driveArm`'s `merged` counts only merges without `--disable-auto`. No #992 assertion is removed or loosened: a refusal still posts its marker comment and sends no merge. Before the fixture change, `#992 (5)` failed (exit 2, the seat read answered nothing). After it, `cross-repo-red-refusal.test.ts` and `cross-repo-red-disarms.test.ts` together pass 26 of 26 in each of 20 consecutive runs.

Full suite, `pnpm run test`: 4 of 11080 fail, all four failing identically on `18eb0f55`: `host-install-agent-org-launcher.test.ts` (3), `live-tree-independence.test.ts` (#3233 and its positive control), and `release-tag-on-merge.test.ts` (the lockfile check). `pnpm run typecheck` exits 0. The `gh-call-ratchet` test passes (8 of 8).

Not in this change: `src/auto-arm-sweep.ts:494` also announces a `cross-repo-red` refusal without disarming; it is the same hole, outside this row's Region, and is not changed here.

Pending: the next refused lab pull request must read `autoMergeRequest: null` after its refusal. This needs a real refused lab PR; it is not checked here.

Closes agent-org#1278
