`wake.ts` and `row-file.ts` list rows through connections, not GitHub search, and the guard walks them (a11ign/a11ign#5074, the second half of #5050).

**What changes.**
- `wake.ts`: `fileRepositoryRow` and `closeAnsweredRow` read their open rows by label through `readRowsByLabel`; `reaskFiledRow` reads the title's rows through `rowsTitled` (the newest 200 closed parked rows, the open parked rows, the newest 200 open rows) instead of `--state all --search`.
- `row-file.ts`: the duplicate-title check is a plain list of the newest 200 open rows (was 100 by `--search`), through `readUnlessRefused`.
- `no-search-reads.test.ts` walks both files and asserts each still lists (a plain list), so the walk reads a file that lists.

**Cost named, not hidden.** Without a search a twin of an OPEN row older than the 200-row window is not seen by the duplicate-title check, and a closed stuck-cause row older than the newest 200 closed parked rows is not seen by the re-ask. The check exists for the second copy of a filing run launched twice, which is the newest row. If that window is too narrow it is a decision for `product-manager`.

Acceptance:

```bash
bash -c 'npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/no-search-reads.test.ts src/stuck-row-reask-filed.test.ts src/row-file-roadmap.test.ts src/row-file-board.test.ts'
```

Measured: that command prints `VERDICT pass` at this head; with `src/sweep-window.test.ts` added, 90 tests in 5 files pass.

Mutation: each run by copying the file aside, mutating, running `no-search-reads.test.ts`, restoring and `diff`ing the restore.
1. `["issue", "list", "--state", "open", "--label", "x", ...]` appended to `wake.ts`: 1 red, "wake.ts lists rows through a SEARCH (line 8404)".
2. the same appended to `row-file.ts`: 1 red, "row-file.ts lists rows through a SEARCH (line 2954)".
3. unmutated: 15 of 15 pass.

Not done: the rest of the table in #5074 (`ready-label-audit.ts`, `untiered-ready-rows.ts`, `board-snapshot.ts`, `board-data.ts`, `close-rows-sweep.ts`, `close-rows-for-merged-pr.ts`, `hand-fix-ledger.ts`, `dora.ts`, `org-retro.ts`, `provider-low-confidence.ts`, `messaging/watch.ts`, `trace/haiku-tier-report.ts`, and `fleet-gated-nightly.ts` via `FLEET_GATED_SELECTOR`) is the row after this one, filed with this PR's merge (done-when 2). The live reading (list calls an hour after) needs a release and an hour of ticks, so it is not claimed here.

Closes: a11ign/a11ign#5074

Outside-Region: src/stuck-row-reask-filed.test.ts — its fake answered the title `--search`; it answers the connection reads now and refuses a search argv.
Outside-Region: docs/gh-call-inventory.json — generated, regenerated with `node src/packaging/gh-call-inventory.ts`.
Outside-Region: .changeset/the-tick-and-filing-list-no-search.md — a merge with no changeset is never live.

platform: GitHub's own GraphQL connections (`repository.issues(labels:)`, a plain `issue list`) and the existing `host/gh` identical-read cache; nothing built beside them.
Outside-Region: src/packaging/row-file-refuses-duplicate-title.test.ts — the duplicate-title read is a plain list of the newest 200 open rows, so its fake's limit and no-search assertion changed.
Outside-Region: src/work-gate-stuck-escalation-keyed.test.ts — its fake answers the stuck-row label reads as connections.
Outside-Region: src/stuck-row-state.test.ts — its fake answers the stuck-row label reads as connections.
Outside-Region: src/stuck-row-answered.test.ts — its fake answers the parked-row label read as a connection.
