In `webhook` mode the gate reads only the pull requests a tick's scopes name, keeps a remembered whole open list per repository, and records each dated wait's due instant in the due-index (a11ign/a11ign#5043, agent-org#1093). `poll` mode (no `A11Y_TICK_SCOPES_FILE`, and a host that does not declare `webhook`) is unchanged.

**What changes.**
- `src/work-gate/reads.ts`: `readPrs()` on the home run reads the tick's scopes (`A11Y_TICK_SCOPES_FILE`). With a usable list it asks `pr-list-memory.ts`'s `narrowedPrList` for the named pull requests only, remembers the merged list (keeping the time of the last WHOLE read, so staleness is measured from it), and returns it. A scope list of `[]` serves the remembered list with no call. A missing, unreadable or malformed scopes file, a `sha` or merge-group scope, no remembered list, a list older than `MAX_UNCHANGED_SECONDS`, or a failed view reads the whole open list as before (`readWholeOpenPrs`), and that whole read is remembered. A refused read stays `null`. Other runs (other repositories' lanes) and poll mode take the whole path unchanged. The path to the memory file is resolved only on the scoped path, so a host whose declaration cannot be read polls exactly as before.
- `src/ticket-port/open-pulls.ts`: `openPullViewOf`, the one-pull-request read, so `reads.ts` spawns no new `gh` call (the product-manager ruling on this row: the gh-call baseline is NOT raised).
- `src/work-gate/due-index-write.ts` (new): `dueEntriesOf(rows)` turns a repository's open rows into due instants (`Not-before:`, `Fleet-hold-until:`, and aged-backlog `createdAt + AGED_BACKLOG_MS + 1`, since the backlog check is strict); `recordDueInstants` writes them with `writeDueIndex`.
- `readOpenRows` (`reads.ts`) calls `recordDueInstants` on the rows it has just read, when the host declares `webhook` and the list is shorter than `OPEN_ROWS_LIMIT` (a list at the cap may be cut, and a cut list would replace the repository's instants with fewer). A write that fails is said on stderr and the rows are still returned. This is the one call site inside the Region where a repository's open rows are in hand; `work-gate.ts` is not touched.

**First tick after the change.** With no remembered list (`missing: no memory file`), the first healthy webhook tick that hands over scopes reads the whole open list once, remembers it, and writes one stderr line: `work-gate: the open list is read whole (missing: no memory file)`. Every tick after it re-reads only the named pull requests until the list is older than the reconcile. Poll mode writes no memory file and no index.

**Revert.** `"source": "poll"` in `host.json`: the tick then sets no scopes file and the host declares no `webhook`, so the gate makes today's calls and writes nothing.

**Mutations** (each applied to `reads.ts`, the test file run, then restored with `cp` and `diff` to byte-identical):
- the due-index is never recorded: 2 red (POSITIVE CONTROL and the write-failure test);
- recorded in poll mode too: 1 red (NEGATIVE CONTROL);
- the row-cap check dropped: 1 red (a cut list keeps the earlier entries);
- a `[]` scope list read whole: 1 red.
- Earlier, on the narrowed path: scoped path never taken 6 red; aged instant without `+ 1` 1 red; whole read not remembered 1 red.

**Evidence.**
- `npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/work-gate-scopes-and-due-index.test.ts`: 21 of 21 pass.
- `src/packaging/gh-call-ratchet.test.ts`, `src/ticket-port/ticket-port.test.ts` and `src/packaging/work-gate.test.ts` together: 443 pass, 0 fail; `reads.ts` is back at its baseline of 6 calls.
- The 18 test files that mention `work-gate/reads`, `readOpenRows`, `readPrs` or `open-pulls`: 734 of 736 pass. The 2 failures are in `src/packaging/org-health.test.ts` and fail identically with `reads.ts` at `origin/main` (measured: the same file run with the base `reads.ts` restored, 2 of 33 fail).
- `tsc --noEmit` exits 0.

Acceptance: `git grep -q "POSITIVE CONTROL" -- src/packaging/work-gate-scopes-and-due-index.test.ts && git grep -q "NEGATIVE CONTROL" -- src/packaging/work-gate-scopes-and-due-index.test.ts && npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/work-gate-scopes-and-due-index.test.ts`

Outside-Region: `src/work-gate/tick.ts` `readLanes`, where other repositories are still read whole (the memory is keyed by `REPO` only), and `src/work-gate.ts`, which needs no line because the write rides `readOpenRows`.

platform: n/a (a read path and a state file; no platform feature)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
