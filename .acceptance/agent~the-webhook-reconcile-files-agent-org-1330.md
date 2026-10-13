A webhook reconcile that finds the same repository set drifted again files ONE incident row, not one per window (a11ign/agent-org#1330, parent agent-org#982). `groupOf` keyed the row by `repo@window`, so every window opened a new key and `recordIncident` filed a second row beside an open one.

**What changes.**
- *Key by the repository set.* `groupOf` keys the group `event-drift:<sorted repo set>` with no window. The window the row first named stays in its `Step:`; a join never rewrites the body of a group with no PRs, so the body is not edited.
- *Fold into a row that just closed.* `fileDrift` reads the open and closed rows (`standingOf`). A repository set whose row closed within `QUIET_AFTER_CLOSE_MS` is folded into it: the pass logs that, files nothing, and returns `true`. After the window it files a row of its own.
- *A failed read is retried, never duplicated.* If the rows cannot be read, `fileDrift` logs the reason and returns `false`, so the probes stay CHANGED and the next tick retries; `recordIncident` is not called.
- `readRows` is exported from `ci-failure-class.ts` for `fileDrift`; nothing else there changes.

Acceptance: `node --test src/event-drift.test.ts`

Mutation: two directions, each restored byte-identical (copy in the scratchpad, `diff` after the restore):
- *Key back to `repo@window`*: 3 red: the join test (the OPEN row is joined, `creates` stays 1), the fold test, and the default-filer test (its key is asserted). Restored: 17 of 17.
- *Closed-row fold branch disabled* (`if (false && ...)`): 1 red, the fold test (inside the quiet window it must not file; after it, it must). Restored: 17 of 17.

Evidence: `node --test src/event-drift.test.ts` 17 of 17. Related files, all green: `ci-failure-class.test.ts` 29, `ci-failure-class-assertions.test.ts` 5, `ci-failure-class-boards.test.ts` 6, `tick-snapshot-events.test.ts` 13. `pnpm run typecheck` exits 0.

**Not changed, named.** `src/tick-snapshot.ts` says "incident filed" whenever `fileDrift` returns `true`, so a fold reads as "incident filed" in the tick line. The row is correct; only the wording is wrong. Left for a follow-up.

Closes: a11ign/agent-org#1330

platform: n/a (no GitHub, pnpm, systemd or git feature does this; the group key is a string built in this file)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
