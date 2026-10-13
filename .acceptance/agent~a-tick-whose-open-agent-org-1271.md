A tick whose open rows were not read records no `owner-unresolved` failure. `withClosingRowOwners` marks a pull request it could not look up because the open-rows list is empty (`ownerRowsUnread: true`), only when it has no standing label and no `rowOwner`; `unresolvedOwnerEvents` leaves such a pull request out of the ledger and says how many on stderr. A pull request whose rows WERE read and who still lands on `ceo` is recorded exactly as before. The ladder itself is unchanged: the flagged pull request still falls to `ceo` for its order.

Acceptance: `bash -c 'cd /home/agent/repos/wt-agent-org-1271 && node --test src/pr-ownership-rows-unread.test.ts src/pr-ownership.test.ts'`

Mutation (each guard broken in both directions, file restored byte-identical from a backup each time, `diff` to prove it):
- flag never set (`if (false)`): fails the ended-label case only.
- flag always set (`if (true)`): fails the control and the owner-gone case, 2 of 3.
- recorder ignores the flag (filter removed): fails the ended-label case only.

Measured: `pr-ownership-rows-unread.test.ts` 3/3 pass after the change; the ended-label case was red before it (`actual: [owner-unresolved agent-org#4626]`). `pr-ownership.test.ts` 11/11 pass. `src/packaging/pr-owner-*.test.ts` and `src/failure-ledger.test.ts` 72/72 pass. `pnpm run typecheck` exit 0.

Full suite (`pnpm test`): `VERDICT fail: 4 of 11074 tests failed in 657 files`. The four are `host-install-agent-org-launcher` (3.), `live-tree-independence` (#3233, two cases: `Cannot find module 'tsx/package.json'`, a dependency the test resolves and `package.json` does not declare), and `release-tag-on-merge` (the lockfile check, which `origin/main` also has). None imports the changed modules. The same four failing test names were run on a detached `origin/main` worktree and failed identically (`ℹ fail 4`), so this change adds no failing test and these four are not caused by it. `pnpm run verify` is therefore not green on `main` either, for reasons this row does not touch.

Changeset: `.changeset/a-tick-whose-open-rows-were-not-read-records-no-owner-unresolved.md` (patch), since `src/` is releasable.
