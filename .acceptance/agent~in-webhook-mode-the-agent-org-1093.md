In `webhook` mode the gate reads only the pull requests a tick's scopes name, keeps a remembered whole open list per repository, and records each dated wait's due instant in the due-index (a11ign/a11ign#5043, agent-org#1093). `poll` mode (no `A11Y_TICK_SCOPES_FILE`, and a host that does not declare `webhook`) is unchanged.

**What changes.**
- `src/work-gate/reads.ts`: `readPrs` on the checkout's own repository reads the tick's scopes (`A11Y_TICK_SCOPES_FILE`). With a usable list it asks `pr-list-memory.ts`'s `narrowedPrList` for the named pull requests only (one `pr view` each, through the ticket port's `pullViewArgs`), remembers the merged list (keeping the time of the last WHOLE read, so staleness is measured from it), and returns it, without consulting the conditional reader. A scope list of `[]` serves the remembered list with no call. A missing, unreadable or malformed scopes file, a `sha` or merge-group scope, no remembered list, a list older than `MAX_UNCHANGED_SECONDS`, or a failed view reads the whole list as `main` now reads it (`readPrsWhole`: the conditional reader when `gate.restConditional` is on, `readPrsAsListed` otherwise), and a non-empty whole read is remembered. A refused read stays `null`.
- `readOpenRows` (`reads.ts`) calls `recordDueInstants` (`src/work-gate/due-index-write.ts`, new) on the rows it has in hand, whichever way it got them (listed, or kept by the conditional reader), when the host declares `webhook`, the list is not empty and is shorter than `OPEN_ROWS_LIMIT`. A write that fails is said on stderr and the rows are still returned. `due-index-write.ts`: `dueEntriesOf(rows)` turns open rows into instants (`Not-before:`, `Fleet-hold-until:`, aged-backlog `createdAt + AGED_BACKLOG_MS + 1`, since the backlog check is strict).
- WHICH READS: `isAmbientRun` marks `defaultRun` and the first wave's wrappers made of it (`ambientStandingFor`, in `readWithFirstWaveTogether`). The gate reads the primary repository through those wrappers, so `run === defaultRun` selected nothing in production; a lane's `aimed` wrapper (`readLanes`) stands for `gh` but is another repository's and is not ambient. The repository is `repoNow()`.
- The `pr view` is not a new call site: `pullViewArgs` is the ticket port's (a11ign#5169), run through `reads.ts`'s own `run`, so the gh-call ratchet's baseline is untouched (the product-manager ruling on this row). The `openPullViewOf` this branch carried before #5169 landed is dropped as a duplicate.
- `work-gate.ts` and `tick.ts` are not touched.

**First tick after the change.** With no remembered list (`missing: no memory file`), the first healthy webhook tick that hands over scopes reads the whole open list once (as `main` reads it at that moment), remembers it, and writes one stderr line: `work-gate: the open list is read whole (missing: no memory file)`. Every tick after it re-reads only the named pull requests until the list is older than the reconcile. Poll mode writes no memory file and no index.

**Revert.** `"source": "poll"` in `host.json`: the tick then sets no scopes file and the host declares no `webhook`, so the gate makes today's calls and writes nothing.

**Known limit, named.** A scope other than the checkout's own (a lane `readLanes` aims at another repository) is read whole, as before: the memory and the index are keyed by the repository the ambient read is of, and `tick.ts` (outside this Region) is where an aim is known when the flag is off.

**Mutation:** each applied to `reads.ts`, the test file run, then restored from a copy and `diff`ed to byte-identical (`cmp` true):
- the first wave's wrappers are not marked ambient: 1 red ("the gate's own reads are ambient ...");
- every run is ambient: the same 1 red;
- an empty row list is recorded: 1 red (NEGATIVE CONTROL, the rehearsal's `[]`);
- an empty whole list is remembered: 1 red (NEGATIVE CONTROL);
- earlier, on the first build of this branch: the due-index never recorded 2 red; recorded in poll mode too 1 red; the row-cap check dropped 1 red; a `[]` scope list read whole 1 red; scoped path never taken 6 red; aged instant without `+ 1` 1 red; whole read not remembered 1 red.

**Evidence** (measured in this worktree at this head, rebased onto `origin/main` `9e07ebf0`):
- `npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/work-gate-scopes-and-due-index.test.ts`: `VERDICT pass: 25 tests in 1 file`.
- `pnpm run typecheck` exits 0.
- `pnpm test` (the whole suite): 7 of 10571 fail, in `live-tree-independence`, `release-tag-on-merge`, `wait-condition`, `work-gate-other-scopes-concurrent` and `worker-stop-hook`. Each of those five files fails identically (same counts: 2, 1, 2, 1, 1) with `src/work-gate/reads.ts` replaced by `origin/main`'s, so none is caused by this change; they are not fixed here.

Acceptance:

```bash
git grep -q "POSITIVE CONTROL" -- src/packaging/work-gate-scopes-and-due-index.test.ts
git grep -q "NEGATIVE CONTROL" -- src/packaging/work-gate-scopes-and-due-index.test.ts
npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/work-gate-scopes-and-due-index.test.ts
```

Closes a11ign/agent-org#1093

platform: ticket-port `pullViewArgs` (already there) and the state directory; no platform feature replaces a remembered list or a due-index.
