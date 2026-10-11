Twelve more list readers use connections, not GitHub search, and `no-search-reads.test.ts` walks them (a11ign/a11ign#5076, the third half of #5050; the first two are #5074 and the gate).

**What changes.**
- By-label lists read `repository.issues(labels:)` through `readRowsByLabel`: `ready-label-audit.ts` (the ready rows with bodies, the out-of-release rows), `untiered-ready-rows.ts`, `board-snapshot.ts`, `provider-low-confidence.ts` (open and closed), `org-retro.ts` (the claimed rows with their comments), `dora.ts` (the regression rows, open and closed).
- Merged, closed and created WINDOWS read the `pullRequests`/`issues` connection newest-first back to the window's start, through the new `ticket-port/rows-since.ts`, and keep each row by its own `mergedAt`/`closedAt`/`createdAt` (a merge is an update, so none is missed): `board-data.ts`, `close-rows-sweep.ts`, `hand-fix-ledger.ts`, `dora.ts`, `org-retro.ts`, `trace/haiku-tier-report.ts`, `messaging/watch.ts`.
- `close-rows-for-merged-pr.ts`'s verify-row lookup reads the newest 200 rows (open and closed) and matches the build's `verify-row` marker.
- `messaging/watch.ts`: `--label` and `--search` are no longer allowed flags; `assertReadOnlyGh` admits `api graphql` only as a `query` document with `-F` variables (no mutation, no subscription, no `@file`).
- `no-search-reads.test.ts` walks all twelve, tests its marker in both directions, and pins the new reader's behaviour.

**Cost named, not hidden.**
- A window longer than ten pages (1,000 rows; 500 for `board-data.ts`, 5,000 for `hand-fix-ledger.ts`) is REFUSED, never returned in part. A merged window is read by `updatedAt`, so a window in which more rows were merely touched than merged can refuse where the search would have counted.
- The verify-row lookup does not see a row older than the newest 200 rows; it exists for the re-run of a close that already filed one, and that row is as new as the merge.
- `watch.ts`'s merged count is `unread` (as a list at its limit is) when more than 600 merged pull requests (100 a page, one past the summary's limit of 500 rows) were updated in 24 h.

**Not done, and why.**
- `fleet-gated-nightly.ts`, which lists through `work-gate.ts`'s selector, is its own row (done-when 2): `work-gate.ts` is held by other rows.
- `ready-label-audit.ts`'s `fetchReportedOpenIssueNumbers` still reads REST `search/issues`, by design (#788: "GitHub's search index, asked the identical question a second way", the independent cross-check of `fetchIssues`). It is one paginated call per audit run and not a `--label`/`--search` list; converting it would remove the independence it exists for. Said here so the sentence "none of the twelve lists rows through a search" is read as "through the `gh` list flags".
- `liveVerifyEffects.findExisting` and `reportReleaseDrift` call the module-level `gh` and take no injected `run`, so they have no direct test; they read through `readRowsSince`/`readRowsByLabel`, which are tested.
- The guard walks array literals that start `["issue"|"pr", "list", ...]`; a `["--label", x]` array spread into a list argv elsewhere is not seen by it (as before). After this change none of the twelve builds one.
- No live reading: the list-call rate after a release needs an hour of ticks.

Acceptance:

```bash
bash -c 'npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/no-search-reads.test.ts'
```

Measured: that command prints `VERDICT pass: 23 tests in 1 file` at this head (15 before this change).

The whole suite (`npx rstest run --config scripts/rstest/rstest.config.ts`, 10,149 tests) at the head after `origin/main` was merged in: 13 failed. Five fail by the same names on a clean `origin/main` worktree (measured: `live-tree-independence` (2), `release-tag-on-merge`, `work-gate-other-scopes-concurrent`, `worker-stop-hook`: 5 failures in those eight files there, the other three files green); the other eight are `src/messaging/secret.test.ts`, which this change does not touch, and which passes alone in this tree and on `origin/main` (18 of 18 each), so it is a failure of the shared host under a parallel run and not of this diff. One earlier run at the pre-merge head had a sixth, `git-reads-name-their-checkout` #3363 (1), which was this change's `gh` fake and passes now (14 of 14). `tsc --noEmit -p tsconfig.json` prints nothing.

Mutation: each run by copying the file aside, mutating, running `no-search-reads.test.ts`, restoring and `diff`ing the restore (byte-identical in all six).
1. `["issue", "list", "--repo", r, "--state", "open", "--label", "ready", ...]` appended to `src/dora.ts`: 2 red, "NEGATIVE CONTROL (source): no file ... builds a list argv carrying `--label` or `--search`" and "a `--label` or `--search` list added to any of the twelve is SEEN by the walk".
2. `["pr", "list", "-R", r, "--state", "merged", "--search", ...]` appended to `src/messaging/watch.ts`: the same 2 red.
3. The guard broken so it never fires (`if (false && lists && ...)`): 2 red, the fixture test and the added-list test, and nothing else.
4. The guard broken so it always fires (every `issue list`, flagged or not): 3 red, the walk, the added-list test and the fixture test.
5. `rows-since.ts`'s cut at the first row before the window removed: 1 red, "the window ends at the first row before it, and no page past that is asked".
6. `rows-since.ts`'s refusal of a window longer than its pages removed: 1 red, "a window longer than its pages is REFUSED, never returned in part".
7. Unmutated: 23 of 23 pass.

Closes: a11ign/a11ign#5076

platform: GitHub's own GraphQL connections (`repository.issues(labels:)`, `pullRequests`/`issues` ordered by `UPDATED_AT`) and the `host/gh` identical-read cache; nothing built beside them. The one new module is the paging of a window, which a connection has no filter for.

Outside-Region: src/ticket-port/rows-since.ts — NEW: the one reader of a merged, closed or created window as a connection (`pullRequests`/`issues`, newest first, back to `since`), which the twelve files share and none of them could hold alone.
Outside-Region: src/packaging/rows-by-label-fixtures.ts — the fake's half of that reader (`readsRowsSince`, `sinceAnswer`), beside the by-label ones every fake already imports.
Outside-Region: docs/gh-call-inventory.json — generated, regenerated with `node src/packaging/gh-call-inventory.ts` (calls 411 to 396, spawn sites unchanged at 137).
Outside-Region: .changeset/twelve-more-list-readers-connections.md — a merge with no changeset is never live.
Outside-Region: src/dora-budget-spent-is-not-a-timeout.test.ts — its stub `gh` answers the merged list's `api graphql` and its expected wording names the call.
Outside-Region: src/inert-option-incident.test.ts — its fake answers the merged list as a connection.
Outside-Region: src/merged-row-open-incident.test.ts — its fake answers the merged list and the claimed rows as connections and refuses a search argv.
Outside-Region: src/messaging/sources/requests.test.ts — the real reader's argv are `api graphql` reads now, and `assertReadOnlyGh` refuses a mutation and a `--label`/`--search` list.
Outside-Region: src/org-retro-dora-resumes.test.ts — its stub `gh` answers the merged list's `api graphql`.
Outside-Region: src/org-retro-merged-repositories.test.ts — `mergedPrsArgs` became `readMergedSince`, and the test pins the connection call and the limit-hit marker.
Outside-Region: src/packaging/board-snapshot.test.ts — the ready-issue list is a by-label connection, so its fakes answer that.
Outside-Region: src/packaging/close-rows-sweep.test.ts — `mergedPrsInWindow` reads the merged connection, so its fake answers that.
Outside-Region: src/packaging/conflict-metrics.test.ts — `prsBy` reads the pullRequests connection and `PR_SEARCH_LIMIT` is `PR_WINDOW_LIMIT`, refused by pages.
Outside-Region: src/packaging/git-reads-name-their-checkout.test.ts — its `gh` fake answers the merged list's connection with an empty page.
Outside-Region: src/packaging/haiku-tier.test.ts — `closedRowsArgs` is gone: the closed rows are a connection read, kept by `closedAt`.
Outside-Region: src/packaging/hand-fix-ledger.test.ts — its `gh` fake answers the merged list's connection before its commits path.
Outside-Region: src/packaging/hand-fix-reading-trust.test.ts — its `gh` fake answers the merged list's connection before its commits path.
Outside-Region: src/packaging/org-retro.test.ts — its idle-claim fake answers the claimed rows and the merged list as connections.
Outside-Region: src/provider-low-confidence.test.ts — its tracker fake answers the class rows as two by-label connections.
Outside-Region: src/ready-label-audit.test.ts — adds the two cases `fetchReadyRowsWithBodies` had none of.
Outside-Region: src/untiered-ready-rows.test.ts — `ghReadyReader` reads the by-label connection, so its test pins that call.
