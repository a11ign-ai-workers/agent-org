The gate makes no search-backed list read, and one refused read is asked once per tick (a11ign/a11ign#5050, the gate half of #5039).

**The incident (measured).** `gh issue list --label` and `--search` are sent by `gh` as a GitHub SEARCH, whose allowance the scheduler App's installation spent on 2026-10-11 (#5039). #5039 moved the CLAIM path; this moves the gate's. In the workers' call ledger (`~/workers/gh/gh-calls.tsv`, read locally, no API call) the 14:00Z hour holds 1,620 `issue list` / `pr list` / `label list` calls, 889 of them from `work-gate.ts`, 420 from `row-file.ts` and 119 from `work-tick.ts` (the ledger's resource column reads `graphql?` for all of them: it cannot tell a search from a connection).

**What changes.**
- `work-gate.ts` lists no row through a search. The label lists (`readReadyRows`, `readPromotableRows`, `readChairmanBlocked`, `readClaimedRowComments`, `readClosedClaimLabelRows`, `writeResolverDefect`) are `repository.issues(labels:)` connections through the claim path's `readRowsByLabel` (`labelledRows`), their rows handed back in `gh issue list --json`'s shape so no consumer changed. `readClosedAnswerRows` asks two aliased connections (`issues` CLOSED; `pullRequests` CLOSED and MERGED), one alias per answer label because a search's `label:a,b` is OR and a connection's `labels:[a,b]` is AND; `readRecentlyClosed` is `issues(states: CLOSED, orderBy: UPDATED_AT)`. The whole open list (`issue list --state open --limit 500`) is no search and is unchanged.
- The fold (#4899) still makes the three open label lists from that one open list, now recognising the connection's argv; a label with more rows than one connection page is NOT folded (a first page called whole would drop rows), which `no-search-reads.test.ts` pins both ways.
- One refusal memory for the tick (`readUnlessRefused`): a read refused for a limit is not asked again by ANY gate list read (by label, the answer labels, the closed answer reads, the recently closed read), and the line names the resource (`X-Ratelimit-Resource`, or one follow-up read of the GraphQL pool).
- `CLOSED_CLAIM_LABEL_LIMIT` 1000 -> 500 (the most the reader holds; it would have thrown above that), `CLOSED_ANSWER_ROWS_PER_LABEL` 100 per label (the old 100 was for all labels together).
- `no-search-reads.test.ts` walks `work-gate.ts`, `queue-table.ts`, `work-tick.ts` and `work-gate/`, flags `--author`/`--assignee` as well, and drives every gate reader through a fake that refuses any search argv.

Acceptance:

```bash
bash -c 'git grep -q "POSITIVE CONTROL" -- src/packaging/no-search-reads.test.ts && git grep -q "NEGATIVE CONTROL" -- src/packaging/no-search-reads.test.ts && npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/no-search-reads.test.ts src/work-gate.test.ts src/packaging/work-gate.test.ts src/packaging/closed-pr-answer-owed.test.ts src/work-gate-lane-reads.test.ts'
```

Measured: that command printed `VERDICT pass: 471 tests in 5 files` at this head. The whole `npx rstest run --config scripts/rstest/rstest.config.ts` printed `7 of 9800 tests failed in 553 files`; the failing files are `ci-changeset-on-push`, `auto-arm-token`, `auto-arm-workflow-honours-hold`, `host-install-agent-org-launcher`, `live-tree-independence`, `messaging-units-start`, `release-safety`, `release-tag-on-merge`, `release-triggers-itself`, `release-consumer-check`, `work-gate-other-scopes-concurrent` and `worker-stop-hook`, and every one of them fails identically on a clean worktree of `origin/main` at `81ed04c1` (the first ten were not diagnosed beyond that: `yaml` is not installed in this host's partial `node_modules`; the last two are host state, a 24-hour `trunk-workflow-*` marker in `~/.cache/a11ign` and an unset `AGENT_ORG_HOST`, as their own failure text says). `tsc --noEmit -p tsconfig.json` reports nothing but the missing `yaml` and `@rstest/core` modules of this host's partial install.

Mutation (eight, each run by a script that copies the file aside, mutates, runs `no-search-reads.test.ts`, `work-gate.test.ts` and `work-gate-lane-reads.test.ts`, restores, and asserts the restore byte-identical):
1. a `["issue", "list", "--state", "open", "--label", "ready", ...]` added to `work-gate.ts`: 1 red, the source guard's NEGATIVE CONTROL (done-when 1).
2. `readReadyRows` put back to `issue list --label`: 5 red (the source guard, its gate positive control, the refusing-fake POSITIVE CONTROL, the once-per-tick test, and `work-gate.test.ts` (1d)).
3. the refusal never remembered: 3 red (the claim path's once-per-tick test and the two new gate tests).
4. the closed answer read taken out of the shared memory: 1 red, the test that a refused closed read stops the next by-label read.
5. the fold ignoring the connection's page size: 1 red, "a label with MORE rows than one page ... is NOT answered from the open list".
6. the fold never answering: 5 red (the fold's positive control, `work-gate.test.ts` (1a) and (1d), and two in `work-gate-lane-reads.test.ts`).
7. the source guard made to never fire: 1 red, its POSITIVE CONTROL (source).
8. the source guard made to always fire: 2 red, its NEGATIVE CONTROL (source) and POSITIVE CONTROL (source).

Not done in this change, and why:
- Done-when 2 (list calls per hour after, below 800) and 3 (the scheduler back on its App with an hour of ticks and zero search refusals) need this merged and released (`update-tool` takes the newest release tag) and an hour of live ticks: they are a live reading and a `host.json` edit after the merge, filed as their own row. The BEFORE reading is above.
- Search-backed list reads OUTSIDE the gate's files remain, by a scan of `git ls-files src` for `["issue"|"pr", "list", ... --label|--search ...]` in non-test sources: `wake.ts` (3, run by `work-tick`), `row-file.ts`, `ready-label-audit.ts`, `untiered-ready-rows.ts`, `board-snapshot.ts`, `board-data.ts`, `close-rows-sweep.ts`, `close-rows-for-merged-pr.ts`, `hand-fix-ledger.ts`, `dora.ts`, `org-retro.ts`, `provider-low-confidence.ts`, `messaging/watch.ts`, `trace/haiku-tier-report.ts`, and `fleet-gated-nightly.ts` through `FLEET_GATED_SELECTOR.listArgs`. They are filed as a row; the gate's own are done.
- `gh label list --search answer:` stays: read with `GH_DEBUG=api` against an unreachable host it is `repository.labels(query:)`, a GraphQL connection, not a search (measured; `gh pr list --state merged|--head|--state open` are `repository.pullRequests`).
- Which merges added list calls (row item 3): a pickaxe `git log origin/main --since=2026-10-10T20:00Z -S'"list"' -- src` finds #5039 (the claim, converted), #5008 (`ci-failure-class.ts`, converted by #5039), agent-org#923 and agent-org#853; #4970, #5009 and #4990 add no `"list"` argv in the tree. #923 and #853 were not inspected.

Closes: a11ign/a11ign#5050

Outside-Region: src/ticket-port/rows-by-label.ts — `readUnlessRefused` exposes the one refusal memory the gate's other connection reads must share, and `readRowsByLabel` is rewritten over it.
Outside-Region: src/packaging/rows-by-label-fixtures.ts — the fakes' half of the new reads (`readsClosedAnswerRows`, `readsRecentlyClosed`, `connectionOfSelected`).
Outside-Region: src/packaging/work-gate.test.ts — the fakes of the readers converted here (and `beforeEach(forgetRefusedReads)`).
Outside-Region: src/work-gate.test.ts — the fold's tests read the connection's argv.
Outside-Region: src/work-gate-lane-reads.test.ts — the lanes' fakes answer connections.
Outside-Region: src/work-gate-stale-blocker-cleared.test.ts — the closings read is a connection.
Outside-Region: src/closed-answer-rows-reason.test.ts — the closed answer reads are aliased connections.
Outside-Region: src/packaging/closed-pr-answer-owed.test.ts — the closed answer reads are aliased connections.
Outside-Region: src/packaging/closed-row-ends-instance.test.ts — the closed claim-label read is a connection.
Outside-Region: src/packaging/claimed-row-comments.test.ts — the claimed rows' comments read is a connection.
Outside-Region: src/packaging/gate-b4-repo-scope.test.ts — the Ready list is a connection.
Outside-Region: src/packaging/multi-board-gate.test.ts — the Ready list is a connection.
Outside-Region: src/packaging/outcome-clock-feed.test.ts — the claimed rows' read is a connection.
Outside-Region: src/packaging/repeating-lines.test.ts — the backlog read is a connection.
Outside-Region: src/work-gate-chairman-answered.test.ts — the `needs:chairman` list is a connection.
Outside-Region: src/work-gate-claim-stall-other-tracker.test.ts — the claimed rows' read is a connection.
Outside-Region: src/work-gate-cross-repo-pr-owner.test.ts — the resolver-defect read is a connection.
Outside-Region: src/work-gate-one-wave.test.ts — the label reads are connections.
Outside-Region: src/work-gate-other-scopes-concurrent.test.ts — the label reads are connections.
Outside-Region: docs/gh-call-inventory.json — generated, regenerated with `node src/packaging/gh-call-inventory.ts`.
Outside-Region: .changeset/the-gate-makes-no-search-backed-reads.md — a merge with no changeset is never live.

platform: GitHub's own GraphQL connections (`repository.issues(labels:)`, `Label`-less aliased `issues`/`pullRequests`, `orderBy: UPDATED_AT`) and the existing `host/gh` 20-second identical-read cache; nothing built beside them. ETag/`If-None-Match` was NOT taken (inferred, not measured): a GraphQL POST has no conditional request, and the REST `issues?labels=` list the row names would be one core-pool call per list where a connection is one GraphQL read the gate already budgets.
